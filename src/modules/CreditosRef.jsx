// ─── modules/CreditosRef.jsx ───────────────────────────────────────────

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
import { mxn } from "../shared/utils.js";


// Stub temporal — función original nunca fue definida en el código base.
// TODO: implementar cálculo real de interés refaccionario.
function calcularInteresRef(credito) {
  return { saldoCapital: 0, interesTotal: 0, detalle: [] };
}

export default function CreditosRefModule() {
  const { state, dispatch } = useData();
  const [selCred, setSelCred] = useState(null);
  const [modalNew, setModalNew] = useState(false);
  const [modalMin, setModalMin] = useState(false);
  const [modalPago, setModalPago] = useState(false);
  const emptyC = { institucion:"", noContrato:"", lineaAutorizada:"", tasaAnual:"", tasaMoratoria:"", fechaApertura:"", fechaVencimiento:"", activoId:"", garantia:"", notas:"" };
  const emptyM = { fecha:new Date().toISOString().split("T")[0], monto:"", concepto:"", estatus:"aplicado" };
  const emptyP = { fecha:new Date().toISOString().split("T")[0], monto:"", tipo:"Abono a capital", referencia:"" };
  const [formC, setFormC] = useState(emptyC);
  const [formM, setFormM] = useState(emptyM);
  const [formP, setFormP] = useState(emptyP);

  const saveC = () => {
    const p = { ...formC, lineaAutorizada:parseFloat(formC.lineaAutorizada)||0, tasaAnual:parseFloat(formC.tasaAnual)||0, tasaMoratoria:parseFloat(formC.tasaMoratoria)||0 };
    if(!p.institucion) return;
    dispatch({type:"ADD_CRED_REF",payload:p}); setModalNew(false); setFormC(emptyC);
  };
  const saveM = () => {
    if(!selCred) return;
    const p = { ...formM, credId:selCred.id, monto:parseFloat(formM.monto)||0 };
    if(!p.monto) return;
    dispatch({type:"ADD_MIN_REF",payload:p}); setModalMin(false); setFormM(emptyM);
  };
  const savePago = () => {
    if(!selCred) return;
    const p = { ...formP, credId:selCred.id, monto:parseFloat(formP.monto)||0 };
    if(!p.monto) return;
    dispatch({type:"ADD_PAGO_REF",payload:p}); setModalPago(false); setFormP(emptyP);
  };

  const totalDeuda = (state.creditosRef||[]).reduce((s,c)=>{
    const { saldoCapital, interesTotal } = calcularInteresRef(c);
    return s + saldoCapital + interesTotal;
  },0);

  return (
    <div>
      <div className="stat-grid" style={{gridTemplateColumns:"repeat(3,1fr)",marginBottom:20}}>
        <div className="stat-card green"><div className="stat-icon">🏦</div><div className="stat-label">Créditos Refaccionarios</div><div className="stat-value">{state.creditosRef.length}</div><div className="stat-sub">activos</div></div>
        <div className="stat-card rust"><div className="stat-icon">💳</div><div className="stat-label">Deuda Total Estimada</div><div className="stat-value" style={{fontSize:20}}>{mxn(totalDeuda)}</div><div className="stat-sub">Capital + interés acumulado</div></div>
        <div className="stat-card gold"><div className="stat-icon">🏡</div><div className="stat-label">Activos Financiados</div><div className="stat-value">{state.creditosRef.filter(c=>c.activoId).length}</div><div className="stat-sub">con activo vinculado</div></div>
      </div>

      <div className="flex justify-end mb-4">
        <button className="btn btn-primary" onClick={()=>{setFormC(emptyC);setModalNew(true);}}>＋ Nuevo Crédito Refaccionario</button>
      </div>

      {state.creditosRef.length===0 && (
        <div className="card"><div className="empty-state"><div className="empty-icon">🏦</div><div className="empty-title">Sin créditos refaccionarios</div><div className="empty-sub">Registra créditos para compra de tierra, maquinaria o infraestructura</div><button className="btn btn-primary" onClick={()=>{setFormC(emptyC);setModalNew(true);}}>＋ Agregar</button></div></div>
      )}

      {(state.creditosRef||[]).map(cred=>{
        const { detalle, interesTotal, saldoCapital } = calcularInteresRef(cred);
        const totalMin = (cred.ministraciones||[]).reduce((s,m)=>s+(m.monto||0),0);
        const totalPag = (cred.pagos||[]).reduce((s,p)=>s+(p.monto||0),0);
        const activo   = state.activos.find(a=>a.id===parseInt(cred.activoId));
        const vcto     = calcularVencimiento(cred);
        return (
          <div className="card" key={cred.id} style={{marginBottom:20}}>
            <div className="card-header" style={{flexWrap:"wrap",gap:8}}>
              <div>
                <div className="card-title">🏦 {cred.institucion} <span className="font-mono" style={{fontSize:11,fontWeight:400,color:T.fog}}>· {cred.noContrato}</span></div>
                {activo && <div style={{fontSize:11,color:T.fog,marginTop:2}}>Financia: {activo.nombre}</div>}
              </div>
              <div className="flex gap-2">
                {vcto && vcto.nivel!=="ok" && <span style={{fontSize:11,fontWeight:700,color:vcto.color}}>{vcto.icono} {vcto.mensaje}</span>}
                <button className="btn btn-sm btn-primary" onClick={()=>{setSelCred(cred);setFormM(emptyM);setModalMin(true);}}>＋ Ministración</button>
                <button className="btn btn-sm btn-gold" onClick={()=>{setSelCred(cred);setFormP(emptyP);setModalPago(true);}}>＋ Pago</button>
                <button className="btn btn-sm btn-danger" onClick={()=>confirmarEliminar("¿Estás seguro que deseas eliminar este registro?",()=>dispatch({type:"DEL_CRED_REF",payload:cred.id}))}>🗑</button>
              </div>
            </div>
            <div className="card-body" style={{padding:0}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",borderBottom:`1px solid ${T.line}`}}>
                {[["Línea",mxn(cred.lineaAutorizada),"🏦"],["Ministrado",mxn(totalMin),"📤"],["Saldo capital",mxn(saldoCapital),"💳"],["Interés acum.",mxn(interesTotal),"📊"]].map(([l,v,ic])=>(
                  <div key={l} style={{padding:"12px 16px",borderRight:`1px solid ${T.line}`}}>
                    <div style={{fontSize:11,color:T.fog}}>{ic} {l}</div>
                    <div className="font-mono" style={{fontWeight:700,fontSize:15,color:T.inkLt,marginTop:3}}>{v}</div>
                  </div>
                ))}
              </div>
              {detalle.length>0 && (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Fecha min.</th><th>Concepto</th><th>Original</th><th>Saldo vigente</th><th>Días</th><th>Interés acum.</th><th></th></tr></thead>
                    <tbody>
                      {detalle.map(m=>(
                        <tr key={m.id}>
                          <td className="font-mono" style={{fontSize:12}}>{m.fecha}</td>
                          <td>{m.concepto}</td>
                          <td className="font-mono">{mxn(m.monto)}</td>
                          <td className="font-mono" style={{color:m.saldo===0?T.fog:T.rust,fontWeight:m.saldo>0?700:400}}>{m.saldo===0?"Liquidado":mxn(m.saldo)}</td>
                          <td className="font-mono" style={{color:T.fog}}>{m.dias}d</td>
                          <td className="font-mono fw-600" style={{color:"#9b6d3a"}}>{mxn(m.interes)}</td>
                          <td><button className="btn btn-sm btn-danger" onClick={()=>confirmarEliminar("¿Estás seguro que deseas eliminar este registro?",()=>dispatch({type:"DEL_MIN_REF",payload:{credId:cred.id,id:m.id}}))}>🗑</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {modalNew && (
        <Modal title="Nuevo Crédito Refaccionario" onClose={()=>setModalNew(false)}
          footer={<><button className="btn btn-secondary" onClick={()=>setModalNew(false)}>Cancelar</button><button className="btn btn-primary" onClick={saveC}>💾 Guardar</button></>}>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Institución</label><input className="form-input" value={formC.institucion} onChange={e=>setFormC(f=>({...f,institucion:e.target.value}))}/></div>
            <div className="form-group"><label className="form-label">No. Contrato</label><input className="form-input" value={formC.noContrato} onChange={e=>setFormC(f=>({...f,noContrato:e.target.value}))}/></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Línea Autorizada ($)</label><input className="form-input" type="number" value={formC.lineaAutorizada} onChange={e=>setFormC(f=>({...f,lineaAutorizada:e.target.value}))}/></div>
            <div className="form-group"><label className="form-label">Tasa Anual (%)</label><input className="form-input" type="number" step="0.1" value={formC.tasaAnual} onChange={e=>setFormC(f=>({...f,tasaAnual:e.target.value}))}/></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Tasa Moratoria (%)</label><input className="form-input" type="number" step="0.1" value={formC.tasaMoratoria} onChange={e=>setFormC(f=>({...f,tasaMoratoria:e.target.value}))} placeholder="0 si no aplica"/></div>
            <div className="form-group"><label className="form-label">Activo que financia</label>
              <select className="form-select" value={formC.activoId} onChange={e=>setFormC(f=>({...f,activoId:e.target.value}))}>
                <option value="">— Seleccionar activo —</option>
                {(state.activos||[]).map(a=><option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Fecha apertura</label><input className="form-input" type="date" value={formC.fechaApertura} onChange={e=>setFormC(f=>({...f,fechaApertura:e.target.value}))}/></div>
            <div className="form-group"><label className="form-label">Fecha vencimiento</label><input className="form-input" type="date" value={formC.fechaVencimiento} onChange={e=>setFormC(f=>({...f,fechaVencimiento:e.target.value}))}/></div>
          </div>
          <div className="form-group"><label className="form-label">Garantía</label><input className="form-input" value={formC.garantia} onChange={e=>setFormC(f=>({...f,garantia:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Notas</label><textarea className="form-textarea" value={formC.notas} onChange={e=>setFormC(f=>({...f,notas:e.target.value}))}/></div>
        </Modal>
      )}
      {modalMin && (
        <Modal title={`Ministración — ${selCred?.institucion}`} onClose={()=>setModalMin(false)}
          footer={<><button className="btn btn-secondary" onClick={()=>setModalMin(false)}>Cancelar</button><button className="btn btn-primary" onClick={saveM}>💾 Guardar</button></>}>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Fecha</label><input className="form-input" type="date" value={formM.fecha} onChange={e=>setFormM(f=>({...f,fecha:e.target.value}))}/></div>
            <div className="form-group"><label className="form-label">Monto ($)</label><input className="form-input" type="number" value={formM.monto} onChange={e=>setFormM(f=>({...f,monto:e.target.value}))}/></div>
          </div>
          <div className="form-group"><label className="form-label">Concepto</label><input className="form-input" value={formM.concepto} onChange={e=>setFormM(f=>({...f,concepto:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Estatus</label>
            <select className="form-select" value={formM.estatus} onChange={e=>setFormM(f=>({...f,estatus:e.target.value}))}>
              <option value="aplicado">Aplicado</option><option value="pendiente">Pendiente</option>
            </select>
          </div>
        </Modal>
      )}
      {modalPago && (
        <Modal title={`Pago — ${selCred?.institucion}`} onClose={()=>setModalPago(false)}
          footer={<><button className="btn btn-secondary" onClick={()=>setModalPago(false)}>Cancelar</button><button className="btn btn-gold" onClick={savePago}>💾 Guardar</button></>}>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Fecha</label><input className="form-input" type="date" value={formP.fecha} onChange={e=>setFormP(f=>({...f,fecha:e.target.value}))}/></div>
            <div className="form-group"><label className="form-label">Monto ($)</label><input className="form-input" type="number" value={formP.monto} onChange={e=>setFormP(f=>({...f,monto:e.target.value}))}/></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Tipo</label>
              <select className="form-select" value={formP.tipo} onChange={e=>setFormP(f=>({...f,tipo:e.target.value}))}>
                {["Abono a capital","Pago de intereses","Liquidación parcial","Otro"].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Referencia</label><input className="form-input" value={formP.referencia} onChange={e=>setFormP(f=>({...f,referencia:e.target.value}))}/></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
