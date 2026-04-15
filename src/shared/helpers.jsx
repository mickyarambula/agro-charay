/* global XLSX */
// ─── shared/helpers.jsx ─────────────────────────────────────────────────────
// Helpers financieros, exportadores Excel/HTML, cálculo de alertas, y
// componentes auxiliares (FiltroSelect, PanelAlertas, navRowProps).
// Importa T, mxnFmt, helpers de format desde utils.js.

import React, { useState } from 'react';
import { useData } from '../core/DataContext.jsx';
import {
  T, mxnFmt, fmt, today, fenologiaColor, estadoColor,
  CULTIVOS, ESTADOS_FENOL, TIPOS_TRABAJO, CAT_INSUMO, UNIDADES, CAT_GASTO,
  confirmarEliminar, nomCompleto, PROD_COLORES, ordenarProductores,
  MOTIVOS_CANCELACION
} from './utils.js';
import { ROLES, ACCESO, USUARIOS, getRolInfo, getRolesDisponibles, getRolPermisos, getPermisosUsuario } from './roles.js';

export function calcularInteresCredito(credito) {
  const hoy  = new Date();
  const tasa  = credito.tasaAnual / 100 / 365; // tasa diaria

  // Solo ministraciones aplicadas, ordenadas cronológicamente
  const aplicadas = credito.ministraciones
    .filter(m => m.estatus === "aplicado")
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  // Abonos a capital ordenados cronológicamente (excluir "Pago de intereses")
  const abonosCapital = credito.pagos
    .filter(p => p.tipo !== "Pago de intereses")
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  // Aplicar abonos FIFO sobre las ministraciones
  const saldos = aplicadas.map(m => ({ ...m, saldo: m.monto }));
  let abonoPendiente = (abonosCapital||[]).reduce((s, p) => s + (p.monto||0), 0);
  for (let i = 0; i < saldos.length && abonoPendiente > 0; i++) {
    const reduccion = Math.min(saldos[i].saldo, abonoPendiente);
    saldos[i].saldo -= reduccion;
    abonoPendiente  -= reduccion;
  }

  // Calcular interés individual por ministración (sobre su saldo vigente)
  let interesTotal = 0;
  const detalle = saldos.map(m => {
    const dias      = Math.max(0, Math.round((hoy - new Date(m.fecha)) / 86400000));
    const interes   = Math.round(m.saldo * tasa * dias);
    interesTotal   += interes;
    return { ...m, dias, interes };
  });

  const saldoCapital = (saldos||[]).reduce((s, m) => s + (m.saldo||0), 0);
  return { detalle, interesTotal, saldoCapital };
}

// Gastos/diesel que van a crédito generan interés desde su fecha de registro
export function calcularInteresCargosCredito(gastos, diesel, tasaAnual) {
  const hoy  = new Date();
  const tasa = tasaAnual / 100 / 365;
  let total  = 0;
  const items = [];

  // Gastos a crédito
  gastos.filter(g => g.formaPago === "credito").forEach(g => {
    const dias    = Math.max(0, Math.round((hoy - new Date(g.fecha)) / 86400000));
    const interes = Math.round(g.monto * tasa * dias);
    total += interes;
    items.push({ fecha: g.fecha, concepto: g.concepto, monto: g.monto, dias, interes, tipo: "Gasto" });
  });

  // Diesel a crédito
  diesel.filter(d => d.formaPago === "credito").forEach(d => {
    const monto   = d.litros * d.precioLitro;
    const dias    = Math.max(0, Math.round((hoy - new Date(d.fecha)) / 86400000));
    const interes = Math.round(monto * tasa * dias);
    total += interes;
    items.push({ fecha: d.fecha, concepto: `Diesel: ${d.concepto}`, monto, dias, interes, tipo: "Diesel" });
  });

  return { items, total };
}

