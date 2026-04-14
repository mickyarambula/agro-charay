// ─── modules/Productores.jsx ───────────────────────────────────────────

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


export default function ProductoresModule({ userRol, puedeEditar, onNavigate }) {
  const { state, dispatch } = useData();
  const isMobile = useIsMobile();
  const nav = (page, pid, filtros) => onNavigate && onNavigate(page, pid, filtros);
  const [modo, setModo]     = useState("lista");
  const [sel, setSel]       = useState(null);
  const [editando, setEditando] = useState(false);
  const [modoImpresion, setModoImpresion] = useState(false);

  const emptyForm = {
    tipo:"resico", apPat:"", apMat:"", nombres:"", alias:"",
    rfc:"", curp:"", telefono:"", correo:"",
    color: PROD_COLORES[0], notas:"",
  };
  const [form, setForm] = useState(emptyForm);

  const [filtroEstado, setFiltroEstado] = useState("todos"); // todos | activos | inactivos

  const productores  = state.productores || [];
  const totalHa      = (((state.ciclos||[]).find(c=>c.id===state.cicloActivoId)||(state.ciclos||[]).find(c=>c.predeterminado))?.asignaciones||[]).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);
  const totalCred    = (state.expedientes||[]).reduce((s,e)=>s+(e.montoAutorizado||0),0);

  // Ciclo predeterminado para calcular ha y lotes por productor
  const cicloPred = (state.ciclos||[]).find(c=>c.id===state.cicloActivoId)||(state.ciclos||[]).find(c=>c.id===state.cicloActivoId)||(state.ciclos||[]).find(c=>c.predeterminado)||(state.ciclos||[])[0];
  const asigsCiclo = (cicloPred?.asignaciones||[]).filter(a=>
    !state.cultivoActivo||(a.cultivoId===state.cultivoActivo.cultivoId&&a.variedad===state.cultivoActivo.variedad)
  );

  const haProductor    = (id) => asigsCiclo
    .filter(a => String(a.productorId) === String(id))
    .reduce((s,a) => s + (parseFloat(a.supAsignada)||0), 0);
  const lotesProductor = (id) => asigsCiclo
    .filter(a => String(a.productorId) === String(id)).length;
  const credProductor  = (id) => {
    const exp = (state.expedientes||[]).find(e=>e.id===id||e.productorId===id);
    return exp ? (exp.montoAutorizado||0) : 0;
  };

  const abrirForm = (p=null) => {
    if (p) {
      setForm({
        tipo:     p.tipo||"resico",
        apPat:    p.apPat||"",
        apMat:    p.apMat||"",
        nombres:  p.nombres||"",
        alias:    p.alias||"",
        rfc:      p.rfc||"",
        curp:     p.curp||"",
        telefono: p.telefono||"",
        correo:   p.correo||"",
        color:    p.color||PROD_COLORES[0],
        notas:    p.notas||"",
      });
      setEditando(true);
    } else {
      setForm({...emptyForm, color: PROD_COLORES[productores.length % PROD_COLORES.length]});
      setEditando(false);
    }
    setModo("form");
  };

  const guardar = () => {
    const esMoral = form.tipo === "moral";
    if (esMoral && !form.nombres.trim()) return;
    if (!esMoral && (!form.apPat.trim() || !form.nombres.trim())) return;
    const payload = {
      tipo:     form.tipo,
      apPat:    esMoral ? "" : form.apPat.trim(),
      apMat:    esMoral ? "" : form.apMat.trim(),
      nombres:  form.nombres.trim(),
      alias:    form.alias.trim() || form.apPat.trim() || form.nombres.trim(),
      rfc:      form.rfc.trim(),
      curp:     esMoral ? "" : form.curp.trim(),
      telefono: form.telefono.trim(),
      correo:   form.correo.trim(),
      color:    form.color,
      notas:    form.notas.trim(),
      // compatibilidad con resto del sistema
      nombre:   form.nombres.trim(),
      ha:       haProductor(sel?.id||0),
      montoCred:credProductor(sel?.id||0),
      zonas:    [],
    };
    if (editando && sel) {
      dispatch({ type:"UPD_PRODUCTOR", payload:{...sel,...payload} });
    } else {
      dispatch({ type:"ADD_PRODUCTOR", payload });
    }
    setModo("lista"); setSel(null); setForm(emptyForm);
  };

  const F = (label, key, type="text", upper=false) => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input className="form-input" type={type}
        value={form[key]}
        onChange={e => {
          const v = upper ? e.target.value.toUpperCase() : e.target.value;
          setForm(f=>({...f,[key]:v}));
        }}
        style={key==="rfc"||key==="curp" ? {fontFamily:"'DM Mono',monospace",letterSpacing:"0.04em"} : {}}
      />
    </div>
  );

  const TipoBadge = ({tipo}) => tipo==="moral"
    ? <span className="badge badge-blue">🏢 Moral</span>
    : <span className="badge badge-gray">👤 RESICO</span>;

  // ── DETALLE ────────────────────────────────────────────────────────────────
  if (modo === "detalle" && sel) {
    const p    = productores.find(x=>x.id===sel.id) || sel;
    const cnt  = lotesProductor(p.id);
    const mxnFmt = n => (parseFloat(n)||0).toLocaleString("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:2,maximumFractionDigits:2});
    const fmt2   = n => (parseFloat(n)||0).toFixed(2);

    // ── Todos los cálculos desde fuente única de verdad ───────────────────────
    const D = calcularCreditoProd(p.id, state);
    const { ha, tSem:totalSemilla, tIns:totalInsumos, tDie:totalDiesel, tEfe:totalEfectivo,
      tGas:totalGastos, tDis:totalDisp, credAut:creditoAut, iP:intPara, iD:intDir,
      cP:comPara, cD:comDir, totalInt, totalCom, tLiq:totalLiquidar, xha,
      diasCred, dispsSorted, saldoDisp, params, lotesP, catEgr } = D;


    // ── Vista de impresión ────────────────────────────────────────────────────
    if (modoImpresion) {
      const _cid  = state.cicloActivoId||1;
      const ciclo = (state.ciclos||[]).find(c=>c.id===_cid);
      const hoy   = new Date().toLocaleDateString("es-MX",{day:"2-digit",month:"long",year:"numeric"});
      const Row = ({label, valor, bold, indent, color}) => valor>0 ? (
        <tr style={{background:bold?"#f5f5f5":"white"}}>
          <td style={{padding:`6px ${indent?24:12}px`,fontSize:12,color:bold?"#222":"#555",fontWeight:bold?700:400}}>
            {label}
          </td>
          <td style={{padding:"6px 12px",textAlign:"right",fontFamily:"monospace",fontSize:12,fontWeight:bold?700:500,color:color||(bold?"#222":"#444")}}>
            {mxnFmt(valor)}
          </td>
        </tr>
      ) : null;

      return (
        <div>
          <style>{`
            @media print {
              .no-print { display: none !important; }
              .print-page { box-shadow: none !important; margin: 0 !important; padding: 0 !important; }
              body { background: white !important; }
            }
          `}</style>

          {/* Barra de acciones — solo pantalla */}
          <div className="no-print" style={{display:"flex",gap:10,alignItems:"center",marginBottom:16,padding:"10px 16px",background:"#f0f7ec",borderRadius:8,border:"1px solid #4a8c2a33"}}>
            <span style={{fontSize:13,fontWeight:600,color:"#2d5a1b",flex:1}}>
              Vista de impresión — {p.alias||p.apPat}
            </span>
            <button className="btn btn-primary" onClick={()=>descargarHTML(`EstadoCuenta_${p.alias||p.apPat}`, generarHTMLProductor(p, {...D, totalDisp:D.tDis, totalSemilla:D.tSem, totalInsumos:D.tIns, totalDiesel:D.tDie, totalEfectivo:D.tEfe, totalGastos:D.tGas, intPara:D.iP, intDir:D.iD, comPara:D.cP, comDir:D.cD, totalLiquidar:D.tLiq, creditoAut:D.credAut, disP:D.dispsSorted}, state))}
              style={{background:"#1a6ea8",border:"none",color:"white",fontWeight:700}}>
              📄 Descargar HTML (abre y Ctrl+P para PDF)
            </button>
            <button className="btn btn-secondary" onClick={()=>setModoImpresion(false)}>
              ✕ Cerrar vista
            </button>
          </div>

          {/* Documento imprimible */}
          <div className="print-page" style={{background:"white",maxWidth:800,margin:"0 auto",padding:24,
            boxShadow:"0 2px 20px rgba(0,0,0,0.12)",borderRadius:8,fontFamily:"Arial,sans-serif"}}>

            {/* Encabezado */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",
              marginBottom:20,paddingBottom:16,borderBottom:"3px solid #2d5a1b"}}>
              <div>
                <div style={{fontSize:22,fontWeight:800,color:"#2d5a1b"}}>AgroSistema Charay</div>
                <div style={{fontSize:11,color:"#888",marginTop:2}}>Control Agrícola Integral · {ciclo?.nombre||state.cicloActual}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:700,fontSize:15}}>ESTADO DE CUENTA</div>
                <div style={{fontSize:11,color:"#888"}}>Fecha: {hoy}</div>
                <div style={{fontSize:11,color:"#888"}}>Ciclo: {ciclo?.nombre||state.cicloActual}</div>
              </div>
            </div>

            {/* Datos del productor */}
            <div style={{background:"#f0f7ec",borderLeft:"4px solid #2d5a1b",padding:"12px 16px",marginBottom:20,borderRadius:4}}>
              <div style={{fontSize:18,fontWeight:700,color:"#2d5a1b"}}>{p.alias||p.apPat}</div>
              <div style={{fontSize:11,color:"#666",marginTop:3}}>
                {[p.nombres,p.apPat,p.apMat].filter(Boolean).join(" ")} &nbsp;·&nbsp; RFC: {p.rfc||"—"} &nbsp;·&nbsp; Tel: {p.telefono||"—"}
              </div>
            </div>

            {/* KPIs */}
            <div style={{display:"grid",gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5,1fr)",gap:8,marginBottom:20}}>
              {[
                ["Hectáreas",        fmt2(ha)+" ha",       "#2d5a1b"],
                ["Dispersado",       mxnFmt(totalDisp),    "#1a6ea8"],
                ["Gasto Operativo",  mxnFmt(totalGastos),  "#c0392b"],
                ["Int.+Comisiones",  mxnFmt(totalInt+totalCom), "#9b6d3a"],
                ["Total a Liquidar", mxnFmt(totalLiquidar),"#c0392b"],
              ].map(([l,v,c])=>(
                <div key={l} style={{background:"#f9f9f9",border:"1px solid #e0e0e0",borderRadius:6,padding:"8px 10px",textAlign:"center"}}>
                  <div style={{fontSize:9,color:"#888",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:3}}>{l}</div>
                  <div style={{fontFamily:"monospace",fontSize:13,fontWeight:700,color:c}}>{v}</div>
                </div>
              ))}
            </div>

            {/* Estado de Cuenta */}
            <div style={{fontSize:13,fontWeight:700,color:"#2d5a1b",margin:"16px 0 8px",paddingBottom:4,borderBottom:"1px solid #c8e0c8"}}>
              📋 Estado de Cuenta Detallado
            </div>
            <table style={{width:"100%",borderCollapse:"collapse",marginBottom:16}}>
              <colgroup><col style={{width:"65%"}}/><col style={{width:"35%"}}/></colgroup>
              <tbody>
                <Row label="🏦 Crédito autorizado"            valor={creditoAut}   color="#1a6ea8"/>
                <Row label="💰 Total dispersado"              valor={totalDisp}    color="#2d5a1b"/>
                <tr><td colSpan={2} style={{height:4,background:"#f5f5f5"}}></td></tr>
                <Row label="🌽 Semilla"                       valor={totalSemilla} indent/>
                <Row label="🌿 Insumos (fertilizantes/agroquímicos)" valor={totalInsumos} indent/>
                <Row label="⛽ Diesel y combustible"           valor={totalDiesel}  indent/>
                {totalEfectivo>0&&<Row label="💵 Efectivo / otros gastos" valor={totalEfectivo} indent/>}
                <Row label="Subtotal gasto operativo"         valor={totalGastos}  bold color="#c0392b"/>
                <tr><td colSpan={2} style={{height:4,background:"#f5f5f5"}}></td></tr>
                {intPara>0&&<Row label={`📈 Interés parafinanciero (${params.para_tasaAnual}% mensual · ${diasCred} días)`} valor={intPara} indent/>}
                {intDir>0&&<Row label={`📈 Interés directo (${params.dir_tasaAnual}% mensual · ${diasCred} días)`} valor={intDir} indent/>}
                {comPara>0&&<Row label="🏷 Comisiones parafinanciero" valor={comPara} indent/>}
                {comDir>0&&<Row label="🏷 Comisiones crédito directo" valor={comDir} indent/>}
                <Row label="Subtotal financiero"              valor={totalInt+totalCom} bold color="#9b6d3a"/>
                <tr><td colSpan={2} style={{height:4,background:"#f5f5f5"}}></td></tr>
                <tr style={{background:"#fdf0ef"}}>
                  <td style={{padding:"10px 12px",fontSize:14,fontWeight:800,color:"#c0392b"}}>TOTAL A LIQUIDAR</td>
                  <td style={{padding:"10px 12px",textAlign:"right",fontFamily:"monospace",fontSize:15,fontWeight:800,color:"#c0392b"}}>{mxnFmt(totalLiquidar)}</td>
                </tr>
                <tr>
                  <td style={{padding:"6px 12px",fontSize:11,color:"#888"}}>Costo total por hectárea</td>
                  <td style={{padding:"6px 12px",textAlign:"right",fontFamily:"monospace",fontSize:11,color:"#888"}}>{mxnFmt(xha)}/ha</td>
                </tr>
                {saldoDisp>0&&<tr>
                  <td style={{padding:"6px 12px",fontSize:11,color:"#2d5a1b"}}>Saldo disponible del crédito</td>
                  <td style={{padding:"6px 12px",textAlign:"right",fontFamily:"monospace",fontSize:11,color:"#2d5a1b"}}>{mxnFmt(saldoDisp)}</td>
                </tr>}
              </tbody>
            </table>

            {/* Dispersiones */}
            {dispsSorted.length>0&&<>
              <div style={{fontSize:13,fontWeight:700,color:"#2d5a1b",margin:"16px 0 8px",paddingBottom:4,borderBottom:"1px solid #c8e0c8"}}>
                🏦 Dispersiones de Crédito
              </div>
              <table style={{width:"100%",borderCollapse:"collapse",marginBottom:16}}>
                <thead>
                  <tr style={{background:"#2d5a1b",color:"white",fontSize:11}}>
                    {["Fecha","Línea","# Solicitud","Monto","Días","Interés acum."].map((h,i)=>(
                      <th key={h} style={{padding:"7px 10px",textAlign:i>=3?"right":"left"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dispsSorted.map((d,i)=>{
                    const dias2 = Math.max(0,Math.round((new Date()-new Date(d.fecha))/86400000));
                    const m = parseFloat(d.monto)||0;
                    const isPara = d.lineaCredito==="parafinanciero";
                    const intD = m*((isPara?params.para_tasaAnual:params.dir_tasaAnual)/100)/30*dias2;
                    return (
                      <tr key={d.id} style={{background:i%2===0?"white":"#fafafa"}}>
                        <td style={{padding:"6px 10px",fontFamily:"monospace",fontSize:11}}>{d.fecha||"—"}</td>
                        <td style={{padding:"6px 10px"}}>
                          <span style={{padding:"2px 6px",borderRadius:8,fontSize:10,fontWeight:700,
                            background:isPara?"#dbeafe":"#ede9fe",color:isPara?"#1a6ea8":"#8e44ad"}}>
                            {isPara?"Parafinanciero":"Directo"}
                          </span>
                        </td>
                        <td style={{padding:"6px 10px",fontFamily:"monospace",fontSize:11,color:"#888"}}>{d.numSolicitud||"—"}</td>
                        <td style={{padding:"6px 10px",textAlign:"right",fontFamily:"monospace",fontWeight:700,color:"#2d5a1b"}}>{mxnFmt(m)}</td>
                        <td style={{padding:"6px 10px",textAlign:"right",fontFamily:"monospace",fontSize:11}}>{dias2}</td>
                        <td style={{padding:"6px 10px",textAlign:"right",fontFamily:"monospace",color:"#c0392b"}}>{mxnFmt(intD)}</td>
                      </tr>
                    );
                  })}
                  <tr style={{background:"#f0f7ec",fontWeight:700,borderTop:"2px solid #2d5a1b"}}>
                    <td colSpan={3} style={{padding:"7px 10px",fontSize:12}}>TOTAL</td>
                    <td style={{padding:"7px 10px",textAlign:"right",fontFamily:"monospace",color:"#2d5a1b"}}>{mxnFmt(totalDisp)}</td>
                    <td/>
                    <td style={{padding:"7px 10px",textAlign:"right",fontFamily:"monospace",color:"#c0392b"}}>{mxnFmt(totalInt)}</td>
                  </tr>
                </tbody>
              </table>
            </>}

            {/* Lotes */}
            {lotesP.length>0&&<>
              <div style={{fontSize:13,fontWeight:700,color:"#2d5a1b",margin:"16px 0 8px",paddingBottom:4,borderBottom:"1px solid #c8e0c8"}}>
                🗺 Lotes Asignados
              </div>
              <table style={{width:"100%",borderCollapse:"collapse",marginBottom:16}}>
                <thead>
                  <tr style={{background:"#2d5a1b",color:"white",fontSize:11}}>
                    {["Apodo/Módulo","Propietario","Ejido","Ha Crédito","Ha Módulo"].map((h,i)=>(
                      <th key={h} style={{padding:"7px 10px",textAlign:i>=3?"right":"left"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lotesP.map((l,i)=>(
                    <tr key={l.id} style={{background:i%2===0?"white":"#fafafa"}}>
                      <td style={{padding:"6px 10px",fontWeight:600}}>{l.apodo||"—"}</td>
                      <td style={{padding:"6px 10px",fontSize:11,color:"#666"}}>{l.propietario||"—"}</td>
                      <td style={{padding:"6px 10px",fontSize:11,color:"#666"}}>{l.ejido||"—"}</td>
                      <td style={{padding:"6px 10px",textAlign:"right",fontFamily:"monospace",fontWeight:700,color:"#1a6ea8"}}>{fmt2(l.supCredito)} ha</td>
                      <td style={{padding:"6px 10px",textAlign:"right",fontFamily:"monospace",color:"#888"}}>{fmt2(l.supModulo)} ha</td>
                    </tr>
                  ))}
                  <tr style={{background:"#f0f7ec",fontWeight:700,borderTop:"2px solid #2d5a1b"}}>
                    <td colSpan={3} style={{padding:"7px 10px",fontSize:12}}>TOTAL</td>
                    <td style={{padding:"7px 10px",textAlign:"right",fontFamily:"monospace",color:"#1a6ea8"}}>{fmt2(ha)} ha</td>
                    <td/>
                  </tr>
                </tbody>
              </table>
            </>}

            {/* Firmas */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:60,marginTop:50}}>
              {[
                [`${[p.nombres,p.apPat,p.apMat].filter(Boolean).join(" ")||p.alias}`, `Productor · RFC: ${p.rfc||"—"}`],
                ["Representante AGROFRAGA", "Concepción de Charay, El Fuerte, Sinaloa"],
              ].map(([nombre,cargo])=>(
                <div key={nombre} style={{textAlign:"center"}}>
                  <div style={{borderTop:"1px solid #333",paddingTop:6,marginTop:50}}>
                    <div style={{fontWeight:600,fontSize:12}}>{nombre}</div>
                    <div style={{fontSize:11,color:"#666",marginTop:2}}>{cargo}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{marginTop:24,paddingTop:10,borderTop:"1px solid #e0e0e0",
              fontSize:10,color:"#aaa",textAlign:"center"}}>
              Generado el {hoy} · AgroSistema Charay · {ciclo?.nombre||state.cicloActual} · Documento informativo sujeto a verificación contable.
            </div>
          </div>
        </div>
      );
    }

    return (
      <div>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
          <button className="btn btn-secondary" onClick={()=>{setModo("lista");setSel(null);}}>← Volver</button>
          <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:p.color||T.field,
              display:"flex",alignItems:"center",justifyContent:"center",
              color:"white",fontWeight:800,fontSize:16,flexShrink:0}}>
              {(p.alias||p.apPat||"?")[0]}
            </div>
            <div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,lineHeight:1.2}}>
                {p.alias||p.apPat}
              </div>
              <div style={{fontSize:11,color:T.fog}}>{nomCompleto(p)} · {p.rfc||"Sin RFC"}</div>
            </div>
            <TipoBadge tipo={p.tipo} />
          </div>
          {puedeEditar && (
            <div style={{display:"flex",gap:8}}>
              <button className="btn btn-secondary btn-sm" onClick={()=>{setSel(p);abrirForm(p);}}>✏️ Editar</button>
            </div>
          )}
          <div style={{display:"flex",gap:8}}>
            <button className="btn btn-secondary btn-sm"
              onClick={()=>exportarExcelProductor(p, {...D, totalDisp:D.tDis, totalSemilla:D.tSem, totalInsumos:D.tIns, totalDiesel:D.tDie, totalEfectivo:D.tEfe, totalGastos:D.tGas, intPara:D.iP, intDir:D.iD, comPara:D.cP, comDir:D.cD, totalLiquidar:D.tLiq, creditoAut:D.credAut, disP:D.dispsSorted}, state)}
              style={{background:"#2d5a1b",color:"white",border:"none",fontWeight:600}}>
              📥 Excel
            </button>
            <button className="btn btn-secondary btn-sm"
              onClick={()=>setModoImpresion(v=>!v)}
              style={{background:"#1a6ea8",color:"white",border:"none",fontWeight:600}}>
              {modoImpresion ? "✕ Cerrar vista" : "🖨 Ver para imprimir"}
            </button>
            <button className="btn btn-secondary btn-sm"
              onClick={()=>descargarHTML(`EstadoCuenta_${p.alias||p.apPat}`, generarHTMLProductor(p, {...D, totalDisp:D.tDis, totalSemilla:D.tSem, totalInsumos:D.tIns, totalDiesel:D.tDie, totalEfectivo:D.tEfe, totalGastos:D.tGas, intPara:D.iP, intDir:D.iD, comPara:D.cP, comDir:D.cD, totalLiquidar:D.tLiq, creditoAut:D.credAut, disP:D.dispsSorted}, state))}
              style={{background:"#8e44ad",color:"white",border:"none",fontWeight:600}}>
              📄 Descargar HTML
            </button>
          </div>
        </div>

        {/* KPIs principales */}
        <div className="stat-grid" style={{gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5,1fr)",marginBottom:16}}>
          <div className="stat-card green" style={{cursor:"pointer"}} onClick={()=>nav("lotes")} title="→ Lotes">
            <div className="stat-icon">🌾</div><div className="stat-label">Hectáreas</div>
            <div className="stat-value">{ha.toFixed(2)} ha</div>
            <div className="stat-sub">{cnt} lotes <span style={{fontSize:9,opacity:0.6}}>→</span></div>
          </div>
          <div className="stat-card sky" style={{cursor:"pointer"}} onClick={()=>nav("gastos",p.id,{vista:"dispersiones",prodId:String(p.id)})} title="→ Egresos dispersiones">
            <div className="stat-icon">🏦</div><div className="stat-label">Dispersado</div>
            <div className="stat-value" style={{fontSize:14}}>{mxnFmt(totalDisp)}</div>
            <div className="stat-sub">{dispsSorted.length} dispersiones <span style={{fontSize:9,opacity:0.6}}>→</span></div>
          </div>
          <div className="stat-card rust" style={{cursor:"pointer"}} onClick={()=>nav("gastos",p.id,{prodId:String(p.id)})} title="→ Egresos">
            <div className="stat-icon">💸</div><div className="stat-label">Gasto Operativo</div>
            <div className="stat-value" style={{fontSize:14}}>{mxnFmt(totalGastos)}</div>
            <div className="stat-sub">{mxnFmt(ha>0?totalGastos/ha:0)}/ha <span style={{fontSize:9,opacity:0.6}}>→</span></div>
          </div>
          <div className="stat-card gold" style={{cursor:"pointer"}} onClick={()=>nav("credito",p.id,{vista:"productor",prodId:p.id})} title="→ Crédito">
            <div className="stat-icon">📈</div><div className="stat-label">Intereses + Com.</div>
            <div className="stat-value" style={{fontSize:14}}>{mxnFmt(totalInt+totalCom)}</div>
            <div className="stat-sub">{diasCred} días <span style={{fontSize:9,opacity:0.6}}>→</span></div>
          </div>
          <div className="stat-card" style={{borderLeft:`4px solid ${totalLiquidar>creditoAut*1.1?"#c0392b":T.field}`,cursor:"pointer"}}
            onClick={()=>nav("credito",p.id,{vista:"productor",prodId:p.id})} title="→ Crédito estado de cuenta">
            <div className="stat-icon">⚖️</div><div className="stat-label">Total a Liquidar</div>
            <div className="stat-value" style={{fontSize:14,color:"#c0392b"}}>{mxnFmt(totalLiquidar)}</div>
            <div className="stat-sub">{mxnFmt(xha)}/ha <span style={{fontSize:9,opacity:0.6}}>→</span></div>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
          {/* Estado de cuenta */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">📋 Estado de Cuenta</div>
              <span style={{fontSize:11,color:T.fog}}>Ciclo {state.cicloActual}</span>
            </div>
            <div className="card-body" style={{padding:0}}>
              {[
                {l:"🏦 Crédito autorizado",    v:creditoAut,        c:"#1a6ea8", mod:null},
                {l:"💰 Total dispersado",       v:totalDisp,         c:"#2d5a1b", mod:"gastos",  pid:p.id, filtros:{vista:"dispersiones", prodId:String(p.id)}},
                {sep:true},
                {l:"🌽 Semilla",                v:totalSemilla,      c:T.fog,     mod:"insumos", pid:p.id, filtros:{categoria:"Semilla",vista:"tabla",productor:String(p.id)},   indent:true},
                {l:"🌿 Insumos (sin semilla)",  v:totalInsumos,      c:T.fog,     mod:"insumos", pid:p.id, filtros:{categoria:"Fertilizante",vista:"tabla",productor:String(p.id)}, indent:true},
                {l:"⛽ Diesel",                  v:totalDiesel,       c:T.fog,     mod:"diesel",  pid:p.id, filtros:{productor:String(p.id),vista:"tabla"}, indent:true},
                {l:"💵 Efectivo/otros",          v:totalEfectivo,     c:T.fog,     mod:"gastos",  pid:p.id, filtros:{prodId:String(p.id)}, indent:true},
                {l:"Subtotal operativo",         v:totalGastos,       c:"#c0392b", mod:"gastos",  pid:p.id, filtros:{prodId:String(p.id)}, bold:true},
                {sep:true},
                {l:"📈 Intereses parafinanciero",v:intPara,           c:"#9b6d3a", mod:"credito", pid:p.id, filtros:{vista:"productor",prodId:p.id}, indent:true},
                {l:"📈 Intereses directo",        v:intDir,            c:"#9b6d3a", mod:"credito", pid:p.id, filtros:{vista:"productor",prodId:p.id}, indent:true},
                {l:"🏷 Comisiones parafinanciero",v:comPara,           c:"#9b6d3a", mod:"credito", pid:p.id, filtros:{vista:"productor",prodId:p.id}, indent:true},
                {l:"🏷 Comisiones directo",       v:comDir,            c:"#9b6d3a", mod:"credito", pid:p.id, filtros:{vista:"productor",prodId:p.id}, indent:true},
                {l:"Subtotal financiero",         v:totalInt+totalCom, c:"#9b6d3a", mod:"credito", pid:p.id, filtros:{vista:"productor",prodId:p.id}, bold:true},
                {sep:true},
                {l:"TOTAL A LIQUIDAR",            v:totalLiquidar,     c:"#c0392b", mod:"credito", pid:p.id, filtros:{vista:"productor",prodId:p.id}, bold:true, big:true},
                {l:"Saldo dispersado disponible", v:Math.max(0,saldoDisp), c:"#2d5a1b", mod:null},
              ].map((r,i)=> r.sep ? (
                <div key={i} style={{height:1,background:T.line,margin:"2px 0"}}/>
              ) : (
                <div key={r.l}
                  onClick={r.mod&&r.v>0 ? ()=>nav(r.mod, r.pid||null, r.filtros||null) : undefined}
                  style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                    padding:`${r.big?"10px":"7px"} 16px`,
                    background:r.big?"#fdf0ef":"transparent",
                    cursor:r.mod&&r.v>0?"pointer":"default",
                    transition:"filter 0.12s"}}
                  onMouseEnter={r.mod&&r.v>0 ? e=>{e.currentTarget.style.filter="brightness(0.93)";} : undefined}
                  onMouseLeave={r.mod&&r.v>0 ? e=>{e.currentTarget.style.filter="";} : undefined}
                  title={r.mod&&r.v>0 ? `→ Ver en ${r.mod}` : ""}>
                  <span style={{fontSize:r.big?13:12,color:r.bold?T.inkLt:T.fog,
                    fontWeight:r.bold?700:400,paddingLeft:r.indent?12:0,display:"flex",alignItems:"center",gap:4}}>
                    {r.l}
                    {r.mod&&r.v>0 && <span style={{fontSize:9,color:T.field,opacity:0.7}}>→</span>}
                  </span>
                  <span style={{fontFamily:"monospace",fontSize:r.big?14:12,
                    fontWeight:r.bold?700:500,color:r.v>0?r.c:T.fog}}>
                    {r.v>0?mxnFmt(r.v):"—"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {/* Desglose gastos por categoría */}
            <div className="card">
              <div className="card-header"><div className="card-title">📊 Gasto por Categoría</div></div>
              <div className="card-body" style={{padding:"10px 16px"}}>
                {[
                  ["🌽 Semilla",    totalSemilla,  "#c8a84b", "insumos", {categoria:"Semilla",       vista:"tabla", productor:String(p.id)}],
                  ["🌿 Insumos",    totalInsumos,  "#2d5a1b", "insumos", {categoria:"Fertilizante",  vista:"tabla", productor:String(p.id)}],
                  ["⛽ Diesel",      totalDiesel,   "#e67e22", "diesel",  {productor:String(p.id), vista:"tabla"}],
                  ...Object.entries(catEgr).map(([k,v])=>[`💵 ${k}`,v,"#5b9fd6","gastos",{prodId:String(p.id)}]),
                ].filter(([,v])=>v>0).map(([l,v,c,mod,filtros])=>(
                  <div key={l} style={{marginBottom:8,cursor:mod?"pointer":"default",transition:"opacity 0.15s"}}
                    onClick={mod ? ()=>nav(mod, p.id, filtros) : undefined}
                    onMouseEnter={mod ? e=>{e.currentTarget.style.opacity="0.7";} : undefined}
                    onMouseLeave={mod ? e=>{e.currentTarget.style.opacity="1";} : undefined}
                    title={mod ? `→ Ver en ${mod}` : ""}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontSize:12,fontWeight:500,display:"flex",alignItems:"center",gap:4}}>
                        {l}
                        {mod && <span style={{fontSize:9,color:T.field,opacity:0.7}}>→</span>}
                      </span>
                      <span style={{fontFamily:"monospace",fontSize:12,fontWeight:700,color:c}}>{mxnFmt(v)}</span>
                    </div>
                    <div style={{height:5,borderRadius:3,background:"#eee",overflow:"hidden"}}>
                      <div style={{height:"100%",borderRadius:3,background:c,
                        width:`${totalGastos>0?Math.min(100,v/totalGastos*100):0}%`,transition:"width 0.4s"}}/>
                    </div>
                  </div>
                ))}
                {totalGastos===0 && <div style={{textAlign:"center",fontSize:12,color:T.fog,padding:"8px 0"}}>Sin gastos registrados</div>}
              </div>
            </div>

            {/* Lotes */}
            {lotesP.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <div className="card-title">🗺 Lotes Asignados</div>
                  <span style={{fontSize:11,color:T.fog,cursor:"pointer"}} onClick={()=>nav("lotes")} title="→ Ver en Lotes">→ Lotes</span>
                </div>
                <div style={{padding:"4px 0"}}>
                  {lotesP.map(l=>(
                    <div key={l.id}
                      onClick={()=>nav("lotes")}
                      style={{display:"flex",justifyContent:"space-between",cursor:"pointer",
                        padding:"7px 16px",borderBottom:`1px solid ${T.line}`,fontSize:12,
                        transition:"filter 0.12s"}}
                      onMouseEnter={e=>e.currentTarget.style.filter="brightness(0.92)"}
                      onMouseLeave={e=>e.currentTarget.style.filter=""}>
                      <div>
                        <span style={{fontWeight:600}}>{l.apodo||"Sin apodo"}</span>
                        <span style={{color:T.fog,marginLeft:8,fontSize:11}}>{l.ejido||""}</span>
                        <span style={{fontSize:9,color:T.field,marginLeft:6,opacity:0.7}}>→</span>
                      </div>
                      <div style={{fontFamily:"monospace",color:"#1a6ea8",fontWeight:700}}>
                        {(l.supCredito||0).toFixed(2)} ha
                      </div>
                    </div>
                  ))}
                  <div style={{display:"flex",justifyContent:"space-between",padding:"8px 16px",
                    background:"#f0f7ec",fontWeight:700,fontSize:12}}>
                    <span>Total</span>
                    <span style={{fontFamily:"monospace",color:"#1a6ea8"}}>{ha.toFixed(2)} ha</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dispersiones */}
        {dispsSorted.length > 0 && (
          <div className="card" style={{marginBottom:16}}>
            <div className="card-header">
              <div className="card-title">🏦 Dispersiones</div>
              <span style={{fontSize:11,color:T.fog,cursor:"pointer"}}
                onClick={()=>nav("gastos",p.id,{vista:"dispersiones"})}>→ Ver todas en Egresos</span>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{minWidth:500,width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{background:T.mist,fontSize:11,color:T.fog}}>
                    <th style={{padding:"7px 14px",textAlign:"left"}}>Fecha</th>
                    <th style={{padding:"7px 14px",textAlign:"left"}}>Línea</th>
                    <th style={{padding:"7px 14px",textAlign:"left"}}># Solicitud</th>
                    <th style={{padding:"7px 14px",textAlign:"right"}}>Monto</th>
                    <th style={{padding:"7px 14px",textAlign:"right"}}>Días</th>
                    <th style={{padding:"7px 14px",textAlign:"right"}}>Int. acum.</th>
                  </tr>
                </thead>
                <tbody>
                  {dispsSorted.map((d,i)=>{
                    const dias2 = Math.max(0,Math.round((new Date()-new Date(d.fecha))/86400000));
                    const m = parseFloat(d.monto)||0;
                    const isPara = d.lineaCredito==="parafinanciero";
                    const tasa = isPara ? params.para_tasaAnual : params.dir_tasaAnual;
                    const intD = m*(tasa/100)/30*dias2;
                    const bg = i%2===0?"white":"#faf8f3";
                    return (
                      <tr key={d.id}>
                        <td style={{background:bg,padding:"8px 14px",fontFamily:"monospace",fontSize:12}}>{d.fecha||"—"}</td>
                        <td style={{background:bg,padding:"8px 14px"}}>
                          <span style={{padding:"2px 8px",borderRadius:10,fontSize:10,fontWeight:700,
                            background:isPara?"#dbeafe":"#ede9fe",
                            color:isPara?"#1a6ea8":"#8e44ad"}}>
                            {isPara?"Parafin.":"Directo"}
                          </span>
                        </td>
                        <td style={{background:bg,padding:"8px 14px",fontFamily:"monospace",fontSize:11,color:T.fog}}>{d.numSolicitud||"—"}</td>
                        <td style={{background:bg,padding:"8px 14px",textAlign:"right",fontFamily:"monospace",fontWeight:700,color:"#2d5a1b"}}>{mxnFmt(m)}</td>
                        <td style={{background:bg,padding:"8px 14px",textAlign:"right",fontFamily:"monospace",fontSize:11,color:dias2>180?"#c0392b":T.fog}}>{dias2}</td>
                        <td style={{background:bg,padding:"8px 14px",textAlign:"right",fontFamily:"monospace",color:"#c0392b"}}>{mxnFmt(intD)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{background:"#f0f7ec",fontWeight:700,fontSize:12}}>
                    <td colSpan={3} style={{padding:"8px 14px"}}>TOTAL</td>
                    <td style={{padding:"8px 14px",textAlign:"right",fontFamily:"monospace",color:"#2d5a1b"}}>{mxnFmt(totalDisp)}</td>
                    <td/>
                    <td style={{padding:"8px 14px",textAlign:"right",fontFamily:"monospace",color:"#c0392b"}}>{mxnFmt(totalInt)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Datos personales + acciones */}
        <div className="card" style={{marginBottom:16}}>
          <div className="card-header">
            <div className="card-title">👤 Datos del Productor</div>
            {puedeEditar && <button className="btn btn-secondary btn-sm" onClick={()=>{setSel(p);abrirForm(p);}}>✏️ Editar</button>}
          </div>
          <div className="card-body">
            {[
              ["Nombre completo", nomCompleto(p)],
              ["RFC",             p.rfc||"—"],
              ["CURP",            p.tipo==="moral"?"N/A":p.curp||"—"],
              ["Teléfono",        p.telefono||"—"],
              ["Correo",          p.correo||"—"],
              ["Notas",           p.notas||"—"],
            ].map(([l,v])=>(
              <div key={l} className="flex justify-between" style={{padding:"8px 0",borderBottom:`1px solid ${T.line}`}}>
                <span style={{fontSize:12,color:T.fog}}>{l}</span>
                <span style={{fontSize:13,fontWeight:600,textAlign:"right",maxWidth:"60%",wordBreak:"break-all"}}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {puedeEditar && (
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <button className="btn btn-secondary" onClick={()=>{setSel(p);abrirForm(p);}} style={{flex:1}}>✏️ Editar</button>
            <div onClick={()=>dispatch({type:"UPD_PRODUCTOR",payload:{...p,activo:!(p.activo!==false)}})}
              style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                cursor:"pointer",borderRadius:8,padding:"9px 16px",fontWeight:600,fontSize:13,
                background:p.activo!==false?"#e8f4e1":"#f0ece4",
                border:`1.5px solid ${p.activo!==false?"#2d5a1b":"#c0b9a8"}`,
                color:p.activo!==false?"#2d5a1b":"#8a8070"}}>
              {p.activo!==false?"✅ Activo":"⭕ Inactivo"}
            </div>
            <button className="btn btn-danger" onClick={()=>{
              const razones = puedeEliminarProductor(p.id, state);
              if(razones.length>0){alert("No se puede eliminar: "+razones.join(", ")+".");return;}
              confirmarEliminar("¿Eliminar este productor?",()=>{dispatch({type:"DEL_PRODUCTOR",payload:p.id});setModo("lista");setSel(null);});
            }} style={{flex:1}}>🗑 Eliminar</button>
          </div>
        )}
      </div>
    );
  }

  // ── FORMULARIO ─────────────────────────────────────────────────────────────
  if (modo === "form") {
    const esMoral = form.tipo === "moral";
    const haActual  = editando && sel ? haProductor(sel.id) : 0;
    const credActual= editando && sel ? credProductor(sel.id) : 0;
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
          <button className="btn btn-secondary" onClick={()=>{setModo(sel?"detalle":"lista");if(!sel)setSel(null);}}>← Volver</button>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700}}>
            {editando ? `Editar: ${sel?.alias||sel?.apPat||sel?.nombres}` : "Nuevo Productor"}
          </div>
        </div>

        <div className="card">
          <div className="card-body">

            {/* Tipo */}
            <div className="form-group" style={{marginBottom:18}}>
              <label className="form-label">Tipo</label>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                {[["resico","👤 RESICO"],["moral","🏢 Persona Moral"]].map(([v,l])=>(
                  <div key={v} onClick={()=>setForm(f=>({...f,tipo:v}))}
                    style={{padding:"8px 16px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:600,
                      background:form.tipo===v?T.field:T.mist,
                      color:form.tipo===v?"white":T.fog,
                      border:`1.5px solid ${form.tipo===v?T.field:T.line}`}}>
                    {l}
                  </div>
                ))}
              </div>
            </div>

            {/* Nombre */}
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",color:T.fog,marginBottom:10,paddingBottom:4,borderBottom:`1px solid ${T.line}`}}>Nombre</div>
            {esMoral ? (
              <div className="form-group">
                <label className="form-label">Razón social *</label>
                <input className="form-input" value={form.nombres} onChange={e=>setForm(f=>({...f,nombres:e.target.value.toUpperCase()}))} placeholder="ALMACENES Y SERVICIOS SANTA ROSA"/>
              </div>
            ) : (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Apellido paterno *</label>
                    <input className="form-input" value={form.apPat} onChange={e=>setForm(f=>({...f,apPat:e.target.value.toUpperCase()}))} placeholder="GARCIA"/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Apellido materno</label>
                    <input className="form-input" value={form.apMat} onChange={e=>setForm(f=>({...f,apMat:e.target.value.toUpperCase()}))} placeholder="VALENZUELA"/>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Nombre(s) *</label>
                  <input className="form-input" value={form.nombres} onChange={e=>setForm(f=>({...f,nombres:e.target.value.toUpperCase()}))} placeholder="CINTHIA YANELI"/>
                </div>
              </>
            )}
            <div className="form-group">
              <label className="form-label">Alias / Nombre corto</label>
              <input className="form-input" value={form.alias} onChange={e=>setForm(f=>({...f,alias:e.target.value.toUpperCase()}))} placeholder="CINTHIA"/>
            </div>

            {/* Fiscal */}
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",color:T.fog,margin:"18px 0 10px",paddingBottom:4,borderBottom:`1px solid ${T.line}`}}>Identificación fiscal</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">RFC</label>
                <input className="form-input" value={form.rfc} onChange={e=>setForm(f=>({...f,rfc:e.target.value.toUpperCase()}))} placeholder={esMoral?"AGR250314MV3":"GAVC880728879"} style={{fontFamily:"'DM Mono',monospace",letterSpacing:"0.04em"}}/>
              </div>
              <div className="form-group">
                <label className="form-label">CURP {esMoral&&<span style={{fontWeight:400,color:T.fog}}>(N/A)</span>}</label>
                <input className="form-input" value={form.curp} disabled={esMoral} onChange={e=>setForm(f=>({...f,curp:e.target.value.toUpperCase()}))} placeholder={esMoral?"—":"GAVC880728MSLRLN07"} style={{fontFamily:"'DM Mono',monospace",letterSpacing:"0.04em",background:esMoral?T.mist:"white"}}/>
              </div>
            </div>

            {/* Contacto */}
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",color:T.fog,margin:"18px 0 10px",paddingBottom:4,borderBottom:`1px solid ${T.line}`}}>Contacto</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Teléfono</label>
                <input className="form-input" type="tel" value={form.telefono} onChange={e=>setForm(f=>({...f,telefono:e.target.value}))} placeholder="668 000 0000"/>
              </div>
              <div className="form-group">
                <label className="form-label">Correo electrónico</label>
                <input className="form-input" type="email" value={form.correo} onChange={e=>setForm(f=>({...f,correo:e.target.value}))} placeholder="correo@ejemplo.com"/>
              </div>
            </div>

            {/* Color */}
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",color:T.fog,margin:"18px 0 10px",paddingBottom:4,borderBottom:`1px solid ${T.line}`}}>Color identificador</div>
            <div className="form-group">
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <input type="color" value={form.color} onChange={e=>setForm(f=>({...f,color:e.target.value}))}
                  style={{width:44,height:36,border:"none",borderRadius:8,cursor:"pointer",padding:2}}/>
                <span style={{fontSize:12,color:T.fog}}>Identifica al productor en tablas y gráficas</span>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {PROD_COLORES.map(c=>(
                  <div key={c} onClick={()=>setForm(f=>({...f,color:c}))}
                    style={{width:26,height:26,borderRadius:"50%",background:c,cursor:"pointer",
                      border:`3px solid ${form.color===c?"#1e1a14":"transparent"}`,
                      boxShadow:form.color===c?"0 0 0 1px #1e1a14":"none",transition:"all 0.12s"}}/>
                ))}
              </div>
            </div>

            {/* Totales (solo lectura) */}
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",color:T.fog,margin:"18px 0 10px",paddingBottom:4,borderBottom:`1px solid ${T.line}`}}>Totales (calculados automáticamente)</div>
            <div className="form-row" style={{marginBottom:14}}>
              <div style={{background:T.mist,borderRadius:8,padding:"11px 14px",border:`1px solid ${T.line}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div><div style={{fontSize:11,color:T.fog}}>Hectáreas</div><div style={{fontSize:10,color:T.straw,marginTop:2}}>📌 Desde Lotes</div></div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:14,fontWeight:700}}>{haActual>0?haActual+" ha":"0 ha"}</div>
              </div>
              <div style={{background:T.mist,borderRadius:8,padding:"11px 14px",border:`1px solid ${T.line}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div><div style={{fontSize:11,color:T.fog}}>Crédito</div><div style={{fontSize:10,color:T.straw,marginTop:2}}>📌 Desde Créditos</div></div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:14,fontWeight:700}}>{(credActual).toLocaleString("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:2,maximumFractionDigits:2})}</div>
              </div>
            </div>

            {/* Notas */}
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",color:T.fog,margin:"18px 0 10px",paddingBottom:4,borderBottom:`1px solid ${T.line}`}}>Notas y observaciones</div>
            <div className="form-group">
              <textarea className="form-textarea" value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} placeholder="Acuerdos, condiciones especiales..."/>
            </div>

            <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:16}}>
              <button className="btn btn-secondary" onClick={()=>{setModo(sel?"detalle":"lista");}}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar}>
                💾 {editando?"Guardar cambios":"Agregar productor"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── LISTA ──────────────────────────────────────────────────────────────────
  const prodFiltrados = productores.filter(p => {
    if (filtroEstado === "activos")   return p.activo !== false;
    if (filtroEstado === "inactivos") return p.activo === false;
    return true;
  });
  const ordenados = ordenarProductores(prodFiltrados);

  return (
    <div>
      <div className="stat-grid" style={{gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)",marginBottom:20}}>
        <div className="stat-card green"><div className="stat-icon">👥</div><div className="stat-label">Productores</div><div className="stat-value">{productores.length}</div><div className="stat-sub">{productores.filter(p=>p.activo!==false).length} activos · {productores.filter(p=>p.activo===false).length} inactivos</div></div>
        <div className="stat-card sky"><div className="stat-icon">🌾</div><div className="stat-label">Total hectáreas</div><div className="stat-value">{asigsCiclo.length>0?fmt((asigsCiclo||[]).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0),2):"—"}</div><div className="stat-sub">Ciclo {state.cicloActual||"—"}</div></div>
        <div className="stat-card rust"><div className="stat-icon">🏦</div><div className="stat-label">Crédito total</div><div className="stat-value" style={{fontSize:15}}>{totalCred>0?totalCred.toLocaleString("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:2,maximumFractionDigits:2}):"—"}</div><div className="stat-sub">Autorizado total</div></div>
        <div className="stat-card gold"><div className="stat-icon">📋</div><div className="stat-label">Ciclo activo</div><div className="stat-value" style={{fontSize:14}}>{state.cicloActual||"—"}</div><div className="stat-sub">{(()=>{const c=(state.ciclos||[]).find(x=>x.predeterminado);return c?.fechaInicio?`${c.fechaInicio} · ${c.fechaFin||""}`:""})()}</div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Padrón de Productores</div>
          <BtnExport onClick={()=>exportarExcel("Productores",[{
            nombre:"Productores",
            headers:["Alias","Ap Paterno","Ap Materno","Nombres","RFC","CURP","Teléfono"],
            rows:(state.productores||[]).map(p=>[p.alias,p.apPat,p.apMat,p.nombres,p.rfc,p.curp,p.telefono])
          }])}/>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            {/* Filtro estado */}
            <div style={{display:"flex",borderRadius:8,overflow:"hidden",border:`1px solid ${T.line}`}}>
              {[["activos","✅ Activos"],["inactivos","⭕ Inactivos"],["todos","Todos"]].map(([v,l])=>(
                <div key={v} onClick={()=>setFiltroEstado(v)}
                  style={{padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer",
                    background:filtroEstado===v?T.field:"white",
                    color:filtroEstado===v?"white":T.fog,
                    transition:"all 0.15s"}}>
                  {l}
                </div>
              ))}
            </div>
            {puedeEditar && <button className="btn btn-primary btn-sm" onClick={()=>abrirForm()}>＋ Agregar productor</button>}
            <button className="btn btn-secondary btn-sm"
              onClick={()=>descargarHTML(`EstadosCuenta_Todos_${state.cicloActual||"ciclo"}`, generarHTMLTodos(state))}
              style={{background:"#8e44ad",color:"white",border:"none",fontWeight:600}}>
              📄 HTML Todos
            </button>
            <button className="btn btn-secondary btn-sm"
              onClick={()=>exportarExcelTodos(state)}
              style={{background:"#2d5a1b",color:"white",border:"none",fontWeight:600}}>
              📥 Excel Todos
            </button>
          </div>
        </div>

        {productores.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <div className="empty-title">Sin productores registrados</div>
            <div className="empty-sub">Agrega los productores del ciclo para activar todos los módulos</div>
            {puedeEditar && <button className="btn btn-primary" onClick={()=>abrirForm()}>＋ Agregar primer productor</button>}
          </div>
        ) : (
          <>
            <div style={{background:"#f0f7f0",border:"1px solid #c8e0c8",borderRadius:8,padding:"8px 14px",fontSize:12,color:"#4a6a4a",margin:"10px 16px 0"}}>
              💡 Toca una fila para ver el detalle · Desliza → para ver todas las columnas
            </div>
            <div className="table-wrap-scroll">
              <table style={{minWidth:920}}>
                <thead>
                  <tr>
                    <th style={{minWidth:180,position:"sticky",left:0,top:0,zIndex:4,background:"#f7f5f0",boxShadow:"3px 0 6px rgba(0,0,0,0.08)"}}>Productor</th>
                    <th style={{minWidth:90}}>Tipo</th>
                    <th style={{minWidth:130}}>RFC</th>
                    <th style={{minWidth:165}}>CURP</th>
                    <th style={{minWidth:115}}>Teléfono</th>
                    <th style={{minWidth:170}}>Correo</th>
                    <th style={{minWidth:90,textAlign:"right"}}>Hectáreas</th>
                    <th style={{minWidth:110,textAlign:"right"}}>Crédito</th>
                    <th style={{minWidth:60,textAlign:"center"}}>Lotes</th>
                    <th style={{minWidth:80,textAlign:"center"}}>Estado</th>
                    <th style={{minWidth:80}}></th>
                  </tr>
                </thead>
                <tbody>
                  {ordenados.map((p, idx) => {
                    const lotesCnt   = lotesProductor(p.id);
                    const haP        = haProductor(p.id);
                    const credP      = credProductor(p.id);
                    const inactivo   = p.activo === false;
                    // Color alterno: pares blanco, impares crema suave; inactivos tono grisáceo
                    const bgPar      = inactivo ? "#f2f2f2" : "white";
                    const bgImpar    = inactivo ? "#eaeaea" : "#faf8f3";
                    const bgFila     = idx % 2 === 0 ? bgPar : bgImpar;
                    return (
                      <tr key={p.id}
                        style={{cursor:"pointer", opacity: inactivo ? 0.6 : 1, transition:"opacity 0.2s"}}
                        onClick={()=>{setSel(p);setModo("detalle");}}>
                        {/* Columna FIJA */}
                        <td style={{position:"sticky",left:0,zIndex:2,background:bgFila,boxShadow:"3px 0 6px rgba(0,0,0,0.07)"}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{width:10,height:10,borderRadius:"50%",background:p.color||T.fog,flexShrink:0}}/>
                            <div>
                              <div style={{fontWeight:600,fontSize:13}}>{p.alias||p.apPat||p.nombres}</div>
                              <div style={{fontSize:10,color:T.fog}}>{nomCompleto(p)}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{background:bgFila}}><TipoBadge tipo={p.tipo}/></td>
                        <td style={{background:bgFila,fontSize:11,fontFamily:"'DM Mono',monospace",color:T.fog,whiteSpace:"nowrap"}}>{p.rfc||"—"}</td>
                        <td style={{background:bgFila,fontSize:11,fontFamily:"'DM Mono',monospace",color:T.fog,whiteSpace:"nowrap"}}>{p.tipo==="moral"?"N/A":p.curp||"—"}</td>
                        <td style={{background:bgFila,fontSize:12,whiteSpace:"nowrap"}}>{p.telefono||"—"}</td>
                        <td style={{background:bgFila,fontSize:12,color:"#2a6fa8",whiteSpace:"nowrap"}}>{p.correo||"—"}</td>
                        <td className="font-mono fw-600" style={{background:bgFila,textAlign:"right",color:T.field}}>{haP>0?fmt(haP,1)+" ha":"—"}</td>
                        <td className="font-mono" style={{background:bgFila,textAlign:"right",fontSize:12,color:credP>0?T.rust:T.fog}}>{credP>0?credP.toLocaleString("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:2,maximumFractionDigits:2}):"—"}</td>
                        <td style={{background:bgFila,textAlign:"center"}}>{lotesCnt>0?<span className="badge badge-green">{lotesCnt}</span>:"—"}</td>
                        <td style={{background:bgFila,textAlign:"center"}} onClick={e=>e.stopPropagation()}>
                          <div
                            onClick={()=>dispatch({type:"UPD_PRODUCTOR",payload:{...p,activo:!(p.activo!==false)}})}
                            title={p.activo!==false?"Activo — clic para desactivar":"Inactivo — clic para activar"}
                            style={{
                              display:"inline-flex",alignItems:"center",gap:5,cursor:"pointer",
                              background:p.activo!==false?"#e8f4e1":"#f0ece4",
                              border:`1px solid ${p.activo!==false?"#2d5a1b":"#c0b9a8"}`,
                              borderRadius:20,padding:"3px 8px",transition:"all 0.2s",
                              fontSize:11,fontWeight:600,
                              color:p.activo!==false?"#2d5a1b":"#8a8070",
                            }}>
                            <div style={{width:14,height:14,borderRadius:"50%",background:p.activo!==false?"#2d5a1b":"#c0b9a8",transition:"all 0.2s",flexShrink:0}}/>
                            {p.activo!==false?"Activo":"Inactivo"}
                          </div>
                        </td>
                        <td style={{background:bgFila}}>
                          <div className="flex gap-2" onClick={e=>e.stopPropagation()}>
                            {puedeEditar && <button className="btn btn-sm btn-secondary" onClick={()=>{setSel(p);abrirForm(p);}}>✏️</button>}
                            {userRol==="admin" && <button className="btn btn-sm btn-danger" onClick={()=>{
  const razones = puedeEliminarProductor(p.id, state);
  if (razones.length>0) { alert("No se puede eliminar: " + razones.join(", ") + "."); return; }
  confirmarEliminar("¿Eliminar este productor?",()=>dispatch({type:"DEL_PRODUCTOR",payload:p.id}));
}}>🗑</button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
