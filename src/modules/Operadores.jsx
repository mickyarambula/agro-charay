// ─── modules/Operadores.jsx ───────────────────────────────────────────

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
import { updateTarifaStd } from '../core/supabaseWriters.js';


export default function OperadoresModule({ userRol, puedeEditar }) {
  const { state, dispatch } = useData();
  const isMobile = useIsMobile();
  const hoy    = new Date().toISOString().split("T")[0];
  const mxnFmt = n => (parseFloat(n)||0).toLocaleString("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:2,maximumFractionDigits:2});

  // ── TODOS LOS HOOKS AL INICIO ──────────────────────────────────────────────
  const [vista,       setVista]       = useState("resumen");
  const [modalOp,     setModalOp]     = useState(false);
  const [selOp,       setSelOp]       = useState(null);
  const [modalTarifa, setModalTarifa] = useState(false);
  const [formTarifa,  setFormTarifa]  = useState({normal:"600",especial:"750"});
  // Asistencia
  const [fechaA,    setFechaA]    = useState(hoy);
  const [marcas,    setMarcas]    = useState({}); // {opId: {activo, tarifa, nota, loteId, trabajo}}
  const [loteGlobal,setLoteGlobal]= useState("");
  const [trabajoGlobal,setTrabajoGlobal]=useState("");
  // Semana
  const [semSel,    setSemSel]    = useState("");
  // Historial
  const [opFiltro,  setOpFiltro]  = useState("");

  const operadores  = state.operadores  || [];
  const asistencias = state.asistencias || [];
  const pagosSemana = state.pagosSemana || [];
  const lotes       = state.lotes       || [];
  const tarifaStd   = state.tarifaStd   || { normal:600, especial:750 };

  const emptyOp = { nombre:"", puesto:"Operador de Tractor", telefono:"",
    salarioDia:tarifaStd.normal, tarifaEspecial:tarifaStd.especial,
    activo:true, maquinaAsignada:"", notas:"" };
  const [formOp, setFormOp] = useState(emptyOp);

  // ── HELPERS ────────────────────────────────────────────────────────────────
  const semanaDeF = f => {
    if(!f) return "";
    const d = new Date(f+"T12:00:00");
    const startOfYear = new Date(d.getFullYear(),0,1);
    const w = Math.ceil(((d - startOfYear)/86400000 + startOfYear.getDay()+1)/7);
    return `${d.getFullYear()}-W${String(w).padStart(2,"0")}`;
  };
  const labelSemana = sem => {
    if(!sem) return "";
    const [year,wStr] = sem.split("-W"); const w=parseInt(wStr);
    const d = new Date(parseInt(year),0,1+(w-1)*7);
    const mon = new Date(d); mon.setDate(d.getDate()-(d.getDay()||7)+1);
    const sat = new Date(mon); sat.setDate(mon.getDate()+5);
    const fmt = x=>x.toLocaleDateString("es-MX",{day:"2-digit",month:"short"});
    return `${fmt(mon)} – ${fmt(sat)}`;
  };
  const esDomingoOFestivo = f => {
    if(!f) return false;
    return new Date(f+"T12:00:00").getDay()===0;
  };

  // ── CÁLCULOS ───────────────────────────────────────────────────────────────
  // Cálculo de pago de un operador en una semana
  const calcPagoOp = (opId, semana) => {
    const op = operadores.find(o=>o.id===opId);
    if(!op) return {dias:0,total:0,detalle:[]};
    const asis = asistencias.filter(a=>String(a.operadorId)===String(opId)&&semanaDeF(a.fecha)===semana);
    const dias  = asis.length;
    const total = asis.reduce((s,a)=>s+(parseFloat(a.tarifaDia)||op.salarioDia||0),0);
    return {dias, total, detalle:asis};
  };

  // Semanas únicas con asistencias
  const semanasUnicas = [...new Set(asistencias.map(a=>semanaDeF(a.fecha)).filter(Boolean))].sort().reverse();
  const semanaActual  = semanaDeF(hoy);

  // Inicializar semSel
  React.useEffect(()=>{ if(!semSel) setSemSel(semanaActual); },[semanaActual]);

  // Saldo pendiente por operador (trabajó pero no fue incluido en pago)
  const saldoPendienteOp = opId => {
    const op = operadores.find(o=>o.id===opId);
    if(!op) return 0;
    const totalDevengado = asistencias
      .filter(a=>String(a.operadorId)===String(opId))
      .reduce((s,a)=>s+(parseFloat(a.tarifaDia)||op.salarioDia||0),0);
    const totalPagado = pagosSemana
      .filter(p=>p.pagado)
      .reduce((s,p)=>{
        const det = (p.detalle||[]).find(d=>String(d.operadorId)===String(opId));
        return s+(det?parseFloat(det.total)||0:0);
      },0);
    return Math.max(0, totalDevengado - totalPagado);
  };

  // Totales globales
  const totalPagadoCiclo   = pagosSemana.filter(p=>p.pagado).reduce((s,p)=>s+(parseFloat(p.total)||0),0);
  const totalPendienteCiclo= operadores.reduce((s,op)=>s+saldoPendienteOp(op.id),0);

  // Asistencias del día (para cargar en el form de asistencia)
  const asistDia = asistencias.filter(a=>a.fecha===fechaA);

  // Cargar marcas cuando cambia el día
  React.useEffect(()=>{
    const m={};
    asistDia.forEach(a=>{
      m[a.operadorId]={activo:true, tarifaDia:a.tarifaDia, nota:a.nota||"", loteId:a.loteId||"", trabajo:a.trabajo||""};
    });
    setMarcas(m); setLoteGlobal(""); setTrabajoGlobal("");
  },[fechaA, asistencias.length]);

  // ── GUARDAR OPERADOR ────────────────────────────────────────────────────────
  const saveOp = () => {
    if(!formOp.nombre.trim()) return;
    const p = {...formOp, salarioDia:parseFloat(formOp.salarioDia)||tarifaStd.normal,
      tarifaEspecial:parseFloat(formOp.tarifaEspecial)||tarifaStd.especial};
    if(selOp) dispatch({type:"UPD_OPER",payload:{...p,id:selOp.id}});
    else dispatch({type:"ADD_OPER",payload:p});
    setModalOp(false); setSelOp(null); setFormOp(emptyOp);
  };

  // ── TabBar ──────────────────────────────────────────────────────────────────
  const TabBar = () => (
    <div style={{display:"flex",gap:4,marginBottom:16,flexWrap:"wrap"}}>
      {[["resumen","📊 Resumen"],["asistencia","✅ Asistencia"],
        ["semana","💵 Semana de Pago"],["historial","📋 Historial"],["operadores","👷 Operadores"]
      ].map(([id,label])=>(
        <button key={id} onClick={()=>setVista(id)}
          className={`btn btn-sm ${vista===id?"btn-primary":"btn-secondary"}`}
          style={{fontWeight:vista===id?700:400}}>
          {label}
        </button>
      ))}
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // VISTA: RESUMEN
  // ══════════════════════════════════════════════════════════════════════════
  if(vista==="resumen") {
    const semAnterior = semanasUnicas[1]||"";
    const totalSemActual = operadores.reduce((s,op)=>s+calcPagoOp(op.id,semanaActual).total,0);
    const totalSemAnt    = semAnterior ? operadores.reduce((s,op)=>s+calcPagoOp(op.id,semAnterior).total,0) : 0;
    const diff = totalSemActual - totalSemAnt;

    return (
      <div>
        <TabBar/>
        {/* KPIs */}
        <div className="stat-grid" style={{gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)",marginBottom:16}}>
          <div className="stat-card green">
            <div className="stat-icon">👷</div><div className="stat-label">Operadores Activos</div>
            <div className="stat-value">{operadores.filter(o=>o.activo).length}</div>
            <div className="stat-sub">{operadores.length} registrados</div>
          </div>
          <div className="stat-card sky">
            <div className="stat-icon">📅</div><div className="stat-label">Semana Actual</div>
            <div className="stat-value" style={{fontSize:15}}>{mxnFmt(totalSemActual)}</div>
            <div className="stat-sub">{asistencias.filter(a=>semanaDeF(a.fecha)===semanaActual).length} jornadas</div>
          </div>
          <div className="stat-card gold">
            <div className="stat-icon">⏳</div><div className="stat-label">Saldo Pendiente</div>
            <div className="stat-value" style={{fontSize:15}}>{mxnFmt(totalPendienteCiclo)}</div>
            <div className="stat-sub">por pagar a operadores</div>
          </div>
          <div className="stat-card rust">
            <div className="stat-icon">✅</div><div className="stat-label">Pagado en el Ciclo</div>
            <div className="stat-value" style={{fontSize:15}}>{mxnFmt(totalPagadoCiclo)}</div>
            <div className="stat-sub">{pagosSemana.filter(p=>p.pagado).length} semanas</div>
          </div>
        </div>

        {/* Comparativo semanas */}
        {semAnterior && (
          <div style={{marginBottom:16,padding:"12px 16px",borderRadius:10,
            background:diff<=0?"#f0f7ec":"#fdf0ef",
            border:`1px solid ${diff<=0?"#4a8c2a33":"#c0392b33"}`,
            display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:diff<=0?"#2d5a1b":"#c0392b"}}>
                {diff<=0?"📉 Costo semana actual menor que la anterior":"📈 Costo semana actual mayor que la anterior"}
              </div>
              <div style={{fontSize:11,color:T.fog,marginTop:2}}>
                Semana actual: {mxnFmt(totalSemActual)} vs anterior: {mxnFmt(totalSemAnt)}
              </div>
            </div>
            <div style={{fontFamily:"monospace",fontWeight:700,fontSize:16,color:diff<=0?"#2d5a1b":"#c0392b"}}>
              {diff>0?"+":""}{mxnFmt(diff)}
            </div>
          </div>
        )}

        {/* Saldo por operador */}
        <div className="card" style={{marginBottom:16}}>
          <div className="card-header">
            <div className="card-title">Saldo por Operador</div>
            <span style={{fontSize:11,color:T.fog}}>devengado menos pagado</span>
          </div>
          <div style={{padding:0}}>
            {operadores.filter(o=>o.activo).map((o,i)=>{
              const saldo = saldoPendienteOp(o.id);
              const jornadas = asistencias.filter(a=>String(a.operadorId)===String(o.id)).length;
              const bg=i%2===0?"white":"#faf8f3";
              return (
                <div key={o.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px",
                  borderBottom:`1px solid ${T.line}`,background:bg}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:13}}>👷 {o.nombre}</div>
                    <div style={{fontSize:11,color:T.fog}}>{o.puesto} · {jornadas} jornadas este ciclo</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:"monospace",fontWeight:700,fontSize:14,
                      color:saldo>0?"#c0392b":"#2d5a1b"}}>
                      {saldo>0?mxnFmt(saldo):"Al corriente ✅"}
                    </div>
                    {saldo>0&&<div style={{fontSize:10,color:T.fog}}>pendiente</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Últimas semanas */}
        {semanasUnicas.length > 0 && (
          <div className="card">
            <div className="card-header"><div className="card-title">Semanas Recientes</div></div>
            <div className="table-wrap-scroll">
              <table>
                <thead><tr>
                  <th>Semana</th><th style={{textAlign:"right"}}>Jornadas</th>
                  <th style={{textAlign:"right"}}>Operadores</th>
                  <th style={{textAlign:"right"}}>Total</th><th>Estado</th><th></th>
                </tr></thead>
                <tbody>
                  {semanasUnicas.slice(0,6).map((sem,i)=>{
                    const asem = asistencias.filter(a=>semanaDeF(a.fecha)===sem);
                    const opsN = [...new Set(asem.map(a=>a.operadorId))].length;
                    const tot  = operadores.reduce((s,op)=>s+calcPagoOp(op.id,sem).total,0);
                    const pag  = pagosSemana.some(p=>p.semana===sem&&p.pagado);
                    const bg   = i%2===0?"white":"#faf8f3";
                    return (
                      <tr key={sem} style={{cursor:"pointer"}}
                        onClick={()=>{setSemSel(sem);setVista("semana");}}>
                        <td style={{background:bg,fontWeight:600}}>{labelSemana(sem)}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace"}}>{asem.length}</td>
                        <td style={{background:bg,textAlign:"right"}}>{opsN}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:700,color:"#c0392b"}}>{mxnFmt(tot)}</td>
                        <td style={{background:bg}}>
                          <span style={{padding:"2px 8px",borderRadius:8,fontSize:11,fontWeight:600,
                            background:pag?"#d4edda":"#fff3cd",color:pag?"#155724":"#856404"}}>
                            {pag?"✅ Pagado":"⏳ Pendiente"}
                          </span>
                        </td>
                        <td style={{background:bg}}>
                          <button className="btn btn-sm btn-secondary"
                            onClick={e=>{e.stopPropagation();setSemSel(sem);setVista("semana");}}>
                            Ver →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {asistencias.length===0&&(
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <div className="empty-title">Sin asistencias registradas</div>
            <div className="empty-sub">Empieza registrando la asistencia del día</div>
            <button className="btn btn-primary" onClick={()=>setVista("asistencia")}>Registrar Asistencia</button>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VISTA: REGISTRAR ASISTENCIA
  // ══════════════════════════════════════════════════════════════════════════
  if(vista==="asistencia") {
    const opsActivos = operadores.filter(o=>o.activo);
    const esDom = esDomingoOFestivo(fechaA);
    const totalDia = opsActivos.reduce((s,op)=>{
      const m = marcas[op.id];
      if(!m?.activo) return s;
      return s+(parseFloat(m.tarifaDia)||op.salarioDia||0);
    },0);

    const aplicarGlobal = () => {
      const nuevo = {...marcas};
      opsActivos.forEach(op=>{
        if(nuevo[op.id]?.activo) {
          if(loteGlobal)   nuevo[op.id] = {...nuevo[op.id], loteId:loteGlobal};
          if(trabajoGlobal) nuevo[op.id] = {...nuevo[op.id], trabajo:trabajoGlobal};
        }
      });
      setMarcas(nuevo);
    };

    const marcarTodos = () => {
      const m={};
      opsActivos.forEach(op=>{
        m[op.id]={activo:true, tarifaDia:esDom?(op.tarifaEspecial||op.salarioDia):op.salarioDia,
          nota:esDom?"Domingo/festivo":"", loteId:loteGlobal, trabajo:trabajoGlobal};
      });
      setMarcas(m);
    };

    const guardarDia = () => {
      asistDia.forEach(a=>dispatch({type:"DEL_ASISTENCIA",payload:a.id}));
      Object.entries(marcas).forEach(([opId,m])=>{
        if(!m?.activo) return;
        const op = operadores.find(o=>String(o.id)===String(opId));
        dispatch({type:"ADD_ASISTENCIA",payload:{
          fecha:fechaA, operadorId:parseInt(opId),
          tarifaDia: parseFloat(m.tarifaDia)||op?.salarioDia||0,
          nota:m.nota||"", loteId:m.loteId||"", trabajo:m.trabajo||"",
        }});
      });
      setVista("resumen");
    };

    return (
      <div>
        <TabBar/>
        {/* Cabecera: fecha + info semana */}
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12,flexWrap:"wrap"}}>
          <div style={{fontFamily:"Georgia, serif",fontSize:18,fontWeight:700,flex:1}}>
            Registrar Asistencia
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <input type="date" className="form-input" value={fechaA}
              onChange={e=>setFechaA(e.target.value)} style={{width:160}}/>
            {esDom&&<span style={{padding:"3px 10px",borderRadius:8,background:"#fff3cd",
              color:"#856404",fontSize:11,fontWeight:700}}>🟡 Domingo/Festivo</span>}
          </div>
        </div>

        <div style={{marginBottom:12,padding:"8px 14px",background:T.mist,borderRadius:8,
          display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <span style={{fontSize:12,color:T.fog}}>
            Semana: <strong style={{color:T.ink}}>{labelSemana(semanaDeF(fechaA))}</strong>
            {asistDia.length>0&&<span style={{marginLeft:8,color:"#2d5a1b"}}>· {asistDia.length} ya registrados</span>}
          </span>
          {totalDia>0&&<span style={{fontFamily:"monospace",fontWeight:700,color:"#2d5a1b"}}>
            Total del día: {mxnFmt(totalDia)}
          </span>}
        </div>

        {/* Controles globales */}
        <div style={{marginBottom:12,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",
          padding:"10px 14px",background:"#f9f7f2",borderRadius:8,border:`1px solid ${T.line}`}}>
          <span style={{fontSize:11,color:T.fog,fontWeight:600,whiteSpace:"nowrap"}}>Aplicar a todos los marcados:</span>
          <select className="form-select" style={{width:160,height:32,fontSize:12}}
            value={loteGlobal} onChange={e=>setLoteGlobal(e.target.value)}>
            <option value="">Lote (opcional)</option>
            {lotes.map(l=><option key={l.id} value={l.id}>{l.apodo||l.docLegal}</option>)}
          </select>
          <input className="form-input" placeholder="Trabajo del día..." style={{flex:1,minWidth:140,height:32,fontSize:12}}
            value={trabajoGlobal} onChange={e=>setTrabajoGlobal(e.target.value)}/>
          <button className="btn btn-sm btn-secondary" onClick={aplicarGlobal}>Aplicar →</button>
          <button className="btn btn-sm btn-secondary" onClick={marcarTodos}
            style={{background:"#f0f7ec",border:"1px solid #4a8c2a44",color:"#2d5a1b",fontWeight:600}}>
            ✅ Marcar todos {esDom?"(especial)":""}
          </button>
          <button className="btn btn-sm btn-secondary" onClick={()=>setMarcas({})}>✕ Limpiar</button>
        </div>

        {opsActivos.length===0 ? (
          <div className="empty-state">
            <div className="empty-icon">👷</div><div className="empty-title">Sin operadores activos</div>
            <button className="btn btn-primary" onClick={()=>setVista("operadores")}>Agregar operadores</button>
          </div>
        ) : (
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                {new Date(fechaA+"T12:00:00").toLocaleDateString("es-MX",{weekday:"long",day:"2-digit",month:"long",year:"numeric"})}
              </div>
              <span style={{fontSize:11,color:T.fog}}>{Object.values(marcas).filter(m=>m?.activo).length} marcados</span>
            </div>
            <div style={{padding:0}}>
              {opsActivos.map((op,i)=>{
                const m   = marcas[op.id]||{};
                const act = !!m.activo;
                const bg  = act ? (esDom?"#fff8e1":"#f0f7ec") : (i%2===0?"white":"#faf8f3");
                return (
                  <div key={op.id} style={{borderBottom:`1px solid ${T.line}`,background:bg,transition:"background 0.15s"}}>
                    {/* Fila principal */}
                    <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",flexWrap:"wrap"}}>
                      {/* Checkbox visual */}
                      <div onClick={()=>{
                        if(act) {
                          const n={...marcas}; delete n[op.id]; setMarcas(n);
                        } else {
                          setMarcas(m2=>({...m2,[op.id]:{activo:true,
                            tarifaDia:esDom?(op.tarifaEspecial||op.salarioDia):op.salarioDia,
                            nota:esDom?"Domingo/festivo":"", loteId:loteGlobal, trabajo:trabajoGlobal}}));
                        }
                      }} style={{width:24,height:24,borderRadius:6,border:`2px solid ${act?"#2d5a1b":"#ddd"}`,
                        background:act?"#2d5a1b":"white",cursor:"pointer",flexShrink:0,
                        display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontSize:14}}>
                        {act?"✓":""}
                      </div>
                      {/* Nombre */}
                      <div style={{flex:"0 0 180px"}}>
                        <div style={{fontWeight:700,fontSize:13}}>👷 {op.nombre}</div>
                        <div style={{fontSize:11,color:T.fog}}>{op.puesto}</div>
                      </div>
                      {/* Tarifa — editable si está marcado */}
                      {act ? (
                        <div style={{display:"flex",alignItems:"center",gap:6,flex:"0 0 auto"}}>
                          <span style={{fontSize:11,color:T.fog}}>$</span>
                          <input type="number" className="form-input"
                            style={{width:90,height:30,fontSize:12,textAlign:"right"}}
                            value={m.tarifaDia||op.salarioDia}
                            onChange={e=>setMarcas(mm=>({...mm,[op.id]:{...mm[op.id],tarifaDia:e.target.value}}))}/>
                          <span style={{fontSize:11,color:T.fog}}>/día</span>
                          {parseFloat(m.tarifaDia)!==(op.salarioDia||0)&&(
                            <span style={{fontSize:10,color:"#e67e22",fontWeight:700}}>ajustado</span>
                          )}
                        </div>
                      ) : (
                        <div style={{fontSize:12,color:T.fog,flex:"0 0 auto"}}>
                          {mxnFmt(op.salarioDia)}/día
                        </div>
                      )}
                      {/* Lote y trabajo — si está marcado */}
                      {act&&(
                        <div style={{display:"flex",gap:6,flex:1,minWidth:200,flexWrap:"wrap"}}>
                          <input className="form-input" placeholder="Trabajo..." style={{flex:1,minWidth:120,height:30,fontSize:12}}
                            value={m.trabajo||""}
                            onChange={e=>setMarcas(mm=>({...mm,[op.id]:{...mm[op.id],trabajo:e.target.value}}))}/>
                          <select className="form-select" style={{width:125,height:30,fontSize:11}}
                            value={m.loteId||""}
                            onChange={e=>setMarcas(mm=>({...mm,[op.id]:{...mm[op.id],loteId:e.target.value}}))}>
                            <option value="">Lote...</option>
                            {lotes.map(l=><option key={l.id} value={l.id}>{l.apodo||l.docLegal}</option>)}
                          </select>
                          <select className="form-select" style={{width:125,height:30,fontSize:11}}
                            value={m.maquinariaId||""}
                            onChange={e=>setMarcas(mm=>({...mm,[op.id]:{...mm[op.id],maquinariaId:e.target.value}}))}>
                            <option value="">🚜 Máquina...</option>
                            {(state.maquinaria||[]).map(mq=><option key={mq.id} value={mq.id}>{mq.nombre}</option>)}
                          </select>
                          <input className="form-input" placeholder="Nota..." style={{width:90,height:30,fontSize:11}}
                            value={m.nota||""}
                            onChange={e=>setMarcas(mm=>({...mm,[op.id]:{...mm[op.id],nota:e.target.value}}))}/>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Footer */}
            <div style={{padding:"12px 16px",background:"#f0f7ec",borderTop:`1px solid ${T.line}`,
              display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
              <div style={{fontSize:13}}>
                <strong style={{color:"#2d5a1b"}}>{Object.values(marcas).filter(m=>m?.activo).length}</strong>
                <span style={{color:T.fog}}> operadores · </span>
                <strong style={{color:"#c0392b",fontFamily:"monospace"}}>{mxnFmt(totalDia)}</strong>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button className="btn btn-secondary" onClick={()=>setVista("resumen")}>Cancelar</button>
                <button className="btn btn-primary" onClick={guardarDia}
                  disabled={Object.values(marcas).filter(m=>m?.activo).length===0}>
                  💾 Guardar Asistencia
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VISTA: SEMANA DE PAGO
  // ══════════════════════════════════════════════════════════════════════════
  if(vista==="semana") {
    const semsDisp   = [...new Set([semanaActual,...semanasUnicas])].sort().reverse();
    const semSelReal = semSel||semanaActual;
    const opsConAsis = operadores.filter(op=>calcPagoOp(op.id,semSelReal).dias>0);
    const pagadaSem  = pagosSemana.find(p=>p.semana===semSelReal&&p.pagado);
    const totalSem   = opsConAsis.reduce((s,op)=>s+calcPagoOp(op.id,semSelReal).total,0);
    // Semana anterior para comparar
    const idx = semsDisp.indexOf(semSelReal);
    const semAnt = semsDisp[idx+1]||"";
    const totalAnt = semAnt ? operadores.reduce((s,op)=>s+calcPagoOp(op.id,semAnt).total,0) : 0;

    const registrarPago = () => {
      const payload = {
        semana:semSelReal, label:labelSemana(semSelReal),
        fechaPago:hoy, total:totalSem, pagado:true,
        detalle:opsConAsis.map(op=>({...calcPagoOp(op.id,semSelReal),operadorId:op.id,nombre:op.nombre})),
      };
      const prev=pagosSemana.find(p=>p.semana===semSelReal);
      if(prev) dispatch({type:"UPD_PAGO_SEM",payload:{...prev,...payload}});
      else {
        dispatch({type:"ADD_PAGO_SEM",payload});
        // Solo crear egreso si es pago nuevo (no actualización)
        const cid = state.cicloActivoId||1;
        // Verificar que no exista ya un egreso de esta semana
        const egresoExistente = (state.egresosManual||[]).find(e=>e.semana===semSelReal&&e.origen==="nomina");
        if(!egresoExistente) {
          dispatch({type:"ADD_EGRESO", payload:{
            id: Date.now(),
            fecha: hoy,
            concepto: `Nómina operadores — ${labelSemana(semSelReal)}`,
            monto: totalSem,
            categoria: "mano_obra",
            cicloId: cid,
            productorId: null,
            formaPago: "contado",
            notas: `${opsConAsis.length} operadores · ${opsConAsis.reduce((s,op)=>s+calcPagoOp(op.id,semSelReal).dias,0)} jornadas`,
            origen: "nomina",
            semana: semSelReal,
          }});
        }
      }
    };

    return (
      <div>
        <TabBar/>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
          <div style={{fontFamily:"Georgia, serif",fontSize:18,fontWeight:700,flex:1}}>Semana de Pago</div>
          <select className="form-select" style={{width:230}} value={semSelReal} onChange={e=>setSemSel(e.target.value)}>
            {semsDisp.map(s=><option key={s} value={s}>{labelSemana(s)}</option>)}
          </select>
        </div>

        {/* Estado + comparativo */}
        <div style={{display:"grid",gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",gap:12,marginBottom:16}}>
          <div style={{padding:"12px 16px",borderRadius:10,
            background:pagadaSem?"#d4edda":"#fff8e1",
            border:`1px solid ${pagadaSem?"#c3e6cb":"#ffeaa7"}`,
            display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontWeight:700,color:pagadaSem?"#155724":"#856404"}}>
                {pagadaSem?"✅ Semana pagada":"⏳ Pendiente de pago"}
              </div>
              {pagadaSem&&<div style={{fontSize:11,color:"#155724"}}>Registrado: {pagadaSem.fechaPago}</div>}
            </div>
            <div style={{fontFamily:"Georgia, serif",fontSize:22,fontWeight:800,
              color:pagadaSem?"#155724":"#c0392b"}}>{mxnFmt(totalSem)}</div>
          </div>
          {semAnt&&(
            <div style={{padding:"12px 16px",borderRadius:10,background:T.mist,border:`1px solid ${T.line}`,
              display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontWeight:600,fontSize:12}}>vs semana anterior</div>
                <div style={{fontSize:11,color:T.fog}}>{labelSemana(semAnt)}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontFamily:"monospace",fontSize:13,color:T.fog}}>{mxnFmt(totalAnt)}</div>
                <div style={{fontFamily:"monospace",fontWeight:700,fontSize:13,
                  color:totalSem>totalAnt?"#c0392b":"#2d5a1b"}}>
                  {totalSem>totalAnt?"+":""}{mxnFmt(totalSem-totalAnt)}
                </div>
              </div>
            </div>
          )}
        </div>

        {opsConAsis.length===0 ? (
          <div className="empty-state">
            <div className="empty-icon">📅</div>
            <div className="empty-title">Sin asistencias esta semana</div>
            <button className="btn btn-primary" onClick={()=>setVista("asistencia")}>Registrar Asistencia</button>
          </div>
        ) : (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Planilla — {labelSemana(semSelReal)}</div>
              <BtnExport onClick={()=>exportarExcel(`Nomina_${semSelReal}`,[{
                nombre:"Planilla",
                headers:["Operador","Puesto","Jornadas","Total","Tarifa Prom."],
                rows: opsConAsis.map(op=>{
                  const c=calcPagoOp(op.id,semSelReal);
                  return [op.nombre,op.puesto,c.dias,c.total,c.dias>0?c.total/c.dias:0];
                }).concat([["TOTAL","",
                  opsConAsis.reduce((s,o)=>s+calcPagoOp(o.id,semSelReal).dias,0),"",totalSem]])
              }])}/>
            </div>
            <div className="table-wrap-scroll">
              <table style={{minWidth:700}}>
                <thead><tr>
                  <th>Operador</th><th>Puesto</th>
                  <th style={{textAlign:"right"}}>Jornadas</th>
                  <th style={{textAlign:"right"}}>Detalle días</th>
                  <th style={{textAlign:"right",color:"#c0392b"}}>Total</th>
                  <th>Firma</th>
                </tr></thead>
                <tbody>
                  {opsConAsis.map((op,i)=>{
                    const c=calcPagoOp(op.id,semSelReal);
                    const bg=i%2===0?"white":"#faf8f3";
                    return (
                      <tr key={op.id}>
                        <td style={{background:bg,fontWeight:700}}>👷 {op.nombre}</td>
                        <td style={{background:bg,fontSize:12,color:T.fog}}>{op.puesto}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:600}}>{c.dias}</td>
                        <td style={{background:bg,fontSize:11,color:T.fog}}>
                          {c.detalle.map(a=>{
                            const tarifa=parseFloat(a.tarifaDia)||op.salarioDia;
                            const isAdj=tarifa!==(op.salarioDia||0);
                            return (
                              <span key={a.fecha} style={{display:"inline-block",marginRight:4,marginBottom:2,
                                padding:"1px 6px",borderRadius:4,fontSize:10,
                                background:isAdj?"#fff3cd":(esDomingoOFestivo(a.fecha)?"#fef9ec":"#f0f7ec"),
                                color:isAdj?"#856404":"#2d5a1b"}}>
                                {new Date(a.fecha+"T12:00:00").toLocaleDateString("es-MX",{day:"2-digit",month:"short"})}
                                {isAdj&&` $${tarifa}`}
                                {a.nota&&` · ${a.nota}`}
                              </span>
                            );
                          })}
                        </td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:800,fontSize:14,color:"#c0392b"}}>{mxnFmt(c.total)}</td>
                        <td style={{background:bg,minWidth:100}}>
                          <div style={{borderBottom:"1px solid #888",height:28,marginTop:4}}/>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{background:"#f0f4e8",fontWeight:700}}>
                    <td colSpan={2} style={{padding:"9px 14px"}}>TOTAL</td>
                    <td style={{textAlign:"right",fontFamily:"monospace"}}>{opsConAsis.reduce((s,o)=>s+calcPagoOp(o.id,semSelReal).dias,0)}</td>
                    <td/>
                    <td style={{textAlign:"right",fontFamily:"monospace",fontSize:15,color:"#c0392b"}}>{mxnFmt(totalSem)}</td>
                    <td/>
                  </tr>
                </tfoot>
              </table>
            </div>
            {!pagadaSem&&puedeEditar&&(
              <div style={{padding:"12px 16px",borderTop:`1px solid ${T.line}`,display:"flex",justifyContent:"flex-end",gap:8}}>
                <button className="btn btn-primary" onClick={registrarPago}
                  style={{background:"#2d5a1b",border:"none",fontWeight:700,fontSize:14,padding:"10px 24px"}}>
                  💵 Registrar Pago — {mxnFmt(totalSem)}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VISTA: HISTORIAL
  // ══════════════════════════════════════════════════════════════════════════
  if(vista==="historial") {
    const asisFiltradas = asistencias
      .filter(a=>!opFiltro||String(a.operadorId)===opFiltro)
      .sort((a,b)=>b.fecha.localeCompare(a.fecha));

    return (
      <div>
        <TabBar/>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
          <div style={{fontFamily:"Georgia, serif",fontSize:18,fontWeight:700,flex:1}}>Historial</div>
          <select className="form-select" style={{width:220}} value={opFiltro} onChange={e=>setOpFiltro(e.target.value)}>
            <option value="">Todos los operadores</option>
            {operadores.map(o=><option key={o.id} value={o.id}>{o.nombre}</option>)}
          </select>
          <BtnExport onClick={()=>exportarExcel("Historial_Asistencias",[{
            nombre:"Historial",
            headers:["Fecha","Operador","Tarifa del día","Trabajo","Lote","Nota"],
            rows:asisFiltradas.map(a=>{
              const op=operadores.find(o=>o.id===a.operadorId);
              const lote=lotes.find(l=>String(l.id)===String(a.loteId));
              return [a.fecha,op?.nombre||"",a.tarifaDia||op?.salarioDia||"",a.trabajo||"",lote?.apodo||"",a.nota||""];
            })
          }])}/>
        </div>
        <div className="card">
          <div className="table-wrap-scroll">
            <table style={{minWidth:600}}>
              <thead><tr>
                <th>Fecha</th><th>Operador</th>
                <th style={{textAlign:"right"}}>Tarifa</th>
                <th>Trabajo</th><th>Lote</th><th>Nota</th><th></th>
              </tr></thead>
              <tbody>
                {asisFiltradas.map((a,i)=>{
                  const op    = operadores.find(o=>o.id===a.operadorId);
                  const lote  = lotes.find(l=>String(l.id)===String(a.loteId));
                  const tarifa= parseFloat(a.tarifaDia)||op?.salarioDia||0;
                  const isAdj = op && tarifa!==(op.salarioDia||0);
                  const bg    = i%2===0?"white":"#faf8f3";
                  return (
                    <tr key={a.id}>
                      <td style={{background:bg,fontFamily:"monospace",fontSize:12}}>{a.fecha}</td>
                      <td style={{background:bg,fontWeight:600}}>👷 {op?.nombre||"—"}</td>
                      <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:600,
                        color:isAdj?"#e67e22":"#2d5a1b"}}>
                        {mxnFmt(tarifa)}{isAdj&&<span style={{fontSize:9,marginLeft:4}}>ajust.</span>}
                      </td>
                      <td style={{background:bg,fontSize:12,color:T.fog}}>{a.trabajo||"—"}</td>
                      <td style={{background:bg,fontSize:12,color:T.fog}}>{lote?.apodo||"—"}</td>
                      <td style={{background:bg,fontSize:11,color:T.fog}}>{a.nota||"—"}</td>
                      <td style={{background:bg}}>
                        {userRol==="admin"&&<button className="btn btn-sm btn-danger"
                          onClick={()=>confirmarEliminar("¿Eliminar esta asistencia?",
                            ()=>dispatch({type:"DEL_ASISTENCIA",payload:a.id}))}>🗑</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {asisFiltradas.length===0&&<div style={{textAlign:"center",padding:32,color:T.fog}}>Sin registros</div>}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VISTA: OPERADORES (catálogo)
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div>
      <TabBar/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <div style={{fontFamily:"Georgia, serif",fontSize:18,fontWeight:700}}>Catálogo de Operadores</div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <div style={{display:"flex",gap:8,padding:"6px 12px",background:T.mist,borderRadius:8,
            alignItems:"center",border:`1px solid ${T.line}`}}>
            <span style={{fontSize:11,color:T.fog}}>Tarifa estándar:</span>
            <span style={{fontSize:12,fontWeight:700,color:"#2d5a1b"}}>Normal {mxnFmt(tarifaStd.normal)}</span>
            <span style={{fontSize:12,fontWeight:700,color:"#e67e22"}}>· Especial {mxnFmt(tarifaStd.especial)}</span>
            {puedeEditar&&<button className="btn btn-sm btn-secondary" style={{fontSize:10}}
              onClick={()=>{setFormTarifa({normal:String(tarifaStd.normal),especial:String(tarifaStd.especial)});setModalTarifa(true);}}>
              ✏️ Editar
            </button>}
          </div>
          {puedeEditar&&<button className="btn btn-primary"
            onClick={()=>{setSelOp(null);setFormOp({...emptyOp,salarioDia:tarifaStd.normal,tarifaEspecial:tarifaStd.especial});setModalOp(true);}}>
            ＋ Agregar Operador
          </button>}
        </div>
      </div>
      <div className="card">
        <div className="table-wrap-scroll">
          <table>
            <thead><tr>
              <th>Nombre</th><th>Puesto</th><th>Teléfono</th>
              <th style={{textAlign:"right"}}>Tarifa base/día</th>
              <th style={{textAlign:"right"}}>Tarifa especial</th>
              <th style={{textAlign:"right"}}>Jornadas</th>
              <th style={{textAlign:"right"}}>Saldo</th>
              <th>Estado</th><th></th>
            </tr></thead>
            <tbody>
              {operadores.map((o,i)=>{
                const jornadas=asistencias.filter(a=>String(a.operadorId)===String(o.id)).length;
                const saldo=saldoPendienteOp(o.id);
                const bg=i%2===0?"white":"#faf8f3";
                return (
                  <tr key={o.id}>
                    <td style={{background:bg,fontWeight:600}}>👷 {o.nombre}</td>
                    <td style={{background:bg,fontSize:12}}>{o.puesto}</td>
                    <td style={{background:bg,fontSize:12,color:T.fog}}>{o.telefono||"—"}</td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace",color:"#2d5a1b"}}>{mxnFmt(o.salarioDia)}</td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace",color:"#e67e22"}}>{mxnFmt(o.tarifaEspecial||o.salarioDia)}</td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12}}>{jornadas}</td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:600,
                      color:saldo>0?"#c0392b":"#2d5a1b",fontSize:12}}>
                      {saldo>0?mxnFmt(saldo):"✅"}
                    </td>
                    <td style={{background:bg}}>
                      <span style={{fontSize:11,padding:"2px 8px",borderRadius:8,fontWeight:600,
                        background:o.activo?"#d4edda":"#f8d7da",color:o.activo?"#155724":"#721c24"}}>
                        {o.activo?"● Activo":"○ Inactivo"}
                      </span>
                    </td>
                    <td style={{background:bg}}>
                      {puedeEditar&&<button className="btn btn-sm btn-secondary"
                          onClick={()=>{setSelOp(o);setFormOp({nombre:o.nombre,puesto:o.puesto,telefono:o.telefono||"",salarioDia:o.salarioDia||tarifaStd.normal,tarifaEspecial:o.tarifaEspecial||tarifaStd.especial,activo:o.activo!==false,maquinaAsignada:o.maquinaAsignada||"",notas:o.notas||""});setModalOp(true);}}>✏️</button>}
                      {userRol==="admin"&&<button className="btn btn-sm btn-danger"
                          onClick={()=>confirmarEliminar("¿Eliminar este operador?",()=>{
                            const r=puedeEliminarOperador(o.id,state);
                            if(r.length>0){alert("No se puede: "+r.join(", "));return;}
                            dispatch({type:"DEL_OPER",payload:o.id});
                          })}>🗑</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal editar/crear operador */}
      {modalOp&&<Modal title={selOp?"Editar Operador":"Nuevo Operador"} onClose={()=>{setModalOp(false);setSelOp(null);setFormOp(emptyOp);}}
        footer={<><button className="btn btn-secondary" onClick={()=>{setModalOp(false);setSelOp(null);setFormOp(emptyOp);}}>Cancelar</button><button className="btn btn-primary" onClick={saveOp}>💾 Guardar</button></>}>
        <div className="form-group"><label className="form-label">Nombre completo *</label>
          <input className="form-input" value={formOp.nombre} onChange={e=>setFormOp(f=>({...f,nombre:e.target.value}))} placeholder="Nombre del operador" autoFocus/></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Puesto</label>
            <input className="form-input" value={formOp.puesto} onChange={e=>setFormOp(f=>({...f,puesto:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Teléfono</label>
            <input className="form-input" type="tel" value={formOp.telefono||""} onChange={e=>setFormOp(f=>({...f,telefono:e.target.value}))}/></div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Tarifa base ($/día)
              <span style={{fontSize:10,color:T.fog,fontWeight:400,marginLeft:6}}>estándar: {tarifaStd.normal}</span>
            </label>
            <input className="form-input" type="number" value={formOp.salarioDia}
              onChange={e=>setFormOp(f=>({...f,salarioDia:e.target.value}))}/></div>
          <div className="form-group">
            <label className="form-label">Tarifa especial ($/día)
              <span style={{fontSize:10,color:T.fog,fontWeight:400,marginLeft:6}}>domingo/festivo</span>
            </label>
            <input className="form-input" type="number" value={formOp.tarifaEspecial||""}
              onChange={e=>setFormOp(f=>({...f,tarifaEspecial:e.target.value}))}
              placeholder={String(tarifaStd.especial)}/></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Máquina asignada</label>
            <input className="form-input" value={formOp.maquinaAsignada||""}
              onChange={e=>setFormOp(f=>({...f,maquinaAsignada:e.target.value}))} placeholder="Ej: T-1"/></div>
          <div className="form-group"><label className="form-label">Estado</label>
            <select className="form-select" value={formOp.activo?"activo":"inactivo"}
              onChange={e=>setFormOp(f=>({...f,activo:e.target.value==="activo"}))}>
              <option value="activo">Activo</option><option value="inactivo">Inactivo</option>
            </select></div>
        </div>
        <div className="form-group"><label className="form-label">Notas</label>
          <input className="form-input" value={formOp.notas||""} onChange={e=>setFormOp(f=>({...f,notas:e.target.value}))}/></div>
      </Modal>}

      {/* Modal tarifa estándar (reemplaza prompt) */}
      {modalTarifa&&<Modal title="⚙️ Tarifa Estándar del Sistema" onClose={()=>setModalTarifa(false)}
        footer={<><button className="btn btn-secondary" onClick={()=>setModalTarifa(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={()=>{
            const n=parseFloat(formTarifa.normal)||0;
            const e=parseFloat(formTarifa.especial)||0;
            if(n>0&&e>0){
              dispatch({type:"UPD_TARIFA_STD",payload:{normal:n,especial:e}});
              setModalTarifa(false);
              updateTarifaStd({normal:n,especial:e}).catch(err=>console.warn('tarifaStd sync:',err));
            }
          }}>💾 Guardar</button></>}>
        <div style={{fontSize:12,color:T.fog,marginBottom:12}}>
          Estos valores se usan como default al crear nuevos operadores. No afecta a operadores existentes.
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Tarifa normal ($/día)</label>
            <input className="form-input" type="number" value={formTarifa.normal}
              onChange={e=>setFormTarifa(f=>({...f,normal:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Tarifa especial — domingo/festivo ($/día)</label>
            <input className="form-input" type="number" value={formTarifa.especial}
              onChange={e=>setFormTarifa(f=>({...f,especial:e.target.value}))}/></div>
        </div>
      </Modal>}
    </div>
  );
}