// ─── ESTADO DE VENCIMIENTO DEL CRÉDITO ────────────────────────────────────────
// ─── EXPORT A EXCEL GLOBAL ────────────────────────────────────────────────────
export function exportarExcel(nombreArchivo, hojas) {
  // hojas = [{ nombre, headers:[], rows:[[]] }]
  // Usa SheetJS si está disponible, sino CSV fallback
  try {
    if (typeof XLSX !== "undefined") {
      const wb = XLSX.utils.book_new();
      hojas.forEach(({ nombre, headers, rows }) => {
        const data = [headers, ...rows];
        const ws   = XLSX.utils.aoa_to_sheet(data);
        // Ancho de columnas automático
        ws["!cols"] = headers.map((_,i) => ({
          wch: Math.max(headers[i]?.length||10,
            ...rows.map(r => String(r[i]||"").length)
          ) + 2
        }));
        XLSX.utils.book_append_sheet(wb, ws, nombre.substring(0,31));
      });
      XLSX.writeFile(wb, `${nombreArchivo}.xlsx`);
    } else {
      // Fallback CSV
      const { headers, rows } = hojas[0];
      const csv = [headers, ...rows].map(r => r.map(c =>
        `"${String(c||"").replace(/"/g,'""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type:"text/csv;charset=utf-8;" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${nombreArchivo}.csv`;
      a.click();
    }
  } catch(e) { console.error("Export error:", e); }
}

// Botón de exportar reutilizable
// [removed: BtnExport → imported from shared/core]

export function calcularVencimiento(credito) {
  if (!credito.fechaVencimiento) return null;
  const hoy   = new Date(); hoy.setHours(0,0,0,0);
  const vence = new Date(credito.fechaVencimiento + "T00:00:00");
  const diasRest = Math.round((vence - hoy) / 86400000);
  const vencido  = diasRest < 0;
  const diasMora = vencido ? Math.abs(diasRest) : 0;

  const { saldoCapital } = calcularInteresCredito(credito);
  const tasaMora = (credito.tasaMoratoria || 0) / 100 / 365;
  const interesMoratorio = vencido && tasaMora > 0
    ? Math.round(saldoCapital * tasaMora * diasMora)
    : 0;

  let nivel, color, bg, icono, mensaje;
  if (vencido) {
    nivel="vencido"; icono="🔴"; color="#c0392b"; bg="#fdf0ef";
    mensaje = `Crédito VENCIDO hace ${diasMora} día${diasMora!==1?"s":""}`;
  } else if (diasRest<=7) {
    nivel="critico"; icono="🔴"; color="#c0392b"; bg="#fdf0ef";
    mensaje = `Vence en ${diasRest} día${diasRest!==1?"s":""}`;
  } else if (diasRest<=15) {
    nivel="urgente"; icono="🟠"; color="#d35400"; bg="#fef5ec";
    mensaje = `Vence en ${diasRest} días — acción urgente`;
  } else if (diasRest<=30) {
    nivel="alerta"; icono="🟡"; color="#b7950b"; bg="#fefde7";
    mensaje = `Vence en ${diasRest} días — programa el pago`;
  } else {
    nivel="ok"; icono="🟢"; color=T.field; bg="#eafaf1";
    mensaje = `${diasRest} días para vencimiento`;
  }

  return { diasRest, vencido, diasMora, interesMoratorio, nivel, color, bg, icono, mensaje, saldoCapital };
}

// [removed: Modal → imported from shared/core]

// ─── SHARED FINANCIALS ENGINE ─────────────────────────────────────────────────
// Central function — all financial modules call this to get consistent numbers
// Pass filtrarPorProductor(state) to get producer-specific numbers
// ── Helper: obtener precio y rendimiento del cultivo/ciclo activo ────────────
export function getParamsCultivo(state) {
  const cicloId  = state.cicloActivoId || 1;
  const cultivo  = state.cultivoActivo;
  const ciclo    = (state.ciclos||[]).find(c=>c.id===cicloId);
  const cultivos = ciclo?.cultivosDelCiclo||[];
  const cv       = cultivo || (cultivos.length===1 ? cultivos[0] : null);
  const key      = cv ? `${cicloId}|${cv.cultivoId}|${cv.variedad}` : `${cicloId}|global`;
  const allParams = state.paramsCultivo || {};

  // Buscar por key exacta primero
  let params = allParams[key];

  // Si no hay key exacta y no hay cultivo activo, buscar cualquier key guardada del ciclo
  if (!params && !cultivo) {
    const cicloKey = Object.keys(allParams).find(k => k.startsWith(`${cicloId}|`));
    if (cicloKey) params = allParams[cicloKey];
  }

  return {
    precio:      params?.precio      ?? state.precioVentaMXN      ?? 4800,
    rendimiento: params?.rendimiento ?? state.rendimientoEsperado ?? 9.1,
    key,
    cv,
  };
}

export function calcularFinancieros(state) {
  // ── Hectáreas del ciclo activo ──────────────────────────────────────────────
  const cicloPred   = (state.ciclos||[]).find(c=>c.id===state.cicloActivoId)||(state.ciclos||[]).find(c=>c.id===state.cicloActivoId)||(state.ciclos||[]).find(c=>c.predeterminado)||(state.ciclos||[])[0];
  const _cultAct    = state.cultivoActivo; // { cultivoId, variedad } | null
  const asigsCiclo  = (cicloPred?.asignaciones||[]).filter(a=>
    !_cultAct || (a.cultivoId===_cultAct.cultivoId && a.variedad===_cultAct.variedad)
  );
  const ha          = (asigsCiclo||[]).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);

  // ── Producción (real si hay cosecha, estimada si no) ───────────────────────
  const _params      = getParamsCultivo(state);
  const cosechaRegs  = (state.cosecha?.boletas||state.cosecha?.registros||[]);
  const produccionReal = (cosechaRegs||[]).reduce((s,b)=>s+(parseFloat(b.pesoNeto||b.toneladas)||0),0);
  const rendEspProm  = _params.rendimiento;
  const produccionEst= produccionReal > 0 ? produccionReal : ha * rendEspProm;
  const precio       = _params.precio;
  const ingresoEst   = produccionEst * precio;
  const hayProduccionReal = produccionReal > 0;

  // ── Costos operativos con datos reales ─────────────────────────────────────
  const _cF = state.cicloActivoId||1;
  // Productores del cultivo activo (si hay filtro de cultivo)
  const _prodsCultivo = _cultAct
    ? [...new Set((cicloPred?.asignaciones||[])
        .filter(a=>a.cultivoId===_cultAct.cultivoId&&a.variedad===_cultAct.variedad)
        .map(a=>String(a.productorId)))]
    : null; // null = sin filtro
  const _filtProd = (pid) => !_prodsCultivo || _prodsCultivo.includes(String(pid));
  const insumos     = (state.insumos||[]).filter(i=>!i.cancelado&&(i.cicloId||1)===_cF&&_filtProd(i.productorId));
  const dieselRegs  = (state.diesel||[]).filter(d=>!d.cancelado&&(d.cicloId||1)===_cF&&_filtProd(d.productorId));
  const egresosMan  = (state.egresosManual||[]).filter(e=>!e.cancelado&&(e.cicloId||1)===_cF&&_filtProd(e.productorId));

  const costoSemilla  = insumos.filter(i=>i.categoria==="Semilla").reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
  const costoInsumos  = insumos.filter(i=>i.categoria!=="Semilla").reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
  const costoDiesel   = (dieselRegs||[]).reduce((s,d)=>s+(parseFloat(d.importe)||0),0);
  const costoRenta    = egresosMan.filter(e=>e.categoria==="renta_tierra").reduce((s,e)=>s+(parseFloat(e.monto)||0),0);
  const costoManoObra = egresosMan.filter(e=>e.categoria==="mano_obra").reduce((s,e)=>s+(parseFloat(e.monto)||0),0);
  const costoAgua     = egresosMan.filter(e=>e.categoria==="pago_agua").reduce((s,e)=>s+(parseFloat(e.monto)||0),0);
  const costoSeguros  = egresosMan.filter(e=>e.categoria==="seguros").reduce((s,e)=>s+(parseFloat(e.monto)||0),0);
  const costoTramites = egresosMan.filter(e=>["tramites","permiso_siembra","flete","reparaciones"].includes(e.categoria)).reduce((s,e)=>s+(parseFloat(e.monto)||0),0);
  const costoOtros    = egresosMan.filter(e=>e.categoria==="otro").reduce((s,e)=>s+(parseFloat(e.monto)||0),0);

  // Cosecha (cuando haya datos)
  const costoCosecha  = [
    ...(state.cosecha?.cuadrillas||[]).map(c=>c.ha*c.precioHa),
    ...(state.cosecha?.fletes||[]).map(f=>f.toneladas*f.precioTon),
    ...(state.cosecha?.maquila||[]).map(m=>m.ha*m.precioHa),
    ...(state.cosecha?.secado||[]).map(s=>s.toneladas*s.costoTon),
  ].reduce((s,v)=>s+v,0);

  // Intereses y comisiones — cálculo detallado movimiento a movimiento (igual que CreditoModule)
  const params = { ...{para_tasaAnual:1.38,para_factibilidad:1.25,para_fega:2.3,para_asistTec:200,dir_tasaAnual:1.8,dir_factibilidad:1.5,dir_fega:2.3,iva:16}, ...(state.creditoParams||{}) };
  const expedientes = state.expedientes||[];
  let costoInteresPara = 0, costoInteresDir = 0;
  let capitalAplicadoPara = 0, capitalAplicadoDir = 0;
  let costoComisionesPara = 0, costoComisionesDir = 0;
  const hoy = new Date();
  const dispersiones = (state.dispersiones||[]).filter(d=>!d.cancelado&&((d.cicloId||1)===(state.cicloActivoId||1)));
  const diasDesdeF = f => f ? Math.max(0,Math.round((hoy-new Date(f))/86400000)) : 0;

  (state.productores||[]).forEach(p => {
    const exp = expedientes.find(e=>e.productorId===p.id);
    const haProd = asigsCiclo.filter(a=>String(a.productorId)===String(p.id)).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);
    const creditoAut = exp?.montoPorHa ? haProd * exp.montoPorHa : 0;
    const gSem = insumos.filter(i=>String(i.productorId)===String(p.id)).reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
    const gDie = dieselRegs.filter(d=>String(d.productorId)===String(p.id)).reduce((s,d)=>s+(parseFloat(d.importe)||0),0);
    const gEfe = egresosMan.filter(e=>String(e.productorId)===String(p.id)).reduce((s,e)=>s+(parseFloat(e.monto)||0),0);
    const gastoTot = gSem + gDie + gEfe;
    if (!gastoTot && !creditoAut) return;

    // Todos los movimientos del productor ordenados por fecha (usado en ambos tramos)
    const movsAll = [
      ...insumos.filter(i=>String(i.productorId)===String(p.id)).map(i=>({fecha:i.fechaSolicitud||i.fechaOrden||"",monto:parseFloat(i.importe)||0})),
      ...dieselRegs.filter(d=>String(d.productorId)===String(p.id)).map(d=>({fecha:d.fechaSolicitud||d.fechaOrden||"",monto:parseFloat(d.importe)||0})),
      ...egresosMan.filter(e=>String(e.productorId)===String(p.id)).map(e=>({fecha:e.fecha||e.semanaFechaInicio||"",monto:parseFloat(e.monto)||0})),
    ].filter(m=>m.monto>0).sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)));

    // ── PARAFINANCIERO ──
    const montoAplP = creditoAut > 0 ? Math.min(gastoTot, creditoAut) : 0;
    capitalAplicadoPara += montoAplP;
    if (montoAplP > 0) {
      let acumP = 0;
      movsAll.forEach(m => {
        const md = Math.min(m.monto, Math.max(0, montoAplP - acumP));
        acumP += md;
        costoInteresPara += ((md * (params.para_tasaAnual/100)) / 30) * diasDesdeF(m.fecha);
      });
      // Comisiones: factibilidad sobre crédito autorizado + FEGA sobre monto aplicado + AT por ha
      const factP  = creditoAut * (params.para_factibilidad/100) * (1 + params.iva/100);
      const fegaP  = montoAplP  * (params.para_fega/100)         * (1 + params.iva/100);
      const asistP = haProd * params.para_asistTec;
      costoComisionesPara += factP + fegaP + asistP;
    }

    // ── DIRECTO — tramo excedente del gasto sobre el tope parafinanciero ──
    let acumD = 0;
    const movsDirecto = movsAll.map(m => {
      const yaEnPara  = Math.min(m.monto, Math.max(0, creditoAut - acumD));
      const enDirecto = m.monto - yaEnPara;
      acumD += m.monto;
      return { fecha: m.fecha, montoDisp: enDirecto };
    }).filter(m=>m.montoDisp>0);
    capitalAplicadoDir += movsDirecto.reduce((s,m)=>s+m.montoDisp,0);
    if (movsDirecto.length > 0) {
      let factBaseD = 0, fegaBaseD = 0;
      movsDirecto.forEach(m => {
        const diasD = diasDesdeF(m.fecha);
        costoInteresDir += ((m.montoDisp * (params.dir_tasaAnual/100)) / 30) * diasD;
        factBaseD += m.montoDisp * (params.dir_factibilidad/100);
        fegaBaseD += ((m.montoDisp * diasD) / 360) * (params.dir_fega/100);
      });
      costoComisionesDir += (factBaseD + fegaBaseD) * (1 + params.iva/100);
    }
  });
  const costoInteres = costoInteresPara + costoInteresDir;
  const costoComisiones = costoComisionesPara + costoComisionesDir;
  const costoFinanciero = costoInteres + costoComisiones;

  // ── Costo de maquinaria (horas × costo/hora) ─────────────────────────────
  const costoMaquinaria = (state.maquinaria||[]).reduce((total, maq) => {
    // Horas manuales
    const hManuales = (state.horasMaq||[])
      .filter(h=>String(h.maqId)===String(maq.id) && h.fuente!=='bitacora')
      .reduce((s,h)=>s+(parseFloat(h.horas)||0),0);
    // Horas desde bitácora
    const hBitacora = (state.bitacora||[])
      .filter(b=>String(b.maquinariaId)===String(maq.id) && parseFloat(b.horas)>0)
      .reduce((s,b)=>s+(parseFloat(b.horas)||0),0);
    return total + (hManuales + hBitacora) * (parseFloat(maq.costoHora)||0);
  }, 0);

  const costoTotal = costoSemilla + costoInsumos + costoDiesel + costoRenta +
    costoManoObra + costoAgua + costoSeguros + costoTramites + costoOtros +
    costoMaquinaria + costoCosecha + costoFinanciero;

  // ── Rentabilidad ────────────────────────────────────────────────────────────
  const utilidadBruta = ingresoEst - costoTotal;
  const margen        = ingresoEst > 0 ? utilidadBruta/ingresoEst*100 : 0;
  const peTon         = precio > 0 ? costoTotal/precio : 0;
  const peHa          = ha > 0 ? peTon/ha : 0;
  const costoTon      = produccionEst > 0 ? costoTotal/produccionEst : 0;

  // ── Capital (legacy) ────────────────────────────────────────────────────────
  const totalAport  = (state.capital?.aportaciones||[]).reduce((s,a)=>s+(parseFloat(a.monto)||0),0);
  const totalRetiro = (state.capital?.retiros||[]).reduce((s,r)=>s+(parseFloat(r.monto)||0),0);
  const capitalNeto = totalAport - totalRetiro;
  const valorActivos= (state.activos||[]).reduce((s,a)=>s+(a.valorAdq||0),0);

  return {
    ha, produccionEst, produccionReal, hayProduccionReal, precio, ingresoEst,
    costoSemilla, costoInsumos, costoDiesel, costoRenta,
    costoManoObra, costoAgua, costoSeguros, costoTramites, costoOtros,
    costoCosecha, costoMaquinaria, costoInteres, costoInteresPara, costoInteresDir,
    costoComisiones, costoFinanciero,
    capitalAplicadoPara, capitalAplicadoDir,
    capitalAplicadoTotal: capitalAplicadoPara + capitalAplicadoDir,
    costoComisionesPara, costoComisionesDir,
    costoTotal, utilidadBruta, margen, peTon, peHa, costoTon,
    totalAport, totalRetiro, capitalNeto, valorActivos,
    // legacy aliases
    costoInsumosLegacy: costoSemilla + costoInsumos,
    costoGastos: costoManoObra + costoAgua + costoSeguros + costoTramites + costoOtros,
    saldoHab:0, saldoRef:0, totalPasivos:costoInteres,
    intHab:costoInteresPara, intCargosCred:0, intMoraHab:0, intRef:costoInteresDir,
  };
}

// ─── HELPER: fila/celda navegable — uso: <tr {...navRow(()=>nav('gastos',5))}> ──
export function navRowProps(onClick) {
  return {
    onClick,
    style: { cursor:"pointer" },
    onMouseEnter: e => { e.currentTarget.style.filter = "brightness(0.93)"; e.currentTarget.style.background = e.currentTarget.style.background || "#f7f5ef"; },
    onMouseLeave: e => { e.currentTarget.style.filter = ""; e.currentTarget.style.background = ""; },
    title: "Ver detalle →",
  };
}
// Badge "→ módulo" para cabeceras de tarjeta
// [removed: NavBadge → imported from shared/core]

