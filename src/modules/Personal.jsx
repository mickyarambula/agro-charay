// ─── modules/Personal.jsx ───────────────────────────────────────────

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
const TIPOS_PERSONAL = ["Empleado Fijo","Honorarios por Ciclo","Consultoría / Servicio","Eventual"];
const PUESTOS_SUGERIDOS = ["Asesor Agrónomo","Administrador","Contador","Gerente General","Técnico de Campo","Guardián / Velador","Chofer","Otro"];
const mxn = n => (parseFloat(n)||0).toLocaleString('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:2,maximumFractionDigits:2});


export default function PersonalModule() {
  const { state, dispatch } = useData();
  const [modal, setModal] = useState(false);
  const [sel, setSel]     = useState(null);
  const empty = { nombre:"", tipo:"Honorarios por Ciclo", puesto:"Asesor Agrónomo", sueldoMes:0, honorariosCiclo:0, activo:true, telefono:"", notas:"" };
  const [form, setForm]   = useState(empty);

  // Costo total del personal al ciclo
  // Empleados fijos: sueldoMes × meses del ciclo
  const mesesCiclo = 9; // PV 2024-25 aprox sep–jun
  const costoXPersona = p => {
    if(p.tipo==="Empleado Fijo") return (p.sueldoMes||0) * mesesCiclo;
    return p.honorariosCiclo || 0;
  };
  const totalPersonal = (state.personal||[]).reduce((s,p)=>s+costoXPersona(p),0);

  const openNew  = () => { setSel(null); setForm(empty); setModal(true); };
  const openEdit = p  => { setSel(p); setForm({...p,sueldoMes:String(p.sueldoMes||0),honorariosCiclo:String(p.honorariosCiclo||0)}); setModal(true); };
  const save = () => {
    const p = { ...form, sueldoMes:parseFloat(form.sueldoMes)||0, honorariosCiclo:parseFloat(form.honorariosCiclo)||0 };
    if(!p.nombre) return;
    sel ? dispatch({type:"UPD_PERSONAL",payload:{...p,id:sel.id}}) : dispatch({type:"ADD_PERSONAL",payload:p});
    setModal(false);
  };

  const tipoCol = t => ({"Empleado Fijo":"green","Honorarios por Ciclo":"gold","Consultoría / Servicio":"sky","Eventual":"gray"})[t]||"gray";
  const puestoIcon = p => p.includes("Agrón")?"🌱":p.includes("Admin")?"📊":p.includes("Cont")?"🧾":p.includes("Geren")?"👔":p.includes("Campo")?"🌾":"👤";

  return (
    <div>
      <div className="stat-grid" style={{gridTemplateColumns:"repeat(3,1fr)",marginBottom:20}}>
        <div className="stat-card green"><div className="stat-icon">👔</div><div className="stat-label">Personal Registrado</div><div className="stat-value">{state.personal.length}</div><div className="stat-sub">{state.personal.filter(p=>p.activo).length} activos</div></div>
        <div className="stat-card rust"><div className="stat-icon">💵</div><div className="stat-label">Costo Total Ciclo</div><div className="stat-value" style={{fontSize:20}}>{mxn(totalPersonal)}</div><div className="stat-sub">Sueldos + honorarios</div></div>
        <div className="stat-card gold"><div className="stat-icon">🌾</div><div className="stat-label">Costo / Ha</div><div className="stat-value" style={{fontSize:20}}>{mxn(Math.round(totalPersonal/Math.max((((state.ciclos||[]).find(c=>c.id===state.cicloActivoId)||(state.ciclos||[]).find(c=>c.predeterminado))?.asignaciones||[]).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0)||1)))}</div><div className="stat-sub">Personal técnico-admin</div></div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <div style={{fontSize:13,color:T.fog}}>Personal técnico y administrativo — operadores de campo están en Operadores</div>
        <button className="btn btn-primary" onClick={openNew}>＋ Nuevo Puesto</button>
      </div>

      <div className="lote-grid">
        {(state.personal||[]).map(p=>{
          const costo = costoXPersona(p);
          return (
            <div className="card" key={p.id} style={{opacity:p.activo?1:0.6}}>
              <div style={{padding:"14px 18px 12px",borderBottom:`1px solid ${T.line}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontSize:22,marginBottom:4}}>{puestoIcon(p.puesto)}</div>
                  <div style={{fontWeight:700,fontSize:14}}>{p.nombre}</div>
                  <div style={{fontSize:11,color:T.fog,marginTop:2}}>{p.puesto}</div>
                </div>
                <span className={`badge badge-${tipoCol(p.tipo)}`} style={{fontSize:10}}>{p.tipo}</span>
              </div>
              <div style={{padding:"12px 18px"}}>
                {[
                  p.tipo==="Empleado Fijo"
                    ? ["Sueldo mensual", mxn(p.sueldoMes)]
                    : ["Honorarios ciclo", mxn(p.honorariosCiclo)],
                  ["Costo total ciclo", mxn(costo)],
                  ["Teléfono", p.telefono||"—"],
                ].map(([l,v])=>(
                  <div key={l} className="flex justify-between" style={{padding:"5px 0",borderBottom:`1px solid ${T.line}`,fontSize:12}}>
                    <span style={{color:T.fog}}>{l}</span><span style={{fontWeight:600}}>{v}</span>
                  </div>
                ))}
                {p.notas && <div style={{fontSize:11,color:T.fog,marginTop:8,fontStyle:"italic"}}>📝 {p.notas}</div>}
                <div className="flex gap-2 mt-3">
                  <button className="btn btn-sm btn-secondary w-full" onClick={()=>openEdit(p)}>✏️ Editar</button>
                  <button className="btn btn-sm btn-danger" onClick={()=>confirmarEliminar("¿Eliminar este registro?",()=>dispatch({type:"DEL_PERSONAL",payload:p.id}))}>🗑</button>
                </div>
              </div>
            </div>
          );
        })}
        {state.personal.length===0 && (
          <div className="card" style={{gridColumn:"1/-1"}}><div className="empty-state"><div className="empty-icon">👔</div><div className="empty-title">Sin personal registrado</div><button className="btn btn-primary" onClick={openNew}>＋ Agregar</button></div></div>
        )}
      </div>

      {state.personal.length>0 && (
        <div className="card" style={{marginTop:20}}>
          <div className="card-header"><div className="card-title">Resumen de Costo Personal</div></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nombre</th><th>Puesto</th><th>Tipo</th><th>Base</th><th>Costo Ciclo</th><th>Estatus</th></tr></thead>
              <tbody>
                {(state.personal||[]).map(p=>(
                  <tr key={p.id}>
                    <td style={{fontWeight:600}}>{puestoIcon(p.puesto)} {p.nombre}</td>
                    <td style={{color:T.fog,fontSize:12}}>{p.puesto}</td>
                    <td><span className={`badge badge-${tipoCol(p.tipo)}`} style={{fontSize:10}}>{p.tipo}</span></td>
                    <td className="font-mono">{p.tipo==="Empleado Fijo"?`${mxn(p.sueldoMes)}/mes`:mxn(p.honorariosCiclo)}</td>
                    <td className="font-mono fw-600" style={{color:T.rust}}>{mxn(costoXPersona(p))}</td>
                    <td><span className={`badge badge-${p.activo?"green":"gray"}`}>{p.activo?"Activo":"Inactivo"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{padding:"12px 20px",borderTop:`1px solid ${T.line}`,display:"flex",justifyContent:"space-between",fontSize:13,background:T.mist}}>
            <span style={{fontWeight:600}}>Total personal técnico-admin ciclo</span>
            <span className="font-mono fw-600" style={{color:T.rust}}>{mxn(totalPersonal)}</span>
          </div>
        </div>
      )}

      {modal && (
        <Modal title={sel?"Editar Puesto":"Nuevo Puesto / Persona"} onClose={()=>setModal(false)}
          footer={<><button className="btn btn-secondary" onClick={()=>setModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={save}>💾 Guardar</button></>}>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Nombre / Empresa</label><input className="form-input" value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))}/></div>
            <div className="form-group"><label className="form-label">Puesto</label>
              <select className="form-select" value={form.puesto} onChange={e=>setForm(f=>({...f,puesto:e.target.value}))}>
                {PUESTOS_SUGERIDOS.map(p=><option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Tipo de Relación</label>
              <select className="form-select" value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))}>
                {TIPOS_PERSONAL.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Estatus</label>
              <select className="form-select" value={form.activo} onChange={e=>setForm(f=>({...f,activo:e.target.value==="true"}))}>
                <option value="true">Activo</option><option value="false">Inactivo</option>
              </select>
            </div>
          </div>
          {form.tipo==="Empleado Fijo"
            ? <div className="form-group"><label className="form-label">Sueldo Mensual ($MXN)</label><input className="form-input" type="number" value={form.sueldoMes} onChange={e=>setForm(f=>({...f,sueldoMes:e.target.value}))}/></div>
            : <div className="form-group"><label className="form-label">Honorarios / Costo por Ciclo ($MXN)</label><input className="form-input" type="number" value={form.honorariosCiclo} onChange={e=>setForm(f=>({...f,honorariosCiclo:e.target.value}))}/></div>
          }
          <div className="form-row">
            <div className="form-group"><label className="form-label">Teléfono</label><input className="form-input" value={form.telefono} onChange={e=>setForm(f=>({...f,telefono:e.target.value}))}/></div>
          </div>
          <div className="form-group"><label className="form-label">Notas</label><textarea className="form-textarea" value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))}/></div>
        </Modal>
      )}
    </div>
  );
}
