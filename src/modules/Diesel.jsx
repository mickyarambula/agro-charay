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
import AIInsight from '../components/AIInsight.jsx';


export default function DieselModule({ userRol, puedeEditar, navFiltro = {} }) {
  const { state, dispatch } = useData();
  const isMobile = useIsMobile();
  // Visibilidad de precios: encargado e ingeniero NO ven importes.
  const verPrecios = ["admin", "socio", "compras"].includes(userRol);
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
  const hasCiclo        = (state.ciclos||[]).find(c=>c.id===state.cicloActivoId)||(state.ciclos||[]).find(c=>c.id===state.cicloActivoId)||(state.ciclos||[]).find(c=>c.predeterminado);
  const hasTotales      = (hasCiclo?.asignaciones||[]).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);

  // ── Filtrado tabla ────────────────────────────────────────────────────────────
  const dieselFiltrado = diesel
    .filter(d => filtroCancelados==="todos" ? true : filtroCancelados==="cancelados" ? d.cancelado : !d.cancelado)
    .filter(d => filtroProd==="todos" || String(d.productorId)===String(filtroProd))
    .filter(d => !filtroActividad || (d.unidad||"").toLowerCase().includes(filtroActividad.toLowerCase()) || (d.concepto||"").toLowerCase().includes(filtroActividad.toLowerCase()) || (d.numSolicitud||"").includes(filtroActividad));

  // ── Guardar registro manual ───────────────────────────────────────────────────
  const guardarRegistro = () => {
    const importe  = parseFloat(form.importe)||0;
    const cantidad = parseFloat(form.cantidad)||0;
    if (!importe || !form.fechaSolicitud) return;
    dispatch({ type:"ADD_DIESEL", payload:{
      ...form, id: Date.now(),
      cantidad, importe,
      productorId: form.productorId ? parseInt(form.productorId)||form.productorId : null,
      esAjuste: form.esAjuste || cantidad===0,
    }});
    setForm(emptyForm);
    setVista("tabla");
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
  // VISTA RESUMEN
  // ─────────────────────────────────────────────────────────────────────────────
  if (vista==="resumen") return (
    <div>
      <AIInsight modulo="Diesel" contexto={{
        totalRegistros: state.diesel?.length || 0,
        totalLitros: (state.diesel||[]).reduce((s,d) => s + (parseFloat(d.cantidad)||0), 0),
      }} />
      <div className="stat-grid" style={{gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)",marginBottom:20}}>
        <div className="stat-card gold">
          <div className="stat-icon">⛽</div>
          <div className="stat-label">Total Litros</div>
          <div className="stat-value">{totalLitros.toLocaleString("es-MX",{maximumFractionDigits:0})}<span className="stat-unit"> L</span></div>
          <div className="stat-sub">{diesel.filter(d=>!d.cancelado&&!d.esAjuste).length} cargas</div>
        </div>
        <div className="stat-card rust">
          <div className="stat-icon">💵</div>
          <div className="stat-label">Costo Total</div>
          <div className="stat-value" style={{fontSize:18}}>{mxnFmt(totalImporte)}</div>
          <div className="stat-sub">Incl. {mxnFmt(totalAjustes)} ajustes</div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon">💲</div>
          <div className="stat-label">Precio Promedio</div>
          <div className="stat-value" style={{fontSize:18}}>${precioPromedio.toFixed(2)}<span className="stat-unit">/L</span></div>
          <div className="stat-sub">Ponderado ciclo</div>
        </div>
        <div className="stat-card sky">
          <div className="stat-icon">🌾</div>
          <div className="stat-label">Costo / Ha</div>
          <div className="stat-value" style={{fontSize:18}}>{mxnFmt(hasTotales>0?totalImporte/hasTotales:0)}</div>
          <div className="stat-sub">{hasTotales.toFixed(1)} ha ciclo activo</div>
        </div>
      </div>

      <div style={{
        display: isMobile ? "grid" : "flex",
        gridTemplateColumns: isMobile ? "1fr" : undefined,
        gap:10,
        marginBottom:20,
        flexWrap:"wrap"
      }}>
        <button className="btn btn-primary"   onClick={()=>setVista("nuevo")} style={isMobile?{minHeight:48,width:"100%"}:undefined}>＋ Registrar Carga</button>
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
        <button className="btn btn-primary" onClick={()=>setVista("nuevo")}>＋ Nuevo Registro</button>
      </div>
      {(()=>{
        const totalLts = dieselFiltrado.filter(d=>!d.esAjuste).reduce((s,d)=>s+(parseFloat(d.cantidad)||0),0);
        const totalImp = dieselFiltrado.reduce((s,d)=>s+(parseFloat(d.importe)||0),0);
        const activeF  = [filtroProd!=="todos",filtroCancelados!=="activos",!!filtroActividad].filter(Boolean).length;
        return (
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
        );
      })()}
      {isMobile ? (
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
          {dieselFiltrado.sort((a,b)=>String(b.fechaSolicitud).localeCompare(String(a.fechaSolicitud))).map(d=>{
            const opaco = d.cancelado?{opacity:0.55}:{};
            return (
              <div key={d.id} style={{
                background:"#ffffff",
                border:"1px solid #e5e7eb",
                borderLeft:`4px solid ${d.esAjuste?"#f59e0b":"#e67e22"}`,
                borderRadius:12,
                padding:14,
                boxShadow:"0 1px 4px rgba(0,0,0,0.06)",
                ...opaco,
              }}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:8}}>
                  <div style={{fontSize:18,fontWeight:700,color:"#14532D"}}>{d.fechaSolicitud||"—"}</div>
                  <span style={{fontSize:10,fontWeight:700,padding:"4px 10px",borderRadius:999,
                    background:d.esAjuste?"#fff3cd":"#fef5ed",
                    color:d.esAjuste?"#856404":"#e67e22"}}>
                    {d.esAjuste?"🔧 Ajuste":"⛽ Carga"}
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
          <table style={{minWidth:900}}>
            <thead><tr>
              <th>Solicitud</th><th>Orden</th><th>Fecha Sol.</th>
              <th>Productor</th><th>Tipo</th>
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
  if (vista==="nuevo") return (
    <div style={{maxWidth:660}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
        <button className="btn btn-secondary" onClick={()=>setVista("tabla")}>← Volver</button>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700}}>Registrar Diesel / Combustible</div>
      </div>
      <div className="card">
        <div className="card-body" style={{display:"flex",flexDirection:"column",gap:14}}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label"># Solicitud</label>
              <input className="form-input" value={form.numSolicitud} onChange={e=>setForm(f=>({...f,numSolicitud:e.target.value}))} placeholder="Ej. 6929"/>
            </div>
            <div className="form-group">
              <label className="form-label"># Orden</label>
              <input className="form-input" value={form.numOrden} onChange={e=>setForm(f=>({...f,numOrden:e.target.value}))} placeholder="Ej. 314"/>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Fecha Solicitud</label>
              <input className="form-input" type="date" value={form.fechaSolicitud} onChange={e=>setForm(f=>({...f,fechaSolicitud:e.target.value}))}/>
            </div>
            <div className="form-group">
              <label className="form-label">Fecha Orden</label>
              <input className="form-input" type="date" value={form.fechaOrden} onChange={e=>setForm(f=>({...f,fechaOrden:e.target.value}))}/>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Productor</label>
            <select className="form-select" value={form.productorId} onChange={e=>setForm(f=>({...f,productorId:e.target.value}))}>
              <option value="">— Seleccionar —</option>
              {productores.map(p=><option key={p.id} value={p.id}>{p.alias||p.apPat}</option>)}
            </select>
          </div>
          {/* Tipo de registro */}
          <div className="form-group">
            <label className="form-label">Tipo de registro</label>
            <div style={{display:"flex",gap:10}}>
              <div onClick={()=>setForm(f=>({...f,esAjuste:false}))}
                style={{flex:1,padding:"10px 14px",borderRadius:8,cursor:"pointer",textAlign:"center",
                  border:`2px solid ${!form.esAjuste?"#1a6ea8":"#ddd5c0"}`,
                  background:!form.esAjuste?"#dbeafe":"white"}}>
                <div style={{fontSize:18}}>⛽</div>
                <div style={{fontSize:12,fontWeight:600,color:!form.esAjuste?"#1a6ea8":"#5a5040"}}>Carga de Diesel</div>
              </div>
              <div onClick={()=>setForm(f=>({...f,esAjuste:true,cantidad:"0"}))}
                style={{flex:1,padding:"10px 14px",borderRadius:8,cursor:"pointer",textAlign:"center",
                  border:`2px solid ${form.esAjuste?"#856404":"#ddd5c0"}`,
                  background:form.esAjuste?"#fff3cd":"white"}}>
                <div style={{fontSize:18}}>🔧</div>
                <div style={{fontSize:12,fontWeight:600,color:form.esAjuste?"#856404":"#5a5040"}}>Ajuste de Precio</div>
              </div>
            </div>
          </div>
          <div className="form-row">
            {!form.esAjuste&&(
              <div className="form-group">
                <label className="form-label">Cantidad (Litros) *</label>
                <input className="form-input" type="number" value={form.cantidad}
                  onChange={e=>setForm(f=>({...f,cantidad:e.target.value}))} placeholder="0"/>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Importe Total $ *</label>
              <input className="form-input" type="number" value={form.importe}
                onChange={e=>setForm(f=>({...f,importe:e.target.value}))} placeholder="0.00"/>
            </div>
          </div>
          {!form.esAjuste&&parseFloat(form.cantidad)>0&&parseFloat(form.importe)>0&&(
            <div style={{padding:"8px 12px",background:"#f0f8e8",borderRadius:6,fontSize:12,color:"#2d5a1b",fontFamily:"monospace"}}>
              Precio por litro: ${(parseFloat(form.importe)/parseFloat(form.cantidad)).toFixed(4)}/L
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">IEPS</label>
              <select className="form-select" value={form.ieps} onChange={e=>setForm(f=>({...f,ieps:e.target.value}))}>
                <option value="SIN IEPS">SIN IEPS</option>
                <option value="CON IEPS">CON IEPS</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Unidad</label>
              <input className="form-input" value={form.unidad} onChange={e=>setForm(f=>({...f,unidad:e.target.value}))} placeholder="LT"/>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Proveedor</label>
            <input className="form-input" value={form.proveedor} onChange={e=>setForm(f=>({...f,proveedor:e.target.value}))}/>
          </div>
          <div className="form-group">
            <label className="form-label">Notas</label>
            <input className="form-input" value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} placeholder="Observaciones opcionales"/>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button className="btn btn-secondary" onClick={()=>setVista("tabla")}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardarRegistro}>💾 Guardar</button>
          </div>
        </div>
      </div>
    </div>
  );

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
