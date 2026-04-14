// ─── modules/Flujos.jsx ───────────────────────────────────────────

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


export default function FlujoModule({ userRol, usuario }) {
  const { state, dispatch } = useData();
  const isMobile = useIsMobile();
  const hoy = new Date().toISOString().split("T")[0];
  const mxnFmt = n => (parseFloat(n)||0).toLocaleString("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:2});

  const esSocio = userRol === "socio";
  const esAdmin = userRol === "admin";
  const [tab, setTab]         = useState(esSocio ? "reembolsos" : "pendientes");
  const [modalTipo, setModalTipo] = useState(null); // "compra"|"gasto"|"recom"|"reembolso"
  const [form, setForm]       = useState({});
  const [detalle, setDetalle] = useState(null); // solicitud seleccionada
  const [editandoReembolsoId, setEditandoReembolsoId] = useState(null); // id del reembolso en edición, null = nuevo

  const solCompras  = state.solicitudesCompra  || [];
  const solGastos   = state.solicitudesGasto   || [];
  const recomends   = state.recomendaciones    || [];
  const ordenesOC   = state.ordenesCompra      || [];
  const notifs      = state.notificaciones     || [];
  const lotes       = state.lotes              || [];
  const insumos     = state.insumos            || [];
  const usuarios    = [...(USUARIOS||[]), ...(state.usuariosExtra||[])];

  const nomUsuario  = uid => usuarios.find(u=>u.usuario===uid)?.nombre || uid || "Sistema";
  const misNotifs   = notifs.filter(n=>!n.leida && (n.para===userRol || n.para===usuario?.usuario));

  // ── Verificar delegaciones activas ──────────────────────────────────────
  const hoyISO = new Date().toISOString().slice(0,10);
  const delegaciones = state.delegaciones || [];
  const delegacionActiva = delegaciones.find(d =>
    d.activa && d.para === usuario?.usuario &&
    d.desde <= hoyISO && d.hasta >= hoyISO
  );
  // Puede aprobar si: es admin/socio, O tiene una delegación activa de alguien con ese rol
  const PUEDE_APROBAR = ["admin","socio"];
  const puedeAprobar = PUEDE_APROBAR.includes(userRol) || !!delegacionActiva;
  const puedeCrear    = ["admin","encargado","ingeniero","compras"].includes(userRol);

  // Colores de estatus
  const ESTATUS_COLOR = {
    borrador:"#8a8070", pendiente:"#e67e22", aprobado:"#2d5a1b",
    rechazado:"#c0392b", ejecutado:"#1a6ea8", cotizando:"#8e44ad", pagado:"#16a085"
  };
  const ESTATUS_LABEL = {
    borrador:"Borrador", pendiente:"⏳ Pendiente", aprobado:"✅ Aprobado",
    rechazado:"❌ Rechazado", ejecutado:"✔ Ejecutado", cotizando:"📋 Cotizando", pagado:"💰 Pagado"
  };

  // ── Agregar historial a una solicitud ────────────────────────────────────
  const agregarHistorial = (sol, accion, nota="") => ({
    ...sol,
    historial: [...(sol.historial||[]), {
      accion, usuario:usuario?.usuario||userRol,
      nombre:usuario?.nombre||userRol, fecha:new Date().toISOString(), nota
    }]
  });

  // ── Aprobar / Rechazar ───────────────────────────────────────────────────
  const aprobar = (tipo, sol, nota="") => {
    const updated = agregarHistorial({...sol, estatus:"aprobado", aprobadoPor:usuario?.usuario}, "Aprobada", nota);
    if(tipo==="compra") {
      dispatch({type:"UPD_SOL_COMPRA", payload:updated});
      // Crear Orden de Compra automáticamente
      dispatch({type:"ADD_ORDEN_COMPRA", payload:{
        solicitudId:sol.id, estatus:"abierta", concepto:sol.concepto,
        proveedor:sol.proveedor||"", montoEstimado:sol.montoEstimado||0,
        cotizaciones:[], creadoPor:usuario?.usuario, cicloId:state.cicloActivoId||1,
      }});
    } else if(tipo==="gasto") {
      dispatch({type:"UPD_SOL_GASTO", payload:updated});
    } else if(tipo==="recom") {
      dispatch({type:"UPD_RECOM", payload:updated});
    }
  };

  const rechazar = (tipo, sol, nota) => {
    if(!nota) return;
    const updated = agregarHistorial({...sol, estatus:"rechazado", rechazadoPor:usuario?.usuario}, "Rechazada", nota);
    if(tipo==="compra") dispatch({type:"UPD_SOL_COMPRA", payload:updated});
    else if(tipo==="gasto") dispatch({type:"UPD_SOL_GASTO", payload:updated});
    else if(tipo==="recom") dispatch({type:"UPD_RECOM", payload:updated});
  };

  // ── Helper: notificar a TODOS los usuarios con rol admin ────────────────
  const notifyAdmins = (titulo, mensaje) => {
    const baseOv = state.usuariosBaseEdit || {};
    const todos = [
      ...USUARIOS.map(u => baseOv[u.id] ? { ...u, ...baseOv[u.id] } : u),
      ...(state.usuariosExtra || []),
    ];
    const admins = todos.filter(u => u.rol === "admin" && u.activo !== false);
    admins.forEach(u => {
      dispatch({ type:"ADD_NOTIF", payload:{ para:u.usuario, tipo:"gasto", titulo, mensaje } });
    });
  };

  // ── Crear nueva solicitud (o editar reembolso existente) ────────────────
  const guardar = () => {
    const base = { ...form, estatus:"pendiente", creadoPor:usuario?.usuario||userRol,
      cicloId:state.cicloActivoId||1, fecha: form.fecha || hoy };
    if(modalTipo==="compra")  dispatch({type:"ADD_SOL_COMPRA", payload:base});
    if(modalTipo==="gasto")   dispatch({type:"ADD_SOL_GASTO",  payload:base});
    if(modalTipo==="recom")   dispatch({type:"ADD_RECOM",      payload:base});
    if(modalTipo==="reembolso") {
      const autor = usuario?.nombre || usuario?.usuario;
      const resumen = `${form.concepto||""} (${mxnFmt(form.monto||0)})`;
      if (editandoReembolsoId) {
        // ── Edit mode ──
        const original = solGastos.find(g => g.id === editandoReembolsoId);
        if (!original) { setModalTipo(null); setForm({}); setEditandoReembolsoId(null); return; }
        const wasRechazado = original.estatus === "rechazado";
        const merged = {
          ...original,
          ...form,
          esReembolso: true,
          estatus: wasRechazado ? "pendiente" : original.estatus,
        };
        const final = agregarHistorial(merged, wasRechazado ? "Re-enviada tras rechazo" : "Editada");
        dispatch({ type:"UPD_SOL_GASTO", payload: final });
        if (wasRechazado) {
          notifyAdmins("Reembolso re-enviado", `${autor} corrigió y re-envió su reembolso: ${resumen}`);
        }
      } else {
        // ── Nuevo ──
        const payload = { ...base, esReembolso:true };
        dispatch({ type:"ADD_SOL_GASTO", payload });
        notifyAdmins("Nuevo reembolso", `${autor} registró un reembolso: ${resumen}`);
      }
    }
    setModalTipo(null); setForm({}); setEditandoReembolsoId(null);
  };

  // ── Reembolsos: acciones del socio (editar / eliminar) ───────────────────
  const editarReembolso = (sol) => {
    // Solo el autor puede editar, y solo si está pendiente o rechazado
    if (sol.creadoPor !== usuario?.usuario) return;
    if (!["pendiente","rechazado"].includes(sol.estatus)) return;
    setEditandoReembolsoId(sol.id);
    setForm({
      concepto: sol.concepto || "",
      descripcion: sol.concepto || "",
      monto: sol.monto || 0,
      fecha: sol.fecha || hoy,
      categoria: sol.categoria || "",
      notas: sol.notas || "",
    });
    setModalTipo("reembolso");
  };

  const eliminarReembolso = (sol) => {
    if (sol.creadoPor !== usuario?.usuario) return;
    if (!["pendiente","rechazado"].includes(sol.estatus)) return;
    if (!window.confirm("¿Eliminar este reembolso?")) return;
    dispatch({ type:"DEL_SOL_GASTO", payload: sol.id });
  };

  // ── Reembolsos: acciones del admin (aprobar / rechazar / pagar) ──────────
  const aprobarReembolso = (sol) => {
    if (!esAdmin) return;
    const updated = agregarHistorial({...sol, estatus:"aprobado", aprobadoPor:usuario?.usuario}, "Aprobada");
    dispatch({type:"UPD_SOL_GASTO", payload:updated});
    dispatch({type:"ADD_NOTIF", payload:{
      para: sol.creadoPor, tipo:"gasto", titulo:"Reembolso aprobado",
      mensaje:`Tu reembolso "${sol.concepto||""}" fue aprobado por ${usuario?.nombre||usuario?.usuario}`
    }});
  };

  const rechazarReembolso = (sol, motivo) => {
    if (!esAdmin) return;
    if (!motivo || !motivo.trim()) return;
    const updated = agregarHistorial({...sol, estatus:"rechazado", rechazadoPor:usuario?.usuario}, "Rechazada", motivo);
    dispatch({type:"UPD_SOL_GASTO", payload:updated});
    dispatch({type:"ADD_NOTIF", payload:{
      para: sol.creadoPor, tipo:"gasto", titulo:"Reembolso rechazado",
      mensaje:`Tu reembolso "${sol.concepto||""}" fue rechazado. Motivo: ${motivo}`
    }});
  };

  const marcarPagado = (sol) => {
    if (!esAdmin) return;
    const updated = agregarHistorial({...sol, estatus:"pagado", pagadoPor:usuario?.usuario, fechaPago:new Date().toISOString()}, "Marcado como pagado");
    dispatch({type:"UPD_SOL_GASTO", payload:updated});
    // Crear egreso automático
    const categoriaToEgreso = {
      reparaciones:"reparaciones", combustible:"diesel", servicios:"otro", otro:"otro"
    };
    dispatch({type:"ADD_EGRESO", payload:{
      id: Date.now(),
      categoria: categoriaToEgreso[sol.categoria] || "otro",
      concepto: `Reembolso: ${sol.concepto||""}`,
      monto: parseFloat(sol.monto)||0,
      fecha: hoy,
      notas: `Reembolso a ${nomUsuario(sol.creadoPor)}. ${sol.notas||""}`.trim(),
      origenReembolsoId: sol.id,
      lineaCredito: "directo",
    }});
    dispatch({type:"ADD_NOTIF", payload:{
      para: sol.creadoPor, tipo:"gasto", titulo:"Reembolso pagado",
      mensaje:`Tu reembolso "${sol.concepto||""}" fue marcado como pagado (${mxnFmt(sol.monto||0)})`
    }});
  };

  // ── Reembolsos visibles según rol ────────────────────────────────────────
  const todosReembolsos = solGastos.filter(g => g.esReembolso);
  const reembolsosVisibles = esSocio
    ? todosReembolsos.filter(g => g.creadoPor === usuario?.usuario)
    : todosReembolsos;

  // ── Badge contadores ────────────────────────────────────────────────────
  const pendCompras = solCompras.filter(s=>s.estatus==="pendiente").length;
  const pendGastos  = solGastos.filter(s=>s.estatus==="pendiente").length;
  const pendRecom   = recomends.filter(s=>s.estatus==="pendiente").length;
  const totalPend   = pendCompras + pendGastos + pendRecom;

  // ── Card de solicitud ────────────────────────────────────────────────────
  const CardSolicitud = ({sol, tipo}) => {
    const [nota, setNota] = useState("");
    const [showRechazar, setShowRechazar] = useState(false);
    const color = ESTATUS_COLOR[sol.estatus]||T.fog;
    return (
      <div style={{border:`1px solid ${T.line}`,borderRadius:10,marginBottom:10,overflow:"hidden",
        background:"white",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
        <div style={{padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
              <span style={{padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700,
                background:color+"22",color,border:`1px solid ${color}44`}}>
                {ESTATUS_LABEL[sol.estatus]||sol.estatus}
              </span>
              <span style={{fontSize:11,color:T.fog}}>{sol.fecha}</span>
              {sol.urgente&&<span style={{fontSize:11,padding:"1px 8px",borderRadius:10,background:"#fff3cd",color:"#856404",fontWeight:700}}>🔴 Urgente</span>}
            </div>
            <div style={{fontWeight:700,fontSize:14,marginBottom:2}}>{sol.concepto||sol.descripcion||"Sin descripción"}</div>
            <div style={{fontSize:12,color:T.fog}}>
              {sol.proveedor&&`${sol.proveedor} · `}
              {sol.montoEstimado>0&&`${mxnFmt(sol.montoEstimado)} est. · `}
              {sol.loteId&&`Lote: ${lotes.find(l=>l.id===sol.loteId)?.apodo||sol.loteId} · `}
              Creado por: {nomUsuario(sol.creadoPor)}
            </div>
            {sol.detalle&&<div style={{fontSize:12,color:T.fog,marginTop:4,fontStyle:"italic"}}>"{sol.detalle}"</div>}
          </div>
          <button onClick={()=>setDetalle(sol===detalle?null:sol)}
            style={{padding:"4px 10px",borderRadius:6,border:`1px solid ${T.line}`,background:T.mist,
              fontSize:12,cursor:"pointer",whiteSpace:"nowrap"}}>
            {detalle?.id===sol.id?"Cerrar":"Ver más"}
          </button>
        </div>

        {/* Detalle expandido */}
        {detalle?.id===sol.id&&(
          <div style={{borderTop:`1px solid ${T.line}`,padding:"12px 16px",background:"#faf8f3"}}>
            {/* Historial */}
            <div style={{fontSize:11,fontWeight:700,color:T.fog,marginBottom:8,letterSpacing:"0.08em"}}>HISTORIAL</div>
            {(sol.historial||[]).map((h,i)=>(
              <div key={i} style={{display:"flex",gap:8,marginBottom:6}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:T.field,marginTop:5,flexShrink:0}}/>
                <div>
                  <span style={{fontWeight:600,fontSize:12}}>{h.accion}</span>
                  <span style={{fontSize:11,color:T.fog}}> · {h.nombre||h.usuario} · {new Date(h.fecha).toLocaleDateString("es-MX")}</span>
                  {h.nota&&<div style={{fontSize:11,color:T.fog,fontStyle:"italic"}}>"{h.nota}"</div>}
                </div>
              </div>
            ))}

            {/* Acciones según rol y estatus */}
            {puedeAprobar && sol.estatus==="pendiente"&&(
              <div style={{marginTop:12,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                {!showRechazar ? (<>
                  <button className="btn btn-primary btn-sm"
                    onClick={()=>{ const n=window.prompt("Nota de aprobación (opcional):",""); aprobar(tipo,sol,n||""); }}>
                    ✅ Aprobar
                  </button>
                  <button className="btn btn-sm" style={{background:"#fff3cd",color:"#856404",border:"1px solid #ffc107"}}
                    onClick={()=>setShowRechazar(true)}>
                    ❌ Rechazar
                  </button>
                </>) : (
                  <div style={{display:"flex",gap:6,width:"100%",flexWrap:"wrap"}}>
                    <input className="form-input" style={{flex:1,minWidth:200}} value={nota}
                      onChange={e=>setNota(e.target.value)} placeholder="Motivo del rechazo (requerido)..."/>
                    <button className="btn btn-danger btn-sm" onClick={()=>{ if(!nota.trim()) return; rechazar(tipo,sol,nota); setShowRechazar(false); }}>Confirmar</button>
                    <button className="btn btn-secondary btn-sm" onClick={()=>setShowRechazar(false)}>Cancelar</button>
                  </div>
                )}
              </div>
            )}

            {/* Orden de compra vinculada */}
            {tipo==="compra" && sol.estatus==="aprobado"&&(()=>{
              const oc = ordenesOC.find(o=>o.solicitudId===sol.id);
              if(!oc) return null;
              return (
                <div style={{marginTop:10,padding:"8px 12px",background:"#f0f7ec",borderRadius:6,fontSize:12}}>
                  <strong>Orden de Compra generada</strong> · Estatus: {oc.estatus}
                  {oc.cotizaciones?.length>0&&<span> · {oc.cotizaciones.length} cotización(es)</span>}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    );
  };

  // ── Tabs ────────────────────────────────────────────────────────────────
  const tabs = esSocio
    ? [
        {id:"reembolsos", label:`💰 Mis Reembolsos (${reembolsosVisibles.length})` },
      ]
    : [
        {id:"pendientes", label:`⏳ Pendientes${totalPend>0?` (${totalPend})`:""}` },
        {id:"compras",    label:`🛒 Compras (${solCompras.length})` },
        {id:"gastos",     label:`💸 Gastos (${solGastos.filter(g=>!g.esReembolso).length})` },
        {id:"recomend",   label:`🌿 Aplicaciones (${recomends.length})` },
        {id:"ordenes",    label:`📋 Órdenes OC (${ordenesOC.length})` },
        {id:"reembolsos", label:`💰 Reembolsos (${todosReembolsos.length})` },
      ];

  return (
    <div>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700}}>
          ✅ Flujos y Aprobaciones
        </div>
        {esSocio && (
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <button className="btn btn-primary btn-sm"
              onClick={()=>{setModalTipo("reembolso");setForm({tipo:"reembolso",fecha:hoy});}}>
              💰 Registrar Gasto de Reembolso
            </button>
          </div>
        )}
        {puedeCrear&&(
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <button className="btn btn-secondary btn-sm" onClick={()=>{setModalTipo("recom");setForm({tipo:"recom"});}}>🌿 Nueva Recomendación</button>
            <button className="btn btn-secondary btn-sm" onClick={()=>{setModalTipo("gasto");setForm({tipo:"gasto"});}}>💸 Solicitar Gasto</button>
            <button className="btn btn-primary btn-sm" onClick={()=>{setModalTipo("compra");setForm({tipo:"compra"});}}>🛒 Solicitar Compra</button>
          </div>
        )}
      </div>

      {/* Banner de delegación activa */}
      {delegacionActiva && (
        <div style={{padding:"10px 16px",background:"#e8f4fd",border:"1px solid #1a6ea844",
          borderRadius:8,marginBottom:14,fontSize:13,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:18}}>🔁</span>
          <div>
            <strong>Estás actuando como delegado</strong> de {nomUsuario(delegacionActiva.de)}
            <span style={{color:T.fog,marginLeft:8}}>hasta el {delegacionActiva.hasta}</span>
            {delegacionActiva.motivo&&<span style={{color:T.fog}}> · {delegacionActiva.motivo}</span>}
          </div>
        </div>
      )}

      {/* Notificaciones no leídas */}
      {misNotifs.length>0&&(
        <div style={{padding:"10px 14px",background:"#fff9e6",border:"1px solid #f0c060",borderRadius:8,marginBottom:14,
          display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:13}}>🔔 Tienes <strong>{misNotifs.length}</strong> notificación(es) pendiente(s)</div>
          <button className="btn btn-sm btn-secondary" onClick={()=>dispatch({type:"LEER_ALL_NOTIF"})}>Marcar leídas</button>
        </div>
      )}

      {/* KPIs — admin/otros ven 4 tarjetas; socio ve solo resumen de sus reembolsos */}
      {esSocio ? (
        <div className="stat-grid" style={{gridTemplateColumns:"repeat(3,1fr)",marginBottom:16}}>
          {[
            {label:"Pendientes", val:reembolsosVisibles.filter(r=>r.estatus==="pendiente").length, color:"#e67e22", icon:"⏳"},
            {label:"Aprobados por pagar", val:reembolsosVisibles.filter(r=>r.estatus==="aprobado").length, color:"#2d5a1b", icon:"✅"},
            {label:"Pagados (total)", val:reembolsosVisibles.filter(r=>r.estatus==="pagado").reduce((s,r)=>s+(parseFloat(r.monto)||0),0), color:"#16a085", icon:"💰", esMonto:true},
          ].map(({label,val,color,icon,esMonto})=>(
            <div key={label} className="stat-card" style={{borderTop:`3px solid ${color}`}}>
              <div className="stat-icon">{icon}</div>
              <div className="stat-label">{label}</div>
              <div className="stat-value" style={{color,fontSize:esMonto?16:24}}>{esMonto?mxnFmt(val):val}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="stat-grid" style={{gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)",marginBottom:16}}>
          {[
            {label:"Pendientes aprobación", val:totalPend,        color:"#e67e22", icon:"⏳"},
            {label:"Compras aprobadas",     val:solCompras.filter(s=>s.estatus==="aprobado").length, color:"#2d5a1b", icon:"✅"},
            {label:"Órdenes de compra",     val:ordenesOC.length, color:"#1a6ea8", icon:"📋"},
            {label:"Gastos autorizados",    val:solGastos.filter(s=>s.estatus==="aprobado").reduce((s,g)=>s+(parseFloat(g.monto)||0),0), color:"#c0392b", icon:"💸", esMonto:true},
          ].map(({label,val,color,icon,esMonto})=>(
            <div key={label} className="stat-card" style={{borderTop:`3px solid ${color}`}}>
              <div className="stat-icon">{icon}</div>
              <div className="stat-label">{label}</div>
              <div className="stat-value" style={{color,fontSize:esMonto?16:24}}>{esMonto?mxnFmt(val):val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs" style={{marginBottom:16}}>
        {tabs.map(t=>(
          <div key={t.id} className={`tab ${tab===t.id?"active":""}`} onClick={()=>setTab(t.id)}>{t.label}</div>
        ))}
      </div>

      {/* ── Tab: Pendientes ── */}
      {tab==="pendientes"&&(
        <div>
          {totalPend===0 ? (
            <div className="empty-state"><div className="empty-icon">✅</div><div className="empty-title">Sin pendientes</div><div className="empty-sub">Todo está al día</div></div>
          ) : (
            <div>
              {solCompras.filter(s=>s.estatus==="pendiente").map(s=><CardSolicitud key={s.id} sol={s} tipo="compra"/>)}
              {solGastos.filter(s=>s.estatus==="pendiente"&&!s.esReembolso).map(s=><CardSolicitud key={s.id} sol={s} tipo="gasto"/>)}
              {recomends.filter(s=>s.estatus==="pendiente").map(s=><CardSolicitud key={s.id} sol={s} tipo="recom"/>)}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Compras ── */}
      {tab==="compras"&&(
        <div>
          {solCompras.length===0 ? (
            <div className="empty-state"><div className="empty-icon">🛒</div><div className="empty-title">Sin solicitudes de compra</div></div>
          ) : solCompras.map(s=><CardSolicitud key={s.id} sol={s} tipo="compra"/>)}
        </div>
      )}

      {/* ── Tab: Gastos (excluye reembolsos) ── */}
      {tab==="gastos"&&(()=>{
        const gastosRegulares = solGastos.filter(g=>!g.esReembolso);
        return (
          <div>
            {gastosRegulares.length===0 ? (
              <div className="empty-state"><div className="empty-icon">💸</div><div className="empty-title">Sin solicitudes de gasto</div></div>
            ) : gastosRegulares.map(s=><CardSolicitud key={s.id} sol={s} tipo="gasto"/>)}
          </div>
        );
      })()}

      {/* ── Tab: Recomendaciones de aplicación ── */}
      {tab==="recomend"&&(
        <div>
          {recomends.length===0 ? (
            <div className="empty-state"><div className="empty-icon">🌿</div><div className="empty-title">Sin recomendaciones de aplicación</div></div>
          ) : recomends.map(s=><CardSolicitud key={s.id} sol={s} tipo="recom"/>)}
        </div>
      )}

      {/* ── Tab: Órdenes de Compra ── */}
      {tab==="ordenes"&&(
        <div>
          {ordenesOC.length===0 ? (
            <div className="empty-state"><div className="empty-icon">📋</div><div className="empty-title">Sin órdenes de compra generadas</div><div className="empty-sub">Se generan automáticamente al aprobar una solicitud de compra</div></div>
          ) : (
            <div className="card">
              <div className="table-wrap-scroll">
                <table>
                  <thead><tr><th>Concepto</th><th>Proveedor</th><th style={{textAlign:"right"}}>Monto Est.</th><th>Estatus</th><th>Fecha</th><th>Cotizaciones</th><th></th></tr></thead>
                  <tbody>
                    {ordenesOC.map((oc,i)=>{
                      const bg = i%2===0?"white":"#faf8f3";
                      return (
                        <tr key={oc.id}>
                          <td style={{background:bg,fontWeight:600}}>{oc.concepto}</td>
                          <td style={{background:bg,fontSize:12,color:T.fog}}>{oc.proveedor||"—"}</td>
                          <td style={{background:bg,textAlign:"right",fontFamily:"monospace"}}>{mxnFmt(oc.montoEstimado)}</td>
                          <td style={{background:bg}}>
                            <span style={{padding:"2px 8px",borderRadius:10,fontSize:11,fontWeight:700,
                              background:oc.estatus==="cerrada"?"#d4edda":"#fff3cd",
                              color:oc.estatus==="cerrada"?"#155724":"#856404"}}>
                              {oc.estatus==="abierta"?"🟡 Abierta":"✅ Cerrada"}
                            </span>
                          </td>
                          <td style={{background:bg,fontSize:11,color:T.fog}}>{oc.creadoEn?.slice(0,10)}</td>
                          <td style={{background:bg,fontSize:12}}>{oc.cotizaciones?.length||0} cotización(es)</td>
                          <td style={{background:bg}}>
                            {userRol==="compras"&&oc.estatus==="abierta"&&(
                              <button className="btn btn-sm btn-secondary" onClick={()=>{
                                const prov = window.prompt("Proveedor cotizado:");
                                const monto = parseFloat(window.prompt("Monto cotizado ($):"));
                                if(!prov||!monto) return;
                                dispatch({type:"UPD_ORDEN_COMPRA", payload:{...oc,
                                  cotizaciones:[...(oc.cotizaciones||[]),{proveedor:prov,monto,fecha:hoy}]
                                }});
                              }}>+ Cotización</button>
                            )}
                            {puedeAprobar&&oc.estatus==="abierta"&&oc.cotizaciones?.length>0&&(
                              <button className="btn btn-sm btn-primary" style={{marginLeft:4}} onClick={()=>{
                                if(!window.confirm("¿Cerrar esta Orden de Compra como ejecutada?")) return;
                                dispatch({type:"UPD_ORDEN_COMPRA", payload:{...oc,estatus:"cerrada",cerradaEn:hoy,cerradaPor:usuario?.usuario}});
                                // Registrar como egreso
                                const montoFinal = oc.cotizaciones[oc.cotizaciones.length-1].monto;
                                dispatch({type:"ADD_EGRESO", payload:{
                                  id:Date.now(), fecha:hoy, concepto:`OC: ${oc.concepto}`,
                                  monto:montoFinal, categoria:"otro", cicloId:oc.cicloId||1,
                                  origen:"orden_compra", ordenId:oc.id
                                }});
                              }}>✅ Ejecutar</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Reembolsos ── */}
      {tab==="reembolsos"&&(()=>{
        const CAT_LABEL = { reparaciones:"🔧 Reparación", combustible:"⛽ Combustible", servicios:"🛠 Servicios", otro:"📦 Otro" };
        if (reembolsosVisibles.length===0) {
          return (
            <div className="empty-state">
              <div className="empty-icon">💰</div>
              <div className="empty-title">{esSocio?"Sin reembolsos registrados":"Sin reembolsos"}</div>
              <div className="empty-sub">
                {esSocio ? "Usa el botón 'Registrar Gasto de Reembolso' para capturar un nuevo gasto." : "Aún no hay reembolsos registrados por los socios."}
              </div>
            </div>
          );
        }
        return (
          <div>
            {reembolsosVisibles.map(sol => {
              const color = ESTATUS_COLOR[sol.estatus]||T.fog;
              const open  = detalle?.id === sol.id;
              return (
                <div key={sol.id} style={{border:`1px solid ${T.line}`,borderRadius:10,marginBottom:10,
                  overflow:"hidden",background:"white",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                  <div style={{padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                        <span style={{padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700,
                          background:color+"22",color,border:`1px solid ${color}44`}}>
                          {ESTATUS_LABEL[sol.estatus]||sol.estatus}
                        </span>
                        <span style={{fontSize:11,color:T.fog}}>{sol.fecha}</span>
                        {sol.categoria && (
                          <span style={{fontSize:11,padding:"2px 8px",borderRadius:10,background:"#faf3e0",color:"#7a6030",fontWeight:600}}>
                            {CAT_LABEL[sol.categoria]||sol.categoria}
                          </span>
                        )}
                      </div>
                      <div style={{fontWeight:700,fontSize:14,marginBottom:2}}>{sol.concepto||"Sin concepto"}</div>
                      <div style={{fontSize:13,color:"#2d5a1b",fontWeight:700,marginBottom:2}}>
                        {mxnFmt(sol.monto||0)}
                      </div>
                      <div style={{fontSize:12,color:T.fog}}>
                        Registrado por: {nomUsuario(sol.creadoPor)}
                      </div>
                      {sol.notas && <div style={{fontSize:12,color:T.fog,marginTop:4,fontStyle:"italic"}}>"{sol.notas}"</div>}
                    </div>
                    <button onClick={()=>setDetalle(open?null:sol)}
                      style={{padding:"4px 10px",borderRadius:6,border:`1px solid ${T.line}`,background:T.mist,
                        fontSize:12,cursor:"pointer",whiteSpace:"nowrap"}}>
                      {open?"Cerrar":"Ver historial"}
                    </button>
                  </div>

                  {/* ── Acciones admin SIEMPRE visibles (sin expandir) ── */}
                  {esAdmin && sol.estatus==="pendiente" && (
                    <div style={{padding:"10px 16px",borderTop:`1px solid ${T.line}`,background:"#fff8e6",
                      display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                      <span style={{fontSize:11,color:"#856404",fontWeight:600,marginRight:4}}>⚡ Acción requerida:</span>
                      <button className="btn btn-primary btn-sm"
                        onClick={()=>aprobarReembolso(sol)}>
                        ✅ Aprobar
                      </button>
                      <button className="btn btn-sm" style={{background:"#fff3cd",color:"#856404",border:"1px solid #ffc107"}}
                        onClick={()=>{
                          const n = window.prompt("Motivo del rechazo (requerido):","");
                          if (!n || !n.trim()) return;
                          rechazarReembolso(sol, n.trim());
                        }}>
                        ❌ Rechazar
                      </button>
                    </div>
                  )}
                  {esAdmin && sol.estatus==="aprobado" && (
                    <div style={{padding:"10px 16px",borderTop:`1px solid ${T.line}`,background:"#e8f5e9",
                      display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                      <span style={{fontSize:11,color:"#2d5a1b",fontWeight:600,marginRight:4}}>⚡ Listo para pagar:</span>
                      <button className="btn btn-primary btn-sm"
                        onClick={()=>{
                          if(!window.confirm(`¿Marcar como pagado este reembolso por ${mxnFmt(sol.monto||0)}? Se creará automáticamente un egreso.`)) return;
                          marcarPagado(sol);
                        }}
                        style={{background:"#16a085",border:"none"}}>
                        💰 Marcar como pagado
                      </button>
                    </div>
                  )}

                  {/* ── Acciones socio SIEMPRE visibles (solo autor, solo pendiente/rechazado) ── */}
                  {esSocio && sol.creadoPor === usuario?.usuario && ["pendiente","rechazado"].includes(sol.estatus) && (
                    <div style={{padding:"10px 16px",borderTop:`1px solid ${T.line}`,background:"#faf8f3",
                      display:"flex",gap:8,flexWrap:"wrap"}}>
                      <button className="btn btn-sm btn-secondary"
                        onClick={()=>editarReembolso(sol)}>
                        ✏️ {sol.estatus==="rechazado"?"Editar y re-enviar":"Editar"}
                      </button>
                      <button className="btn btn-sm btn-danger"
                        onClick={()=>eliminarReembolso(sol)}>
                        🗑 Eliminar
                      </button>
                    </div>
                  )}

                  {/* ── Badge pagado SIEMPRE visible ── */}
                  {sol.estatus==="pagado" && sol.fechaPago && (
                    <div style={{padding:"8px 16px",borderTop:`1px solid ${T.line}`,background:"#d4efdf",
                      fontSize:12,color:"#117a65"}}>
                      <strong>✓ Pagado</strong> el {new Date(sol.fechaPago).toLocaleDateString("es-MX")} — se generó egreso automático en la categoría del reembolso.
                    </div>
                  )}

                  {/* ── Detalle expandible: solo historial ── */}
                  {open && (
                    <div style={{borderTop:`1px solid ${T.line}`,padding:"12px 16px",background:"#faf8f3"}}>
                      <div style={{fontSize:11,fontWeight:700,color:T.fog,marginBottom:8,letterSpacing:"0.08em"}}>HISTORIAL</div>
                      {(sol.historial||[]).length === 0 ? (
                        <div style={{fontSize:12,color:T.fog,fontStyle:"italic"}}>Sin movimientos registrados</div>
                      ) : (sol.historial||[]).map((h,i)=>(
                        <div key={i} style={{display:"flex",gap:8,marginBottom:6}}>
                          <div style={{width:6,height:6,borderRadius:"50%",background:T.field,marginTop:5,flexShrink:0}}/>
                          <div>
                            <span style={{fontWeight:600,fontSize:12}}>{h.accion}</span>
                            <span style={{fontSize:11,color:T.fog}}> · {h.nombre||h.usuario} · {new Date(h.fecha).toLocaleDateString("es-MX")}</span>
                            {h.nota && <div style={{fontSize:11,color:T.fog,fontStyle:"italic"}}>"{h.nota}"</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ── Modal nueva solicitud ── */}
      {modalTipo&&(
        <Modal title={
          modalTipo==="compra"    ? "🛒 Nueva Solicitud de Compra" :
          modalTipo==="gasto"     ? "💸 Nueva Solicitud de Gasto" :
          modalTipo==="reembolso" ? (editandoReembolsoId ? "✏️ Editar Reembolso" : "💰 Registrar Gasto de Reembolso") :
                                    "🌿 Nueva Recomendación de Aplicación"}
          onClose={()=>{setModalTipo(null);setForm({});setEditandoReembolsoId(null);}}
          footer={<>
            <button className="btn btn-secondary" onClick={()=>{setModalTipo(null);setForm({});setEditandoReembolsoId(null);}}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardar}
              disabled={
                modalTipo==="reembolso"
                  ? (!form.concepto || !form.monto || !form.categoria)
                  : (!form.concepto&&!form.descripcion)
              }>
              {modalTipo==="reembolso"
                ? (editandoReembolsoId
                    ? (solGastos.find(g=>g.id===editandoReembolsoId)?.estatus==="rechazado"
                        ? "🔄 Re-enviar reembolso"
                        : "💾 Guardar cambios")
                    : "💰 Registrar reembolso")
                : "💾 Enviar solicitud"}
            </button>
          </>}>

          {/* Campos comunes */}
          <div className="form-group">
            <label className="form-label">{modalTipo==="recom"?"Descripción de la aplicación":"Concepto / Qué se necesita"} *</label>
            <input className="form-input" value={form.concepto||form.descripcion||""} placeholder={modalTipo==="compra"?"Ej: Fertilizante DAP 18-46-00":modalTipo==="gasto"?"Ej: Reparación de motobomba":"Ej: Aplicación de herbicida en lotes 3,4,5"}
              onChange={e=>setForm(f=>({...f, concepto:e.target.value, descripcion:e.target.value}))}/>
          </div>

          {modalTipo==="compra"&&<>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Proveedor sugerido</label>
                <input className="form-input" value={form.proveedor||""} placeholder="Nombre del proveedor"
                  onChange={e=>setForm(f=>({...f,proveedor:e.target.value}))}/>
              </div>
              <div className="form-group">
                <label className="form-label">Monto estimado ($)</label>
                <input className="form-input" type="number" value={form.montoEstimado||""}
                  onChange={e=>setForm(f=>({...f,montoEstimado:parseFloat(e.target.value)||0}))}/>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Cantidad</label>
                <input className="form-input" value={form.cantidad||""} placeholder="Ej: 500 kg"
                  onChange={e=>setForm(f=>({...f,cantidad:e.target.value}))}/>
              </div>
              <div className="form-group">
                <label className="form-label">Destino / Uso</label>
                <input className="form-input" value={form.destino||""} placeholder="¿Para qué se usa?"
                  onChange={e=>setForm(f=>({...f,destino:e.target.value}))}/>
              </div>
            </div>
          </>}

          {modalTipo==="gasto"&&<>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Monto estimado ($)</label>
                <input className="form-input" type="number" value={form.monto||""}
                  onChange={e=>setForm(f=>({...f,monto:parseFloat(e.target.value)||0}))}/>
              </div>
              <div className="form-group">
                <label className="form-label">Categoría</label>
                <select className="form-select" value={form.categoria||""} onChange={e=>setForm(f=>({...f,categoria:e.target.value}))}>
                  <option value="">— Seleccionar —</option>
                  <option value="reparaciones">Reparación / Mantenimiento</option>
                  <option value="servicios">Servicios externos</option>
                  <option value="operacion">Operación general</option>
                  <option value="combustible">Combustible</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </div>
          </>}

          {modalTipo==="recom"&&<>
            <div className="form-group">
              <label className="form-label">Lote(s) afectado(s)</label>
              <input className="form-input" value={form.lotes||""} placeholder="Ej: Las 33, Cheveto, todos"
                onChange={e=>setForm(f=>({...f,lotes:e.target.value}))}/>
            </div>
            <div className="form-group">
              <label className="form-label">Producto / Dosis sugerida</label>
              <input className="form-input" value={form.producto||""} placeholder="Ej: Gramoxone 1.5 L/ha"
                onChange={e=>setForm(f=>({...f,producto:e.target.value}))}/>
            </div>
          </>}

          {modalTipo==="reembolso"&&<>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Monto ($) *</label>
                <input className="form-input" type="number" value={form.monto||""}
                  placeholder="0.00"
                  onChange={e=>setForm(f=>({...f,monto:parseFloat(e.target.value)||0}))}/>
              </div>
              <div className="form-group">
                <label className="form-label">Fecha del gasto *</label>
                <input className="form-input" type="date" value={form.fecha||hoy}
                  onChange={e=>setForm(f=>({...f,fecha:e.target.value}))}/>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Categoría *</label>
              <select className="form-select" value={form.categoria||""} onChange={e=>setForm(f=>({...f,categoria:e.target.value}))}>
                <option value="">— Seleccionar —</option>
                <option value="reparaciones">🔧 Reparación</option>
                <option value="combustible">⛽ Combustible</option>
                <option value="servicios">🛠 Servicios</option>
                <option value="otro">📦 Otro</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Notas</label>
              <textarea className="form-input" rows={2} value={form.notas||""}
                onChange={e=>setForm(f=>({...f,notas:e.target.value}))}
                placeholder="Detalles del gasto, proveedor, ubicación..."/>
            </div>
          </>}

          {/* Urgencia y notas (no aplica para reembolsos) */}
          {modalTipo!=="reembolso" && <>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Urgencia</label>
                <select className="form-select" value={form.urgente||false} onChange={e=>setForm(f=>({...f,urgente:e.target.value==="true"}))}>
                  <option value="false">Normal</option>
                  <option value="true">🔴 Urgente</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Fecha requerida</label>
                <input className="form-input" type="date" value={form.fechaRequerida||""}
                  onChange={e=>setForm(f=>({...f,fechaRequerida:e.target.value}))}/>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notas adicionales</label>
              <textarea className="form-input" rows={2} value={form.detalle||""}
                onChange={e=>setForm(f=>({...f,detalle:e.target.value}))}
                placeholder="Contexto, justificación, detalles..."/>
            </div>
          </>}
          <div style={{padding:"8px 12px",background:"#fff9e6",borderRadius:6,fontSize:12,color:"#856404"}}>
            {modalTipo==="reembolso"
              ? "⚡ Este reembolso quedará pendiente de aprobación y pago por Administración."
              : "⚡ Esta solicitud quedará pendiente de aprobación por Administración / Socio"}
          </div>
        </Modal>
      )}
    </div>
  );
}
