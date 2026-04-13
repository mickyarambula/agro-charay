// ─── modules/Egresos.jsx ───────────────────────────────────────────

import React, { useState, useReducer, useContext, useCallback, useRef, useEffect, useMemo } from 'react';
import { useData } from '../core/DataContext.jsx';
import {
  T, css, confirmarEliminar, puedeEliminarLote, puedeEliminarProductor,
  puedeEliminarMaquina, puedeEliminarOperador, MOTIVOS_CANCELACION,
  CULTIVOS, ESTADOS_FENOL, TIPOS_TRABAJO, CAT_INSUMO, UNIDADES, CAT_GASTO,
  filtrarPorProductor, PROD_COLORES, ordenarProductores, nomCompleto,
  mxnFmt, fmt, today, fenologiaColor, estadoColor
} from '../shared/utils.js';
import {
  Modal, ModalCancelacion, ModalReactivacion, BadgeCancelado,
  BtnExport, NavBadge
} from '../shared/Modal.jsx';
import {
  ROLES, ACCESO, USUARIOS, getRolInfo, getRolesDisponibles,
  getRolPermisos, getPermisosUsuario
} from '../shared/roles.js';
import {
  calcularInteresCredito, calcularInteresCargosCredito, calcularFinancieros,
  calcularCreditoProd, calcularVencimiento, getParamsCultivo, calcularAlertas,
  exportarExcel, descargarHTML, exportarExcelProductor, generarHTMLProductor,
  generarHTMLTodos, exportarExcelTodos, navRowProps, FiltroSelect, PanelAlertas
} from '../shared/helpers.jsx';


