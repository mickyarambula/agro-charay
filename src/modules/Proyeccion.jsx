// ─── modules/Proyeccion.jsx ───────────────────────────────────────────

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
import { postProyeccion, deleteProyeccion } from '../core/supabaseWriters.js';


export default function ProyeccionModule() {
  const { state, dispatch } = useData();
  const mxn = n => (parseFloat(n)||0).toLocaleString("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:0,maximumFractionDigits:0});
  const mxn2= n => (parseFloat(n)||0).toLocaleString("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:2});
  const fmt = (n,d=2) => (parseFloat(n)||0).toLocaleString("es-MX",{minimumFractionDigits:d,maximumFractionDigits:d});

  const [vista,       setVista]      = useState("concepto");
  const [etapaFiltro, setEtapaFiltro]= useState("Todas");
  const [modalEdit,   setModalEdit]  = useState(false);
  const [modalLink,   setModalLink]  = useState(null); // partida para vincular egresos manualmente
  const [selRow,      setSelRow]     = useState(null);
  const [form,        setForm]       = useState({});
  const [expandido,   setExpandido]  = useState({}); // {id: bool}

  const proy    = state.proyeccion || [];
  const cid     = state.cicloActivoId || 1;
  const cicloP  = (state.ciclos||[]).find(c=>c.id===cid)||(state.ciclos||[])[0];
  const ha      = (cicloP?.asignaciones||[]).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0)||468;
  const _pcp    = getParamsCultivo(state);
  const ingreso = ha * _pcp.rendimiento * _pcp.precio;

  // ── MOTOR DE REAL POR VÍNCULO ────────────────────────────────────────────────
  const insumos_r  = (state.insumos||[]).filter(i=>!i.cancelado&&(i.cicloId||1)===cid);
  const diesel_r   = (state.diesel||[]).filter(d=>!d.cancelado&&(d.cicloId||1)===cid);
  const egresos_r  = (state.egresosManual||[]).filter(e=>!e.cancelado&&(e.cicloId||1)===cid);
  const cosecha    = state.cosecha || {};

  // Total diesel para distribuir proporcionalmente entre partidas diesel
  const totalDieselReal = diesel_r.reduce((s,d)=>s+(parseFloat(d.importe)||0),0);
  const totalDieselProy = proy.filter(p=>p.vinculo==="auto:diesel").reduce((s,p)=>s+p.totalProy,0);

  // Total fertilizantes para distribuir
  const totalFertReal = insumos_r.filter(i=>["Fertilizante"].includes(i.categoria)).reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
  const totalFertProy = proy.filter(p=>p.vinculo==="auto:insumos:Fertilizante").reduce((s,p)=>s+p.totalProy,0);

  // Total semilla
  const totalSemReal = insumos_r.filter(i=>i.categoria==="Semilla").reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
  const totalSemProy = proy.filter(p=>p.vinculo==="auto:insumos:Semilla").reduce((s,p)=>s+p.totalProy,0);

  // Total mano de obra
  const totalMOReal = egresos_r.filter(e=>e.categoria==="mano_obra").reduce((s,e)=>s+(parseFloat(e.monto)||0),0);
  const totalMOProy = proy.filter(p=>p.vinculo==="auto:egresos:mano_obra").reduce((s,p)=>s+p.totalProy,0);

  // Total renta
  const totalRentaReal = egresos_r.filter(e=>e.categoria==="renta_tierra").reduce((s,e)=>s+(parseFloat(e.monto)||0),0);
  const totalRentaProy = proy.filter(p=>p.vinculo==="auto:egresos:renta_tierra").reduce((s,p)=>s+p.totalProy,0);

  // Total agua
  const totalAguaReal = egresos_r.filter(e=>e.categoria==="pago_agua").reduce((s,e)=>s+(parseFloat(e.monto)||0),0);
  const totalAguaProy = proy.filter(p=>p.vinculo==="auto:egresos:pago_agua").reduce((s,p)=>s+p.totalProy,0);

  // Cosecha totals
  const totalMaquilaReal = (cosecha.cuadrillas||[]).reduce((s,c)=>s+(parseFloat(c.ha)||0)*(parseFloat(c.precioHa)||0),0)+(cosecha.maquila||[]).reduce((s,m)=>s+(parseFloat(m.ha)||0)*(parseFloat(m.precioHa)||0),0);
  const totalMaquilaProy = proy.filter(p=>p.vinculo==="auto:cosecha:maquila").reduce((s,p)=>s+p.totalProy,0);
  const totalFletesReal  = (cosecha.fletes||[]).reduce((s,f)=>s+(parseFloat(f.toneladas)||0)*(parseFloat(f.precioTon)||0),0);
  const totalFletesProy  = proy.filter(p=>p.vinculo==="auto:cosecha:fletes").reduce((s,p)=>s+p.totalProy,0);
  const totalSecadoReal  = (cosecha.secado||[]).reduce((s,s2)=>s+(parseFloat(s2.toneladas)||0)*(parseFloat(s2.costoTon)||0),0);
  const totalSecadoProy  = proy.filter(p=>p.vinculo==="auto:cosecha:secado").reduce((s,p)=>s+p.totalProy,0);

  // Calculate real for each partida
  const getRealPartida = (p) => {
    const v = p.vinculo || "manual";
    const peso = (total, totalProy) => totalProy > 0 ? (p.totalProy / totalProy) : 0;

    if(v === "auto:diesel")
      return totalDieselReal * peso(totalDieselReal, totalDieselProy);
    if(v === "auto:insumos:Fertilizante")
      return totalFertReal * peso(totalFertReal, totalFertProy);
    if(v === "auto:insumos:Semilla")
      return totalSemReal * peso(totalSemReal, totalSemProy);
    if(v === "auto:insumos:Herbicida")
      return insumos_r.filter(i=>["Herbicida","Insecticida"].includes(i.categoria)).reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
    if(v === "auto:insumos:Fungicida")
      return insumos_r.filter(i=>i.categoria==="Fungicida").reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
    if(v === "auto:insumos:Foliar")
      return insumos_r.filter(i=>["Foliar","Adherente"].includes(i.categoria)).reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
    if(v === "auto:egresos:renta_tierra")
      return totalRentaReal * peso(totalRentaReal, totalRentaProy);
    if(v === "auto:egresos:pago_agua")
      return totalAguaReal * peso(totalAguaReal, totalAguaProy);
    if(v === "auto:egresos:mano_obra")
      return totalMOReal * peso(totalMOReal, totalMOProy);
    if(v === "auto:egresos:seguros")
      return egresos_r.filter(e=>e.categoria==="seguros").reduce((s,e)=>s+(parseFloat(e.monto)||0),0);
    if(v === "auto:egresos:reparaciones")
      return egresos_r.filter(e=>e.categoria==="reparaciones").reduce((s,e)=>s+(parseFloat(e.monto)||0),0);
    if(v === "auto:egresos:tramites")
      return egresos_r.filter(e=>["tramites","permiso_siembra"].includes(e.categoria)).reduce((s,e)=>s+(parseFloat(e.monto)||0),0);
    if(v === "auto:egresos:otro")
      return egresos_r.filter(e=>["otro","tramites"].includes(e.categoria)).reduce((s,e)=>s+(parseFloat(e.monto)||0),0);
    if(v === "auto:cosecha:maquila")
      return totalMaquilaReal * peso(totalMaquilaReal, totalMaquilaProy);
    if(v === "auto:cosecha:fletes")
      return totalFletesReal * peso(totalFletesReal, totalFletesProy);
    if(v === "auto:cosecha:secado")
      return totalSecadoReal * peso(totalSecadoReal, totalSecadoProy);
    if(v === "auto:financiero")
      return calcularFinancieros(state).costoInteres || 0;
    if(v === "manual")
      return (p.egresoIds||[]).reduce((s,eid)=>{
        const e = egresos_r.find(x=>x.id===eid);
        return s + (e ? parseFloat(e.monto)||0 : 0);
      }, 0);
    return 0;
  };

  // Enrich each partida with real and desfase
  const proyEnriquecido = proy.map(p => {
    const real     = getRealPartida(p);
    const desfase  = real - p.totalProy;
    const pct      = p.totalProy > 0 ? (real / p.totalProy * 100) : 0;
    const semaforo = real === 0 ? "sin" : real > p.totalProy * 1.05 ? "sobre" : real > p.totalProy * 0.8 ? "ok" : "bajo";
    return { ...p, real, desfase, pct, semaforo };
  });

  const totalProy = proyEnriquecido.reduce((s,p)=>s+p.totalProy,0);
  const totalReal = proyEnriquecido.reduce((s,p)=>s+p.real,0);
  const totalDes  = totalReal - totalProy;
  const pctEjec   = totalProy > 0 ? Math.round(totalReal/totalProy*100) : 0;

  // Semaforo colors
  const SEM_COLOR = { sobre:"#c0392b", ok:"#2d5a1b", bajo:"#e67e22", sin:"#8a8070" };
  const SEM_ICON  = { sobre:"🔴", ok:"✅", bajo:"🟡", sin:"⚪" };
  const SEM_LABEL = { sobre:"Sobre presupuesto", ok:"Dentro del presupuesto", bajo:"En progreso", sin:"Sin movimiento" };

  // Etapas
  const ETAPAS_PROY = ["Preparación","Pre-siembra","Siembra","Renta","Cierre","Riego","Operación","Cosecha","Post-cosecha"];

  // Vinculo options for dropdown
  const VINCULO_OPTIONS = [
    { val:"auto:diesel",               label:"🛢 Diesel (total módulo diesel)" },
    { val:"auto:insumos:Semilla",      label:"🌽 Semilla (insumos)" },
    { val:"auto:insumos:Fertilizante", label:"🌿 Fertilizantes (insumos)" },
    { val:"auto:insumos:Herbicida",    label:"🧴 Herbicidas / Insecticidas (insumos)" },
    { val:"auto:insumos:Fungicida",    label:"🔬 Fungicidas (insumos)" },
    { val:"auto:insumos:Foliar",       label:"🍃 Foliares / Adherentes (insumos)" },
    { val:"auto:egresos:renta_tierra", label:"🏡 Renta de tierra (egresos)" },
    { val:"auto:egresos:pago_agua",    label:"💧 Agua / Riego (egresos)" },
    { val:"auto:egresos:mano_obra",    label:"👷 Mano de obra (egresos)" },
    { val:"auto:egresos:seguros",      label:"🛡 Seguros (egresos)" },
    { val:"auto:egresos:reparaciones", label:"🔧 Reparaciones (egresos)" },
    { val:"auto:egresos:tramites",     label:"📄 Trámites / Permisos (egresos)" },
    { val:"auto:egresos:otro",         label:"📋 Otros egresos" },
    { val:"auto:cosecha:maquila",      label:"⚙️ Maquila / Cuadrillas (cosecha)" },
    { val:"auto:cosecha:fletes",       label:"🚛 Fletes (cosecha)" },
    { val:"auto:cosecha:secado",       label:"🌡 Secado / Almacén (cosecha)" },
    { val:"auto:financiero",           label:"🏦 Costo financiero (intereses)" },
    { val:"manual",                    label:"✏️ Vincular manualmente a egresos" },
  ];

  const emptyRow = { etapa:"Preparación", concepto:"", categoria:"Administración", unidad:"ha",
    cantidad:"", costoUnit:"", ha:String(Math.round(ha)), notas:"", vinculo:"manual", egresoIds:[] };

  const saveRow = () => {
    const total = (parseFloat(form.cantidad)||0)*(parseFloat(form.costoUnit)||0);
    const p = { ...form, cantidad:parseFloat(form.cantidad)||0, costoUnit:parseFloat(form.costoUnit)||0,
      totalProy:total, ha:parseFloat(form.ha)||ha, egresoIds:form.egresoIds||[] };
    if(!p.concepto||!total) return;
    const payload = selRow ? {...p, id:selRow.id} : {...p, id:"P"+Date.now()};
    dispatch({ type: selRow ? "UPD_PROY" : "ADD_PROY", payload });
    postProyeccion(payload).catch(e => console.warn('[postProyeccion]:', e));
    setModalEdit(false); setSelRow(null); setForm({});
  };
  const editRow = r => { setSelRow(r); setForm({...r,cantidad:String(r.cantidad),costoUnit:String(r.costoUnit),ha:String(r.ha)}); setModalEdit(true); };

  // Filter for views
  const filtered = etapaFiltro==="Todas" ? proyEnriquecido : proyEnriquecido.filter(p=>p.etapa===etapaFiltro);

  // Group by etapa for etapa view
  const porEtapa = ETAPAS_PROY.map(etapa=>{
    const rows = proyEnriquecido.filter(p=>p.etapa===etapa);
    if(!rows.length) return null;
    return { etapa, rows, pTotal:rows.reduce((s,p)=>s+p.totalProy,0), rTotal:rows.reduce((s,p)=>s+p.real,0) };
  }).filter(Boolean);

  return (
    <div>
      {/* ── KPIs ── */}
      <div className="stat-grid" style={{gridTemplateColumns:"repeat(4,1fr)",marginBottom:16}}>
        {[
          {icon:"📋",label:"Presupuesto Total",        val:mxn(totalProy),    sub:mxn(totalProy/ha)+"/ha",                    color:"#1a6ea8"},
          {icon:"📊",label:"Gasto Real Registrado",    val:mxn(totalReal),    sub:pctEjec+"% ejecutado",                       color:totalReal>totalProy?"#c0392b":"#2d5a1b"},
          {icon:totalDes>0?"⚠️":"✅",label:"Variación Global", val:(totalDes>=0?"+":"")+mxn(totalDes),
           sub:totalDes>0?"Sobre presupuesto":"Bajo presupuesto", color:totalDes>totalProy*0.05?"#c0392b":totalDes<0?"#2d5a1b":"#e67e22"},
          {icon:"💵",label:"Utilidad Estimada",        val:mxn(ingreso-totalReal), sub:mxn(ingreso)+" ingreso",               color:ingreso-totalReal>=0?"#2d5a1b":"#c0392b"},
        ].map(({icon,label,val,sub,color})=>(
          <div key={label} className="stat-card" style={{borderTop:`3px solid ${color}`}}>
            <div className="stat-icon">{icon}</div>
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{fontSize:16,color}}>{val}</div>
            <div className="stat-sub">{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Barra global ── */}
      <div className="card" style={{marginBottom:16}}>
        <div className="card-body" style={{paddingBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:13}}>
            <span style={{fontWeight:600}}>Ejecución del presupuesto</span>
            <span style={{fontFamily:"monospace",color:T.fog}}>{mxn(totalReal)} / {mxn(totalProy)}</span>
          </div>
          <div style={{height:14,borderRadius:8,background:"#eee",overflow:"hidden"}}>
            <div style={{height:"100%",borderRadius:8,transition:"width 0.3s",
              background:totalReal>totalProy?"#c0392b":totalReal>totalProy*0.8?"#c8a84b":"#2d5a1b",
              width:Math.min(100,pctEjec)+"%"}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:11,color:T.fog}}>
            <span>0%</span>
            <span style={{fontWeight:700,color:T.ink}}>{pctEjec}% ejecutado</span>
            <span>100%</span>
          </div>
          {/* Semaforo summary */}
          <div style={{display:"flex",gap:16,marginTop:12,flexWrap:"wrap"}}>
            {Object.entries(SEM_LABEL).map(([k,label])=>{
              const n = proyEnriquecido.filter(p=>p.semaforo===k).length;
              if(!n) return null;
              return <span key={k} style={{fontSize:12,color:SEM_COLOR[k]}}>{SEM_ICON[k]} {n} {label.toLowerCase()}</span>;
            })}
          </div>
        </div>
      </div>

      {/* ── Tabs + botones ── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <div className="tabs" style={{marginBottom:0}}>
          {[["concepto","📋 Concepto a Concepto"],["etapa","🌱 Por Etapa"],["resumen","📦 Resumen Categoría"]].map(([id,lbl])=>(
            <div key={id} className={`tab ${vista===id?"active":""}`} onClick={()=>setVista(id)}>{lbl}</div>
          ))}
        </div>
        <div style={{display:"flex",gap:8}}>
          <select value={etapaFiltro} onChange={e=>setEtapaFiltro(e.target.value)}
            style={{border:`1px solid ${T.line}`,borderRadius:6,padding:"5px 10px",fontSize:12,background:"white"}}>
            <option value="Todas">Todas las etapas</option>
            {ETAPAS_PROY.map(e=><option key={e} value={e}>{e}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={()=>exportarExcel("Proyeccion_vs_Real",[{
            nombre:"Proyección vs Real",
            headers:["Etapa","Concepto","Categoría","Unidad","Cant.","$/Unit","Presupuesto","Real","Desfase","% Ejec.","Estatus"],
            rows:filtered.map(p=>[p.etapa,p.concepto,p.categoria,p.unidad,p.cantidad,p.costoUnit,p.totalProy,Math.round(p.real),Math.round(p.desfase),Math.round(p.pct)+"%",SEM_LABEL[p.semaforo]])
          }])}>📥 Excel</button>
          <button className="btn btn-primary btn-sm" onClick={()=>{setSelRow(null);setForm(emptyRow);setModalEdit(true);}}>＋ Partida</button>
        </div>
      </div>

      {/* ── VISTA CONCEPTO A CONCEPTO ── */}
      {vista==="concepto" && (
        <div className="card">
          <div className="table-wrap-scroll">
            <table style={{minWidth:900}}>
              <thead>
                <tr>
                  <th style={{width:28}}></th>
                  <th>Concepto</th>
                  <th>Etapa</th>
                  <th style={{textAlign:"right"}}>Presupuesto</th>
                  <th style={{textAlign:"right"}}>$/ha proy.</th>
                  <th style={{textAlign:"right"}}>Real</th>
                  <th style={{textAlign:"right"}}>Desfase</th>
                  <th style={{textAlign:"right"}}>% Ejec.</th>
                  <th style={{textAlign:"center"}}>Estatus</th>
                  <th style={{textAlign:"center"}}>Vínculo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p,i)=>{
                  const bg = i%2===0?"white":"#faf8f3";
                  const desfaseColor = p.desfase>0?"#c0392b":p.desfase<0?"#2d5a1b":T.fog;
                  const isExp = expandido[p.id];
                  const vincLabel = VINCULO_OPTIONS.find(v=>v.val===p.vinculo)?.label || p.vinculo;
                  return (
                    <>
                      <tr key={p.id} style={{cursor:"pointer"}} onClick={()=>setExpandido(e=>({...e,[p.id]:!e[p.id]}))}>
                        <td style={{background:bg,textAlign:"center",color:T.fog,fontSize:12}}>
                          {isExp?"▼":"▶"}
                        </td>
                        <td style={{background:bg,fontWeight:600,fontSize:13}}>{p.concepto}</td>
                        <td style={{background:bg}}>
                          <span style={{fontSize:10,padding:"2px 7px",borderRadius:10,background:T.mist,color:T.fog,border:`1px solid ${T.line}`}}>{p.etapa}</span>
                        </td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:600,color:"#1a6ea8"}}>{mxn(p.totalProy)}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:11,color:T.fog}}>{p.ha>0?mxn(p.totalProy/p.ha):"—"}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:700,color:p.real>0?"#2d5a1b":T.fog}}>{p.real>0?mxn(p.real):"—"}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:600,color:desfaseColor}}>
                          {p.real===0?"—":(p.desfase>=0?"+":"")+mxn(p.desfase)}
                        </td>
                        <td style={{background:bg,textAlign:"right"}}>
                          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2}}>
                            <span style={{fontFamily:"monospace",fontSize:12,fontWeight:700,color:SEM_COLOR[p.semaforo]}}>{Math.round(p.pct)}%</span>
                            <div style={{width:60,height:5,borderRadius:3,background:"#eee",overflow:"hidden"}}>
                              <div style={{height:"100%",borderRadius:3,background:SEM_COLOR[p.semaforo],width:Math.min(100,Math.round(p.pct))+"%"}}/>
                            </div>
                          </div>
                        </td>
                        <td style={{background:bg,textAlign:"center"}}>
                          <span title={SEM_LABEL[p.semaforo]} style={{fontSize:16}}>{SEM_ICON[p.semaforo]}</span>
                        </td>
                        <td style={{background:bg,maxWidth:140}}>
                          <span style={{fontSize:10,color:T.fog,display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={vincLabel}>
                            {p.vinculo==="manual"?"✏️ Manual":vincLabel.split("(")[0].trim()}
                          </span>
                        </td>
                        <td style={{background:bg}} onClick={e=>e.stopPropagation()}>
                          <div style={{display:"flex",gap:3}}>
                            <button className="btn btn-sm btn-secondary" title="Editar partida" onClick={()=>editRow(p)}>✏️</button>
                            {p.vinculo==="manual"&&(
                              <button className="btn btn-sm btn-secondary" title="Vincular egresos" onClick={()=>setModalLink(p)}>🔗</button>
                            )}
                            <button className="btn btn-sm btn-danger" onClick={()=>confirmarEliminar("¿Eliminar esta partida?",()=>{
                              dispatch({type:"DEL_PROY",payload:p.id});
                              deleteProyeccion(p.id).catch(e => console.warn('[deleteProyeccion]:', e));
                            })}>🗑</button>
                          </div>
                        </td>
                      </tr>
                      {/* Fila expandida — detalle del vínculo */}
                      {isExp&&(
                        <tr key={p.id+"_exp"}>
                          <td colSpan={11} style={{background:"#f0f7ec",padding:"10px 24px"}}>
                            <div style={{fontSize:12,color:T.fog,marginBottom:4}}>
                              <strong>Vínculo:</strong> {vincLabel}
                              {p.notas&&<span style={{marginLeft:12,fontStyle:"italic"}}>· {p.notas}</span>}
                            </div>
                            {p.vinculo==="manual"&&(p.egresoIds||[]).length>0&&(
                              <div>
                                <strong style={{fontSize:12}}>Egresos vinculados:</strong>
                                {(p.egresoIds||[]).map(eid=>{
                                  const eg = egresos_r.find(e=>e.id===eid);
                                  return eg?(
                                    <span key={eid} style={{marginLeft:8,fontSize:11,padding:"2px 8px",borderRadius:10,background:"#d4edda",color:"#155724"}}>
                                      {eg.concepto} — {mxn(eg.monto)}
                                    </span>
                                  ):null;
                                })}
                              </div>
                            )}
                            {p.vinculo==="manual"&&(p.egresoIds||[]).length===0&&(
                              <span style={{fontSize:12,color:"#c0392b"}}>⚠️ Sin egresos vinculados — usa el botón 🔗 para vincular</span>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{background:"#f0f4e8",fontWeight:700}}>
                  <td colSpan={3}>TOTAL {etapaFiltro!=="Todas"?"— "+etapaFiltro:""}</td>
                  <td style={{textAlign:"right",fontFamily:"monospace",color:"#1a6ea8"}}>{mxn(filtered.reduce((s,p)=>s+p.totalProy,0))}</td>
                  <td style={{textAlign:"right",fontFamily:"monospace",fontSize:11,color:T.fog}}>{mxn(filtered.reduce((s,p)=>s+p.totalProy,0)/ha)}</td>
                  <td style={{textAlign:"right",fontFamily:"monospace",color:"#2d5a1b"}}>{mxn(filtered.reduce((s,p)=>s+p.real,0))}</td>
                  <td style={{textAlign:"right",fontFamily:"monospace",color:filtered.reduce((s,p)=>s+p.desfase,0)>0?"#c0392b":"#2d5a1b"}}>
                    {(()=>{const d=filtered.reduce((s,p)=>s+p.desfase,0);return(d>=0?"+":"")+mxn(d);})()}
                  </td>
                  <td colSpan={4}/>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── VISTA POR ETAPA ── */}
      {vista==="etapa" && (
        <div>
          {porEtapa.filter(e=>etapaFiltro==="Todas"||e.etapa===etapaFiltro).map(({etapa,rows,pTotal,rTotal})=>{
            const des = rTotal - pTotal;
            const pct = pTotal>0?Math.round(rTotal/pTotal*100):0;
            const col = rTotal>pTotal?"#c0392b":rTotal>pTotal*0.8?"#c8a84b":"#2d5a1b";
            return (
              <div key={etapa} className="card" style={{marginBottom:12}}>
                <div style={{padding:"12px 18px",borderBottom:`1px solid ${T.line}`,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                  <div style={{fontFamily:"Georgia, serif",fontSize:16,fontWeight:700,flex:1}}>{etapa}</div>
                  <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"center"}}>
                    <div style={{textAlign:"right"}}><div style={{fontSize:10,color:T.fog}}>Presupuesto</div><div style={{fontFamily:"monospace",fontWeight:600}}>{mxn(pTotal)}</div></div>
                    <div style={{textAlign:"right"}}><div style={{fontSize:10,color:T.fog}}>Real</div><div style={{fontFamily:"monospace",fontWeight:700,color:col}}>{mxn(rTotal)}</div></div>
                    <div style={{textAlign:"right",minWidth:80}}><div style={{fontSize:10,color:T.fog}}>Desfase</div><div style={{fontFamily:"monospace",fontSize:12,fontWeight:600,color:des>0?"#c0392b":"#2d5a1b"}}>{(des>=0?"+":"")+mxn(des)}</div></div>
                    <div style={{width:100}}>
                      <div style={{height:8,borderRadius:4,background:"#eee",overflow:"hidden"}}>
                        <div style={{height:"100%",borderRadius:4,background:col,width:Math.min(100,pct)+"%"}}/>
                      </div>
                      <div style={{fontSize:10,color:T.fog,textAlign:"center",marginTop:2}}>{pct}%</div>
                    </div>
                  </div>
                </div>
                <div className="table-wrap-scroll">
                  <table>
                    <thead><tr>
                      <th>Concepto</th><th style={{textAlign:"right"}}>Presupuesto</th>
                      <th style={{textAlign:"right"}}>Real</th><th style={{textAlign:"right"}}>Desfase</th>
                      <th style={{textAlign:"center"}}>%</th><th style={{textAlign:"center"}}>Estatus</th>
                    </tr></thead>
                    <tbody>
                      {rows.map((p,i)=>{
                        const bg=i%2===0?"white":"#faf8f3";
                        return (<tr key={p.id}>
                          <td style={{background:bg,fontWeight:500}}>{p.concepto}</td>
                          <td style={{background:bg,textAlign:"right",fontFamily:"monospace",color:"#1a6ea8"}}>{mxn(p.totalProy)}</td>
                          <td style={{background:bg,textAlign:"right",fontFamily:"monospace",color:p.real>0?"#2d5a1b":T.fog,fontWeight:700}}>{p.real>0?mxn(p.real):"—"}</td>
                          <td style={{background:bg,textAlign:"right",fontFamily:"monospace",color:p.desfase>0?"#c0392b":p.desfase<0?"#2d5a1b":T.fog}}>
                            {p.real===0?"—":(p.desfase>=0?"+":"")+mxn(p.desfase)}
                          </td>
                          <td style={{background:bg,textAlign:"center",fontFamily:"monospace",fontSize:12,fontWeight:700,color:SEM_COLOR[p.semaforo]}}>{Math.round(p.pct)}%</td>
                          <td style={{background:bg,textAlign:"center",fontSize:16}} title={SEM_LABEL[p.semaforo]}>{SEM_ICON[p.semaforo]}</td>
                        </tr>);
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── VISTA RESUMEN POR CATEGORÍA ── */}
      {vista==="resumen" && (
        <div className="card">
          <div className="table-wrap-scroll">
            <table>
              <thead><tr>
                <th>Categoría</th>
                <th style={{textAlign:"right"}}>Presupuesto</th>
                <th style={{textAlign:"right"}}>$/ha</th>
                <th style={{textAlign:"right"}}>Real</th>
                <th style={{textAlign:"right"}}>Desfase</th>
                <th>Avance</th>
                <th style={{textAlign:"right"}}>% del total</th>
              </tr></thead>
              <tbody>
                {(()=>{
                  const cats = [...new Set(proyEnriquecido.map(p=>p.categoria))];
                  return cats.map(cat=>{
                    const rows = proyEnriquecido.filter(p=>p.categoria===cat);
                    const pT = rows.reduce((s,p)=>s+p.totalProy,0);
                    const rT = rows.reduce((s,p)=>s+p.real,0);
                    const d  = rT-pT;
                    const pct = pT>0?Math.round(rT/pT*100):0;
                    const col = rT>pT?"#c0392b":rT>pT*0.8?"#c8a84b":"#2d5a1b";
                    return (<tr key={cat}>
                      <td style={{fontWeight:600}}>{cat}</td>
                      <td style={{textAlign:"right",fontFamily:"monospace",color:"#1a6ea8",fontWeight:600}}>{mxn(pT)}</td>
                      <td style={{textAlign:"right",fontFamily:"monospace",fontSize:11,color:T.fog}}>{mxn(pT/ha)}</td>
                      <td style={{textAlign:"right",fontFamily:"monospace",color:col,fontWeight:700}}>{rT>0?mxn(rT):"—"}</td>
                      <td style={{textAlign:"right",fontFamily:"monospace",color:d>0?"#c0392b":d<0?"#2d5a1b":T.fog,fontWeight:600}}>
                        {rT===0?"—":(d>=0?"+":"")+mxn(d)}
                      </td>
                      <td style={{minWidth:120}}>
                        <div style={{height:8,borderRadius:4,background:"#eee",overflow:"hidden"}}>
                          <div style={{height:"100%",borderRadius:4,background:col,width:Math.min(100,pct)+"%"}}/>
                        </div>
                        <div style={{fontSize:10,color:T.fog,marginTop:2}}>{pct}%</div>
                      </td>
                      <td style={{textAlign:"right",fontFamily:"monospace",fontSize:11,color:T.fog}}>{totalProy>0?fmt(pT/totalProy*100,1):0}%</td>
                    </tr>);
                  });
                })()}
              </tbody>
              <tfoot>
                <tr style={{background:"#f0f4e8",fontWeight:700}}>
                  <td>TOTAL CICLO</td>
                  <td style={{textAlign:"right",fontFamily:"monospace",color:"#1a6ea8"}}>{mxn(totalProy)}</td>
                  <td style={{textAlign:"right",fontFamily:"monospace",fontSize:11,color:T.fog}}>{mxn(totalProy/ha)}</td>
                  <td style={{textAlign:"right",fontFamily:"monospace",color:totalReal>totalProy?"#c0392b":"#2d5a1b"}}>{mxn(totalReal)}</td>
                  <td style={{textAlign:"right",fontFamily:"monospace",color:totalDes>0?"#c0392b":"#2d5a1b"}}>{(totalDes>=0?"+":"")+mxn(totalDes)}</td>
                  <td colSpan={2}/>
                </tr>
              </tfoot>
            </table>
          </div>
          {/* Utilidad */}
          <div style={{padding:16,borderTop:`2px solid ${T.line}`,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
            {[[" Ingreso estimado",ingreso,"#1a6ea8"],["Utilidad vs presupuesto",ingreso-totalProy,ingreso-totalProy>=0?"#2d5a1b":"#c0392b"],["Utilidad vs real",ingreso-totalReal,ingreso-totalReal>=0?"#2d5a1b":"#c0392b"]].map(([l,v,c])=>(
              <div key={l} style={{padding:"10px 14px",borderRadius:8,background:T.mist,textAlign:"center"}}>
                <div style={{fontSize:11,color:T.fog,marginBottom:4}}>{l}</div>
                <div style={{fontFamily:"monospace",fontSize:15,fontWeight:700,color:c}}>{mxn(v)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal editar/agregar partida ── */}
      {modalEdit&&(
        <Modal title={selRow?"Editar partida presupuestal":"Nueva partida presupuestal"}
          onClose={()=>{setModalEdit(false);setSelRow(null);}}
          footer={<><button className="btn btn-secondary" onClick={()=>{setModalEdit(false);setSelRow(null);}}>Cancelar</button>
            <button className="btn btn-primary" onClick={saveRow}>💾 Guardar</button></>}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Etapa</label>
              <select className="form-select" value={form.etapa||"Preparación"} onChange={e=>setForm(f=>({...f,etapa:e.target.value}))}>
                {ETAPAS_PROY.map(e=><option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select className="form-select" value={form.categoria||""} onChange={e=>setForm(f=>({...f,categoria:e.target.value}))}>
                {["Administración","Maquinaria","Diesel","Insumos","Renta","Agua / Riego","Mano de Obra","Cosecha y Maquila","Seguro","Financiero"].map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Concepto *</label>
            <input className="form-input" value={form.concepto||""} onChange={e=>setForm(f=>({...f,concepto:e.target.value}))} placeholder="Descripción del gasto"/>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Unidad</label>
              <input className="form-input" value={form.unidad||""} onChange={e=>setForm(f=>({...f,unidad:e.target.value}))} placeholder="ha, litros, ton..."/>
            </div>
            <div className="form-group">
              <label className="form-label">Ha que aplica</label>
              <input className="form-input" type="number" value={form.ha||""} onChange={e=>setForm(f=>({...f,ha:e.target.value}))}/>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Cantidad</label>
              <input className="form-input" type="number" value={form.cantidad||""} onChange={e=>setForm(f=>({...f,cantidad:e.target.value}))}/>
            </div>
            <div className="form-group">
              <label className="form-label">Costo unitario ($)</label>
              <input className="form-input" type="number" value={form.costoUnit||""} onChange={e=>setForm(f=>({...f,costoUnit:e.target.value}))}/>
            </div>
          </div>
          {form.cantidad&&form.costoUnit&&(
            <div style={{padding:"8px 12px",background:T.mist,borderRadius:8,fontSize:13,marginBottom:8}}>
              Total: <strong>{mxn2((parseFloat(form.cantidad)||0)*(parseFloat(form.costoUnit)||0))}</strong>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">🔗 Vínculo con datos reales</label>
            <select className="form-select" value={form.vinculo||"manual"} onChange={e=>setForm(f=>({...f,vinculo:e.target.value}))}>
              {VINCULO_OPTIONS.map(v=><option key={v.val} value={v.val}>{v.label}</option>)}
            </select>
            <div style={{fontSize:11,color:T.fog,marginTop:4}}>
              Define de dónde toma el sistema los datos reales para comparar con este presupuesto
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notas</label>
            <input className="form-input" value={form.notas||""} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} placeholder="Observaciones..."/>
          </div>
        </Modal>
      )}

      {/* ── Modal vincular egresos manuales ── */}
      {modalLink&&(
        <Modal title={"🔗 Vincular egresos — "+modalLink.concepto}
          onClose={()=>setModalLink(null)}
          footer={<button className="btn btn-secondary" onClick={()=>setModalLink(null)}>Cerrar</button>}>
          <p style={{fontSize:13,color:T.fog,marginBottom:12}}>
            Selecciona los egresos reales que corresponden a esta partida presupuestal:
          </p>
          <div style={{maxHeight:350,overflowY:"auto"}}>
            {egresos_r.length===0?(
              <div style={{textAlign:"center",color:T.fog,padding:20}}>Sin egresos registrados en este ciclo</div>
            ):egresos_r.map(e=>{
              const linked = (modalLink.egresoIds||[]).includes(e.id);
              return (
                <div key={e.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${T.line}`}}>
                  <input type="checkbox" checked={linked} style={{width:16,height:16,cursor:"pointer"}}
                    onChange={()=>{
                      const ids = modalLink.egresoIds||[];
                      const newIds = linked ? ids.filter(x=>x!==e.id) : [...ids,e.id];
                      const updated = {...modalLink, egresoIds:newIds, real:newIds.reduce((s,eid)=>{const eg=egresos_r.find(x=>x.id===eid);return s+(eg?parseFloat(eg.monto)||0:0);},0)};
                      dispatch({type:"UPD_PROY", payload:updated});
                      postProyeccion(updated).catch(e => console.warn('[postProyeccion]:', e));
                      setModalLink(updated);
                    }}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:linked?600:400}}>{e.concepto}</div>
                    <div style={{fontSize:11,color:T.fog}}>{e.fecha} · {e.categoria}</div>
                  </div>
                  <div style={{fontFamily:"monospace",fontSize:13,fontWeight:700,color:linked?"#2d5a1b":T.fog}}>{mxn(e.monto)}</div>
                </div>
              );
            })}
          </div>
          <div style={{marginTop:12,padding:"10px 12px",background:"#f0f7ec",borderRadius:8,fontSize:13}}>
            <strong>Total vinculado:</strong> {mxn((modalLink.egresoIds||[]).reduce((s,eid)=>{const e=egresos_r.find(x=>x.id===eid);return s+(e?parseFloat(e.monto)||0:0);},0))}
            {" vs presupuesto: "}{mxn(modalLink.totalProy)}
          </div>
        </Modal>
      )}
    </div>
  );
}
