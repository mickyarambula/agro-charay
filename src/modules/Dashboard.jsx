// ─── modules/Dashboard.jsx ───────────────────────────────────────────

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
import { WidgetCBOTDashboard } from "../App.jsx";
import { useIsMobile } from '../components/mobile/useIsMobile.js';
import AIInsight from '../components/AIInsight.jsx';


export default function Dashboard({ userRol, onNavigate }) {
  const { state } = useData();
  const isMobile = useIsMobile();
  const [cbotAbierto, setCbotAbierto] = useState(false);
  const F = calcularFinancieros(state);
  const mxnFmt = n => (parseFloat(n)||0).toLocaleString("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:2,maximumFractionDigits:2});
  const nav = (page, pid, filtros) => onNavigate && onNavigate(page, pid, filtros);

  // Alertas del sistema
  const alertas = calcularAlertas(state);

  const cicloPred  = (state.ciclos||[]).find(c=>c.id===state.cicloActivoId)||(state.ciclos||[]).find(c=>c.id===state.cicloActivoId)||(state.ciclos||[]).find(c=>c.predeterminado)||(state.ciclos||[])[0];
  const asigsCiclo = (cicloPred?.asignaciones||[]).filter(a=>
    !state.cultivoActivo||(a.cultivoId===state.cultivoActivo.cultivoId&&a.variedad===state.cultivoActivo.variedad)
  );
  const productores= state.productores||[];

  // Avance del ciclo
  const fechaInicio = new Date(cicloPred?.fechaInicio||"2025-09-01");
  const fechaFin    = new Date(cicloPred?.fechaFin||"2026-08-31");
  const hoy         = new Date();
  const diasTotal   = Math.round((fechaFin-fechaInicio)/86400000);
  const diasTransc  = Math.max(0,Math.min(diasTotal,Math.round((hoy-fechaInicio)/86400000)));
  const pctCiclo    = diasTotal>0?Math.round(diasTransc/diasTotal*100):0;

  // Semáforo
  const semaforo = F.utilidadBruta>0
    ? {color:T.field,  icono:"🟢", texto:"Rentable"}
    : F.utilidadBruta>-F.costoTotal*0.1
    ? {color:T.straw,  icono:"🟡", texto:"En riesgo"}
    : {color:T.rust,   icono:"🔴", texto:"Pérdida estimada"};

  // Top productores por gasto
  const topProductores = productores.map(p=>{
    const _dsh = state.cicloActivoId||1;
    const ins = (state.insumos||[]).filter(i=>!i.cancelado&&((i.cicloId||1)===_dsh)&&String(i.productorId)===String(p.id)).reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
     const die = (state.diesel||[]).filter(d=>!d.cancelado&&((d.cicloId||1)===_dsh)&&String(d.productorId)===String(p.id)).reduce((s,d)=>s+(parseFloat(d.importe)||0),0);
    const efe = (state.egresosManual||[]).filter(e=>(e.cicloId||1)===(state.cicloActivoId||1)).filter(e=>!e.cancelado&&String(e.productorId)===String(p.id)).reduce((s,e)=>s+(parseFloat(e.monto)||0),0);
    const ha  = asigsCiclo.filter(a=>String(a.productorId)===String(p.id)).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);
    return {...p, gasto:ins+die+efe, ha};
  }).filter(p=>p.gasto>0).sort((a,b)=>b.gasto-a.gasto).slice(0,6);

  // Estructura de costos
  const costLines = [
    {l:"Semilla",            v:F.costoSemilla,                        c:"#c8a84b", mod:"insumos", filtro:{categoria:"Semilla",    vista:"tabla"}},
    {l:"Insumos",            v:(F.costoInsumos||0)-F.costoSemilla,    c:"#1a3a0f", mod:"insumos", filtro:{categoria:"Fertilizante",vista:"tabla"}},
    {l:"Diesel",             v:F.costoDiesel,                         c:"#e67e22", mod:"diesel"},
    {l:"Renta",              v:F.costoRenta,                          c:"#9b6d3a", mod:"rentas"},
    {l:"Mano de Obra",       v:F.costoManoObra,                       c:"#5b9fd6", mod:"gastos"},
    {l:"Agua",               v:F.costoAgua,                           c:"#1a6ea8", mod:"gastos"},
    {l:"Seguros",            v:F.costoSeguros,                        c:"#8e44ad", mod:"gastos"},
    {l:"Trámites/Otros",     v:(F.costoTramites||0)+(F.costoOtros||0),c:"#7f8c8d", mod:"gastos"},
    {l:"Int. Parafinanciero",v:F.costoInteresPara,                    c:"#c84b4b", mod:"credito"},
    {l:"Int. Directo",       v:F.costoInteresDir,                     c:"#922b21", mod:"credito"},
    {l:"Comisiones",         v:F.costoComisiones,                     c:"#a93226", mod:"credito"},
  ].filter(d=>d.v>0);

  // Cosecha
  const boletas    = (state.cosecha?.boletas||[]).filter(b=>!b.cancelado);
  const totalTon   = (boletas||[]).reduce((s,b)=>s+(parseFloat(b.pna)||0),0)/1000;
  const hayBoletas = boletas.length>0;

  // Dispersiones
  const dispersiones = (state.dispersiones||[]).filter(d=>!d.cancelado&&((d.cicloId||1)===(state.cicloActivoId||1)));
  const totalDisp    = (dispersiones||[]).reduce((s,d)=>s+(parseFloat(d.monto)||0),0);

  // Estilo de tarjeta clickeable
  const cardClick = (onClick) => ({
    cursor:"pointer",
    transition:"transform 0.12s, box-shadow 0.12s",
    onMouseEnter: e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.12)"},
    onMouseLeave: e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=""},
    onClick,
  });

  return (
    <div>
      <AIInsight modulo="Dashboard" contexto={{
        ha: F?.ha || 0,
        costoTotal: F?.costoTotal || 0,
        ingresoEstimado: F?.ingresoEstimado || 0,
        utilidad: F?.utilidad || 0,
        diasTranscurridos: 0,
        diasRestantes: 0,
        costoPorHa: F?.costoPorHa || 0,
      }} />

      {/* ── Panel de Alertas ── */}
      <PanelAlertas alertas={alertas} onNavigate={onNavigate} />

      {/* ── Widget CBOT Precio Maíz ── */}
      {isMobile ? (
        <div style={{marginBottom:16}}>
          <button
            onClick={()=>setCbotAbierto(v=>!v)}
            style={{
              width:"100%",
              minHeight:48,
              padding:"12px 16px",
              background:"#ffffff",
              border:"1px solid #e5e7eb",
              borderRadius:10,
              cursor:"pointer",
              display:"flex",
              alignItems:"center",
              justifyContent:"space-between",
              fontSize:14,
              fontWeight:600,
              color:"#14532D",
              touchAction:"manipulation",
            }}
          >
            <span>📈 Precios CBOT</span>
            <span style={{fontSize:12,color:"#6b7280"}}>{cbotAbierto?"▲ Ocultar":"▼ Ver"}</span>
          </button>
          {cbotAbierto && <div style={{marginTop:10}}><WidgetCBOTDashboard /></div>}
        </div>
      ) : (
        <WidgetCBOTDashboard />
      )}

      {/* ── Fila 1: KPIs principales clicables ── */}
      <div className="stat-grid" style={{gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)",marginBottom:16}}>

        <div className="stat-card green" {...cardClick(()=>nav("ciclos"))} title="Ver Ciclos" style={{borderTop:"2px solid #2d7a2d"}}>
          <div className="stat-icon">🌽</div>
          <div className="stat-label">Hectáreas del Ciclo</div>
          <div className="stat-value" style={{fontFamily:"Georgia, serif"}}>{F.ha.toFixed(1)}<span className="stat-unit"> ha</span></div>
          <div className="stat-sub">{productores.filter(p=>asigsCiclo.some(a=>String(a.productorId)===String(p.id))).length} productores · {state.cicloActual}</div>
          <div style={{fontSize:9,color:T.fog,marginTop:4}}>→ Ciclos</div>
        </div>

        <div className="stat-card rust" {...cardClick(()=>nav("gastos"))} title="Ver Costos" style={{borderTop:"2px solid #c8a84b"}}>
          <div className="stat-icon">💸</div>
          <div className="stat-label">Costo Total Ciclo</div>
          <div className="stat-value" style={{fontSize:18,fontFamily:"Georgia, serif"}}>{mxnFmt(F.costoTotal)}</div>
          <div className="stat-sub">{mxnFmt(F.ha>0?F.costoTotal/F.ha:0)}/ha · incl. intereses y comisiones</div>
          <div style={{fontSize:9,color:T.fog,marginTop:4}}>→ Costos y Equilibrio</div>
        </div>

        <div className="stat-card gold" {...cardClick(()=>nav("cosecha"))} title="Ver Cosecha" style={{borderTop:"2px solid #2980b9"}}>
          <div className="stat-icon">{hayBoletas?"🌽":"📊"}</div>
          <div className="stat-label">{hayBoletas?"Producción Real":"Ingreso Estimado"}</div>
          <div className="stat-value" style={{fontSize:18,fontFamily:"Georgia, serif"}}>{hayBoletas?`${totalTon.toFixed(2)} ton`:mxnFmt(F.ingresoEst)}</div>
          <div className="stat-sub">{hayBoletas?`${boletas.length} boletas · ${mxnFmt(totalTon*F.precio)}`:`Est.: ${F.produccionEst.toFixed(0)} ton × ${mxnFmt(F.precio)}`}</div>
          <div style={{fontSize:9,color:T.fog,marginTop:4}}>→ Cosecha y Maquila</div>
        </div>

        <div className="stat-card" style={{borderTop:`2px solid ${F.utilidadBruta<0?"#c84b4b":"#2d7a2d"}`,cursor:"pointer",transition:"transform 0.12s"}}
          {...cardClick(()=>nav("costos"))} title="Ver Costos y Equilibrio">
          <div className="stat-icon">{semaforo.icono}</div>
          <div className="stat-label">Utilidad Estimada</div>
          <div className="stat-value" style={{fontSize:18,fontFamily:"Georgia, serif",color:semaforo.color}}>{mxnFmt(F.utilidadBruta)}</div>
          <div className="stat-sub">{semaforo.texto} · {Math.abs(F.margen).toFixed(1)}% margen</div>
          <div style={{fontSize:9,color:T.fog,marginTop:4}}>→ Costos y Equilibrio</div>
        </div>
      </div>

      {/* ── Fila 2: Avance ciclo + Crédito ── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>

        <div className="card" {...cardClick(()=>nav("ciclos"))} style={{...cardClick().style}}>
          <div className="card-header">
            <div className="card-title">⏱ Avance del Ciclo</div>
            <span style={{fontSize:10,color:T.fog}}>→ Ciclos</span>
          </div>
          <div className="card-body">
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:6}}>
              <span style={{color:T.fog}}>{cicloPred?.fechaInicio}</span>
              <span style={{fontWeight:700,color:T.field}}>{pctCiclo}% transcurrido</span>
              <span style={{color:T.fog}}>{cicloPred?.fechaFin}</span>
            </div>
            <div style={{height:12,borderRadius:6,background:"#e8e0d0",overflow:"hidden",marginBottom:12}}>
              <div style={{height:"100%",borderRadius:6,background:`linear-gradient(90deg,${T.field},#4a8c2a)`,width:`${pctCiclo}%`}}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {[
                ["Días transcurridos",`${diasTransc} días`,"#1a3a0f"],
                ["Días restantes",    `${Math.max(0,diasTotal-diasTransc)} días`,"#8a8070"],
                ["Costo acumulado",   mxnFmt(F.costoTotal),"#c84b4b"],
                ["Costo/día prom.",   mxnFmt(diasTransc>0?F.costoTotal/diasTransc:0),"#e67e22"],
              ].map(([l,v,c])=>(
                <div key={l} style={{padding:"8px 12px",background:T.mist,borderRadius:7}}>
                  <div style={{fontSize:10,color:T.fog,marginBottom:2}}>{l}</div>
                  <div style={{fontFamily:"monospace",fontWeight:700,fontSize:13,color:c}}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card" style={{cursor:"pointer"}} onClick={()=>nav("credito")}>
          <div className="card-header">
            <div className="card-title">🏦 Crédito — Intereses al Día</div>
            <span style={{fontSize:10,color:T.fog}}>→ Crédito Habilitación</span>
          </div>
          <div className="card-body" style={{padding:0}}>
            {/* Totales rápidos */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",borderBottom:`2px solid ${T.line}`}}>
              {[
                ["Total dispersado", mxnFmt(totalDisp),                 "#1a6ea8"],
                ["Intereses acum.",  mxnFmt(F.costoInteres||0),         "#c84b4b"],
                ["Interés/día hoy",  (() => {
                  const p={...{para_tasaAnual:1.38,dir_tasaAnual:1.8},...(state.creditoParams||{})};
                  const hoyD=new Date(), asigs=cicloPred?.asignaciones||[];
                  const ins2=(state.insumos||[]).filter(i=>!i.cancelado&&(i.cicloId||1)===(state.cicloActivoId||1));
                  const die2=(state.diesel||[]).filter(d=>!d.cancelado&&(d.cicloId||1)===(state.cicloActivoId||1));
                  const egr2=(state.egresosManual||[]).filter(e=>!e.cancelado&&(e.cicloId||1)===(state.cicloActivoId||1));
                  const dis2=(state.dispersiones||[]).filter(d=>!d.cancelado&&(d.cicloId||1)===(state.cicloActivoId||1));
                  let intDia=0;
                  ;(state.productores||[]).forEach(p2=>{
                    const exp2=(state.expedientes||[]).find(e=>e.productorId===p2.id);
                    const haProd=asigs.filter(a=>String(a.productorId)===String(p2.id)).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);
                    const creditoPara=exp2?.montoPorHa?haProd*exp2.montoPorHa:0;
                    const gasto=[...ins2,...die2].filter(x=>String(x.productorId)===String(p2.id)).reduce((s,x)=>s+(parseFloat(x.importe)||0),0)+egr2.filter(x=>String(x.productorId)===String(p2.id)).reduce((s,x)=>s+(parseFloat(x.monto)||0),0);
                    const montoP=creditoPara>0?Math.min(gasto,creditoPara):0;
                    const montoD=Math.max(0,gasto-montoP);
                    if(dis2.some(d=>String(d.productorId)===String(p2.id))){
                      intDia+=montoP*(p.para_tasaAnual/100)/365+montoD*(p.dir_tasaAnual/100)/365;
                    }
                  });
                  return mxnFmt(intDia);
                })(), "#e67e22"],
              ].map(([l,v,c])=>(
                <div key={l} style={{padding:"10px 14px",textAlign:"center",borderRight:`1px solid ${T.line}`}}>
                  <div style={{fontSize:9,color:T.fog,marginBottom:2}}>{l}</div>
                  <div style={{fontFamily:"monospace",fontWeight:700,fontSize:12,color:c}}>{v}</div>
                </div>
              ))}
            </div>
            {/* Desglose por productor */}
            {(()=>{
              const p={...{para_tasaAnual:1.38,dir_tasaAnual:1.8},...(state.creditoParams||{})};
              const hoyD=new Date(), asigs=cicloPred?.asignaciones||[];
              const ins2=(state.insumos||[]).filter(i=>!i.cancelado&&(i.cicloId||1)===(state.cicloActivoId||1));
              const die2=(state.diesel||[]).filter(d=>!d.cancelado&&(d.cicloId||1)===(state.cicloActivoId||1));
              const egr2=(state.egresosManual||[]).filter(e=>!e.cancelado&&(e.cicloId||1)===(state.cicloActivoId||1));
              const dis2=(state.dispersiones||[]).filter(d=>!d.cancelado&&(d.cicloId||1)===(state.cicloActivoId||1));
              const filas=(state.productores||[]).map(prod=>{
                const exp2=(state.expedientes||[]).find(e=>e.productorId===prod.id);
                const haProd=asigs.filter(a=>String(a.productorId)===String(prod.id)).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);
                const creditoPara=exp2?.montoPorHa?haProd*exp2.montoPorHa:0;
                const gasto=[...ins2,...die2].filter(x=>String(x.productorId)===String(prod.id)).reduce((s,x)=>s+(parseFloat(x.importe)||0),0)+egr2.filter(x=>String(x.productorId)===String(prod.id)).reduce((s,x)=>s+(parseFloat(x.monto)||0),0);
                const montoP=creditoPara>0?Math.min(gasto,creditoPara):0;
                const montoD=Math.max(0,gasto-montoP);
                const dispsProd=dis2.filter(d=>String(d.productorId)===String(prod.id)).sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)));
                const primerDisp=dispsProd[0];
                if(!primerDisp)return null;
                const dias=Math.max(0,Math.round((hoyD-new Date(primerDisp.fecha))/86400000));
                const intDia=montoP*(p.para_tasaAnual/100)/365+montoD*(p.dir_tasaAnual/100)/365;
                const intAcum=montoP*(p.para_tasaAnual/100)/30*dias+montoD*(p.dir_tasaAnual/100)/30*dias;
                return{prod,dias,intDia,intAcum,primerDisp};
              }).filter(Boolean).filter(f=>f.intDia>0).sort((a,b)=>b.intDia-a.intDia);
              if(!filas.length)return <div style={{padding:"16px",textAlign:"center",fontSize:12,color:T.fog}}>Sin dispersiones registradas</div>;
              return(
                <div style={{maxHeight:240,overflowY:"auto"}}>
                  <div style={{display:"grid",gridTemplateColumns:"minmax(80px,1fr) 52px 80px 80px 76px",padding:"5px 14px",background:T.mist,fontSize:9,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.fog,position:"sticky",top:0,zIndex:1}}>
                    <span>Productor</span><span style={{textAlign:"right"}}>Días</span><span style={{textAlign:"right"}}>Int/día</span><span style={{textAlign:"right"}}>Acumulado</span><span style={{textAlign:"right"}}>Desde</span>
                  </div>
                  {filas.map(({prod,dias,intDia,intAcum,primerDisp})=>(
                    <div key={prod.id} style={{display:"grid",gridTemplateColumns:"minmax(80px,1fr) 52px 80px 80px 76px",padding:"7px 14px",borderBottom:`1px solid ${T.line}`,alignItems:"center"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0}}>
                        <div style={{width:7,height:7,borderRadius:"50%",background:prod.color,flexShrink:0}}/>
                        <span style={{fontSize:11,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{prod.alias||prod.apPat}</span>
                      </div>
                      <div style={{textAlign:"right",fontFamily:"monospace",fontSize:11,fontWeight:600,color:dias>180?"#c84b4b":dias>90?T.straw:T.fog}}>{dias}</div>
                      <div style={{textAlign:"right",fontFamily:"monospace",fontSize:11,fontWeight:700,color:"#e67e22"}}>{mxnFmt(intDia)}</div>
                      <div style={{textAlign:"right",fontFamily:"monospace",fontSize:11,fontWeight:700,color:"#c84b4b"}}>{mxnFmt(intAcum)}</div>
                      <div style={{textAlign:"right",fontSize:9,color:T.fog}}>{primerDisp?.fecha?.slice(5)||"—"}</div>
                    </div>
                  ))}
                  <div style={{display:"grid",gridTemplateColumns:"minmax(80px,1fr) 52px 80px 80px 76px",padding:"7px 14px",background:"#fdf5f0",borderTop:`2px solid ${T.line}`,alignItems:"center"}}>
                    <div style={{fontSize:11,fontWeight:700,color:T.inkLt,gridColumn:"1/3"}}>Total</div>
                    <div style={{textAlign:"right",fontFamily:"monospace",fontSize:11,fontWeight:700,color:"#e67e22"}}>{mxnFmt(filas.reduce((s,f)=>s+f.intDia,0))}</div>
                    <div style={{textAlign:"right",fontFamily:"monospace",fontSize:11,fontWeight:700,color:"#c84b4b"}}>{mxnFmt(filas.reduce((s,f)=>s+f.intAcum,0))}</div>
                    <div/>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ── Fila 3: Estructura de costos + Top productores ── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Estructura de Costos</div>
            <span style={{fontFamily:"monospace",fontSize:11,color:T.fog}}>{mxnFmt(F.costoTotal)}</span>
          </div>
          <div className="card-body">
            {costLines.map(({l,v,c,mod,filtro})=>(
              <div key={l} style={{marginBottom:9,cursor:"pointer"}}
                onClick={()=>nav(mod, null, filtro)}
                onMouseEnter={e=>{e.currentTarget.style.opacity="0.8";}}
                onMouseLeave={e=>{e.currentTarget.style.opacity="1";}}
                title={`→ ${mod}${filtro?.categoria?' · '+filtro.categoria:''}`}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontSize:12,fontWeight:500}}>{l} <span style={{fontSize:9,color:T.fog,opacity:0.7}}>→</span></span>
                  <span style={{fontFamily:"monospace",fontSize:11,fontWeight:600,color:c}}>
                    {mxnFmt(v)} <span style={{color:T.fog,fontWeight:400}}>{F.costoTotal>0?(v/F.costoTotal*100).toFixed(1):0}%</span>
                  </span>
                </div>
                <div style={{height:5,borderRadius:3,background:"#e8e0d0",overflow:"hidden"}}>
                  <div style={{height:"100%",borderRadius:3,background:c,width:`${F.costoTotal>0?Math.min(100,v/F.costoTotal*100):0}%`}}/>
                </div>
              </div>
            ))}
            <div style={{marginTop:10,fontSize:10,color:T.fog,textAlign:"center"}}>Clic en cada barra para ir al módulo</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Top Productores por Gasto</div>
            <span style={{fontSize:10,color:T.fog,cursor:"pointer"}} onClick={()=>nav("gastos")}>Ver todos →</span>
          </div>
          <div className="card-body" style={{padding:0}}>
            {topProductores.map((p,i)=>(
              <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderBottom:`1px solid ${T.line}`,cursor:"pointer"}}
                onClick={()=>nav("gastos")} title="→ Egresos del Ciclo">
                <div style={{width:8,height:8,borderRadius:"50%",background:p.color,flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.alias||p.apPat}</div>
                  <div style={{fontSize:10,color:T.fog}}>{p.ha.toFixed(2)} ha</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontFamily:"monospace",fontWeight:700,fontSize:12,color:T.rust}}>{mxnFmt(p.gasto)}</div>
                  <div style={{fontSize:10,color:T.fog}}>{p.ha>0?mxnFmt(p.gasto/p.ha):0}/ha</div>
                </div>
                <div style={{width:60}}>
                  <div style={{height:4,borderRadius:2,background:"#e8e0d0"}}>
                    <div style={{height:"100%",borderRadius:2,background:p.color,width:`${F.costoTotal>0?Math.min(100,p.gasto/F.costoTotal*100):0}%`}}/>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Fila 4: Accesos rápidos por módulo ── */}
      <div className="card">
        <div className="card-header"><div className="card-title">⚡ Accesos Rápidos</div></div>
        <div className="card-body">
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10}}>
            {[
              {icon:"🌱",label:"Insumos",         sub:`${(state.insumos||[]).filter(i=>!i.cancelado&&((i.cicloId||1)===(state.cicloActivoId||1))).length} registros`,           mod:"insumos"},
              {icon:"⛽",label:"Diesel",           sub:`${(state.diesel||[]).filter(d=>!d.cancelado&&((d.cicloId||1)===(state.cicloActivoId||1))).length} cargas`,               mod:"diesel"},
              {icon:"💸",label:"Egresos",          sub:`${(state.egresosManual||[]).filter(e=>(e.cicloId||1)===(state.cicloActivoId||1)).filter(e=>!e.cancelado).length} registros`,     mod:"gastos"},
              {icon:"🏦",label:"Dispersiones",     sub:`${dispersiones.length} registros`,                                          mod:"credito"},
              {icon:"🌽",label:"Cosecha",          sub:hayBoletas?`${totalTon.toFixed(2)} ton`:"Sin boletas",                       mod:"cosecha"},
              {icon:"📊",label:"Costos y PE",      sub:"Punto de equilibrio",                                                       mod:"costos"},
              {icon:"🎯",label:"Proyección",       sub:"Real vs Presupuesto",                                                       mod:"proyeccion"},
              {icon:"🏡",label:"Rentas",           sub:`${mxnFmt(F.costoRenta)}`,                                                   mod:"rentas"},
              {icon:"👷",label:"Operadores",       sub:`${(state.operadores||[]).filter(o=>o.activo).length} activos`,              mod:"operadores"},
              {icon:"🚜",label:"Maquinaria",       sub:`${(state.maquinaria||[]).length} equipos`,                                  mod:"maquinaria"},
              {icon:"📋",label:"Productores",      sub:`${(state.productores||[]).length} registrados`,                             mod:"productores"},
              {icon:"⚙️",label:"Configuración",    sub:"Usuarios y permisos",                                                       mod:"configuracion"},
            ].map(({icon,label,sub,mod})=>(
              <div key={mod} onClick={()=>nav(mod)} style={{
                padding:"12px 14px",borderRadius:10,background:T.mist,
                border:`1px solid ${T.line}`,cursor:"pointer",
                transition:"background 0.12s, transform 0.12s",
                onMouseEnter:undefined,
              }}
              onMouseEnter={e=>{e.currentTarget.style.background="#f0f4e8";e.currentTarget.style.transform="translateY(-2px)";}}
              onMouseLeave={e=>{e.currentTarget.style.background=T.mist;e.currentTarget.style.transform="";}}
              title={`Ir a ${label}`}>
                <div style={{fontSize:20,marginBottom:4}}>{icon}</div>
                <div style={{fontWeight:700,fontSize:12}}>{label}</div>
                <div style={{fontSize:10,color:T.fog,marginTop:2}}>{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