export default function EgresosModule({ userRol, puedeEditar, onNavigate, navFiltro = {} }) {
  const { state, dispatch } = useData();
  const nav = (page, pid, filtros) => onNavigate && onNavigate(page, pid, filtros);
  const hoy = new Date().toISOString().split("T")[0];

  const productores  = state.productores || [];
  const cicloPred    = (state.ciclos||[]).find(c=>c.id===state.cicloActivoId)||(state.ciclos||[]).find(c=>c.id===state.cicloActivoId)||(state.ciclos||[]).find(c=>c.predeterminado)||(state.ciclos||[])[0];
  const asigsCiclo   = cicloPred?.asignaciones || [];
  const cicloFiltroId = state.cicloActivoId||1;
  const dispersiones = (state.dispersiones||[]).filter(d=>(d.cicloId||1)===cicloFiltroId);
  const _cicloId = state.cicloActivoId||1;
  const egresosMan   = (state.egresosManual||[]).filter(e=>(e.cicloId||1)===_cicloId);

  // Insumos y diesel del módulo correspondiente
  const insumos  = (state.insumos||[]).filter(i=>(i.cicloId||1)===_cicloId);
  const diesel   = (state.diesel||[]).filter(d=>(d.cicloId||1)===_cicloId);

  // ── Vistas ───────────────────────────────────────────────────────────────────
  const [vista, setVista] = useState(
    navFiltro.prodId ? "detalle_prod" : (navFiltro.vista || "resumen")
  );
  const [cancelModal, setCancelModal] = useState(null);
const fileEgresosRef    = useRef(null);
  const [importLogEgresos,    setImportLogEgresos]    = useState([]);
  const [importandoEgresos,   setImportandoEgresos]   = useState(false);

  const importarEgresos = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportandoEgresos(true);
    setImportLogEgresos(["⏳ Cargando..."]);
    try {
      const XLSX = await cargarXLSX();
      const ab   = await file.arrayBuffer();
      const wb   = XLSX.read(new Uint8Array(ab), {type:"array", cellDates:true});
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const allRows = XLSX.utils.sheet_to_json(ws, {defval:"", raw:false, header:1});
      let headerRowIdx = allRows.findIndex(r=>r.some(c=>String(c).toUpperCase().trim()==="CATEGORIA"));
      if(headerRowIdx===-1) headerRowIdx=0;
      const headers = allRows[headerRowIdx].map(h=>String(h||"").trim().toUpperCase());
      const rows = allRows.slice(headerRowIdx+1).map(row=>{
        const obj={}; headers.forEach((h,i)=>{obj[h]=row[i]!==undefined?String(row[i]).trim():"";});
        return obj;
      });

      const logs = [];

      // Filtrar filas que son encabezados de descripción o vacías
      const dataRows = rows.filter(row => {
        const cat = String(row["CATEGORIA"]||"").trim().toLowerCase();
        return cat && cat !== "categoria" && Object.values(CAT_LABELS).map(v=>v.toLowerCase()).concat(Object.keys(CAT_LABELS)).some(k=>cat===k);
      });

      logs.push(`📋 ${dataRows.length} registros encontrados`);

      const getCol = (row,...keys) => {
        for (const k of keys) {
          if (row[k]!==undefined&&String(row[k]).trim()!=="") return String(row[k]).trim();
          const fnd = Object.keys(row).find(c=>c.toUpperCase().replace(/[^A-Z0-9_]/g,"")===k.toUpperCase().replace(/[^A-Z0-9_]/g,""));
          if (fnd&&String(row[fnd]).trim()!=="") return String(row[fnd]).trim();
        }
        return "";
      };

      const nuevos = [];
      let sinProd = 0, sinCat = 0;

      dataRows.forEach((row, i) => {
        const catRaw  = getCol(row,"CATEGORIA").toLowerCase().trim();
        const prodNom = getCol(row,"PRODUCTOR");
        const monto   = parseFloat(getCol(row,"MONTO").replace(/[$,]/g,""))||0;
        const numSol  = getCol(row,"NUM_SOLICITUD","SOLICITUD");
        const numOrden= getCol(row,"NUM_ORDEN","ORDEN");
        const concepto= getCol(row,"CONCEPTO");

        if (!catRaw) { sinCat++; return; }
        if (!monto)  return;

        // Buscar productor
        const prodMatch = productores.find(p => {
          const nom   = `${p.apPat||""} ${p.apMat||""} ${p.nombres||""}`.toUpperCase().trim();
          const alias = (p.alias||"").toUpperCase().trim();
          const pNom  = prodNom.toUpperCase().trim();
          return nom===pNom || alias===pNom
            || (p.apPat && pNom.startsWith(p.apPat.toUpperCase()))
            || nom.split(" ").some(w=>w.length>4&&pNom.includes(w));
        });
        if (!prodMatch) { sinProd++; }

        // Tomar fecha de la dispersión ligada
        const dispLigada = (state.dispersiones||[]).filter(d=>(d.cicloId||1)===(state.cicloActivoId||1)).find(d=>
          d.numSolicitud===numSol || d.numSolicitud===String(numSol)
        );
        const fecha = dispLigada?.fecha || dispLigada?.fechaSolicitud || new Date().toISOString().split("T")[0];

        // Asignar línea de crédito automáticamente
        const exp         = (state.expedientes||[]).find(e=>e.productorId===prodMatch?.id);
        const haProd      = ((state.ciclos||[]).find(c=>c.id===state.cicloActivoId)||(state.ciclos||[]).find(c=>c.predeterminado))?.asignaciones
          ?.filter(a=>String(a.productorId)===String(prodMatch?.id))
          ?.reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0)||0;
        const creditoPara = exp?.montoPorHa ? haProd * exp.montoPorHa : 0;
        const dispParaAcum= (state.dispersiones||[]).filter(d=>((d.cicloId||1)===(state.cicloActivoId||1))&&
          String(d.productorId)===String(prodMatch?.id)&&d.lineaCredito==="parafinanciero"&&!d.cancelado
        ).reduce((s,d)=>s+(parseFloat(d.monto)||0),0);
        const lineaCredito= creditoPara>0 && dispParaAcum<creditoPara ? "parafinanciero" : "directo";

        // Datos mano de obra — nueva estructura
        const esMO          = catRaw === "mano_obra";
        const semanaNum     = getCol(row,"SEMANA_NUM");
        const semFecIni     = getCol(row,"SEMANA_FECHA_INICIO","SEMANA_FECHA INICIO");
        const semFecFin     = getCol(row,"SEMANA_FECHA_FIN","SEMANA_FECHA FIN");
        const domFecha      = getCol(row,"DOMINGO_FECHA");
        const tipoTrabajador= getCol(row,"TIPO_DE_TRABAJADOR","TIPO DE TRABAJADOR","TIPO_TRABAJADOR");
        const detalleMO     = getCol(row,"DETALLE_MO","DETALLE MO");
        const subcategoria  = getCol(row,"SUBCATEGORIA");

        nuevos.push({
          id:            Date.now()+i,
          fecha,
          categoria:     catRaw,
          subcategoria,
          concepto,
          monto,
          productorId:   prodMatch?.id||null,
          lineaCredito,
          solicitudes:   numSol ? [{numSolicitud:numSol, numOrden}] : [],
          esManoObra:        esMO,
          semanaNum,
          semanaFechaInicio: semFecIni,
          semanaFechaFin:    semFecFin,
          domingoFecha:      domFecha,
          tipoTrabajador,
          detalleMO,
        });
      });

      dispatch({type:"IMPORT_EGRESOS", payload: nuevos});

      const cats = nuevos.reduce((acc,g)=>{ acc[g.categoria]=(acc[g.categoria]||0)+1; return acc; },{});
      logs.push(`✅ ${nuevos.length} egresos importados`);
      Object.entries(cats).forEach(([k,v])=>logs.push(`  · ${CAT_LABELS[k]||k}: ${v} registros`));
      if (sinProd>0)  logs.push(`⚠️ ${sinProd} sin productor identificado — revisa nombres`);
      if (sinCat>0)   logs.push(`⚠️ ${sinCat} filas omitidas por categoría no reconocida`);
      setImportLogEgresos(logs);
    } catch(err) {
      setImportLogEgresos([`❌ Error: ${err.message}`]);
    }
    setImportandoEgresos(false);
  };
  const [prodDetalle, setProdDetalle] = useState(navFiltro.prodId ? String(navFiltro.prodId) : null);
  const [busqProd, setBusqProd] = useState("");
  const [filtroLinea, setFiltroLinea] = useState("todas");
  const [filtroCat,   setFiltroCat]   = useState("todas");
  const [filtroProd,  setFiltroProd]  = useState(navFiltro.prodId ? String(navFiltro.prodId) : (navFiltro.productor || "todos"));

  // ── Estado nuevo gasto ────────────────────────────────────────────────────────
  const emptyGasto = {
    fecha: hoy, categoria: "", subcategoria: "", concepto: "",
    monto: "", productorId: "", lineaCredito: "parafinanciero",
    solicitudes: [],
    esManoObra: false,
    semanaNum: "", semanaFechaInicio: "", semanaFechaFin: "",
    domingoFecha: "", tipoTrabajador: "", detalleMO: "",
  };
  const [formGasto, setFormGasto] = useState(emptyGasto);
  const [ligaSolic, setLigaSolic] = useState({ numSolicitud:"", numOrden:"" });

  // ── Estado nueva dispersión ───────────────────────────────────────────────────
  const emptyDisp = {
    numSolicitud:"", numOrden:"", fecha: hoy,
    productorId:"", lineaCredito:"parafinanciero", monto:"", notas:""
  };
  const [formDisp, setFormDisp] = useState(emptyDisp);

  // ── Import Excel ──────────────────────────────────────────────────────────────
  const [importLog, setImportLog] = useState([]);
  const [importando, setImportando] = useState(false);
  const fileInputRef = useRef(null);

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const nomProd = (id) => {
    if (!id) return "General";
    const p = productores.find(x=>x.id===parseInt(id)||x.id===id);
    return p ? (p.alias||p.apPat||p.nombres) : `Prod#${id}`;
  };
  const mxnFmt = (n) => (parseFloat(n)||0).toLocaleString("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:2,maximumFractionDigits:2});
  const fmt2   = (n) => (parseFloat(n)||0).toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2});

  // Cálculos globales
  const totalDispersado = dispersiones.filter(d=>!d.cancelado).reduce((s,d)=>s+(parseFloat(d.monto)||0),0);
  const [filtroCancelados, setFiltroCancelados] = useState("activos");
  const [filtroTipoTrab,   setFiltroTipoTrab]   = useState("");
  const [filtroConcepto,   setFiltroConcepto]   = useState("");
  const [filtroSemana,     setFiltroSemana]     = useState("");
  const totalGastadoMan = egresosMan.filter(g=>!g.cancelado).reduce((s,g)=>s+(parseFloat(g.monto)||0),0);
  const totalInsumos    = insumos.filter(i=>!i.cancelado).reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
  const totalDiesel     = diesel.filter(d=>!d.cancelado).reduce((s,d)=>s+(parseFloat(d.importe)||0),0);
  const totalGastos     = totalGastadoMan + totalInsumos + totalDiesel;
  const diferencia      = totalDispersado - totalGastos;

  // Por categoría
  const CAT_LABELS = {
    mano_obra:   "Mano de Obra",
    renta_tierra:"Renta de Tierra",
    pago_agua:   "Pago de Agua",
    permiso_siembra:"Permiso de Siembra",
    flete:       "Flete",
    reparaciones:"Reparaciones y Mantenimiento",
    tramites:    "Trámites y Gestión",
    seguros:     "Seguros",
    otro:        "Otro",
  };
  const CAT_ICONS = {
    mano_obra:"👷",renta_tierra:"🏡",pago_agua:"💧",permiso_siembra:"📄",
    flete:"🚛",reparaciones:"🔧",tramites:"📋",seguros:"🛡️",otro:"📌",
    semilla_auto:"🌽",insumos_auto:"🌿",diesel_auto:"⛽",
    int_para:"💰",int_dir:"💳",comisiones_para:"📑",comisiones_dir:"📑",
  };
  const CAT_COLORS = {
    semilla_auto:"#c8a84b",insumos_auto:"#2d5a1b",diesel_auto:"#e67e22",
    mano_obra:"#5b9fd6",renta_tierra:"#9b6d3a",pago_agua:"#1a6ea8",
    permiso_siembra:"#7f8c8d",flete:"#7f8c8d",reparaciones:"#7f8c8d",
    tramites:"#7f8c8d",seguros:"#8e44ad",otro:"#7f8c8d",
    int_para:"#c0392b",int_dir:"#922b21",
    comisiones_para:"#e74c3c",comisiones_dir:"#a93226",
  };
  const CAT_LABELS_EXT = {
    ...CAT_LABELS,
    semilla_auto:"Semilla",insumos_auto:"Insumos (sin semilla)",diesel_auto:"Diesel y Combustible",
    int_para:"Int. Parafinanciero",int_dir:"Int. Directo",
    comisiones_para:"Comisiones Parafin. (Fact+FEGA+AT)",comisiones_dir:"Comisiones Directas (Fact+FEGA)",
  };

  const totalSemilla = insumos.filter(i=>!i.cancelado&&i.categoria==="Semilla").reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
  const totalInsumosNoSemilla = totalInsumos - totalSemilla;

  // F ya viene de calcularFinancieros — reutilizamos sin recalcular
  const F2 = calcularFinancieros(state);
  const totalOpTotal = totalGastos + (F2.costoFinanciero||0);

  const resumenCat = {};
  Object.keys(CAT_LABELS).forEach(k => {
    resumenCat[k] = egresosMan.filter(g=>!g.cancelado&&g.categoria===k).reduce((s,g)=>s+(parseFloat(g.monto)||0),0);
  });
  resumenCat["semilla_auto"]     = totalSemilla;
  resumenCat["insumos_auto"]     = totalInsumosNoSemilla;
  resumenCat["diesel_auto"]      = totalDiesel;
  // Financieros — de calcularFinancieros para no duplicar lógica
  if((F2.costoInteresPara||0)>0)      resumenCat["int_para"]          = F2.costoInteresPara;
  if((F2.costoInteresDir||0)>0)       resumenCat["int_dir"]           = F2.costoInteresDir;
  if((F2.costoComisionesPara||0)>0)   resumenCat["comisiones_para"]   = F2.costoComisionesPara;
  if((F2.costoComisionesDir||0)>0)    resumenCat["comisiones_dir"]    = F2.costoComisionesDir;

  // Por línea de crédito
  const totalPara   = dispersiones.filter(d=>d.lineaCredito==="parafinanciero").reduce((s,d)=>s+(parseFloat(d.monto)||0),0);
  const totalDirec  = dispersiones.filter(d=>d.lineaCredito==="directo").reduce((s,d)=>s+(parseFloat(d.monto)||0),0);

  // Por productor
  const hasProd = (id) => asigsCiclo.filter(a=>String(a.productorId)===String(id)).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);
  const dispProd  = (id) => dispersiones.filter(d=>String(d.productorId)===String(id)).reduce((s,d)=>s+(parseFloat(d.monto)||0),0);
  const insumoProd  = (id) => insumos.filter(i=>String(i.productorId)===String(id)&&!i.cancelado).reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
  const semillaProd = (id) => insumos.filter(i=>String(i.productorId)===String(id)&&!i.cancelado&&i.categoria==="Semilla").reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
  const dieselProd  = (id) => diesel.filter(d=>String(d.productorId)===String(id)&&!d.cancelado).reduce((s,d)=>s+(parseFloat(d.importe)||0),0);
  const efectivoProd= (id) => egresosMan.filter(g=>String(g.productorId)===String(id)).reduce((s,g)=>s+(parseFloat(g.monto)||0),0);
  const gastoProd   = (id) => insumoProd(id) + dieselProd(id) + efectivoProd(id);

  // Cuadre solicitud
  const gastosPorSolicitud = (numSol) => {
    return egresosMan.filter(g=>(g.solicitudes||[]).some(s=>s.numSolicitud===numSol));
  };
  const dispSolicitud = (numSol) => dispersiones.find(d=>d.numSolicitud===numSol);

  // ── Guardar dispersión ────────────────────────────────────────────────────────
  const guardarDisp = () => {
    if (!formDisp.numSolicitud || !formDisp.monto || !formDisp.productorId) return;
    dispatch({ type:"ADD_DISPERSION", payload:{
      ...formDisp, id: Date.now(),
      monto: parseFloat(formDisp.monto)||0,
      productorId: parseInt(formDisp.productorId)||formDisp.productorId,
    }});
    setFormDisp(emptyDisp);
    setVista("dispersiones");
  };

  // ── Guardar gasto manual ──────────────────────────────────────────────────────
  const guardarGasto = () => {
    const monto = parseFloat(formGasto.monto)||0;
    if (!monto || !formGasto.categoria) return;
    dispatch({ type:"ADD_EGRESO", payload:{
      ...formGasto, id: Date.now(),
      monto,
      productorId: formGasto.productorId ? parseInt(formGasto.productorId)||formGasto.productorId : null,
    }});
    setFormGasto(emptyGasto);
    setVista("gastos");
  };

  // ── Importar Excel parafinanciera ─────────────────────────────────────────────
  // Cargar SheetJS dinámicamente si no está disponible
  const cargarXLSX = () => new Promise((resolve, reject) => {
    if (window.XLSX) { resolve(window.XLSX); return; }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.onload = () => resolve(window.XLSX);
    script.onerror = () => reject(new Error("No se pudo cargar la librería XLSX"));
    document.head.appendChild(script);
  });

  const importarExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportando(true);
    setImportLog(["⏳ Cargando librería..."]);
    try {
      const XLSX = await cargarXLSX();
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type:"array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows  = XLSX.utils.sheet_to_json(sheet, { defval:"", raw: false });

      const logs = [];
      let agregados = 0;
      const nuevas = [];

      if (rows.length === 0) { setImportLog(["❌ El archivo está vacío o no tiene datos"]); setImportando(false); return; }

      // Detectar columnas disponibles (búsqueda flexible: sin importar mayúsculas/espacios/#)
      const colsDetectadas = Object.keys(rows[0]);
      logs.push(`📋 Columnas detectadas: ${colsDetectadas.join(" | ")}`);

      // Función de búsqueda flexible de columna
      const getCol = (row, ...keywords) => {
        for (const key of keywords) {
          // Coincidencia exacta primero
          if (row[key] !== undefined && row[key] !== "") return String(row[key]).trim();
          // Búsqueda flexible
          const found = Object.keys(row).find(k =>
            k.toUpperCase().replace(/[^A-Z0-9]/g,"").includes(key.toUpperCase().replace(/[^A-Z0-9]/g,""))
          );
          if (found && row[found] !== undefined && row[found] !== "") return String(row[found]).trim();
        }
        return "";
      };

      rows.forEach((row, i) => {
        const numSol   = getCol(row, "# SOLICITUD", "# SOLICITU", "SOLICITUD", "SOLICITU", "NSOLICITUD", "NUM SOLICITUD");
        const numOrden = getCol(row, "# ORDEN", "ORDEN", "NORDEN", "NUM ORDEN");
        const fecha    = getCol(row, "FECHA SOLICITU", "FECHA SOLICITU", "FECHASOLICITU", "FECHA");
        const productor= getCol(row, "PRODUCTOR");
        const montoStr = getCol(row, "IMPORTE", "MONTO", "AMOUNT");
        const monto    = parseFloat(montoStr.replace(/[,$]/g,""))||0;
        const linea    = "parafinanciero";

        if (!numSol) { return; } // silencioso para no llenar de logs

        // Buscar productor: por apellido paterno + nombre completo
        const prodMatch = productores.find(p => {
          const nombreCompleto = `${p.apPat||""} ${p.apMat||""} ${p.nombres||""}`.toUpperCase().trim();
          const prodUp = productor.toUpperCase();
          // Coincidencia por apellido paterno
          const apPat = (p.apPat||"").toUpperCase();
          return nombreCompleto === prodUp ||
                 (apPat && prodUp.startsWith(apPat)) ||
                 prodUp.includes(apPat) ||
                 nombreCompleto.includes(prodUp.split(" ")[0]);
        });

        nuevas.push({
          id: Date.now()+i, numSolicitud: numSol, numOrden, fecha,
          productorId: prodMatch?.id || null,
          productorNombreOriginal: productor,
          lineaCredito: linea, monto, notas:"",
        });
        agregados++;
      });

      if (nuevas.length === 0) {
        logs.push("❌ No se encontraron registros válidos.");
        logs.push("💡 Verifica que la columna de solicitud se llame: # SOLICITU, SOLICITUD o similar");
        setImportLog(logs);
        setImportando(false);
        return;
      }
      dispatch({ type:"IMPORT_DISPERSIONES", payload: nuevas });
      const sinMatch = nuevas.filter(n=>!n.productorId).length;
      logs.push(`✅ ${agregados} dispersiones importadas correctamente`);
      if (sinMatch>0) logs.push(`⚠️ ${sinMatch} sin productor identificado — asigna manualmente en la tabla`);
      if (nuevas.length-sinMatch > 0) logs.push(`👥 ${nuevas.length-sinMatch} productores identificados automáticamente`);
      setImportLog(logs);
    } catch(err) {
      setImportLog([`❌ Error al procesar el archivo: ${err.message}`]);
    }
    setImportando(false);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // VISTA: RESUMEN GLOBAL
  // ─────────────────────────────────────────────────────────────────────────────
  if (vista==="resumen") return (
    <div>
      {/* Stat cards principales */}
      {/* Totales para stat cards */}
      {(()=>{
        const haTot = (asigsCiclo||[]).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);
        const tSem  = insumos.filter(i=>!i.cancelado&&i.categoria==="Semilla").reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
        const tIns  = insumos.filter(i=>!i.cancelado&&i.categoria!=="Semilla").reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
        const tDie  = diesel.filter(d=>!d.cancelado).reduce((s,d)=>s+(parseFloat(d.importe)||0),0);
        const tEfe  = egresosMan.filter(g=>!g.cancelado).reduce((s,g)=>s+(parseFloat(g.monto)||0),0);
        const tTot  = tSem + tIns + tDie + tEfe;
        return null;
      })()}
      {/* Banner costo financiero */}
      {(()=>{
        const _F = calcularFinancieros(state);
        const costoFin = _F.costoFinanciero || 0;
        const totalCompleto = totalGastos + costoFin;
        if (costoFin <= 0) return null;
        return (
          <div style={{marginBottom:12,padding:"10px 16px",background:"#fff8f0",border:"1px solid #f0a04b",borderRadius:10}}>
            <div style={{fontSize:12,color:"#7a4a10",marginBottom:8}}>
              ℹ️ <strong>Nota:</strong> El "Total Gastado" muestra solo egresos operativos (insumos, diesel, efectivo).
              El costo financiero (intereses + comisiones) se gestiona en <strong>Crédito Habilitación</strong>.
            </div>
            <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:10,color:"#7a4a10",fontWeight:600}}>Egresos operativos</div>
                <div style={{fontFamily:"monospace",fontSize:13,fontWeight:700,color:"#c0392b"}}>{mxnFmt(totalGastos)}</div>
              </div>
              <div style={{fontSize:13,color:"#7a4a10",fontWeight:700}}>+</div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:10,color:"#7a4a10",fontWeight:600}}>Intereses</div>
                <div style={{fontFamily:"monospace",fontSize:13,fontWeight:700,color:"#9b6d3a"}}>{mxnFmt(_F.costoInteres||0)}</div>
              </div>
              <div style={{fontSize:13,color:"#7a4a10",fontWeight:700}}>+</div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:10,color:"#7a4a10",fontWeight:600}}>Comisiones (fact+FEGA+AT)</div>
                <div style={{fontFamily:"monospace",fontSize:13,fontWeight:700,color:"#9b6d3a"}}>{mxnFmt(_F.costoComisiones||0)}</div>
              </div>
              <div style={{fontSize:13,color:"#7a4a10",fontWeight:700}}>=</div>
              <div style={{textAlign:"right",padding:"4px 10px",background:"#c0392b11",borderRadius:6,border:"1px solid #c0392b33"}}>
                <div style={{fontSize:10,color:"#7a4a10",fontWeight:600}}>Costo Total Ciclo</div>
                <div style={{fontFamily:"monospace",fontSize:14,fontWeight:800,color:"#c0392b"}}>{mxnFmt(totalCompleto)}</div>
              </div>
            </div>
          </div>
        );
      })()}
      <div className="stat-grid" style={{gridTemplateColumns:"repeat(4,1fr)",marginBottom:20}}>
        <div className="stat-card rust" style={{cursor:"pointer"}} onClick={()=>setVista("gastos")} title="Ver todos los gastos">
          <div className="stat-icon">💸</div>
          <div className="stat-label">Total Gastado del Ciclo</div>
          <div className="stat-value" style={{fontSize:16}}>{mxnFmt(totalGastos)}</div>
          <div className="stat-sub">Insumos + Diesel + Efectivo <span style={{fontSize:9,opacity:0.6}}>→</span></div>
        </div>
        <div className="stat-card gold" style={{cursor:"pointer"}} onClick={()=>nav("insumos", null, {categoria:"Semilla", vista:"tabla"})} title="Ver insumos y semilla">
          <div className="stat-icon">🌽</div>
          <div className="stat-label">Semilla + Insumos</div>
          <div className="stat-value" style={{fontSize:16}}>{mxnFmt(totalInsumos)}</div>
          <div className="stat-sub">Semilla: {mxnFmt(totalSemilla)} <span style={{fontSize:9,opacity:0.6}}>→ Insumos</span></div>
        </div>
        <div className="stat-card sky" style={{cursor:"pointer"}} onClick={()=>nav("diesel")} title="Ver diesel">
          <div className="stat-icon">⛽</div>
          <div className="stat-label">Diesel y Combustible</div>
          <div className="stat-value" style={{fontSize:16}}>{mxnFmt(totalDiesel)}</div>
          <div className="stat-sub">{diesel.filter(d=>!d.cancelado&&!d.esAjuste).length} cargas <span style={{fontSize:9,opacity:0.6}}>→ Diesel</span></div>
        </div>
        <div className="stat-card green" style={{cursor:"pointer"}} onClick={()=>nav("costos")} title="Ver costos y equilibrio">
          <div className="stat-icon">📊</div>
          <div className="stat-label">Gasto / Ha</div>
          <div className="stat-value" style={{fontSize:16}}>{mxnFmt((asigsCiclo||[]).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0)>0?totalGastos/(asigsCiclo||[]).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0):0)}</div>
          <div className="stat-sub">Ciclo {state.cicloActual||"activo"} <span style={{fontSize:9,opacity:0.6}}>→ Costos</span></div>
        </div>
      </div>

      {/* Accesos rápidos */}
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <button className="btn btn-primary" onClick={()=>setVista("nuevo_gasto")}>＋ Registrar Gasto</button>
        <button className="btn btn-secondary" onClick={()=>setVista("import_egresos")}>📥 Importar Excel</button>
        <button className="btn btn-secondary" onClick={()=>setVista("nueva_disp")}>＋ Nueva Dispersión</button>
        <button className="btn btn-secondary" onClick={()=>setVista("dispersiones")}>🏦 Ver Dispersiones ({dispersiones.length})</button>
        <button className="btn btn-secondary" onClick={()=>setVista("gastos")}>💸 Ver Gastos ({egresosMan.length})</button>
        <button className="btn btn-secondary" onClick={()=>setVista("import_egresos")}>📥 Importar Excel Egresos</button>
      </div>

      {/* Desglose por categoría */}
      <div className="card" style={{marginBottom:16}}>
        <div className="card-header">
          <div className="card-title">Desglose por Categoría</div>
          <span style={{fontFamily:"monospace",fontSize:11,color:T.fog}}>{mxnFmt(totalOpTotal)}</span>
        </div>
        <div className="card-body">
          {/* Operativos */}
          <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",
            color:"#8a8070",marginBottom:8}}>Costos Operativos</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10,marginBottom:16}}>
            {Object.entries(resumenCat)
              .filter(([k,v])=>v>0&&!["int_para","int_dir","comisiones_para","comisiones_dir"].includes(k))
              .map(([cat,v])=>{
                const color = CAT_COLORS[cat]||"#7f8c8d";
                // Map cat to nav destination
                const catNav = {semilla_auto:"insumos",insumos_auto:"insumos",diesel_auto:"diesel"};
                const catFiltro = {semilla_auto:{categoria:"Semilla",vista:"tabla"},insumos_auto:{categoria:"Fertilizante",vista:"tabla"},diesel_auto:null};
                const destMod = catNav[cat] || null;
                return (
                  <div key={cat}
                    style={{padding:"10px 14px",borderRadius:8,border:`1px solid ${color}33`,background:`${color}0d`,
                      cursor:destMod?"pointer":"default",transition:"filter 0.15s"}}
                    onClick={destMod ? ()=>nav(destMod, null, catFiltro[cat]||{}) : undefined}
                    onMouseEnter={destMod ? e=>{e.currentTarget.style.filter="brightness(0.92)";} : undefined}
                    onMouseLeave={destMod ? e=>{e.currentTarget.style.filter="";} : undefined}
                    title={destMod ? `→ Ver en ${destMod}` : ""}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                      <span style={{fontSize:11,fontWeight:600,color}}>{CAT_ICONS[cat]||"📌"} {CAT_LABELS_EXT[cat]||cat} {destMod&&<span style={{fontSize:9,opacity:0.6}}>→</span>}</span>
                      <span style={{fontFamily:"monospace",fontSize:12,fontWeight:700,color:"#c0392b"}}>{mxnFmt(v)}</span>
                    </div>
                    <div style={{height:4,borderRadius:2,background:"#e8e0d0",overflow:"hidden"}}>
                      <div style={{height:"100%",borderRadius:2,background:color,width:`${totalOpTotal>0?Math.min(100,v/totalOpTotal*100):0}%`}}/>
                    </div>
                    <div style={{fontSize:10,color:"#8a8070",marginTop:2}}>{totalOpTotal>0?Math.round(v/totalOpTotal*100):0}% del total</div>
                  </div>
                );
              })}
          </div>
          {/* Financieros */}
          {(F2.costoFinanciero||0)>0 && (
            <>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",
                color:"#c0392b",marginBottom:8,paddingTop:8,borderTop:"1px solid #ddd5c0"}}>
                Costos Financieros
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
                {Object.entries(resumenCat)
                  .filter(([k,v])=>v>0&&["int_para","int_dir","comisiones_para","comisiones_dir"].includes(k))
                  .map(([cat,v])=>{
                    const color = CAT_COLORS[cat]||"#c0392b";
                    return (
                      <div key={cat}
                        style={{padding:"10px 14px",borderRadius:8,border:`1px solid ${color}33`,background:`${color}0d`,
                          cursor:"pointer",transition:"filter 0.15s"}}
                        onClick={()=>nav("credito")}
                        onMouseEnter={e=>{e.currentTarget.style.filter="brightness(0.92)";}}
                        onMouseLeave={e=>{e.currentTarget.style.filter="";}}
                        title="→ Ver en Crédito Habilitación">
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                          <span style={{fontSize:11,fontWeight:600,color}}>{CAT_ICONS[cat]||"💰"} {CAT_LABELS_EXT[cat]||cat} <span style={{fontSize:9,opacity:0.6}}>→</span></span>
                          <span style={{fontFamily:"monospace",fontSize:12,fontWeight:700,color:"#c0392b"}}>{mxnFmt(v)}</span>
                        </div>
                        <div style={{height:4,borderRadius:2,background:"#e8e0d0",overflow:"hidden"}}>
                          <div style={{height:"100%",borderRadius:2,background:color,width:`${totalOpTotal>0?Math.min(100,v/totalOpTotal*100):0}%`}}/>
                        </div>
                        <div style={{fontSize:10,color:"#8a8070",marginTop:2}}>{totalOpTotal>0?Math.round(v/totalOpTotal*100):0}% del total</div>
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Resumen por productor */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Estado por Productor — {state.cicloActual}</div>
        </div>
        <div className="table-wrap-scroll">
          <table style={{minWidth:700}}>
            <thead><tr>
              <th>Productor</th>
              <th style={{textAlign:"right"}}>Ha</th>
              <th style={{textAlign:"right"}}>🌽 Semilla</th>
              <th style={{textAlign:"right"}}>🌿 Insumos</th>
              <th style={{textAlign:"right"}}>⛽ Diesel</th>
              <th style={{textAlign:"right"}}>💵 Efectivo</th>
              <th style={{textAlign:"right",fontWeight:700,color:"#c0392b"}}>Total Gastado</th>
              <th></th>
            </tr></thead>
            <tbody>
              {productores.map((p,i)=>{
                const ha   = hasProd(p.id);
                const dPar = dispersiones.filter(d=>String(d.productorId)===String(p.id)&&d.lineaCredito==="parafinanciero").reduce((s,d)=>s+(parseFloat(d.monto)||0),0);
                const dDir = dispersiones.filter(d=>String(d.productorId)===String(p.id)&&d.lineaCredito==="directo").reduce((s,d)=>s+(parseFloat(d.monto)||0),0);
                const disp  = dPar + dDir;
                const gsem  = semillaProd(p.id);
                const gins  = insumoProd(p.id) - gsem;
                const gdie  = dieselProd(p.id);
                const gefe  = efectivoProd(p.id);
                const gas   = gsem + gins + gdie + gefe;
                const dif   = disp - gas;
                if (ha===0 && disp===0 && gas===0) return null;
                const bg = i%2===0?"white":"#faf8f3";
                return (
                  <tr key={p.id} style={{cursor:"pointer",transition:"filter 0.12s"}}
                    onMouseEnter={e=>e.currentTarget.style.filter="brightness(0.92)"}
                    onMouseLeave={e=>e.currentTarget.style.filter=""}
                    onClick={()=>{nav("gastos",p.id);setProdDetalle(p.id);setVista("detalle_prod");}}>
                    <td style={{background:bg}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:p.color}}/>
                        <span style={{fontWeight:600,fontSize:13}}>{p.alias||p.apPat}</span>
                      </div>
                    </td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12}}>{ha>0?fmt2(ha)+" ha":"—"}</td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:11,color:"#c8a84b"}}>{gsem>0?mxnFmt(gsem):"—"}</td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:11,color:"#2d5a1b"}}>{gins>0?mxnFmt(gins):"—"}</td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:11,color:"#e67e22"}}>{gdie>0?mxnFmt(gdie):"—"}</td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:11,color:"#8e44ad"}}>{gefe>0?mxnFmt(gefe):"—"}</td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12,fontWeight:700,color:"#c0392b"}}>{gas>0?mxnFmt(gas):"—"}</td>
                    <td style={{background:bg}}>
                      <button className="btn btn-sm btn-secondary" onClick={e=>{e.stopPropagation();setProdDetalle(p.id);setVista("detalle_prod");}}>Ver detalle</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // VISTA: DISPERSIONES
  // ─────────────────────────────────────────────────────────────────────────────
  if (vista==="dispersiones") return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <button className="btn btn-secondary" onClick={()=>setVista("resumen")}>← Volver</button>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,flex:1}}>Dispersiones de Crédito</div>
        <BtnExport onClick={()=>exportarExcel("Dispersiones_"+state.cicloActual,[{
          nombre:"Dispersiones",
          headers:["# Sol","# Orden","Fecha","Productor","Línea","Monto","Notas"],
          rows:dispersiones.filter(d=>filtroProd==="todos"||String(d.productorId)===filtroProd)
            .filter(d=>filtroLinea==="todas"||d.lineaCredito===filtroLinea)
            .map(d=>[d.numSolicitud,d.numOrden,d.fecha,
              (state.productores||[]).find(p=>String(p.id)===String(d.productorId))?.alias||"",
              d.lineaCredito,parseFloat(d.monto)||0,d.notas||""])
        }])}/>
        <button className="btn btn-secondary" onClick={()=>setVista("import_disp")}>📥 Importar Excel</button>
        <button className="btn btn-primary" onClick={()=>setVista("nueva_disp")}>＋ Nueva Dispersión</button>
      </div>
      {/* Filtros */}
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <select className="form-select" style={{width:180}} value={filtroLinea} onChange={e=>setFiltroLinea(e.target.value)}>
          <option value="todas">Todas las líneas</option>
          <option value="parafinanciero">Crédito Parafinanciero</option>
          <option value="directo">Crédito Directo</option>
        </select>
        <select className="form-select" style={{width:180}} value={filtroProd} onChange={e=>setFiltroProd(e.target.value)}>
          <option value="todos">Todos los productores</option>
          {productores.map(p=><option key={p.id} value={p.id}>{p.alias||p.apPat}</option>)}
        </select>
      </div>
      <div className="card">
        <div className="table-wrap-scroll">
          <table style={{minWidth:700}}>
            <thead><tr>
              <th># Solicitud</th><th># Orden</th><th>Fecha</th><th>Productor</th>
              <th>Línea</th><th style={{textAlign:"right"}}>Monto</th>
              <th style={{textAlign:"right"}}>Aplicado</th><th style={{textAlign:"right"}}>Diferencia</th>
              <th></th>
            </tr></thead>
            <tbody>
              {dispersiones
                .filter(d=>filtroLinea==="todas"||d.lineaCredito===filtroLinea)
                .filter(d=>filtroProd==="todos"||String(d.productorId)===String(filtroProd))
                .sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||""))
                .map((d,i)=>{
                  const aplicado = egresosMan.filter(g=>(g.solicitudes||[]).some(s=>s.numSolicitud===d.numSolicitud)).reduce((s,g)=>s+(parseFloat(g.monto)||0),0);
                  const dif = (parseFloat(d.monto)||0) - aplicado;
                  const bg = i%2===0?"white":"#faf8f3";
                  return (
                    <tr key={d.id}>
                      <td style={{background:bg,fontFamily:"monospace",fontWeight:700}}>{d.numSolicitud}</td>
                      <td style={{background:bg,fontFamily:"monospace"}}>{d.numOrden||"—"}</td>
                      <td style={{background:bg,fontSize:12}}>{d.fecha}</td>
                      <td style={{background:bg,fontWeight:600,fontSize:13}}>{nomProd(d.productorId)}{d.productorNombreOriginal&&!d.productorId?<span style={{fontSize:10,color:"#c0392b"}}> ⚠️{d.productorNombreOriginal}</span>:""}</td>
                      <td style={{background:bg}}><span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:10,background:d.lineaCredito==="parafinanciero"?"#dbeafe":"#ede9fe",color:d.lineaCredito==="parafinanciero"?"#1a6ea8":"#8e44ad"}}>{d.lineaCredito==="parafinanciero"?"Parafinanciero":"Directo"}</span></td>
                      <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:700}}>{mxnFmt(d.monto)}</td>
                      <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12}}>{aplicado>0?mxnFmt(aplicado):"—"}</td>
                      <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12,fontWeight:700,color:dif>=0?"#2d5a1b":"#c0392b"}}>{mxnFmt(Math.abs(dif))}{dif<0?" ⚠️":dif===0?" ✅":""}</td>
                      <td style={{background:bg}}>{d.cancelado&&<BadgeCancelado registro={d}/>}{d.cancelado?(puedeEditar&&<button className="btn btn-sm btn-secondary" style={{fontSize:11}} onClick={()=>setCancelModal({action:"reactivar",tabla:"dispersiones",rec:d})}>↺</button>):(puedeEditar&&<button className="btn btn-sm" style={{fontSize:11,background:"#fff3cd",color:"#856404",border:"1px solid #ffc107"}} onClick={()=>setCancelModal({action:"cancelar",tabla:"dispersiones",rec:d})}>🚫</button>)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {cancelModal && (
        cancelModal.action === "cancelar"
        ? <ModalCancelacion
            titulo={cancelModal.rec?.insumo || cancelModal.rec?.numSolicitud || cancelModal.rec?.concepto || cancelModal.rec?.nombre || "registro"}
            onCerrar={()=>setCancelModal(null)}
            onConfirmar={({motivo,comentario})=>{
              dispatch({type:"CANCELAR_REGISTRO",payload:{
                tabla:cancelModal.tabla, id:cancelModal.rec.id,
                motivo, comentario, canceladoPor:"admin",
                fecha: new Date().toISOString().split("T")[0]
              }});
              setCancelModal(null);
            }}/>
        : <ModalReactivacion
            titulo={cancelModal.rec?.insumo || cancelModal.rec?.numSolicitud || cancelModal.rec?.concepto || cancelModal.rec?.nombre || "registro"}
            onCerrar={()=>setCancelModal(null)}
            onConfirmar={({motivo,comentario})=>{
              dispatch({type:"REACTIVAR_REGISTRO",payload:{
                tabla:cancelModal.tabla, id:cancelModal.rec.id,
                motivo, comentario, reactivadoPor:"admin",
                fecha: new Date().toISOString().split("T")[0]
              }});
              setCancelModal(null);
            }}/>
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // VISTA: GASTOS MANUALES
  // ─────────────────────────────────────────────────────────────────────────────
  if (vista==="gastos") return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <button className="btn btn-secondary" onClick={()=>setVista("resumen")}>← Volver</button>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,flex:1}}>Gastos Registrados <span style={{fontSize:12,color:"#8a8070",fontWeight:400}}>({egresosMan.length} registros)</span></div>
        <BtnExport onClick={()=>exportarExcel("Egresos_"+state.cicloActual,[{
          nombre:"Egresos",
          headers:["Fecha","Categoría","Concepto","Productor","Monto","Línea Crédito"],
          rows:egresosMan.filter(e=>!e.cancelado)
            .filter(e=>filtroCat==="todas"||e.categoria===filtroCat)
            .filter(e=>filtroProd==="todos"||String(e.productorId)===filtroProd)
            .map(e=>[e.fecha,e.categoria,e.concepto,
              (state.productores||[]).find(p=>String(p.id)===String(e.productorId))?.alias||"General",
              parseFloat(e.monto)||0,e.lineaCredito||""])
        }])}/>
        <button className="btn btn-primary" onClick={()=>setVista("nuevo_gasto")}>＋ Registrar Gasto</button>
      </div>
      {/* ── Filtros avanzados + totales ─────────────────────────────────────── */}
      {(()=>{
        const egFiltrados = egresosMan
          .filter(g=>!g.cancelado||filtroCancelados==="todos")
          .filter(g=>filtroCat==="todas"||g.categoria===filtroCat)
          .filter(g=>filtroProd==="todos"||String(g.productorId)===String(filtroProd))
          .filter(g=>filtroLinea==="todas"||g.lineaCredito===filtroLinea)
          .filter(g=>!filtroTipoTrab||(g.tipoTrabajador||"").toLowerCase().includes(filtroTipoTrab.toLowerCase()))
          .filter(g=>!filtroConcepto||(g.concepto||"").toLowerCase().includes(filtroConcepto.toLowerCase())||(g.detalleMO||"").toLowerCase().includes(filtroConcepto.toLowerCase()))
          .filter(g=>!filtroSemana||String(g.semanaNum)===filtroSemana);
        const totalFiltrado = egFiltrados.reduce((s,g)=>s+(parseFloat(g.monto)||0),0);
        const activeFilters = [
          filtroCat!=="todas",filtroProd!=="todos",filtroLinea!=="todas",
          !!filtroTipoTrab,!!filtroConcepto,!!filtroSemana
        ].filter(Boolean).length;
        const semanas = [...new Set(egresosMan.filter(g=>g.semanaNum).map(g=>String(g.semanaNum)))].sort((a,b)=>+a-+b);
        const tiposTrab = [...new Set(egresosMan.filter(g=>g.tipoTrabajador).map(g=>g.tipoTrabajador))].sort();
        return (
          <div style={{marginBottom:12}}>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
              <select className="form-select" style={{width:190}} value={filtroCat} onChange={e=>setFiltroCat(e.target.value)}>
                <option value="todas">Todas las categorías</option>
                {Object.entries(CAT_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
              <select className="form-select" style={{width:170}} value={filtroProd} onChange={e=>setFiltroProd(e.target.value)}>
                <option value="todos">Todos los productores</option>
                {productores.map(p=><option key={p.id} value={p.id}>{p.alias||p.apPat}</option>)}
              </select>
              <select className="form-select" style={{width:150}} value={filtroLinea} onChange={e=>setFiltroLinea(e.target.value)}>
                <option value="todas">Ambas líneas</option>
                <option value="parafinanciero">Parafinanciero</option>
                <option value="directo">Directo</option>
              </select>
              {tiposTrab.length>0&&(
                <select className="form-select" style={{width:180}} value={filtroTipoTrab} onChange={e=>setFiltroTipoTrab(e.target.value)}>
                  <option value="">Todos los tipos MO</option>
                  {tiposTrab.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              )}
              {semanas.length>0&&(
                <select className="form-select" style={{width:120}} value={filtroSemana} onChange={e=>setFiltroSemana(e.target.value)}>
                  <option value="">Todas las semanas</option>
                  {semanas.map(s=><option key={s} value={s}>Semana {s}</option>)}
                </select>
              )}
              <input className="form-input" style={{width:180,fontSize:12}} placeholder="🔍 Concepto / Detalle MO..."
                value={filtroConcepto} onChange={e=>setFiltroConcepto(e.target.value)}/>
              {activeFilters>0&&(
                <button className="btn btn-secondary" style={{fontSize:11,padding:"4px 10px",color:"#c0392b",borderColor:"#c0392b"}}
                  onClick={()=>{setFiltroCat("todas");setFiltroProd("todos");setFiltroLinea("todas");setFiltroTipoTrab("");setFiltroConcepto("");setFiltroSemana("");}}>
                  ✕ Limpiar filtros
                </button>
              )}
            </div>
            {/* Barra de totales */}
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"8px 14px",background:activeFilters>0?"#fff8f0":"#f5f4f0",borderRadius:8,border:`1px solid ${activeFilters>0?"#f0a04b":"#ddd5c0"}`}}>
              <span style={{fontSize:11,color:"#8a8070"}}>{activeFilters>0?"Filtrado:":"Total:"}</span>
              <span style={{fontFamily:"monospace",fontSize:15,fontWeight:800,color:activeFilters>0?"#e67e22":"#c0392b"}}>
                {totalFiltrado.toLocaleString("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:2})}
              </span>
              <span style={{fontSize:11,color:"#8a8070"}}>{egFiltrados.length} registros</span>
              {activeFilters>0&&(
                <span style={{fontSize:10,color:"#c8a84b",marginLeft:4}}>
                  {activeFilters} filtro{activeFilters>1?"s":""} activo{activeFilters>1?"s":""}
                </span>
              )}
              <div style={{flex:1}}/>
              {activeFilters>0&&(
                <span style={{fontSize:11,color:"#8a8070"}}>
                  {"Total general: "+egresosMan.filter(g=>!g.cancelado).reduce((s,g)=>s+(parseFloat(g.monto)||0),0).toLocaleString("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:0})}
                </span>
              )}
            </div>
          </div>
        );
      })()}
      <div className="card">
        <div className="table-wrap-scroll">
          <table style={{minWidth:800}}>
            <thead><tr>
              <th>Fecha</th><th># Orden</th><th>Categoría</th>
              <th>Concepto / Detalle</th>
              <th>Semana</th>
              <th>Tipo Trabajador</th>
              <th>Detalle MO</th>
              <th>Productor</th>
              <th style={{textAlign:"right"}}>Monto</th>
              <th># Solicitud</th><th></th>
            </tr></thead>
            <tbody>
              {egresosMan
                .filter(g=>!g.cancelado||filtroCancelados==="todos")
                .filter(g=>filtroCat==="todas"||g.categoria===filtroCat)
                .filter(g=>filtroProd==="todos"||String(g.productorId)===String(filtroProd))
                .filter(g=>filtroLinea==="todas"||g.lineaCredito===filtroLinea)
                .filter(g=>!filtroTipoTrab||(g.tipoTrabajador||"").toLowerCase().includes(filtroTipoTrab.toLowerCase()))
                .filter(g=>!filtroConcepto||(g.concepto||"").toLowerCase().includes(filtroConcepto.toLowerCase())||(g.detalleMO||"").toLowerCase().includes(filtroConcepto.toLowerCase()))
                .filter(g=>!filtroSemana||String(g.semanaNum)===filtroSemana)
                .sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||""))
                .map((g,i)=>{
                  const bg=i%2===0?"white":"#faf8f3";
                  const isDomingo = g.categoria==="mano_obra" && !!g.domingoFecha;
                  const label = g.categoria==="mano_obra"
                    ? [g.semanaNum?"Sem."+g.semanaNum:"", g.semanaFechaInicio||g.domingoFecha||"", g.tipoTrabajador||""].filter(Boolean).join(" · ")
                    : (g.subcategoria||g.concepto||"");
                  const numSolG = (g.solicitudes||[])[0]?.numSolicitud||"";
                  const numOrdG = (g.solicitudes||[])[0]?.numOrden||"";
                  const dispLigada = (state.dispersiones||[]).filter(d=>(d.cicloId||1)===(state.cicloActivoId||1)).find(d=>d.numSolicitud===numSolG||d.numSolicitud===String(numSolG));
                  const fechaG = dispLigada?.fecha||dispLigada?.fechaSolicitud||g.fecha||"—";
                  return (
                    <tr key={g.id}>
                      <td style={{background:bg,fontSize:11,fontFamily:"monospace",whiteSpace:"nowrap"}}>{fechaG}</td>
                      <td style={{background:bg,fontSize:11,fontFamily:"monospace",color:"#5a7a3a"}}>{numOrdG||"—"}</td>
                      <td style={{background:bg}}><span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:10,background:"#f0f4e8",color:"#2d5a1b"}}>{CAT_ICONS[g.categoria]||"📌"} {CAT_LABELS[g.categoria]||g.categoria}</span></td>
                      <td style={{background:bg,fontSize:12,maxWidth:200}}>
                        <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
                          <span>{label}</span>
                          {isDomingo && (
                            <span style={{fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:6,background:"#fff3cd",color:"#c8810a",border:"1px solid #ffc107"}}>
                              {"🟡 DOM " + g.domingoFecha}
                            </span>
                          )}
                        </div>
                      </td>
                      {/* Semana */}
                      <td style={{background:bg,fontSize:11,fontFamily:"monospace",whiteSpace:"nowrap",color:"#3d3525"}}>
                        {g.esManoObra && g.semanaNum ? (
                          <div>
                            <div style={{fontWeight:700}}>{"Sem." + g.semanaNum}</div>
                            {g.semanaFechaInicio && (
                              <div style={{fontSize:10,color:"#8a8070"}}>{g.semanaFechaInicio}</div>
                            )}
                            {g.semanaFechaFin && (
                              <div style={{fontSize:10,color:"#8a8070"}}>{"al " + g.semanaFechaFin}</div>
                            )}
                            {g.domingoFecha && (
                              <div style={{fontSize:10,color:"#e67e22",fontWeight:600}}>{"Dom: " + g.domingoFecha}</div>
                            )}
                          </div>
                        ) : <span style={{color:"#ccc"}}>{"—"}</span>}
                      </td>
                      {/* Tipo Trabajador */}
                      <td style={{background:bg,fontSize:11}}>
                        {g.tipoTrabajador ? (
                          <span style={{display:"inline-block",padding:"2px 8px",borderRadius:10,fontSize:10,fontWeight:600,background:"#e8f4e8",color:"#2d5a1b",border:"1px solid #c8e0b0"}}>
                            {g.tipoTrabajador}
                          </span>
                        ) : <span style={{color:"#ccc"}}>{"—"}</span>}
                      </td>
                      {/* Detalle MO */}
                      <td style={{background:bg,fontSize:11,color:"#5a6a5a",maxWidth:180}}>
                        {g.detalleMO ? (
                          <span style={{fontStyle:"italic"}}>{g.detalleMO}</span>
                        ) : <span style={{color:"#ccc"}}>{"—"}</span>}
                      </td>
                      <td style={{background:bg,fontSize:12,fontWeight:600}}>{nomProd(g.productorId)}</td>
                      <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:700,color:"#c0392b"}}>{mxnFmt(g.monto)}</td>
                      <td style={{background:bg,fontSize:11,fontFamily:"monospace",color:"#5a7a3a"}}>{numSolG||"—"}</td>
                      <td style={{background:bg}}>{g.cancelado&&<BadgeCancelado registro={g}/>}{g.cancelado?(puedeEditar&&<button className="btn btn-sm btn-secondary" style={{fontSize:11}} onClick={()=>setCancelModal({action:"reactivar",tabla:"egresosManual",rec:g})}>↺</button>):(puedeEditar&&<button className="btn btn-sm" style={{fontSize:11,background:"#fff3cd",color:"#856404",border:"1px solid #ffc107"}} onClick={()=>setCancelModal({action:"cancelar",tabla:"egresosManual",rec:g})}>🚫</button>)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {cancelModal && (
        cancelModal.action === "cancelar"
        ? <ModalCancelacion
            titulo={cancelModal.rec?.insumo || cancelModal.rec?.numSolicitud || cancelModal.rec?.concepto || cancelModal.rec?.nombre || "registro"}
            onCerrar={()=>setCancelModal(null)}
            onConfirmar={({motivo,comentario})=>{
              dispatch({type:"CANCELAR_REGISTRO",payload:{
                tabla:cancelModal.tabla, id:cancelModal.rec.id,
                motivo, comentario, canceladoPor:"admin",
                fecha: new Date().toISOString().split("T")[0]
              }});
              setCancelModal(null);
            }}/>
        : <ModalReactivacion
            titulo={cancelModal.rec?.insumo || cancelModal.rec?.numSolicitud || cancelModal.rec?.concepto || cancelModal.rec?.nombre || "registro"}
            onCerrar={()=>setCancelModal(null)}
            onConfirmar={({motivo,comentario})=>{
              dispatch({type:"REACTIVAR_REGISTRO",payload:{
                tabla:cancelModal.tabla, id:cancelModal.rec.id,
                motivo, comentario, reactivadoPor:"admin",
                fecha: new Date().toISOString().split("T")[0]
              }});
              setCancelModal(null);
            }}/>
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // VISTA: NUEVA DISPERSIÓN
  // ─────────────────────────────────────────────────────────────────────────────
  if (vista==="nueva_disp") return (
    <div style={{maxWidth:600}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
        <button className="btn btn-secondary" onClick={()=>setVista("dispersiones")}>← Volver</button>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700}}>Nueva Dispersión de Crédito</div>
      </div>
      <div className="card">
        <div className="card-body" style={{display:"flex",flexDirection:"column",gap:14}}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label"># Solicitud *</label>
              <input className="form-input" value={formDisp.numSolicitud} onChange={e=>setFormDisp(f=>({...f,numSolicitud:e.target.value}))} placeholder="Ej. 6917"/>
            </div>
            <div className="form-group">
              <label className="form-label"># Orden</label>
              <input className="form-input" value={formDisp.numOrden} onChange={e=>setFormDisp(f=>({...f,numOrden:e.target.value}))} placeholder="Ej. 417"/>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Fecha *</label>
              <input className="form-input" type="date" value={formDisp.fecha} onChange={e=>setFormDisp(f=>({...f,fecha:e.target.value}))}/>
            </div>
            <div className="form-group">
              <label className="form-label">Línea de Crédito *</label>
              <select className="form-select" value={formDisp.lineaCredito} onChange={e=>setFormDisp(f=>({...f,lineaCredito:e.target.value}))}>
                <option value="parafinanciero">Crédito Parafinanciero</option>
                <option value="directo">Crédito Directo</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Productor *</label>
            <select className="form-select" value={formDisp.productorId} onChange={e=>setFormDisp(f=>({...f,productorId:e.target.value}))}>
              <option value="">— Seleccionar —</option>
              {productores.map(p=><option key={p.id} value={p.id}>{p.alias||p.apPat} — {p.rfc}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Monto Dispersado ($MXN) *</label>
              <input className="form-input" type="number" value={formDisp.monto} onChange={e=>setFormDisp(f=>({...f,monto:e.target.value}))} placeholder="0.00"/>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notas</label>
            <input className="form-input" value={formDisp.notas} onChange={e=>setFormDisp(f=>({...f,notas:e.target.value}))} placeholder="Observaciones opcionales"/>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button className="btn btn-secondary" onClick={()=>setVista("dispersiones")}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardarDisp}>💾 Guardar Dispersión</button>
          </div>
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // VISTA: IMPORTAR EXCEL
  // ─────────────────────────────────────────────────────────────────────────────
  if (vista==="import_disp") return (
    <div style={{maxWidth:680}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
        <button className="btn btn-secondary" onClick={()=>setVista("dispersiones")}>← Volver</button>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700}}>Importar Excel Parafinanciera</div>
      </div>
      {/* Instrucciones estructura */}
      <div className="card" style={{marginBottom:16,borderLeft:"4px solid #1a6ea8"}}>
        <div className="card-body">
          <div style={{fontWeight:700,fontSize:13,marginBottom:10,color:"#1a6ea8"}}>📋 Estructura requerida del archivo Excel</div>
          <div style={{fontSize:12,color:"#3d3525",lineHeight:1.8}}>
            El archivo debe tener exactamente estas columnas en la primera fila:<br/>
            <div style={{marginTop:8,padding:"8px 12px",background:"#f0f4e8",borderRadius:6,fontFamily:"monospace",fontSize:11}}>
              # SOLICITU &nbsp;|&nbsp; # ORDEN &nbsp;|&nbsp; FECHA SOLICITU &nbsp;|&nbsp; GRUPO &nbsp;|&nbsp; CODIGO CTE &nbsp;|&nbsp; PRODUCTOR &nbsp;|&nbsp; CULTIVO &nbsp;|&nbsp; EMPRESA &nbsp;|&nbsp; CATEGORIA &nbsp;|&nbsp; IMPORTE
            </div>
            <ul style={{marginTop:10,paddingLeft:20,fontSize:11,color:"#5a6a5a"}}>
              <li><strong>IMPORTE</strong> — monto dispersado (si no existe la columna, quedará en $0 para edición manual)</li>
              <li>El campo <strong>PRODUCTOR</strong> se cruza automáticamente con el padrón del sistema</li>
              <li>Los que no coincidan quedarán marcados en rojo para asignación manual</li>
              <li>Todos los importados se registran como <strong>Crédito Parafinanciero</strong></li>
              <li>Formatos de fecha aceptados: DD/MM/AAAA o AAAA-MM-DD</li>
              <li>Solo la primera hoja del archivo se procesa</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-body" style={{textAlign:"center",padding:32}}>
          <div style={{fontSize:40,marginBottom:12}}>📥</div>
          <div style={{fontWeight:600,marginBottom:8}}>Selecciona el archivo .xlsx de la parafinanciera</div>
          <div style={{fontSize:12,color:"#8a8070",marginBottom:20}}>Formato: .xlsx o .xls</div>
          <input type="file" accept=".xlsx,.xls" ref={fileInputRef} style={{display:"none"}} onChange={importarExcel}/>
          <button className="btn btn-primary" onClick={()=>fileInputRef.current?.click()} disabled={importando}>
            {importando?"⏳ Procesando...":"📂 Seleccionar archivo"}
          </button>
          {importLog.length>0&&(
            <div style={{marginTop:16,textAlign:"left",padding:"12px 16px",background:"#f5f4f0",borderRadius:8}}>
              {importLog.map((l,i)=><div key={i} style={{fontSize:12,marginBottom:4,color:l.startsWith("❌")?"#c0392b":l.startsWith("⚠️")?"#e67e22":"#2d5a1b"}}>{l}</div>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );

// ── VISTA: IMPORTAR EGRESOS EXCEL ─────────────────────────────────────────────
  if (vista==="import_egresos") return (
    <div style={{maxWidth:700}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
        <button className="btn btn-secondary" onClick={()=>setVista("gastos")}>← Volver</button>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700}}>Importar Excel de Egresos</div>
      </div>

      {/* Instrucciones */}
      <div className="card" style={{marginBottom:16,borderLeft:"4px solid #c0392b"}}>
        <div className="card-body">
          <div style={{fontWeight:700,fontSize:13,marginBottom:10,color:"#c0392b"}}>📋 Estructura requerida</div>
          <div style={{padding:"8px 12px",background:"#fdf2f2",borderRadius:6,fontFamily:"monospace",fontSize:10,marginBottom:10,lineHeight:1.8}}>
            CATEGORIA &nbsp;|&nbsp; PRODUCTOR &nbsp;|&nbsp; MONTO &nbsp;|&nbsp; NUM_SOLICITUD &nbsp;|&nbsp; NUM_ORDEN &nbsp;|&nbsp; CONCEPTO<br/>
            <span style={{color:"#1a6ea8"}}>+ Para mano_obra: &nbsp;SEMANA_NUM | SEMANA_FECHA_INICIO | SEMANA_FECHA_FIN | DOMINGO_FECHA | TIPO_DE_TRABAJADOR | DETALLE_MO</span><br/>
            <span style={{color:"#8e44ad"}}>+ Para tramites/otro: &nbsp;SUBCATEGORIA</span>
          </div>
          <div style={{fontSize:11,color:"#5a6a5a",lineHeight:1.8}}>
            <b>Categorías válidas:</b> mano_obra · renta_tierra · pago_agua · permiso_siembra · flete · reparaciones · tramites · seguros · otro<br/>
            <b>La fecha</b> se toma automáticamente de la dispersión ligada (NUM_SOLICITUD).<br/>
            <b>La línea de crédito</b> se asigna automáticamente según el crédito parafinanciero del productor.<br/>
            Solo se procesa la primera hoja del archivo.
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{textAlign:"center",padding:32}}>
          <div style={{fontSize:40,marginBottom:12}}>💸</div>
          <div style={{fontWeight:600,marginBottom:4}}>Selecciona el archivo .xlsx de egresos</div>
          <div style={{fontSize:12,color:"#8a8070",marginBottom:20}}>Usa la plantilla descargada desde el sistema</div>
          <input type="file" accept=".xlsx,.xls" ref={fileEgresosRef} style={{display:"none"}} onChange={importarEgresos}/>
          <button className="btn btn-primary" onClick={()=>fileEgresosRef.current?.click()} disabled={importandoEgresos}>
            {importandoEgresos?"⏳ Procesando...":"📂 Seleccionar archivo"}
          </button>
          {importLogEgresos.length>0&&(
            <div style={{marginTop:16,textAlign:"left",padding:"12px 16px",background:"#f5f4f0",borderRadius:8}}>
              {importLogEgresos.map((l,i)=>(
                <div key={i} style={{fontSize:12,marginBottom:4,
                  color:l.startsWith("❌")?"#c0392b":l.startsWith("⚠️")?"#e67e22":"#2d5a1b"}}>
                  {l}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // VISTA: NUEVO GASTO
  // ─────────────────────────────────────────────────────────────────────────────
  if (vista==="nuevo_gasto") {
    const cat = formGasto.categoria;
    const esMO = cat === "mano_obra";

    const TIPOS_TRAB = ["OPERADORES","TRABAJADORES","RETRO EXCAVADORA","REGADORES","ENCARGADO DE BOMBAS","PENDIENTE","MEZCLADORES","CARGADORES","CHECADOR DE SIEMBRA","AYUDANTES"];

    const addSolicitud = () => {
      if (!ligaSolic.numSolicitud) return;
      setFormGasto(f=>({...f,solicitudes:[...f.solicitudes,{...ligaSolic}]}));
      setLigaSolic({numSolicitud:"",numOrden:""});
    };
    const delSolicitud = (idx) => setFormGasto(f=>({...f,solicitudes:f.solicitudes.filter((_,i)=>i!==idx)}));

    const subcatOpts = {
      tramites:["Apertura de cuenta bancaria","Administración de cuenta bancaria","Otro trámite"],
      otro:["Especificar..."],
    };

    return (
      <div style={{maxWidth:680}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
          <button className="btn btn-secondary" onClick={()=>setVista("gastos")}>← Volver</button>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700}}>Registrar Gasto</div>
        </div>
        <div className="card">
          <div className="card-body" style={{display:"flex",flexDirection:"column",gap:14}}>

            {/* Fecha y categoría */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Fecha *</label>
                <input className="form-input" type="date" value={formGasto.fecha} onChange={e=>setFormGasto(f=>({...f,fecha:e.target.value}))}/>
              </div>
              <div className="form-group">
                <label className="form-label">Categoría *</label>
                <select className="form-select" value={cat} onChange={e=>setFormGasto(f=>({...f,categoria:e.target.value,subcategoria:"",semanaNum:"",semanaFechaInicio:"",semanaFechaFin:"",domingoFecha:"",tipoTrabajador:"",detalleMO:""}))}>
                  {Object.entries(CAT_LABELS).map(([k,v])=><option key={k} value={k}>{CAT_ICONS[k]} {v}</option>)}
                </select>
              </div>
            </div>

            {/* Subcategoría para trámites y otro */}
            {(cat==="tramites"||cat==="otro")&&(
              <div className="form-group">
                <label className="form-label">{cat==="tramites"?"Tipo de trámite":"Especifica el concepto"} *</label>
                {cat==="tramites"?(
                  <select className="form-select" value={formGasto.subcategoria} onChange={e=>setFormGasto(f=>({...f,subcategoria:e.target.value}))}>
                    <option value="">— Seleccionar —</option>
                    {subcatOpts.tramites.map(o=><option key={o} value={o}>{o}</option>)}
                  </select>
                ):(
                  <input className="form-input" value={formGasto.subcategoria} onChange={e=>setFormGasto(f=>({...f,subcategoria:e.target.value}))} placeholder="Describe el concepto..."/>
                )}
                {cat==="tramites"&&formGasto.subcategoria==="Otro trámite"&&(
                  <input className="form-input" style={{marginTop:8}} value={formGasto.concepto} onChange={e=>setFormGasto(f=>({...f,concepto:e.target.value}))} placeholder="Especifica cuál trámite..."/>
                )}
              </div>
            )}

            {/* Concepto libre para categorías simples */}
            {!esMO&&cat!=="tramites"&&cat!=="otro"&&(
              <div className="form-group">
                <label className="form-label">Concepto / Descripción</label>
                <input className="form-input" value={formGasto.concepto} onChange={e=>setFormGasto(f=>({...f,concepto:e.target.value}))} placeholder="Describe el gasto..."/>
              </div>
            )}

            {/* ── MANO DE OBRA — desglose especial ── */}
            {esMO&&(
              <div style={{background:"#f0f8e8",borderRadius:8,padding:"14px 16px",border:"1px solid #c8e0b0"}}>
                <div style={{fontWeight:700,fontSize:13,color:"#2d5a1b",marginBottom:10}}>{"👷 Mano de Obra"}</div>
                <div className="form-row" style={{marginBottom:10}}>
                  <div className="form-group">
                    <label className="form-label">{"Semana #"}</label>
                    <input className="form-input" type="number" value={formGasto.semanaNum}
                      onChange={e=>setFormGasto(f=>({...f,semanaNum:e.target.value}))} placeholder="ej. 1" style={{width:80}}/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{"Fecha Inicio"}</label>
                    <input className="form-input" type="date" value={formGasto.semanaFechaInicio}
                      onChange={e=>setFormGasto(f=>({...f,semanaFechaInicio:e.target.value}))}/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{"Fecha Fin"}</label>
                    <input className="form-input" type="date" value={formGasto.semanaFechaFin}
                      onChange={e=>setFormGasto(f=>({...f,semanaFechaFin:e.target.value}))}/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{"Domingo (si aplica)"}</label>
                    <input className="form-input" type="date" value={formGasto.domingoFecha}
                      onChange={e=>setFormGasto(f=>({...f,domingoFecha:e.target.value}))}/>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group" style={{flex:"0 0 220px"}}>
                    <label className="form-label">{"Tipo de Trabajador"}</label>
                    <select className="form-select" value={formGasto.tipoTrabajador}
                      onChange={e=>setFormGasto(f=>({...f,tipoTrabajador:e.target.value}))}>
                      <option value="">{"-- Seleccionar --"}</option>
                      {TIPOS_TRAB.map(t=>(<option key={t} value={t}>{t}</option>))}
                    </select>
                  </div>
                  <div className="form-group" style={{flex:1}}>
                    <label className="form-label">
                      {"Detalle MO"}
                      {formGasto.domingoFecha && (
                        <span style={{fontSize:10,color:"#e67e22",marginLeft:6}}>{"🟡 Dom " + formGasto.domingoFecha}</span>
                      )}
                      {!formGasto.domingoFecha && (
                        <span style={{fontSize:10,color:"#5a7a5a",marginLeft:6}}>{"Lun-Sáb"}</span>
                      )}
                    </label>
                    <input className="form-input" value={formGasto.detalleMO}
                      onChange={e=>setFormGasto(f=>({...f,detalleMO:e.target.value}))}
                      placeholder="Descripción del trabajo realizado"/>
                  </div>
                </div>
              </div>
            )}

            {/* Monto (no-MO) */}
            {!esMO&&(
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Monto ($MXN) *</label>
                  <input className="form-input" type="number" value={formGasto.monto} onChange={e=>setFormGasto(f=>({...f,monto:e.target.value}))} placeholder="0.00"/>
                </div>
              </div>
            )}
            {esMO&&(
              <div className="form-group">
                <label className="form-label">Monto total (calculado)</label>
                <input className="form-input" style={{fontFamily:"monospace",fontWeight:700,color:"#2d5a1b",background:"#f0f8e8"}}
                  value={(totalMO).toFixed(2)} readOnly
                  onChange={()=>{}} // auto
                  onFocus={()=>setFormGasto(f=>({...f,monto:totalMO}))}
                />
              </div>
            )}

            {/* Productor y línea */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Productor</label>
                <select className="form-select" value={formGasto.productorId} onChange={e=>setFormGasto(f=>({...f,productorId:e.target.value}))}>
                  <option value="">— General / Rancho —</option>
                  {productores.map(p=><option key={p.id} value={p.id}>{p.alias||p.apPat} — {p.rfc}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Línea de Crédito</label>
                <select className="form-select" value={formGasto.lineaCredito} onChange={e=>setFormGasto(f=>({...f,lineaCredito:e.target.value}))}>
                  <option value="parafinanciero">Crédito Parafinanciero</option>
                  <option value="directo">Crédito Directo</option>
                </select>
              </div>
            </div>

            {/* Ligar solicitudes/órdenes */}
            <div style={{background:"#f5f4f0",borderRadius:8,padding:"12px 14px"}}>
              <div style={{fontWeight:600,fontSize:12,marginBottom:8,color:"#3d3525"}}>🔗 Ligar a Solicitud / Orden (opcional)</div>
              <div style={{display:"flex",gap:8,marginBottom:8,alignItems:"flex-end"}}>
                <div className="form-group" style={{flex:1,marginBottom:0}}>
                  <label className="form-label" style={{fontSize:10}}>Solicitud #</label>
                  <input className="form-input" value={ligaSolic.numSolicitud} onChange={e=>setLigaSolic(l=>({...l,numSolicitud:e.target.value}))} placeholder="Ej. 6917"/>
                </div>
                <div className="form-group" style={{flex:1,marginBottom:0}}>
                  <label className="form-label" style={{fontSize:10}}>Orden #</label>
                  <input className="form-input" value={ligaSolic.numOrden} onChange={e=>setLigaSolic(l=>({...l,numOrden:e.target.value}))} placeholder="Ej. 417"/>
                </div>
                <button className="btn btn-secondary" onClick={addSolicitud} style={{flexShrink:0}}>＋ Agregar</button>
              </div>
              {formGasto.solicitudes.length>0&&(
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {formGasto.solicitudes.map((s,i)=>(
                    <div key={i} style={{padding:"4px 10px",borderRadius:20,background:"#2d5a1b",color:"white",fontSize:11,display:"flex",alignItems:"center",gap:6}}>
                      <span>Sol.{s.numSolicitud}{s.numOrden?` / Ord.${s.numOrden}`:""}</span>
                      <span style={{cursor:"pointer"}} onClick={()=>delSolicitud(i)}>✕</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button className="btn btn-secondary" onClick={()=>setVista("gastos")}>Cancelar</button>
              <button className="btn btn-primary" onClick={()=>{
                const montoFinal = parseFloat(formGasto.monto)||0;
                if (!montoFinal) return;
                dispatch({type:"ADD_EGRESO",payload:{
                  ...formGasto,
                  monto: montoFinal,
                  productorId: formGasto.productorId?parseInt(formGasto.productorId)||formGasto.productorId:null,
                  subcategoria: formGasto.subcategoria,
                  id: Date.now(),
                }});
                setFormGasto(emptyGasto);
                setVista("gastos");
              }}>💾 Guardar Gasto</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // VISTA: DETALLE PRODUCTOR
  // ─────────────────────────────────────────────────────────────────────────────
  if (vista==="detalle_prod") {
    const p = productores.find(x=>x.id===prodDetalle);
    if (!p) return <button className="btn btn-secondary" onClick={()=>setVista("resumen")}>← Volver</button>;
    // Línea de crédito: sin montoPorHa todo es directo
    const exp       = (state.expedientes||[]).find(e=>e.productorId===p.id);
    const ha        = hasProd(p.id);
    const creditoPara = exp?.montoPorHa ? ha * exp.montoPorHa : 0;
    // Gasto total del ciclo = insumos + semilla + diesel + efectivo
    const gSemCalc = insumos.filter(i=>!i.cancelado&&String(i.productorId)===String(p.id)&&i.categoria==="Semilla").reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
    const gInsCalc = insumos.filter(i=>!i.cancelado&&String(i.productorId)===String(p.id)&&i.categoria!=="Semilla").reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
    const gDieCalc = diesel.filter(d=>!d.cancelado&&String(d.productorId)===String(p.id)).reduce((s,d)=>s+(parseFloat(d.importe)||0),0);
    const gEfeCalc = egresosMan.filter(g=>String(g.productorId)===String(p.id)).reduce((s,g)=>s+(parseFloat(g.monto)||0),0);
    const gastoTotalProd = gSemCalc + gInsCalc + gDieCalc + gEfeCalc;
    // Parafinanciero: hasta el tope autorizado (0 si no hay montoPorHa)
    const dPar = creditoPara > 0 ? Math.min(gastoTotalProd, creditoPara) : 0;
    // Directo: todo lo que excede parafinanciero (o todo si no hay montoPorHa)
    const dDir = Math.max(0, gastoTotalProd - dPar);
    const gas   = gastoProd(p.id);
    const dispsP  = dispersiones.filter(d=>String(d.productorId)===String(p.id));
    const gastosP = egresosMan.filter(g=>String(g.productorId)===String(p.id));

    // Gasto por categoría incluyendo insumos, semilla y diesel
    const catResP = {};
    Object.keys(CAT_LABELS).forEach(k=>{
      catResP[k] = gastosP.filter(g=>g.categoria===k).reduce((s,g)=>s+(parseFloat(g.monto)||0),0);
    });
    const gSemP = insumos.filter(i=>!i.cancelado&&String(i.productorId)===String(p.id)&&i.categoria==="Semilla").reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
    const gInsP = insumos.filter(i=>!i.cancelado&&String(i.productorId)===String(p.id)&&i.categoria!=="Semilla").reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
    const gDieP = diesel.filter(d=>!d.cancelado&&String(d.productorId)===String(p.id)).reduce((s,d)=>s+(parseFloat(d.importe)||0),0);

    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <button className="btn btn-secondary" onClick={()=>setVista("resumen")}>← Volver</button>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:14,height:14,borderRadius:"50%",background:p.color}}/>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700}}>{p.alias||p.apPat}</div>
          </div>
        </div>
        {/* Stats */}
        <div className="stat-grid" style={{gridTemplateColumns:"repeat(4,1fr)",marginBottom:16}}>
          <div className="stat-card sky"><div className="stat-icon">🌾</div><div className="stat-label">Hectáreas</div><div className="stat-value" style={{fontSize:18}}>{fmt2(ha)} ha</div><div className="stat-sub">Ciclo activo</div></div>
          <div className="stat-card green">
            <div className="stat-icon">🏦</div>
            <div className="stat-label">Parafinanciero</div>
            <div className="stat-value" style={{fontSize:16}}>{creditoPara>0?mxnFmt(dPar):<span style={{fontSize:12,color:"#e67e22"}}>⏳ Sin asignar</span>}</div>
            <div className="stat-sub">{creditoPara>0?`${dispsP.filter(d=>d.lineaCredito==="parafinanciero").length} dispersiones`:"Captura $/ha en Crédito Habilitación"}</div>
          </div>
          <div className="stat-card purple">
            <div className="stat-icon">💳</div>
            <div className="stat-label">Crédito Directo</div>
            <div className="stat-value" style={{fontSize:16}}>{mxnFmt(dDir)}</div>
            <div className="stat-sub">{creditoPara>0?`Exceso sobre ${mxnFmt(creditoPara)} parafin.`:"Todo el gasto es crédito directo"}</div>
          </div>
          <div className="stat-card rust"><div className="stat-icon">💸</div><div className="stat-label">Total Gastado</div><div className="stat-value" style={{fontSize:16}}>{mxnFmt(gas)}</div><div className="stat-sub">Insumos + Diesel + Efectivo</div></div>
        </div>
        {/* Resumen categorías — incluye insumos, semilla y diesel */}
        <div className="card" style={{marginBottom:12}}>
          <div className="card-header"><div className="card-title">Gasto por Categoría</div></div>
          <div className="card-body">
            <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
              {gSemP>0&&<div style={{padding:"8px 14px",borderRadius:8,background:"#fff9e6",border:"1px solid #f0d070",minWidth:150}}>
                <div style={{fontSize:11,fontWeight:600}}>🌽 Semilla</div>
                <div style={{fontFamily:"monospace",fontWeight:700,color:"#c8a84b",marginTop:2}}>{mxnFmt(gSemP)}</div>
              </div>}
              {gInsP>0&&<div style={{padding:"8px 14px",borderRadius:8,background:"#f0f8e8",border:"1px solid #b0d890",minWidth:150}}>
                <div style={{fontSize:11,fontWeight:600}}>🌿 Insumos</div>
                <div style={{fontFamily:"monospace",fontWeight:700,color:"#2d5a1b",marginTop:2}}>{mxnFmt(gInsP)}</div>
              </div>}
              {gDieP>0&&<div style={{padding:"8px 14px",borderRadius:8,background:"#fff3e0",border:"1px solid #f0c060",minWidth:150}}>
                <div style={{fontSize:11,fontWeight:600}}>⛽ Diesel</div>
                <div style={{fontFamily:"monospace",fontWeight:700,color:"#e67e22",marginTop:2}}>{mxnFmt(gDieP)}</div>
              </div>}
              {Object.entries(catResP).filter(([,v])=>v>0).map(([k,v])=>(
                <div key={k} style={{padding:"8px 14px",borderRadius:8,background:"#f5f4f0",border:"1px solid #ddd5c0",minWidth:150}}>
                  <div style={{fontSize:11,fontWeight:600}}>{CAT_ICONS[k]} {CAT_LABELS[k]}</div>
                  <div style={{fontFamily:"monospace",fontWeight:700,color:"#c0392b",marginTop:2}}>{mxnFmt(v)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Dispersiones */}
        <div className="card" style={{marginBottom:12}}>
          <div className="card-header">
            <div className="card-title">Dispersiones</div>
            <BtnExport onClick={()=>exportarExcel("Dispersiones_"+state.cicloActual,[{
              nombre:"Dispersiones",
              headers:["# Sol","# Orden","Fecha","Productor","Línea","Monto"],
              rows:dispersiones.map(d=>[d.numSolicitud,d.numOrden,d.fecha,
                (state.productores||[]).find(p=>String(p.id)===String(d.productorId))?.alias||"",
                d.lineaCredito,parseFloat(d.monto)||0])
            }])}/>
          </div>
          <div className="table-wrap-scroll">
            <table style={{minWidth:500}}>
              <thead><tr><th># Solicitud</th><th># Orden</th><th>Fecha</th><th>Línea</th><th style={{textAlign:"right"}}>Monto</th></tr></thead>
              <tbody>{dispsP.sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||"")).map((d,i)=>{
                const bg=i%2===0?"white":"#faf8f3";
                return(<tr key={d.id}>
                  <td style={{background:bg,fontFamily:"monospace",fontWeight:700}}>{d.numSolicitud}</td>
                  <td style={{background:bg,fontFamily:"monospace"}}>{d.numOrden||"—"}</td>
                  <td style={{background:bg,fontSize:12}}>{d.fecha}</td>
                  <td style={{background:bg}}><span style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:d.lineaCredito==="parafinanciero"?"#dbeafe":"#ede9fe",color:d.lineaCredito==="parafinanciero"?"#1a6ea8":"#8e44ad"}}>{d.lineaCredito==="parafinanciero"?"Parafinanciero":"Directo"}</span></td>
                  <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:700}}>{mxnFmt(d.monto)}</td>
                </tr>);
              })}</tbody>
            </table>
          </div>
        </div>
        {/* Gastos */}
        <div className="card">
          <div className="card-header"><div className="card-title">Gastos</div></div>
          <div className="table-wrap-scroll">
            <table style={{minWidth:600}}>
              <thead><tr><th>Fecha</th><th>Categoría</th><th>Concepto</th><th>Solicitudes</th><th style={{textAlign:"right"}}>Monto</th></tr></thead>
              <tbody>{gastosP.sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||"")).map((g,i)=>{
                const bg=i%2===0?"white":"#faf8f3";
                const label=g.categoria==="mano_obra"?`Sem.${g.semanaNum||"?"} ${g.semanaFechaInicio||""}–${g.semanaFechaFin||""}`:(g.subcategoria||g.concepto||"");
                return(<tr key={g.id}>
                  <td style={{background:bg,fontSize:12,fontFamily:"monospace"}}>{g.fecha}</td>
                  <td style={{background:bg}}><span style={{fontSize:10,padding:"2px 6px",borderRadius:8,background:"#f0f4e8",color:"#2d5a1b"}}>{CAT_ICONS[g.categoria]||"📌"} {CAT_LABELS[g.categoria]||g.categoria}</span></td>
                  <td style={{background:bg,fontSize:12}}>{label}</td>
                  <td style={{background:bg,fontSize:10,color:"#5a7a3a"}}>{(g.solicitudes||[]).map(s=>s.numSolicitud).join(", ")||"—"}</td>
                  <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:700,color:"#c0392b"}}>{mxnFmt(g.monto)}</td>
                </tr>);
              })}</tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return null;

  {cancelModal && (
    cancelModal.action === "cancelar"
    ? <ModalCancelacion
        titulo={cancelModal.rec?.insumo || cancelModal.rec?.numSolicitud || cancelModal.rec?.concepto || cancelModal.rec?.nombre || "registro"}
        onCerrar={()=>setCancelModal(null)}
        onConfirmar={({motivo,comentario})=>{
          dispatch({type:"CANCELAR_REGISTRO",payload:{
            tabla:cancelModal.tabla, id:cancelModal.rec.id,
            motivo, comentario,
            canceladoPor: "admin",
            fecha: new Date().toISOString().split("T")[0]
          }});
          setCancelModal(null);
        }}/>
    : <ModalReactivacion
        titulo={cancelModal.rec?.insumo || cancelModal.rec?.numSolicitud || cancelModal.rec?.concepto || cancelModal.rec?.nombre || "registro"}
        onCerrar={()=>setCancelModal(null)}
        onConfirmar={({motivo,comentario})=>{
          dispatch({type:"REACTIVAR_REGISTRO",payload:{
            tabla:cancelModal.tabla, id:cancelModal.rec.id,
            motivo, comentario,
            reactivadoPor: "admin",
            fecha: new Date().toISOString().split("T")[0]
          }});
          setCancelModal(null);
        }}/>
  )}
}
