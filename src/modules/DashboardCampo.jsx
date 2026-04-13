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


export default function DashboardCampo({ userRol, usuario, onNavigate }) {
  const { state, dispatch } = useData();
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
  const emptyD = { loteId:"", loteName:"", operadorId:"", litros:"", horas:"", notas:"" };
  const [formT, setFormT] = useState(emptyT);
  const [formD, setFormD] = useState(emptyD);
  const [busqLote, setBusqLote] = useState("");

  const abrirTrabajo = () => { setFormT(emptyT); setBusqLote(""); setModal("trabajo"); };
  const abrirDiesel  = () => { setFormD(emptyD); setBusqLote(""); setModal("diesel"); };
  const cerrarModal  = () => { setModal(null); setBusqLote(""); };

  const nav = (page) => onNavigate && onNavigate(page);

  const guardarTrabajo = () => {
    if (!formT.loteId) return;
    const op = operadores.find(o => String(o.id) === String(formT.operadorId));
    dispatch({ type:"ADD_BITACORA", payload:{
      tipo: formT.tipo,
      loteId: parseInt(formT.loteId),
      loteIds: [parseInt(formT.loteId)],
      fecha: hoy,
      operador: op?.nombre || usuario?.nombre || "",
      operadorId: formT.operadorId || "",
      maquinariaId: "",
      horas: parseFloat(formT.horas) || 0,
      notas: formT.notas,
      foto: null,
      data: {},
    }});
    cerrarModal();
  };

  const guardarDiesel = () => {
    if (!formD.loteId || !formD.litros) return;
    const op = operadores.find(o => String(o.id) === String(formD.operadorId));
    const litros = parseFloat(formD.litros) || 0;
    dispatch({ type:"ADD_BITACORA", payload:{
      tipo: "diesel",
      loteId: parseInt(formD.loteId),
      loteIds: [parseInt(formD.loteId)],
      fecha: hoy,
      operador: op?.nombre || usuario?.nombre || "",
      operadorId: formD.operadorId || "",
      maquinariaId: "",
      horas: parseFloat(formD.horas) || 0,
      notas: formD.notas,
      foto: null,
      data: { litros, precioLitro: 27, actividad: "Registro campo" },
    }});
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
    <div>
      {/* ═══ HEADER — saludo ═══ */}
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
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,lineHeight:1.2}}>
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

      {/* ═══ ACCIONES RÁPIDAS — 2x2 grid ═══ */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
        {[
          { icon:"📋", label:"Registrar trabajo", color:"#2d5a1b", bg:"#f0f8e8", onClick:abrirTrabajo },
          { icon:"⛽", label:"Registrar diesel",   color:"#e67e22", bg:"#fef5ed", onClick:abrirDiesel },
          { icon:"🛒", label:"Solicitar compra",   color:"#8e44ad", bg:"#f5f0fa", onClick:()=>nav("flujos") },
          { icon:"📍", label:"Ver mis lotes",       color:"#1a6ea8", bg:"#edf4fb", onClick:()=>nav("lotes") },
        ].map(b => (
          <button key={b.label} onClick={b.onClick}
            style={{
              minHeight:115,
              padding:"16px 12px",
              border:"none",
              borderRadius:14,
              background:"white",
              boxShadow:"0 2px 8px rgba(0,0,0,0.07)",
              cursor:"pointer",
              display:"flex",
              flexDirection:"column",
              alignItems:"center",
              justifyContent:"center",
              gap:10,
              transition:"transform 0.12s, box-shadow 0.12s",
              borderTop:`4px solid ${b.color}`,
              position:"relative",
              overflow:"hidden"
            }}
            onTouchStart={e=>{e.currentTarget.style.transform="scale(0.96)";}}
            onTouchEnd={e=>{e.currentTarget.style.transform="scale(1)";}}
            onMouseDown={e=>{e.currentTarget.style.transform="scale(0.96)";}}
            onMouseUp={e=>{e.currentTarget.style.transform="scale(1)";}}
            onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";}}>
            <div style={{
              width:56,height:56,borderRadius:"50%",
              background:b.bg,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:30
            }}>{b.icon}</div>
            <span style={{fontSize:13,fontWeight:700,color:"#3d3525",textAlign:"center",lineHeight:1.25}}>{b.label}</span>
          </button>
        ))}
      </div>

      {/* ═══ RESUMEN DEL DÍA — 3 cards compactas ═══ */}
      <div style={{
        fontSize:11,fontWeight:700,color:"#8a8070",
        textTransform:"uppercase",letterSpacing:1,
        marginBottom:10,paddingLeft:4
      }}>Resumen del día</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:20}}>
        <div style={{
          padding:"14px 10px",background:"white",borderRadius:12,textAlign:"center",
          borderTop:"3px solid #2d5a1b",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"
        }}>
          <div style={{fontSize:22,marginBottom:4}}>📋</div>
          <div style={{fontSize:26,fontWeight:700,color:"#2d5a1b",
            fontFamily:"'Playfair Display',serif",lineHeight:1}}>{bitHoy.length}</div>
          <div style={{fontSize:10,color:"#8a8070",fontWeight:600,marginTop:6,letterSpacing:0.3}}>TRABAJOS HOY</div>
        </div>
        <div style={{
          padding:"14px 10px",background:"white",borderRadius:12,textAlign:"center",
          borderTop:"3px solid #e67e22",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"
        }}>
          <div style={{fontSize:22,marginBottom:4}}>⛽</div>
          <div style={{fontSize:26,fontWeight:700,color:"#e67e22",
            fontFamily:"'Playfair Display',serif",lineHeight:1}}>
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
            fontFamily:"'Playfair Display',serif",lineHeight:1}}>{alertasLotes}</div>
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
            <LoteSelector form={formD} setForm={setFormD} colorSel="#e67e22"/>

            <div className="form-group">
              <label className="form-label">Litros cargados *</label>
              <input className="form-input" type="number" inputMode="decimal"
                value={formD.litros}
                onChange={e=>setFormD(f=>({...f,litros:e.target.value}))}
                placeholder="0"
                style={{fontSize:22,fontWeight:700,textAlign:"center",color:"#e67e22"}}/>
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
