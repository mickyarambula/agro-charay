// ─── modules/Activos.jsx ───────────────────────────────────────────

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


export default function ActivosModule({ userRol, puedeEditar }) {
  const { state, dispatch } = useData();
  const [modal, setModal] = useState(false);
  const [sel, setSel]     = useState(null);
  const hoy = new Date().toISOString().split("T")[0];
  const empty = { nombre:"", tipo:"Maquinaria", valorAdq:0, fechaAdq:hoy, descripcion:"", notas:"" };
  const [form, setForm]   = useState(empty);
  const mxnFmt = n => (parseFloat(n)||0).toLocaleString("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:2,maximumFractionDigits:2});

  const activos    = state.activos || [];
  const valorTotal = (activos||[]).reduce((s,a)=>s+(a.valorAdq||0),0);
  const TIPOS      = ["Maquinaria","Vehículo","Terreno","Equipo","Instalación","Otro"];

  const save = () => {
    const p = {...form, valorAdq:parseFloat(form.valorAdq)||0};
    if(!p.nombre) return;
    if(sel) dispatch({type:"UPD_ACTIVO",payload:{...p,id:sel.id}});
    else dispatch({type:"ADD_ACTIVO",payload:{...p,id:Date.now()}});
    setModal(false); setSel(null); setForm(empty);
  };

  return (
    <div>
      <div className="stat-grid" style={{gridTemplateColumns:"repeat(3,1fr)",marginBottom:20}}>
        <div className="stat-card green"><div className="stat-icon">🏡</div><div className="stat-label">Total Activos</div><div className="stat-value">{activos.length}</div></div>
        <div className="stat-card gold"><div className="stat-icon">💰</div><div className="stat-label">Valor Total</div><div className="stat-value" style={{fontSize:18}}>{mxnFmt(valorTotal)}</div></div>
        <div className="stat-card sky"><div className="stat-icon">📋</div><div className="stat-label">Tipos</div><div className="stat-value">{[...new Set(activos.map(a=>a.tipo))].length}</div></div>
      </div>
      {puedeEditar&&<div style={{marginBottom:12}}><button className="btn btn-primary" onClick={()=>{setSel(null);setForm(empty);setModal(true);}}>＋ Agregar Activo</button></div>}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Activo</th><th>Tipo</th><th>Fecha Adq.</th><th>Descripción</th><th style={{textAlign:"right"}}>Valor</th><th></th></tr></thead>
            <tbody>
              {activos.map((a,i)=>{
                const bg=i%2===0?"white":"#faf8f3";
                return(<tr key={a.id}>
                  <td style={{background:bg,fontWeight:600}}>{a.nombre}</td>
                  <td style={{background:bg}}><span style={{fontSize:10,padding:"2px 8px",borderRadius:8,background:"#f0f4e8",color:"#2d5a1b",fontWeight:600}}>{a.tipo}</span></td>
                  <td style={{background:bg,fontFamily:"monospace",fontSize:11}}>{a.fechaAdq||"—"}</td>
                  <td style={{background:bg,fontSize:12,color:"#6a6050"}}>{a.descripcion||a.notas||"—"}</td>
                  <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:700}}>{mxnFmt(a.valorAdq)}</td>
                  <td style={{background:bg}}>
                    {puedeEditar&&<button className="btn btn-sm btn-secondary" onClick={()=>{setSel(a);setForm({...a});setModal(true);}}>✏️</button>}
                    {userRol==="admin"&&<button className="btn btn-sm btn-danger" onClick={()=>confirmarEliminar("¿Eliminar este activo?",()=>dispatch({type:"DEL_ACTIVO",payload:a.id}))}>🗑</button>}
                  </td>
                </tr>);
              })}
            </tbody>
          </table>
        </div>
      </div>
      {modal&&<Modal title={sel?"Editar Activo":"Nuevo Activo"} onClose={()=>setModal(false)}
        footer={<><button className="btn btn-secondary" onClick={()=>setModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={save}>💾 Guardar</button></>}>
        <div className="form-group"><label className="form-label">Nombre</label><input className="form-input" value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))}/></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Tipo</label><select className="form-select" value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))}>{TIPOS.map(t=><option key={t}>{t}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Valor adquisición ($)</label><input className="form-input" type="number" value={form.valorAdq} onChange={e=>setForm(f=>({...f,valorAdq:e.target.value}))}/></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Fecha adquisición</label><input className="form-input" type="date" value={form.fechaAdq} onChange={e=>setForm(f=>({...f,fechaAdq:e.target.value}))}/></div>
        </div>
        <div className="form-group"><label className="form-label">Descripción</label><input className="form-input" value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))}/></div>
      </Modal>}
    </div>
  );
}