// ─── FILTRO SELECT — dropdown inteligente reutilizable ───────────────────────
// opciones: [{ valor, label, sub, monto, count, color }]
export function exportarExcelProductor(p, datos, state) {
  const {ha,totalDisp,disP,totalSemilla,totalInsumos,totalDiesel,totalEfectivo,
    totalGastos,intPara,intDir,comPara,comDir,totalInt,totalCom,totalLiquidar,
    xha,diasCred,lotesP,dispsSorted,creditoAut,saldoDisp,params} = datos;
  const cid = state.cicloActivoId||1;
  const mxn = n => parseFloat(n)||0;
  const ciclo = (state.ciclos||[]).find(c=>c.id===cid);
  const hoy = new Date().toLocaleDateString("es-MX");
  const insP = (state.insumos||[]).filter(i=>!i.cancelado&&(i.cicloId||1)===cid&&String(i.productorId)===String(p.id));
  const dieP = (state.diesel||[]).filter(d=>!d.cancelado&&(d.cicloId||1)===cid&&String(d.productorId)===String(p.id));
  const egrP = (state.egresosManual||[]).filter(e=>!e.cancelado&&(e.cicloId||1)===cid&&String(e.productorId)===String(p.id));

  exportarExcel(`EstadoCuenta_${p.alias||p.apPat}_${ciclo?.nombre||"ciclo"}`, [
    {
      nombre: "Estado de Cuenta",
      headers: ["Concepto", "Importe"],
      rows: [
        ["=== DATOS DEL PRODUCTOR ===", ""],
        ["Nombre", [p.nombres,p.apPat,p.apMat].filter(Boolean).join(" ")],
        ["Alias", p.alias||"—"],
        ["RFC", p.rfc||"—"],
        ["Ciclo", ciclo?.nombre||state.cicloActual||""],
        ["Fecha emisión", hoy],
        ["Hectáreas", mxn(ha)],
        ["", ""],
        ["=== ESTADO DE CUENTA ===", ""],
        ["Crédito autorizado", mxn(creditoAut)],
        ["Total dispersado", mxn(totalDisp)],
        ["", ""],
        ["-- Gasto Operativo --", ""],
        ["Semilla", mxn(totalSemilla)],
        ["Insumos (sin semilla)", mxn(totalInsumos)],
        ["Diesel", mxn(totalDiesel)],
        ...(totalEfectivo>0?[["Efectivo / otros", mxn(totalEfectivo)]]:[] ),
        ["SUBTOTAL OPERATIVO", mxn(totalGastos)],
        ["", ""],
        ["-- Costos Financieros --", ""],
        ["Interés parafinanciero", mxn(intPara)],
        ["Interés directo", mxn(intDir)],
        ["Comisiones parafinanciero", mxn(comPara)],
        ["Comisiones directo", mxn(comDir)],
        ["SUBTOTAL FINANCIERO", mxn(totalInt+totalCom)],
        ["", ""],
        ["TOTAL A LIQUIDAR", mxn(totalLiquidar)],
        ["Costo por hectárea", mxn(xha)],
        ["Saldo disponible", mxn(Math.max(0,saldoDisp))],
      ]
    },
    {
      nombre: "Dispersiones",
      headers: ["Fecha","Línea","# Solicitud","Monto","Días","Interés acum."],
      rows: dispsSorted.map(d=>{
        const dias2 = Math.max(0,Math.round((new Date()-new Date(d.fecha))/86400000));
        const m = mxn(d.monto);
        const isPara = d.lineaCredito==="parafinanciero";
        const tasa = isPara ? params.para_tasaAnual : params.dir_tasaAnual;
        return [d.fecha||"",isPara?"Parafinanciero":"Directo",d.numSolicitud||"",m,dias2,m*(tasa/100)/30*dias2];
      })
    },
    {
      nombre: "Insumos",
      headers: ["# Sol","# Orden","Fecha","Categoría","Insumo","Cantidad","Unidad","Importe","Proveedor","Estatus"],
      rows: insP.map(i=>[i.numSolicitud||"",i.numOrden||"",i.fechaSolicitud||"",i.categoria||"",i.insumo||"",mxn(i.cantidad),i.unidad||"",mxn(i.importe),i.proveedor||"",i.estatus||""])
    },
    {
      nombre: "Diesel",
      headers: ["Fecha","Cantidad (L)","Precio/L","Importe","Estatus"],
      rows: dieP.map(d=>[d.fechaSolicitud||"",mxn(d.cantidad),mxn(d.precioUnitario),mxn(d.importe),d.estatus||""])
    },
    ...(egrP.length>0?[{
      nombre: "Egresos",
      headers: ["Fecha","Categoría","Concepto","Monto"],
      rows: egrP.map(e=>[e.fecha||"",e.categoria||"",e.concepto||"",mxn(e.monto)])
    }]:[]),
    {
      nombre: "Lotes",
      headers: ["Apodo","Propietario","Ejido","Ha Crédito","Ha Módulo"],
      rows: lotesP.map(l=>[l.apodo||"",l.propietario||"",l.ejido||"",mxn(l.supCredito),mxn(l.supModulo)])
    },
  ]);
}

