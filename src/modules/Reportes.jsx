// ─── modules/Reportes.jsx ───────────────────────────────────────────

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
import { mxn } from "../App.jsx";


export default function ReportesModule() {
  const { state } = useData();
  const params = { para_tasaAnual:1.38, dir_tasaAnual:1.8, ...(state.creditoParams||{}) };
  const F = calcularFinancieros(state);
  const [seccion, setSeccion] = useState("resumen");

  const secciones = [
    ["resumen","📋 Resumen Ejecutivo"],
    ["consolidado","⚖️ Estado de Cuenta"],
    ["lotes","🗺 Por Lote"],
    ["costos","💸 Costos Detallados"],
    ["creditos","🏦 Créditos"],
    ["comparativo","📊 Comparativo Ciclos"],
    ["cierre","📄 Cierre de Ciclo"],
  ];

  // ── Estado de cuenta consolidado — usa calcularCreditoProd (fuente única de verdad)
  const cid    = state.cicloActivoId||1;
  const ciclo  = (state.ciclos||[]).find(c=>c.id===cid);
  const mxnFmt = n => (parseFloat(n)||0).toLocaleString("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:2,maximumFractionDigits:2});

  const datosProductores = (state.productores||[]).map(p => {
    const d = calcularCreditoProd(p.id, state);
    if(!d.tGas && !d.tDis) return null;
    return {p, ...d};
  }).filter(Boolean);

  const TOTS = datosProductores.reduce((acc,d)=>({
    ha:    acc.ha+d.ha,    tSem:acc.tSem+d.tSem, tIns:acc.tIns+d.tIns,
    tDie:  acc.tDie+d.tDie,tEfe:acc.tEfe+d.tEfe, tGas:acc.tGas+d.tGas,
    tDis:  acc.tDis+d.tDis,credAut:acc.credAut+d.credAut,
    iP:    acc.iP+d.iP,    iD:acc.iD+d.iD,
    cP:    acc.cP+d.cP,    cD:acc.cD+d.cD,
    tLiq:  acc.tLiq+d.tLiq,
  }), {ha:0,tSem:0,tIns:0,tDie:0,tEfe:0,tGas:0,tDis:0,credAut:0,iP:0,iD:0,cP:0,cD:0,tLiq:0});

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="tabs" style={{marginBottom:0}}>
          {secciones.map(([id,l])=>(
            <div key={id} className={`tab ${seccion===id?"active":""}`} onClick={()=>setSeccion(id)}>{l}</div>
          ))}
        </div>
        <div style={{display:"flex",gap:8}}>
          <BtnExport onClick={()=>exportarExcel("Reporte_Ejecutivo_"+state.cicloActual,[{
            nombre:"Resumen",
            headers:["Concepto","Valor"],
            rows:[
              ["Hectáreas",F.ha.toFixed(2)],
              ["Producción estimada (ton)",F.produccionEst.toFixed(1)],
              ["Precio venta ($/ton)",F.precio],
              ["Ingreso estimado",F.ingresoEst.toFixed(2)],
              ["Costo total",F.costoTotal.toFixed(2)],
              ["Utilidad estimada",F.utilidadBruta.toFixed(2)],
              ["Margen",F.margen.toFixed(1)+"%"],
              ["PE (ton)",F.peTon.toFixed(1)],
              ["PE (ton/ha)",F.peHa.toFixed(2)],
            ]
          }])}/>
          <BtnExport label="📥 Estado de Cuenta Excel" onClick={()=>exportarExcel(`EstadoCuenta_Consolidado_${state.cicloActual||"ciclo"}`, [
            {
              nombre:"Consolidado por Productor",
              headers:["Productor","RFC","Ha","Cred.Aut.","Dispersado","Semilla","Insumos","Diesel","Efectivo","Total Gasto","Int.Para","Int.Dir","Com.Para","Com.Dir","Total Liquidar","$/Ha"],
              rows: datosProductores.map(d=>[
                d.p.alias||d.p.apPat, d.p.rfc||"",
                parseFloat(d.ha)||0, parseFloat(d.credAut)||0, parseFloat(d.tDis)||0,
                parseFloat(d.tSem)||0, parseFloat(d.tIns)||0, parseFloat(d.tDie)||0, parseFloat(d.tEfe)||0,
                parseFloat(d.tGas)||0, parseFloat(d.iP)||0, parseFloat(d.iD)||0,
                parseFloat(d.cP)||0, parseFloat(d.cD)||0, parseFloat(d.tLiq)||0,
                d.ha>0?parseFloat((d.tLiq/d.ha).toFixed(2)):0
              ]).concat([[
                "TOTAL","",parseFloat(TOTS.ha)||0,parseFloat(TOTS.credAut)||0,parseFloat(TOTS.tDis)||0,
                parseFloat(TOTS.tSem)||0,parseFloat(TOTS.tIns)||0,parseFloat(TOTS.tDie)||0,parseFloat(TOTS.tEfe)||0,
                parseFloat(TOTS.tGas)||0,parseFloat(TOTS.iP)||0,parseFloat(TOTS.iD)||0,
                parseFloat(TOTS.cP)||0,parseFloat(TOTS.cD)||0,parseFloat(TOTS.tLiq)||0,
                TOTS.ha>0?parseFloat((TOTS.tLiq/TOTS.ha).toFixed(2)):0
              ]])
            },
            {
              nombre:"Resumen del Ciclo",
              headers:["Concepto","Importe"],
              rows:[
                ["=== INVERSIÓN OPERATIVA ===",""],
                ["Semilla",parseFloat(TOTS.tSem)||0],
                ["Insumos (sin semilla)",parseFloat(TOTS.tIns)||0],
                ["Diesel y combustible",parseFloat(TOTS.tDie)||0],
                ["Efectivo / otros",parseFloat(TOTS.tEfe)||0],
                ["SUBTOTAL OPERATIVO",parseFloat(TOTS.tGas)||0],
                ["",""],
                ["=== COSTOS FINANCIEROS ===",""],
                ["Intereses parafinanciero",parseFloat(TOTS.iP)||0],
                ["Intereses directo",parseFloat(TOTS.iD)||0],
                ["Comisiones parafinanciero",parseFloat(TOTS.cP)||0],
                ["Comisiones directo",parseFloat(TOTS.cD)||0],
                ["SUBTOTAL FINANCIERO",parseFloat(TOTS.iP+TOTS.iD+TOTS.cP+TOTS.cD)||0],
                ["",""],
                ["TOTAL A LIQUIDAR (CICLO)",parseFloat(TOTS.tLiq)||0],
                ["Costo por hectárea",TOTS.ha>0?parseFloat((TOTS.tLiq/TOTS.ha).toFixed(2)):0],
                ["",""],
                ["=== CRÉDITO ===",""],
                ["Crédito autorizado total",parseFloat(TOTS.credAut)||0],
                ["Total dispersado",parseFloat(TOTS.tDis)||0],
                ["Saldo disponible",parseFloat(TOTS.tDis-TOTS.tGas)||0],
              ]
            }
          ])}/>
          <button className="btn btn-secondary btn-sm" onClick={()=>alert("Usa Ctrl+P del navegador para imprimir esta vista")} style={{gap:6}}>🖨 Imprimir (Ctrl+P)</button>
        </div>
      </div>

      {seccion==="consolidado" && (
        <div>
          {/* KPIs consolidados */}
          <div className="stat-grid" style={{gridTemplateColumns:"repeat(4,1fr)",marginBottom:16}}>
            {[
              {card:"green",  icon:"🌾", label:"Ha del Ciclo",        valor:`${TOTS.ha.toFixed(2)} ha`,   sub:`${datosProductores.length} productores`},
              {card:"sky",    icon:"🏦", label:"Total Dispersado",     valor:mxnFmt(TOTS.tDis),            sub:"crédito ejercido"},
              {card:"rust",   icon:"💸", label:"Gasto Operativo Total",valor:mxnFmt(TOTS.tGas),            sub:mxnFmt(TOTS.ha>0?TOTS.tGas/TOTS.ha:0)+"/ha"},
              {card:"gold",   icon:"📈", label:"Int. + Comisiones",    valor:mxnFmt(TOTS.iP+TOTS.iD+TOTS.cP+TOTS.cD), sub:"costo financiero"},
            ].map(({card,icon,label,valor,sub})=>(
              <div key={label} className={`stat-card ${card}`}>
                <div className="stat-icon">{icon}</div>
                <div className="stat-label">{label}</div>
                <div className="stat-value" style={{fontSize:15}}>{valor}</div>
                <div className="stat-sub">{sub}</div>
              </div>
            ))}
          </div>
          <div style={{marginBottom:16,padding:"14px 20px",background:"#fdf0ef",borderRadius:10,
            border:"2px solid #c0392b33",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:12,color:"#c0392b",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>Total a Liquidar del Ciclo</div>
              <div style={{fontSize:11,color:T.fog,marginTop:2}}>{mxnFmt(TOTS.ha>0?TOTS.tLiq/TOTS.ha:0)}/ha · {datosProductores.length} productores con movimientos</div>
            </div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:800,color:"#c0392b"}}>{mxnFmt(TOTS.tLiq)}</div>
          </div>

          {/* Desglose operativo + financiero */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
            <div className="card">
              <div className="card-header"><div className="card-title">💸 Desglose Operativo</div></div>
              <div className="card-body" style={{padding:0}}>
                {[
                  ["🌽 Semilla",               TOTS.tSem,   "#c8a84b"],
                  ["🌿 Insumos (sin semilla)",  TOTS.tIns,   "#2d5a1b"],
                  ["⛽ Diesel y combustible",   TOTS.tDie,   "#e67e22"],
                  ["💵 Efectivo / otros",       TOTS.tEfe,   "#5b9fd6"],
                ].filter(([,v])=>v>0).map(([l,v,c])=>(
                  <div key={l} style={{padding:"9px 16px",borderBottom:`1px solid ${T.line}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:12,color:T.fog}}>{l}</span>
                      <span style={{fontFamily:"monospace",fontSize:13,fontWeight:700,color:c}}>{mxnFmt(v)}</span>
                    </div>
                    <div style={{height:4,borderRadius:2,background:"#eee",overflow:"hidden"}}>
                      <div style={{height:"100%",borderRadius:2,background:c,width:`${TOTS.tGas>0?Math.min(100,v/TOTS.tGas*100):0}%`}}/>
                    </div>
                    <div style={{fontSize:10,color:T.fog,marginTop:2}}>{TOTS.tGas>0?(v/TOTS.tGas*100).toFixed(1):0}%</div>
                  </div>
                ))}
                <div style={{padding:"10px 16px",background:"#f5f5f5",display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontSize:12,fontWeight:700}}>Subtotal operativo</span>
                  <span style={{fontFamily:"monospace",fontWeight:700,color:"#c0392b"}}>{mxnFmt(TOTS.tGas)}</span>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-header"><div className="card-title">📈 Desglose Financiero</div></div>
              <div className="card-body" style={{padding:0}}>
                {[
                  [`Int. parafinanciero (${params.para_tasaAnual}% m.)`, TOTS.iP, "#1a6ea8"],
                  [`Int. directo (${params.dir_tasaAnual}% m.)`,         TOTS.iD, "#8e44ad"],
                  ["Comisiones parafinanciero",                           TOTS.cP, "#9b6d3a"],
                  ["Comisiones directo",                                  TOTS.cD, "#c0392b"],
                ].filter(([,v])=>v>0).map(([l,v,c])=>(
                  <div key={l} style={{padding:"9px 16px",borderBottom:`1px solid ${T.line}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:12,color:T.fog}}>{l}</span>
                      <span style={{fontFamily:"monospace",fontSize:13,fontWeight:700,color:c}}>{mxnFmt(v)}</span>
                    </div>
                    <div style={{height:4,borderRadius:2,background:"#eee",overflow:"hidden"}}>
                      <div style={{height:"100%",borderRadius:2,background:c,width:`${(TOTS.iP+TOTS.iD+TOTS.cP+TOTS.cD)>0?Math.min(100,v/(TOTS.iP+TOTS.iD+TOTS.cP+TOTS.cD)*100):0}%`}}/>
                    </div>
                  </div>
                ))}
                <div style={{padding:"10px 16px",background:"#f5f5f5",display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontSize:12,fontWeight:700}}>Subtotal financiero</span>
                  <span style={{fontFamily:"monospace",fontWeight:700,color:"#9b6d3a"}}>{mxnFmt(TOTS.iP+TOTS.iD+TOTS.cP+TOTS.cD)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabla por productor */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Por Productor</div>
              <span style={{fontSize:11,color:T.fog,fontFamily:"monospace"}}>{datosProductores.length} productores</span>
            </div>
            <div className="table-wrap-scroll">
              <table style={{minWidth:900}}>
                <thead>
                  <tr>
                    <th>Productor</th>
                    <th style={{textAlign:"right"}}>Ha</th>
                    <th style={{textAlign:"right"}}>Dispersado</th>
                    <th style={{textAlign:"right"}}>Gasto Op.</th>
                    <th style={{textAlign:"right"}}>Int.+Com.</th>
                    <th style={{textAlign:"right",color:"#c0392b"}}>Total Liquidar</th>
                    <th style={{textAlign:"right"}}>$/Ha</th>
                  </tr>
                </thead>
                <tbody>
                  {datosProductores.sort((a,b)=>b.tLiq-a.tLiq).map((d,i)=>{
                    const bg = i%2===0?"white":"#faf8f3";
                    return (
                      <tr key={d.p.id} style={{transition:"filter 0.12s"}}
                        onMouseEnter={e=>e.currentTarget.style.filter="brightness(0.93)"}
                        onMouseLeave={e=>e.currentTarget.style.filter=""}>
                        <td style={{background:bg}}>
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <div style={{width:8,height:8,borderRadius:"50%",background:d.p.color||"#888"}}/>
                            <span style={{fontWeight:600,fontSize:13}}>{d.p.alias||d.p.apPat}</span>
                          </div>
                        </td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12}}>{d.ha.toFixed(2)}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12,color:"#2d5a1b"}}>{mxnFmt(d.tDis)}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12,color:"#c0392b"}}>{mxnFmt(d.tGas)}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12,color:"#9b6d3a"}}>{mxnFmt(d.iP+d.iD+d.cP+d.cD)}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:700,color:"#c0392b"}}>{mxnFmt(d.tLiq)}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:11,color:"#856404"}}>{d.ha>0?mxnFmt(d.tLiq/d.ha):"—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{background:"#f0f4e8",fontWeight:700}}>
                    <td style={{padding:"9px 14px"}}>TOTAL CICLO</td>
                    <td style={{textAlign:"right",fontFamily:"monospace"}}>{TOTS.ha.toFixed(2)}</td>
                    <td style={{textAlign:"right",fontFamily:"monospace",color:"#2d5a1b"}}>{mxnFmt(TOTS.tDis)}</td>
                    <td style={{textAlign:"right",fontFamily:"monospace",color:"#c0392b"}}>{mxnFmt(TOTS.tGas)}</td>
                    <td style={{textAlign:"right",fontFamily:"monospace",color:"#9b6d3a"}}>{mxnFmt(TOTS.iP+TOTS.iD+TOTS.cP+TOTS.cD)}</td>
                    <td style={{textAlign:"right",fontFamily:"monospace",color:"#c0392b",fontSize:13}}>{mxnFmt(TOTS.tLiq)}</td>
                    <td style={{textAlign:"right",fontFamily:"monospace",color:"#856404"}}>{TOTS.ha>0?mxnFmt(TOTS.tLiq/TOTS.ha):"—"}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {seccion==="resumen" && (
        <div>
          <div className="card" style={{marginBottom:16}}>
            <div style={{padding:"18px 20px",borderBottom:`1px solid ${T.line}`}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700}}>Reporte Ejecutivo del Ciclo</div>
              <div style={{fontSize:12,color:T.fog,marginTop:2}}>Agrícola Charay · {state.cicloActual} · Generado {new Date().toLocaleDateString("es-MX",{day:"2-digit",month:"long",year:"numeric"})}</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)"}}>
              {[
                ["Hectáreas del ciclo",   `${fmt(F.ha,0)} ha`,            T.field],
                ["Lotes en producción",   `${state.lotes.length} lotes`,  T.field],
                ["Producción estimada",   `${fmt(F.produccionEst,0)} ton`, T.straw],
                ["Precio de venta",       mxn(F.precio)+"/ton",           T.straw],
                ["Ingreso estimado",      mxn(F.ingresoEst),              T.field],
                ["Costo total ciclo",     mxn(F.costoTotal),              T.rust],
                ["Costo por hectárea",    mxn(F.costoTotal/Math.max(F.ha,1)), T.rust],
                ["Costo por tonelada",    mxn(F.costoTotal/Math.max(F.produccionEst,1)), T.rust],
                ["Utilidad estimada",     mxn(F.utilidadBruta),          F.utilidadBruta>=0?T.field:T.rust],
                ["Margen neto",           `${fmt(Math.abs(F.margen),1)}%`, F.utilidadBruta>=0?T.field:T.rust],
                ["PE en toneladas",       `${fmt(F.peTon,1)} ton`,        T.straw],
                ["PE en rendimiento",     `${fmt(F.peHa,2)} ton/ha`,      T.straw],
              ].map(([l,v,c])=>(
                <div key={l} style={{padding:"12px 20px",borderRight:`1px solid ${T.line}`,borderBottom:`1px solid ${T.line}`}}>
                  <div style={{fontSize:11,color:T.fog,marginBottom:3}}>{l}</div>
                  <div className="font-mono" style={{fontWeight:700,fontSize:14,color:c}}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Semáforo operativo */}
          <div className="card">
            <div className="card-header"><div className="card-title">Indicadores Operativos</div></div>
            <div className="card-body" style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>
              {[
                { label:"Rentabilidad", valor:F.utilidadBruta>=0?"🟢 Rentable":"🔴 Pérdida estimada", ok:F.utilidadBruta>=0 },
                { label:"Crédito hab.", valor:(()=>{const v=calcularVencimiento(state.credito||{});return v?.nivel!=="ok"?"⚠️ "+( v?.mensaje||"Revisar"):"🟢 Al corriente";})(), ok:calcularVencimiento(state.credito||{})?.nivel==="ok" },
                { label:"Insumos bodega", valor:(state.insumos||[]).filter(i=>(i.cicloId||1)===(state.cicloActivoId||1)).some(i=>i.stockActual===0)?"🟡 Hay productos agotados":"🟢 Inventario OK", ok:!state.insumos.some(i=>i.stockActual===0) },
                { label:"Equipo", valor:state.maquinaria.some(m=>m.estado==="mantenimiento")?"🟡 Equipo en mantenimiento":"🟢 Flota operativa", ok:!state.maquinaria.some(m=>m.estado==="mantenimiento") },
              ].map(({label,valor,ok})=>(
                <div key={label} style={{padding:"12px 14px",borderRadius:8,border:`1px solid ${ok?T.field:T.straw}`,background:ok?"#eafaf1":"#fefde7"}}>
                  <div style={{fontSize:11,color:T.fog,marginBottom:4}}>{label}</div>
                  <div style={{fontSize:13,fontWeight:600}}>{valor}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {seccion==="lotes" && (()=>{
        // Usar asignaciones del ciclo activo
        const cicloAct  = (state.ciclos||[]).find(c=>c.id===state.cicloActivoId)||(state.ciclos||[]).find(c=>c.id===state.cicloActivoId)||(state.ciclos||[]).find(c=>c.predeterminado);
        const asigs     = cicloAct?.asignaciones||[];
        const rendEspLote = F.ha>0 ? (F.produccionEst/F.ha) : (state.rendimientoEsperado||10);
        const mxnFmt2   = n=>(parseFloat(n)||0).toLocaleString("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:2});

        return (
          <div className="card">
            <div className="table-wrap-scroll">
              <table style={{minWidth:860}}>
                <thead>
                  <tr>
                    <th>Lote / Apodo</th>
                    <th>Productor</th>
                    <th>Cultivo</th>
                    <th style={{textAlign:"right"}}>Ha</th>
                    <th style={{textAlign:"right"}}>Rend. esp.</th>
                    <th style={{textAlign:"right"}}>Prod. est.</th>
                    <th style={{textAlign:"right"}}>Ingreso est.</th>
                    <th style={{textAlign:"right"}}>Costo prorr.</th>
                    <th style={{textAlign:"right"}}>Utilidad est.</th>
                  </tr>
                </thead>
                <tbody>
                  {asigs.map((a,i)=>{
                    const lote       = (state.lotes||[]).find(l=>l.id===a.loteId);
                    const prod_obj   = (state.productores||[]).find(p=>String(p.id)===String(a.productorId));
                    const ha         = parseFloat(a.supAsignada)||0;
                    const cultNom    = a.cultivoNombre||(cicloAct?.cultivosDelCiclo?.[0]?.cultivoNombre||"—");
                    const variedad   = a.variedad||"";
                    const prod_est   = ha * rendEspLote;
                    const ing        = prod_est * F.precio;
                    const costoProrr = F.ha>0 ? F.costoTotal*(ha/F.ha) : 0;
                    const util       = ing - costoProrr;
                    const bg         = i%2===0?"white":"#faf8f3";
                    return (
                      <tr key={`${a.loteId}-${a.productorId}`}>
                        <td style={{background:bg,fontWeight:600,fontSize:12}}>
                          {lote?.apodo&&lote.apodo!=="NO DEFINIDO"?lote.apodo:lote?.lote||`Lote #${a.loteId}`}
                          {lote?.folioCorto&&<div style={{fontSize:10,color:"#8a8070",fontWeight:400}}>{lote.folioCorto}</div>}
                        </td>
                        <td style={{background:bg,fontSize:12}}>{prod_obj?.alias||`Prod #${a.productorId}`}</td>
                        <td style={{background:bg,fontSize:11}}>
                          <span style={{background:"#e8f4e1",color:"#2d5a1b",padding:"2px 7px",borderRadius:10,fontSize:10,fontWeight:600}}>
                            {cultNom}{variedad?` — ${variedad}`:""}
                          </span>
                        </td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:600}}>{ha.toFixed(2)}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:11,color:"#5a7a3a"}}>{rendEspLote.toFixed(1)} t/ha</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:11}}>{prod_est.toFixed(1)} ton</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:600,color:"#2d5a1b"}}>{mxnFmt2(ing)}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",color:"#c0392b"}}>{mxnFmt2(costoProrr)}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:700,color:util>=0?"#2d5a1b":"#c0392b"}}>{mxnFmt2(util)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{background:"#f0f8e8",fontWeight:700}}>
                    <td colSpan={3} style={{padding:"8px 12px",color:"#2d5a1b"}}>TOTAL — {asigs.length} lotes</td>
                    <td style={{textAlign:"right",fontFamily:"monospace"}}>{F.ha.toFixed(2)}</td>
                    <td style={{textAlign:"right",fontFamily:"monospace",color:"#5a7a3a"}}>{rendEspLote.toFixed(1)} t/ha</td>
                    <td style={{textAlign:"right",fontFamily:"monospace"}}>{F.produccionEst.toFixed(1)} ton</td>
                    <td style={{textAlign:"right",fontFamily:"monospace",color:"#2d5a1b"}}>{mxnFmt2(F.ingresoEst)}</td>
                    <td style={{textAlign:"right",fontFamily:"monospace",color:"#c0392b"}}>{mxnFmt2(F.costoTotal)}</td>
                    <td style={{textAlign:"right",fontFamily:"monospace",fontWeight:700,color:F.utilidadBruta>=0?"#2d5a1b":"#c0392b"}}>{mxnFmt2(F.utilidadBruta)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })()}

      {seccion==="costos" && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Categoría de Costo</th><th style={{textAlign:"right"}}>Monto</th><th style={{textAlign:"right"}}>$/ha</th><th style={{textAlign:"right"}}>% del Total</th></tr></thead>
              <tbody>
                {[
                  ["Insumos aplicados",       F.costoInsumos],
                  ["Gastos generales",        F.costoGastos],
                  ["Diesel y combustible",    F.costoDiesel],
                  ["Renta de tierras",        F.costoRenta],
                  ["Maquinaria (h/c)",        F.costoMaquinaria],
                  ["Nómina operadores",       F.costoNomina],
                  ["Personal y honorarios",   F.costoPersonal],
                  ["Cosecha y maquila",       F.costoCosecha],
                  ["Interés créditos",        F.costoInteres],
                ].filter(([,v])=>v>0).map(([l,v])=>(
                  <tr key={l}>
                    <td style={{fontWeight:500}}>{l}</td>
                    <td className="font-mono fw-600" style={{textAlign:"right",color:T.rust}}>{mxn(v)}</td>
                    <td className="font-mono" style={{textAlign:"right",color:T.fog}}>{mxn(v/Math.max(F.ha,1))}</td>
                    <td style={{textAlign:"right",minWidth:120}}>
                      <div className="flex items-center gap-2" style={{justifyContent:"flex-end"}}>
                        <div className="progress-bar" style={{width:80,flex:"none"}}>
                          <div className="progress-fill progress-rust" style={{width:`${F.costoTotal>0?Math.round(v/F.costoTotal*100):0}%`}}/>
                        </div>
                        <span className="font-mono" style={{fontSize:11,color:T.fog,width:30}}>{F.costoTotal>0?Math.round(v/F.costoTotal*100):0}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{padding:"12px 20px",borderTop:`2px solid ${T.line}`,display:"flex",justifyContent:"space-between",fontWeight:700,background:T.mist}}>
            <span>COSTO TOTAL</span>
            <span className="font-mono fw-600" style={{color:T.rust,fontSize:15}}>{mxn(F.costoTotal)}</span>
          </div>
        </div>
      )}

      {seccion==="creditos" && (
        <div>
          <div className="card" style={{marginBottom:16}}>
            <div className="card-header"><div className="card-title">🏦 Crédito Habilitación</div></div>
            <div className="card-body" style={{padding:0}}>
              {[
                ["Institución", state.credito?.institucion],
                ["Contrato", state.credito?.noContrato],
                ["Línea autorizada", mxn(state.credito?.lineaAutorizada)],
                ["Total dispuesto", mxn((state.dispersiones||[]).filter(d=>!d.cancelado&&(d.cicloId||1)===(state.cicloActivoId||1)).reduce((s,d)=>s+(parseFloat(d.monto)||0),0))],
                ["Saldo capital", mxn(F.saldoHab)],
                ["Interés acumulado", mxn(F.intHab+F.intCargosCred+F.intMoraHab)],
                ["Tasa anual", `${state.credito?.tasaAnual}%`],
                ["Vencimiento", state.credito?.fechaVencimiento],
              ].map(([l,v])=>(
                <div key={l} className="flex justify-between" style={{padding:"10px 20px",borderBottom:`1px solid ${T.line}`}}>
                  <span style={{fontSize:12,color:T.fog}}>{l}</span>
                  <span className="font-mono fw-600" style={{fontSize:13}}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          {state.creditosRef.length===0 ? (
            <div className="card"><div className="empty-state"><div className="empty-icon">🏗</div><div className="empty-title">Sin créditos refaccionarios</div></div></div>
          ) : (state.creditosRef||[]).map(c=>{
            const { saldoCapital, interesTotal } = calcularInteresCredito(c);
            return (
              <div className="card" key={c.id} style={{marginBottom:12}}>
                <div className="card-header"><div className="card-title">🏗 Refaccionario · {c.institucion}</div></div>
                <div className="card-body" style={{padding:0}}>
                  {[["Contrato",c.noContrato],["Línea",mxn(c.lineaAutorizada)],["Saldo capital",mxn(saldoCapital)],["Interés acum.",mxn(interesTotal)],["Tasa",`${c.tasaAnual}%`],["Vencimiento",c.fechaVencimiento||"—"]].map(([l,v])=>(
                    <div key={l} className="flex justify-between" style={{padding:"9px 20px",borderBottom:`1px solid ${T.line}`}}>
                      <span style={{fontSize:12,color:T.fog}}>{l}</span>
                      <span className="font-mono fw-600" style={{fontSize:13}}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}


      {seccion==="comparativo" && (()=>{
        const ciclos  = state.ciclos || [];
        const mxnFmt2 = n => (parseFloat(n)||0).toLocaleString("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:0,maximumFractionDigits:0});
        const datosCiclos = ciclos.map(ciclo=>{
          const tmpState = {...state, cicloActivoId:ciclo.id, cicloActual:ciclo.nombre};
          const Fc = calcularFinancieros(tmpState);
          return { nombre:ciclo.nombre, id:ciclo.id, activo:ciclo.id===state.cicloActivoId,
            ha:Fc.ha, produccion:Fc.produccionEst, ingreso:Fc.ingresoEst, costo:Fc.costoTotal,
            utilidad:Fc.utilidadBruta, margen:Fc.margen,
            rendimiento:Fc.ha>0?Fc.produccionEst/Fc.ha:0, costoHa:Fc.ha>0?Fc.costoTotal/Fc.ha:0 };
        }).filter(c=>c.ha>0||c.costo>0).sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre)));

        if(datosCiclos.length<2) return (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <div className="empty-title">Se necesitan al menos 2 ciclos con datos</div>
            <div className="empty-sub">Cuando registres el siguiente ciclo aparecerá el comparativo automáticamente</div>
          </div>
        );
        return (
          <div>
            <div className="card" style={{marginBottom:16}}>
              <div className="card-header">
                <div className="card-title">Comparativo por Ciclo</div>
                <BtnExport onClick={()=>exportarExcel("Comparativo_Ciclos",[{
                  nombre:"Comparativo",
                  headers:["Ciclo","Ha","Producción (ton)","Rend. t/ha","Ingreso","Costo Total","Costo/ha","Utilidad","Margen %"],
                  rows:datosCiclos.map(c=>[c.nombre,c.ha.toFixed(2),c.produccion.toFixed(1),c.rendimiento.toFixed(2),c.ingreso.toFixed(0),c.costo.toFixed(0),c.costoHa.toFixed(0),c.utilidad.toFixed(0),c.margen.toFixed(1)])
                }])}/>
              </div>
              <div className="table-wrap-scroll">
                <table style={{minWidth:750}}>
                  <thead><tr>
                    <th>Ciclo</th><th style={{textAlign:"right"}}>Ha</th><th style={{textAlign:"right"}}>Prod.</th>
                    <th style={{textAlign:"right"}}>Rend.</th><th style={{textAlign:"right"}}>Ingreso</th>
                    <th style={{textAlign:"right"}}>Costo</th><th style={{textAlign:"right"}}>$/ha</th>
                    <th style={{textAlign:"right"}}>Utilidad</th><th style={{textAlign:"right"}}>Margen</th>
                  </tr></thead>
                  <tbody>
                    {datosCiclos.map((c,i)=>{
                      const bg=c.activo?"#f0f7ec":i%2===0?"white":"#faf8f3";
                      return (<tr key={c.id}>
                        <td style={{background:bg,fontWeight:c.activo?700:400}}>
                          {c.nombre}{c.activo&&<span style={{marginLeft:6,fontSize:10,color:"#2d5a1b",background:"#d4edda",padding:"1px 6px",borderRadius:10}}>activo</span>}
                        </td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12}}>{c.ha.toFixed(2)}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12,color:"#2d5a1b"}}>{c.produccion.toFixed(1)}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12}}>{c.rendimiento.toFixed(2)}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12,color:"#2d5a1b"}}>{mxnFmt2(c.ingreso)}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12,color:"#c0392b"}}>{mxnFmt2(c.costo)}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12}}>{mxnFmt2(c.costoHa)}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:700,color:c.utilidad>=0?"#2d5a1b":"#c0392b"}}>{mxnFmt2(c.utilidad)}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12,color:c.margen>=0?"#2d5a1b":"#c0392b"}}>{c.margen.toFixed(1)}%</td>
                      </tr>);
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {[{label:"Costo por hectárea",key:"costoHa",color:"#c0392b",fmt:n=>mxnFmt2(n)},
                {label:"Rendimiento (ton/ha)",key:"rendimiento",color:"#2d5a1b",fmt:n=>n.toFixed(2)}
              ].map(({label,key,color,fmt})=>{
                const max=Math.max(...datosCiclos.map(c=>c[key]),1);
                return (<div key={key} className="card">
                  <div className="card-header"><div className="card-title">{label}</div></div>
                  <div style={{padding:"8px 16px"}}>
                    {datosCiclos.map(c=>(
                      <div key={c.id} style={{marginBottom:8}}>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                          <span style={{fontWeight:c.activo?700:400}}>{c.nombre}</span>
                          <span style={{fontFamily:"monospace",fontWeight:700,color}}>{fmt(c[key])}</span>
                        </div>
                        <div style={{height:8,borderRadius:4,background:"#eee",overflow:"hidden"}}>
                          <div style={{height:"100%",borderRadius:4,background:color,width:Math.min(100,c[key]/max*100)+"%" }}/>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>);
              })}
            </div>
          </div>
        );
      })()}


      {seccion==="cierre" && (()=>{
        const mxnFmt2 = n => (parseFloat(n)||0).toLocaleString("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:2});
        const cicloNom = state.cicloActual || "Ciclo";
        const fecha = new Date().toLocaleDateString("es-MX",{day:"2-digit",month:"long",year:"numeric"});
        const seccionesReporte = [
          {titulo:"1. Resumen Ejecutivo", items:[
            ["Ciclo", cicloNom],["Fecha de cierre", fecha],
            ["Hectáreas del ciclo", F.ha.toFixed(2)+" ha"],
            ["Productores con movimientos", String(datosProductores.length)],
            ["Producción estimada", F.produccionEst.toFixed(1)+" ton"],
            ["Rendimiento", F.ha>0?(F.produccionEst/F.ha).toFixed(2)+" ton/ha":"—"],
            ["Precio de venta", mxnFmt2(F.precio)+"/ton"],
            ["Ingreso estimado", mxnFmt2(F.ingresoEst)],
          ]},
          {titulo:"2. Estructura de Costos", items:[
            ["Semilla", mxnFmt2(F.costoSemilla)],
            ["Insumos (fertilizantes/agroquímicos)", mxnFmt2(F.costoInsumos)],
            ["Diesel y combustible", mxnFmt2(F.costoDiesel)],
            ["Renta de tierra", mxnFmt2(F.costoRenta)],
            ["Mano de obra", mxnFmt2(F.costoManoObra)],
            ["Agua / Riego", mxnFmt2(F.costoAgua)],
            ["Seguros", mxnFmt2(F.costoSeguros)],
            ["Trámites y otros", mxnFmt2(F.costoTramites||0)],
            ["Maquinaria propia", mxnFmt2(F.costoMaquinaria||0)],
            ["Cosecha (maquila/fletes/cuadrillas)", mxnFmt2(F.costoCosecha||0)],
            ["Intereses + Comisiones", mxnFmt2(F.costoFinanciero)],
            ["COSTO TOTAL", mxnFmt2(F.costoTotal)],
            ["Costo por hectárea", mxnFmt2(F.ha>0?F.costoTotal/F.ha:0)],
            ["Costo por tonelada", mxnFmt2(F.costoTon||0)],
          ]},
          {titulo:"3. Resultado", items:[
            ["Ingreso estimado", mxnFmt2(F.ingresoEst)],
            ["Costo total", mxnFmt2(F.costoTotal)],
            ["UTILIDAD ESTIMADA", mxnFmt2(F.utilidadBruta)],
            ["Margen", F.margen.toFixed(1)+"%"],
            ["Punto de equilibrio (ton)", (F.peTon||0).toFixed(1)+" ton"],
            ["Punto de equilibrio (ton/ha)", (F.peHa||0).toFixed(2)+" ton/ha"],
          ]},
          {titulo:"4. Crédito", items:[
            ["Total dispersado", mxnFmt2(TOTS.tDis)],
            ["Gasto operativo total", mxnFmt2(TOTS.tGas)],
            ["Intereses parafinanciero", mxnFmt2(TOTS.iP)],
            ["Intereses directo", mxnFmt2(TOTS.iD)],
            ["Comisiones parafinanciero", mxnFmt2(TOTS.cP)],
            ["Comisiones directo", mxnFmt2(TOTS.cD)],
            ["TOTAL A LIQUIDAR", mxnFmt2(TOTS.tLiq)],
          ]},
        ];
        return (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700}}>📄 Reporte de Cierre — {cicloNom}</div>
              <BtnExport label="📥 Excel Cierre" onClick={()=>exportarExcel("Cierre_"+cicloNom,[
                {nombre:"Cierre",headers:["Sección","Concepto","Valor"],
                 rows:seccionesReporte.flatMap(s=>[[s.titulo,"",""],...s.items.map(([c,v])=>["",c,v])])},
                {nombre:"Por Productor",headers:["Productor","Ha","Dispersado","Gasto Op.","Int.+Com.","Total Liquidar","$/Ha"],
                 rows:datosProductores.map(d=>[d.p.alias||d.p.apPat,d.ha.toFixed(2),d.tDis.toFixed(2),d.tGas.toFixed(2),(d.iP+d.iD+d.cP+d.cD).toFixed(2),d.tLiq.toFixed(2),d.ha>0?(d.tLiq/d.ha).toFixed(2):"0"])}
              ])}/>
            </div>
            {seccionesReporte.map(sec=>(
              <div key={sec.titulo} className="card" style={{marginBottom:12}}>
                <div className="card-header"><div className="card-title" style={{fontSize:14}}>{sec.titulo}</div></div>
                <div style={{padding:0}}>
                  {sec.items.map(([concepto,valor],i)=>{
                    const isTot = concepto.toUpperCase()===concepto && concepto.length>4;
                    const bg = isTot?"#f0f4e8":i%2===0?"white":"#faf8f3";
                    return (
                      <div key={concepto} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                        padding:"9px 16px",borderBottom:"1px solid "+T.line,background:bg}}>
                        <span style={{fontSize:13,color:isTot?T.ink:T.fog,fontWeight:isTot?700:400}}>{concepto}</span>
                        <span style={{fontFamily:"monospace",fontWeight:isTot?800:600,fontSize:isTot?15:13,color:isTot?"#2d5a1b":T.ink}}>{valor}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="card">
              <div className="card-header"><div className="card-title">5. Estado de Cuenta por Productor</div></div>
              <div className="table-wrap-scroll">
                <table style={{minWidth:700}}>
                  <thead><tr>
                    <th>Productor</th><th style={{textAlign:"right"}}>Ha</th>
                    <th style={{textAlign:"right"}}>Dispersado</th><th style={{textAlign:"right"}}>Gasto Op.</th>
                    <th style={{textAlign:"right"}}>Int.+Com.</th>
                    <th style={{textAlign:"right",color:"#c0392b"}}>Total Liquidar</th>
                    <th style={{textAlign:"right"}}>$/Ha</th>
                  </tr></thead>
                  <tbody>
                    {datosProductores.sort((a,b)=>b.tLiq-a.tLiq).map((d,i)=>{
                      const bg=i%2===0?"white":"#faf8f3";
                      return (<tr key={d.p.id}>
                        <td style={{background:bg,fontWeight:600}}>{d.p.alias||d.p.apPat}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12}}>{d.ha.toFixed(2)}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12,color:"#1a6ea8"}}>{mxnFmt2(d.tDis)}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12,color:"#c0392b"}}>{mxnFmt2(d.tGas)}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12,color:"#9b6d3a"}}>{mxnFmt2(d.iP+d.iD+d.cP+d.cD)}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:700,color:"#c0392b"}}>{mxnFmt2(d.tLiq)}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:11}}>{d.ha>0?mxnFmt2(d.tLiq/d.ha):"—"}</td>
                      </tr>);
                    })}
                  </tbody>
                  <tfoot><tr style={{background:"#f0f4e8",fontWeight:700}}>
                    <td>TOTAL CICLO</td>
                    <td style={{textAlign:"right",fontFamily:"monospace"}}>{TOTS.ha.toFixed(2)}</td>
                    <td style={{textAlign:"right",fontFamily:"monospace",color:"#1a6ea8"}}>{mxnFmt2(TOTS.tDis)}</td>
                    <td style={{textAlign:"right",fontFamily:"monospace",color:"#c0392b"}}>{mxnFmt2(TOTS.tGas)}</td>
                    <td style={{textAlign:"right",fontFamily:"monospace",color:"#9b6d3a"}}>{mxnFmt2(TOTS.iP+TOTS.iD+TOTS.cP+TOTS.cD)}</td>
                    <td style={{textAlign:"right",fontFamily:"monospace",color:"#c0392b",fontSize:14}}>{mxnFmt2(TOTS.tLiq)}</td>
                    <td style={{textAlign:"right",fontFamily:"monospace"}}>{TOTS.ha>0?mxnFmt2(TOTS.tLiq/TOTS.ha):"—"}</td>
                  </tr></tfoot>
                </table>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
