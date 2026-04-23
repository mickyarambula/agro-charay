// ─── modules/Capital.jsx ───────────────────────────────────────────

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
import { postCapital, deleteCapital } from '../core/supabaseWriters.js';
import { showToast } from '../components/mobile/Toast.jsx';


export default function CapitalModule({ userRol, puedeEditar }) {
  const { state, dispatch } = useData();
  const [modalA, setModalA] = useState(false);
  const [modalR, setModalR] = useState(false);
  const hoy = new Date().toISOString().split("T")[0];
  const emptyA = { fecha:hoy, monto:"", concepto:"", referencia:"" };
  const emptyR = { fecha:hoy, monto:"", concepto:"", referencia:"" };
  const [formA, setFormA] = useState(emptyA);
  const [formR, setFormR] = useState(emptyR);
  const [savingA, setSavingA] = useState(false);
  const [savingR, setSavingR] = useState(false);
  const mxnFmt = n => (parseFloat(n)||0).toLocaleString("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:2,maximumFractionDigits:2});

  const capital    = state.capital || { aportaciones:[], retiros:[] };
  const totalAport = (capital.aportaciones||[]).reduce((s,a)=>s+(a.monto||0),0);
  const totalRetir = (capital.retiros||[]).reduce((s,r)=>s+(r.monto||0),0);
  const neto       = totalAport - totalRetir;

  const saveA = async () => {
    if (!formA.monto) return;
    if (savingA) return;
    setSavingA(true);
    try {
      const saved = await postCapital(1, formA);
      if (!saved) return;
      dispatch({ type: "ADD_APORTACION", payload: { ...formA, id: saved.id, monto: parseFloat(formA.monto) || 0 } });
      showToast("Movimiento registrado ✓", "success");
      setModalA(false);
      setFormA(emptyA);
    } finally {
      setSavingA(false);
    }
  };

  const saveR = async () => {
    if (!formR.monto) return;
    if (savingR) return;
    setSavingR(true);
    try {
      const saved = await postCapital(-1, formR);
      if (!saved) return;
      dispatch({ type: "ADD_RETIRO", payload: { ...formR, id: saved.id, monto: parseFloat(formR.monto) || 0 } });
      showToast("Movimiento registrado ✓", "success");
      setModalR(false);
      setFormR(emptyR);
    } finally {
      setSavingR(false);
    }
  };

  const movimientos = [
    ...(capital.aportaciones||[]).map(a=>({...a,signo:1,tipo:"Aportación"})),
    ...(capital.retiros||[]).map(r=>({...r,signo:-1,tipo:"Retiro"})),
  ].sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||""));

  return (
    <div>
      <div className="stat-grid" style={{gridTemplateColumns:"repeat(3,1fr)",marginBottom:20}}>
        <div className="stat-card green"><div className="stat-icon">💵</div><div className="stat-label">Total Aportado</div><div className="stat-value" style={{fontSize:18}}>{mxnFmt(totalAport)}</div></div>
        <div className="stat-card rust"><div className="stat-icon">💸</div><div className="stat-label">Total Retirado</div><div className="stat-value" style={{fontSize:18}}>{mxnFmt(totalRetir)}</div></div>
        <div className="stat-card gold"><div className="stat-icon">⚖️</div><div className="stat-label">Capital Neto</div><div className="stat-value" style={{fontSize:18,color:neto>=0?"#2d5a1b":"#c0392b"}}>{mxnFmt(neto)}</div></div>
      </div>
      {puedeEditar&&<div style={{display:"flex",gap:8,marginBottom:12}}>
        <button className="btn btn-primary" onClick={()=>setModalA(true)}>＋ Aportación</button>
        <button className="btn btn-secondary" onClick={()=>setModalR(true)}>− Retiro</button>
      </div>}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Referencia</th><th style={{textAlign:"right"}}>Monto</th><th></th></tr></thead>
            <tbody>
              {movimientos.map((mv,i)=>{
                const bg=i%2===0?"white":"#faf8f3";
                return(<tr key={mv.id}>
                  <td style={{background:bg,fontFamily:"monospace",fontSize:12}}>{mv.fecha}</td>
                  <td style={{background:bg}}><span style={{fontSize:11,padding:"2px 8px",borderRadius:8,fontWeight:600,background:mv.signo===1?"#d4edda":"#f8d7da",color:mv.signo===1?"#155724":"#721c24"}}>{mv.tipo}</span></td>
                  <td style={{background:bg,fontSize:12}}>{mv.concepto}</td>
                  <td style={{background:bg,fontSize:11,color:"#8a8070"}}>{mv.referencia}</td>
                  <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:700,color:mv.signo===1?"#2d5a1b":"#c0392b"}}>{mv.signo===1?"+":"-"}{mxnFmt(mv.monto)}</td>
                  <td style={{background:bg}}>{userRol==="admin"&&<button className="btn btn-sm btn-danger" onClick={()=>confirmarEliminar("¿Eliminar este movimiento?",async ()=>{ const ok = await deleteCapital(mv.id); if (ok) { dispatch({type:mv.signo===1?"DEL_APORTACION":"DEL_RETIRO",payload:mv.id}); showToast("Movimiento eliminado", "info"); } else { showToast("Error al eliminar en servidor", "error"); } })}>🗑</button>}</td>
                </tr>);
              })}
            </tbody>
          </table>
        </div>
      </div>
      {modalA&&<Modal title="Nueva Aportación" onClose={()=>setModalA(false)} footer={<><button className="btn btn-secondary" onClick={()=>setModalA(false)}>Cancelar</button><button className="btn btn-primary" onClick={saveA} disabled={savingA} style={savingA ? {opacity:0.6, cursor:'wait'} : {}}>{savingA ? 'Guardando...' : '💾 Guardar'}</button></>}>
        <div className="form-row"><div className="form-group"><label className="form-label">Fecha</label><input className="form-input" type="date" value={formA.fecha} onChange={e=>setFormA(f=>({...f,fecha:e.target.value}))}/></div><div className="form-group"><label className="form-label">Monto ($)</label><input className="form-input" type="number" value={formA.monto} onChange={e=>setFormA(f=>({...f,monto:e.target.value}))}/></div></div>
        <div className="form-group"><label className="form-label">Concepto</label><input className="form-input" value={formA.concepto} onChange={e=>setFormA(f=>({...f,concepto:e.target.value}))}/></div>
        <div className="form-group"><label className="form-label">Referencia</label><input className="form-input" value={formA.referencia} onChange={e=>setFormA(f=>({...f,referencia:e.target.value}))}/></div>
      </Modal>}
      {modalR&&<Modal title="Registrar Retiro" onClose={()=>setModalR(false)} footer={<><button className="btn btn-secondary" onClick={()=>setModalR(false)}>Cancelar</button><button className="btn btn-primary" onClick={saveR} disabled={savingR} style={savingR ? {opacity:0.6, cursor:'wait'} : {}}>{savingR ? 'Guardando...' : '💾 Guardar'}</button></>}>
        <div className="form-row"><div className="form-group"><label className="form-label">Fecha</label><input className="form-input" type="date" value={formR.fecha} onChange={e=>setFormR(f=>({...f,fecha:e.target.value}))}/></div><div className="form-group"><label className="form-label">Monto ($)</label><input className="form-input" type="number" value={formR.monto} onChange={e=>setFormR(f=>({...f,monto:e.target.value}))}/></div></div>
        <div className="form-group"><label className="form-label">Concepto</label><input className="form-input" value={formR.concepto} onChange={e=>setFormR(f=>({...f,concepto:e.target.value}))}/></div>
      </Modal>}
    </div>
  );
}