// ─── DESCARGAR HTML (para imprimir/PDF desde navegador) ──────────────────────
export function descargarHTML(nombreArchivo, htmlContent) {
  const blob = new Blob([htmlContent], {type:"text/html;charset=utf-8"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = nombreArchivo+".html";
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

export function generarHTMLProductor(p, datos, state) {
  const {ha,totalDisp,disP,totalSemilla,totalInsumos,totalDiesel,totalEfectivo,
    totalGastos,intPara,intDir,comPara,comDir,totalInt,totalCom,totalLiquidar,
    xha,diasCred,lotesP,dispsSorted,creditoAut,saldoDisp,params} = datos;
  const mxn = n => (parseFloat(n)||0).toLocaleString("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:2,maximumFractionDigits:2});
  const fmt2 = n => (parseFloat(n)||0).toFixed(2);
  const cid  = state.cicloActivoId||1;
  const ciclo= (state.ciclos||[]).find(c=>c.id===cid);
  const hoy  = new Date().toLocaleDateString("es-MX",{day:"2-digit",month:"long",year:"numeric"});
  const nomC = [p.nombres,p.apPat,p.apMat].filter(Boolean).join(" ");

  const CSS = `*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:13px;color:#222;background:white;padding:24px}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:3px solid #2d5a1b}
  .logo{font-size:22px;font-weight:800;color:#2d5a1b}.logo-sub{font-size:11px;color:#888;margin-top:2px}
  .prod-box{background:#f0f7ec;border-left:4px solid #2d5a1b;padding:12px 16px;margin-bottom:20px;border-radius:4px}
  .kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:20px}
  .kpi{background:#f9f9f9;border:1px solid #e0e0e0;border-radius:6px;padding:8px 10px;text-align:center}
  .kpi-l{font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}
  .kpi-v{font-family:monospace;font-size:13px;font-weight:700}
  .sec{font-size:13px;font-weight:700;color:#2d5a1b;margin:16px 0 8px;padding-bottom:4px;border-bottom:1px solid #c8e0c8}
  table{width:100%;border-collapse:collapse;margin-bottom:16px}
  th{background:#2d5a1b;color:white;padding:7px 10px;font-size:11px;text-align:left}
  th.r{text-align:right} td{padding:6px 10px;border-bottom:1px solid #f0f0f0;font-size:12px}
  .tot td{background:#f0f7ec;font-weight:700;border-top:2px solid #2d5a1b}
  .sep td{background:#f5f5f5;height:4px;padding:0}
  .firma{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:50px}
  .firma-box{text-align:center}.firma-l{border-top:1px solid #333;padding-top:6px;margin-top:50px;font-size:11px;color:#555}
  .footer{margin-top:24px;padding-top:10px;border-top:1px solid #e0e0e0;font-size:10px;color:#aaa;text-align:center}
  .print-btn{background:#1a6ea8;color:white;border:none;padding:10px 24px;border-radius:6px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:16px}
  @media print{.no-print{display:none!important}@page{margin:1.5cm;size:letter portrait}}`;

  const row = (l,v,bold=false,indent=false,color="#444") => v>0 ? `
    <tr style="background:${bold?"#f5f5f5":"white"}">
      <td style="padding:6px ${indent?24:10}px;font-size:12px;color:${bold?"#222":"#555"};font-weight:${bold?700:400}">${l}</td>
      <td style="padding:6px 10px;text-align:right;font-family:monospace;font-size:12px;font-weight:${bold?700:500};color:${color}">${mxn(v)}</td>
    </tr>` : "";

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Estado de Cuenta — ${p.alias||p.apPat}</title><style>${CSS}</style></head><body>
  <div class="no-print" style="text-align:right;margin-bottom:8px">
    <button class="print-btn" onclick="window.print()">🖨 Imprimir / Guardar como PDF</button>
  </div>
  <div class="hdr">
    <div><div class="logo">AgroSistema Charay</div><div class="logo-sub">Control Agrícola Integral · ${ciclo?.nombre||""}</div></div>
    <div style="text-align:right"><div style="font-weight:700;font-size:15px">ESTADO DE CUENTA</div>
      <div style="font-size:11px;color:#888">Fecha: ${hoy}</div>
      <div style="font-size:11px;color:#888">Ciclo: ${ciclo?.nombre||""}</div></div>
  </div>
  <div class="prod-box">
    <div style="font-size:18px;font-weight:700;color:#2d5a1b">${p.alias||p.apPat}</div>
    <div style="font-size:11px;color:#666;margin-top:3px">${nomC} · RFC: ${p.rfc||"—"} · Tel: ${p.telefono||"—"}</div>
  </div>
  <div class="kpis">
    ${[["Hectáreas",fmt2(ha)+" ha","#2d5a1b"],["Dispersado",mxn(totalDisp),"#1a6ea8"],
       ["Gasto Operativo",mxn(totalGastos),"#c0392b"],["Int.+Com.",mxn(totalInt+totalCom),"#9b6d3a"],
       ["Total a Liquidar",mxn(totalLiquidar),"#c0392b"]].map(([l,v,c])=>
      `<div class="kpi"><div class="kpi-l">${l}</div><div class="kpi-v" style="color:${c}">${v}</div></div>`).join("")}
  </div>
  <div class="sec">📋 Estado de Cuenta Detallado</div>
  <table><colgroup><col style="width:65%"><col style="width:35%"></colgroup><tbody>
    ${row("🏦 Crédito autorizado",creditoAut,false,false,"#1a6ea8")}
    ${row("💰 Total dispersado",totalDisp,false,false,"#2d5a1b")}
    <tr class="sep"><td colspan="2"></td></tr>
    ${row("🌽 Semilla",totalSemilla,false,true)}
    ${row("🌿 Insumos (fertilizantes/agroquímicos)",totalInsumos,false,true)}
    ${row("⛽ Diesel y combustible",totalDiesel,false,true)}
    ${totalEfectivo>0?row("💵 Efectivo / otros gastos",totalEfectivo,false,true):""}
    ${row("Subtotal gasto operativo",totalGastos,true,false,"#c0392b")}
    <tr class="sep"><td colspan="2"></td></tr>
    ${intPara>0?row(`📈 Interés parafinanciero (${params.para_tasaAnual}% mensual · ${diasCred} días)`,intPara,false,true):""}
    ${intDir>0?row(`📈 Interés directo (${params.dir_tasaAnual}% mensual · ${diasCred} días)`,intDir,false,true):""}
    ${comPara>0?row("🏷 Comisiones parafinanciero",comPara,false,true):""}
    ${comDir>0?row("🏷 Comisiones crédito directo",comDir,false,true):""}
    ${row("Subtotal financiero",totalInt+totalCom,true,false,"#9b6d3a")}
    <tr class="sep"><td colspan="2"></td></tr>
    <tr style="background:#fdf0ef">
      <td style="padding:10px;font-size:14px;font-weight:800;color:#c0392b">TOTAL A LIQUIDAR</td>
      <td style="padding:10px;text-align:right;font-family:monospace;font-size:15px;font-weight:800;color:#c0392b">${mxn(totalLiquidar)}</td>
    </tr>
    <tr><td style="padding:6px 10px;font-size:11px;color:#888">Costo por hectárea</td>
      <td style="padding:6px 10px;text-align:right;font-family:monospace;font-size:11px;color:#888">${mxn(xha)}/ha</td></tr>
    ${saldoDisp>0?`<tr><td style="padding:6px 10px;font-size:11px;color:#2d5a1b">Saldo disponible del crédito</td>
      <td style="padding:6px 10px;text-align:right;font-family:monospace;font-size:11px;color:#2d5a1b">${mxn(Math.max(0,saldoDisp))}</td></tr>`:""}
  </tbody></table>

  ${dispsSorted.length>0?`
  <div class="sec">🏦 Dispersiones de Crédito</div>
  <table><thead><tr><th>Fecha</th><th>Línea</th><th># Solicitud</th><th class="r">Monto</th><th class="r">Días</th><th class="r">Interés acum.</th></tr></thead>
  <tbody>${dispsSorted.map((d,i)=>{
    const dias2=Math.max(0,Math.round((new Date()-new Date(d.fecha))/86400000));
    const m=parseFloat(d.monto)||0; const isPara=d.lineaCredito==="parafinanciero";
    const intD=m*((isPara?params.para_tasaAnual:params.dir_tasaAnual)/100)/30*dias2;
    return `<tr style="background:${i%2===0?"white":"#fafafa"}">
      <td style="font-family:monospace">${d.fecha||"—"}</td>
      <td><span style="padding:2px 6px;border-radius:8px;font-size:10px;font-weight:700;background:${isPara?"#dbeafe":"#ede9fe"};color:${isPara?"#1a6ea8":"#8e44ad"}">${isPara?"Parafinanciero":"Directo"}</span></td>
      <td style="font-family:monospace;color:#888">${d.numSolicitud||"—"}</td>
      <td style="text-align:right;font-family:monospace;font-weight:700;color:#2d5a1b">${mxn(m)}</td>
      <td style="text-align:right;font-family:monospace">${dias2}</td>
      <td style="text-align:right;font-family:monospace;color:#c0392b">${mxn(intD)}</td></tr>`;
  }).join("")}
  <tr class="tot"><td colspan="3">TOTAL</td><td style="text-align:right;font-family:monospace;color:#2d5a1b">${mxn(totalDisp)}</td>
    <td></td><td style="text-align:right;font-family:monospace;color:#c0392b">${mxn(totalInt)}</td></tr>
  </tbody></table>`:""}

  ${lotesP.length>0?`
  <div class="sec">🗺 Lotes Asignados</div>
  <table><thead><tr><th>Apodo/Módulo</th><th>Propietario</th><th>Ejido</th><th class="r">Ha Crédito</th><th class="r">Ha Módulo</th></tr></thead>
  <tbody>${lotesP.map((l,i)=>`<tr style="background:${i%2===0?"white":"#fafafa"}">
    <td style="font-weight:600">${l.apodo||"—"}</td><td style="font-size:11px;color:#666">${l.propietario||"—"}</td>
    <td style="font-size:11px;color:#666">${l.ejido||"—"}</td>
    <td style="text-align:right;font-family:monospace;font-weight:700;color:#1a6ea8">${fmt2(l.supCredito)} ha</td>
    <td style="text-align:right;font-family:monospace;color:#888">${fmt2(l.supModulo)} ha</td></tr>`).join("")}
  <tr class="tot"><td colspan="3">TOTAL</td><td style="text-align:right;font-family:monospace;color:#1a6ea8">${fmt2(ha)} ha</td><td></td></tr>
  </tbody></table>`:""}

  <div class="firma">
    <div class="firma-box"><div class="firma-l"><strong>${nomC||p.alias}</strong><br>Productor · RFC: ${p.rfc||"—"}</div></div>
    <div class="firma-box"><div class="firma-l">Representante AGROFRAGA<br>Concepción de Charay, El Fuerte, Sinaloa</div></div>
  </div>
  <div class="footer">Generado el ${hoy} · AgroSistema Charay · ${ciclo?.nombre||""} · Documento informativo sujeto a verificación contable.</div>
</body></html>`;
}

// Todos los productores en un solo HTML con saltos de página
export function generarHTMLTodos(state) {
  const cid      = state.cicloActivoId||1;
  const ciclo    = (state.ciclos||[]).find(c=>c.id===cid);
  const asigs    = ciclo?.asignaciones||[];
  const params   = {para_tasaAnual:1.38,dir_tasaAnual:1.8,para_factibilidad:1.25,
    para_fega:2.3,para_asistTec:200,dir_factibilidad:1.5,dir_fega:2.3,iva:16,...(state.creditoParams||{})};
  const calcHa   = pid => asigs.filter(a=>String(a.productorId)===String(pid)).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);

  const pages = (state.productores||[]).map(p => {
    const ha        = calcHa(p.id);
    const insP      = (state.insumos||[]).filter(i=>!i.cancelado&&(i.cicloId||1)===cid&&String(i.productorId)===String(p.id));
    const dieP      = (state.diesel||[]).filter(d=>!d.cancelado&&(d.cicloId||1)===cid&&String(d.productorId)===String(p.id));
    const egrP      = (state.egresosManual||[]).filter(e=>!e.cancelado&&(e.cicloId||1)===cid&&String(e.productorId)===String(p.id));
    const disP      = (state.dispersiones||[]).filter(d=>!d.cancelado&&(d.cicloId||1)===cid&&String(d.productorId)===String(p.id));
    if(!insP.length&&!dieP.length&&!egrP.length&&!disP.length) return null;
    const tSem = insP.filter(i=>i.categoria==="Semilla").reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
    const tIns = insP.filter(i=>i.categoria!=="Semilla").reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
    const tDie = dieP.reduce((s,d)=>s+(parseFloat(d.importe)||0),0);
    const tEfe = egrP.reduce((s,e)=>s+(parseFloat(e.monto)||0),0);
    const tGas = tSem+tIns+tDie+tEfe;
    const tDis = disP.reduce((s,d)=>s+(parseFloat(d.monto)||0),0);
    const exp  = (state.expedientes||[]).find(e=>e.productorId===p.id);
    const credAut = exp?.montoPorHa ? ha*exp.montoPorHa : 0;
    const monP = credAut>0?Math.min(tGas,credAut):0;
    const monD = Math.max(0,tGas-monP);
    const disSort = [...disP].sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)));
    const diasC = disSort[0] ? Math.max(0,Math.round((new Date()-new Date(disSort[0].fecha))/86400000)) : 0;
    const iP = monP*(params.para_tasaAnual/100)/30*diasC;
    const iD = monD*(params.dir_tasaAnual/100)/30*diasC;
    const cP = (monP*(params.para_factibilidad/100)+monP*(params.para_fega/100)+ha*params.para_asistTec)*(1+params.iva/100);
    const cD = (monD*(params.dir_factibilidad/100)+monD*(params.dir_fega/100))*(1+params.iva/100);
    const tLiq = tGas+iP+iD+cP+cD;
    const lotesP = (state.lotes||[]).filter(l=>asigs.some(a=>String(a.loteId)===String(l.id)&&String(a.productorId)===String(p.id)));
    return generarHTMLProductor(p, {ha,totalDisp:tDis,disP,totalSemilla:tSem,totalInsumos:tIns,
      totalDiesel:tDie,totalEfectivo:tEfe,totalGastos:tGas,intPara:iP,intDir:iD,comPara:cP,comDir:cD,
      totalInt:iP+iD,totalCom:cP+cD,totalLiquidar:tLiq,xha:ha>0?tLiq/ha:0,diasCred:diasC,
      lotesP,dispsSorted:disSort,creditoAut:credAut,saldoDisp:tDis-tGas,params,montoP:monP,montoD:monD}, state);
  }).filter(Boolean);

  // Unir todas las páginas con salto de página entre cada una
  const hoy = new Date().toLocaleDateString("es-MX",{day:"2-digit",month:"long",year:"numeric"});
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Estados de Cuenta — Todos los Productores — ${ciclo?.nombre||""}</title>
  <style>
    @media print { .page-break { page-break-after: always; } .no-print { display:none!important } @page{margin:1.5cm;size:letter portrait} }
    body { font-family: Arial, sans-serif; }
    .cover { text-align:center; padding:80px 40px; border-bottom:3px solid #2d5a1b; margin-bottom:40px; }
    .no-print { background:#1a6ea8;color:white;border:none;padding:10px 24px;border-radius:6px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:16px; }
  </style>
  </head><body>
  <div class="no-print" style="text-align:right;padding:12px">
    <button class="no-print" onclick="window.print()">🖨 Imprimir todos / Guardar como PDF</button>
  </div>
  <div class="cover">
    <h1 style="font-size:28px;color:#2d5a1b;margin-bottom:8px">AgroSistema Charay</h1>
    <p style="font-size:16px;color:#555">Estados de Cuenta — Todos los Productores</p>
    <p style="font-size:14px;color:#888;margin-top:8px">Ciclo: ${ciclo?.nombre||""} · Generado: ${hoy}</p>
    <p style="font-size:13px;color:#aaa;margin-top:4px">${pages.length} productores con movimientos</p>
  </div>
  ${pages.map((html,i) => {
    // Extract just the body content from each page
    const bodyMatch = html.match(/<body>([\s\S]*)<\/body>/);
    const content = bodyMatch ? bodyMatch[1] : html;
    // Remove individual print buttons from each page
    const clean = content.replace(/<div class="no-print"[\s\S]*?<\/div>/,'');
    return `<div class="page-break" style="margin-bottom:20px">${clean}</div>`;
  }).join('\n')}
  </body></html>`;
}

// Todos los productores en Excel consolidado
export function exportarExcelTodos(state) {
  const cid    = state.cicloActivoId||1;
  const ciclo  = (state.ciclos||[]).find(c=>c.id===cid);
  const asigs  = ciclo?.asignaciones||[];
  const params = {para_tasaAnual:1.38,dir_tasaAnual:1.8,para_factibilidad:1.25,
    para_fega:2.3,para_asistTec:200,dir_factibilidad:1.5,dir_fega:2.3,iva:16,...(state.creditoParams||{})};
  const calcHa = pid => asigs.filter(a=>String(a.productorId)===String(pid)).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);
  const mxn = n => parseFloat(n)||0;

  const resumenRows = (state.productores||[]).map(p => {
    const ha   = calcHa(p.id);
    const insP = (state.insumos||[]).filter(i=>!i.cancelado&&(i.cicloId||1)===cid&&String(i.productorId)===String(p.id));
    const dieP = (state.diesel||[]).filter(d=>!d.cancelado&&(d.cicloId||1)===cid&&String(d.productorId)===String(p.id));
    const egrP = (state.egresosManual||[]).filter(e=>!e.cancelado&&(e.cicloId||1)===cid&&String(e.productorId)===String(p.id));
    const disP = (state.dispersiones||[]).filter(d=>!d.cancelado&&(d.cicloId||1)===cid&&String(d.productorId)===String(p.id));
    if(!insP.length&&!dieP.length&&!egrP.length&&!disP.length) return null;
    const tSem = insP.filter(i=>i.categoria==="Semilla").reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
    const tIns = insP.filter(i=>i.categoria!=="Semilla").reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
    const tDie = dieP.reduce((s,d)=>s+(parseFloat(d.importe)||0),0);
    const tEfe = egrP.reduce((s,e)=>s+(parseFloat(e.monto)||0),0);
    const tGas = tSem+tIns+tDie+tEfe;
    const tDis = disP.reduce((s,d)=>s+(parseFloat(d.monto)||0),0);
    const exp  = (state.expedientes||[]).find(e=>e.productorId===p.id);
    const credAut = exp?.montoPorHa ? ha*exp.montoPorHa : 0;
    const monP = credAut>0?Math.min(tGas,credAut):0;
    const monD = Math.max(0,tGas-monP);
    const disSort = [...disP].sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)));
    const diasC = disSort[0]?Math.max(0,Math.round((new Date()-new Date(disSort[0].fecha))/86400000)):0;
    const iP=(monP*(params.para_tasaAnual/100)/30*diasC), iD=(monD*(params.dir_tasaAnual/100)/30*diasC);
    const cP=(monP*(params.para_factibilidad/100)+monP*(params.para_fega/100)+ha*params.para_asistTec)*(1+params.iva/100);
    const cD=(monD*(params.dir_factibilidad/100)+monD*(params.dir_fega/100))*(1+params.iva/100);
    const tLiq=tGas+iP+iD+cP+cD;
    return [p.alias||p.apPat,[p.nombres,p.apPat,p.apMat].filter(Boolean).join(" "),p.rfc||"",
      mxn(ha),mxn(credAut),mxn(tDis),mxn(tSem),mxn(tIns),mxn(tDie),mxn(tEfe),mxn(tGas),
      mxn(iP+iD),mxn(cP+cD),mxn(tLiq),ha>0?mxn(tLiq/ha):0];
  }).filter(Boolean);

  exportarExcel(`EstadosCuenta_Todos_${ciclo?.nombre||"ciclo"}`, [
    {
      nombre: "Consolidado",
      headers: ["Alias","Nombre","RFC","Ha","Cred. Aut.","Dispersado","Semilla","Insumos","Diesel","Efectivo","Total Gasto","Intereses","Comisiones","Total Liquidar","$/Ha"],
      rows: resumenRows
    },
    {
      nombre: "Todos Insumos",
      headers: ["Productor","Fecha","Categoría","Insumo","Cantidad","Unidad","Importe","Proveedor"],
      rows: (state.insumos||[]).filter(i=>!i.cancelado&&(i.cicloId||1)===cid).map(i=>{
        const p=(state.productores||[]).find(x=>String(x.id)===String(i.productorId));
        return [p?.alias||p?.apPat||"",i.fechaSolicitud||"",i.categoria||"",i.insumo||"",mxn(i.cantidad),i.unidad||"",mxn(i.importe),i.proveedor||""];
      })
    },
    {
      nombre: "Todos Diesel",
      headers: ["Productor","Fecha","Cantidad (L)","Precio/L","Importe"],
      rows: (state.diesel||[]).filter(d=>!d.cancelado&&(d.cicloId||1)===cid&&!d.esAjuste).map(d=>{
        const p=(state.productores||[]).find(x=>String(x.id)===String(d.productorId));
        return [p?.alias||p?.apPat||"",d.fechaSolicitud||"",mxn(d.cantidad),mxn(d.precioUnitario),mxn(d.importe)];
      })
    },
    {
      nombre: "Todas Dispersiones",
      headers: ["Productor","Fecha","Línea","# Solicitud","Monto"],
      rows: (state.dispersiones||[]).filter(d=>!d.cancelado&&(d.cicloId||1)===cid).map(d=>{
        const p=(state.productores||[]).find(x=>String(x.id)===String(d.productorId));
        return [p?.alias||p?.apPat||"",d.fecha||"",d.lineaCredito||"",d.numSolicitud||"",mxn(d.monto)];
      })
    },
  ]);
}

