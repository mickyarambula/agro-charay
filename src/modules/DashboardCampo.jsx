// ─── modules/DashboardCampo.jsx ───────────────────────────────────────────

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
import { solicitarPermisoPush } from '../core/push.js';
import { postBitacora, postDieselCarga } from '../core/supabaseWriters.js';
import { showToast } from '../components/mobile/Toast.jsx';


export default function DashboardCampo({ userRol, usuario, onNavigate }) {
  const { state, dispatch } = useData();
  const isMobile = useIsMobile();
  const [notifActivas, setNotifActivas] = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'granted'
  );
  const hoy = new Date().toISOString().split("T")[0];

  const bitacora   = state.bitacora   || [];
  const lotes      = state.lotes      || [];
  const operadores = state.operadores || [];
  const cicloPred  = (state.ciclos||[]).find(c=>c.id===state.cicloActivoId)||(state.ciclos||[])[0];
  const asigs      = cicloPred?.asignaciones || [];

  // Registros de hoy
  const bitHoy    = bitacora.filter(b=>b.fecha===hoy);
  const diesHoy   = bitHoy.filter(b=>b.tipo==="diesel");
  const litrosHoy = diesHoy.reduce((s,b)=>s+(parseFloat(b.data?.litros)||0), 0);

  // Lotes del ciclo activo
  const lotesEnCiclo = lotes.filter(l=>asigs.some(a=>String(a.loteId)===String(l.id)));

  // Día del ciclo
  const diaDelCiclo = (()=>{
    if (!cicloPred?.fechaInicio) return 0;
    const start = new Date(cicloPred.fechaInicio).getTime();
    const now   = new Date(hoy).getTime();
    return Math.max(1, Math.floor((now - start) / 86400000) + 1);
  })();

  // Saludo por hora
  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";
  const nombrePila = (usuario?.nombre || "Encargado").split(" ")[0];

  // Alertas de lotes: lotes sin registro fenológico o con última lectura >14 días
  const alertasLotes = (()=>{
    const hoyMs = new Date(hoy).getTime();
    let count = 0;
    lotesEnCiclo.forEach(l => {
      const ult = bitacora
        .filter(b => b.tipo==="fenol" && (String(b.loteId)===String(l.id) || (b.loteIds||[]).map(String).includes(String(l.id))))
        .sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha)))[0];
      if (!ult) { count++; return; }
      const dias = (hoyMs - new Date(ult.fecha).getTime()) / 86400000;
      if (dias > 14) count++;
    });
    return count;
  })();

  // Últimos 5 del día
  const ultimos = bitHoy.slice(0, 5);
  const iconoTipo = { insumo:"🌱", diesel:"⛽", riego:"💧", fenol:"🌿", reporte:"📝", foto:"📷" };

  // ── Estado de los modales rápidos ──
  const [modal, setModal] = useState(null); // null | "trabajo" | "diesel"
  const emptyT = { tipo:"insumo", loteId:"", loteName:"", operadorId:"", horas:"", notas:"" };
  const emptyD = { loteId:"", loteName:"", operadorId:"", maquinariaId:"", litros:"", horas:"", notas:"" };

  // ── Derivados de state.diesel para validaciones + defaults del modal diesel ──
  const dieselActivo = (state.diesel || []).filter(d => !d.cancelado);
  const dieselTipoMov = d => d.tipoMovimiento || d.tipo_movimiento || (d.esAjuste ? 'entrada' : 'salida_interna');
  const dieselLitros  = d => parseFloat(d.cantidad || d.litros || 0) || 0;
  const entradasCil   = dieselActivo.filter(d => dieselTipoMov(d) === 'entrada').reduce((s,d) => s + dieselLitros(d), 0);
  const salidasIntCil = dieselActivo.filter(d => dieselTipoMov(d) === 'salida_interna').reduce((s,d) => s + dieselLitros(d), 0);
  const saldoCilindro = Math.max(0, entradasCil - salidasIntCil);

  // Último precio registrado (más reciente con precio > 0 y no cancelado). Fallback 27.
  const ultimoPrecioLitro = (() => {
    const conPrecio = dieselActivo
      .filter(d => (parseFloat(d.precioLitro) || 0) > 0)
      .sort((a,b) => String(b.fecha||'').localeCompare(String(a.fecha||'')));
    return conPrecio[0] ? (parseFloat(conPrecio[0].precioLitro) || 27) : 27;
  })();

  // Deriva productor desde el lote vía asignaciones del ciclo activo.
  const productorIdFromLote = (loteId) => {
    if (!loteId) return null;
    const ciclo = (state.ciclos || []).find(c => String(c.id) === String(state.cicloActivoId));
    const asig = ciclo?.asignaciones?.find(a => String(a.loteId) === String(loteId));
    return asig?.productorId || null;
  };
  const [formT, setFormT] = useState(emptyT);
  const [formD, setFormD] = useState(emptyD);
  const [busqLote, setBusqLote] = useState("");

  const abrirTrabajo = () => { setFormT(emptyT); setBusqLote(""); setModal("trabajo"); };
  const abrirDiesel  = () => { setFormD(emptyD); setBusqLote(""); setModal("diesel"); };
  const cerrarModal  = () => { setModal(null); setBusqLote(""); };

  const nav = (page) => onNavigate && onNavigate(page);

  const guardarTrabajo = async () => {
    if (!formT.loteId) return;
    const op = operadores.find(o => String(o.id) === String(formT.operadorId));
    const bitacoraPayload = {
      tipo: formT.tipo,
      loteId: parseInt(formT.loteId),
      loteIds: [parseInt(formT.loteId)],
      fecha: hoy,
      operador: op?.nombre || usuario?.nombre || "",
      operadorId: formT.operadorId || "",
      maquinariaId: "",
      horas: parseFloat(formT.horas) || 0,
      notas: formT.notas,
      data: {},
    };
    const saved = await postBitacora(bitacoraPayload, state.cicloActivoId, { silent: true });
    dispatch({ type:"ADD_BITACORA", payload:{
      ...bitacoraPayload,
      id: saved?.id || Date.now(),
      foto: null,
    }});
    showToast("Trabajo registrado ✓", "success");
    cerrarModal();
  };

  const guardarDiesel = async () => {
    if (!formD.loteId || !formD.litros) return;
    const litros = parseFloat(formD.litros) || 0;
    if (litros <= 0) { alert('Los litros deben ser mayor a 0'); return; }
    // Validación de saldo del cilindro
    if (saldoCilindro <= 0) { alert('El cilindro está vacío. Contacta a compras para reabastecer.'); return; }
    if (litros > saldoCilindro) { alert(`No hay suficiente diesel. Saldo actual: ${saldoCilindro.toLocaleString('es-MX')} L`); return; }

    const op  = operadores.find(o => String(o.id) === String(formD.operadorId));
    const maq = (state.maquinaria || []).find(m => String(m.id) === String(formD.maquinariaId));
    const productorId = productorIdFromLote(formD.loteId);
    const precioLitro = ultimoPrecioLitro;

    // 1) Espejo bitácora PRIMERO — capturamos legacy_id para vincularlo al registro de diesel.
    const bitacoraPayload = {
      tipo: "diesel",
      loteId: parseInt(formD.loteId) || formD.loteId,
      loteIds: [parseInt(formD.loteId) || formD.loteId],
      fecha: hoy,
      operador: op?.nombre || usuario?.nombre || "",
      operadorId: formD.operadorId || "",
      maquinariaId: formD.maquinariaId || "",
      horas: parseFloat(formD.horas) || 0,
      notas: formD.notas || "",
      data: { litros, precioLitro, actividad: "Registro campo" },
    };
    const savedBitacora = await postBitacora(bitacoraPayload, state.cicloActivoId, { silent: true });
    const bitacoraLegacyId = savedBitacora?.id || null;
    dispatch({ type:"ADD_BITACORA", payload:{
      ...bitacoraPayload,
      id: bitacoraLegacyId || Date.now(),
      cantidad: litros,
      unidad: "L",
      origen: "diesel_cilindro",
      foto: null,
    }});

    // 2) POST a tabla diesel via helper centralizado.
    const concepto = maq?.nombre ? `${maq.nombre} — Registro campo` : 'Registro campo';
    const dieselId = Date.now();
    const dieselRecord = {
      id: dieselId,
      tipo: 'salida_interna',
      fecha: hoy,
      litros,
      precioLitro,
      proveedor: '',
      operador: op?.nombre || '',
      concepto,
      productorId,
      bitacoraLegacyId,
      notas: formD.notas || '',
    };
    await postDieselCarga(dieselRecord, { registradoPor: usuario?.usuario || userRol || 'encargado' });

    // 3) Dispatch ADD_DIESEL local — saldo del cilindro se actualiza automáticamente.
    dispatch({ type: 'ADD_DIESEL', payload: {
      id: dieselId,
      fecha: hoy,
      fechaSolicitud: hoy,
      fechaOrden: hoy,
      cantidad: litros,
      precioLitro,
      importe: litros * precioLitro,
      proveedor: '',
      maquinariaId: formD.maquinariaId || null,
      loteId: formD.loteId || null,
      productorId,
      bitacoraLegacyId,
      operadorId: formD.operadorId || '',
      tipoMovimiento: 'salida_interna',
      esAjuste: false,
      cancelado: false,
      unidad: 'LT',
      notas: formD.notas || '',
    }});

    showToast("Diesel registrado ✓", "success");
    cerrarModal();
  };

  const lotesFiltrados = lotesEnCiclo.filter(l => {
    if (!busqLote.trim()) return true;
    const q = busqLote.toLowerCase();
    const name = ((l.apodo && l.apodo !== "NO DEFINIDO" ? l.apodo : l.folioCorto) || "").toLowerCase();
    const prop = (l.propietario || "").toLowerCase();
    return name.includes(q) || prop.includes(q);
  });

  // ── Bloque: selector de lote (reutilizable en ambos modales) ──
  const LoteSelector = ({ form, setForm, colorSel }) => (
    <div className="form-group">
      <label className="form-label">Lote *</label>
      <input className="form-input" value={busqLote}
        onChange={e=>setBusqLote(e.target.value)}
        placeholder="Buscar por nombre, folio o propietario..."
        style={{fontSize:14}}/>
      {busqLote && (
        <div style={{maxHeight:200,overflowY:"auto",marginTop:6,border:`1px solid ${T.line}`,borderRadius:8,background:"white"}}>
          {lotesFiltrados.slice(0,10).map(l => {
            const name = l.apodo && l.apodo !== "NO DEFINIDO" ? l.apodo : l.folioCorto;
            return (
              <div key={l.id}
                onClick={()=>{ setForm(f=>({...f,loteId:String(l.id),loteName:name})); setBusqLote(""); }}
                style={{padding:"12px 14px",borderBottom:`1px solid ${T.line}`,cursor:"pointer",fontSize:13}}>
                <div style={{fontWeight:700,color:"#3d3525"}}>{name}</div>
                <div style={{fontSize:11,color:T.fog,marginTop:2}}>{l.propietario||"—"}</div>
              </div>
            );
          })}
          {lotesFiltrados.length === 0 && (
            <div style={{padding:"14px",fontSize:12,color:T.fog,textAlign:"center"}}>Sin resultados</div>
          )}
        </div>
      )}
      {form.loteId && !busqLote && (
        <div style={{marginTop:8,padding:"10px 14px",background:`${colorSel}15`,borderRadius:8,
          fontSize:13,fontWeight:700,color:colorSel,border:`1px solid ${colorSel}33`,
          display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span>📍 {form.loteName}</span>
          <button onClick={()=>setForm(f=>({...f,loteId:"",loteName:""}))}
            style={{background:"none",border:"none",cursor:"pointer",color:"#c0392b",fontSize:18,lineHeight:1,padding:"0 4px"}}>✕</button>
        </div>
      )}
    </div>
  );

  return (
    <div style={isMobile ? { background: '#f8f6f2', minHeight: '100vh' } : undefined}>
      {/* ═══ HEADER — saludo ═══ */}
      {isMobile ? (
        <div style={{
          background: '#1a3a0f',
          padding: '18px 16px 22px',
          margin: '-14px -12px 14px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: 10,
                color: '#7ab87a',
                letterSpacing: 1.2,
                marginBottom: 4,
                textTransform: 'uppercase',
                fontWeight: 500,
              }}>
                {saludo} — Encargado de Campo
              </div>
              <div style={{
                fontSize: 28,
                color: '#ffffff',
                fontFamily: 'Georgia, serif',
                fontWeight: 400,
                lineHeight: 1.1,
              }}>
                {saludo},<br/>{nombrePila}
              </div>
            </div>
            <div style={{
              textAlign: 'right',
              fontSize: 10,
              color: '#7ab87a',
              lineHeight: 1.8,
              textTransform: 'capitalize',
              flexShrink: 0,
            }}>
              {new Date().toLocaleDateString('es-MX', { weekday: 'long' })}<br/>
              {new Date().getDate()} {new Date().toLocaleDateString('es-MX', { month: 'long' })}<br/>
              Día {diaDelCiclo}
            </div>
          </div>
          {cicloPred?.nombre && (
            <div style={{
              display: 'inline-block',
              marginTop: 10,
              background: 'rgba(255,255,255,0.1)',
              color: '#a8d5a2',
              fontSize: 9,
              fontWeight: 600,
              padding: '3px 10px',
              borderRadius: 20,
              border: '1px solid rgba(255,255,255,0.15)',
              letterSpacing: 0.3,
            }}>
              🌾 {cicloPred.nombre}
            </div>
          )}
        </div>
      ) : (
        <div style={{
          marginBottom:18,
          padding:"22px 22px 20px",
          background:"linear-gradient(135deg,#2d5a1b 0%,#4a8c2a 60%,#6ba83a 100%)",
          borderRadius:14,
          color:"white",
          boxShadow:"0 4px 16px rgba(45,90,27,0.25)",
          position:"relative",
          overflow:"hidden"
        }}>
          <div style={{position:"absolute",right:-20,top:-20,fontSize:120,opacity:0.08}}>🌾</div>
          <div style={{position:"relative"}}>
            <div style={{fontFamily:"Georgia, serif",fontSize:24,fontWeight:700,lineHeight:1.2}}>
              {saludo}, {nombrePila} 👋
            </div>
            <div style={{fontSize:13,opacity:0.92,marginTop:6,textTransform:"capitalize"}}>
              {new Date().toLocaleDateString("es-MX",{weekday:"long",day:"2-digit",month:"long"})}
            </div>
            <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
              <span style={{padding:"4px 12px",borderRadius:12,background:"rgba(255,255,255,0.2)",
                fontSize:11,fontWeight:700,letterSpacing:0.3}}>
                📅 Día {diaDelCiclo} del ciclo
              </span>
              {cicloPred?.nombre && (
                <span style={{padding:"4px 12px",borderRadius:12,background:"rgba(255,255,255,0.12)",
                  fontSize:11,fontWeight:600,letterSpacing:0.3}}>
                  🌾 {cicloPred.nombre}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <AIInsight modulo="Campo" contexto={{
        ordenesHoy: (state.ordenesTrabajo || []).filter(o => o.fecha === hoy).length,
        trabajosHoy: bitHoy?.length || 0,
        dieselHoy: diesHoy?.length || 0,
        lotesActivos: state.lotes?.filter(l => l.activo !== false)?.length || 0,
      }} />

      {isMobile && !notifActivas && (
        <button
          onClick={async () => {
            const sub = await solicitarPermisoPush();
            if (sub) setNotifActivas(true);
          }}
          style={{
            width: '100%',
            padding: '12px',
            minHeight: 48,
            marginBottom: 12,
            background: '#1a3a0f',
            color: '#e8f5e2',
            border: 'none',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            touchAction: 'manipulation',
          }}
        >
          🔔 Activar notificaciones
        </button>
      )}

      {/* ═══ ÓRDENES DEL DÍA (HOY) ═══ */}
      {(() => {
        const ordenesHoy = (state.ordenesTrabajo || []).filter(o => o.fecha === hoy);
        const ESTATUS_BADGE = {
          pendiente:  { bg:"#fff3cd", color:"#856404", label:"⏳ Pendiente" },
          completado: { bg:"#d4efdf", color:"#117a65", label:"✅ Completada" },
          cancelado:  { bg:"#fdf0ef", color:"#c0392b", label:"🚫 Cancelada" },
        };
        return (
          <div style={{marginBottom:20}}>
            <div style={{
              display:"flex",justifyContent:"space-between",alignItems:"center",
              marginBottom:10,paddingLeft:4,
            }}>
              <div style={{fontSize:11,fontWeight:700,color:"#8a8070",
                textTransform:"uppercase",letterSpacing:1}}>
                📋 Órdenes del día
              </div>
              {ordenesHoy.length > 0 && (
                <span onClick={()=>nav("ordenes")}
                  style={{color:"#1a6ea8",cursor:"pointer",fontSize:11,fontWeight:600}}>
                  Ver todas ({ordenesHoy.length}) →
                </span>
              )}
            </div>
            {ordenesHoy.length === 0 ? (
              <div style={{
                background:"white",borderRadius:12,padding:"20px 16px",
                textAlign:"center",border:"2px dashed #ddd5c0",
              }}>
                <div style={{fontSize:32,marginBottom:6}}>📋</div>
                <div style={{fontSize:13,fontWeight:700,color:"#3d3525",marginBottom:4}}>
                  Sin órdenes programadas hoy
                </div>
                <button onClick={()=>nav("ordenes")}
                  style={{
                    marginTop: 12,
                    padding: "16px",
                    width: isMobile ? "100%" : undefined,
                    borderRadius: 10,
                    border: "none",
                    background: "#1a3a0f",
                    color: "#ffffff",
                    fontSize: 15,
                    fontFamily: isMobile ? "Georgia, serif" : undefined,
                    fontWeight: isMobile ? 400 : 700,
                    cursor: "pointer",
                    minHeight: isMobile ? 56 : undefined,
                    touchAction: "manipulation",
                  }}>
                  + Nueva orden
                </button>
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {ordenesHoy.slice(0, 4).map(orden => {
                  const op = operadores.find(o => String(o.id) === String(orden.operadorId));
                  const lot = lotes.find(l => String(l.id) === String(orden.loteId));
                  const nomLote = lot
                    ? (lot.apodo && lot.apodo !== "NO DEFINIDO" ? lot.apodo : lot.folioCorto)
                    : (orden.loteNombre || "—");
                  const nomOperador = op?.nombre || orden.operadorNombre || "Sin asignar";
                  const badge = ESTATUS_BADGE[orden.estatus] || ESTATUS_BADGE.pendiente;
                  return (
                    <div key={orden.id}
                      onClick={()=>nav("ordenes")}
                      style={{
                        background:"white",borderRadius:10,padding:"12px 14px",
                        boxShadow:"0 1px 4px rgba(0,0,0,0.05)",
                        borderLeft:`4px solid ${orden.estatus==="completado"?"#16a085":"#c8a84b"}`,
                        cursor:"pointer",
                      }}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:4}}>
                        <div style={{fontSize:14,fontWeight:700,color:"#3d3525",flex:1}}>
                          {orden.tipoTrabajo || "Trabajo"}
                        </div>
                        <span style={{
                          padding:"2px 8px",borderRadius:10,fontSize:10,fontWeight:700,
                          background:badge.bg,color:badge.color,
                        }}>{badge.label}</span>
                      </div>
                      <div style={{fontSize:12,color:T.fog}}>
                        👷 <strong>{nomOperador}</strong> · 📍 {nomLote}
                        {orden.horaInicio && <> · ⏰ {orden.horaInicio}</>}
                      </div>
                    </div>
                  );
                })}
                {ordenesHoy.length > 4 && (
                  <div onClick={()=>nav("ordenes")}
                    style={{
                      textAlign:"center",padding:"8px",fontSize:12,
                      color:"#1a6ea8",cursor:"pointer",fontWeight:600,
                    }}>
                    + {ordenesHoy.length - 4} órdenes más →
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* ═══ ACCIONES RÁPIDAS — 2x2 grid ═══ */}
      <div className="acciones-campo" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
        {[
          { icon:"📋", label:"Registrar trabajo", color:"#2d5a1b", bg:"#f0f8e8", onClick:abrirTrabajo },
          { icon:"⛽", label:"Registrar diesel",   color:"#e67e22", bg:"#fef5ed", onClick:abrirDiesel },
          { icon:"🛒", label:"Solicitar compra",   color:"#8e44ad", bg:"#f5f0fa", onClick:()=>nav("flujos") },
          { icon:"📍", label:"Ver mis lotes",       color:"#1a6ea8", bg:"#edf4fb", onClick:()=>nav("lotes") },
          { icon:"✅", label:"Asistencia",          color:"#16a085", bg:"#e8f6f3", onClick:()=>nav("operadores"), fullWidth:true },
        ].map(b => (
          <button key={b.label} onClick={b.onClick}
            style={{
              minHeight: isMobile ? 92 : 115,
              width: "100%",
              padding: isMobile ? "14px 12px" : "16px 12px",
              border: isMobile ? "1px solid #ede5d8" : "none",
              borderRadius:10,
              background:"#ffffff",
              boxShadow: isMobile ? "0 1px 4px rgba(26,58,15,0.04)" : "0 2px 8px rgba(0,0,0,0.07)",
              cursor:"pointer",
              display:"flex",
              flexDirection: "column",
              alignItems:"flex-start",
              justifyContent: "center",
              gap: 8,
              transition:"transform 0.12s, box-shadow 0.12s",
              borderTop: isMobile ? "1px solid #ede5d8" : `4px solid ${b.color}`,
              position:"relative",
              overflow:"hidden",
              touchAction: "manipulation",
              gridColumn: b.fullWidth ? "1 / -1" : undefined,
            }}
            onTouchStart={e=>{e.currentTarget.style.transform="scale(0.96)";}}
            onTouchEnd={e=>{e.currentTarget.style.transform="scale(1)";}}
            onMouseDown={e=>{e.currentTarget.style.transform="scale(0.96)";}}
            onMouseUp={e=>{e.currentTarget.style.transform="scale(1)";}}
            onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";}}>
            <div style={{
              width: isMobile ? 36 : 56,
              height: isMobile ? 36 : 56,
              borderRadius: isMobile ? 0 : "50%",
              background: isMobile ? "transparent" : b.bg,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize: isMobile ? 24 : 30,
              flexShrink: 0
            }}>{b.icon}</div>
            <span style={{
              fontSize: 13,
              fontWeight: isMobile ? 500 : 700,
              color: isMobile ? "#1a2e1a" : "#3d3525",
              textAlign: "left",
              lineHeight:1.25,
              fontFamily: isMobile ? "Georgia, serif" : "inherit",
            }}>{b.label}</span>
          </button>
        ))}
      </div>

      {/* ═══ RESUMEN DEL DÍA — 3 cards compactas ═══ */}
      <div style={{
        fontSize:11,fontWeight:700,color:"#8a8070",
        textTransform:"uppercase",letterSpacing:1,
        marginBottom:10,paddingLeft:4
      }}>Resumen del día</div>
      <div style={{display:"grid",gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)",gap:10,marginBottom:20}}>
        <div style={{
          padding:"14px 10px",background:"white",borderRadius:12,textAlign:"center",
          borderTop:"3px solid #2d5a1b",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"
        }}>
          <div style={{fontSize:22,marginBottom:4}}>📋</div>
          <div style={{fontSize:26,fontWeight:700,color:"#2d5a1b",
            fontFamily:"Georgia, serif",lineHeight:1}}>{bitHoy.length}</div>
          <div style={{fontSize:10,color:"#8a8070",fontWeight:600,marginTop:6,letterSpacing:0.3}}>TRABAJOS HOY</div>
        </div>
        <div style={{
          padding:"14px 10px",background:"white",borderRadius:12,textAlign:"center",
          borderTop:"3px solid #e67e22",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"
        }}>
          <div style={{fontSize:22,marginBottom:4}}>⛽</div>
          <div style={{fontSize:26,fontWeight:700,color:"#e67e22",
            fontFamily:"Georgia, serif",lineHeight:1}}>
            {litrosHoy.toFixed(0)}<span style={{fontSize:13}}>L</span>
          </div>
          <div style={{fontSize:10,color:"#8a8070",fontWeight:600,marginTop:6,letterSpacing:0.3}}>DIESEL HOY</div>
        </div>
        <div style={{
          padding:"14px 10px",background:"white",borderRadius:12,textAlign:"center",
          borderTop:`3px solid ${alertasLotes>0?"#c0392b":"#4a8c2a"}`,
          boxShadow:"0 1px 4px rgba(0,0,0,0.05)",
          cursor:alertasLotes>0?"pointer":"default"
        }}
          onClick={alertasLotes>0?()=>nav("lotes"):undefined}>
          <div style={{fontSize:22,marginBottom:4}}>{alertasLotes>0?"⚠️":"✅"}</div>
          <div style={{fontSize:26,fontWeight:700,
            color:alertasLotes>0?"#c0392b":"#2d5a1b",
            fontFamily:"Georgia, serif",lineHeight:1}}>{alertasLotes}</div>
          <div style={{fontSize:10,color:"#8a8070",fontWeight:600,marginTop:6,letterSpacing:0.3}}>ALERTAS LOTES</div>
        </div>
      </div>

      {/* ═══ ÚLTIMOS REGISTROS ═══ */}
      <div style={{
        fontSize:11,fontWeight:700,color:"#8a8070",
        textTransform:"uppercase",letterSpacing:1,
        marginBottom:10,paddingLeft:4,
        display:"flex",justifyContent:"space-between",alignItems:"center"
      }}>
        <span>Últimos registros</span>
        {bitHoy.length > 5 && (
          <span onClick={()=>nav("bitacora")}
            style={{color:"#1a6ea8",cursor:"pointer",fontSize:11,letterSpacing:0}}>
            Ver todos ({bitHoy.length}) →
          </span>
        )}
      </div>
      <div style={{background:"white",borderRadius:12,boxShadow:"0 1px 4px rgba(0,0,0,0.05)",overflow:"hidden"}}>
        {ultimos.length === 0 ? (
          <div style={{padding:"36px 20px",textAlign:"center",color:"#8a8070"}}>
            <div style={{fontSize:42,marginBottom:10,opacity:0.5}}>🌱</div>
            <div style={{fontSize:14,fontWeight:700,color:"#3d3525"}}>Sin registros hoy</div>
            <div style={{fontSize:12,marginTop:6}}>Toca "Registrar trabajo" arriba para empezar</div>
          </div>
        ) : ultimos.map((b,i) => {
          const ids = Array.isArray(b.loteIds) ? b.loteIds : (b.loteId ? [b.loteId] : []);
          const nomLotes = ids.slice(0,2).map(lid => {
            const l = lotes.find(x => String(x.id) === String(lid));
            return l ? (l.apodo && l.apodo !== "NO DEFINIDO" ? l.apodo : l.folioCorto) : "";
          }).filter(Boolean).join(", ");
          const titulo = b.tipo === "insumo" ? (b.data?.producto || "Aplicación insumo")
            : b.tipo === "diesel" ? `${b.data?.litros || 0}L diesel`
            : b.tipo === "fenol" ? (b.data?.fenologia || "Fenología")
            : b.tipo === "riego" ? `Riego ${b.data?.horasRiego || 0}h`
            : b.tipo === "reporte" ? (b.data?.titulo || "Reporte")
            : b.tipo === "foto" ? "Foto" : "Registro";
          return (
            <div key={b.id} style={{
              display:"flex",
              alignItems:"center",
              gap:14,
              padding:"14px 16px",
              borderBottom: i < ultimos.length - 1 ? `1px solid ${T.line}` : "none"
            }}>
              <div style={{
                width:44,height:44,borderRadius:"50%",
                background:"#faf8f3",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:22,flexShrink:0
              }}>
                {iconoTipo[b.tipo] || "📋"}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:700,color:"#3d3525",
                  whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{titulo}</div>
                <div style={{fontSize:12,color:T.fog,marginTop:2,
                  whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                  📍 {nomLotes || "—"}{b.operador && ` · 👷 ${b.operador}`}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══ MODAL: Registrar trabajo ═══ */}
      {modal === "trabajo" && (
        <Modal title="📋 Registrar trabajo" onClose={cerrarModal}
          footer={
            <>
              <button className="btn btn-secondary" onClick={cerrarModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarTrabajo}
                disabled={!formT.loteId}
                style={{fontSize:15,padding:"14px 28px",fontWeight:700,minWidth:140}}>
                💾 Guardar
              </button>
            </>
          }>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {/* Selector visual de tipo */}
            <div>
              <label className="form-label">Tipo de trabajo *</label>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:6}}>
                {[
                  { id:"insumo",  icon:"🌱", label:"Insumo" },
                  { id:"riego",   icon:"💧", label:"Riego" },
                  { id:"fenol",   icon:"🌿", label:"Fenología" },
                  { id:"reporte", icon:"📝", label:"Reporte" },
                  { id:"foto",    icon:"📷", label:"Foto" },
                ].map(t => {
                  const sel = formT.tipo === t.id;
                  return (
                    <button key={t.id} onClick={()=>setFormT(f=>({...f,tipo:t.id}))}
                      style={{
                        padding:"14px 6px",
                        border:`2px solid ${sel?"#2d5a1b":"#ddd5c0"}`,
                        borderRadius:10,
                        background:sel?"#f0f8e8":"white",
                        cursor:"pointer",
                        display:"flex",
                        flexDirection:"column",
                        alignItems:"center",
                        gap:6,
                        transition:"all 0.12s"
                      }}>
                      <span style={{fontSize:24}}>{t.icon}</span>
                      <span style={{fontSize:11,fontWeight:sel?700:500,color:sel?"#2d5a1b":"#5a5040"}}>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <LoteSelector form={formT} setForm={setFormT} colorSel="#2d5a1b"/>

            <div className="form-group">
              <label className="form-label">Operador asignado</label>
              <select className="form-select" value={formT.operadorId}
                onChange={e=>setFormT(f=>({...f,operadorId:e.target.value}))}
                style={{fontSize:15,padding:"12px"}}>
                <option value="">— Sin especificar —</option>
                {operadores.filter(o=>o.activo!==false).map(o => (
                  <option key={o.id} value={o.id}>👷 {o.nombre}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Horas trabajadas</label>
              <input className="form-input" type="number" inputMode="decimal"
                value={formT.horas}
                onChange={e=>setFormT(f=>({...f,horas:e.target.value}))}
                placeholder="0"
                style={{fontSize:18,fontWeight:700,textAlign:"center"}}/>
            </div>

            <div className="form-group">
              <label className="form-label">Notas (opcional)</label>
              <textarea className="form-input" rows={2} value={formT.notas}
                onChange={e=>setFormT(f=>({...f,notas:e.target.value}))}
                placeholder="Observaciones, detalles..."/>
            </div>
          </div>
        </Modal>
      )}

      {/* ═══ MODAL: Registrar diesel ═══ */}
      {modal === "diesel" && (
        <Modal title="⛽ Registrar diesel" onClose={cerrarModal}
          footer={
            <>
              <button className="btn btn-secondary" onClick={cerrarModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarDiesel}
                disabled={!formD.loteId || !formD.litros}
                style={{fontSize:15,padding:"14px 28px",fontWeight:700,minWidth:140,background:"#e67e22"}}>
                💾 Guardar
              </button>
            </>
          }>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {/* Saldo actual + precio visible para contexto */}
            <div style={{
              display:"flex", justifyContent:"space-between", alignItems:"center",
              padding:"8px 12px", background:"#fef5ed", borderRadius:8,
              fontSize:12, color:"#8a5a1b", fontWeight:600,
            }}>
              <span>🛢 Saldo cilindro: <strong>{saldoCilindro.toLocaleString('es-MX')} L</strong></span>
              <span>💰 Precio: <strong>${ultimoPrecioLitro.toFixed(2)}/L</strong></span>
            </div>

            <LoteSelector form={formD} setForm={setFormD} colorSel="#e67e22"/>

            <div className="form-group">
              <label className="form-label">🚜 Tractor / Equipo</label>
              <select className="form-select" value={formD.maquinariaId}
                onChange={e=>setFormD(f=>({...f,maquinariaId:e.target.value}))}
                style={{fontSize:15,padding:"12px"}}>
                <option value="">— Sin especificar —</option>
                {(state.maquinaria||[]).filter(m=>m.estado!=='baja').map(m => (
                  <option key={m.id} value={m.id}>{m.nombre}{m.tipo?` (${m.tipo})`:''}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Litros cargados *</label>
              <input className="form-input" type="number" inputMode="decimal"
                value={formD.litros}
                onChange={e=>setFormD(f=>({...f,litros:e.target.value}))}
                placeholder="0"
                style={{fontSize:22,fontWeight:700,textAlign:"center",color:"#e67e22"}}/>
              {formD.litros && parseFloat(formD.litros) > saldoCilindro && (
                <div style={{fontSize:11,color:"#c0392b",marginTop:4}}>
                  ⚠ Excede el saldo del cilindro
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Operador asignado</label>
              <select className="form-select" value={formD.operadorId}
                onChange={e=>setFormD(f=>({...f,operadorId:e.target.value}))}
                style={{fontSize:15,padding:"12px"}}>
                <option value="">— Sin especificar —</option>
                {operadores.filter(o=>o.activo!==false).map(o => (
                  <option key={o.id} value={o.id}>👷 {o.nombre}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Horas de maquinaria</label>
              <input className="form-input" type="number" inputMode="decimal"
                value={formD.horas}
                onChange={e=>setFormD(f=>({...f,horas:e.target.value}))}
                placeholder="0"
                style={{fontSize:18,fontWeight:700,textAlign:"center"}}/>
            </div>

            <div className="form-group">
              <label className="form-label">Notas (opcional)</label>
              <textarea className="form-input" rows={2} value={formD.notas}
                onChange={e=>setFormD(f=>({...f,notas:e.target.value}))}
                placeholder="Actividad, maquinaria usada..."/>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
