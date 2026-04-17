// ─── modules/Asiste.jsx ───────────────────────────────────────────

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
// ─── Asiste helpers (movidos de App.jsx para evitar dep circular) ──
const CAPTURE_SYSTEM = (state) => {
  const F = calcularFinancieros(state);
  const vcto = calcularVencimiento(state.credito);
  const haTot = F.ha;
  const costoHa = haTot > 0 ? Math.round(F.costoTotal / haTot) : 0;
  const costoTon = F.produccionEst > 0 ? Math.round(F.costoTotal / F.produccionEst) : 0;
  const precioActual = F.precio;
  const mxn2 = n => `$${(parseFloat(n)||0).toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const fmt2 = (n,d=2) => (parseFloat(n)||0).toFixed(d);

  // ── Datos del ciclo activo ───────────────────────────────────────────────────
  const cicloPred = (state.ciclos||[]).find(c=>c.id===state.cicloActivoId)||(state.ciclos||[])[0];
  const asigsCiclo = cicloPred?.asignaciones||[];
  const cid = state.cicloActivoId||1;
  const params = { para_tasaAnual:1.38, para_factibilidad:1.25, para_fega:2.3, para_asistTec:200, dir_tasaAnual:1.8, dir_factibilidad:1.5, dir_fega:2.3, iva:16, ...(state.creditoParams||{}) };

  // ── Productores con ha ───────────────────────────────────────────────────────
  const prodResumen = (state.productores||[]).map(p => {
    const ha = asigsCiclo.filter(a=>String(a.productorId)===String(p.id)).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);
    const ins = (state.insumos||[]).filter(i=>!i.cancelado&&String(i.productorId)===String(p.id)&&(i.cicloId||1)===cid).reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
    const die = (state.diesel||[]).filter(d=>!d.cancelado&&String(d.productorId)===String(p.id)&&(d.cicloId||1)===cid).reduce((s,d)=>s+(parseFloat(d.importe)||0),0);
    const efe = (state.egresosManual||[]).filter(e=>!e.cancelado&&String(e.productorId)===String(p.id)&&(e.cicloId||1)===cid).reduce((s,e)=>s+(parseFloat(e.monto)||0),0);
    const gastoOp = ins + die + efe;
    const exp = (state.expedientes||[]).find(e=>e.productorId===p.id);
    const creditoAut = exp?.montoPorHa ? ha * exp.montoPorHa : 0;
    const montoAplP = creditoAut>0 ? Math.min(gastoOp, creditoAut) : 0;
    const disps = (state.dispersiones||[]).filter(d=>!d.cancelado&&String(d.productorId)===String(p.id)&&(d.cicloId||1)===cid);
    const totalDisp = disps.reduce((s,d)=>s+(parseFloat(d.monto)||0),0);
    const hoy = new Date();
    // Interés parafinanciero por movimiento
    const movsAll = [
      ...(state.insumos||[]).filter(i=>!i.cancelado&&String(i.productorId)===String(p.id)&&(i.cicloId||1)===cid).map(i=>({fecha:i.fechaSolicitud||i.fechaOrden||"",monto:parseFloat(i.importe)||0})),
      ...(state.diesel||[]).filter(d=>!d.cancelado&&String(d.productorId)===String(p.id)&&(d.cicloId||1)===cid).map(d=>({fecha:d.fechaSolicitud||d.fechaOrden||"",monto:parseFloat(d.importe)||0})),
      ...(state.egresosManual||[]).filter(e=>!e.cancelado&&String(e.productorId)===String(p.id)&&(e.cicloId||1)===cid).map(e=>({fecha:e.fecha||e.semanaFechaInicio||"",monto:parseFloat(e.monto)||0})),
    ].filter(m=>m.monto>0).sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)));
    const diasDesde = f => f ? Math.max(0,Math.round((hoy-new Date(f))/86400000)) : 0;
    let acumP=0, intP=0, factP=0, fegaP=0;
    movsAll.forEach(m=>{ const md=Math.min(m.monto,Math.max(0,montoAplP-acumP)); acumP+=md; intP+=((md*(params.para_tasaAnual/100))/30)*diasDesde(m.fecha); });
    if(montoAplP>0){ factP=creditoAut*(params.para_factibilidad/100)*(1+params.iva/100); fegaP=montoAplP*(params.para_fega/100)*(1+params.iva/100); }
    let acumD2=0, intD=0, factD=0, fegaD=0;
    movsAll.forEach(m=>{ const yP=Math.min(m.monto,Math.max(0,creditoAut-acumD2)); const enD=m.monto-yP; acumD2+=m.monto; const dias=diasDesde(m.fecha); intD+=((enD*(params.dir_tasaAnual/100))/30)*dias; factD+=enD*(params.dir_factibilidad/100); fegaD+=((enD*dias)/360)*(params.dir_fega/100); });
    factD=(factD+fegaD)*(1+params.iva/100);
    const asistTec = ha * params.para_asistTec;
    const totalInteres = intP + intD;
    const totalComisiones = factP + fegaP + asistTec + factD;
    const totalALiquidar = montoAplP + (gastoOp-montoAplP>0?gastoOp-montoAplP:0) + totalInteres + totalComisiones;
    return { nombre: p.alias||p.apPat||p.nombres, ha: fmt2(ha,2), gastoOp: mxn2(gastoOp), creditoAut: mxn2(creditoAut), montoAplP: mxn2(montoAplP), totalDisp: mxn2(totalDisp), interes: mxn2(totalInteres), comisiones: mxn2(totalComisiones), totalLiquidar: mxn2(totalALiquidar) };
  }).filter(p=>parseFloat(p.ha)>0||parseFloat(p.gastoOp.replace(/[$,]/g,""))>0);

  // ── Últimos egresos ──────────────────────────────────────────────────────────
  const ultEgresos = (state.egresosManual||[]).filter(e=>!e.cancelado&&(e.cicloId||1)===cid).slice(-15).map(e=>"  • "+(e.fecha||"")+" | "+e.categoria+" | "+mxn2(e.monto)+" | "+(e.concepto||"")).join("\n");
  const ultInsumos = (state.insumos||[]).filter(i=>!i.cancelado&&(i.cicloId||1)===cid).slice(-10).map(i=>"  • "+(i.fechaSolicitud||"")+" | "+(i.insumo||i.categoria)+" | "+mxn2(i.importe)+" | Prod:"+((state.productores||[]).find(p=>String(p.id)===String(i.productorId))?.alias||i.productorId)).join("\n");
  const ultDiesel = (state.diesel||[]).filter(d=>!d.cancelado&&(d.cicloId||1)===cid).slice(-10).map(d=>"  • "+(d.fechaSolicitud||"")+" | "+(d.litros||"")+" lts | "+mxn2(d.importe)+" | "+((state.productores||[]).find(p=>String(p.id)===String(d.productorId))?.alias||d.productorId)).join("\n");
  const dispersiones = (state.dispersiones||[]).filter(d=>!d.cancelado&&(d.cicloId||1)===cid);
  const ultDisps = dispersiones.slice(-10).map(d=>"  • "+(d.fecha||"")+" | "+d.lineaCredito+" | "+mxn2(d.monto)+" | "+((state.productores||[]).find(p=>String(p.id)===String(d.productorId))?.alias||d.productorId)).join("\n");
  const totalDispersado = dispersiones.reduce((s,d)=>s+(parseFloat(d.monto)||0),0);

  return `Eres el asistente de AgroSistema Charay. Tu función es DUAL:
1. Responder preguntas agronómicas, financieras y de rentabilidad con datos reales del rancho.
2. Detectar y extraer datos capturables de mensajes, fotos o documentos.

════════════════════════════════════════
DATOS REALES DEL RANCHO — CICLO ${state.cicloActual}  |  Hoy: ${new Date().toLocaleDateString("es-MX")}
════════════════════════════════════════

── PRODUCCIÓN ──────────────────────────
Hectáreas sembradas: ${fmt2(haTot,2)} ha en ${(state.lotes||[]).length} lotes · ${(state.productores||[]).length} productores
Producción estimada: ${fmt2(F.produccionEst,1)} ton (${fmt2(haTot>0?F.produccionEst/haTot:0,2)} t/ha)
Precio venta: ${mxn2(precioActual)}/ton · Ingreso estimado: ${mxn2(F.ingresoEst)}

── COSTOS DESGLOSADOS ──────────────────
Costo total ciclo:   ${mxn2(F.costoTotal)} (${mxn2(costoHa)}/ha · ${mxn2(costoTon)}/ton)
  Semilla:           ${mxn2(F.costoSemilla)}
  Insumos (sin sem): ${mxn2(F.costoInsumos||0)}
  Diesel:            ${mxn2(F.costoDiesel)}
  Renta de tierra:   ${mxn2(F.costoRenta)}
  Mano de obra:      ${mxn2(F.costoManoObra)}
  Agua:              ${mxn2(F.costoAgua)}
  Seguros:           ${mxn2(F.costoSeguros)}
  Trámites/Otros:    ${mxn2((F.costoTramites||0)+(F.costoOtros||0))}
  Intereses:         ${mxn2(F.costoInteres)}
  Comisiones:        ${mxn2(F.costoComisiones)}

── RENTABILIDAD ────────────────────────
Utilidad estimada: ${mxn2(F.utilidadBruta)} (${fmt2(F.margen,1)}% margen)
Punto de equilibrio: ${fmt2(F.peTon,1)} ton · ${fmt2(haTot>0?F.peTon/haTot:0,2)} t/ha mínimo

── CRÉDITO HABILITACIÓN (parámetros) ───
Parafin: tasa ${params.para_tasaAnual}%/mes · Factibilidad ${params.para_factibilidad}% · FEGA ${params.para_fega}% · AT $${params.para_asistTec}/ha
Directo: tasa ${params.dir_tasaAnual}%/mes · Factibilidad ${params.dir_factibilidad}% · FEGA ${params.dir_fega}%
IVA: ${params.iva}%
Total dispersado al ciclo: ${mxn2(totalDispersado)} (${dispersiones.length} movimientos)

── ESTADO POR PRODUCTOR (crédito + gasto) ──────────────────────────────────────
PRODUCTOR         | HA    | GASTO OP     | CRÉD AUT     | APLICADO     | DISPERSADO   | INTERÉS      | COMISIONES   | TOTAL A LIQUIDAR
${prodResumen.map(p=>p.nombre.padEnd(17)+"| "+p.ha.padEnd(6)+"| "+p.gastoOp.padEnd(13)+"| "+p.creditoAut.padEnd(13)+"| "+p.montoAplP.padEnd(13)+"| "+p.totalDisp.padEnd(13)+"| "+p.interes.padEnd(13)+"| "+p.comisiones.padEnd(13)+"| "+p.totalLiquidar).join("\n")}
")}

── ÚLTIMAS DISPERSIONES (${dispersiones.length} total) ─────
${ultDisps||"Sin dispersiones"}

── ÚLTIMOS INSUMOS ─────────────────────
${ultInsumos||"Sin registros"}

── ÚLTIMOS EGRESOS MANUALES ────────────
${ultEgresos||"Sin registros"}

── ÚLTIMO DIESEL ───────────────────────
${ultDiesel||"Sin registros"}

── CRÉDITOS REFACCIONARIOS ─────────────
${(state.creditosRef||[]).length===0 ? "Ninguno" : (state.creditosRef||[]).map(c => { const {saldoCapital,interesTotal} = calcularInteresCredito(c); return "  • "+c.institucion+" · saldo "+mxn2(saldoCapital)+" · interés "+mxn2(interesTotal); }).join("\n")}
")}

── CAPITAL PROPIO ───────────────────────
Aportado: ${mxn2(F.totalAport)} · Retiros: ${mxn2(F.totalRetiro)} · Capital neto: ${mxn2(F.capitalNeto)}

── LOTES DEL CICLO (primeros 20) ───────
${asigsCiclo.slice(0,20).map(a=>{const l=(state.lotes||[]).find(x=>x.id===a.loteId);const p2=(state.productores||[]).find(x=>String(x.id)===String(a.productorId));return"  • "+(l?.apodo||l?.lote||a.loteId)+": "+a.supAsignada+"ha · "+(a.cultivoNombre||"Maíz")+" · "+(p2?.alias||"");}).join("\n")||"Sin asignaciones"}
")||"Sin asignaciones"}

════════════════════════════════════════
INSTRUCCIONES
════════════════════════════════════════
FINANCIERO/RENTABILIDAD: Usa SIEMPRE los datos reales de la tabla de productores y los parámetros de crédito para calcular intereses. La fórmula de interés es: ((monto × tasa%/mes) / 30) × días. Para proyectar al 31-jul u otra fecha, calcula los días desde la fecha del primer movimiento de cada productor hasta esa fecha. Sé concreto y da cifras exactas.

AGRONÓMICO: Especialista en norte de Sinaloa, Valle del Fuerte, Charay. Maíz blanco/amarillo, ejote, papa. Siempre en español, práctico y orientado a la acción.

CAPTURA DE DATOS: Si el mensaje contiene gastos, actividades o documentos capturables, extrae en JSON:
{ "capturas": [ { modulo, ...campos } ], "texto": "respuesta" }

MÓDULOS DISPONIBLES:
- GASTO: { modulo:"gasto", fecha, concepto, monto, categoria, formaPago("contado"|"credito"), proveedor, notas }
- DIESEL: { modulo:"diesel", fecha, litros, precioLitro, concepto, formaPago, notas }
- INSUMO: { modulo:"insumo", nombre, categoria, unidad, stockInicial, stockActual, costoUnitario, proveedor, fechaEntrada }
- TRABAJO: { modulo:"trabajo", fecha, tipo, loteNombre, operador, horas, observaciones }
- APORTACION: { modulo:"aportacion", fecha, monto, concepto, socio, notas }
- MINISTRACION: { modulo:"ministracion", fecha, monto, concepto, estatus("aplicado") }

Si NO hay nada capturable: { "capturas": [], "texto": "tu respuesta" }
Responde siempre en español.`;
};

const QUICK_PROMPTS = [
  { label:"💊 Registrar fertilizante", text:"Apliqué fertilizante hoy" },
  { label:"⛽ Carga de diesel", text:"Cargué diesel hoy" },
  { label:"🌱 Análisis de suelo", text:"Interpreta mi análisis de suelo" },
  { label:"🐛 Plagas", text:"¿Qué plagas debo vigilar en esta etapa?" },
  { label:"💵 Anotar gasto", text:"Tuve un gasto hoy de " },
  { label:"💧 Registro de riego", text:"Regué el lote " },
];

const MODULO_INFO = {
  gasto:       { icon:"💸", label:"Gasto del Ciclo",     color:"#b85c2c" },
  diesel:      { icon:"⛽", label:"Diesel / Combustible", color:"#e67e22" },
  insumo:      { icon:"📦", label:"Insumo / Inventario",  color:"#2d5a1b" },
  trabajo:     { icon:"🚜", label:"Bitácora de Trabajo",  color:"#4a8c2a" },
  aportacion:  { icon:"💵", label:"Aportación de Capital",color:"#c8a84b" },
  ministracion:{ icon:"🏦", label:"Ministración Crédito", color:"#5b9fd6" },
};

function TarjetaConfirmacion({ captura, lotes, onConfirm, onEdit, onDiscard }) {
  const [editado, setEditado] = useState({ ...captura });
  const [modoEdicion, setModoEdicion] = useState(false);
  const info = MODULO_INFO[captura.modulo] || { icon:"📋", label:captura.modulo, color:"#666" };

  const campos = Object.entries(editado).filter(([k]) => k !== "modulo");

  return (
    <div style={{
      border:`2px solid ${info.color}`,
      borderRadius:12,
      overflow:"hidden",
      background:"white",
      maxWidth:420,
      boxShadow:"0 4px 16px rgba(0,0,0,0.10)"
    }}>
      {/* Header */}
      <div style={{ background:info.color, padding:"10px 14px", display:"flex", alignItems:"center", gap:8 }}>
        <span style={{fontSize:18}}>{info.icon}</span>
        <div style={{color:"white",fontWeight:700,fontSize:13}}>{info.label}</div>
        <div style={{marginLeft:"auto",color:"rgba(255,255,255,0.8)",fontSize:11}}>Pendiente de confirmar</div>
      </div>

      {/* Campos */}
      <div style={{padding:"10px 14px"}}>
        {modoEdicion ? (
          campos.map(([k,v])=>(
            <div key={k} style={{marginBottom:8}}>
              <div style={{fontSize:10,fontWeight:700,color:T.fog,textTransform:"uppercase",marginBottom:2}}>{k}</div>
              <input
                style={{width:"100%",padding:"5px 8px",border:`1px solid ${T.line}`,borderRadius:6,fontSize:12,fontFamily:"'DM Mono',monospace"}}
                value={String(v??"")}
                onChange={e=>setEditado(ed=>({...ed,[k]:e.target.value}))}
              />
            </div>
          ))
        ) : (
          <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}>
            <tbody>
              {campos.map(([k,v])=>(
                <tr key={k} style={{borderBottom:`1px solid ${T.line}`}}>
                  <td style={{padding:"5px 4px",color:T.fog,width:"38%",fontWeight:500,textTransform:"capitalize"}}>{k.replace(/([A-Z])/g," $1")}</td>
                  <td style={{padding:"5px 4px",fontFamily:"'DM Mono',monospace",fontWeight:600,color:T.inkLt}}>
                    {typeof v==="number" && (k==="monto"||k==="costoUnitario"||k==="precioLitro")
                      ? mxn(v)
                      : String(v??"")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Acciones */}
      <div style={{padding:"8px 14px 12px",display:"flex",gap:8,borderTop:`1px solid ${T.line}`}}>
        <button
          onClick={()=>onConfirm(editado)}
          style={{flex:1,padding:"8px 0",background:info.color,color:"white",border:"none",borderRadius:8,fontWeight:700,fontSize:13,cursor:"pointer"}}
        >✓ Guardar</button>
        {modoEdicion
          ? <button onClick={()=>setModoEdicion(false)} style={{padding:"8px 12px",background:T.mist,border:`1px solid ${T.line}`,borderRadius:8,fontSize:12,cursor:"pointer"}}>Listo</button>
          : <button onClick={()=>setModoEdicion(true)} style={{padding:"8px 12px",background:T.mist,border:`1px solid ${T.line}`,borderRadius:8,fontSize:12,cursor:"pointer"}}>✏️ Editar</button>
        }
        <button onClick={onDiscard} style={{padding:"8px 12px",background:"#fdf0ef",border:`1px solid ${T.rust}`,color:T.rust,borderRadius:8,fontSize:12,cursor:"pointer"}}>✕</button>
      </div>
    </div>
  );
}

// ─── IA KEY (ofuscada) ───────────────────────────────────────────────────────
const _gk = () => atob("QUl6YVN5QXNVbXNYcy1LeV9yZEpaOHpnVDNzX25VQUUxWFRadzJR");



export default function AsisteModule() {
  const { state, dispatch } = useData();

  // ── Motor IA: "gemini" (gratis) | "claude" (premium) ─────────────────────────
  const [motor, setMotor]           = useState(state.iaMotor || "gemini");
  const [showConfig, setShowConfig] = useState(false);
  const [keyClaude,  setKeyClaude]  = useState(state.iaKeyClaude || "");
  const [keyGuardada, setKeyGuardada] = useState(false);

  // Gemini usa key embebida; Claude requiere key manual
  const keyActiva   = motor === "gemini" ? _gk() : (state.iaKeyClaude || keyClaude).trim();
  const keyFaltante = motor === "claude" && !keyActiva;

  const guardarKeys = () => {
    dispatch({ type:"SET_IA_CONFIG", payload:{ motor, keyGemini: "", keyClaude: keyClaude.trim() } });
    setKeyGuardada(true);
    setTimeout(()=>{ setKeyGuardada(false); setShowConfig(false); }, 1500);
  };

  const cambiarMotor = (m) => {
    setMotor(m);
    dispatch({ type:"SET_IA_CONFIG", payload:{ motor: m, keyGemini: "", keyClaude: (state.iaKeyClaude || keyClaude).trim() } });
  };

  const mensajeInicial = [{ role:"assistant", text:"¡Hola! Soy tu asistente de AgroSistema Charay. Puedo ayudarte de dos formas:\n\n📸 Sube una foto de ticket, factura o recibo y extraigo los datos automáticamente.\n💬 Dime en lenguaje natural cualquier gasto, actividad o evento y lo registro.\n🌱 También respondo preguntas agronómicas sobre tus cultivos.\n\n¿Por dónde empezamos?" }];
  const [messages, setMessages]   = useState(
    (state.iaHistorial && state.iaHistorial.length > 0) ? state.iaHistorial : mensajeInicial
  );
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [adjunto, setAdjunto]     = useState(null); // { tipo:"image"|"pdf", base64, mimeType, nombre }
  const fileRef                   = React.useRef();
  const chatRef                   = React.useRef();

  // Scroll to bottom + persist historial on new message
  React.useEffect(()=>{
    if(chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
    // Guardar en state global para persistir entre navegaciones
    // Solo mensajes de texto (sin base64 de imágenes para no saturar el state)
    const historialLimpio = messages.map(m => ({
      role: m.role,
      text: m.text,
      capturas: m.capturas || null,
      // Omitir base64 del adjunto para no saturar memoria
    }));
    dispatch({ type:"SET_IA_HISTORIAL", payload: historialLimpio });
  },[messages]);

  // File picker handler
  const handleFile = async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result.split(",")[1];
      const mimeType = file.type;
      const tipo = mimeType === "application/pdf" ? "pdf" : "image";
      setAdjunto({ tipo, base64, mimeType, nombre:file.name });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const removeAdjunto = () => setAdjunto(null);

  // Build API message content with optional attachment
  const buildContent = (texto, adj) => {
    if(!adj) return texto || "Analiza este documento.";
    if(adj.tipo === "image") {
      return [
        { type:"image", source:{ type:"base64", media_type:adj.mimeType, data:adj.base64 } },
        { type:"text",  text: texto || "Extrae y registra los datos de esta imagen." }
      ];
    }
    // PDF
    return [
      { type:"document", source:{ type:"base64", media_type:"application/pdf", data:adj.base64 } },
      { type:"text",     text: texto || "Extrae y registra los datos de este documento." }
    ];
  };

  // Dispatch a confirmed capture to the correct reducer action
  const guardarCaptura = (captura) => {
    const hoy = new Date().toISOString().split("T")[0];
    switch(captura.modulo) {
      case "gasto":
        dispatch({ type:"ADD_GASTO", payload:{
          fecha:     captura.fecha||hoy,
          concepto:  captura.concepto||"",
          monto:     parseFloat(captura.monto)||0,
          categoria: captura.categoria||"Otro",
          formaPago: captura.formaPago||"contado",
          proveedor: captura.proveedor||"",
          notas:     captura.notas||"",
        }});
        break;
      case "diesel":
        dispatch({ type:"ADD_DIESEL", payload:{
          fecha:       captura.fecha||hoy,
          litros:      parseFloat(captura.litros)||0,
          precioLitro: parseFloat(captura.precioLitro)||0,
          concepto:    captura.concepto||"Carga diesel",
          unidad:      captura.unidad||"",
          formaPago:   captura.formaPago||"contado",
          notas:       captura.notas||"",
        }});
        break;
      case "insumo":
        dispatch({ type:"ADD_INSUMO", payload:{
          nombre:       captura.nombre||"",
          categoria:    captura.categoria||"Fertilizante",
          unidad:       captura.unidad||"kg",
          stockInicial: parseFloat(captura.stockInicial)||0,
          stockActual:  parseFloat(captura.stockActual||captura.stockInicial)||0,
          costoUnitario:parseFloat(captura.costoUnitario)||0,
          proveedor:    captura.proveedor||"",
          loteDestino:  captura.loteDestino||"General",
          fechaEntrada: captura.fechaEntrada||hoy,
        }});
        break;
      case "trabajo":
        const loteEncontrado = state.lotes.find(l=>
          (l.apodo||l.lote||"").toLowerCase().includes((captura.loteNombre||"").toLowerCase())
        );
        dispatch({ type:"ADD_TRABAJO", payload:{
          fecha:         captura.fecha||hoy,
          tipo:          captura.tipo||"Otro",
          loteId:        loteEncontrado?.id||state.lotes[0]?.id||null,
          operador:      captura.operador||"",
          horas:         parseFloat(captura.horas)||0,
          maquinaria:    captura.maquinaria||"",
          observaciones: captura.observaciones||"",
        }});
        break;
      case "aportacion":
        dispatch({ type:"ADD_APORTACION", payload:{
          fecha:    captura.fecha||hoy,
          monto:    parseFloat(captura.monto)||0,
          concepto: captura.concepto||"",
          socio:    captura.socio||"",
          notas:    captura.notas||"",
        }});
        break;
      case "ministracion":
        dispatch({ type:"ADD_MINISTRACION", payload:{
          fecha:    captura.fecha||hoy,
          monto:    parseFloat(captura.monto)||0,
          concepto: captura.concepto||"Ministración",
          origen:   "manual",
          estatus:  "aplicado",
        }});
        break;
      default: break;
    }
  };

  const sendMsg = async () => {
    if((!input.trim() && !adjunto) || loading) return;
    if(keyFaltante) { setShowConfig(true); return; }

    const userText = input.trim();
    setInput("");
    const adjCopy = adjunto;
    setAdjunto(null);

    // Add user message bubble
    setMessages(m => [...m, {
      role:"user",
      text: userText || `📎 ${adjCopy?.nombre}`,
      adjunto: adjCopy ? { tipo:adjCopy.tipo, nombre:adjCopy.nombre, mimeType:adjCopy.mimeType, base64:adjCopy.base64 } : null
    }]);
    setLoading(true);

    try {
      let raw = "";

      if (motor === "gemini") {
        // ── MODO ESTÁNDAR (Claude Haiku — rápido y económico) ────────────────
        // Nota: Gemini no está disponible desde el sandbox de Claude Artifacts por CORS.
        // Se usa Claude Haiku como motor estándar vía API de Anthropic.
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": keyActiva,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true"
          },
          body: JSON.stringify({
            model:      "claude-haiku-4-5-20251001",
            max_tokens: 1500,
            system:     CAPTURE_SYSTEM(state),
            messages: [
              ...messages.slice(-6).map(m=>({
                role: m.role==="assistant"?"assistant":"user",
                content: typeof m.text==="string" ? m.text : ""
              })),
              { role:"user", content: buildContent(userText, adjCopy) }
            ]
          })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
        raw = data.content?.[0]?.text || "";

      } else {
        // ── CLAUDE (premium) ─────────────────────────────────────────────────
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": keyActiva,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true"
          },
          body: JSON.stringify({
            model:      "claude-sonnet-4-6",
            max_tokens: 1500,
            system:     CAPTURE_SYSTEM(state),
            messages: [
              ...messages.slice(-6).map(m=>({
                role: m.role==="assistant"?"assistant":"user",
                content: typeof m.text==="string" ? m.text : ""
              })),
              { role:"user", content: buildContent(userText, adjCopy) }
            ]
          })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
        raw = data.content?.[0]?.text || "";
      }

      // Try to parse JSON response
      let capturas = [];
      let textoRespuesta = raw;

      try {
        // Clean: remove possible markdown fences
        const clean = raw.replace(/```json|```/g,"").trim();
        // Find JSON object
        const jsonStart = clean.indexOf("{");
        const jsonEnd   = clean.lastIndexOf("}");
        if(jsonStart !== -1 && jsonEnd !== -1) {
          const parsed = JSON.parse(clean.slice(jsonStart, jsonEnd+1));
          capturas       = parsed.capturas || [];
          textoRespuesta = parsed.texto || "";
        }
      } catch(_) {
        // Not JSON → pure text response
        capturas = [];
        textoRespuesta = raw;
      }

      setMessages(m => [...m, {
        role:"assistant",
        text: textoRespuesta,
        capturas: capturas.length > 0 ? capturas : null,
      }]);

    } catch(e) {
      setMessages(m => [...m, { role:"assistant", text:"Error de conexión. Verifica tu internet." }]);
    }
    setLoading(false);
  };

  // Handle confirmation of a capture card
  const confirmarCaptura = (msgIdx, captIdx, captura) => {
    guardarCaptura(captura);
    setMessages(msgs => msgs.map((m,mi) => {
      if(mi !== msgIdx) return m;
      const nuevasCapturas = (m.capturas||[]).map((c,ci) =>
        ci===captIdx ? { ...c, _guardado:true } : c
      );
      return { ...m, capturas:nuevasCapturas };
    }));
  };

  const descartarCaptura = (msgIdx, captIdx) => {
    setMessages(msgs => msgs.map((m,mi) => {
      if(mi !== msgIdx) return m;
      const nuevasCapturas = (m.capturas||[]).map((c,ci) =>
        ci===captIdx ? { ...c, _descartado:true } : c
      );
      return { ...m, capturas:nuevasCapturas };
    }));
  };

  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 120px)"}}>
      <div className="card" style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>

        {/* Header */}
        <div className="card-header">
          <div className="flex items-center gap-2">
            <span style={{fontSize:22}}>🌱</span>
            <div>
              <div className="card-title">Asistente Inteligente</div>
              <div style={{fontSize:11,color:T.fog}}>Captura automática · Preguntas agronómicas · Análisis de documentos</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {/* Toggle motor */}
            <div style={{display:"flex",borderRadius:8,border:"1px solid #d0e0d0",overflow:"hidden",fontSize:11,fontWeight:700}}>
              <div onClick={()=>cambiarMotor("gemini")}
                style={{padding:"5px 12px",cursor:"pointer",transition:"all .15s",
                  background: motor==="gemini" ? T.field : "white",
                  color:       motor==="gemini" ? "white"  : "#5a7a5a"}}>
                ⚡ Estándar <span style={{fontWeight:400,opacity:.8}}>(Haiku)</span>
              </div>
              <div onClick={()=>cambiarMotor("claude")}
                style={{padding:"5px 12px",cursor:"pointer",transition:"all .15s",
                  background: motor==="claude" ? "#2d5a9b" : "white",
                  color:       motor==="claude" ? "white"   : "#5a7a5a"}}>
                🚀 Premium <span style={{fontWeight:400,opacity:.8}}>(Sonnet)</span>
              </div>
            </div>
            {motor === "claude" && (
              <button onClick={()=>setShowConfig(v=>!v)}
                style={{background:"none",border:`1px solid ${keyFaltante?"#e74c3c":"#d0e0d0"}`,borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:12,color:keyFaltante?"#c0392b":"#5a7a5a"}}
                title="Configurar API Key Premium">
                {keyFaltante ? "⚠️ Ingresar Key" : "🔑 API Key"}
              </button>
            )}
            {messages.length > 1 && (
              <button
                onClick={()=>{ setMessages(mensajeInicial); dispatch({type:"SET_IA_HISTORIAL",payload:mensajeInicial}); }}
                style={{background:"none",border:"1px solid #ddd5c0",borderRadius:6,padding:"4px 9px",fontSize:11,color:"#8a8070",cursor:"pointer"}}
                title="Limpiar conversación">
                🗑️ Nueva
              </button>
            )}
          </div>
        </div>

        {/* Panel configuración API Keys */}
        {showConfig && (
          <div style={{padding:"14px 16px",background:"#f0f7ff",borderBottom:"1px solid #b8d4f0"}}>
            <div style={{fontWeight:700,fontSize:13,marginBottom:12,color:"#1a3d6e"}}>🔑 API Key — Modo Premium (Claude Sonnet)</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
              {/* Gemini — key embebida, no se muestra */}
              <div style={{background:"white",borderRadius:8,padding:"10px 14px",border:"1px solid #d0e0f0"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                  <span style={{fontSize:14}}>✨</span>
                  <span style={{fontWeight:700,fontSize:12,color:"#1a73e8"}}>Google Gemini</span>
                  <span style={{fontSize:10,padding:"2px 6px",borderRadius:10,background:"#e8f5e9",color:"#2d7a3a",fontWeight:600}}>GRATIS</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"#e8f5e9",borderRadius:7,border:"1px solid #b2dfdb"}}>
                  <span style={{fontSize:16}}>✅</span>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:"#2d7a3a"}}>Configurado y listo</div>
                    <div style={{fontSize:10,color:"#5a9a7a"}}>Gemini 2.0 Flash · Sin costo · 1,500 req/día</div>
                  </div>
                </div>
              </div>
              {/* Claude */}
              <div style={{background:"white",borderRadius:8,padding:"10px 14px",border:"1px solid #d0e0f0"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                  <span style={{fontSize:14}}>🤖</span>
                  <span style={{fontWeight:700,fontSize:12,color:T.field}}>Anthropic Claude</span>
                  <span style={{fontSize:10,padding:"2px 6px",borderRadius:10,background:"#fff3cd",color:"#856404",fontWeight:600}}>PREMIUM</span>
                </div>
                <input
                  className="form-input"
                  style={{fontSize:11,padding:"6px 10px"}}
                  placeholder="sk-ant-... (console.anthropic.com)"
                  value={keyClaude}
                  onChange={e=>setKeyClaude(e.target.value)}
                  type="password"
                />
                <div style={{fontSize:10,color:"#5a7a9a",marginTop:4}}>
                  Obtén tu key en <strong>console.anthropic.com</strong> → API Keys
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <button className="btn btn-primary btn-sm" onClick={guardarKeys}>
                {keyGuardada ? "✅ Guardado" : "💾 Guardar Keys"}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={()=>setShowConfig(false)}>Cerrar</button>
              <span style={{fontSize:10,color:"#5a7a9a"}}>Las keys se guardan en la sesión actual del sistema.</span>
            </div>
          </div>
        )}

        {/* Alerta si no hay key configurada */}
        {keyFaltante && !showConfig && (
          <div style={{padding:"10px 16px",background:"#fff3cd",borderBottom:"1px solid #ffc107",fontSize:12,color:"#856404",display:"flex",alignItems:"center",gap:8}}>
            ⚠️ Necesitas configurar tu API Key de <strong>{motor==="gemini"?"Google Gemini (gratis)":"Anthropic Claude"}</strong> para usar el asistente.
            <button onClick={()=>setShowConfig(true)} style={{background:"#ffc107",border:"none",borderRadius:5,padding:"3px 10px",fontSize:11,fontWeight:700,cursor:"pointer",color:"#333"}}>Configurar ahora</button>
          </div>
        )}

        {/* Quick prompts */}
        <div style={{padding:"10px 16px",borderBottom:`1px solid ${T.line}`,display:"flex",gap:6,flexWrap:"wrap"}}>
          {QUICK_PROMPTS.map(p=>(
            <button key={p.label} className="btn btn-sm btn-secondary"
              style={{fontSize:11}}
              onClick={()=>setInput(p.text)}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div ref={chatRef} style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
          {messages.map((m,mi)=>(
            <div key={mi}>
              {/* Bubble */}
              <div style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
                <div style={{
                  maxWidth:"80%",
                  padding:"11px 15px",
                  borderRadius: m.role==="user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  background: m.role==="user" ? T.field : T.paper,
                  color: m.role==="user" ? "white" : T.ink,
                  fontSize:13.5, lineHeight:1.65,
                  border: m.role==="assistant" ? `1px solid ${T.line}` : "none",
                  whiteSpace:"pre-wrap"
                }}>
                  {m.role==="assistant" && (
                    <div style={{fontSize:10,fontWeight:700,color:T.fieldLt,marginBottom:4,letterSpacing:"0.05em"}}>🌾 ASISTENTE CHARAY</div>
                  )}
                  {/* Show image thumbnail for user */}
                  {m.adjunto?.tipo==="image" && (
                    <img
                      src={`data:${m.adjunto.mimeType};base64,${m.adjunto.base64}`}
                      alt={m.adjunto.nombre}
                      style={{maxWidth:200,maxHeight:140,borderRadius:8,display:"block",marginBottom:8,objectFit:"cover"}}
                    />
                  )}
                  {m.adjunto?.tipo==="pdf" && (
                    <div style={{background:"rgba(255,255,255,0.2)",borderRadius:8,padding:"6px 10px",fontSize:11,marginBottom:6,display:"flex",gap:6,alignItems:"center"}}>
                      📄 {m.adjunto.nombre}
                    </div>
                  )}
                  {m.text}
                </div>
              </div>

              {/* Capture cards below assistant message */}
              {m.role==="assistant" && m.capturas && m.capturas.length>0 && (
                <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:10,paddingLeft:8}}>
                  <div style={{fontSize:11,fontWeight:700,color:T.fog,letterSpacing:"0.08em"}}>
                    📋 {m.capturas.length} REGISTRO{m.capturas.length>1?"S":""} DETECTADO{m.capturas.length>1?"S":""}
                  </div>
                  {m.capturas.map((cap,ci)=>{
                    if(cap._guardado) return (
                      <div key={ci} style={{padding:"8px 14px",background:"#eafaf1",border:`1px solid ${T.field}`,borderRadius:10,fontSize:12,color:T.field,fontWeight:600}}>
                        ✅ {MODULO_INFO[cap.modulo]?.icon} Guardado en {MODULO_INFO[cap.modulo]?.label}
                      </div>
                    );
                    if(cap._descartado) return (
                      <div key={ci} style={{padding:"8px 14px",background:T.mist,border:`1px solid ${T.line}`,borderRadius:10,fontSize:12,color:T.fog}}>
                        ✕ Descartado
                      </div>
                    );
                    return (
                      <TarjetaConfirmacion
                        key={ci}
                        captura={cap}
                        lotes={state.lotes}
                        onConfirm={c => confirmarCaptura(mi,ci,c)}
                        onDiscard={()  => descartarCaptura(mi,ci)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div style={{display:"flex",justifyContent:"flex-start"}}>
              <div style={{background:T.paper,border:`1px solid ${T.line}`,borderRadius:"14px 14px 14px 4px",padding:"12px 16px"}}>
                <div style={{color:T.fog,fontSize:13}}>🌱 Analizando{adjunto?" documento":""}...</div>
              </div>
            </div>
          )}
        </div>

        {/* Attachment preview */}
        {adjunto && (
          <div style={{padding:"8px 16px",borderTop:`1px solid ${T.line}`,background:T.mist,display:"flex",alignItems:"center",gap:10}}>
            {adjunto.tipo==="image"
              ? <img src={`data:${adjunto.mimeType};base64,${adjunto.base64}`} alt="" style={{height:44,width:60,objectFit:"cover",borderRadius:6,border:`1px solid ${T.line}`}}/>
              : <div style={{fontSize:24}}>📄</div>
            }
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{adjunto.nombre}</div>
              <div style={{fontSize:10,color:T.fog}}>{adjunto.tipo==="pdf"?"PDF":"Imagen"} adjunta — lista para analizar</div>
            </div>
            <button onClick={removeAdjunto} style={{background:"none",border:"none",fontSize:18,color:T.fog,cursor:"pointer"}}>✕</button>
          </div>
        )}

        {/* Input row */}
        <div style={{padding:"12px 16px",borderTop:`1px solid ${T.line}`,display:"flex",gap:8,alignItems:"flex-end"}}>
          {/* File attach button */}
          <input ref={fileRef} type="file" accept="image/*,.pdf" style={{display:"none"}} onChange={handleFile}/>
          <button
            onClick={()=>fileRef.current?.click()}
            style={{
              padding:"9px 12px",
              background:adjunto?T.field:T.mist,
              color:adjunto?"white":T.fog,
              border:`1px solid ${adjunto?T.field:T.line}`,
              borderRadius:9,
              fontSize:16,
              cursor:"pointer",
              flexShrink:0,
              transition:"all .2s"
            }}
            title="Adjuntar foto o PDF"
          >📎</button>

          <textarea
            className="form-input"
            style={{flex:1,resize:"none",minHeight:42,maxHeight:120,lineHeight:1.5,padding:"10px 12px"}}
            placeholder={adjunto?"Describe qué contiene o agrega contexto... (opcional)":"Escribe un gasto, actividad o pregunta agronómica..."}
            value={input}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{
              if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); sendMsg(); }
            }}
            rows={1}
          />
          <button
            className="btn btn-primary"
            style={{flexShrink:0,padding:"10px 18px"}}
            onClick={sendMsg}
            disabled={loading || (!input.trim() && !adjunto)}
          >
            {loading?"⏳":"Enviar →"}
          </button>
        </div>

        {/* Footer hint */}
        <div style={{padding:"6px 16px 8px",fontSize:10,color:T.fog,borderTop:`1px solid ${T.line}`,background:T.mist,display:"flex",gap:16}}>
          <span>📎 Fotos de tickets, facturas o PDFs</span>
          <span>💬 Lenguaje natural: "Pagué $8,000 de diesel hoy"</span>
          <span>↵ Enter para enviar · Shift+Enter nueva línea</span>
        </div>
      </div>
    </div>
  );
}