// ─── CÁLCULO DE CRÉDITO POR PRODUCTOR (fuente única de verdad) ───────────────
// Usa la misma lógica movimiento-a-movimiento que calcularFinancieros y CreditoModule
export function calcularCreditoProd(prodId, state) {
  const cid     = state.cicloActivoId||1;
  const ciclo   = (state.ciclos||[]).find(c=>c.id===cid)||(state.ciclos||[])[0];
  const asigs   = ciclo?.asignaciones||[];
  const params  = {...{para_tasaAnual:1.38,para_factibilidad:1.25,para_fega:2.3,para_asistTec:200,
    dir_tasaAnual:1.8,dir_factibilidad:1.5,dir_fega:2.3,iva:16},...(state.creditoParams||{})};
  const hoy     = new Date();
  const diasD   = f => f ? Math.max(0,Math.round((hoy-new Date(f))/86400000)) : 0;

  const ha      = asigs.filter(a=>String(a.productorId)===String(prodId)).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);
  const exp     = (state.expedientes||[]).find(e=>e.productorId===prodId);
  const credAut = exp?.montoPorHa ? ha*exp.montoPorHa : 0;

  const insP    = (state.insumos||[]).filter(i=>!i.cancelado&&(i.cicloId||1)===cid&&String(i.productorId)===String(prodId));
  const dieP    = (state.diesel||[]).filter(d=>!d.cancelado&&(d.cicloId||1)===cid&&String(d.productorId)===String(prodId));
  const egrP    = (state.egresosManual||[]).filter(e=>!e.cancelado&&(e.cicloId||1)===cid&&String(e.productorId)===String(prodId));
  const disP    = (state.dispersiones||[]).filter(d=>!d.cancelado&&(d.cicloId||1)===cid&&String(d.productorId)===String(prodId));

  const tSem = insP.filter(i=>i.categoria==="Semilla").reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
  const tIns = insP.filter(i=>i.categoria!=="Semilla").reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
  const tDie = dieP.reduce((s,d)=>s+(parseFloat(d.importe)||0),0);
  const tEfe = egrP.reduce((s,e)=>s+(parseFloat(e.monto)||0),0);
  const tGas = tSem+tIns+tDie+tEfe;
  const tDis = disP.reduce((s,d)=>s+(parseFloat(d.monto)||0),0);

  // Movimientos ordenados por fecha (misma lógica que calcularFinancieros)
  const movs = [
    ...insP.map(i=>({fecha:i.fechaSolicitud||i.fechaOrden||"",monto:parseFloat(i.importe)||0})),
    ...dieP.map(d=>({fecha:d.fechaSolicitud||d.fechaOrden||"",monto:parseFloat(d.importe)||0})),
    ...egrP.map(e=>({fecha:e.fecha||e.semanaFechaInicio||"",monto:parseFloat(e.monto)||0})),
  ].filter(m=>m.monto>0).sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)));

  const montoAplP = credAut>0 ? Math.min(tGas,credAut) : 0;
  let iP=0, cP=0;
  if(montoAplP>0) {
    let acumP=0;
    movs.forEach(m=>{
      const md=Math.min(m.monto,Math.max(0,montoAplP-acumP)); acumP+=md;
      iP += ((md*(params.para_tasaAnual/100))/30)*diasD(m.fecha);
    });
    const factP = credAut*(params.para_factibilidad/100)*(1+params.iva/100);
    const fegaP = montoAplP*(params.para_fega/100)*(1+params.iva/100);
    const atP   = ha*params.para_asistTec;
    cP = factP+fegaP+atP;
  }

  let iD=0, cD=0, acumD=0;
  const movsDir = movs.map(m=>{
    const yaP=Math.min(m.monto,Math.max(0,credAut-acumD));
    const enD=m.monto-yaP; acumD+=m.monto;
    return {fecha:m.fecha,montoDisp:enD};
  }).filter(m=>m.montoDisp>0);
  if(movsDir.length>0) {
    let factBaseD=0,fegaBaseD=0;
    movsDir.forEach(m=>{
      const dd=diasD(m.fecha);
      iD  += ((m.montoDisp*(params.dir_tasaAnual/100))/30)*dd;
      factBaseD += m.montoDisp*(params.dir_factibilidad/100);
      fegaBaseD += ((m.montoDisp*dd)/360)*(params.dir_fega/100);
    });
    cD = (factBaseD+fegaBaseD)*(1+params.iva/100);
  }

  const tLiq = tGas+iP+iD+cP+cD;
  const dispsSorted = [...disP].sort((a,b)=>String(a.fecha||"").localeCompare(String(b.fecha||"")));
  const diasCred = dispsSorted[0] ? diasD(dispsSorted[0].fecha) : 0;

  return {ha,credAut,tSem,tIns,tDie,tEfe,tGas,tDis,iP,iD,cP,cD,tLiq,
    totalInt:iP+iD, totalCom:cP+cD, xha:ha>0?tLiq/ha:0,
    diasCred, dispsSorted, saldoDisp:tDis-tGas, params,
    lotesP:(state.lotes||[]).filter(l=>(ciclo?.asignaciones||[]).some(a=>String(a.loteId)===String(l.id)&&String(a.productorId)===String(prodId))),
    catEgr: egrP.reduce((o,e)=>{const k=e.categoria||"otro";o[k]=(o[k]||0)+(parseFloat(e.monto)||0);return o;},{})
  };
}

