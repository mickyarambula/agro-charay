// ─── modules/Maquinaria.jsx ───────────────────────────────────────────

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

const TIPOS_LABOR_DIESEL = ['Barbecho','Rastreo','Siembra','Fertilización','Aplicación herbicida','Aplicación insecticida','Cosecha / apoyo'];

export default function MaquinariaModule({ userRol, puedeEditar: _puedeEditar }) {
  // Maquinaria: CRUD restringido a admin por política de negocio
  const puedeEditar = userRol === "admin";
  const { state, dispatch } = useData();
  const isMobile = useIsMobile();
  const [expandedConsumos, setExpandedConsumos] = useState(null);
  const [savedConsumo, setSavedConsumo] = useState({});
  const [modal, setModal]   = useState(false);
  const [modalH, setModalH] = useState(false);
  const [sel, setSel]       = useState(null);
  const [vistaH, setVistaH] = useState(""); // maqId para ver detalle de horas
  const hoy = new Date().toISOString().split("T")[0];
  const emptyM = { nombre:"", tipo:"Tractor", marca:"", modelo:"", año:"", costoHora:0, notas:"" };
  const emptyH = { fecha:hoy, maqId:"", operadorId:"", loteId:"", horas:0, concepto:"", combustible:0 };
  const [formM, setFormM] = useState(emptyM);
  const [formH, setFormH] = useState(emptyH);

  const maquinaria = state.maquinaria || [];
  const horasMaq   = state.horasMaq   || [];
  const bitacora   = state.bitacora   || [];
  const operadores = state.operadores || [];
  const lotes      = state.lotes      || [];
  const mxnFmt = n => (parseFloat(n)||0).toLocaleString("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:2,maximumFractionDigits:2});

  // Horas combinadas: manuales (horasMaq) + automáticas (bitacora con maquinariaId y horas)
  const getHorasMaq = maqId => {
    const hManuales = horasMaq.filter(h=>String(h.maqId)===String(maqId) && h.fuente!=="bitacora");
    const hBitacora = bitacora.filter(b=>String(b.maquinariaId)===String(maqId) && parseFloat(b.horas)>0);
    return [
      ...hManuales.map(h=>({...h, fuente:"manual"})),
      ...hBitacora.map(b=>({
        id:`bit-${b.id}`, fecha:b.fecha, maqId:b.maquinariaId,
        operadorId:b.operadorId||"", loteId:b.loteId||"",
        horas:parseFloat(b.horas)||0,
        concepto:`[Bitácora] ${b.tipo==="diesel"?b.data?.actividad||"Diesel":b.tipo==="insumo"?b.data?.producto||"Insumo":b.tipo}`,
        fuente:"bitacora"
      }))
    ].sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha)));
  };

  const horasTotalesMaq = maqId => getHorasMaq(maqId).reduce((s,h)=>s+(parseFloat(h.horas)||0),0);
  const totalHoras = maquinaria.reduce((s,m)=>s+horasTotalesMaq(m.id),0);
  const totalCosto = maquinaria.reduce((s,m)=>s+horasTotalesMaq(m.id)*(m.costoHora||0),0);

  const saveM = () => {
    const p = {...formM, costoHora:parseFloat(formM.costoHora)||0};
    if(!p.nombre) return;
    if(sel) dispatch({type:"UPD_MAQ",payload:{...p,id:sel.id}});
    else dispatch({type:"ADD_MAQ",payload:p});
    setModal(false); setSel(null); setFormM(emptyM);
  };
  const saveH = () => {
    const p = {...formH, horas:parseFloat(formH.horas)||0, maqId:parseInt(formH.maqId)||formH.maqId};
    if(!p.horas||!p.maqId) return;
    dispatch({type:"ADD_HORAS",payload:{...p, fuente:"manual"}});
    setModalH(false); setFormH(emptyH);
  };

  // Vista detalle de horas de una máquina
  if(vistaH) {
    const maq = maquinaria.find(m=>String(m.id)===String(vistaH));
    const hrs = getHorasMaq(vistaH);
    const totalH = hrs.reduce((s,h)=>s+(h.horas||0),0);
    return (
      <div>
        <button className="btn btn-secondary btn-sm" style={{marginBottom:12}}
          onClick={()=>setVistaH("")}>← Regresar</button>
        <div style={{fontFamily:"Georgia, serif",fontSize:18,fontWeight:700,marginBottom:4}}>
          🚜 {maq?.nombre} — Historial de Horas
        </div>
        <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>
          <div style={{padding:"8px 16px",borderRadius:8,background:"#f0f7ec",border:"1px solid #4a8c2a44"}}>
            <div style={{fontSize:11,color:T.fog}}>Total horas</div>
            <div style={{fontFamily:"monospace",fontWeight:700,fontSize:18,color:"#2d5a1b"}}>{totalH.toFixed(1)}h</div>
          </div>
          <div style={{padding:"8px 16px",borderRadius:8,background:"#fdf9f0",border:"1px solid #c8a84b44"}}>
            <div style={{fontSize:11,color:T.fog}}>Costo total</div>
            <div style={{fontFamily:"monospace",fontWeight:700,fontSize:18,color:"#9b6d3a"}}>{mxnFmt(totalH*(maq?.costoHora||0))}</div>
          </div>
          <div style={{padding:"8px 16px",borderRadius:8,background:T.mist,border:`1px solid ${T.line}`}}>
            <div style={{fontSize:11,color:T.fog}}>Desde Bitácora</div>
            <div style={{fontFamily:"monospace",fontWeight:700,fontSize:16,color:T.ink}}>
              {hrs.filter(h=>h.fuente==="bitacora").reduce((s,h)=>s+h.horas,0).toFixed(1)}h
            </div>
          </div>
          <div style={{padding:"8px 16px",borderRadius:8,background:T.mist,border:`1px solid ${T.line}`}}>
            <div style={{fontSize:11,color:T.fog}}>Registros manuales</div>
            <div style={{fontFamily:"monospace",fontWeight:700,fontSize:16,color:T.ink}}>
              {hrs.filter(h=>h.fuente==="manual").reduce((s,h)=>s+h.horas,0).toFixed(1)}h
            </div>
          </div>
        </div>
        <div className="card">
          <div className="table-wrap-scroll">
            <table>
              <thead><tr>
                <th>Fecha</th><th>Concepto</th><th>Operador</th><th>Lote</th>
                <th style={{textAlign:"right"}}>Horas</th><th style={{textAlign:"right"}}>Costo</th>
                <th>Fuente</th><th></th>
              </tr></thead>
              <tbody>
                {hrs.map((h,i)=>{
                  const op=operadores.find(o=>String(o.id)===String(h.operadorId));
                  const lt=lotes.find(l=>String(l.id)===String(h.loteId));
                  const bg=i%2===0?"white":"#faf8f3";
                  return (
                    <tr key={h.id}>
                      <td style={{background:bg,fontFamily:"monospace",fontSize:12}}>{h.fecha}</td>
                      <td style={{background:bg,fontSize:12}}>{h.concepto||"—"}</td>
                      <td style={{background:bg,fontSize:12,color:T.fog}}>{op?.nombre||"—"}</td>
                      <td style={{background:bg,fontSize:12,color:T.fog}}>{lt?.apodo||"—"}</td>
                      <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:600}}>{(h.horas||0).toFixed(1)}h</td>
                      <td style={{background:bg,textAlign:"right",fontFamily:"monospace",color:"#9b6d3a"}}>{mxnFmt((h.horas||0)*(maq?.costoHora||0))}</td>
                      <td style={{background:bg}}>
                        <span style={{fontSize:10,padding:"2px 6px",borderRadius:6,fontWeight:600,
                          background:h.fuente==="bitacora"?"#e8f4fd":"#f0f7ec",
                          color:h.fuente==="bitacora"?"#1a6ea8":"#2d5a1b"}}>
                          {h.fuente==="bitacora"?"📋 Bitácora":"✏️ Manual"}
                        </span>
                      </td>
                      <td style={{background:bg}}>
                        {h.fuente==="manual"&&userRol==="admin"&&(
                          <button className="btn btn-sm btn-danger"
                            onClick={()=>confirmarEliminar("¿Eliminar este registro?",()=>dispatch({type:"DEL_HORAS",payload:h.id}))}>
                            🗑
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {hrs.length===0&&<div style={{textAlign:"center",padding:32,color:T.fog}}>Sin registros de horas</div>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="stat-grid" style={{gridTemplateColumns:"repeat(3,1fr)",marginBottom:20}}>
        <div className="stat-card green"><div className="stat-icon">🚜</div><div className="stat-label">Equipos</div><div className="stat-value">{maquinaria.length}</div></div>
        <div className="stat-card gold"><div className="stat-icon">⏱</div><div className="stat-label">Horas Trabajadas</div><div className="stat-value">{totalHoras.toFixed(1)}<span className="stat-unit">h</span></div><div className="stat-sub">manuales + bitácora</div></div>
        <div className="stat-card rust"><div className="stat-icon">💵</div><div className="stat-label">Costo Total</div><div className="stat-value" style={{fontSize:18}}>{mxnFmt(totalCosto)}</div></div>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        {puedeEditar&&<button className="btn btn-primary" onClick={()=>{setSel(null);setFormM(emptyM);setModal(true);}}>＋ Agregar Equipo</button>}
        {puedeEditar&&<button className="btn btn-secondary" onClick={()=>{setFormH(emptyH);setModalH(true);}}>＋ Registrar Horas Manual</button>}
      </div>
      <div className="card">
        <div className="table-wrap-scroll">
          <table>
            <thead><tr>
              <th>Equipo</th><th>Tipo</th><th>Marca/Modelo</th><th>Año</th>
              <th style={{textAlign:"right"}}>$/hora</th>
              <th style={{textAlign:"right"}}>Horas (total)</th>
              <th style={{textAlign:"right"}}>Costo</th><th></th>
            </tr></thead>
            <tbody>
              {maquinaria.map((m,i)=>{
                const hc  = horasTotalesMaq(m.id);
                const hBit= getHorasMaq(m.id).filter(h=>h.fuente==="bitacora").reduce((s,h)=>s+h.horas,0);
                const bg  = i%2===0?"white":"#faf8f3";
                return(
                  <React.Fragment key={m.id}>
                  <tr style={{cursor:"pointer"}} onClick={()=>setVistaH(m.id)}>
                    <td style={{background:bg,fontWeight:600}}>🚜 {m.nombre}</td>
                    <td style={{background:bg,fontSize:12}}>{m.tipo}</td>
                    <td style={{background:bg,fontSize:12}}>{m.marca} {m.modelo}</td>
                    <td style={{background:bg,fontSize:12}}>{m.año}</td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace"}}>{mxnFmt(m.costoHora)}</td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace"}}>
                      {hc.toFixed(1)}h
                      {hBit>0&&<span style={{fontSize:10,color:"#1a6ea8",marginLeft:4}}>({hBit.toFixed(1)}h bit.)</span>}
                    </td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:700}}>{mxnFmt(hc*m.costoHora)}</td>
                    <td style={{background:bg}}>
                      <button className="btn btn-sm btn-secondary" onClick={e=>{e.stopPropagation();setVistaH(m.id);}}>Ver →</button>
                      {puedeEditar&&<button className="btn btn-sm btn-secondary" onClick={e=>{e.stopPropagation();setSel(m);setFormM({...m});setModal(true);}}>✏️</button>}
                      {puedeEditar&&<button className="btn btn-sm btn-secondary" onClick={e=>{e.stopPropagation();setExpandedConsumos(expandedConsumos===m.id?null:m.id);}} title="Consumos L/ha">⛽</button>}
                      {userRol==="admin"&&<button className="btn btn-sm btn-danger" onClick={e=>{e.stopPropagation();confirmarEliminar("¿Eliminar esta máquina?",()=>{ const r=puedeEliminarMaquina(m.id,state); if(r.length>0){alert("No se puede: "+r.join(", "));return;} dispatch({type:"DEL_MAQ",payload:m.id}); });}}> 🗑</button>}
                    </td>
                  </tr>
                  {expandedConsumos===m.id && (
                    <tr><td colSpan={8} style={{background:'#f8f6f2',padding:'12px 16px'}}>
                      <div style={{fontSize:11,fontWeight:700,color:'#b0a090',letterSpacing:1,textTransform:'uppercase',marginBottom:8}}>
                        ⛽ Consumos diesel por labor — {m.nombre}
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 120px 80px',gap:'6px 10px',alignItems:'center'}}>
                        <div style={{fontSize:10,fontWeight:700,color:'#b0a090'}}>Labor</div>
                        <div style={{fontSize:10,fontWeight:700,color:'#b0a090',textAlign:'right'}}>L/ha</div>
                        <div></div>
                        {TIPOS_LABOR_DIESEL.map(labor => {
                          const maqKey = m._uuid || m.id;
                          const existing = (state.maquinariaConsumos||[]).find(c => String(c.maquinariaId)===String(maqKey) && c.tipoLabor===labor);
                          const inputId = `consumo-${m.id}-${labor}`;
                          return (
                            <React.Fragment key={labor}>
                              <div style={{fontSize:12,color:'#1a2e1a'}}>{labor}</div>
                              <input id={inputId} type="number" step="0.5" min="0"
                                defaultValue={existing?.litrosPorHa||''}
                                placeholder="0"
                                style={{textAlign:'right',padding:'4px 8px',border:'1px solid #ede5d8',borderRadius:6,fontSize:12,fontFamily:'monospace',width:'100%'}}/>
                              <button onClick={()=>{
                                const val = parseFloat(document.getElementById(inputId)?.value)||0;
                                if (!val) return;
                                const newId = (typeof crypto!=='undefined'&&crypto.randomUUID)?crypto.randomUUID():`mc-${Date.now()}`;
                                dispatch({type:'SET_CONSUMO_DIESEL',payload:{id:existing?.id||newId,maquinariaId:maqKey,tipoLabor:labor,litrosPorHa:val}});
                                if (!m._uuid) { console.warn('Tractor sin UUID:', m.nombre); return; }
                                const skey = `${maqKey}-${labor}`;
                                const body = {
                                  maquinaria_id: m._uuid,
                                  tipo_labor: labor,
                                  litros_por_ha: val,
                                  updated_at: new Date().toISOString()
                                };
                                fetch(`${SUPABASE_URL}/rest/v1/maquinaria_consumos?on_conflict=maquinaria_id,tipo_labor`, {
                                  method: 'POST',
                                  headers: {
                                    apikey: SUPABASE_ANON_KEY,
                                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                                    'Content-Type': 'application/json',
                                    'Prefer': 'resolution=merge-duplicates,return=representation',
                                  },
                                  body: JSON.stringify(body),
                                }).then(res => {
                                  if (res.ok) {
                                    setSavedConsumo(p => ({...p, [skey]: 'ok'}));
                                    setTimeout(() => setSavedConsumo(p => ({...p, [skey]: null})), 2000);
                                  } else {
                                    setSavedConsumo(p => ({...p, [skey]: 'error'}));
                                    setTimeout(() => setSavedConsumo(p => ({...p, [skey]: null})), 2000);
                                    res.text().then(t => console.error('Error guardando consumo:', t));
                                  }
                                }).catch(e => {
                                  setSavedConsumo(p => ({...p, [skey]: 'error'}));
                                  setTimeout(() => setSavedConsumo(p => ({...p, [skey]: null})), 2000);
                                  console.warn('Consumo save fail:', e);
                                });
                              }} style={{padding:'4px 10px',background:savedConsumo[`${maqKey}-${labor}`]==='ok'?'#2d7a2d':savedConsumo[`${maqKey}-${labor}`]==='error'?'#c84b4b':'#1a3a0f',color:'#fff',border:'none',borderRadius:6,fontSize:11,cursor:'pointer',fontWeight:600,transition:'background 0.2s',whiteSpace:'nowrap'}}>
                                {savedConsumo[`${maqKey}-${labor}`]==='ok'?'✅':savedConsumo[`${maqKey}-${labor}`]==='error'?'❌ Error':'✓'}
                              </button>
                            </React.Fragment>
                          );
                        })}
                      </div>
                      {(state.maquinariaConsumos||[]).filter(c=>String(c.maquinariaId)===String(m._uuid||m.id)&&c.litrosPorHa>0).length > 0 && (
                        <div style={{marginTop:8,fontSize:10,color:'#6b7280'}}>
                          Configurados: {(state.maquinariaConsumos||[]).filter(c=>String(c.maquinariaId)===String(m._uuid||m.id)&&c.litrosPorHa>0).map(c=>`${c.tipoLabor}: ${c.litrosPorHa} L/ha`).join(' · ')}
                        </div>
                      )}
                    </td></tr>
                  )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {modal&&<Modal title={sel?"Editar Equipo":"Nuevo Equipo"} onClose={()=>setModal(false)}
        footer={<><button className="btn btn-secondary" onClick={()=>setModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={saveM}>💾 Guardar</button></>}>
        <div className="form-group"><label className="form-label">Nombre *</label><input className="form-input" value={formM.nombre} onChange={e=>setFormM(f=>({...f,nombre:e.target.value}))}/></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Tipo</label>
            <select className="form-select" value={formM.tipo} onChange={e=>setFormM(f=>({...f,tipo:e.target.value}))}>
              {["Tractor","Cosechadora","Aspersora","Camión","Otro"].map(t=><option key={t}>{t}</option>)}
            </select></div>
          <div className="form-group"><label className="form-label">Costo/hora ($)</label>
            <input className="form-input" type="number" value={formM.costoHora} onChange={e=>setFormM(f=>({...f,costoHora:e.target.value}))}/></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Marca</label><input className="form-input" value={formM.marca} onChange={e=>setFormM(f=>({...f,marca:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Modelo</label><input className="form-input" value={formM.modelo} onChange={e=>setFormM(f=>({...f,modelo:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Año</label><input className="form-input" value={formM.año} onChange={e=>setFormM(f=>({...f,año:e.target.value}))}/></div>
        </div>
        <div className="form-group"><label className="form-label">Notas</label><input className="form-input" value={formM.notas||""} onChange={e=>setFormM(f=>({...f,notas:e.target.value}))}/></div>
      </Modal>}
      {modalH&&<Modal title="✏️ Registrar Horas Manual" onClose={()=>setModalH(false)}
        footer={<><button className="btn btn-secondary" onClick={()=>setModalH(false)}>Cancelar</button><button className="btn btn-primary" onClick={saveH}>💾 Guardar</button></>}>
        <div style={{padding:"8px 12px",background:"#e8f4fd",borderRadius:8,marginBottom:12,fontSize:12,color:"#1a6ea8"}}>
          💡 Las horas registradas en Bitácora se contabilizan automáticamente. Usa esto solo para ajustes manuales.
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Fecha</label>
            <input className="form-input" type="date" value={formH.fecha} onChange={e=>setFormH(f=>({...f,fecha:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Equipo *</label>
            <select className="form-select" value={formH.maqId} onChange={e=>setFormH(f=>({...f,maqId:e.target.value}))}>
              <option value="">— Seleccionar —</option>
              {maquinaria.map(m=><option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Horas *</label>
            <input className="form-input" type="number" step="0.5" value={formH.horas} onChange={e=>setFormH(f=>({...f,horas:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Operador</label>
            <select className="form-select" value={formH.operadorId||""} onChange={e=>setFormH(f=>({...f,operadorId:e.target.value}))}>
              <option value="">— Ninguno —</option>
              {operadores.filter(o=>o.activo).map(o=><option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select></div>
        </div>
        <div className="form-group"><label className="form-label">Concepto</label>
          <input className="form-input" value={formH.concepto} onChange={e=>setFormH(f=>({...f,concepto:e.target.value}))} placeholder="Ej. Preparación de suelo"/></div>
      </Modal>}
    </div>
  );
}
