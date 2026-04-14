// ─── modules/Bitacora.jsx ───────────────────────────────────────────

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
import { mxn } from "../App.jsx";
import { useIsMobile } from '../components/mobile/useIsMobile.js';
import AIInsight from '../components/AIInsight.jsx';


export default function BitacoraModule({ userRol, puedeEditar }) {
  const isMobile = useIsMobile();
  const { state, dispatch } = useData();
  const cargarXLSX = () => new Promise((resolve, reject) => {
    if (typeof XLSX !== "undefined") { resolve(window.XLSX); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => resolve(window.XLSX);
    s.onerror = reject;
    document.head.appendChild(s);
  });
  const [vista, setVista] = useState("feed");       // feed | porLote
  const [tipoModal, setTipoModal] = useState(null); // null | tipo de registro
  const [filtroLote, setFiltroLote] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [fotoPreview, setFotoPreview] = useState(null);
  const fileRef = useRef(null);

  const hoy = new Date().toISOString().split("T")[0];
  const emptyBase = { loteId:"", fecha:hoy, notas:"", foto:null, operador:"", operadorId:"", maquinariaId:"", horas:"" };

  // Forms por tipo
  const [formInsumo,  setFormInsumo]  = useState({...emptyBase, insumoId:"", producto:"", dosis:"", unidad:"L/ha", haAplicadas:""});
  const [formDiesel,  setFormDiesel]  = useState({...emptyBase, tractorId:"", litros:"", precioLitro:"27", actividad:""});
  const [formRiego,   setFormRiego]   = useState({...emptyBase, horasRiego:"", volumenM3:"", tipoRiego:"Gravedad"});
  const [formFenol,   setFormFenol]   = useState({...emptyBase, fenologia:"Vegetativo", observacion:""});
  const [formReporte, setFormReporte] = useState({...emptyBase, titulo:"", descripcion:""});
  const [formFoto,    setFormFoto]    = useState({...emptyBase, descripcion:"", fotoData:null});
  const [importandoBit,   setImportandoBit]   = useState(false);
  const [importLogBit,    setImportLogBit]    = useState([]);
  const [showImportBit,   setShowImportBit]   = useState(false);
  const fileImportBitRef = useRef(null);

  const TIPOS = [
    { id:"insumo",  icon:"🌱", label:"Aplicación de Insumos",  color:"#2d7a3a", roles:["admin","encargado","ingeniero","campo"] },
    { id:"diesel",  icon:"⛽", label:"Consumo Diesel",          color:"#e67e22", roles:["admin","encargado","campo"] },
    { id:"riego",   icon:"💧", label:"Riego",                   color:"#2980b9", roles:["admin","encargado","ingeniero","campo"] },
    { id:"foto",    icon:"📷", label:"Foto / Comprobante",      color:"#8e44ad", roles:["admin","encargado","ingeniero","campo"] },
    { id:"fenol",   icon:"🌿", label:"Lectura Fenológica",      color:"#27ae60", roles:["admin","encargado","ingeniero","campo"] },
    { id:"reporte", icon:"📝", label:"Reporte Diario",          color:"#34495e", roles:["admin","encargado","ingeniero","campo"] },
  ].filter(t => t.roles.includes(userRol));

  // ── IMPORTAR BITÁCORA DESDE EXCEL ─────────────────────────────────────────
  const importarBitacora = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportandoBit(true);
    setImportLogBit(["⏳ Cargando archivo..."]);
    try {
      const XLSX = await cargarXLSX();
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(ab), {type:"array", cellDates:true});
      // Try "BITACORA" sheet first, else first sheet
      const sheetName = wb.SheetNames.includes("BITACORA") ? "BITACORA" : wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const allRows = XLSX.utils.sheet_to_json(ws, {defval:"", raw:false, header:1});
      // Find header row (row with TIPO)
      let hIdx = allRows.findIndex(r=>r.some(c=>String(c).toUpperCase().trim()==="TIPO"));
      if (hIdx === -1) hIdx = 2; // row 3 (0-indexed=2) by default
      const headers = allRows[hIdx].map(h=>String(h||"").trim().toUpperCase().replace(/[\*\r\n]+/g,"").replace(/\s+/g,"_"));
      const rows = allRows.slice(hIdx+1).map(row=>{
        const obj={};
        headers.forEach((h,i)=>{obj[h]=row[i]!==undefined?String(row[i]).trim():"";});
        return obj;
      }).filter(r=>r["TIPO"]&&["insumo","diesel","riego","fenol","reporte"].includes(r["TIPO"].toLowerCase()));

      const logs=[];
      logs.push(`📋 ${rows.length} registros encontrados en hoja "${sheetName}"`);

      const getCol = (row,...keys)=>{
        for(const k of keys){
          if(row[k]!==undefined&&String(row[k]).trim()!=="") return String(row[k]).trim();
          const fnd=Object.keys(row).find(c=>c.replace(/[^A-Z0-9_]/g,"")===k.replace(/[^A-Z0-9_]/g,""));
          if(fnd&&String(row[fnd]).trim()!=="") return String(row[fnd]).trim();
        }
        return "";
      };

      // Lotes map: folio -> [ids]  AND  zona/apodo -> [ids]
      const lotesMap={};   // key -> array of lote ids
      (state.lotes||[]).forEach(l=>{
        // By folio corto (exact lote)
        if(l.folioCorto){
          const k=String(l.folioCorto).trim().toUpperCase();
          lotesMap[k]=(lotesMap[k]||[]);
          lotesMap[k].push(l.id);
        }
        // By lote number
        if(l.lote){
          const k=String(l.lote).trim().toUpperCase();
          lotesMap[k]=(lotesMap[k]||[]);
          lotesMap[k].push(l.id);
        }
        // By zona/apodo — all lotes with same apodo
        if(l.apodo&&l.apodo!=="NO DEFINIDO"){
          const k=String(l.apodo).trim().toUpperCase();
          lotesMap[k]=(lotesMap[k]||[]);
          lotesMap[k].push(l.id);
        }
      });

      // Inventory map: nombre (upper) -> id
      const invMap={};
      ((state.inventario||{}).items||[]).forEach(item=>{
        invMap[(item.nombre||"").trim().toUpperCase()]=item.id;
      });

      let ok=0, warn=0;
      const nuevos=[];
      const invMovs=[];

      rows.forEach((row,i)=>{
        const tipo = row["TIPO"].toLowerCase();
        const fechaRaw = getCol(row,"FECHA");
        const fecha = fechaRaw ? fechaRaw.slice(0,10) : new Date().toISOString().slice(0,10);
        const folioRaw = getCol(row,"FOLIO_O_ZONA","FOLIO_LOTE","FOLIO LOTE","ZONA","FOLIO");
        const operador = getCol(row,"OPERADOR","RESPONSABLE");
        const notas = getCol(row,"NOTAS_GENERALES","NOTAS","NOTA");

        // Parse lote IDs — supports folio corto OR zona name, pipe-separated
        const folios = folioRaw ? folioRaw.split("|").map(f=>f.trim().toUpperCase()) : [];
        // Each token can be a folio (1 lote) or a zona (N lotes)
        const loteIds = [...new Set(folios.flatMap(f=>lotesMap[f]||[]))];
        const loteId = loteIds[0]||null;

        if(folioRaw&&loteIds.length===0){
          logs.push(`  ⚠️ Fila ${i+hIdx+2}: "${folioRaw}" no encontrado como folio ni zona — omitido`);
          warn++; return;
        }
        if(folioRaw&&loteIds.length>1){
          // zona resolved to multiple lotes — note it
          logs.push(`  📍 Fila ${i+hIdx+2}: "${folioRaw}" → ${loteIds.length} lotes`);
        }

        const base = { tipo, fecha, operador, notas, foto:"",
                       loteId, loteIds };

        if(tipo==="insumo"){
          const producto = getCol(row,"PRODUCTO","NOMBRE_PRODUCTO");
          const dosis    = parseFloat(getCol(row,"DOSIS"))||0;
          const unidad   = getCol(row,"UNIDAD_DOSIS","UNIDAD DOSIS","UNIDAD")||"L/ha";
          const haApl    = parseFloat(getCol(row,"HA_APLICADAS","HA APLICADAS"))||0;
          const unidadBase = unidad.replace("/ha","").trim();
          const cantTotal  = dosis * haApl;
          if(!producto){logs.push(`  ⚠️ Fila ${i+hIdx+2}: insumo sin PRODUCTO — omitido`);warn++;return;}
          const insumoId = invMap[producto.toUpperCase()];
          if(!insumoId) logs.push(`  ⚠️ "${producto}" no está en inventario — registrado sin vínculo`);
          nuevos.push({...base, data:{insumoId:insumoId||null,producto,dosis,unidad,haAplicadas:haApl,cantidadTotal:cantTotal,unidadBase}});
          if(insumoId&&cantTotal>0){
            invMovs.push({itemId:insumoId,tipo:"salida",cantidad:cantTotal,unidad:unidadBase,
              fecha,concepto:`Aplicación bitácora — ${dosis} ${unidad} × ${haApl} ha`,ref:"bitacora"});
          }
          ok++;
        } else if(tipo==="diesel"){
          const tractorId   = getCol(row,"TRACTOR_EQUIPO","TRACTOR","EQUIPO","TRACTOR / EQUIPO","TRACTOR_/_EQUIPO");
          const litros      = parseFloat(getCol(row,"LITROS"))||0;
          const precioLitro = parseFloat(getCol(row,"PRECIO_LITRO","PRECIO LITRO"))||27;
          const actividad   = getCol(row,"ACTIVIDAD_DIESEL","ACTIVIDAD");
          if(!litros){logs.push(`  ⚠️ Fila ${i+hIdx+2}: diesel sin LITROS — omitido`);warn++;return;}
          nuevos.push({...base, data:{tractorId,litros,precioLitro,actividad}});
          // Also discount from inventory (Diesel item)
          const dieselId = invMap["DIESEL"];
          if(dieselId&&litros>0){
            invMovs.push({itemId:dieselId,tipo:"salida",cantidad:litros,unidad:"LT",
              fecha,concepto:`Consumo diesel — ${actividad||tractorId}`,ref:"bitacora"});
          }
          ok++;
        } else if(tipo==="riego"){
          const horasRiego = parseFloat(getCol(row,"HORAS_RIEGO","HORAS RIEGO"))||0;
          const volumenM3  = parseFloat(getCol(row,"VOLUMEN_M3","VOLUMEN","VOLUMEN M3"))||0;
          const tipoRiego  = getCol(row,"TIPO_RIEGO","TIPO RIEGO")||"Gravedad";
          nuevos.push({...base, data:{horasRiego,volumenM3,tipoRiego}});
          ok++;
        } else if(tipo==="fenol"){
          const fenologia   = getCol(row,"ETAPA_FENOLOGICA","ETAPA FENOLOGICA","FENOLOGIA","ETAPA");
          const observacion = getCol(row,"OBSERVACION_FENOL","OBSERVACION FENOL","OBSERVACION");
          nuevos.push({...base, data:{fenologia,observacion}});
          if(fenologia) loteIds.forEach(lid=>{
            const lote=state.lotes.find(l=>l.id===lid);
            if(lote) dispatch({type:"UPD_LOTE",payload:{...lote,fenologia}});
          });
          ok++;
        } else if(tipo==="reporte"){
          const titulo      = getCol(row,"NOTAS_GENERALES","NOTAS","TITULO")||"Reporte";
          const descripcion = notas||titulo;
          nuevos.push({...base, data:{titulo,descripcion}});
          ok++;
        }
      });

      // Dispatch all at once
      nuevos.forEach((b,i)=>dispatch({type:"ADD_BITACORA",payload:{...b,id:Date.now()+i}}));
      invMovs.forEach((m,i)=>dispatch({type:"ADD_INV_MOV",payload:{...m,id:Date.now()+10000+i}}));

      logs.push(`✅ ${ok} registros importados correctamente`);
      if(warn>0) logs.push(`⚠️ ${warn} registros con advertencias`);
      if(invMovs.length>0) logs.push(`📦 ${invMovs.length} movimientos de inventario generados`);
      setImportLogBit(logs);
    } catch(err){
      setImportLogBit([`❌ Error: ${err.message}`]);
    }
    setImportandoBit(false);
    if(fileImportBitRef.current) fileImportBitRef.current.value="";
  };

  // Reducer actions para bitácora extendida
  const saveInsumo = () => {
    const f = formInsumo;
    if(!f.loteId||!f.producto) return;
    const dosis      = parseFloat(f.dosis)||0;
    const haApl      = parseFloat(f.haAplicadas)||0;
    const cantTotal  = dosis * haApl;
    const unidadBase = f.unidad.replace("/ha","").trim();
    dispatch({ type:"ADD_BITACORA", payload:{
      tipo:"insumo",
      loteId: parseInt(f.loteId)||null,
      loteIds: Array.isArray(f.loteIds) ? f.loteIds.map(Number) : (f.loteId?[parseInt(f.loteId)]:[]),
      fecha:f.fecha, operador:f.operador, operadorId:f.operadorId||"",
      maquinariaId:f.maquinariaId||"", horas:parseFloat(f.horas)||0,
      notas:f.notas, foto:f.foto,
      data:{ insumoId:f.insumoId, producto:f.producto,
             dosis:f.dosis, unidad:f.unidad, haAplicadas:haApl,
             cantidadTotal:cantTotal, unidadBase }
    }});
    if(f.insumoId && cantTotal>0) {
      dispatch({ type:"ADD_INV_MOV", payload:{
        itemId: parseInt(f.insumoId), tipo:"salida",
        cantidad: cantTotal, unidad: unidadBase,
        fecha: f.fecha,
        concepto: `Aplicación en lote ${f.loteId} — ${dosis} ${f.unidad} × ${haApl} ha`,
        ref: "bitacora",
      }});
    }
    // Auto-registrar horas de maquinaria si se especificaron
    if(f.maquinariaId && parseFloat(f.horas)>0) {
      dispatch({type:"ADD_HORAS", payload:{
        fecha:f.fecha, maqId:parseInt(f.maquinariaId),
        operadorId:f.operadorId||"", loteId:parseInt(f.loteId)||"",
        horas:parseFloat(f.horas), concepto:`Aplicación: ${f.producto}`, fuente:"bitacora"
      }});
    }
    setTipoModal(null); setFormInsumo({...emptyBase, insumoId:"", producto:"", dosis:"", unidad:"L/ha", haAplicadas:""});
  };
  const saveDiesel = () => {
    const f = formDiesel;
    if(!f.loteId||!f.litros) return;
    const maqId = f.maquinariaId||f.tractorId||"";
    dispatch({ type:"ADD_BITACORA", payload:{ tipo:"diesel",
      loteId: parseInt(f.loteId)||null,
      loteIds: Array.isArray(f.loteIds) ? f.loteIds.map(Number) : (f.loteId?[parseInt(f.loteId)]:[]),
      fecha:f.fecha, operador:f.operador, operadorId:f.operadorId||"",
      maquinariaId:maqId, horas:parseFloat(f.horas)||0,
      notas:f.notas, foto:f.foto,
      data:{ tractorId:maqId, litros:parseFloat(f.litros)||0, precioLitro:parseFloat(f.precioLitro)||27, actividad:f.actividad }}});
    if(f.litros) dispatch({ type:"ADD_DIESEL", payload:{ productorId:null, fecha:f.fecha, litros:parseFloat(f.litros)||0, precioLitro:parseFloat(f.precioLitro)||27, unidad:maqId||"Tractor", loteId:parseInt(f.loteId), concepto:f.actividad||"Registro campo", operador:f.operador, formaPago:"credito" }});
    if(maqId && parseFloat(f.horas)>0) dispatch({type:"ADD_HORAS", payload:{
      fecha:f.fecha, maqId:parseInt(maqId)||maqId, operadorId:f.operadorId||"",
      loteId:parseInt(f.loteId)||"", horas:parseFloat(f.horas),
      concepto:f.actividad||"Diesel", fuente:"bitacora"
    }});
    setTipoModal(null); setFormDiesel({...emptyBase, tractorId:"", litros:"", precioLitro:"27", actividad:""});
  };
  const saveRiego = () => {
    const f = formRiego;
    if(!f.loteId) return;
    dispatch({ type:"ADD_BITACORA", payload:{ tipo:"riego",
      loteId: parseInt(f.loteId)||null,
      loteIds: Array.isArray(f.loteIds) ? f.loteIds.map(Number) : (f.loteId?[parseInt(f.loteId)]:[]),
      fecha:f.fecha, operador:f.operador, operadorId:f.operadorId||"",
      maquinariaId:f.maquinariaId||"", horas:parseFloat(f.horas)||parseFloat(f.horasRiego)||0,
      notas:f.notas, foto:f.foto,
      data:{ horasRiego:parseFloat(f.horasRiego)||0, volumenM3:parseFloat(f.volumenM3)||0, tipoRiego:f.tipoRiego }}});
    if(f.maquinariaId && parseFloat(f.horas)>0) dispatch({type:"ADD_HORAS", payload:{
      fecha:f.fecha, maqId:parseInt(f.maquinariaId), operadorId:f.operadorId||"",
      loteId:parseInt(f.loteId)||"", horas:parseFloat(f.horas),
      concepto:"Riego", fuente:"bitacora"
    }});
    setTipoModal(null); setFormRiego({...emptyBase, horasRiego:"", volumenM3:"", tipoRiego:"Gravedad"});
  };
  const saveFenol = () => {
    const f = formFenol;
    if(!f.loteId) return;
    const loteIdsF = Array.isArray(f.loteIds) ? f.loteIds.map(Number) : (f.loteId?[parseInt(f.loteId)]:[]);
    dispatch({ type:"ADD_BITACORA", payload:{ tipo:"fenol",
      loteId: parseInt(f.loteId)||null, loteIds: loteIdsF,
      fecha:f.fecha, operador:f.operador, operadorId:f.operadorId||"",
      maquinariaId:f.maquinariaId||"", horas:parseFloat(f.horas)||0,
      notas:f.notas, foto:f.foto,
      data:{ fenologia:f.fenologia, observacion:f.observacion }}});
    loteIdsF.forEach(lid=>{ const lote=state.lotes.find(l=>l.id===lid); if(lote) dispatch({type:"UPD_LOTE",payload:{...lote,fenologia:f.fenologia}}); });
    setTipoModal(null); setFormFenol({...emptyBase, fenologia:"Vegetativo", observacion:""});
  };
  const saveReporte = () => {
    const f = formReporte;
    if(!f.titulo) return;
    dispatch({ type:"ADD_BITACORA", payload:{ tipo:"reporte",
      loteId: f.loteId?parseInt(f.loteId):null,
      loteIds: Array.isArray(f.loteIds) ? f.loteIds.map(Number) : (f.loteId?[parseInt(f.loteId)]:[]),
      fecha:f.fecha, operador:f.operador, operadorId:f.operadorId||"",
      maquinariaId:f.maquinariaId||"", horas:parseFloat(f.horas)||0,
      notas:f.notas, foto:f.foto,
      data:{ titulo:f.titulo, descripcion:f.descripcion }}});
    setTipoModal(null); setFormReporte({...emptyBase, titulo:"", descripcion:""});
  };
  const saveFoto = () => {
    const f = formFoto;
    if(!f.fotoData) return;
    dispatch({ type:"ADD_BITACORA", payload:{ tipo:"foto",
      loteId: f.loteId?parseInt(f.loteId):null,
      loteIds: Array.isArray(f.loteIds) ? f.loteIds.map(Number) : (f.loteId?[parseInt(f.loteId)]:[]),
      fecha:f.fecha, operador:f.operador, notas:f.notas, foto:f.fotoData,
      data:{ descripcion:f.descripcion }}});
    setTipoModal(null); setFormFoto({...emptyBase, descripcion:"", fotoData:null}); setFotoPreview(null);
  };


  // ── IMPORTAR BITÁCORA DESDE EXCEL ─────────────────────────────────────────
  const handleFoto = (e, setter) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const data = ev.target.result;
      setFotoPreview(data);
      setter(f=>({...f, fotoData:data, foto:data}));
    };
    reader.readAsDataURL(file);
  };

  // Feed filtrado
  const bitacora = (state.bitacora||[])
    .filter(b => {
      if (!filtroLote) return !filtroTipo || b.tipo===filtroTipo;
      // filtroLote can be "zona:CHEVETO" (all lotes with that apodo)
      if (filtroLote.startsWith("zona:")) {
        const zona = filtroLote.slice(5);
        const loteIds = (state.lotes||[]).filter(l=>(l.apodo&&l.apodo!=="NO DEFINIDO"?l.apodo:(l.lote||("Lote #"+l.id)))===zona).map(l=>l.id);
        const inZona = (Array.isArray(b.loteIds) ? b.loteIds.map(Number) : (b.loteId?[b.loteId]:[])).some(id=>loteIds.includes(id));
        return inZona && (!filtroTipo || b.tipo===filtroTipo);
      }
      // Legacy: numeric loteId
      return b.loteId===parseInt(filtroLote) && (!filtroTipo || b.tipo===filtroTipo);
    })
    .slice().sort((a,b)=>b.fecha.localeCompare(a.fecha)||b.id-a.id);

  const tipoInfo = id => TIPOS.find(t=>t.id===id) || { icon:"📋", label:id, color:T.fog };
  const nomLote = id => {
    const l = state.lotes.find(x=>x.id===id||x.id===parseInt(id));
    if (!l) return "—";
    const apodo = l.apodo && l.apodo!=="NO DEFINIDO" ? l.apodo : "";
    const folio = l.folioCorto||l.lote||"";
    return [apodo,folio].filter(Boolean).join(" ·") || `Lote #${l.id}`;
  };
  const nomLotes = (b) => {
    const ids = Array.isArray(b.loteIds) && b.loteIds.length > 0 ? b.loteIds : (b.loteId ? [b.loteId] : []);
    if (ids.length === 0) return "Sin lote";
    if (ids.length === 1) return nomLote(ids[0]);
    return `${nomLote(ids[0])} +${ids.length-1} más`;
  };

  const renderCard = (b) => {
    const ti = tipoInfo(b.tipo);
    return (
      <div key={b.id} style={{background:T.card,borderRadius:12,padding:16,marginBottom:12,border:`1px solid ${T.line}`,borderLeft:`4px solid ${ti.color}`}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
          <div style={{width:40,height:40,borderRadius:10,background:`${ti.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{ti.icon}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:4}}>
              <div>
                <span style={{fontWeight:700,fontSize:14,color:T.inkLt}}>{ti.label}</span>
                {b.loteId && <span style={{marginLeft:8,fontSize:11,background:T.mist,padding:"2px 8px",borderRadius:10,color:T.fog,border:`1px solid ${T.line}`}}>{nomLotes(b)}</span>}
                {b.origen === "orden_trabajo" && (
                  <span title={`Generado automáticamente por orden de trabajo #${b.ordenId || ""}`}
                    style={{marginLeft:8,fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,
                      background:"#e8f4fd",color:"#1a6ea8",border:"1px solid #1a6ea844",letterSpacing:0.3}}>
                    📋 Auto · Orden
                  </span>
                )}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span className="font-mono" style={{fontSize:11,color:T.fog}}>{b.fecha}</span>
                {b.operador && <span style={{fontSize:11,color:T.fog}}>· 👤 {b.operador}</span>}
                {userRol==="admin" && <button onClick={()=>confirmarEliminar("¿Eliminar este registro de bitácora?",()=>dispatch({type:"DEL_BITACORA",payload:b.id}))} style={{border:"none",background:"none",cursor:"pointer",color:T.fog,fontSize:14,padding:0}}>🗑</button>}
              </div>
            </div>

            {/* Datos específicos por tipo */}
            {b.tipo==="insumo" && b.data && (
              <div style={{marginTop:8,display:"flex",gap:16,flexWrap:"wrap"}}>
                <div style={{fontSize:13}}><span style={{color:T.fog}}>Producto: </span><strong>{b.data.producto}</strong></div>
                {b.data.dosis && <div style={{fontSize:13}}><span style={{color:T.fog}}>Dosis: </span><strong>{b.data.dosis} {b.data.unidad}</strong></div>}
                {b.data.haAplicadas>0 && <div style={{fontSize:13}}><span style={{color:T.fog}}>Ha: </span><strong>{b.data.haAplicadas}</strong></div>}
              </div>
            )}
            {b.tipo==="diesel" && b.data && (
              <div style={{marginTop:8,display:"flex",gap:16,flexWrap:"wrap"}}>
                {b.data.tractorId && <div style={{fontSize:13}}><span style={{color:T.fog}}>Equipo: </span><strong>{b.data.tractorId}</strong></div>}
                <div style={{fontSize:13}}><span style={{color:T.fog}}>Litros: </span><strong style={{color:"#e67e22"}}>{b.data.litros} L</strong></div>
                <div style={{fontSize:13}}><span style={{color:T.fog}}>Importe: </span><strong>{mxn(b.data.litros*b.data.precioLitro)}</strong></div>
                {b.data.actividad && <div style={{fontSize:13,color:T.fog}}>{b.data.actividad}</div>}
              </div>
            )}
            {b.tipo==="riego" && b.data && (
              <div style={{marginTop:8,display:"flex",gap:16,flexWrap:"wrap"}}>
                <div style={{fontSize:13}}><span style={{color:T.fog}}>Tipo: </span><strong>{b.data.tipoRiego}</strong></div>
                {b.data.horasRiego>0 && <div style={{fontSize:13}}><span style={{color:T.fog}}>Horas: </span><strong style={{color:"#2980b9"}}>{b.data.horasRiego} h</strong></div>}
                {b.data.volumenM3>0 && <div style={{fontSize:13}}><span style={{color:T.fog}}>Volumen: </span><strong>{fmt(b.data.volumenM3,0)} m³</strong></div>}
              </div>
            )}
            {b.tipo==="fenol" && b.data && (
              <div style={{marginTop:8,display:"flex",gap:12,alignItems:"center"}}>
                <span className={`badge badge-${fenologiaColor(b.data.fenologia)}`}>{b.data.fenologia}</span>
                {b.data.observacion && <span style={{fontSize:12,color:T.fog}}>{b.data.observacion}</span>}
              </div>
            )}
            {b.tipo==="reporte" && b.data && (
              <div style={{marginTop:8}}>
                <div style={{fontWeight:600,fontSize:13,marginBottom:4}}>{b.data.titulo}</div>
                {b.data.descripcion && <div style={{fontSize:12,color:T.fog,lineHeight:1.5}}>{b.data.descripcion}</div>}
              </div>
            )}
            {b.notas && <div style={{marginTop:6,fontSize:12,color:T.fog,fontStyle:"italic"}}>📝 {b.notas}</div>}

            {/* Foto comprobante */}
            {b.foto && (
              <div style={{marginTop:10}}>
                <img src={b.foto} alt="comprobante" style={{maxWidth:"100%",maxHeight:200,borderRadius:8,objectFit:"cover",border:`1px solid ${T.line}`}}/>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Helper: etiqueta de lote
  const nomLoteDisplay = (l) => {
    if (!l) return "—";
    const apodo = l.apodo && l.apodo!=="NO DEFINIDO" ? l.apodo : "";
    const folio = l.folioCorto || l.docLegal || "";
    const lote  = l.lote || "";
    const ejido = l.ejido ? l.ejido.replace("CONCEPCION DE CHARAY","CHARAY").replace("EL POCHOTAL","POCHOTAL") : "";
    const partes = [apodo, lote, folio, ejido].filter(Boolean);
    return partes.length > 0 ? partes.join(" · ") : `Lote #${l.id}`;
  };

  // Lotes del ciclo activo
  const cicloBit = (state.ciclos||[]).find(c=>c.id===state.cicloActivoId)||(state.ciclos||[]).find(c=>c.id===state.cicloActivoId)||(state.ciclos||[]).find(c=>c.predeterminado)||(state.ciclos||[])[0];
  const lotesEnCiclo = cicloBit?.asignaciones
    ? state.lotes.filter(l=>cicloBit.asignaciones.some(a=>a.loteId===l.id))
    : state.lotes;

  // Componente de selector de lote + fecha + operador reutilizable
  const CamposBase = ({ form, setForm, required=true, showMaq=false }) => {
    const [nuevoOp, setNuevoOp] = React.useState(false);
    const [nomNuevoOp, setNomNuevoOp] = React.useState("");
    const agregarOperador = () => {
      if (!nomNuevoOp.trim()) return;
      dispatch({ type:"ADD_OPER", payload:{ nombre:nomNuevoOp.trim(), puesto:"Operador", salarioDia:state.tarifaStd?.normal||600, tarifaEspecial:state.tarifaStd?.especial||750, activo:true }});
      setNuevoOp(false); setNomNuevoOp("");
    };
    const maquinaria = state.maquinaria || [];
    return (
    <>
      <div className="form-group">
        <label className="form-label">Lotes {required&&"*"} <span style={{fontSize:10,color:"#8a8070",fontWeight:400}}>(selecciona uno o varios)</span></label>
        {(()=>{
          const [busqLote, setBusqLote] = React.useState("");
          const loteIds = Array.isArray(form.loteIds) ? form.loteIds : (form.loteId ? [String(form.loteId)] : []);
          const lotesFiltrados = lotesEnCiclo.filter(l=>{
            if (!busqLote) return true;
            const q = busqLote.toLowerCase();
            return (l.apodo||"").toLowerCase().includes(q)
              || (l.folioCorto||"").toLowerCase().includes(q)
              || (l.lote||"").toLowerCase().includes(q)
              || (l.propietario||"").toLowerCase().includes(q)
              || (l.ejido||"").toLowerCase().includes(q);
          });
          return (
            <>
              <input className="form-input" value={busqLote} onChange={e=>setBusqLote(e.target.value)}
                placeholder="🔍 Buscar por apodo, propietario, folio..." style={{marginBottom:6,fontSize:12}}/>
              <div style={{border:"1px solid #ddd5c0",borderRadius:8,background:"white",maxHeight:180,overflowY:"auto",padding:"4px"}}>
                {lotesFiltrados.length===0&&<div style={{padding:"10px",fontSize:12,color:"#8a8070",textAlign:"center"}}>Sin resultados</div>}
                {lotesFiltrados.map(l=>{
                  const sel = loteIds.includes(String(l.id));
                  return (
                    <label key={l.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:6,cursor:"pointer",background:sel?"#f0f8e8":"transparent",marginBottom:1}}>
                      <input type="checkbox" checked={sel}
                        onChange={e=>{
                          const prev = Array.isArray(form.loteIds) ? form.loteIds : (form.loteId?[String(form.loteId)]:[]);
                          const next = e.target.checked ? [...prev,String(l.id)] : prev.filter(x=>x!==String(l.id));
                          setForm(f=>({...f, loteIds:next, loteId:next[0]||""}));
                        }}
                        style={{accentColor:"#2d5a1b",width:14,height:14,flexShrink:0}}/>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:sel?600:400,color:sel?"#2d5a1b":"#3d3525"}}>{nomLoteDisplay(l)}</div>
                        {l.propietario&&<div style={{fontSize:10,color:"#8a8070",marginTop:1}}>👤 {l.propietario}</div>}
                      </div>
                    </label>
                  );
                })}
              </div>
              {loteIds.length>0&&(
                <div style={{fontSize:11,color:"#2d5a1b",marginTop:4,display:"flex",gap:4,flexWrap:"wrap"}}>
                  ✅ {loteIds.length} lote{loteIds.length>1?"s":""} seleccionado{loteIds.length>1?"s":""}:
                  {loteIds.slice(0,3).map(id=>{
                    const l=lotesEnCiclo.find(x=>String(x.id)===String(id));
                    return l?<span key={id} style={{background:"#d4edda",padding:"1px 6px",borderRadius:10,fontSize:10}}>{l.apodo&&l.apodo!=="NO DEFINIDO"?l.apodo:l.folioCorto||`#${id}`}</span>:null;
                  })}
                  {loteIds.length>3&&<span style={{fontSize:10,color:"#8a8070"}}>+{loteIds.length-3} más</span>}
                </div>
              )}
            </>
          );
        })()}
      </div>
      {/* Operador — ligado al catálogo */}
      <div className="form-group">
        <label className="form-label">Operador / Responsable</label>
        {!nuevoOp ? (
          <div style={{display:"flex",gap:6}}>
            <select className="form-select" style={{flex:1}} value={form.operadorId||""}
              onChange={e=>{
                if(e.target.value==="__nuevo__"){setNuevoOp(true);return;}
                const op=(state.operadores||[]).find(o=>String(o.id)===String(e.target.value));
                setForm(f=>({...f, operadorId:e.target.value, operador:op?.nombre||""}));
              }}>
              <option value="">— Seleccionar —</option>
              {(state.operadores||[]).filter(o=>o.activo).map(o=>(
                <option key={o.id} value={o.id}>{o.nombre} · {o.puesto}</option>
              ))}
              <option value="__nuevo__">＋ Agregar nuevo operador...</option>
            </select>
          </div>
        ) : (
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <input className="form-input" style={{flex:1}} value={nomNuevoOp}
              onChange={e=>setNomNuevoOp(e.target.value)}
              placeholder="Nombre del nuevo operador" autoFocus/>
            <button type="button" className="btn btn-primary btn-sm" onClick={agregarOperador}>✓ Agregar</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={()=>{setNuevoOp(false);setNomNuevoOp("");}}>✕</button>
          </div>
        )}
      </div>
      {/* Maquinaria */}
      <div className="form-group">
        <label className="form-label">🚜 Maquinaria usada</label>
        <select className="form-select" value={form.maquinariaId||""}
          onChange={e=>setForm(f=>({...f,maquinariaId:e.target.value,tractorId:e.target.value}))}>
          <option value="">— Ninguna / No aplica —</option>
          {maquinaria.map(m=><option key={m.id} value={m.id}>🚜 {m.nombre} ({m.tipo})</option>)}
        </select>
      </div>
      {/* Fecha y horas */}
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Fecha *</label>
          <input className="form-input" type="date" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))}/>
        </div>
        <div className="form-group">
          <label className="form-label">⏱ Horas de uso
            <span style={{fontSize:10,color:T.fog,fontWeight:400,marginLeft:6}}>se registra en maquinaria automáticamente</span>
          </label>
          <input className="form-input" type="number" step="0.5" min="0"
            value={form.horas||""} onChange={e=>setForm(f=>({...f,horas:e.target.value}))}
            placeholder="0.0" disabled={!form.maquinariaId}
            style={{opacity:form.maquinariaId?1:0.5}}/>
        </div>
      </div>
    </>
    );
  };

  const FotoUpload = ({ form, setForm }) => (
    <div className="form-group">
      <label className="form-label">📷 Foto comprobante (opcional)</label>
      <div style={{display:"flex",gap:10,alignItems:"center"}}>
        <button type="button" onClick={()=>fileRef.current?.click()}
          style={{padding:"8px 14px",border:`2px dashed ${T.line}`,borderRadius:8,background:T.mist,cursor:"pointer",fontSize:13,color:T.fog}}>
          {fotoPreview?"✅ Foto cargada":"Subir foto"}
        </button>
        {fotoPreview && <button type="button" onClick={()=>{setFotoPreview(null);setForm(f=>({...f,fotoData:null,foto:null}));}} style={{border:"none",background:"none",color:T.rust,cursor:"pointer",fontSize:13}}>✕ Quitar</button>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>handleFoto(e,setForm)}/>
      {fotoPreview && <img src={fotoPreview} alt="preview" style={{marginTop:8,maxWidth:"100%",maxHeight:180,borderRadius:8,objectFit:"cover"}}/>}
    </div>
  );

  return (
    <div>
      <AIInsight modulo="Bitácora" contexto={{
        totalRegistros: bitacora?.length || 0,
        ultimosTipos: bitacora?.slice(0,5)?.map(b => b.tipo) || [],
      }} />

      {/* Botones de acción rápida — grid explícito 2 cols en móvil */}
      <div className="bitacora-tipos" style={{
        display: isMobile ? "grid" : "flex",
        gridTemplateColumns: isMobile ? "1fr 1fr" : undefined,
        gap:10,
        flexWrap: isMobile ? undefined : "wrap",
        marginBottom:20,
        width: isMobile ? "100%" : undefined,
      }}>
        {TIPOS.map(t=>(
          <button key={t.id} onClick={()=>{setFotoPreview(null);setTipoModal(t.id);}}
            style={{
              display:"flex",
              alignItems:"center",
              justifyContent: isMobile ? "center" : "flex-start",
              gap:8,
              padding: isMobile ? "14px 12px" : "10px 16px",
              minHeight: isMobile ? 56 : undefined,
              width: isMobile ? "100%" : undefined,
              background:T.card,
              border:`1.5px solid ${t.color}`,
              borderRadius:10,
              cursor:"pointer",
              fontSize: isMobile ? 13 : 13,
              fontWeight:600,
              color:t.color,
              transition:"all 0.15s",
              touchAction:"manipulation",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            onMouseOver={e=>{e.currentTarget.style.background=`${t.color}12`}}
            onMouseOut={e=>{e.currentTarget.style.background=T.card}}>
            <span style={{fontSize:18,flexShrink:0}}>{t.icon}</span><span style={{overflow:"hidden",textOverflow:"ellipsis"}}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Import Button + Panel */}
      <div style={{marginBottom:12}}>
        <input type="file" accept=".xlsx,.xls" ref={fileImportBitRef}
          style={{display:"none"}} onChange={importarBitacora}/>
        <button className="btn btn-secondary"
          onClick={()=>{setShowImportBit(s=>!s);setImportLogBit([]);}}
          style={{fontSize:12,padding:"6px 14px",borderRadius:8,
            border:"1px solid #2d5a1b",color:"#2d5a1b",background:"#f0f8e8"}}>
          {"📥 Importar Bitácora Excel"}
        </button>
        {showImportBit&&(
          <div style={{marginTop:10,padding:"14px 16px",background:"#f9fdf6",
            border:"1px solid #c8e0b0",borderRadius:10}}>
            <div style={{fontWeight:700,fontSize:13,color:"#2d5a1b",marginBottom:8}}>
              {"📥 Importar desde plantilla Excel"}
            </div>
            <div style={{fontSize:11,color:"#5a7a5a",marginBottom:10,lineHeight:1.6}}>
              {"Usa la plantilla oficial (hoja BITACORA). Cada fila = un registro."}<br/>
              {"Tipos válidos: "}<code>{"insumo | diesel | riego | fenol | reporte"}</code>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              <button className="btn btn-primary"
                onClick={()=>fileImportBitRef.current?.click()}
                disabled={importandoBit}
                style={{fontSize:12}}>
                {importandoBit?"⏳ Procesando...":"📂 Seleccionar archivo .xlsx"}
              </button>
            </div>
            {importLogBit.length>0&&(
              <div style={{marginTop:12,padding:"10px 14px",background:"white",
                borderRadius:8,border:"1px solid #ddd5c0"}}>
                {importLogBit.map((l,i)=>(
                  <div key={i} style={{fontSize:11,marginBottom:3,
                    color:l.startsWith("❌")?"#c0392b":l.startsWith("⚠️")?"#e67e22":"#2d5a1b"}}>
                    {l}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filtros */}
      <div style={{
        display: isMobile ? "grid" : "flex",
        gridTemplateColumns: isMobile ? "1fr" : undefined,
        gap: isMobile ? 10 : 8,
        marginBottom:16,
        flexWrap:"wrap",
        alignItems: isMobile ? "stretch" : "center"
      }}>
        <select className="form-select" style={{width: isMobile ? "100%" : 180, minHeight: isMobile ? 48 : undefined, fontSize: isMobile ? 16 : undefined}} value={filtroLote} onChange={e=>setFiltroLote(e.target.value)}>
          <option value="">Todos los lotes</option>
          {(()=>{
            const zonas=[...new Set((state.lotes||[]).map(l=>l.apodo&&l.apodo!=="NO DEFINIDO"?l.apodo:(l.lote||("Lote #"+l.id))))].sort();
            return zonas.map(z=>(<option key={z} value={"zona:"+z}>{z}</option>));
          })()}
        </select>
        <select className="form-select" style={{width: isMobile ? "100%" : 180, minHeight: isMobile ? 48 : undefined, fontSize: isMobile ? 16 : undefined}} value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {TIPOS.map(t=><option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
        </select>
        <span style={{fontSize:12,color:T.fog,marginLeft: isMobile ? 0 : 4}}>{bitacora.length} registro{bitacora.length!==1?"s":""}</span>
      </div>

      {/* Feed */}
      {bitacora.length===0 ? (
        <div className="card empty-state">
          <div className="empty-icon">📋</div>
          <div className="empty-title">Sin registros</div>
          <div className="empty-sub">Usa los botones de arriba para registrar actividades de campo</div>
        </div>
      ) : (
        <div>{bitacora.map(renderCard)}</div>
      )}

      {/* ── MODALES POR TIPO ── */}

      {tipoModal==="insumo" && (
        <Modal title="🌱 Aplicación de Insumos" onClose={()=>setTipoModal(null)}
          footer={<><button className="btn btn-secondary" onClick={()=>setTipoModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={saveInsumo}>💾 Guardar</button></>}>
          <CamposBase form={formInsumo} setForm={setFormInsumo}/>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Producto *</label>
              <input className="form-input" value={formInsumo.producto} onChange={e=>setFormInsumo(f=>({...f,producto:e.target.value}))} placeholder="Nombre del insumo aplicado"/>
            </div>
            <div className="form-group">
              <label className="form-label">Insumo del catálogo (opcional — genera salida automática)</label>
              <select className="form-select" value={formInsumo.insumoId} onChange={e=>{
                const invItem = (state.inventario?.items||[]).find(i=>i.id===parseInt(e.target.value));
                const insItem = state.insumos.find(i=>i.id===parseInt(e.target.value));
                const item = invItem || insItem;
                setFormInsumo(f=>({...f, insumoId:e.target.value,
                  producto: item ? (item.nombre||item.insumo||f.producto) : f.producto,
                  unidad: item?.unidad ? item.unidad+"/ha" : f.unidad
                }));
              }}>
                <option value="">— Sin vincular al inventario —</option>
                {(state.inventario?.items||[]).map(i=>{
                  const entradas = (state.inventario?.movimientos||[]).filter(m=>m.itemId===i.id&&m.tipo==="entrada").reduce((s,m)=>s+(parseFloat(m.cantidad)||0),0);
                  const salidas  = (state.inventario?.movimientos||[]).filter(m=>m.itemId===i.id&&m.tipo==="salida").reduce((s,m)=>s+(parseFloat(m.cantidad)||0),0);
                  const stock = entradas - salidas;
                  return <option key={i.id} value={i.id}>{i.nombre} — Stock: {stock.toFixed(1)} {i.unidad}</option>;
                })}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Dosis</label>
              <input className="form-input" value={formInsumo.dosis} onChange={e=>setFormInsumo(f=>({...f,dosis:e.target.value}))} placeholder="ej. 2.5"/>
            </div>
            <div className="form-group">
              <label className="form-label">Unidad</label>
              <select className="form-select" value={formInsumo.unidad} onChange={e=>setFormInsumo(f=>({...f,unidad:e.target.value}))}>
                {["L/ha","kg/ha","g/ha","sacos/ha","ton/ha","mL/ha"].map(u=><option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Ha aplicadas</label>
              <input className="form-input" type="number" value={formInsumo.haAplicadas} onChange={e=>setFormInsumo(f=>({...f,haAplicadas:e.target.value}))} placeholder="0"/>
            </div>
            {formInsumo.dosis&&formInsumo.haAplicadas&&(
              <div style={{padding:"8px 12px",background:"#f0f8e8",borderRadius:6,fontSize:12,color:"#2d5a1b",fontWeight:600,alignSelf:"flex-end",marginBottom:8}}>
                Total: {((parseFloat(formInsumo.dosis)||0)*(parseFloat(formInsumo.haAplicadas)||0)).toFixed(2)} {formInsumo.unidad.replace("/ha","")}
                {formInsumo.insumoId?" → salida automática de inventario":""}
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Notas adicionales</label>
            <textarea className="form-textarea" value={formInsumo.notas} onChange={e=>setFormInsumo(f=>({...f,notas:e.target.value}))} rows={2}/>
          </div>
          <FotoUpload form={formInsumo} setForm={setFormInsumo}/>
        </Modal>
      )}

      {tipoModal==="diesel" && (
        <Modal title="⛽ Consumo de Diesel" onClose={()=>setTipoModal(null)}
          footer={<><button className="btn btn-secondary" onClick={()=>setTipoModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={saveDiesel}>💾 Guardar</button></>}>
          <CamposBase form={formDiesel} setForm={setFormDiesel}/>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tractor / Equipo</label>
              <select className="form-select" value={formDiesel.tractorId} onChange={e=>setFormDiesel(f=>({...f,tractorId:e.target.value}))}>
                <option value="">— Seleccionar —</option>
                {(state.maquinaria||[]).map(m=><option key={m.id} value={m.nombre}>{m.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Litros *</label>
              <input className="form-input" type="number" value={formDiesel.litros} onChange={e=>setFormDiesel(f=>({...f,litros:e.target.value}))} placeholder="0"/>
            </div>
            <div className="form-group">
              <label className="form-label">$/Litro</label>
              <input className="form-input" type="number" value={formDiesel.precioLitro} onChange={e=>setFormDiesel(f=>({...f,precioLitro:e.target.value}))}/>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Actividad realizada</label>
            <input className="form-input" value={formDiesel.actividad} onChange={e=>setFormDiesel(f=>({...f,actividad:e.target.value}))} placeholder="ej. Rastreo, Siembra, Fertilización..."/>
          </div>
          {formDiesel.litros && <div style={{padding:"10px 14px",background:T.mist,borderRadius:8,fontSize:13,marginBottom:8}}><span style={{color:T.fog}}>Importe: </span><strong style={{color:"#e67e22"}}>{mxn((parseFloat(formDiesel.litros)||0)*(parseFloat(formDiesel.precioLitro)||27))}</strong></div>}
          <div className="form-group">
            <label className="form-label">Notas</label>
            <textarea className="form-textarea" value={formDiesel.notas} onChange={e=>setFormDiesel(f=>({...f,notas:e.target.value}))} rows={2}/>
          </div>
          <FotoUpload form={formDiesel} setForm={setFormDiesel}/>
        </Modal>
      )}

      {tipoModal==="riego" && (
        <Modal title="💧 Riego" onClose={()=>setTipoModal(null)}
          footer={<><button className="btn btn-secondary" onClick={()=>setTipoModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={saveRiego}>💾 Guardar</button></>}>
          <CamposBase form={formRiego} setForm={setFormRiego}/>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tipo de riego</label>
              <select className="form-select" value={formRiego.tipoRiego} onChange={e=>setFormRiego(f=>({...f,tipoRiego:e.target.value}))}>
                {["Gravedad","Goteo","Aspersión","Bombeo","Rodado"].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Horas de riego</label>
              <input className="form-input" type="number" value={formRiego.horasRiego} onChange={e=>setFormRiego(f=>({...f,horasRiego:e.target.value}))} placeholder="0"/>
            </div>
            <div className="form-group">
              <label className="form-label">Volumen (m³)</label>
              <input className="form-input" type="number" value={formRiego.volumenM3} onChange={e=>setFormRiego(f=>({...f,volumenM3:e.target.value}))} placeholder="0"/>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notas</label>
            <textarea className="form-textarea" value={formRiego.notas} onChange={e=>setFormRiego(f=>({...f,notas:e.target.value}))} rows={2}/>
          </div>
          <FotoUpload form={formRiego} setForm={setFormRiego}/>
        </Modal>
      )}

      {tipoModal==="fenol" && (
        <Modal title="🌿 Lectura Fenológica" onClose={()=>setTipoModal(null)}
          footer={<><button className="btn btn-secondary" onClick={()=>setTipoModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={saveFenol}>💾 Guardar</button></>}>
          <CamposBase form={formFenol} setForm={setFormFenol}/>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Estado fenológico *</label>
              <select className="form-select" value={formFenol.fenologia} onChange={e=>setFormFenol(f=>({...f,fenologia:e.target.value}))}>
                {ESTADOS_FENOL.map(e=><option key={e}>{e}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Observación del cultivo</label>
            <textarea className="form-textarea" value={formFenol.observacion} onChange={e=>setFormFenol(f=>({...f,observacion:e.target.value}))} placeholder="¿Cómo se ve el cultivo? Plagas, enfermedades, color, altura..." rows={3}/>
          </div>
          <div className="form-group">
            <label className="form-label">Notas adicionales</label>
            <textarea className="form-textarea" value={formFenol.notas} onChange={e=>setFormFenol(f=>({...f,notas:e.target.value}))} rows={2}/>
          </div>
          <FotoUpload form={formFenol} setForm={setFormFenol}/>
        </Modal>
      )}

      {tipoModal==="reporte" && (
        <Modal title="📝 Reporte Diario" onClose={()=>setTipoModal(null)}
          footer={<><button className="btn btn-secondary" onClick={()=>setTipoModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={saveReporte}>💾 Guardar</button></>}>
          <CamposBase form={formReporte} setForm={setFormReporte} required={false}/>
          <div className="form-group">
            <label className="form-label">Título del reporte *</label>
            <input className="form-input" value={formReporte.titulo} onChange={e=>setFormReporte(f=>({...f,titulo:e.target.value}))} placeholder="ej. Actividades del día 10 de marzo"/>
          </div>
          <div className="form-group">
            <label className="form-label">Descripción / Actividades realizadas</label>
            <textarea className="form-textarea" value={formReporte.descripcion} onChange={e=>setFormReporte(f=>({...f,descripcion:e.target.value}))} placeholder="Describe las actividades, observaciones, incidentes, acuerdos..." rows={5}/>
          </div>
          <FotoUpload form={formReporte} setForm={setFormReporte}/>
        </Modal>
      )}

      {tipoModal==="foto" && (
        <Modal title="📷 Foto / Comprobante" onClose={()=>setTipoModal(null)}
          footer={<><button className="btn btn-secondary" onClick={()=>setTipoModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={saveFoto}>💾 Guardar</button></>}>
          <CamposBase form={formFoto} setForm={setFormFoto} required={false}/>
          <div className="form-group">
            <label className="form-label">Descripción de la foto *</label>
            <input className="form-input" value={formFoto.descripcion} onChange={e=>setFormFoto(f=>({...f,descripcion:e.target.value}))} placeholder="¿Qué muestra esta foto?"/>
          </div>
          <div className="form-group">
            <label className="form-label">Notas</label>
            <textarea className="form-textarea" value={formFoto.notas} onChange={e=>setFormFoto(f=>({...f,notas:e.target.value}))} rows={2}/>
          </div>
          <FotoUpload form={formFoto} setForm={setFormFoto}/>
          {!formFoto.fotoData && <div style={{padding:"10px 14px",background:"#fff3cd",borderRadius:8,fontSize:12,color:"#856404"}}>⚠️ Se requiere foto para este registro</div>}
        </Modal>
      )}
    </div>
  );
}