// ─── FILTRO SELECT — dropdown inteligente reutilizable ───────────────────────
// opciones: [{ valor, label, sub, monto, count, color }]
export function FiltroSelect({ valor, onChange, opciones=[], placeholder="Buscar...", width=220, mxnFmt }) {
  const [abierto, setAbierto] = React.useState(false);
  const [busq, setBusq] = React.useState("");
  const ref = React.useRef(null);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    const fn = (e) => { if(ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const fmtM = n => mxnFmt ? mxnFmt(n) : `$${(n||0).toLocaleString("es-MX",{minimumFractionDigits:0,maximumFractionDigits:0})}`;
  const opsFilt = opciones.filter(o => !busq || (o.label||"").toLowerCase().includes(busq.toLowerCase()));
  const seleccionado = opciones.find(o => o.valor === valor);

  return (
    <div ref={ref} style={{position:"relative",width}}>
      {/* Input / trigger */}
      <div onClick={()=>{ setAbierto(a=>!a); setBusq(""); setTimeout(()=>inputRef.current?.focus(),50); }}
        style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",border:`1.5px solid ${abierto?"#2d5a1b":"#ddd5c0"}`,
          borderRadius:8,background:"white",cursor:"pointer",height:34,transition:"border-color 0.15s",
          boxShadow:abierto?"0 0 0 3px rgba(45,90,27,0.1)":"none"}}>
        {seleccionado ? (
          <>
            {seleccionado.color && <span style={{width:8,height:8,borderRadius:"50%",background:seleccionado.color,flexShrink:0}}/>}
            <span style={{fontSize:12,fontWeight:600,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"#2d5a1b"}}>{seleccionado.label}</span>
            <span style={{fontSize:10,color:"#8a8070"}}>{seleccionado.monto!=null?fmtM(seleccionado.monto):seleccionado.count!=null?seleccionado.count+" reg.":""}</span>
            <span onClick={e=>{e.stopPropagation();onChange("");setBusq("");}} style={{fontSize:14,color:"#8a8070",lineHeight:1,marginLeft:4,cursor:"pointer"}}>✕</span>
          </>
        ) : (
          <>
            <span style={{fontSize:11,color:"#8a8070",flex:1}}>{placeholder}</span>
            <span style={{fontSize:10,color:"#8a8070"}}>▾</span>
          </>
        )}
      </div>

      {/* Dropdown */}
      {abierto && (
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,zIndex:200,background:"white",
          border:"1px solid #ddd5c0",borderRadius:10,boxShadow:"0 8px 24px rgba(0,0,0,0.12)",
          minWidth:Math.max(width,240),maxHeight:320,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          {/* Buscar */}
          <div style={{padding:"8px 10px",borderBottom:"1px solid #f0ece0",flexShrink:0}}>
            <input ref={inputRef} type="text" value={busq} onChange={e=>setBusq(e.target.value)}
              placeholder="Escribir para filtrar..."
              style={{width:"100%",border:"1px solid #ddd5c0",borderRadius:6,padding:"5px 10px",
                fontSize:12,outline:"none",background:"#fafaf8"}}/>
          </div>
          {/* Lista */}
          <div style={{overflowY:"auto",flex:1}}>
            {/* Opción "Todos" */}
            <div onClick={()=>{onChange("");setAbierto(false);setBusq("");}}
              style={{padding:"8px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,
                borderBottom:"1px solid #f5f0e8",background:!valor?"#f0f7ec":"white",
                transition:"background 0.1s"}}
              onMouseEnter={e=>{ if(valor) e.currentTarget.style.background="#f7f5ef"; }}
              onMouseLeave={e=>{ if(valor) e.currentTarget.style.background="white"; }}>
              <span style={{fontSize:12,color:"#5a7a3a",fontWeight:600,flex:1}}>— Todos —</span>
              <span style={{fontSize:10,color:"#8a8070"}}>{opciones.length} opciones</span>
            </div>
            {opsFilt.length === 0 && (
              <div style={{padding:"16px 12px",textAlign:"center",fontSize:12,color:"#8a8070"}}>Sin resultados</div>
            )}
            {opsFilt.map(o=>{
              const sel = o.valor === valor;
              return (
                <div key={o.valor} onClick={()=>{onChange(o.valor);setAbierto(false);setBusq("");}}
                  style={{padding:"8px 12px",cursor:"pointer",borderBottom:"1px solid #f5f0e8",
                    background:sel?"#f0f7ec":"white",transition:"background 0.1s"}}
                  onMouseEnter={e=>{ if(!sel) e.currentTarget.style.background="#f7f5ef"; }}
                  onMouseLeave={e=>{ if(!sel) e.currentTarget.style.background=sel?"#f0f7ec":"white"; }}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    {o.color && <span style={{width:8,height:8,borderRadius:"50%",background:o.color,flexShrink:0}}/>}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:sel?700:500,color:sel?"#2d5a1b":"#3d3525",
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.label}</div>
                      {o.sub && <div style={{fontSize:10,color:"#8a8070",marginTop:1}}>{o.sub}</div>}
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      {o.monto!=null && <div style={{fontFamily:"monospace",fontSize:11,fontWeight:700,color:"#c0392b"}}>{fmtM(o.monto)}</div>}
                      {o.count!=null && <div style={{fontSize:10,color:"#8a8070"}}>{o.count} reg.</div>}
                    </div>
                    {sel && <span style={{fontSize:12,color:"#2d5a1b"}}>✓</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MOTOR DE ALERTAS ────────────────────────────────────────────────────────
// Calcula todas las alertas del sistema en base al state actual
// Retorna array de { id, nivel, titulo, detalle, mod, prodId, icono }
// nivel: "critico" | "advertencia" | "info"
export function calcularAlertas(state) {
  const alertas = [];
  const hoy = new Date();
  const cid  = state.cicloActivoId || 1;
  const ciclo = (state.ciclos||[]).find(c=>c.id===cid) || (state.ciclos||[])[0];
  const cicloPred = ciclo;  // alias para referencias legacy
  const asigs = ciclo?.asignaciones || [];
  const productores = state.productores || [];
  const params = { para_tasaAnual:1.38, dir_tasaAnual:1.8, ...( state.creditoParams||{}) };
  const ap = {
    umbralIntereses:15, diasSinDiesel:7, diasInsumosPendientes:20,
    umbralGastoAcelerado:80, umbralTiempoAcelerado:60,
    diasVencimientoCritico:15, diasVencimientoAdv:30,
    actCredito:true, actIntereses:true, actExcedeCredito:true,
    actInsumosPendientes:true, actDiesel:true, actDispSinGastos:true,
    actLotesSinAsig:true, actGastoAcelerado:true,
    ...(state.alertaParams||{})
  };
  const insumos  = (state.insumos||[]).filter(i=>!i.cancelado&&(i.cicloId||1)===cid);
  const diesel   = (state.diesel||[]).filter(d=>!d.cancelado&&(d.cicloId||1)===cid);
  const egresos  = (state.egresosManual||[]).filter(e=>(e.cicloId||1)===cid&&!e.cancelado);
  const disps    = (state.dispersiones||[]).filter(d=>!d.cancelado&&(d.cicloId||1)===cid);
  const dias = f => f ? Math.max(0,Math.round((hoy-new Date(f))/86400000)) : 0;
  const mxn = n => (parseFloat(n)||0).toLocaleString("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:0,maximumFractionDigits:0});

  // ── 1. Crédito próximo a vencer
  if (ap.actCredito && ciclo?.fechaFin) {
    const diasAlVenc = Math.round((new Date(ciclo.fechaFin)-hoy)/86400000);
    if(diasAlVenc <= ap.diasVencimientoAdv && diasAlVenc >= 0) {
      alertas.push({
        id:"credito_vence", nivel: diasAlVenc<=ap.diasVencimientoCritico?"critico":"advertencia",
        icono: diasAlVenc<=ap.diasVencimientoCritico?"🔴":"🟡",
        titulo: `Crédito vence en ${diasAlVenc} días`,
        detalle: `Fecha límite: ${ciclo.fechaFin}. Coordinar liquidación con la parafinanciera.`,
        mod:"credito", accion:"Ver Crédito"
      });
    }
  }

  // ── 2. Intereses acumulados por productor
  if (ap.actIntereses)
  productores.forEach(p => {
    const haProd = asigs.filter(a=>String(a.productorId)===String(p.id)).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);
    const exp = (state.expedientes||[]).find(e=>e.productorId===p.id);
    const creditoPara = exp?.montoPorHa ? haProd * exp.montoPorHa : 0;
    const gasto = [...insumos,...diesel].filter(x=>String(x.productorId)===String(p.id)).reduce((s,x)=>s+(parseFloat(x.importe)||0),0)
      + egresos.filter(x=>String(x.productorId)===String(p.id)).reduce((s,x)=>s+(parseFloat(x.monto)||0),0);
    const montoP = creditoPara>0?Math.min(gasto,creditoPara):0;
    const montoD = Math.max(0,gasto-montoP);
    const dispsProd = disps.filter(d=>String(d.productorId)===String(p.id)).sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)));
    if(!dispsProd.length) return;
    const diasCorriendo = dias(dispsProd[0].fecha);
    const intAcum = montoP*(params.para_tasaAnual/100)/30*diasCorriendo + montoD*(params.dir_tasaAnual/100)/30*diasCorriendo;
    // Alerta si intereses > 15% del crédito total
    const umbralInt = (montoP+montoD)*(ap.umbralIntereses/100);
    if(intAcum > umbralInt && umbralInt > 0) {
      alertas.push({
        id:`int_alto_${p.id}`, nivel:"advertencia", icono:"📈",
        titulo: `${p.alias||p.apPat} — intereses altos`,
        detalle: `Intereses acumulados: ${mxn(intAcum)} (${((intAcum/(montoP+montoD))*100).toFixed(1)}% del crédito). ${diasCorriendo} días corriendo.`,
        mod:"credito", prodId:p.id, filtros:{vista:"productor", prodId:p.id}, accion:"Ver estado"
      });
    }
  });

  // ── 3. Transición parafinanciero → directo y límites por productor
  if (ap.actExcedeCredito)
  productores.forEach(p => {
    const lim = (state.creditoLimites||{})[p.id] || {};
    const exp = (state.expedientes||[]).find(e=>e.productorId===p.id);
    const haProd = asigs.filter(a=>String(a.productorId)===String(p.id)).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);
    // Crédito parafinanciero autorizado (del expediente)
    const creditoParaAut = exp?.montoAutorizado || (exp?.montoPorHa ? haProd * exp.montoPorHa : 0);
    // Límite configurable (manual) o usa el del expediente
    const limitePara = lim.limitePara || creditoParaAut;
    const limiteDir  = lim.limiteDir  || 0;
    const limiteTotal = lim.limiteTotal || 0;
    // Gastos por línea
    const gastoParaFn = (arr) => arr.filter(x=>String(x.productorId)===String(p.id)&&(x.lineaCredito||"parafinanciero")==="parafinanciero").reduce((s,x)=>s+(parseFloat(x.importe||x.monto)||0),0);
    const gastoDirFn  = (arr) => arr.filter(x=>String(x.productorId)===String(p.id)&&x.lineaCredito==="directo").reduce((s,x)=>s+(parseFloat(x.importe||x.monto)||0),0);
    const gastoPara   = gastoParaFn([...insumos,...diesel]) + gastoParaFn(egresos);
    const gastoDir    = gastoDirFn([...insumos,...diesel])  + gastoDirFn(egresos);
    const gastoTotal  = gastoPara + gastoDir;
    // a) Notificación: crédito parafinanciero agotado, pasando a directo
    if(limitePara > 0 && gastoPara >= limitePara * 0.95) {
      const pct = Math.min(100,(gastoPara/limitePara*100)).toFixed(0);
      alertas.push({
        id:`para_agotado_${p.id}`,
        nivel: gastoPara >= limitePara ? "advertencia" : "info",
        icono: gastoPara >= limitePara ? "🔄" : "ℹ️",
        titulo: `${p.alias||p.apPat} — Crédito Parafinanciero ${gastoPara>=limitePara?"agotado":"al "+pct+"%"}`,
        detalle: gastoPara>=limitePara
          ? `Gasto parafinanciero ${mxn(gastoPara)} = ${mxn(limitePara)} autorizado. Continúa con crédito directo.`
          : `Gasto parafinanciero ${mxn(gastoPara)} de ${mxn(limitePara)} (${pct}%). Próximo a iniciar crédito directo.`,
        mod:"credito", prodId:p.id, accion:"Ver crédito"
      });
    }
    // b) Alerta: límite total configurado manualmente
    if(limiteTotal > 0 && gastoTotal > limiteTotal) {
      alertas.push({
        id:`excede_limite_${p.id}`, nivel:"critico", icono:"🚨",
        titulo: `${p.alias||p.apPat} — Excede límite de crédito total`,
        detalle: `Gasto total ${mxn(gastoTotal)} supera límite configurado ${mxn(limiteTotal)}. Excedente: ${mxn(gastoTotal-limiteTotal)}.`,
        mod:"credito", prodId:p.id, accion:"Ver crédito"
      });
    }
  });

  // ── 4. Insumos pedidos sin recibir
  if (ap.actInsumosPendientes) {
    const insumosSinRecibir = insumos.filter(i => {
      const tieneRecepcion = (i.recepciones||[]).length > 0;
      if(tieneRecepcion) return false;
      const d = dias(i.fechaSolicitud || i.fechaOrden);
      return d > ap.diasInsumosPendientes;
    });
    if(insumosSinRecibir.length > 0) {
      const totalPend = insumosSinRecibir.reduce((s,i)=>s+(parseFloat(i.importe)||0),0);
      alertas.push({
        id:"insumos_sin_recibir", nivel:"advertencia", icono:"📦",
        titulo: `${insumosSinRecibir.length} insumos sin recibir`,
        detalle: `${mxn(totalPend)} en pedidos con más de 20 días sin confirmar recepción.`,
        mod:"insumos", accion:"Ver insumos"
      });
    }
  }

  // ── 5. Diesel — sin cargas
  if (ap.actDiesel)
  if(disps.length > 0) {
    const ultimaDiesel = diesel.filter(d=>!d.esAjuste).sort((a,b)=>String(b.fechaSolicitud||b.fecha||"").localeCompare(String(a.fechaSolicitud||a.fecha||"")))[0];
    const _diasSinDiesel = ultimaDiesel ? dias(ultimaDiesel.fechaSolicitud||ultimaDiesel.fecha) : 999;
    if(_diasSinDiesel > ap.diasSinDiesel) {
      alertas.push({
        id:"diesel_sin_cargas", nivel:"info", icono:"⛽",
        titulo: `Sin cargas de diesel (${_diasSinDiesel} días)`,
        detalle: _diasSinDiesel===999 ? "No hay registros de diesel en el ciclo." : `Última carga hace ${_diasSinDiesel} días. ¿Se necesita registrar?`,
        mod:"diesel", accion:"Ver diesel"
      });
    }
  }

  // ── 6. Dispersiones sin gastos
  if (ap.actDispSinGastos)
  productores.forEach(p => {
    const tieneDisp = disps.some(d=>String(d.productorId)===String(p.id));
    if(!tieneDisp) return;
    const tieneGasto = [...insumos,...diesel].some(x=>String(x.productorId)===String(p.id))
      || egresos.some(x=>String(x.productorId)===String(p.id));
    if(!tieneGasto) {
      alertas.push({
        id:`disp_sin_gastos_${p.id}`, nivel:"info", icono:"💳",
        titulo: `${p.alias||p.apPat} — dispersión sin gastos`,
        detalle: `Tiene crédito dispersado pero sin gastos registrados en el ciclo.`,
        mod:"gastos", prodId:p.id, accion:"Ver egresos"
      });
    }
  });

  // ── 7. Lotes sin asignar
  if (ap.actLotesSinAsig) {
    const lotesSinAsig = (state.lotes||[]).filter(l => !asigs.some(a=>String(a.loteId)===String(l.id)));
    if(lotesSinAsig.length > 0) {
      const hasSinAsig = lotesSinAsig.reduce((s,l)=>s+(l.supCredito||0),0);
      alertas.push({
        id:"lotes_sin_arrendatario", nivel:"info", icono:"🗺",
        titulo: `${lotesSinAsig.length} lotes sin asignar`,
      detalle: `${hasSinAsig.toFixed(2)} ha sin arrendatario en el ciclo ${ciclo?.nombre||"activo"}.`,
        mod:"lotes", accion:"Ver lotes"
      });
    }
  }

  // ── 8. Avance de ciclo vs gasto
  if (ap.actGastoAcelerado)
  if(ciclo?.fechaInicio && ciclo?.fechaFin) {
    const total = Math.round((new Date(ciclo.fechaFin)-new Date(ciclo.fechaInicio))/86400000);
    const transcurrido = Math.max(0,Math.min(total,Math.round((hoy-new Date(ciclo.fechaInicio))/86400000)));
    const pctTiempo = total>0?transcurrido/total:0;
    const F2 = calcularFinancieros(state);
    const pctGasto = F2.costoTotal>0?(F2.costoTotal-(F2.costoFinanciero||0))/F2.costoTotal:0;
    // Si el gasto operativo supera 80% del presupuesto y solo vamos al 60% del ciclo
    if(pctGasto > (ap.umbralGastoAcelerado/100) && pctTiempo < (ap.umbralTiempoAcelerado/100) && F2.costoTotal > 0) {
      alertas.push({
        id:"gasto_acelerado", nivel:"advertencia", icono:"⚡",
        titulo: "Ritmo de gasto acelerado",
        detalle: `${(pctGasto*100).toFixed(0)}% del gasto total con solo ${(pctTiempo*100).toFixed(0)}% del ciclo transcurrido.`,
        mod:"costos", accion:"Ver costos"
      });
    }
  }

  // ── Alertas de cosecha ──────────────────────────────────────────────────────
  const boletas = state.cosecha?.boletas || [];
  const boletasActivas = boletas.filter(b=>!b.cancelado);
  if(boletasActivas.length > 0) {
    // Humedad alta (>14%) en varias boletas
    const altaHum = boletasActivas.filter(b=>parseFloat(b.hum)>14);
    if(altaHum.length >= 3) {
      const promHum = altaHum.reduce((s,b)=>s+parseFloat(b.hum),0)/altaHum.length;
      alertas.push({
        id:"cosecha_humedad_alta", nivel:"advertencia", icono:"💧",
        titulo:`Humedad alta en ${altaHum.length} boletas`,
        detalle:`Promedio ${promHum.toFixed(1)}% en boletas con humedad >14%. Puede afectar el precio de venta.`,
        mod:"cosecha", accion:"Ver cosecha"
      });
    }

    // Rendimiento muy bajo vs esperado
    const haTotal = (cicloPred?.asignaciones||[]).reduce((s,a)=>s+(parseFloat(a.supAsignada)||0),0);
    const tonTotal = boletasActivas.reduce((s,b)=>s+(parseFloat(b.pna)||0),0)/1000;
    const rendReal = haTotal>0 ? tonTotal/haTotal : 0;
    const rendEsp  = getParamsCultivo(state).rendimiento || 9;
    if(rendReal>0 && rendReal < rendEsp*0.75) {
      alertas.push({
        id:"cosecha_rend_bajo", nivel:"critico", icono:"📉",
        titulo:`Rendimiento muy por debajo del esperado`,
        detalle:`Rendimiento real: ${rendReal.toFixed(2)} ton/ha vs esperado: ${rendEsp} ton/ha (${((rendReal/rendEsp)*100).toFixed(0)}%).`,
        mod:"cosecha", accion:"Ver cosecha"
      });
    }

    // Productores con lotes en ciclo pero sin boletas
    const prodConLotes = [...new Set((cicloPred?.asignaciones||[]).map(a=>a.productorId))];
    const prodConBoletas = [...new Set(boletasActivas.map(b=>String(b.productorId)))];
    const prodSinBoleta = prodConLotes.filter(pid=>!prodConBoletas.includes(String(pid)));
    if(prodSinBoleta.length > 0 && boletasActivas.length > 5) {
      const nombres = prodSinBoleta.slice(0,3).map(pid=>{
        const p = productores.find(x=>String(x.id)===String(pid));
        return p?.alias||p?.apPat||pid;
      }).join(", ");
      alertas.push({
        id:"cosecha_sin_boletas", nivel:"info", icono:"🌽",
        titulo:`${prodSinBoleta.length} productor${prodSinBoleta.length>1?"es":""} sin boletas`,
        detalle:`Con cosecha en progreso: ${nombres}${prodSinBoleta.length>3?" y más":""}`,
        mod:"cosecha", accion:"Ver cosecha"
      });
    }
  }

  return alertas;
}

// ─── PANEL DE ALERTAS (Dashboard) ────────────────────────────────────────────
export function PanelAlertas({ alertas, onNavigate }) {
  const { state, dispatch } = useData();
  const leidas      = new Set(state.alertasLeidas || []);
  const [expandido, setExpandido]         = React.useState(false);  // collapsed by default
  const [filtroNivel, setFiltroNivel]     = React.useState("todos");
  const [mostrarLeidas, setMostrarLeidas] = React.useState(false);

  if (!alertas || alertas.length === 0) return (
    <div style={{marginBottom:16,padding:"10px 16px",background:"#f0f7ec",borderRadius:10,
      border:"1px solid #4a8c2a33",display:"flex",alignItems:"center",gap:10}}>
      <span style={{fontSize:18}}>✅</span>
      <span style={{fontSize:13,color:"#2d5a1b",fontWeight:600}}>Sin alertas activas — todo en orden</span>
    </div>
  );

  const noLeidas  = alertas.filter(a => !leidas.has(a.id));
  const siLeidas  = alertas.filter(a =>  leidas.has(a.id));

  const criticos     = noLeidas.filter(a=>a.nivel==="critico");
  const advertencias = noLeidas.filter(a=>a.nivel==="advertencia");
  const infos        = noLeidas.filter(a=>a.nivel==="info");

  // Filter for the visible list
  const filtradas = (filtroNivel==="todos" ? noLeidas : noLeidas.filter(a=>a.nivel===filtroNivel));

  const colorNivel = { critico:"#c0392b", advertencia:"#e67e22", info:"#1a6ea8" };
  const bgNivel    = { critico:"#fdf0ef", advertencia:"#fef9ec", info:"#edf5fb" };
  const borderTop  = criticos.length>0?"3px solid #c0392b"
    : advertencias.length>0?"3px solid #e67e22"
    : noLeidas.length>0?"3px solid #1a6ea8"
    : "3px solid #4a8c2a";

  const marcar   = id => dispatch({type:"MARCAR_ALERTA_LEIDA",   payload:id});
  const desmarcar= id => dispatch({type:"DESMARCAR_ALERTA_LEIDA",payload:id});
  const limpiarTodas = () => dispatch({type:"LIMPIAR_ALERTAS_LEIDAS"});

  const renderAlertRow = (a, esLeida=false) => (
    <div key={a.id} style={{
      padding:"10px 16px",
      background: esLeida ? "#f8f8f6" : (bgNivel[a.nivel]||"white"),
      borderBottom:"1px solid #f0ece0",
      display:"flex",alignItems:"flex-start",gap:10,
      opacity: esLeida ? 0.55 : 1,
    }}>
      <span style={{fontSize:18,flexShrink:0,marginTop:1}}>{a.icono}</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,fontWeight:700,
          color: esLeida ? "#8a8070" : (colorNivel[a.nivel]||"#3d3525"),
          marginBottom:2,
          textDecoration: esLeida ? "line-through" : "none"}}>
          {a.titulo}
        </div>
        <div style={{fontSize:11,color:"#5a7a5a",lineHeight:1.5}}>{a.detalle}</div>
      </div>
      <div style={{display:"flex",gap:6,flexShrink:0,alignItems:"center"}}>
        {!esLeida && a.accion && (
          <button onClick={()=>onNavigate&&onNavigate(a.mod,a.prodId||null,a.filtros||null)}
            style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${colorNivel[a.nivel]}44`,
              background:`${colorNivel[a.nivel]}11`,color:colorNivel[a.nivel],
              fontWeight:700,fontSize:11,cursor:"pointer",whiteSpace:"nowrap"}}>
            {a.accion} →
          </button>
        )}
        <button onClick={()=> esLeida ? desmarcar(a.id) : marcar(a.id)}
          title={esLeida ? "Marcar como no leída" : "Marcar como leída"}
          style={{padding:"4px 8px",borderRadius:6,fontSize:11,cursor:"pointer",
            border: esLeida ? "1px solid #c8e0b0" : "1px solid #ddd5c0",
            background: esLeida ? "#e8f4e8" : "white",
            color: esLeida ? "#2d7a3a" : "#8a8070",fontWeight:600}}>
          {esLeida ? "↩" : "✓"}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{marginBottom:16,borderRadius:10,overflow:"hidden",border:"1px solid #e8e0d0",
      boxShadow:"0 2px 8px rgba(0,0,0,0.06)",borderTop}}>

      {/* ── Header ── */}
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",
        background:"white",cursor:"pointer",userSelect:"none"}}
        onClick={()=>setExpandido(e=>!e)}>
        <span style={{fontSize:18}}>{criticos.length>0?"🚨":advertencias.length>0?"⚠️":noLeidas.length>0?"ℹ️":"✅"}</span>

        <div style={{flex:1}}>
          {/* Unread badge */}
          {noLeidas.length > 0 ? (
            <span style={{fontSize:13,fontWeight:700,color:"#3d3525"}}>
              {noLeidas.length} alerta{noLeidas.length!==1?"s":""} sin leer
              {siLeidas.length>0 && (
                <span style={{fontSize:11,color:"#8a8070",fontWeight:400,marginLeft:8}}>
                  · {siLeidas.length} leída{siLeidas.length!==1?"s":""}
                </span>
              )}
            </span>
          ) : (
            <span style={{fontSize:13,fontWeight:600,color:"#2d7a3a"}}>
              ✅ Todas las alertas leídas
              {siLeidas.length>0 && (
                <span style={{fontSize:11,color:"#8a8070",fontWeight:400,marginLeft:8}}>
                  ({siLeidas.length} en historial)
                </span>
              )}
            </span>
          )}
          {/* Level pills */}
          {noLeidas.length > 0 && (
            <div style={{display:"flex",gap:6,marginTop:3}}>
              {criticos.length>0    && <span style={{fontSize:10,fontWeight:700,color:"#c0392b"}}>🔴 {criticos.length} crítica{criticos.length!==1?"s":""}</span>}
              {advertencias.length>0 && <span style={{fontSize:10,fontWeight:700,color:"#e67e22"}}>🟡 {advertencias.length} advertencia{advertencias.length!==1?"s":""}</span>}
              {infos.length>0        && <span style={{fontSize:10,fontWeight:700,color:"#1a6ea8"}}>🔵 {infos.length} info</span>}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div style={{display:"flex",gap:6,alignItems:"center"}} onClick={e=>e.stopPropagation()}>
          {noLeidas.length>0 && (
            <button onClick={()=>noLeidas.forEach(a=>marcar(a.id))}
              style={{padding:"3px 10px",borderRadius:8,fontSize:10,fontWeight:700,cursor:"pointer",
                border:"1px solid #c8e0b0",background:"#f0f8e8",color:"#2d5a1b"}}>
              ✓ Marcar todas
            </button>
          )}
          {expandido && noLeidas.length>0 && (
            <div style={{display:"flex",gap:4}}>
              {[["todos","Todas"],["critico","Críticas"],["advertencia","Avisos"],["info","Info"]].map(([val,lbl])=>(
                <span key={val} onClick={()=>setFiltroNivel(val)}
                  style={{padding:"3px 8px",borderRadius:10,fontSize:10,fontWeight:600,cursor:"pointer",
                    background:filtroNivel===val?"#2d5a1b":"#f0ece0",
                    color:filtroNivel===val?"white":"#5a7a3a"}}>
                  {lbl}
                </span>
              ))}
            </div>
          )}
        </div>
        <span style={{fontSize:12,color:"#8a8070",transition:"transform 0.2s",
          transform:expandido?"rotate(180deg)":"rotate(0deg)"}}>▾</span>
      </div>

      {/* ── Lista sin leer ── */}
      {expandido && (
        <div style={{background:"#fafaf8",borderTop:"1px solid #f0ece0"}}>
          {filtradas.length === 0 && noLeidas.length === 0 && (
            <div style={{padding:"16px",textAlign:"center",fontSize:12,color:"#8a8070"}}>
              ✅ Sin alertas sin leer
            </div>
          )}
          {filtradas.map(a => renderAlertRow(a, false))}

          {/* ── Sección Leídas ── */}
          {siLeidas.length > 0 && (
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 16px",
                background:"#f0ece0",cursor:"pointer",userSelect:"none"}}
                onClick={()=>setMostrarLeidas(v=>!v)}>
                <span style={{fontSize:11,color:"#8a8070",fontWeight:600,flex:1}}>
                  {mostrarLeidas?"▾":"▸"} Alertas leídas ({siLeidas.length})
                </span>
                {mostrarLeidas && (
                  <button onClick={e=>{e.stopPropagation();limpiarTodas();}}
                    style={{fontSize:10,padding:"2px 8px",borderRadius:6,cursor:"pointer",
                      border:"1px solid #c0392b22",background:"white",color:"#c0392b"}}>
                    🗑 Limpiar historial
                  </button>
                )}
              </div>
              {mostrarLeidas && siLeidas.map(a => renderAlertRow(a, true))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ─── DASHBOARD ENCARGADO DE CAMPO ─────────────────────────────────────────────
// ─── FLUJOS / APROBACIONES MODULE ────────────────────────────────────────────
