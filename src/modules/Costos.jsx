// ─── modules/Costos.jsx ───────────────────────────────────────────

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


export default function CostosModule({ userRol, puedeEditar, onNavigate }) {
  const { state, dispatch } = useData();
  const nav = (page, pid, filtros) => onNavigate && onNavigate(page, pid, filtros);
  const [vista, setVista]   = useState("global"); // global | productor
  const [prodSel, setProdSel] = useState(null);
  const mxnFmt = n => (parseFloat(n)||0).toLocaleString("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:2,maximumFractionDigits:2});

  const F          = calcularFinancieros(state);
  const productores= state.productores||[];
  const cicloPred  = (state.ciclos||[]).find(c=>c.id===state.cicloActivoId)||(state.ciclos||[]).find(c=>c.id===state.cicloActivoId)||(state.ciclos||[]).find(c=>c.predeterminado)||(state.ciclos||[])[0];
  const asigsCiclo = (cicloPred?.asignaciones||[]).filter(a=>
    !state.cultivoActivo||(a.cultivoId===state.cultivoActivo.cultivoId&&a.variedad===state.cultivoActivo.variedad)
  );
  const insumos    = (state.insumos||[]).filter(i=>!i.cancelado&&((i.cicloId||1)===(state.cicloActivoId||1)));
  const diesel     = (state.diesel||[]).filter(d=>!d.cancelado&&((d.cicloId||1)===(state.cicloActivoId||1)));
  const egresos    = (state.egresosManual||[]).filter(e=>(e.cicloId||1)===(state.cicloActivoId||1)).filter(e=>!e.cancelado);

  // Parámetros editables — por ciclo+cultivo
  const _pcParams   = getParamsCultivo(state);
  const [editParams, setEditParams] = useState(false);
  const [precio, setPrecio]         = useState(_pcParams.precio);
  const [rendEsp, setRendEsp]       = useState(_pcParams.rendimiento);

  // Sync cuando cambia ciclo o cultivo — NO cuando cambia paramsCultivo
  React.useEffect(() => {
    const p = getParamsCultivo(state);
    setPrecio(p.precio);
    setRendEsp(p.rendimiento);
  }, [state.cicloActivoId, state.cultivoActivo?.cultivoId, state.cultivoActivo?.variedad]); // eslint-disable-line

  const guardarParams = () => {
    // Obtener la key correcta — si no hay cultivoActivo pero el ciclo
    // tiene un solo cultivo, usar esa key; si no, guardar en todas las keys del ciclo
    const p = getParamsCultivo(state);
    const cicloId = state.cicloActivoId || 1;
    const ciclo   = (state.ciclos||[]).find(c=>c.id===cicloId);
    const cultivos = ciclo?.cultivosDelCiclo || [];
    const precioParsed = parseFloat(precio) || 4800;
    const rendParsed   = parseFloat(rendEsp) || 9.1;

    if (cultivos.length > 0 && !state.cultivoActivo) {
      // Sin filtro activo — guardar en TODAS las keys del ciclo para que aplique a todo
      cultivos.forEach(cv => {
        const key = `${cicloId}|${cv.cultivoId}|${cv.variedad}`;
        dispatch({ type:"UPD_PARAMS_CULTIVO", payload:{ key, precio: precioParsed, rendimiento: rendParsed }});
      });
      // También guardar en global del ciclo como fallback
      dispatch({ type:"UPD_PARAMS_CULTIVO", payload:{ key: `${cicloId}|global`, precio: precioParsed, rendimiento: rendParsed }});
    } else {
      // Guardar en la key específica del cultivo activo
      dispatch({ type:"UPD_PARAMS_CULTIVO", payload:{ key: p.key, precio: precioParsed, rendimiento: rendParsed }});
    }
    setEditParams(false);
  };

  // Gasto por productor
  const gastoProd = (id) => {
    const ins = insumos.filter(i=>String(i.productorId)===String(id)).reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
    const die = diesel.filter(d=>String(d.productorId)===String(id)).reduce((s,d)=>s+(parseFloat(d.importe)||0),0);
    const efe = egresos.filter(e=>String(e.productorId)===String(id)).reduce((s,e)=>s+(parseFloat(e.monto)||0),0);
    return { ins, die, efe, total: ins+die+efe };
  };

  const haProd = (id) => asigsCiclo.filter(a=>String(a.productorId)===String(id)).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);

  // ── VISTA GLOBAL ─────────────────────────────────────────────────────────────
  if (vista==="global") return (
    <div>
      {/* Parámetros */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,padding:"10px 14px",background:"#faf8f3",borderRadius:8,border:"1px solid #e8e0d0"}}>
        {editParams?(
          <div style={{display:"flex",gap:12,alignItems:"flex-end",flex:1}}>
            <div className="form-group" style={{marginBottom:0}}>
              <label className="form-label" style={{fontSize:11}}>Precio de venta ($/ton)</label>
              <input className="form-input" type="number" value={precio} onChange={e=>setPrecio(e.target.value)} style={{width:140}}/>
            </div>
            <div className="form-group" style={{marginBottom:0}}>
              <label className="form-label" style={{fontSize:11}}>Rendimiento esperado (ton/ha)</label>
              <input className="form-input" type="number" step="0.1" value={rendEsp} onChange={e=>setRendEsp(e.target.value)} style={{width:140}}/>
            </div>
            <button className="btn btn-primary btn-sm" onClick={guardarParams}>💾 Guardar</button>
            <button className="btn btn-secondary btn-sm" onClick={()=>setEditParams(false)}>✕</button>
          </div>
        ):(
          <div style={{fontSize:12,color:"#6a6050"}}>
            Precio: <strong>{mxnFmt(F.precio)}/ton</strong> · Rendimiento esperado: <strong>{F.ha>0?(F.produccionEst/F.ha).toFixed(2):0} ton/ha</strong>
            {F.hayProduccionReal && <span style={{marginLeft:8,color:"#2d5a1b",fontWeight:600}}>✅ Con producción real</span>}
          </div>
        )}
        {!editParams && puedeEditar && <button className="btn btn-sm btn-secondary" onClick={()=>setEditParams(true)}>✏️ Editar parámetros</button>}
      </div>

      {/* KPIs */}
      <div className="stat-grid" style={{gridTemplateColumns:"repeat(4,1fr)",marginBottom:16}}>
        <div className="stat-card rust">
          <div className="stat-icon">💸</div>
          <div className="stat-label">Costo Total Ciclo</div>
          <div className="stat-value" style={{fontSize:16}}>{mxnFmt(F.costoTotal)}</div>
          <div className="stat-sub">{mxnFmt(F.ha>0?F.costoTotal/F.ha:0)}/ha</div>
        </div>
        <div className="stat-card gold">
          <div className="stat-icon">🌽</div>
          <div className="stat-label">Costo / Tonelada</div>
          <div className="stat-value" style={{fontSize:16}}>{mxnFmt(F.costoTon)}</div>
          <div className="stat-sub">Precio: {mxnFmt(F.precio)}/ton</div>
        </div>
        <div className="stat-card sky">
          <div className="stat-icon">⚖️</div>
          <div className="stat-label">Punto de Equilibrio</div>
          <div className="stat-value" style={{fontSize:16}}>{F.peTon.toFixed(1)} ton</div>
          <div className="stat-sub">{(F.ha>0?F.peTon/F.ha:0).toFixed(2)} ton/ha mínimo</div>
        </div>
        <div className="stat-card" style={{borderLeft:`4px solid ${F.utilidadBruta>=0?T.field:T.rust}`}}>
          <div className="stat-icon">{F.utilidadBruta>=0?"🟢":"🔴"}</div>
          <div className="stat-label">Utilidad Estimada</div>
          <div className="stat-value" style={{fontSize:16,color:F.utilidadBruta>=0?T.field:T.rust}}>{mxnFmt(F.utilidadBruta)}</div>
          <div className="stat-sub">{Math.abs(F.margen).toFixed(1)}% margen · {F.produccionEst.toFixed(0)} ton est.</div>
        </div>
      </div>

      {/* Desglose de costos */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <div className="card">
          <div className="card-header"><div className="card-title">Desglose de Costos</div></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Concepto</th><th style={{textAlign:"right"}}>Monto</th><th style={{textAlign:"right"}}>$/ha</th><th style={{textAlign:"right"}}>% total</th></tr></thead>
              <tbody>
                {[
                  ["🌽 Semilla",        F.costoSemilla,  "#c8a84b", "insumos",  {categoria:"Semilla",    vista:"tabla"}],
                  ["🌿 Insumos",        F.costoInsumos-F.costoSemilla, "#2d5a1b", "insumos", {categoria:"Fertilizante",vista:"tabla"}],
                  ["⛽ Diesel",          F.costoDiesel,   "#e67e22", "diesel"],
                  ["🏡 Renta",          F.costoRenta,    "#9b6d3a", "rentas"],
                  ["👷 Mano de Obra",   F.costoManoObra, "#5b9fd6", "gastos"],
                  ["💧 Agua",           F.costoAgua,     "#1a6ea8", "gastos"],
                  ["🛡️ Seguros",        F.costoSeguros,  "#8e44ad", "gastos"],
                  ["📋 Trámites/Otros", F.costoTramites+F.costoOtros,"#7f8c8d", "gastos"],
                  ["✂️ Cosecha",        F.costoCosecha,  "#27ae60", "cosecha"],
                  ["📈 Intereses",      F.costoInteres,  "#c0392b", "credito"],
                  ["🏦 Comisiones (Fact+FEGA+AT)", F.costoComisiones, "#d35400", "credito"],
                ].filter(([,v])=>v>0).map(([l,v,c,mod,filtro],i)=>(
                  <tr key={l} style={{background:i%2===0?"white":"#faf8f3",cursor:"pointer",transition:"filter 0.12s"}}
                    onClick={()=>nav(mod, null, filtro)}
                    onMouseEnter={e=>e.currentTarget.style.filter="brightness(0.92)"}
                    onMouseLeave={e=>e.currentTarget.style.filter=""}
                    title={`→ Ver en ${mod}${filtro?.categoria?' · '+filtro.categoria:''}`}>
                    <td style={{fontSize:12,fontWeight:500}}>
                      {l} <span style={{fontSize:10,color:T.field,marginLeft:4,opacity:0.7}}>→</span>
                    </td>
                    <td style={{textAlign:"right",fontFamily:"monospace",fontSize:12,fontWeight:700,color:c}}>{mxnFmt(v)}</td>
                    <td style={{textAlign:"right",fontFamily:"monospace",fontSize:11,color:"#8a8070"}}>{mxnFmt(F.ha>0?v/F.ha:0)}</td>
                    <td style={{textAlign:"right",fontFamily:"monospace",fontSize:11,color:"#8a8070"}}>{F.costoTotal>0?(v/F.costoTotal*100).toFixed(1):0}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{background:"#f0f4e8",fontWeight:700}}>
                  <td>TOTAL</td>
                  <td style={{textAlign:"right",fontFamily:"monospace",color:"#c0392b"}}>{mxnFmt(F.costoTotal)}</td>
                  <td style={{textAlign:"right",fontFamily:"monospace",color:"#c0392b"}}>{mxnFmt(F.ha>0?F.costoTotal/F.ha:0)}</td>
                  <td style={{textAlign:"right",fontFamily:"monospace"}}>100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {/* Análisis de rentabilidad */}
          <div className="card">
            <div className="card-header"><div className="card-title">Análisis de Rentabilidad</div></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Escenario</th><th style={{textAlign:"right"}}>Precio/ton</th><th style={{textAlign:"right"}}>Utilidad</th><th style={{textAlign:"right"}}>Margen</th></tr></thead>
                <tbody>
                  {[
                    ["Pesimista (-10%)", F.precio*0.9],
                    ["Base",             F.precio],
                    ["Optimista (+10%)", F.precio*1.1],
                    ["Optimista (+20%)", F.precio*1.2],
                  ].map(([esc, p],i)=>{
                    const util = F.produccionEst*p - F.costoTotal;
                    const marg = F.produccionEst*p>0?util/(F.produccionEst*p)*100:0;
                    const bg   = i%2===0?"white":"#faf8f3";
                    return (
                      <tr key={esc}>
                        <td style={{background:bg,fontSize:12,fontWeight:esc==="Base"?700:400}}>{esc}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12}}>{mxnFmt(p)}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12,fontWeight:700,color:util>=0?T.field:T.rust}}>{mxnFmt(util)}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:11,color:marg>=0?T.field:T.rust}}>{marg.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sensibilidad al rendimiento */}
          <div className="card">
            <div className="card-header"><div className="card-title">Sensibilidad al Rendimiento</div></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Rend. (ton/ha)</th><th style={{textAlign:"right"}}>Producción</th><th style={{textAlign:"right"}}>Ingreso</th><th style={{textAlign:"right"}}>Utilidad</th></tr></thead>
                <tbody>
                  {[7,7.5,8,8.5,9,9.5,10,10.5,11,11.5,12,12.5,13,13.5,14].map((r,i)=>{
                    const prod = F.ha * r;
                    const ing  = prod * F.precio;
                    const util = ing - F.costoTotal;
                    const esPE = Math.abs(r - F.peTon/Math.max(F.ha,1)) < 0.15;
                    const bg   = esPE?"#fff9c4":i%2===0?"white":"#faf8f3";
                    return (
                      <tr key={r}>
                        <td style={{background:bg,fontSize:12,fontWeight:esPE?700:400}}>{r.toFixed(1)}{esPE?" ← PE":""}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:11}}>{prod.toFixed(0)} ton</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:11}}>{mxnFmt(ing)}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12,fontWeight:700,color:util>=0?T.field:T.rust}}>{mxnFmt(util)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Costos por productor */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Costos por Productor</div>
          <BtnExport onClick={()=>exportarExcel("Costos_Productor_"+state.cicloActual,[{
            nombre:"Costos",
            headers:["Productor","Ha","Sem+Ins","Diesel","Efectivo","Total","$/ha"],
            rows:(state.productores||[]).map(p=>{
              const ha=asigsCiclo.filter(a=>String(a.productorId)===String(p.id)).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);
              const ins=(state.insumos||[]).filter(i=>!i.cancelado&&(i.cicloId||1)===(state.cicloActivoId||1)&&String(i.productorId)===String(p.id)).reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
              const die=(state.diesel||[]).filter(d=>!d.cancelado&&(d.cicloId||1)===(state.cicloActivoId||1)&&String(d.productorId)===String(p.id)).reduce((s,d)=>s+(parseFloat(d.importe)||0),0);
              const efe=(state.egresosManual||[]).filter(e=>!e.cancelado&&(e.cicloId||1)===(state.cicloActivoId||1)&&String(e.productorId)===String(p.id)).reduce((s,e)=>s+(parseFloat(e.monto)||0),0);
              const tot=ins+die+efe;
              return tot>0?[p.alias,ha.toFixed(2),ins,die,efe,tot,ha>0?(tot/ha).toFixed(2):0]:null;
            }).filter(Boolean)
          }])}/>
        </div>
        <div className="table-wrap-scroll">
          <table style={{minWidth:800}}>
            <thead><tr>
              <th>Productor</th>
              <th style={{textAlign:"right"}}>Ha</th>
              <th style={{textAlign:"right"}}>Sem+Ins</th>
              <th style={{textAlign:"right"}}>Diesel</th>
              <th style={{textAlign:"right"}}>Efectivo</th>
              <th style={{textAlign:"right",fontWeight:700}}>Total</th>
              <th style={{textAlign:"right"}}>$/ha</th>
              <th style={{textAlign:"right"}}>PE (ton/ha)</th>
              <th></th>
            </tr></thead>
            <tbody>
              {productores.map((p,i)=>{
                const ha = haProd(p.id);
                const g  = gastoProd(p.id);
                if (!g.total && !ha) return null;
                const xha = ha>0?g.total/ha:0;
                const pe  = F.precio>0?xha/F.precio:0;
                const bg  = i%2===0?"white":"#faf8f3";
                return (
                  <tr key={p.id} style={{cursor:"pointer"}} onClick={()=>{setProdSel(p.id);setVista("productor");}}>
                    <td style={{background:bg}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:p.color}}/>
                        <span style={{fontWeight:600,fontSize:13}}>{p.alias||p.apPat}</span>
                      </div>
                    </td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12}}>{ha>0?ha.toFixed(2):"—"}</td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:11,color:"#2d5a1b"}}>{g.ins>0?mxnFmt(g.ins):"—"}</td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:11,color:"#e67e22"}}>{g.die>0?mxnFmt(g.die):"—"}</td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:11,color:"#8e44ad"}}>{g.efe>0?mxnFmt(g.efe):"—"}</td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:700,fontSize:12,color:T.rust}}>{g.total>0?mxnFmt(g.total):"—"}</td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:11}}>{ha>0?mxnFmt(xha):"—"}</td>
                    <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:11,color:pe<(F.ha>0?F.produccionEst/F.ha:9.1)?T.field:T.rust}}>{ha>0?pe.toFixed(2)+" t/ha":"—"}</td>
                    <td style={{background:bg}}>
                      <div style={{display:"flex",gap:4}}>
                        <button className="btn btn-sm btn-secondary" onClick={e=>{e.stopPropagation();setProdSel(p.id);setVista("productor");}}>Detalle</button>
                        <button className="btn btn-sm btn-secondary" style={{fontSize:10}} onClick={e=>{e.stopPropagation();nav("gastos",p.id);}} title="Ver egresos de este productor">Egresos →</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // ── VISTA POR PRODUCTOR ───────────────────────────────────────────────────────
  if (vista==="productor") {
    const p  = productores.find(x=>x.id===prodSel);
    if (!p) return <button className="btn btn-secondary" onClick={()=>setVista("global")}>← Volver</button>;
    const ha = haProd(p.id);
    const g  = gastoProd(p.id);
    const _ppp = getParamsCultivo(state);
    const rendExpP  = ha>0?(ha*_ppp.rendimiento):0;
    const ingresoP  = rendExpP * _ppp.precio;
    const utilP     = ingresoP - g.total;
    const peP       = _ppp.precio>0 ? g.total/_ppp.precio : 0;
    const peHaP     = ha>0?peP/ha:0;

    const catsProd = [
      {l:"🌽 Semilla",     v:insumos.filter(i=>String(i.productorId)===String(p.id)&&i.categoria==="Semilla").reduce((s,i)=>s+(parseFloat(i.importe)||0),0), c:"#c8a84b"},
      {l:"🌿 Insumos",     v:insumos.filter(i=>String(i.productorId)===String(p.id)&&i.categoria!=="Semilla").reduce((s,i)=>s+(parseFloat(i.importe)||0),0), c:"#2d5a1b"},
      {l:"⛽ Diesel",       v:diesel.filter(d=>String(d.productorId)===String(p.id)).reduce((s,d)=>s+(parseFloat(d.importe)||0),0), c:"#e67e22"},
      {l:"🏡 Renta",       v:egresos.filter(e=>String(e.productorId)===String(p.id)&&e.categoria==="renta_tierra").reduce((s,e)=>s+(parseFloat(e.monto)||0),0), c:"#9b6d3a"},
      {l:"👷 Mano de Obra",v:egresos.filter(e=>String(e.productorId)===String(p.id)&&e.categoria==="mano_obra").reduce((s,e)=>s+(parseFloat(e.monto)||0),0), c:"#5b9fd6"},
      {l:"💧 Agua",        v:egresos.filter(e=>String(e.productorId)===String(p.id)&&e.categoria==="pago_agua").reduce((s,e)=>s+(parseFloat(e.monto)||0),0), c:"#1a6ea8"},
      {l:"🛡️ Seguros",     v:egresos.filter(e=>String(e.productorId)===String(p.id)&&e.categoria==="seguros").reduce((s,e)=>s+(parseFloat(e.monto)||0),0), c:"#8e44ad"},
      {l:"📋 Trámites/Otros",v:egresos.filter(e=>String(e.productorId)===String(p.id)&&["tramites","permiso_siembra","flete","reparaciones","otro"].includes(e.categoria)).reduce((s,e)=>s+(parseFloat(e.monto)||0),0), c:"#7f8c8d"},
    ].filter(x=>x.v>0);

    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
          <button className="btn btn-secondary" onClick={()=>setVista("global")}>← Volver</button>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:12,height:12,borderRadius:"50%",background:p.color}}/>
            <div style={{fontFamily:"Georgia, serif",fontSize:20,fontWeight:700}}>{p.alias||p.apPat}</div>
            <span style={{fontSize:11,padding:"3px 10px",borderRadius:10,background:"#f0f4e8",color:"#2d5a1b",fontWeight:600}}>{ha.toFixed(2)} ha</span>
          </div>
        </div>

        <div className="stat-grid" style={{gridTemplateColumns:"repeat(4,1fr)",marginBottom:16}}>
          <div className="stat-card rust"><div className="stat-icon">💸</div><div className="stat-label">Costo Total</div><div className="stat-value" style={{fontSize:16}}>{mxnFmt(g.total)}</div><div className="stat-sub">{mxnFmt(ha>0?g.total/ha:0)}/ha</div></div>
          <div className="stat-card gold"><div className="stat-icon">🌽</div><div className="stat-label">Ingreso Estimado</div><div className="stat-value" style={{fontSize:16}}>{mxnFmt(ingresoP)}</div><div className="stat-sub">{rendExpP.toFixed(0)} ton × {mxnFmt(_ppp.precio)}</div></div>
          <div className="stat-card sky"><div className="stat-icon">⚖️</div><div className="stat-label">Punto de Equilibrio</div><div className="stat-value" style={{fontSize:16}}>{peP.toFixed(1)} ton</div><div className="stat-sub">{peHaP.toFixed(2)} ton/ha mínimo</div></div>
          <div className="stat-card" style={{borderLeft:`4px solid ${utilP>=0?T.field:T.rust}`}}><div className="stat-icon">{utilP>=0?"🟢":"🔴"}</div><div className="stat-label">Utilidad Estimada</div><div className="stat-value" style={{fontSize:16,color:utilP>=0?T.field:T.rust}}>{mxnFmt(utilP)}</div><div className="stat-sub">{ingresoP>0?Math.abs(utilP/ingresoP*100).toFixed(1):0}% margen</div></div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">Desglose de Costos</div></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Concepto</th><th style={{textAlign:"right"}}>Monto</th><th style={{textAlign:"right"}}>$/ha</th><th style={{textAlign:"right"}}>% total</th></tr></thead>
              <tbody>
                {catsProd.map(({l,v,c},i)=>(
                  <tr key={l} style={{background:i%2===0?"white":"#faf8f3"}}>
                    <td style={{fontSize:12,fontWeight:500}}>{l}</td>
                    <td style={{textAlign:"right",fontFamily:"monospace",fontSize:12,fontWeight:700,color:c}}>{mxnFmt(v)}</td>
                    <td style={{textAlign:"right",fontFamily:"monospace",fontSize:11,color:"#8a8070"}}>{mxnFmt(ha>0?v/ha:0)}</td>
                    <td style={{textAlign:"right",fontFamily:"monospace",fontSize:11,color:"#8a8070"}}>{g.total>0?(v/g.total*100).toFixed(1):0}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{background:"#f0f4e8",fontWeight:700}}>
                  <td>TOTAL</td>
                  <td style={{textAlign:"right",fontFamily:"monospace",color:T.rust}}>{mxnFmt(g.total)}</td>
                  <td style={{textAlign:"right",fontFamily:"monospace",color:T.rust}}>{mxnFmt(ha>0?g.total/ha:0)}</td>
                  <td style={{textAlign:"right",fontFamily:"monospace"}}>100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
