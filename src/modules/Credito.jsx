// ─── modules/Credito.jsx ───────────────────────────────────────────

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


export default function CreditoModule({ userRol, puedeEditar, onNavigate, navFiltro = {} }) {
  const { state, dispatch } = useData();
  const nav = (page, pid, filtros) => onNavigate && onNavigate(page, pid, filtros);
  const [vista, setVista]         = useState(navFiltro.vista || "consolidado");
  const [prodSel, setProdSel]     = useState(navFiltro.prodId || null);
  const [editParams, setEditParams]       = useState(false);
  const [editMontoPorHa, setEditMontoPorHa] = useState(false);
  const [montoPorHaForm, setMontoPorHaForm]  = useState("");
  const [showDesglose, setShowDesglose]      = useState(false);

  // Sincronizar montoPorHaForm cuando cambia el productor seleccionado
  React.useEffect(() => {
    if (prodSel) {
      const exp = (state.expedientes||[]).find(e=>e.productorId===prodSel);
      setMontoPorHaForm(exp?.montoPorHa ? String(exp.montoPorHa) : "");
      setEditMontoPorHa(false);
    }
  }, [prodSel]);

  const productores  = state.productores || [];
  const expedientes  = state.expedientes || [];
  const dispersiones = (state.dispersiones||[]).filter(d=>!d.cancelado&&((d.cicloId||1)===(state.cicloActivoId||1)));
  const _cid = state.cicloActivoId||1;
  const insumos      = (state.insumos||[]).filter(i=>!i.cancelado&&((i.cicloId||1)===_cid));
  const diesel       = (state.diesel||[]).filter(d=>!d.cancelado&&((d.cicloId||1)===_cid));
  const egresos      = (state.egresosManual||[]).filter(e=>(e.cicloId||1)===(state.cicloActivoId||1)).filter(e=>!e.cancelado);
  const asigsCiclo   = (((state.ciclos||[]).find(c=>c.id===state.cicloActivoId)||(state.ciclos||[]).find(c=>c.predeterminado))?.asignaciones)||[];

  const mxnFmt = n => (parseFloat(n)||0).toLocaleString("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:2,maximumFractionDigits:2});
  const nomProd = id => productores.find(p=>p.id===id)?.alias || String(id);
  const colProd = id => productores.find(p=>p.id===id)?.color || "#888";
  const hoy = new Date();

  const CAT_LABELS_C = {
    mano_obra:"Mano de Obra", renta_tierra:"Renta de Tierra",
    pago_agua:"Pago de Agua", permiso_siembra:"Permiso de Siembra",
    flete:"Flete", reparaciones:"Reparaciones", tramites:"Trámites",
    seguros:"Seguros", otro:"Otros",
  };

  // ── Parámetros del crédito (editables) ──────────────────────────────────────
  const defaultParams = {
    para_tasaAnual:      1.38,  // % MENSUAL
    para_factibilidad:   1.25,  // % sobre crédito total autorizado + IVA
    para_fega:           2.3,   // % sobre monto parafinanciero
    para_asistTec:       200,   // $ por ha
    dir_tasaAnual:       1.8,   // % MENSUAL
    dir_factibilidad:    1.5,   // % sobre monto directo + IVA
    dir_fega:            2.3,   // % ((monto×días)/360) + IVA
    iva:                 16,
  };
  const params = { ...defaultParams, ...(state.creditoParams||{}) };
  const [formParams, setFormParams] = useState(params);

  const guardarParams = () => {
    dispatch({ type:"SET_CREDITO_PARAMS", payload: formParams });
    setEditParams(false);
  };

  // ── Ha por productor ─────────────────────────────────────────────────────────
  const haProd = id => asigsCiclo
    .filter(a=>String(a.productorId)===String(id))
    .reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);

  // ── Gasto total del ciclo por productor ──────────────────────────────────────
  const gastoTotalProd = id => {
    const sem = insumos.filter(i=>String(i.productorId)===String(id)).reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
    const die = diesel.filter(d=>String(d.productorId)===String(id)).reduce((s,d)=>s+(parseFloat(d.importe)||0),0);
    const efe = egresos.filter(e=>String(e.productorId)===String(id)).reduce((s,e)=>s+(parseFloat(e.monto)||0),0);
    return sem + die + efe;
  };

  // ── Monto parafinanciero autorizado ─────────────────────────────────────────
  const creditoParaProd = id => {
    const exp = expedientes.find(e=>e.productorId===id);
    const ha  = haProd(id);
    return exp?.montoPorHa ? ha * exp.montoPorHa : 0;
  };

  // ── Dispersiones del productor ordenadas por fecha ───────────────────────────
  const dispsOrdenadas = id => [...dispersiones]
    .filter(d=>String(d.productorId)===String(id))
    .sort((a,b)=>String(a.fecha||a.fechaSolicitud).localeCompare(String(b.fecha||b.fechaSolicitud)));

  // ── Días transcurridos desde fecha de solicitud ──────────────────────────────
  const diasDesde = fechaStr => {
    if (!fechaStr) return 0;
    const f = new Date(fechaStr);
    return Math.max(0, Math.round((hoy - f) / 86400000));
  };

  // ── Construir lista de TODOS los movimientos de gasto del productor ──────────
  const todosMovimientos = (id) => {
    const movs = [];
    insumos.filter(i=>String(i.productorId)===String(id)).forEach(i=>movs.push({
      id:`ins-${i.id}`, tipo:"Insumo", concepto:i.insumo||i.categoria,
      fecha:i.fechaSolicitud||i.fechaOrden||"",
      monto:parseFloat(i.importe)||0, lineaCredito:i.lineaCredito||"parafinanciero",
    }));
    diesel.filter(d=>String(d.productorId)===String(id)).forEach(d=>movs.push({
      id:`die-${d.id}`, tipo:"Diesel", concepto:"Diesel y Combustible",
      fecha:d.fechaSolicitud||d.fechaOrden||"",
      monto:parseFloat(d.importe)||0, lineaCredito:d.lineaCredito||"parafinanciero",
    }));
    egresos.filter(e=>String(e.productorId)===String(id)).forEach(e=>{
      // Usar fecha del egreso, o fecha de solicitud ligada, o semanaFechaInicio
      const fechaEgr = e.fecha || e.semanaFechaInicio ||
        (e.solicitudes&&e.solicitudes[0]?.fecha) || "";
      movs.push({
        id:`egr-${e.id}`, tipo:"Efectivo",
        concepto:e.concepto||(CAT_LABELS_C[e.categoria]||e.categoria),
        fecha:fechaEgr,
        monto:parseFloat(e.monto)||0, lineaCredito:e.lineaCredito||"parafinanciero",
      });
    });
    return movs.filter(m=>m.monto>0).sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)));
  };

  // ── CÁLCULOS PARAFINANCIERO ──────────────────────────────────────────────────
  const calcParafin = (id) => {
    const ha         = haProd(id);
    const creditoAut = creditoParaProd(id);
    if (!creditoAut) return {
      montoApl:0, creditoAut:0, ha, dias:0, fechaInicio:null,
      interes:0, movimientos:[],
      factBase:0, factIva:0, factTotal:0,
      fegaBase:0, fegaIva:0, fegaTotal:0, asistBase:0,
      totalComisiones:0, totalALiquidar:0,
    };
    const gasto    = gastoTotalProd(id);
    const montoApl = Math.min(gasto, creditoAut);

    // Todos los movimientos ordenados por fecha
    const movs = todosMovimientos(id);
    const fechaInicio = movs[0]?.fecha || null;
    const dias = diasDesde(fechaInicio);

    // Interés por cada movimiento: ((monto × tasa%) / 30) × días desde ese movimiento
    // Solo hasta el tope parafinanciero — aplicar proporcionalmente
    let acum = 0;
    const movsConInteres = movs.map(m => {
      const montoDisp = Math.min(m.monto, Math.max(0, montoApl - acum));
      acum += montoDisp;
      const diasD   = diasDesde(m.fecha);
      const intDisp = ((montoDisp * (params.para_tasaAnual/100)) / 30) * diasD;
      return { ...m, montoDisp, diasD, intDisp };
    }).filter(m=>m.montoDisp>0);

    const interes = movsConInteres.reduce((s,m)=>s+m.intDisp, 0);

    // Factibilidad: % sobre crédito autorizado + IVA (una sola vez)
    const factBase = creditoAut * (params.para_factibilidad/100);
    const factIva  = factBase * (params.iva/100);
    const factTotal= factBase + factIva;

    // FEGA parafinanciero = monto parafinanciero × fega% (sin días)
    const fegaBase  = montoApl * (params.para_fega/100);
    const fegaIva   = fegaBase * (params.iva/100);
    const fegaTotal = fegaBase + fegaIva;
    const asistBase = ha * params.para_asistTec;

    return {
      montoApl, creditoAut, ha, dias, fechaInicio,
      interes, movimientos: movsConInteres,
      factBase, factIva, factTotal,
      fegaBase, fegaIva, fegaTotal,
      asistBase,
      totalComisiones: factTotal + fegaTotal + asistBase,
      totalALiquidar: montoApl + interes + factTotal + fegaTotal + asistBase,
    };
  };

  // ── CÁLCULOS CRÉDITO DIRECTO ─────────────────────────────────────────────────
  const calcDirecto = (id) => {
    const gasto    = gastoTotalProd(id);
    const creditoP = creditoParaProd(id);
    const montoApl = Math.max(0, gasto - creditoP);
    if (montoApl === 0) return {
      montoApl:0, dias:0, fechaInicio:null,
      interes:0, movimientos:[],
      factBase:0, factIva:0, factTotal:0,
      fegaBase:0, fegaIva:0, fegaTotal:0,
      totalComisiones:0, totalALiquidar:0
    };

    // Movimientos que generan el excedente (los que van después del tope parafinanciero)
    const movs = todosMovimientos(id);
    const fechaInicio = movs[0]?.fecha || null;
    const dias = diasDesde(fechaInicio);

    // Solo los movimientos que caen en el tramo directo (después del tope parafin)
    let acum = 0;
    const movsConInteres = movs.map(m => {
      const yaEnPara   = Math.min(m.monto, Math.max(0, creditoP - acum));
      const enDirecto  = m.monto - yaEnPara;
      acum += m.monto;
      const diasD   = diasDesde(m.fecha);
      const intDisp = enDirecto > 0 ? ((enDirecto * (params.dir_tasaAnual/100)) / 30) * diasD : 0;
      return { ...m, montoDisp: enDirecto, diasD, intDisp };
    }).filter(m=>m.montoDisp>0);

    const interes = movsConInteres.reduce((s,m)=>s+m.intDisp, 0);

    // Factibilidad directo = por cada movimiento (dispersión) × factibilidad% + IVA
    let factBase = 0;
    movsConInteres.forEach(m => {
      factBase += m.montoDisp * (params.dir_factibilidad/100);
    });
    const factIva   = factBase * (params.iva/100);
    const factTotal = factBase + factIva;
    // FEGA directo = ((monto × días) / 36000) × fega% — por cada movimiento
    let fegaBase = 0;
    movsConInteres.forEach(m => {
      fegaBase += ((m.montoDisp * m.diasD) / 360) * (params.dir_fega/100);
    });
    const fegaIva   = fegaBase * (params.iva/100);
    const fegaTotal = fegaBase + fegaIva;

    return {
      montoApl, dias, fechaInicio,
      interes, movimientos: movsConInteres,
      factBase, factIva, factTotal,
      fegaBase, fegaIva, fegaTotal,
      totalComisiones: factTotal + fegaTotal,
      totalALiquidar: montoApl + interes + factTotal + fegaTotal,
    };
  };

  // ── TOTALES CONSOLIDADOS ─────────────────────────────────────────────────────
  const resumenGlobal = () => {
    let rPara = { montoApl:0, interes:0, factTotal:0, fegaTotal:0, asistBase:0, totalComisiones:0, totalALiquidar:0 };
    let rDir  = { montoApl:0, interes:0, factTotal:0, fegaTotal:0, totalComisiones:0, totalALiquidar:0 };
    productores.forEach(p => {
      if (!gastoTotalProd(p.id) && !creditoParaProd(p.id)) return;
      const cp = calcParafin(p.id);
      const cd = calcDirecto(p.id);
      rPara.montoApl       += cp.montoApl;
      rPara.interes        += cp.interes;
      rPara.factTotal      += cp.factTotal||0;
      rPara.fegaTotal      += cp.fegaTotal||0;
      rPara.asistBase      += cp.asistBase||0;
      rPara.totalComisiones+= cp.totalComisiones;
      rPara.totalALiquidar += cp.totalALiquidar;
      rDir.montoApl        += cd.montoApl;
      rDir.interes         += cd.interes;
      rDir.factTotal       += cd.factTotal||0;
      rDir.fegaTotal       += cd.fegaTotal||0;
      rDir.totalComisiones += cd.totalComisiones;
      rDir.totalALiquidar  += cd.totalALiquidar;
    });
    return { rPara, rDir, total: {
      montoApl:       rPara.montoApl+rDir.montoApl,
      interes:        rPara.interes+rDir.interes,
      factTotal:      rPara.factTotal+rDir.factTotal,
      fegaTotal:      rPara.fegaTotal+rDir.fegaTotal,
      asistBase:      rPara.asistBase,
      totalComisiones:rPara.totalComisiones+rDir.totalComisiones,
      totalALiquidar: rPara.totalALiquidar+rDir.totalALiquidar,
    }};
  };

  // ── COMPONENTE TARJETA LÍNEA ─────────────────────────────────────────────────
  const TarjetaLinea = ({titulo, color, icono, data, extraRows=[]}) => (
    <div style={{flex:1,border:`2px solid ${color}33`,borderRadius:10,overflow:"hidden"}}>
      <div style={{background:color,padding:"10px 16px",color:"white"}}>
        <div style={{fontWeight:700,fontSize:14}}>{icono} {titulo}</div>
      </div>
      <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:6}}>
        {[
          ["Capital aplicado",   mxnFmt(data.montoApl),         "#3d3525"],
          ["Interés acumulado",  mxnFmt(data.interes),          "#c0392b"],
          ["Factibilidad",       mxnFmt(data.factTotal||0),     "#8e44ad"],
          ["FEGA",               mxnFmt(data.fegaTotal||0),     "#1a6ea8"],
          ...extraRows,
          ["Total comisiones",   mxnFmt(data.totalComisiones),  "#856404"],
        ].map(([l,v,c])=>(
          <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #f0ece4"}}>
            <span style={{fontSize:12,color:"#6a6050"}}>{l}</span>
            <span style={{fontFamily:"monospace",fontWeight:600,fontSize:12,color:c}}>{v}</span>
          </div>
        ))}
        <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0 0",marginTop:4,borderTop:`2px solid ${color}`}}>
          <span style={{fontWeight:700,fontSize:13}}>TOTAL A LIQUIDAR</span>
          <span style={{fontFamily:"monospace",fontWeight:700,fontSize:14,color}}>{mxnFmt(data.totalALiquidar)}</span>
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // VISTA CONSOLIDADA
  // ─────────────────────────────────────────────────────────────────────────────
  if (vista==="consolidado") {
    const G = resumenGlobal();
    return (
      <div>
        {/* Parámetros */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontSize:12,color:"#8a8070"}}>
            Parafin: {params.para_tasaAnual}% mens. · Fact {params.para_factibilidad}% · FEGA {params.para_fega}% · AT $200/ha &nbsp;|&nbsp;
            Directo: {params.dir_tasaAnual}% mens. · Fact {params.dir_factibilidad}% · FEGA {params.dir_fega}%
          </div>
          {puedeEditar&&<button className="btn btn-sm btn-secondary" onClick={()=>{setFormParams(params);setEditParams(true);}}>⚙️ Editar parámetros</button>}
        </div>

        {/* Resumen global — 3 columnas (colapsa a 1 en móvil) */}
        <div className="credito-cards-row" style={{display:"flex",gap:14,marginBottom:20}}>
          <TarjetaLinea titulo="Crédito Parafinanciero" color="#1a6ea8" icono="🏦"
            data={G.rPara}
            extraRows={[["Asist. Técnica", mxnFmt(G.rPara.asistBase||0),"#2d5a1b"]]}/>
          <TarjetaLinea titulo="Crédito Directo" color="#8e44ad" icono="💳" data={G.rDir}/>
          <div style={{flex:1,border:"2px solid #c0392b33",borderRadius:10,overflow:"hidden"}}>
            <div style={{background:"#c0392b",padding:"10px 16px",color:"white"}}>
              <div style={{fontWeight:700,fontSize:14}}>📊 TOTAL GRUPO</div>
            </div>
            <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:6}}>
              {[
                ["Capital total",      mxnFmt(G.total.montoApl),       "#3d3525"],
                ["Intereses totales",  mxnFmt(G.total.interes),        "#c0392b"],
                ["Factibilidad",       mxnFmt(G.total.factTotal),      "#8e44ad"],
                ["FEGA",               mxnFmt(G.total.fegaTotal),      "#1a6ea8"],
                ["Asist. Técnica",     mxnFmt(G.total.asistBase),      "#2d5a1b"],
                ["Comisiones totales", mxnFmt(G.total.totalComisiones),"#856404"],
              ].map(([l,v,c])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #f0ece4"}}>
                  <span style={{fontSize:12,color:"#6a6050"}}>{l}</span>
                  <span style={{fontFamily:"monospace",fontWeight:600,fontSize:12,color:c}}>{v}</span>
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0 0",marginTop:4,borderTop:"2px solid #c0392b"}}>
                <span style={{fontWeight:700,fontSize:13}}>TOTAL A LIQUIDAR</span>
                <span style={{fontFamily:"monospace",fontWeight:700,fontSize:15,color:"#c0392b"}}>{mxnFmt(G.total.totalALiquidar)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla por productor */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Estado por Productor</div>
            <BtnExport onClick={()=>{
              const G = resumenGlobal();
              exportarExcel("Credito_Habilitacion_"+state.cicloActual,[{
                nombre:"Por Productor",
                headers:["Productor","Ha","Capital Para","Interés Para","Capital Dir","Interés Dir","Total Liquidar"],
                rows:(state.productores||[]).filter(p=>gastoTotalProd(p.id)>0||creditoParaProd(p.id)>0).map(p=>{
                  const cp=calcParafin(p.id); const cd=calcDirecto(p.id);
                  return [p.alias,haProd(p.id).toFixed(2),cp.montoApl,cp.interes,cd.montoApl,cd.interes,cp.totalALiquidar+cd.totalALiquidar];
                })
              }]);
            }}/>
          </div>
          <div className="table-wrap-scroll">
            <table style={{minWidth:950}}>
              <thead>
                <tr>
                  <th rowSpan={2}>Productor</th>
                  <th rowSpan={2} style={{textAlign:"right"}}>Ha</th>
                  <th colSpan={3} style={{textAlign:"center",background:"#dbeafe",color:"#1a6ea8"}}>🏦 Parafinanciero</th>
                  <th colSpan={3} style={{textAlign:"center",background:"#ede9fe",color:"#8e44ad"}}>💳 Crédito Directo</th>
                  <th rowSpan={2} style={{textAlign:"right",color:"#c0392b",fontWeight:700}}>Total a Liquidar</th>
                  <th rowSpan={2} style={{textAlign:"right",color:"#856404",fontWeight:700}}>$/ha</th>
                  <th rowSpan={2}></th>
                </tr>
                <tr>
                  <th style={{textAlign:"right",fontSize:10,background:"#f0f8ff"}}>Capital</th>
                  <th style={{textAlign:"right",fontSize:10,background:"#f0f8ff"}}>Interés+Com.</th>
                  <th style={{textAlign:"right",fontSize:10,background:"#f0f8ff"}}>Total</th>
                  <th style={{textAlign:"right",fontSize:10,background:"#faf5ff"}}>Capital</th>
                  <th style={{textAlign:"right",fontSize:10,background:"#faf5ff"}}>Interés+Com.</th>
                  <th style={{textAlign:"right",fontSize:10,background:"#faf5ff"}}>Total</th>
                </tr>
              </thead>
              <tbody>
                {productores.map((p,i)=>{
                  const gTot = gastoTotalProd(p.id);
                  const cPar = calcParafin(p.id);
                  const cDir = calcDirecto(p.id);
                  if (!gTot && !creditoParaProd(p.id)) return null;
                  const bg = i%2===0?"white":"#faf8f3";
                  const totalLiquidar = cPar.totalALiquidar + cDir.totalALiquidar;
                  return (
                    <tr key={p.id} style={{cursor:"pointer",transition:"filter 0.12s"}}
                      onMouseEnter={e=>e.currentTarget.style.filter="brightness(0.92)"}
                      onMouseLeave={e=>e.currentTarget.style.filter=""}
                      onClick={()=>{setProdSel(p.id);setVista("productor");}}>
                      <td style={{background:bg}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:colProd(p.id)}}/>
                          <span style={{fontWeight:600,fontSize:13}}>{p.alias||p.apPat}</span>
                        </div>
                      </td>
                      <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:12}}>{haProd(p.id)>0?haProd(p.id).toFixed(2):"—"}</td>
                      <td style={{background:"#f0f8ff",textAlign:"right",fontFamily:"monospace",fontSize:11,color:"#1a6ea8"}}>{cPar.montoApl>0?mxnFmt(cPar.montoApl):<span style={{color:"#e67e22",fontSize:10}}>⏳</span>}</td>
                      <td style={{background:"#f0f8ff",textAlign:"right",fontFamily:"monospace",fontSize:11,color:"#856404"}}>{cPar.montoApl>0?mxnFmt(cPar.interes+cPar.totalComisiones):"—"}</td>
                      <td style={{background:"#f0f8ff",textAlign:"right",fontFamily:"monospace",fontWeight:700,fontSize:11,color:"#1a6ea8"}}>{cPar.totalALiquidar>0?mxnFmt(cPar.totalALiquidar):"—"}</td>
                      <td style={{background:"#faf5ff",textAlign:"right",fontFamily:"monospace",fontSize:11,color:"#8e44ad"}}>{cDir.montoApl>0?mxnFmt(cDir.montoApl):"—"}</td>
                      <td style={{background:"#faf5ff",textAlign:"right",fontFamily:"monospace",fontSize:11,color:"#856404"}}>{cDir.montoApl>0?mxnFmt(cDir.interes+cDir.totalComisiones):"—"}</td>
                      <td style={{background:"#faf5ff",textAlign:"right",fontFamily:"monospace",fontWeight:700,fontSize:11,color:"#8e44ad"}}>{cDir.totalALiquidar>0?mxnFmt(cDir.totalALiquidar):"—"}</td>
                      <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:700,fontSize:12,color:"#c0392b"}}>{mxnFmt(totalLiquidar)}</td>
                      <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:11,color:"#856404",fontWeight:600}}>
                        {haProd(p.id)>0?mxnFmt(totalLiquidar/haProd(p.id)):"—"}
                      </td>
                      <td style={{background:bg}}>
                        <div style={{display:"flex",gap:4}}>
                          <button className="btn btn-sm btn-secondary" onClick={e=>{e.stopPropagation();setProdSel(p.id);setVista("productor");}}>Estado →</button>
                          <button className="btn btn-sm btn-secondary" style={{fontSize:10}} onClick={e=>{e.stopPropagation();nav("gastos",p.id);}} title="Ver egresos de este productor">Egresos</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                {(()=>{
                  const tots = productores.reduce((acc,p)=>{
                    const cPar = calcParafin(p.id);
                    const cDir = calcDirecto(p.id);
                    const ha = haProd(p.id);
                    const liq = cPar.totalALiquidar + cDir.totalALiquidar;
                    if(!liq && !creditoParaProd(p.id)) return acc;
                    return { ha: acc.ha+ha, liq: acc.liq+liq, paraCap: acc.paraCap+(cPar.montoApl||0), paraInt: acc.paraInt+(cPar.interes+cPar.totalComisiones), dirCap: acc.dirCap+(cDir.montoApl||0), dirInt: acc.dirInt+(cDir.interes+cDir.totalComisiones) };
                  }, {ha:0,liq:0,paraCap:0,paraInt:0,dirCap:0,dirInt:0});
                  return (
                    <tr style={{background:"#f0f4e8",fontWeight:700,fontSize:12}}>
                      <td style={{padding:"10px 14px"}}>TOTAL</td>
                      <td style={{textAlign:"right",fontFamily:"monospace"}}>{tots.ha.toFixed(2)}</td>
                      <td style={{textAlign:"right",fontFamily:"monospace",color:"#1a6ea8",background:"#e8f4ff"}}>{mxnFmt(tots.paraCap)}</td>
                      <td style={{textAlign:"right",fontFamily:"monospace",color:"#856404",background:"#e8f4ff"}}>{mxnFmt(tots.paraInt)}</td>
                      <td style={{textAlign:"right",fontFamily:"monospace",color:"#1a6ea8",background:"#e8f4ff"}}>{mxnFmt(tots.paraCap+tots.paraInt)}</td>
                      <td style={{textAlign:"right",fontFamily:"monospace",color:"#8e44ad",background:"#f3eeff"}}>{mxnFmt(tots.dirCap)}</td>
                      <td style={{textAlign:"right",fontFamily:"monospace",color:"#856404",background:"#f3eeff"}}>{mxnFmt(tots.dirInt)}</td>
                      <td style={{textAlign:"right",fontFamily:"monospace",color:"#8e44ad",background:"#f3eeff"}}>{mxnFmt(tots.dirCap+tots.dirInt)}</td>
                      <td style={{textAlign:"right",fontFamily:"monospace",color:"#c0392b",fontSize:13}}>{mxnFmt(tots.liq)}</td>
                      <td style={{textAlign:"right",fontFamily:"monospace",color:"#856404"}}>{tots.ha>0?mxnFmt(tots.liq/tots.ha):"—"}</td>
                      <td/>
                    </tr>
                  );
                })()}
              </tfoot>
            </table>
          </div>
        </div>

        {/* Modal parámetros */}
        {editParams&&(
          <Modal title="⚙️ Parámetros del Crédito" onClose={()=>setEditParams(false)}
            footer={<><button className="btn btn-secondary" onClick={()=>setEditParams(false)}>Cancelar</button><button className="btn btn-primary" onClick={guardarParams}>💾 Guardar</button></>}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <div style={{padding:"12px 14px",background:"#dbeafe22",borderRadius:8,border:"1px solid #1a6ea844"}}>
                <div style={{fontWeight:700,color:"#1a6ea8",marginBottom:10}}>🏦 Parafinanciero</div>
                {[["para_tasaAnual","Tasa interés mensual (%)"],["para_factibilidad","Factibilidad (% sobre crédito total)"],["para_fega","FEGA (%)"],["para_asistTec","Asistencia Técnica ($/ha)"]].map(([k,l])=>(
                  <div key={k} className="form-group" style={{marginBottom:8}}>
                    <label className="form-label" style={{fontSize:11}}>{l}</label>
                    <input className="form-input" type="number" step="0.01" value={formParams[k]||""} onChange={e=>setFormParams(f=>({...f,[k]:parseFloat(e.target.value)||0}))}/>
                  </div>
                ))}
              </div>
              <div style={{padding:"12px 14px",background:"#ede9fe22",borderRadius:8,border:"1px solid #8e44ad44"}}>
                <div style={{fontWeight:700,color:"#8e44ad",marginBottom:10}}>💳 Crédito Directo</div>
                {[["dir_tasaAnual","Tasa interés mensual (%)"],["dir_factibilidad","Factibilidad (% por dispersión)"],["dir_fega","FEGA (%)"]].map(([k,l])=>(
                  <div key={k} className="form-group" style={{marginBottom:8}}>
                    <label className="form-label" style={{fontSize:11}}>{l}</label>
                    <input className="form-input" type="number" step="0.01" value={formParams[k]||""} onChange={e=>setFormParams(f=>({...f,[k]:parseFloat(e.target.value)||0}))}/>
                  </div>
                ))}
              </div>
              <div className="form-group" style={{gridColumn:"1/-1"}}>
                <label className="form-label">IVA (%)</label>
                <input className="form-input" type="number" step="0.1" value={formParams.iva||""} onChange={e=>setFormParams(f=>({...f,iva:parseFloat(e.target.value)||0}))}/>
              </div>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // VISTA ESTADO DE CUENTA POR PRODUCTOR
  // ─────────────────────────────────────────────────────────────────────────────
  if (vista==="productor") {
    const p    = productores.find(x=>x.id===prodSel);
    if (!p) return <button className="btn btn-secondary" onClick={()=>setVista("consolidado")}>← Volver</button>;
    const exp  = expedientes.find(e=>e.productorId===p.id);
    const ha   = haProd(p.id);
    const cPar = calcParafin(p.id);
    const cDir = calcDirecto(p.id);
    const dispsP = dispsOrdenadas(p.id);
    // Sincronizar valor cuando cambia el productor
    // (editMontoPorHa y montoPorHaForm ya declarados arriba al nivel del componente)

    const guardarMontoPorHa = () => {
      const monto = parseFloat(montoPorHaForm);
      if (!monto || monto <= 0) return;
      const expActual = expedientes.find(e => e.productorId === p.id);
      dispatch({ type:"UPD_EXPEDIENTE", payload:{
        id: expActual?.id || p.id,
        productorId: p.id,
        montoPorHa: monto,
        // Asegurar arrays para no romper otros cases del reducer
        ministraciones: expActual?.ministraciones || [],
        pagos: expActual?.pagos || [],
        documentos: expActual?.documentos || [],
      }});
      setEditMontoPorHa(false);
    };

    const FilaDetalle = ({label, base, iva, total, color="#3d3525"}) => (
      <div style={{display:"grid",gridTemplateColumns:"1fr auto auto auto",gap:8,padding:"6px 0",borderBottom:"1px solid #f0ece4",alignItems:"center"}}>
        <span style={{fontSize:12,color:"#6a6050"}}>{label}</span>
        <span style={{fontFamily:"monospace",fontSize:11,color:"#8a8070",textAlign:"right"}}>{mxnFmt(base)}</span>
        <span style={{fontFamily:"monospace",fontSize:11,color:"#8a8070",textAlign:"right"}}>{iva>0?`+IVA ${mxnFmt(iva)}`:""}</span>
        <span style={{fontFamily:"monospace",fontWeight:700,fontSize:12,color,textAlign:"right",minWidth:110}}>{mxnFmt(total)}</span>
      </div>
    );

    return (
      <div>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
          <button className="btn btn-secondary" onClick={()=>setVista("consolidado")}>← Volver</button>
          <div style={{display:"flex",alignItems:"center",gap:8,flex:1}}>
            <div style={{width:12,height:12,borderRadius:"50%",background:colProd(p.id)}}/>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700}}>{p.alias||p.apPat}</div>
            <span style={{fontSize:11,padding:"3px 10px",borderRadius:10,background:"#f0f4e8",color:"#2d5a1b",fontWeight:600}}>
              {ha.toFixed(2)} ha
            </span>
          </div>
        </div>

        {/* Monto por ha */}
        <div className="card" style={{marginBottom:16}}>
          <div className="card-header">
            <div className="card-title">💰 Monto Parafinanciero por Ha</div>
            {puedeEditar&&!editMontoPorHa&&<button className="btn btn-sm btn-secondary" onClick={()=>setEditMontoPorHa(true)}>✏️ Editar</button>}
          </div>
          <div className="card-body">
            {editMontoPorHa?(
              <div style={{display:"flex",gap:10,alignItems:"flex-end"}}>
                <div className="form-group" style={{flex:1,marginBottom:0}}>
                  <label className="form-label">Monto autorizado por hectárea ($MXN)</label>
                  <input className="form-input" type="number" value={montoPorHaForm} onChange={e=>setMontoPorHaForm(e.target.value)} placeholder="Ej. 12000"/>
                </div>
                <button className="btn btn-primary" onClick={guardarMontoPorHa}>💾 Guardar</button>
                <button className="btn btn-secondary" onClick={()=>setEditMontoPorHa(false)}>✕</button>
              </div>
            ):(
              <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
                {[
                  ["Monto/ha autorizado", exp?.montoPorHa?`$${exp.montoPorHa.toLocaleString("es-MX")}/ha`:"⏳ Pendiente", exp?.montoPorHa?"#2d5a1b":"#e67e22"],
                  ["Crédito Parafinanciero total", exp?.montoPorHa?mxnFmt(cPar.creditoAut):"—", "#1a6ea8"],
                  ["Días transcurridos", cPar.fechaInicio?`${cPar.dias} días desde ${cPar.fechaInicio}`:"Sin dispersiones","#3d3525"],
                ].map(([l,v,c])=>(
                  <div key={l} style={{padding:"10px 14px",background:"#faf8f3",borderRadius:8,border:"1px solid #e8e0d0",minWidth:180}}>
                    <div style={{fontSize:10,color:"#8a8070",marginBottom:3}}>{l}</div>
                    <div style={{fontWeight:700,fontSize:13,color:c}}>{v}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Estado de cuenta — dos columnas */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>

          {/* PARAFINANCIERO */}
          <div className="card">
            <div style={{background:"#1a6ea8",padding:"10px 16px",color:"white",borderRadius:"8px 8px 0 0"}}>
              <div style={{fontWeight:700}}>🏦 Crédito Parafinanciero</div>
              {cPar.montoApl===0&&<div style={{fontSize:11,opacity:0.8}}>Sin monto/ha asignado — pendiente</div>}
            </div>
            <div style={{padding:"14px 16px"}}>
              {cPar.montoApl>0?(
                <>
                  <FilaDetalle label="Capital aplicado" base={cPar.montoApl} iva={0} total={cPar.montoApl} color="#1a6ea8"/>
                  <FilaDetalle label={`Interés ${params.para_tasaAnual}% mens. · ${cPar.dias} días`} base={cPar.interes} iva={0} total={cPar.interes} color="#c0392b"/>
                  <FilaDetalle label={`Factibilidad ${params.para_factibilidad}% s/crédito total`} base={cPar.factBase} iva={cPar.factIva} total={cPar.factTotal} color="#8e44ad"/>
                  <FilaDetalle label={`FEGA ${params.para_fega}% por dispersión`} base={cPar.fegaBase} iva={cPar.fegaIva} total={cPar.fegaTotal} color="#1a6ea8"/>
                  <FilaDetalle label={`Asist. Técnica $${params.para_asistTec}/ha × ${ha.toFixed(2)} ha`} base={cPar.asistBase} iva={0} total={cPar.asistBase} color="#2d5a1b"/>
                  <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0 4px",marginTop:6,borderTop:"2px solid #1a6ea8"}}>
                    <span style={{fontWeight:700}}>TOTAL A LIQUIDAR</span>
                    <span style={{fontFamily:"monospace",fontWeight:700,fontSize:15,color:"#1a6ea8"}}>{mxnFmt(cPar.totalALiquidar)}</span>
                  </div>
                </>
              ):(
                <div style={{padding:"20px 0",textAlign:"center",color:"#e67e22",fontSize:13}}>
                  ⏳ Captura el monto/ha para activar el cálculo
                </div>
              )}
            </div>
          </div>

          {/* DIRECTO */}
          <div className="card">
            <div style={{background:"#8e44ad",padding:"10px 16px",color:"white",borderRadius:"8px 8px 0 0"}}>
              <div style={{fontWeight:700}}>💳 Crédito Directo</div>
              <div style={{fontSize:11,opacity:0.8}}>{cDir.montoApl>0?`Capital: ${mxnFmt(cDir.montoApl)}`:"Todo el gasto está dentro del parafinanciero"}</div>
            </div>
            <div style={{padding:"14px 16px"}}>
              {cDir.montoApl>0?(
                <>
                  <FilaDetalle label="Capital aplicado (exceso sobre parafin.)" base={cDir.montoApl} iva={0} total={cDir.montoApl} color="#8e44ad"/>
                  <FilaDetalle label={`Interés ${params.dir_tasaAnual}% anual · ${cDir.dias} días`} base={cDir.interes} iva={0} total={cDir.interes} color="#c0392b"/>
                  <FilaDetalle label={`Factibilidad ${params.dir_factibilidad}% por dispersión`} base={cDir.factBase} iva={cDir.factIva} total={cDir.factTotal} color="#8e44ad"/>
                  <FilaDetalle label={`FEGA ${params.dir_fega}% por dispersión`} base={cDir.fegaBase} iva={cDir.fegaIva} total={cDir.fegaTotal} color="#1a6ea8"/>
                  <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0 4px",marginTop:6,borderTop:"2px solid #8e44ad"}}>
                    <span style={{fontWeight:700}}>TOTAL A LIQUIDAR</span>
                    <span style={{fontFamily:"monospace",fontWeight:700,fontSize:15,color:"#8e44ad"}}>{mxnFmt(cDir.totalALiquidar)}</span>
                  </div>
                </>
              ):(
                <div style={{padding:"20px 0",textAlign:"center",color:"#2d5a1b",fontSize:13}}>
                  ✅ Sin saldo en crédito directo
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Resumen total */}
        <div className="card" style={{marginBottom:16}}>
          <div className="card-body" style={{display:"flex",justifyContent:"space-around",flexWrap:"wrap",gap:12}}>
            {[
              ["Capital total",      mxnFmt(cPar.montoApl+cDir.montoApl),                                      "#3d3525"],
              ["Intereses totales",  mxnFmt(cPar.interes+cDir.interes),                                        "#c0392b"],
              ["Comisiones totales", mxnFmt(cPar.totalComisiones+cDir.totalComisiones),                        "#856404"],
              ["TOTAL A LIQUIDAR",   mxnFmt(cPar.totalALiquidar+cDir.totalALiquidar),                         "#c0392b"],
            ].map(([l,v,c])=>(
              <div key={l} style={{textAlign:"center",padding:"10px 20px",borderRadius:8,background:c==="#c0392b"?"#fff0f0":"#faf8f3",border:`1px solid ${c}33`}}>
                <div style={{fontSize:10,color:"#8a8070",marginBottom:3}}>{l}</div>
                <div style={{fontFamily:"monospace",fontWeight:700,fontSize:l==="TOTAL A LIQUIDAR"?16:13,color:c}}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Botón para mostrar tabla de desglose de intereses */}
        <div style={{textAlign:"center",marginBottom:12}}>
          <button className="btn btn-secondary" onClick={()=>setShowDesglose(v=>!v)}
            style={{fontSize:13,padding:"10px 24px",border:"1.5px solid #c0392b",color:"#c0392b",background:showDesglose?"#fff0f0":"white"}}>
            📋 {showDesglose?"Ocultar":"Ver"} Desglose de Intereses por Dispersión
          </button>
        </div>

        {/* Tabla de desglose de intereses por dispersión */}
        {showDesglose&&<div>

          {/* ── PARAFINANCIERO ── */}
          {cPar.montoApl>0&&<div className="card" style={{marginBottom:12}}>
            <div className="card-header" style={{background:"#e8f4fd"}}>
              <div className="card-title" style={{color:"#1a6ea8"}}>🏦 Crédito Parafinanciero — Interés por Dispersión</div>
              <div style={{fontSize:11,color:"#1a6ea8"}}>Tasa {params.para_tasaAnual}% mensual · ((Monto × Tasa%) / 30) × Días</div>
            </div>
            <div className="table-wrap-scroll">
              <table style={{minWidth:720}}>
                <thead><tr>
                  <th>Tipo / Concepto</th><th>Fecha</th>
                  <th style={{textAlign:"right"}}>Monto</th>
                  <th style={{textAlign:"right"}}>Días</th>
                  <th style={{textAlign:"right",color:"#c0392b"}}>Interés</th>
                  <th style={{textAlign:"right"}}>Factibilidad</th>
                  <th style={{textAlign:"right"}}>FEGA+IVA</th>
                  <th style={{textAlign:"right",color:"#c0392b",fontWeight:700}}>Total Cargo</th>
                </tr></thead>
                <tbody>
                  {(cPar.movimientos||[]).map((m,i)=>{
                    // FEGA para se muestra en total, no por fila (es sobre monto total)
                    const bg    = i%2===0?"white":"#f0f6fd";
                    return (
                      <tr key={m.id}>
                        <td style={{background:bg,fontSize:12}}>
                          <span style={{fontSize:10,padding:"2px 6px",borderRadius:6,background:
                            m.tipo==="Insumo"?"#f0f8e8":m.tipo==="Diesel"?"#fff3e0":m.tipo==="Efectivo"?"#fce4ec":"#e3f2fd",
                            color:m.tipo==="Insumo"?"#2d5a1b":m.tipo==="Diesel"?"#e65100":m.tipo==="Egreso"?"#9b1d1d":"#1565c0",
                            marginRight:6,fontWeight:600}}>
                            {m.tipo}
                          </span>
                          {m.concepto}
                        </td>
                        <td style={{background:bg,fontSize:12,color:"#5a7a3a"}}>{m.fecha||"—"}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:700}}>{mxnFmt(m.montoDisp)}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",color:"#5a7a3a",fontWeight:600}}>{m.diasD}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",color:"#c0392b",fontWeight:700}}>{mxnFmt(m.intDisp)}</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:11,color:"#856404"}}>—</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:11,color:"#8a8070"}}>—</td>
                        <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:700,color:"#c0392b"}}>{mxnFmt(m.intDisp)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{background:"#dbeafe",fontWeight:700}}>
                    <td colSpan={2} style={{padding:"8px 12px",color:"#1a6ea8"}}>
                      SUBTOTAL PARAFINANCIERO
                      <div style={{fontSize:10,fontWeight:400,color:"#5a8ab8"}}>+ Factibilidad {mxnFmt(cPar.factTotal)} (una sola vez)</div>
                      <div style={{fontSize:10,fontWeight:400,color:"#5a8ab8"}}>+ Asistencia Técnica {mxnFmt(cPar.asistBase)}</div>
                    </td>
                    <td style={{textAlign:"right",fontFamily:"monospace",color:"#1a6ea8"}}>{mxnFmt(cPar.montoApl)}</td>
                    <td/>
                    <td style={{textAlign:"right",fontFamily:"monospace",color:"#c0392b",fontWeight:700}}>{mxnFmt(cPar.interes)}</td>
                    <td style={{textAlign:"right",fontFamily:"monospace",color:"#856404"}}>{mxnFmt(cPar.factTotal)}</td>
                    <td style={{textAlign:"right",fontFamily:"monospace",color:"#1a6ea8"}}>{mxnFmt(cPar.fegaTotal)}</td>
                    <td style={{textAlign:"right",fontFamily:"monospace",color:"#c0392b",fontSize:14}}>{mxnFmt(cPar.totalALiquidar)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>}

          {/* ── DIRECTO — es el excedente del gasto sobre el parafinanciero ── */}
          {cDir.montoApl>0&&<div className="card" style={{marginBottom:12}}>
            <div className="card-header" style={{background:"#f3e8fd"}}>
              <div className="card-title" style={{color:"#8e44ad"}}>💳 Crédito Directo — Excedente sobre Parafinanciero</div>
              <div style={{fontSize:11,color:"#8e44ad"}}>
                Gasto total {mxnFmt(gastoTotalProd(p.id))} − Parafinanciero autorizado {mxnFmt(cPar.creditoAut)} = <strong>{mxnFmt(cDir.montoApl)}</strong>
              </div>
            </div>
            <div style={{padding:"14px 16px"}}>
              {/* Explicación */}
              <div style={{background:"#faf0ff",border:"1px solid #d7b8f5",borderRadius:8,padding:"12px 16px",marginBottom:12,fontSize:12}}>
                <div style={{fontWeight:600,color:"#8e44ad",marginBottom:6}}>¿Cómo se calcula el Crédito Directo?</div>
                <div style={{color:"#3d3525",lineHeight:1.6}}>
                  El monto directo es el gasto del productor que <strong>excede el tope parafinanciero</strong>.<br/>
                  El interés se calcula desde la <strong>primera dispersión</strong> del ciclo.<br/>
                  Fórmula: ((Monto directo × {params.dir_tasaAnual}%) / 30) × {cDir.dias} días = <strong style={{color:"#c0392b"}}>{mxnFmt(cDir.interes)}</strong>
                </div>
              </div>
              {/* Tabla de movimientos del excedente directo */}
              {(cDir.movimientos||[]).length>0&&(
                <div className="table-wrap-scroll" style={{marginBottom:12}}>
                  <table style={{minWidth:700}}>
                    <thead><tr>
                      <th>Tipo / Concepto</th><th>Fecha</th>
                      <th style={{textAlign:"right"}}>Monto Excedente</th>
                      <th style={{textAlign:"right"}}>Días</th>
                      <th style={{textAlign:"right",color:"#c0392b"}}>Interés</th>
                      <th style={{textAlign:"right"}}>Factibilidad+IVA</th>
                      <th style={{textAlign:"right"}}>FEGA+IVA</th>
                      <th style={{textAlign:"right",color:"#c0392b",fontWeight:700}}>Total Cargo</th>
                    </tr></thead>
                    <tbody>
                      {(cDir.movimientos||[]).map((m,i)=>{
                        const factD = m.montoDisp*(params.dir_factibilidad/100)*(1+params.iva/100);
                        const fegaD = ((m.montoDisp*m.diasD)/360)*(params.dir_fega/100)*(1+params.iva/100);
                        const bg    = i%2===0?"white":"#f5eeff";
                        return (
                          <tr key={m.id}>
                            <td style={{background:bg,fontSize:12}}>
                              <span style={{fontSize:10,padding:"2px 6px",borderRadius:6,background:
                                m.tipo==="Insumo"?"#f0f8e8":m.tipo==="Diesel"?"#fff3e0":m.tipo==="Efectivo"?"#fce4ec":"#e3f2fd",
                                color:m.tipo==="Insumo"?"#2d5a1b":m.tipo==="Diesel"?"#e65100":m.tipo==="Egreso"?"#9b1d1d":"#1565c0",
                                marginRight:6,fontWeight:600}}>
                                {m.tipo}
                              </span>
                              {m.concepto}
                            </td>
                            <td style={{background:bg,fontSize:12}}>{m.fecha||"—"}</td>
                            <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:700}}>{mxnFmt(m.montoDisp)}</td>
                            <td style={{background:bg,textAlign:"right",fontFamily:"monospace",color:"#5a7a3a",fontWeight:600}}>{m.diasD}</td>
                            <td style={{background:bg,textAlign:"right",fontFamily:"monospace",color:"#c0392b",fontWeight:700}}>{mxnFmt(m.intDisp)}</td>
                            <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:11,color:"#856404"}}>{mxnFmt(factD)}</td>
                            <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontSize:11,color:"#1a6ea8"}}>{mxnFmt(fegaD)}</td>
                            <td style={{background:bg,textAlign:"right",fontFamily:"monospace",fontWeight:700,color:"#c0392b"}}>{mxnFmt(m.intDisp+factD+fegaD)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{background:"#ede9fe",fontWeight:700}}>
                        <td colSpan={2} style={{padding:"8px 12px",color:"#8e44ad"}}>SUBTOTAL DIRECTO</td>
                        <td style={{textAlign:"right",fontFamily:"monospace"}}>{mxnFmt(cDir.montoApl)}</td>
                        <td/>
                        <td style={{textAlign:"right",fontFamily:"monospace",color:"#c0392b"}}>{mxnFmt(cDir.interes)}</td>
                        <td style={{textAlign:"right",fontFamily:"monospace",color:"#856404"}}>{mxnFmt(cDir.factTotal)}</td>
                        <td style={{textAlign:"right",fontFamily:"monospace",color:"#1a6ea8"}}>{mxnFmt(cDir.fegaTotal)}</td>
                        <td style={{textAlign:"right",fontFamily:"monospace",color:"#c0392b",fontSize:14}}>{mxnFmt(cDir.totalALiquidar)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>}

          {/* ── GRAN TOTAL ── */}
          <div className="card" style={{background:"#fff0f0",border:"2px solid #c0392b",marginBottom:16}}>
            <div className="card-body" style={{display:"flex",justifyContent:"space-around",flexWrap:"wrap",gap:12,padding:"16px"}}>
              {[
                ["Capital total",          mxnFmt(cPar.montoApl+cDir.montoApl),             "#3d3525"],
                ["Interés total",          mxnFmt(cPar.interes+cDir.interes),               "#c0392b"],
                ["Factibilidad+IVA",       mxnFmt(cPar.factTotal+cDir.factTotal),           "#856404"],
                ["FEGA+IVA",               mxnFmt(cPar.fegaTotal+cDir.fegaTotal),           "#1a6ea8"],
                ["Asistencia Técnica",     mxnFmt(cPar.asistBase),                           "#2d5a1b"],
                ["TOTAL A LIQUIDAR",       mxnFmt(cPar.totalALiquidar+cDir.totalALiquidar), "#c0392b"],
              ].map(([l,v,c])=>(
                <div key={l} style={{textAlign:"center",padding:"10px 16px",borderRadius:8,background:"white",border:`1px solid ${c}33`}}>
                  <div style={{fontSize:10,color:"#8a8070",marginBottom:3}}>{l}</div>
                  <div style={{fontFamily:"monospace",fontWeight:700,fontSize:l==="TOTAL A LIQUIDAR"?16:13,color:c}}>{v}</div>
                </div>
              ))}
            </div>
          </div>

        </div>}
      </div>
    );
  }

  return null;
}
