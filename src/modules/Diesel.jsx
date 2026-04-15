// ─── modules/Diesel.jsx ───────────────────────────────────────────

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
import { useIsMobile } from '../components/mobile/useIsMobile.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../core/supabase.js';
import AIInsight from '../components/AIInsight.jsx';


export default function DieselModule({ userRol, puedeEditar, navFiltro = {} }) {
  const { state, dispatch } = useData();
  const isMobile = useIsMobile();
  // Visibilidad de precios: encargado e ingeniero NO ven importes.
  const verPrecios = userRol === "admin" || userRol === "compras";
  const puedeRegistrar = userRol === "admin" || userRol === "compras";
  const hoy = new Date().toISOString().split("T")[0];
  const productores = state.productores || [];

  const [vista, setVista] = useState(navFiltro.productor ? (navFiltro.vista || "tabla") : (navFiltro.vista || "resumen"));
  const [cancelModal, setCancelModal]         = useState(null);
  const [recibirDieselModal, setRecibirDieselModal] = useState(null);
  const hoyDie = new Date().toISOString().split("T")[0];
  const emptyRecepDie = { litros:"", fecha:hoyDie, notas:"" };
  const [formRecepDie, setFormRecepDie]       = useState(emptyRecepDie);
  const [filtroCancelados, setFiltroCancelados] = useState("activos");
  const [filtroProd,       setFiltroProd]       = useState(navFiltro.productor || "todos");
  const [filtroTipoMov,    setFiltroTipoMov]    = useState("todos");
  const [filtroActividad,  setFiltroActividad]  = useState("");
  const [importLog, setImportLog]             = useState([]);
  const [importando, setImportando]           = useState(false);
  const fileInputRef = useRef(null);

  const guardarRecepcionDiesel = () => {
    if (!formRecepDie.litros || !recibirDieselModal) return;
    const litrosRec = parseFloat(formRecepDie.litros)||0;
    // Buscar o crear producto Diesel en catálogo de inventario
    const invItems = state.inventario?.items||[];
    const existing = invItems.find(i=>(i.nombre||"").toUpperCase().includes("DIESEL")||(i.categoria||"")==="Combustible");
    let itemId = existing ? existing.id : Date.now();
    if (!existing) {
      dispatch({ type:"ADD_INV_ITEM", payload:{
        id: itemId, nombre:"Diesel y Combustible",
        categoria:"Combustible", unidad:"L",
        ubicacion:"Tanque", descripcion:"Creado automáticamente",
      }});
    }
    dispatch({ type:"RECIBIR_DIESEL", payload:{
      dieselId: recibirDieselModal.id,
      invItemId: itemId,
      litros:   litrosRec,
      fecha:    formRecepDie.fecha,
      notas:    formRecepDie.notas,
    }});
    setRecibirDieselModal(null);
    setFormRecepDie(emptyRecepDie);
  };

  const emptyForm = {
    numSolicitud:"", numOrden:"", fechaSolicitud: hoy, fechaOrden: hoy,
    productorId:"", proveedor:"AUTO SERVICIO LA PIEDRERA SA DE C V",
    insumo:"TARJETA DIESEL", cantidad:"", unidad:"LT",
    ieps:"SIN IEPS", importe:"", esAjuste: false, notas:"",
    tipoMovimiento:"entrada",
  };
  const [form, setForm] = useState(emptyForm);

  const cicloFiltroId = state.cicloActivoId||1;
  const diesel = (state.diesel||[]).filter(d=>(d.cicloId||1)===cicloFiltroId);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const mxnFmt = n => (parseFloat(n)||0).toLocaleString("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:2,maximumFractionDigits:2});
  const nomProd = id => {
    if (!id) return "General";
    const p = productores.find(x=>x.id===parseInt(id)||x.id===id);
    return p ? (p.alias||p.apPat) : `Prod#${id}`;
  };

  // ── Totales (excluir cancelados y ajustes para litros) ───────────────────────
  const dieselActivo    = diesel.filter(d => !d.cancelado);
  const totalLitros     = dieselActivo.filter(d=>!d.esAjuste).reduce((s,d)=>s+(parseFloat(d.cantidad)||0),0);
  const totalImporte    = (dieselActivo||[]).reduce((s,d)=>s+(parseFloat(d.importe)||0),0);
  const totalAjustes    = dieselActivo.filter(d=>d.esAjuste).reduce((s,d)=>s+(parseFloat(d.importe)||0),0);
  const precioPromedio  = totalLitros>0 ? totalImporte/totalLitros : 0;

  // ── Inventario del cilindro (5,000L) ──
  // TODO Supabase: campo tipo_movimiento agregado vía migration (2026-04-14).
  // Registros viejos sin tipo_movimiento: fallback usando esAjuste (true → entrada, false → salida_interna)
  const CILINDRO_CAPACIDAD = 5000;
  const tipoMov = (d) => d.tipoMovimiento || d.tipo_movimiento || (d.esAjuste ? 'entrada' : 'salida_interna');
  const entradas = dieselActivo.filter(d => tipoMov(d) === 'entrada').reduce((s,d)=>s+(parseFloat(d.cantidad)||0),0);
  const salidasInternas = dieselActivo.filter(d => tipoMov(d) === 'salida_interna').reduce((s,d)=>s+(parseFloat(d.cantidad)||0),0);
  const saldoCilindro = Math.max(0, entradas - salidasInternas);
  const nivelPct = Math.min(100, (saldoCilindro / CILINDRO_CAPACIDAD) * 100);
  const saldoColor = saldoCilindro > 1000 ? '#15803D' : saldoCilindro >= 200 ? '#f59e0b' : '#ef4444';
  const ultimaCarga = [...dieselActivo]
    .filter(d => tipoMov(d) === 'entrada')
    .sort((a,b) => String(b.fechaSolicitud||'').localeCompare(String(a.fechaSolicitud||'')))[0];
  const hasCiclo        = (state.ciclos||[]).find(c=>c.id===state.cicloActivoId)||(state.ciclos||[]).find(c=>c.id===state.cicloActivoId)||(state.ciclos||[]).find(c=>c.predeterminado);
  const hasTotales      = (hasCiclo?.asignaciones||[]).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);

  // ── Filtrado tabla ────────────────────────────────────────────────────────────
  const dieselFiltrado = diesel
    .filter(d => filtroCancelados==="todos" ? true : filtroCancelados==="cancelados" ? d.cancelado : !d.cancelado)
    .filter(d => filtroTipoMov==="todos" || tipoMov(d)===filtroTipoMov)
    .filter(d => filtroProd==="todos" || String(d.productorId)===String(filtroProd))
    .filter(d => !filtroActividad || (d.unidad||"").toLowerCase().includes(filtroActividad.toLowerCase()) || (d.concepto||"").toLowerCase().includes(filtroActividad.toLowerCase()) || (d.numSolicitud||"").includes(filtroActividad));

  // ── Guardar registro manual ───────────────────────────────────────────────────
  const guardarRegistro = async () => {
    const importe  = parseFloat(form.importe)||0;
    const cantidad = parseFloat(form.cantidad)||0;
    const esSalidaInterna = form.tipoMovimiento === 'salida_interna';
    // Validar saldo antes de salida interna
    if (esSalidaInterna) {
      if (saldoCilindro <= 0) {
        alert('El cilindro está vacío. Contacta a compras para reabastecer.');
        return;
      }
      if (cantidad > saldoCilindro) {
        alert(`No hay suficiente diesel en el cilindro. Saldo actual: ${saldoCilindro.toLocaleString('es-MX')} L`);
        return;
      }
    }
    // Salida interna (cilindro → tractor): no requiere importe
    if (!esSalidaInterna && !importe) return;
    if (!form.fechaSolicitud) return;

    const nuevoReg = {
      ...form, id: Date.now(),
      cantidad, importe: esSalidaInterna ? 0 : importe,
      productorId: form.productorId ? parseInt(form.productorId)||form.productorId : null,
      esAjuste: form.esAjuste || (!esSalidaInterna && cantidad===0),
      tipoMovimiento: form.tipoMovimiento || 'entrada',
    };

    // POST a Supabase (dispara realtime para otros usuarios)
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/diesel`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          fecha: nuevoReg.fechaSolicitud || nuevoReg.fecha,
          fecha_solicitud: nuevoReg.fechaSolicitud || null,
          fecha_orden: nuevoReg.fechaOrden || null,
          cantidad: nuevoReg.cantidad,
          litros_recibidos: esSalidaInterna ? nuevoReg.cantidad : 0,
          precio_litro: parseFloat(nuevoReg.precioLitro) || 0,
          importe: nuevoReg.importe || 0,
          proveedor: nuevoReg.proveedor || '',
          productor_nombre: nuevoReg.productorId ? (nomProd(nuevoReg.productorId) || '') : '',
          unidad: nuevoReg.unidad || 'LT',
          ieps: nuevoReg.ieps || 'SIN IEPS',
          num_solicitud: nuevoReg.numSolicitud || '',
          num_orden: nuevoReg.numOrden || '',
          es_ajuste: !!nuevoReg.esAjuste,
          estatus: 'pendiente',
          cancelado: false,
          tipo_movimiento: nuevoReg.tipoMovimiento || 'entrada',
          notas: nuevoReg.notas || '',
        }),
      });
    } catch (e) {
      console.warn('Error guardando diesel en Supabase:', e);
    }

    dispatch({ type:"ADD_DIESEL", payload: nuevoReg });

    // Espejo en Bitácora para salidas internas (consumo en campo)
    if (esSalidaInterna) {
      const maq = (state.maquinaria||[]).find(m=>String(m.id)===String(nuevoReg.maquinariaId));
      dispatch({
        type: 'ADD_BITACORA',
        payload: {
          id: Date.now() + 1,
          tipo: 'diesel',
          fecha: nuevoReg.fechaSolicitud || nuevoReg.fecha,
          loteId: nuevoReg.loteId ? parseInt(nuevoReg.loteId) || nuevoReg.loteId : null,
          loteIds: nuevoReg.loteId ? [parseInt(nuevoReg.loteId) || nuevoReg.loteId] : [],
          operadorId: nuevoReg.operadorId || '',
          operador: (state.operadores||[]).find(o=>String(o.id)===String(nuevoReg.operadorId))?.nombre || '',
          cantidad: nuevoReg.cantidad,
          unidad: 'L',
          maquinariaId: nuevoReg.maquinariaId || '',
          horas: 0,
          notas: `Carga de diesel: ${nuevoReg.cantidad}L — ${maq?.nombre || 'Sin tractor'}`,
          origen: 'diesel_cilindro',
          data: { litros: nuevoReg.cantidad, precioLitro: 0, actividad: 'Carga cilindro' },
        }
      });
    }

    setForm(emptyForm);
    setVista("resumen");
  };

  // ── Importar Excel ────────────────────────────────────────────────────────────
  const cargarXLSX = () => new Promise((resolve, reject) => {
    if (window.XLSX) { resolve(window.XLSX); return; }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.onload = () => resolve(window.XLSX);
    script.onerror = () => reject(new Error("No se pudo cargar XLSX"));
    document.head.appendChild(script);
  });

  const importarExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportando(true);
    setImportLog(["⏳ Cargando..."]);
    try {
      const XLSX  = await cargarXLSX();
      const ab    = await file.arrayBuffer();
      const wb    = XLSX.read(new Uint8Array(ab), { type:"array", cellDates:true });
      const ws    = wb.Sheets[wb.SheetNames[0]];
      const rows  = XLSX.utils.sheet_to_json(ws, { defval:"", raw:false });

      const logs  = [];
      logs.push(`📋 Columnas: ${Object.keys(rows[0]||{}).join(" | ")}`);

      const getCol = (row,...keys) => {
        for (const k of keys){
          if (row[k]!==undefined&&row[k]!=="") return String(row[k]).trim();
          const fnd=Object.keys(row).find(c=>c.toUpperCase().replace(/[^A-Z0-9]/g,"").includes(k.toUpperCase().replace(/[^A-Z0-9]/g,"")));
          if(fnd&&row[fnd]!=="") return String(row[fnd]).trim();
        }
        return "";
      };

      const nuevos = [];
      let ajustes = 0;
      rows.forEach((row,i)=>{
        const numSol  = getCol(row,"# SOLICITUD","SOLICITUD");
        if (!numSol) return;
        const prodNom = getCol(row,"PRODUCTOR");
        const prodMatch = productores.find(p=>{
          const nom = `${p.apPat||""} ${p.apMat||""} ${p.nombres||""}`.toUpperCase().trim();
          const alias = (p.alias||"").toUpperCase().trim();
          const pNom = prodNom.toUpperCase().trim();
          return nom===pNom || alias===pNom || (p.apPat&&pNom.startsWith(p.apPat.toUpperCase())) || nom.split(" ").some(w=>w.length>4&&pNom.includes(w));
        });
        const cantidad = parseFloat(getCol(row,"CANTIDAD").replace(/,/g,""))||0;
        const importe  = parseFloat(getCol(row,"IMPORTE","TOTAL").replace(/[,$]/g,""))||0;
        const esAjuste = cantidad === 0;
        if (esAjuste) ajustes++;
        nuevos.push({
          id: Date.now()+i,
          numSolicitud:  numSol,
          numOrden:      getCol(row,"# ORDEN","ORDEN"),
          fechaSolicitud:getCol(row,"FECHA SOLICITUD","FECHA"),
          fechaOrden:    getCol(row,"FECHA ORDEN"),
          productorId:   prodMatch?.id||null,
          productorNombre: prodNom,
          proveedor:     getCol(row,"EMPRESA","PROVEEDOR"),
          insumo:        getCol(row,"INSUMO")||"TARJETA DIESEL",
          ieps:          getCol(row,"IEPS")||"SIN IEPS",
          cantidad, unidad: getCol(row,"UNIDAD")||"LT",
          importe, esAjuste, notas:"",
        });
      });

      dispatch({ type:"IMPORT_DIESEL", payload: nuevos });
      const sinMatch = nuevos.filter(n=>!n.productorId).length;
      logs.push(`✅ ${nuevos.length} registros importados`);
      logs.push(`⛽ ${nuevos.length-ajustes} cargas de diesel · 🔧 ${ajustes} ajustes de precio`);
      if (sinMatch>0) logs.push(`⚠️ ${sinMatch} sin productor identificado`);
      setImportLog(logs);
    } catch(err) {
      setImportLog([`❌ Error: ${err.message}`]);
    }
    setImportando(false);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Totales por tipo (para vista simplificada y card del cilindro)
  // ─────────────────────────────────────────────────────────────────────────────
  const salidasExternas = dieselActivo.filter(d => tipoMov(d) === 'salida_externa').reduce((s,d)=>s+(parseFloat(d.cantidad)||0),0);

  // ─────────────────────────────────────────────────────────────────────────────
  // VISTA ENCARGADO — simplificada, solo cilindro + sus cargas
  // ─────────────────────────────────────────────────────────────────────────────
  if (vista==="resumen" && userRol === 'encargado') {
    const misSalidas = [...dieselActivo]
      .filter(d => tipoMov(d) === 'salida_interna' && (parseFloat(d.cantidad) || 0) > 0)
      .sort((a,b)=>String(b.fechaSolicitud||'').localeCompare(String(a.fechaSolicitud||'')))
      .slice(0,10);
    const nomMaq = id => (state.maquinaria||[]).find(m=>String(m.id)===String(id))?.nombre || '—';
    return (
      <div>
        <AIInsight modulo="Diesel" contexto={{
          saldoCilindro, entradas, salidasInternas,
        }} />

        {/* Card grande del cilindro */}
        <div style={{
          background:'#ffffff',
          border:'1px solid #e5e7eb',
          borderLeft:`6px solid ${saldoColor}`,
          borderRadius:14,
          padding:'20px 20px 18px',
          marginBottom:16,
          boxShadow:'0 2px 8px rgba(0,0,0,0.08)',
        }}>
          <div style={{fontSize:11,fontWeight:700,color:'#6b7280',letterSpacing:0.8,textTransform:'uppercase',marginBottom:6}}>🛢 Cilindro diesel</div>
          <div style={{fontSize:36,fontWeight:700,color:saldoColor,lineHeight:1}}>
            {saldoCilindro.toLocaleString('es-MX',{maximumFractionDigits:0})}
            <span style={{fontSize:15,fontWeight:500,color:'#6b7280',marginLeft:8}}>/ {CILINDRO_CAPACIDAD.toLocaleString('es-MX')} L</span>
          </div>
          <div style={{height:14,borderRadius:8,background:'#e5e7eb',overflow:'hidden',marginTop:14}}>
            <div style={{height:'100%',width:`${nivelPct}%`,background:saldoColor,transition:'width 300ms ease'}} />
          </div>
          {saldoCilindro < 200 && (
            <div style={{marginTop:10,fontSize:12,color:'#991b1b',fontWeight:600}}>⚠ Cilindro casi vacío. Contacta a compras para reabastecer.</div>
          )}
          {saldoCilindro >= 200 && saldoCilindro <= 1000 && (
            <div style={{marginTop:10,fontSize:12,color:'#92400e',fontWeight:600}}>⚠ Saldo bajo. Considera avisar a compras.</div>
          )}
        </div>

        {/* Botón principal */}
        <button
          onClick={()=>{setForm({...emptyForm,tipoMovimiento:'salida_interna'});setVista("nuevo");}}
          disabled={saldoCilindro<=0}
          style={{
            width:'100%',
            minHeight:56,
            borderRadius:12,
            border:'none',
            background: saldoCilindro>0 ? '#e67e22' : '#9ca3af',
            color:'#ffffff',
            fontSize:17,
            fontWeight:700,
            cursor: saldoCilindro>0 ? 'pointer' : 'not-allowed',
            boxShadow: saldoCilindro>0 ? '0 3px 12px rgba(230,126,34,0.28)' : 'none',
            marginBottom:20,
            touchAction:'manipulation',
          }}
        >
          ＋ Carga de Tractor
        </button>

        {/* Historial simple */}
        <div style={{marginBottom:8,fontSize:11,fontWeight:700,color:'#8a8070',letterSpacing:1,textTransform:'uppercase'}}>
          Últimas cargas
        </div>
        {misSalidas.length === 0 ? (
          <div style={{textAlign:'center',padding:32,color:'#8a8070',fontSize:13,background:'#ffffff',borderRadius:12,border:'1px dashed #e5e7eb'}}>
            Sin cargas registradas
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {misSalidas.map(d => (
              <div key={d.id} style={{
                background:'#ffffff',
                border:'1px solid #e5e7eb',
                borderLeft:'4px solid #e67e22',
                borderRadius:10,
                padding:'12px 14px',
              }}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                  <div style={{fontSize:14,fontWeight:700,color:'#14532D'}}>{d.fechaSolicitud||'—'}</div>
                  <div style={{fontSize:15,fontWeight:700,color:'#e67e22'}}>{parseFloat(d.cantidad||0).toLocaleString('es-MX')} L</div>
                </div>
                <div style={{fontSize:12,color:'#6b7280'}}>🚜 {nomMaq(d.maquinariaId)}</div>
                {d.notas && <div style={{fontSize:11,color:'#6b7280',marginTop:3,fontStyle:'italic'}}>{d.notas}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // VISTA RESUMEN (admin / compras)
  // ─────────────────────────────────────────────────────────────────────────────
  if (vista==="resumen") return (
    <div>
      <AIInsight modulo="Diesel" contexto={{
        totalRegistros: state.diesel?.length || 0,
        totalLitros: (state.diesel||[]).reduce((s,d) => s + (parseFloat(d.cantidad)||0), 0),
        saldoCilindro, entradas, salidasInternas, salidasExternas,
      }} />

      {/* ── Cilindro 5,000L ── */}
      <div style={{
        background:'#ffffff',
        border:'1px solid #e5e7eb',
        borderLeft:`4px solid ${saldoColor}`,
        borderRadius:12,
        padding:'14px 16px',
        marginBottom:16,
        boxShadow:'0 1px 4px rgba(0,0,0,0.06)',
      }}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',marginBottom:10}}>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:'#6b7280',letterSpacing:0.6,textTransform:'uppercase'}}>🛢 Cilindro diesel</div>
            <div style={{fontSize:24,fontWeight:700,color:saldoColor,marginTop:2}}>
              {saldoCilindro.toLocaleString('es-MX',{maximumFractionDigits:0})} <span style={{fontSize:13,fontWeight:500,color:'#6b7280'}}>/ {CILINDRO_CAPACIDAD.toLocaleString('es-MX')} L</span>
            </div>
            {ultimaCarga && (
              <div style={{fontSize:11,color:'#6b7280',marginTop:2}}>
                Última carga: {ultimaCarga.fechaSolicitud} · {parseFloat(ultimaCarga.cantidad||0).toLocaleString('es-MX')} L
              </div>
            )}
          </div>
          {(userRol === 'admin' || userRol === 'encargado') && (
            <button
              onClick={()=>{setForm({...emptyForm,tipoMovimiento:'salida_interna'});setVista("nuevo");}}
              style={{
                minHeight:48,
                padding:'0 16px',
                borderRadius:10,
                border:'none',
                background:'#e67e22',
                color:'#ffffff',
                fontSize:14,
                fontWeight:700,
                cursor:'pointer',
                touchAction:'manipulation',
              }}
            >
              ＋ Carga de tractor
            </button>
          )}
        </div>
        {/* Barra de nivel */}
        <div style={{height:10,borderRadius:6,background:'#e5e7eb',overflow:'hidden'}}>
          <div style={{
            height:'100%',
            width:`${nivelPct}%`,
            background:saldoColor,
            transition:'width 300ms ease',
          }} />
        </div>
        {/* 3 totales por tipo */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginTop:12}}>
          <div style={{textAlign:'center',padding:'6px 4px',background:'#dcfce7',borderRadius:8,border:'1px solid #15803D22'}}>
            <div style={{fontSize:9,fontWeight:700,color:'#15803D',letterSpacing:0.3,textTransform:'uppercase'}}>📥 Entradas</div>
            <div style={{fontSize:14,fontWeight:700,color:'#15803D',marginTop:2,fontFamily:'monospace'}}>{entradas.toLocaleString('es-MX',{maximumFractionDigits:0})} L</div>
          </div>
          <div style={{textAlign:'center',padding:'6px 4px',background:'#fef5ed',borderRadius:8,border:'1px solid #e67e2222'}}>
            <div style={{fontSize:9,fontWeight:700,color:'#e67e22',letterSpacing:0.3,textTransform:'uppercase'}}>🛢 Salidas cil.</div>
            <div style={{fontSize:14,fontWeight:700,color:'#e67e22',marginTop:2,fontFamily:'monospace'}}>{salidasInternas.toLocaleString('es-MX',{maximumFractionDigits:0})} L</div>
          </div>
          <div style={{textAlign:'center',padding:'6px 4px',background:'#fee2e2',borderRadius:8,border:'1px solid #ef444422'}}>
            <div style={{fontSize:9,fontWeight:700,color:'#991b1b',letterSpacing:0.3,textTransform:'uppercase'}}>🏪 Gasolinera</div>
            <div style={{fontSize:14,fontWeight:700,color:'#991b1b',marginTop:2,fontFamily:'monospace'}}>{salidasExternas.toLocaleString('es-MX',{maximumFractionDigits:0})} L</div>
          </div>
        </div>
      </div>

      <div className="stat-grid" style={{gridTemplateColumns: isMobile ? "1fr 1fr" : (verPrecios ? "repeat(4,1fr)" : "1fr"),marginBottom:20}}>
        <div className="stat-card gold">
          <div className="stat-icon">⛽</div>
          <div className="stat-label">Total Litros</div>
          <div className="stat-value">{totalLitros.toLocaleString("es-MX",{maximumFractionDigits:0})}<span className="stat-unit"> L</span></div>
          <div className="stat-sub">{diesel.filter(d=>!d.cancelado&&!d.esAjuste).length} cargas</div>
        </div>
        {verPrecios && (
          <div className="stat-card rust">
            <div className="stat-icon">💵</div>
            <div className="stat-label">Costo Total</div>
            <div className="stat-value" style={{fontSize:18}}>{mxnFmt(totalImporte)}</div>
            <div className="stat-sub">Incl. {mxnFmt(totalAjustes)} ajustes</div>
          </div>
        )}
        {verPrecios && (
          <div className="stat-card green">
            <div className="stat-icon">💲</div>
            <div className="stat-label">Precio Promedio</div>
            <div className="stat-value" style={{fontSize:18}}>${precioPromedio.toFixed(2)}<span className="stat-unit">/L</span></div>
            <div className="stat-sub">Ponderado ciclo</div>
          </div>
        )}
        {verPrecios && (
          <div className="stat-card sky">
            <div className="stat-icon">🌾</div>
            <div className="stat-label">Costo / Ha</div>
            <div className="stat-value" style={{fontSize:18}}>{mxnFmt(hasTotales>0?totalImporte/hasTotales:0)}</div>
            <div className="stat-sub">{hasTotales.toFixed(1)} ha ciclo activo</div>
          </div>
        )}
      </div>

      <div style={{
        display: isMobile ? "grid" : "flex",
        gridTemplateColumns: isMobile ? "1fr" : undefined,
        gap:10,
        marginBottom:20,
        flexWrap:"wrap"
      }}>
        {puedeRegistrar && <button className="btn btn-primary"   onClick={()=>{setForm({...emptyForm,tipoMovimiento:'entrada'});setVista("nuevo");}} style={isMobile?{minHeight:48,width:"100%"}:undefined}>📥 Compra de diesel</button>}
        {puedeRegistrar && <button className="btn btn-secondary" onClick={()=>{setForm({...emptyForm,tipoMovimiento:'salida_externa'});setVista("nuevo");}} style={isMobile?{minHeight:48,width:"100%"}:undefined}>🏪 Gasolinera</button>}
        <button className="btn btn-secondary" onClick={()=>setVista("import")} style={isMobile?{minHeight:48,width:"100%"}:undefined}>📥 Importar Excel</button>
        <button className="btn btn-secondary" onClick={()=>setVista("tabla")} style={isMobile?{minHeight:48,width:"100%"}:undefined}>📋 Ver todos ({diesel.length})</button>
      </div>

      {/* Resumen por productor */}
      <div className="card">
        <div className="card-header"><div className="card-title">Por Productor — {state.cicloActual}</div></div>
        <div className="table-wrap-scroll">
          <table style={{minWidth:600}}>
            <thead><tr>
              <th>Productor</th>
              <th style={{textAlign:"right"}}>Litros</th>
              {verPrecios && <th style={{textAlign:"right"}}>Ajustes</th>}
              {verPrecios && <th style={{textAlign:"right"}}>Total</th>}
              {verPrecios && <th style={{textAlign:"right"}}>$/L prom.</th>}
              <th>Registros</th>
            </tr></thead>
            <tbody>
              {productores.map((p,i)=>{
                const reg = dieselActivo.filter(d=>String(d.productorId)===String(p.id));
                if (reg.length===0) return null;
                const lts  = reg.filter(d=>!d.esAjuste).reduce((s,d)=>s+(parseFloat(d.cantidad)||0),0);
                const imp  = (reg||[]).reduce((s,d)=>s+(parseFloat(d.importe)||0),0);
                const adj  = reg.filter(d=>d.esAjuste).reduce((s,d)=>s+(parseFloat(d.importe)||0),0);
                const prom = lts>0 ? imp/lts : 0;
                const bg   = i%2===0?"white":"#faf8f3";
                return (
                  <tr key={p.id}>
                    <td style={{background:bg}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:p.color}}/>
                        <span style={{fontWeight:600,fontSize:13}}>{p.alias||p.apPat}</span>
                      </div>
                    </td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12}}>{lts>0?lts.toLocaleString("es-MX")+" L":"—"}</td>
                    {verPrecios && <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12,color:"#856404"}}>{adj>0?mxnFmt(adj):"—"}</td>}
                    {verPrecios && <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:700,color:"#c0392b"}}>{mxnFmt(imp)}</td>}
                    {verPrecios && <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12}}>{prom>0?"$"+prom.toFixed(2):"—"}</td>}
                    <td style={{background:bg,fontSize:12,color:"#5a7a3a"}}>{reg.length} reg.</td>
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
  // VISTA TABLA
  // ─────────────────────────────────────────────────────────────────────────────
  if (vista==="tabla") return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <button className="btn btn-secondary" onClick={()=>setVista("resumen")}>← Volver</button>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,flex:1}}>Todos los Registros</div>
        <BtnExport onClick={()=>exportarExcel("Diesel_"+state.cicloActual,[{
          nombre:"Diesel",
          headers:["# Sol","# Orden","Fecha Sol","Productor","Litros","Precio L","Importe","Estatus"],
          rows:dieselFiltrado.map(d=>[
            d.numSolicitud,d.numOrden,d.fechaSolicitud,
            (state.productores||[]).find(p=>String(p.id)===String(d.productorId))?.alias||"",
            d.litros,d.precioPorLitro,parseFloat(d.importe)||0,d.estatus
          ])
        }])}/>
        {puedeRegistrar && <button className="btn btn-primary" onClick={()=>setVista("nuevo")}>＋ Nuevo Registro</button>}
      </div>
      {(()=>{
        const totalLts = dieselFiltrado.filter(d=>!d.esAjuste).reduce((s,d)=>s+(parseFloat(d.cantidad)||0),0);
        const totalImp = dieselFiltrado.reduce((s,d)=>s+(parseFloat(d.importe)||0),0);
        const activeF  = [filtroProd!=="todos",filtroCancelados!=="activos",!!filtroActividad].filter(Boolean).length;
        return (
          <>
          {/* Pills: filtro por tipo de movimiento */}
          <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
            {[
              {id:"todos", label:"Todos", bg:"#f3f4f6", fg:"#374151"},
              {id:"entrada", label:"📥 Entradas", bg:"#dcfce7", fg:"#15803D"},
              {id:"salida_interna", label:"🛢 Salidas cilindro", bg:"#fef5ed", fg:"#e67e22"},
              {id:"salida_externa", label:"🏪 Gasolinera", bg:"#fee2e2", fg:"#991b1b"},
            ].map(opt => {
              const sel = filtroTipoMov === opt.id;
              return (
                <button key={opt.id}
                  onClick={()=>setFiltroTipoMov(opt.id)}
                  style={{
                    padding: isMobile ? "10px 14px" : "6px 12px",
                    minHeight: isMobile ? 44 : undefined,
                    borderRadius: 999,
                    border: `1.5px solid ${sel ? opt.fg : "#d1d5db"}`,
                    background: sel ? opt.bg : "#ffffff",
                    color: sel ? opt.fg : "#6b7280",
                    fontSize: 12,
                    fontWeight: sel ? 700 : 500,
                    cursor: "pointer",
                    touchAction: "manipulation",
                  }}>
                  {opt.label}
                </button>
              );
            })}
          </div>
          <div style={{marginBottom:12}}>
            <div style={{
              display: isMobile ? "grid" : "flex",
              gridTemplateColumns: isMobile ? "1fr" : undefined,
              gap: isMobile ? 10 : 6,
              flexWrap:"wrap",
              marginBottom:6
            }}>
              <select className="form-select" style={{width: isMobile ? "100%" : 170, minHeight: isMobile ? 48 : undefined, fontSize: isMobile ? 16 : undefined}} value={filtroProd} onChange={e=>setFiltroProd(e.target.value)}>
                <option value="todos">Todos los productores</option>
                {productores.map(p=><option key={p.id} value={p.id}>{p.alias||p.apPat}</option>)}
              </select>
              <select className="form-select" style={{width: isMobile ? "100%" : 130, minHeight: isMobile ? 48 : undefined, fontSize: isMobile ? 16 : undefined}} value={filtroCancelados} onChange={e=>setFiltroCancelados(e.target.value)}>
                <option value="activos">✅ Activos</option>
                <option value="cancelados">🚫 Cancelados</option>
                <option value="todos">Todos</option>
              </select>
              <input className="form-input" style={{width: isMobile ? "100%" : 180, minHeight: isMobile ? 48 : undefined, fontSize: isMobile ? 16 : 12}} placeholder="🔍 Tractor / Actividad..."
                value={filtroActividad} onChange={e=>setFiltroActividad(e.target.value)}/>
              {activeF>0&&(
                <button className="btn btn-secondary" style={{fontSize:11,padding:"4px 10px",color:"#c0392b",borderColor:"#c0392b"}}
                  onClick={()=>{setFiltroProd("todos");setFiltroCancelados("activos");setFiltroActividad("");}}>
                  ✕ Limpiar
                </button>
              )}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"7px 14px",background:activeF>0?"#fff3e0":"#f5f4f0",borderRadius:8,border:`1px solid ${activeF>0?"#f0a04b":"#ddd5c0"}`}}>
              <span style={{fontSize:11,color:"#8a8070"}}>{activeF>0?"Filtrado:":"Total:"}</span>
              <span style={{fontFamily:"monospace",fontSize:14,fontWeight:800,color:activeF>0?"#e67e22":"#2d5a1b"}}>{totalLts.toLocaleString("es-MX")} L</span>
              <span style={{fontFamily:"monospace",fontSize:14,fontWeight:700,color:"#c0392b"}}>{mxnFmt(totalImp)}</span>
              <span style={{fontSize:11,color:"#8a8070"}}>{dieselFiltrado.length} registros</span>
              {activeF>0&&(
                <span style={{fontSize:10,color:"#c8a84b"}}>
                  {activeF} filtro{activeF>1?"s":""}
                </span>
              )}
              <div style={{flex:1}}/>
              {activeF>0&&(
                <span style={{fontSize:11,color:"#8a8070"}}>
                  {"Total gral: "+diesel.filter(d=>!d.esAjuste&&!d.cancelado).reduce((s,d)=>s+(parseFloat(d.cantidad)||0),0).toLocaleString("es-MX")+" L"}
                </span>
              )}
            </div>
          </div>
          </>
        );
      })()}
      {isMobile ? (
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
          {dieselFiltrado.sort((a,b)=>String(b.fechaSolicitud).localeCompare(String(a.fechaSolicitud))).map(d=>{
            const opaco = d.cancelado?{opacity:0.55}:{};
            const tmov = tipoMov(d);
            const borderCol = tmov === 'entrada' ? '#15803D' : tmov === 'salida_externa' ? '#ef4444' : '#e67e22';
            const tipoLabel = tmov === 'entrada' ? '📥 Entrada' : tmov === 'salida_externa' ? '🏪 Salida externa' : '🛢 Salida cilindro';
            const tipoBg = tmov === 'entrada' ? '#dcfce7' : tmov === 'salida_externa' ? '#fee2e2' : '#fef5ed';
            const tipoColor = tmov === 'entrada' ? '#15803D' : tmov === 'salida_externa' ? '#991b1b' : '#e67e22';
            return (
              <div key={d.id} style={{
                background:"#ffffff",
                border:"1px solid #e5e7eb",
                borderLeft:`4px solid ${borderCol}`,
                borderRadius:12,
                padding:14,
                boxShadow:"0 1px 4px rgba(0,0,0,0.06)",
                ...opaco,
              }}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:8}}>
                  <div style={{fontSize:18,fontWeight:700,color:"#14532D"}}>{d.fechaSolicitud||"—"}</div>
                  <span style={{fontSize:10,fontWeight:700,padding:"4px 10px",borderRadius:999,
                    background:tipoBg,color:tipoColor}}>
                    {tipoLabel}
                  </span>
                </div>
                <div style={{fontSize:14,color:"#374151",marginBottom:4}}>
                  👤 <strong>{nomProd(d.productorId)}</strong>
                </div>
                {!d.esAjuste && (
                  <div style={{fontSize:16,fontWeight:700,color:"#e67e22",marginBottom:4}}>
                    {parseFloat(d.cantidad).toLocaleString("es-MX")} {d.unidad||"L"}
                  </div>
                )}
                {d.proveedor && (
                  <div style={{fontSize:13,color:"#6b7280"}}>🏪 {d.proveedor}</div>
                )}
                {verPrecios && !d.esAjuste && (
                  <div style={{fontSize:13,color:"#c0392b",fontWeight:600,marginTop:4}}>{mxnFmt(d.importe)}</div>
                )}
                {d.cancelado && <div style={{marginTop:6,fontSize:11,color:"#991b1b",fontWeight:600}}>🚫 Cancelado</div>}
              </div>
            );
          })}
          {dieselFiltrado.length===0 && (
            <div style={{textAlign:"center",padding:32,color:"#8a8070",fontSize:14}}>Sin registros</div>
          )}
        </div>
      ) : (
      <div className="card">
        <div className="table-wrap-scroll">
          <table style={{minWidth:960}}>
            <thead><tr>
              <th>Solicitud</th><th>Orden</th><th>Fecha Sol.</th>
              <th>Productor</th><th>Movimiento</th><th>Tipo</th>
              <th style={{textAlign:"right"}}>Cantidad</th><th>Unidad</th>
              <th>IEPS</th>
              {verPrecios && <th style={{textAlign:"right"}}>Importe</th>}
              {verPrecios && <th style={{textAlign:"right"}}>$/L</th>}
              <th>Proveedor</th><th></th>
            </tr></thead>
            <tbody>
              {dieselFiltrado.sort((a,b)=>String(b.fechaSolicitud).localeCompare(String(a.fechaSolicitud))).map((d,i)=>{
                const bg    = d.cancelado?"#fff0f0":i%2===0?"white":"#faf8f3";
                const style = d.cancelado?{opacity:0.6,textDecoration:"line-through"}:{};
                const pxl   = !d.esAjuste&&parseFloat(d.cantidad)>0 ? parseFloat(d.importe)/parseFloat(d.cantidad) : null;
                return (
                  <tr key={d.id}>
                    <td style={{background:bg,fontFamily:"monospace",fontWeight:700,fontSize:12,...style}}>{d.numSolicitud||"—"}</td>
                    <td style={{background:bg,fontFamily:"monospace",fontSize:12}}>{d.numOrden||"—"}</td>
                    <td style={{background:bg,fontSize:11}}>{d.fechaSolicitud||"—"}</td>
                    <td style={{background:bg,fontWeight:600,fontSize:12}}>{nomProd(d.productorId)}</td>
                    <td style={{background:bg}}>
                      {(() => {
                        const tm = tipoMov(d);
                        const cfg = tm==='entrada' ? {bg:'#dcfce7',fg:'#15803D',lbl:'📥 Entrada'}
                                  : tm==='salida_externa' ? {bg:'#fee2e2',fg:'#991b1b',lbl:'🏪 Gasolinera'}
                                  : {bg:'#fef5ed',fg:'#e67e22',lbl:'🛢 Cilindro'};
                        return <span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:10,background:cfg.bg,color:cfg.fg}}>{cfg.lbl}</span>;
                      })()}
                    </td>
                    <td style={{background:bg}}>
                      {d.esAjuste
                        ? <span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:10,background:"#fff3cd",color:"#856404"}}>🔧 Ajuste</span>
                        : <span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:10,background:"#dbeafe",color:"#1a6ea8"}}>⛽ Carga</span>}
                    </td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12,...style}}>{d.esAjuste?"—":parseFloat(d.cantidad).toLocaleString("es-MX")}</td>
                    <td style={{background:bg,fontSize:11}}>{d.unidad}</td>
                    <td style={{background:bg,fontSize:10,color:"#8a8070"}}>{d.ieps||"—"}</td>
                    {verPrecios && <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:700,color:d.cancelado?"#999":"#c0392b"}}>{mxnFmt(d.importe)}</td>}
                    {verPrecios && <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:11,color:"#5a7a3a"}}>{pxl?"$"+pxl.toFixed(2):"—"}</td>}
                    <td style={{background:bg,fontSize:11,color:"#7a7060",maxWidth:150}}>{d.proveedor}</td>
                    <td style={{background:bg}}>
                      <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                        {!d.cancelado&&!d.esAjuste&&d.estatus!=="recibido"&&puedeEditar&&(
                          <button className="btn btn-sm" style={{fontSize:10,background:"#d4edda",color:"#155724",border:"1px solid #c3e6cb"}}
                            onClick={()=>{setRecibirDieselModal(d);setFormRecepDie({...emptyRecepDie,litros:String((parseFloat(d.cantidad)||0)-(parseFloat(d.litrosRecibidos)||0))});}}>
                            📥 Recibir
                          </button>
                        )}
                        {!d.cancelado&&!d.esAjuste&&(
                          <span style={{fontSize:9,padding:"2px 6px",borderRadius:8,fontWeight:600,
                            background:d.estatus==="recibido"?"#d4edda":d.estatus==="parcial"?"#fff3cd":"#e2e3e5",
                            color:d.estatus==="recibido"?"#155724":d.estatus==="parcial"?"#856404":"#383d41"}}>
                            {d.estatus==="recibido"
                              ? "✅ En tanque"
                              : d.estatus==="parcial"
                              ? `⏳ ${(parseFloat(d.litrosRecibidos)||0).toLocaleString()}/${(parseFloat(d.cantidad)||0).toLocaleString()} L`
                              : "📋 Pedido"}
                          </span>
                        )}
                        {d.cancelado&&<BadgeCancelado registro={d}/>}
                        {d.cancelado
                          ?(puedeEditar&&<button className="btn btn-sm btn-secondary" style={{fontSize:11}} onClick={()=>setCancelModal({action:"reactivar",tabla:"diesel",rec:d})}>↺</button>)
                          :(puedeEditar&&<button className="btn btn-sm" style={{fontSize:11,background:"#fff3cd",color:"#856404",border:"1px solid #ffc107"}} onClick={()=>setCancelModal({action:"cancelar",tabla:"diesel",rec:d})}>🚫</button>)
                        }
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}
      {cancelModal&&(
        cancelModal.action==="cancelar"
        ?<ModalCancelacion titulo={`Sol.${cancelModal.rec?.numSolicitud||"?"}`} onCerrar={()=>setCancelModal(null)}
            onConfirmar={({motivo,comentario})=>{dispatch({type:"CANCELAR_REGISTRO",payload:{tabla:"diesel",id:cancelModal.rec.id,motivo,comentario,canceladoPor:"admin",fecha:new Date().toISOString().split("T")[0]}});setCancelModal(null);}}/>
        :<ModalReactivacion titulo={`Sol.${cancelModal.rec?.numSolicitud||"?"}`} onCerrar={()=>setCancelModal(null)}
            onConfirmar={({motivo,comentario})=>{dispatch({type:"REACTIVAR_REGISTRO",payload:{tabla:"diesel",id:cancelModal.rec.id,motivo,comentario,reactivadoPor:"admin",fecha:new Date().toISOString().split("T")[0]}});setCancelModal(null);}}/>
      )}
      {recibirDieselModal&&(
        <Modal title={`⛽ Recibir diesel en tanque`} onClose={()=>setRecibirDieselModal(null)}
          footer={<><button className="btn btn-secondary" onClick={()=>setRecibirDieselModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={guardarRecepcionDiesel}>💾 Confirmar recepción</button></>}>
          <div style={{padding:"8px 12px",background:"#fff3e0",borderRadius:6,marginBottom:12,fontSize:12}}>
            <div>Solicitado: <strong>{recibirDieselModal.cantidad} L</strong></div>
            <div>Ya recibido: <strong style={{color:"#2d5a1b"}}>{parseFloat(recibirDieselModal.litrosRecibidos)||0} L</strong></div>
            <div>Pendiente: <strong style={{color:"#c0392b"}}>{(parseFloat(recibirDieselModal.cantidad)||0)-(parseFloat(recibirDieselModal.litrosRecibidos)||0)} L</strong></div>
            <div>Solicitud: <strong># {recibirDieselModal.numSolicitud}</strong> · Proveedor: <strong>{recibirDieselModal.proveedor||"—"}</strong></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Litros recibidos en tanque *</label>
              <input className="form-input" type="number" step="0.1" value={formRecepDie.litros} onChange={e=>setFormRecepDie(f=>({...f,litros:e.target.value}))}/></div>
            <div className="form-group"><label className="form-label">Fecha de recepción</label>
              <input className="form-input" type="date" value={formRecepDie.fecha} onChange={e=>setFormRecepDie(f=>({...f,fecha:e.target.value}))}/></div>
          </div>
          <div className="form-group"><label className="form-label">Notas (opcional)</label>
            <input className="form-input" value={formRecepDie.notas} onChange={e=>setFormRecepDie(f=>({...f,notas:e.target.value}))} placeholder="Ej. Llegó completo, faltaron 200 L..."/></div>
          {(recibirDieselModal?.recepciones||[]).length>0&&(
            <div style={{marginTop:8}}>
              <div style={{fontSize:11,fontWeight:600,color:"#6a6050",marginBottom:6}}>Recepciones anteriores:</div>
              {recibirDieselModal.recepciones.map((r,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"4px 8px",background:"#faf8f3",borderRadius:4,marginBottom:3}}>
                  <span>{r.fecha}{r.notas?" — "+r.notas:""}</span>
                  <span style={{fontFamily:"monospace",fontWeight:600,color:"#e67e22"}}>{r.litros} L</span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // VISTA NUEVO REGISTRO
  // ─────────────────────────────────────────────────────────────────────────────
  if (vista==="nuevo") {
    const tm = form.tipoMovimiento || 'entrada';
    const tituloForm = tm === 'salida_interna' ? '⛽ Carga de Tractor del Cilindro'
                    : tm === 'salida_externa' ? '🏪 Carga en Gasolinera'
                    : '📥 Compra de Diesel';
    const cant = parseFloat(form.cantidad) || 0;
    const pxl  = parseFloat(form.precioLitro || form.ppl || 0) || 0;
    // Calcular importe automático (entrada/externa)
    const totalCalc = cant * pxl;
    return (
    <div style={{maxWidth:660}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
        <button className="btn btn-secondary" onClick={()=>setVista("resumen")}>← Volver</button>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700}}>{tituloForm}</div>
      </div>
      <div className="card">
        <div className="card-body" style={{display:"flex",flexDirection:"column",gap:14}}>

          {/* ═════ SALIDA INTERNA — Carga de tractor del cilindro ═════ */}
          {tm === 'salida_interna' && (
            <>
              <div className="form-group">
                <label className="form-label">Fecha *</label>
                <input className="form-input" type="date" value={form.fechaSolicitud} onChange={e=>setForm(f=>({...f,fechaSolicitud:e.target.value,fechaOrden:e.target.value}))}/>
              </div>
              <div className="form-group">
                <label className="form-label">🚜 Tractor / Equipo</label>
                <select className="form-select" value={form.maquinariaId||""} onChange={e=>{
                  const m = (state.maquinaria||[]).find(x=>String(x.id)===String(e.target.value));
                  setForm(f=>({...f,maquinariaId:e.target.value,unidad: m?.nombre || "LT"}));
                }}>
                  <option value="">— Sin especificar —</option>
                  {(state.maquinaria||[]).map(m=>(
                    <option key={m.id} value={m.id}>{m.nombre}{m.tipo?` (${m.tipo})`:""}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">📍 Lote</label>
                <select className="form-select" value={form.loteId||""} onChange={e=>setForm(f=>({...f,loteId:e.target.value}))}>
                  <option value="">— Sin especificar —</option>
                  {(state.lotes||[])
                    .filter(l => l.activo !== false)
                    .sort((a,b) => {
                      const na = (a.apodo && a.apodo !== 'NO DEFINIDO' ? a.apodo : a.folioCorto || '');
                      const nb = (b.apodo && b.apodo !== 'NO DEFINIDO' ? b.apodo : b.folioCorto || '');
                      return na.localeCompare(nb);
                    })
                    .map(l => {
                      const ha = parseFloat(l.hectareas || l.supCredito || l.supModulo || 0).toFixed(1);
                      const apodo = l.apodo && l.apodo !== 'NO DEFINIDO' ? l.apodo : (l.folioCorto || `Lote #${l.id}`);
                      const prodTxt = l.propietario ? ` — ${l.propietario}` : '';
                      return <option key={l.id} value={l.id}>{apodo}{prodTxt} ({ha} ha)</option>;
                    })}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Litros cargados *</label>
                <input className="form-input" type="number" value={form.cantidad}
                  onChange={e=>setForm(f=>({...f,cantidad:e.target.value}))} placeholder="0"/>
                <div style={{fontSize:11,color:'#6b7280',marginTop:4}}>Saldo actual del cilindro: <strong style={{color:saldoColor}}>{saldoCilindro.toLocaleString('es-MX')} L</strong></div>
              </div>
              <div className="form-group">
                <label className="form-label">👷 Operador</label>
                <select className="form-select" value={form.operadorId||""} onChange={e=>setForm(f=>({...f,operadorId:e.target.value}))}>
                  <option value="">— Seleccionar —</option>
                  {(state.operadores||[]).filter(o=>o.activo!==false).map(o=>(
                    <option key={o.id} value={o.id}>{o.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Notas</label>
                <input className="form-input" value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} placeholder="Observaciones opcionales"/>
              </div>
            </>
          )}

          {/* ═════ ENTRADA — Compra que llena el cilindro ═════ */}
          {tm === 'entrada' && (
            <>
              <div className="form-group">
                <label className="form-label">Fecha *</label>
                <input className="form-input" type="date" value={form.fechaSolicitud} onChange={e=>setForm(f=>({...f,fechaSolicitud:e.target.value,fechaOrden:e.target.value}))}/>
              </div>
              <div className="form-group">
                <label className="form-label">Litros comprados *</label>
                <input className="form-input" type="number" value={form.cantidad}
                  onChange={e=>{
                    const c = parseFloat(e.target.value)||0;
                    const p = parseFloat(form.precioLitro)||0;
                    setForm(f=>({...f,cantidad:e.target.value,importe: c&&p ? (c*p).toFixed(2) : f.importe}));
                  }} placeholder="0"/>
              </div>
              <div className="form-group">
                <label className="form-label">Proveedor *</label>
                <input className="form-input" value={form.proveedor} onChange={e=>setForm(f=>({...f,proveedor:e.target.value}))}/>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Precio por litro $ *</label>
                  <input className="form-input" type="number" value={form.precioLitro||""} onChange={e=>{
                    const p = parseFloat(e.target.value)||0;
                    const c = parseFloat(form.cantidad)||0;
                    setForm(f=>({...f,precioLitro:e.target.value,importe: c&&p ? (c*p).toFixed(2) : f.importe}));
                  }} placeholder="0.00"/>
                </div>
                <div className="form-group">
                  <label className="form-label">Total $ (calculado)</label>
                  <input className="form-input" type="number" value={form.importe}
                    style={{fontFamily:"monospace",fontWeight:700,color:"#c0392b"}}
                    onChange={e=>setForm(f=>({...f,importe:e.target.value}))} placeholder="0.00"/>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notas</label>
                <input className="form-input" value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} placeholder="# Factura, observaciones..."/>
              </div>
            </>
          )}

          {/* ═════ SALIDA EXTERNA — Gasolinera ═════ */}
          {tm === 'salida_externa' && (
            <>
              <div className="form-group">
                <label className="form-label">Fecha *</label>
                <input className="form-input" type="date" value={form.fechaSolicitud} onChange={e=>setForm(f=>({...f,fechaSolicitud:e.target.value,fechaOrden:e.target.value}))}/>
              </div>
              <div className="form-group">
                <label className="form-label">🚜 Equipo / Vehículo *</label>
                <select className="form-select" value={form.maquinariaId||""} onChange={e=>{
                  const m = (state.maquinaria||[]).find(x=>String(x.id)===String(e.target.value));
                  setForm(f=>({...f,maquinariaId:e.target.value,unidad: m?.nombre || "LT"}));
                }}>
                  <option value="">— Seleccionar (o escribir en notas) —</option>
                  {(state.maquinaria||[]).map(m=>(
                    <option key={m.id} value={m.id}>{m.nombre}{m.tipo?` (${m.tipo})`:""}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Litros cargados *</label>
                <input className="form-input" type="number" value={form.cantidad}
                  onChange={e=>{
                    const c = parseFloat(e.target.value)||0;
                    const p = parseFloat(form.precioLitro)||0;
                    setForm(f=>({...f,cantidad:e.target.value,importe: c&&p ? (c*p).toFixed(2) : f.importe}));
                  }} placeholder="0"/>
              </div>
              <div className="form-group">
                <label className="form-label">Estación / Proveedor *</label>
                <input className="form-input" value={form.proveedor} onChange={e=>setForm(f=>({...f,proveedor:e.target.value}))} placeholder="Ej. PEMEX, Gasolinera del Fuerte..."/>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Precio por litro $ *</label>
                  <input className="form-input" type="number" value={form.precioLitro||""} onChange={e=>{
                    const p = parseFloat(e.target.value)||0;
                    const c = parseFloat(form.cantidad)||0;
                    setForm(f=>({...f,precioLitro:e.target.value,importe: c&&p ? (c*p).toFixed(2) : f.importe}));
                  }} placeholder="0.00"/>
                </div>
                <div className="form-group">
                  <label className="form-label">Total $</label>
                  <input className="form-input" type="number" value={form.importe}
                    style={{fontFamily:"monospace",fontWeight:700,color:"#c0392b"}}
                    onChange={e=>setForm(f=>({...f,importe:e.target.value}))} placeholder="0.00"/>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notas</label>
                <input className="form-input" value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} placeholder="# Ticket, observaciones..."/>
              </div>
            </>
          )}

          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button className="btn btn-secondary" onClick={()=>{setForm(emptyForm);setVista("resumen");}}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardarRegistro}>💾 Guardar</button>
          </div>
        </div>
      </div>
    </div>
  );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // VISTA IMPORTAR EXCEL
  // ─────────────────────────────────────────────────────────────────────────────
  if (vista==="import") return (
    <div style={{maxWidth:680}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
        <button className="btn btn-secondary" onClick={()=>setVista("tabla")}>← Volver</button>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700}}>Importar Excel Diesel</div>
      </div>
      <div className="card" style={{marginBottom:16,borderLeft:"4px solid #c8a84b"}}>
        <div className="card-body">
          <div style={{fontWeight:700,fontSize:13,marginBottom:10,color:"#856404"}}>📋 Estructura requerida del archivo Excel</div>
          <div style={{padding:"8px 12px",background:"#fff9e6",borderRadius:6,fontFamily:"monospace",fontSize:11,marginBottom:10}}>
            # SOLICITUD &nbsp;|&nbsp; # ORDEN &nbsp;|&nbsp; FECHA SOLICITUD &nbsp;|&nbsp; GRUPO &nbsp;|&nbsp; CODIGO CTE &nbsp;|&nbsp; PRODUCTOR &nbsp;|&nbsp; CULTIVO &nbsp;|&nbsp; EMPRESA &nbsp;|&nbsp; CATEGORIA &nbsp;|&nbsp; INSUMO &nbsp;|&nbsp; IEPS &nbsp;|&nbsp; CANTIDAD &nbsp;|&nbsp; UNIDAD &nbsp;|&nbsp; IMPORTE &nbsp;|&nbsp; FECHA ORDEN
          </div>
          <div style={{fontSize:11,color:"#5a6a5a",lineHeight:1.8}}>
            <b>Registros con CANTIDAD = 0</b> se importan automáticamente como <b>Ajustes de precio</b> — suman al importe pero no a los litros.<br/>
            Solo se procesa la primera hoja del archivo.
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-body" style={{textAlign:"center",padding:32}}>
          <div style={{fontSize:40,marginBottom:12}}>⛽</div>
          <div style={{fontWeight:600,marginBottom:8}}>Selecciona el archivo .xlsx de diesel</div>
          <input type="file" accept=".xlsx,.xls" ref={fileInputRef} style={{display:"none"}} onChange={importarExcel}/>
          <button className="btn btn-primary" onClick={()=>fileInputRef.current?.click()} disabled={importando}>
            {importando?"⏳ Procesando...":"📂 Seleccionar archivo"}
          </button>
          {importLog.length>0&&(
            <div style={{marginTop:16,textAlign:"left",padding:"12px 16px",background:"#f5f4f0",borderRadius:8}}>
              {importLog.map((l,i)=><div key={i} style={{fontSize:12,marginBottom:4,
                color:l.startsWith("❌")?"#c0392b":l.startsWith("⚠️")?"#e67e22":"#2d5a1b"}}>{l}</div>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return null;
}
