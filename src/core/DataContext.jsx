// ─── core/DataContext.jsx ──────────────────────────────────────────────────
// State management: initState, reducer, Ctx, useData, DataProvider.

import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { ACCESO } from '../shared/roles.js';
import { SYNC_KEYS } from './supabase.js';

const PRODUCTORES_INIT = [];
const LOTES_INIT = [];

export const initState = {
  // ── PRODUCTORES ──
  productores: PRODUCTORES_INIT,
  productorActivo: null,   // null = vista consolidada "Todos"

  // ── LOTES — ahora con productorId + zona ──
  lotes: LOTES_INIT,

  trabajos: [],
  bitacora: [],  // nuevo feed de campo

  // ── INSUMOS — vacío, capturar uno por uno ──
  insumos: [],

  // ── DIESEL — vacío, capturar uno por uno ──
  diesel: [],

  // ── GASTOS legacy ──
  gastos: [],

  // ── EGRESOS DEL CICLO — nuevo módulo ──
  dispersiones: [],
  egresosManual: [],

  // ── CRÉDITO HABILITACIÓN — datos base, ministraciones a capturar ──
  credito: {
    institucion: "Almacenes Santa Rosa (Parafinanciera)",
    lineaAutorizada: 22000000,
    tasaAnual: 12.0,
    tasaMoratoria: 0,
    fechaApertura: "2025-11-01",
    fechaVencimiento: "2026-08-31",
    garantia: "Prendaria sobre cosecha · contratos de producción",
    noContrato: "SR-HAB-PV2024-25",
    ministraciones: [],
    pagos: [],
  },

  // ── EXPEDIENTES POR RESICO — contrato individual de habilitación ──
  // Cada RESICO/productor tiene su propio expediente con Almacenes Santa Rosa
  expedientes: [],

  creditoParams: {
    para_tasaAnual:1.38, para_factibilidad:1.25, para_fega:2.3, para_asistTec:200,
    dir_tasaAnual:1.8, dir_factibilidad:1.5, dir_fega:2.3, iva:16,
  },
  creditoLimites: {},   // { [productorId]: { limitePara: N, limiteDir: N, notificarCambio: true } }
  alertasLeidas: [],    // array of alert IDs marked as read
  alertaParams: {
    umbralIntereses: 15,
    diasSinDiesel: 7,
    diasInsumosPendientes: 20,
    umbralGastoAcelerado: 80,
    umbralTiempoAcelerado: 60,
    diasVencimientoCritico: 15,
    diasVencimientoAdv: 30,
    // toggles — true = activa, false = desactivada
    actCredito: true,
    actIntereses: true,
    actExcedeCredito: true,
    actInsumosPendientes: true,
    actDiesel: true,
    actDispSinGastos: true,
    actLotesSinAsig: true,
    actGastoAcelerado: true,
  },
  inventario: {
    items: [
      {id:1, nombre:"SEMILLA DK-4050", categoria:"Semilla", unidad:"BOLSA", descripcion:"", ubicacion:"Bodega", activo:true},
      {id:2, nombre:"KALAMAR", categoria:"Semilla", unidad:"BOLSA", descripcion:"", ubicacion:"Bodega", activo:true},
      {id:3, nombre:"DK 501", categoria:"Semilla", unidad:"BOLSA", descripcion:"", ubicacion:"Bodega", activo:true},
      {id:4, nombre:"DK 5024", categoria:"Semilla", unidad:"BOLSA", descripcion:"", ubicacion:"Bodega", activo:true},
      {id:5, nombre:"HIPOPOTAMO ASGROW", categoria:"Semilla", unidad:"BOLSA", descripcion:"", ubicacion:"Bodega", activo:true},
      {id:6, nombre:"MEZCLA LEONARDITA", categoria:"Fertilizante", unidad:"KG", descripcion:"", ubicacion:"Bodega", activo:true},
      {id:7, nombre:"FOSFONITRATO", categoria:"Fertilizante", unidad:"TON", descripcion:"", ubicacion:"Bodega", activo:true},
      {id:8, nombre:"FERTILIZANTE 11-52-0", categoria:"Fertilizante", unidad:"TON", descripcion:"", ubicacion:"Bodega", activo:true},
      {id:9, nombre:"SULFATO DE AMONIO GRANULAR", categoria:"Fertilizante", unidad:"TON", descripcion:"", ubicacion:"Bodega", activo:true},
      {id:10, nombre:"FERTILIZANTE UREA", categoria:"Fertilizante", unidad:"TON", descripcion:"", ubicacion:"Bodega", activo:true},
      {id:11, nombre:"CONDRAZ", categoria:"Herbicida", unidad:"KG", descripcion:"", ubicacion:"Bodega", activo:true},
      {id:12, nombre:"HERBICIDA", categoria:"Herbicida", unidad:"LT", descripcion:"", ubicacion:"Bodega", activo:true},
      {id:13, nombre:"BLAUKORN", categoria:"Fertilizante", unidad:"KG", descripcion:"", ubicacion:"Bodega", activo:true},
      {id:14, nombre:"VITANICA RZ O", categoria:"Fungicida", unidad:"LT", descripcion:"", ubicacion:"Bodega", activo:true},
      {id:15, nombre:"MEZCLA LEONARDITAY FOLIAR", categoria:"Fertilizante", unidad:"KG", descripcion:"", ubicacion:"Bodega", activo:true},
      {id:16, nombre:"REGAFIX", categoria:"Foliar", unidad:"LT", descripcion:"", ubicacion:"Bodega", activo:true},
      {id:17, nombre:"BIOFOM", categoria:"Foliar", unidad:"LT", descripcion:"", ubicacion:"Bodega", activo:true},
      {id:18, nombre:"QUELATO ZINC", categoria:"Foliar", unidad:"PEIZAS", descripcion:"", ubicacion:"Bodega", activo:true},
      {id:19, nombre:"ACIPLUS", categoria:"Adherente", unidad:"PEIZAS", descripcion:"", ubicacion:"Bodega", activo:true},
      {id:20, nombre:"INSECTICIDA", categoria:"Insecticida", unidad:"LT", descripcion:"", ubicacion:"Bodega", activo:true},
      {id:21, nombre:"CONVEY", categoria:"Herbicida", unidad:"PIEZA", descripcion:"", ubicacion:"Bodega", activo:true},
      {id:22, nombre:"ADHERENTE INEX", categoria:"Adherente", unidad:"LT", descripcion:"", ubicacion:"Bodega", activo:true},
      {id:23, nombre:"THUNDER", categoria:"Insecticida", unidad:"LT", descripcion:"", ubicacion:"Bodega", activo:true},
      {id:24, nombre:"CONDRAZ", categoria:"Herbicida", unidad:"PIEZA", descripcion:"", ubicacion:"Bodega", activo:true},
      {id:25, nombre:"Diesel", categoria:"Combustible", unidad:"LT", descripcion:"", ubicacion:"Bodega", activo:true}
    ],
    movimientos: [
      {id:1000, itemId:1, tipo:"entrada", cantidad:256.0, unidad:"BOLSA", fecha:"2026-03-26", notas:"Entrada inicial — recepción de insumos/diesel", origen:"insumos"},
      {id:2000, itemId:2, tipo:"entrada", cantidad:4.0, unidad:"BOLSA", fecha:"2026-03-26", notas:"Entrada inicial — recepción de insumos/diesel", origen:"insumos"},
      {id:3000, itemId:3, tipo:"entrada", cantidad:30.0, unidad:"BOLSA", fecha:"2026-03-26", notas:"Entrada inicial — recepción de insumos/diesel", origen:"insumos"},
      {id:4000, itemId:4, tipo:"entrada", cantidad:34.0, unidad:"BOLSA", fecha:"2026-03-26", notas:"Entrada inicial — recepción de insumos/diesel", origen:"insumos"},
      {id:5000, itemId:5, tipo:"entrada", cantidad:510.0, unidad:"BOLSA", fecha:"2026-03-26", notas:"Entrada inicial — recepción de insumos/diesel", origen:"insumos"},
      {id:6000, itemId:6, tipo:"entrada", cantidad:2400.0, unidad:"KG", fecha:"2026-03-26", notas:"Entrada inicial — recepción de insumos/diesel", origen:"insumos"},
      {id:7000, itemId:7, tipo:"entrada", cantidad:13.95, unidad:"TON", fecha:"2026-03-26", notas:"Entrada inicial — recepción de insumos/diesel", origen:"insumos"},
      {id:8000, itemId:8, tipo:"entrada", cantidad:71.25, unidad:"TON", fecha:"2026-03-26", notas:"Entrada inicial — recepción de insumos/diesel", origen:"insumos"},
      {id:9000, itemId:9, tipo:"entrada", cantidad:69.75, unidad:"TON", fecha:"2026-03-26", notas:"Entrada inicial — recepción de insumos/diesel", origen:"insumos"},
      {id:10000, itemId:10, tipo:"entrada", cantidad:269.75, unidad:"TON", fecha:"2026-03-26", notas:"Entrada inicial — recepción de insumos/diesel", origen:"insumos"},
      {id:11000, itemId:11, tipo:"entrada", cantidad:79.0, unidad:"KG", fecha:"2026-03-26", notas:"Entrada inicial — recepción de insumos/diesel", origen:"insumos"},
      {id:12000, itemId:12, tipo:"entrada", cantidad:40.0, unidad:"LT", fecha:"2026-03-26", notas:"Entrada inicial — recepción de insumos/diesel", origen:"insumos"},
      {id:13000, itemId:13, tipo:"entrada", cantidad:9300.0, unidad:"KG", fecha:"2026-03-26", notas:"Entrada inicial — recepción de insumos/diesel", origen:"insumos"},
      {id:14000, itemId:14, tipo:"entrada", cantidad:400.0, unidad:"LT", fecha:"2026-03-26", notas:"Entrada inicial — recepción de insumos/diesel", origen:"insumos"},
      {id:15000, itemId:15, tipo:"entrada", cantidad:2850.0, unidad:"KG", fecha:"2026-03-26", notas:"Entrada inicial — recepción de insumos/diesel", origen:"insumos"},
      {id:16000, itemId:16, tipo:"entrada", cantidad:542.0, unidad:"LT", fecha:"2026-03-26", notas:"Entrada inicial — recepción de insumos/diesel", origen:"insumos"},
      {id:17000, itemId:17, tipo:"entrada", cantidad:400.0, unidad:"LT", fecha:"2026-03-26", notas:"Entrada inicial — recepción de insumos/diesel", origen:"insumos"},
      {id:18000, itemId:18, tipo:"entrada", cantidad:220.0, unidad:"PEIZAS", fecha:"2026-03-26", notas:"Entrada inicial — recepción de insumos/diesel", origen:"insumos"},
      {id:19000, itemId:19, tipo:"entrada", cantidad:87.0, unidad:"PEIZAS", fecha:"2026-03-26", notas:"Entrada inicial — recepción de insumos/diesel", origen:"insumos"},
      {id:20000, itemId:20, tipo:"entrada", cantidad:350.0, unidad:"LT", fecha:"2026-03-26", notas:"Entrada inicial — recepción de insumos/diesel", origen:"insumos"},
      {id:21000, itemId:21, tipo:"entrada", cantidad:20.0, unidad:"PIEZA", fecha:"2026-03-26", notas:"Entrada inicial — recepción de insumos/diesel", origen:"insumos"},
      {id:22000, itemId:22, tipo:"entrada", cantidad:22.0, unidad:"LT", fecha:"2026-03-26", notas:"Entrada inicial — recepción de insumos/diesel", origen:"insumos"},
      {id:23000, itemId:23, tipo:"entrada", cantidad:120.0, unidad:"LT", fecha:"2026-03-26", notas:"Entrada inicial — recepción de insumos/diesel", origen:"insumos"},
      {id:24000, itemId:24, tipo:"entrada", cantidad:45.0, unidad:"PIEZA", fecha:"2026-03-26", notas:"Entrada inicial — recepción de insumos/diesel", origen:"insumos"},
      {id:25000, itemId:25, tipo:"entrada", cantidad:37000.0, unidad:"LT", fecha:"2026-03-26", notas:"Entrada inicial — recepción de insumos/diesel", origen:"insumos"}
    ]
  },
  
  usuariosExtra: [],
  usuariosBaseEdit: {}, // overrides para los 3 usuarios base

  // ── PERMISOS DE USUARIO (legacy — roles, mantenido para fallback) ──
  permisosUsuario: {
    socio: ["dashboard","lotes","bitacora","maquinaria","operadores","insumos","diesel","costos","cosecha","rentas","proyeccion","asistente"],
    campo: ["bitacora","lotes"],
  },

  // ── PERMISOS GRANULARES POR USUARIO (override opcional) ──
  // { [userId]: { [moduleId]: "ver" | "editar" } }
  permisosGranulares: {},

  // ── ROLES PERSONALIZADOS (overrides a roles base + roles custom) ──
  // { [rolId]: { id, nombre, icon, color, permisos: { [modId]: "ver"|"editar" } } }
  // Admin NO entra aquí — siempre hardcoded a acceso total
  rolesPersonalizados: {},

  precioVentaMXN: 4800,        // precio global legacy (fallback)
  rendimientoEsperado: 10,    // rendimiento global legacy (fallback)
  paramsCultivo: {
    "1|1|Blanco": { precio: 4500, rendimiento: 10 },  // OI 2025-2026 · Maíz Blanco
  },
  cicloActual: "OI 2025-2026",
  cicloActivoId: 1,        // id del ciclo que se visualiza (no solo el predeterminado)
  cultivoActivo: null,      // { cultivoId, variedad } | null = todos los cultivos
  cultivosCatalogo: [
    { id:1, nombre:"Maíz",    variedades:["Blanco","Amarillo","Dulce"] },
    { id:2, nombre:"Sorgo",   variedades:["Rojo","Blanco","Nervadura Café"] },
    { id:3, nombre:"Frijol",  variedades:["Pinto","Reyna","Flor de Mayo","Azufrado"] },
    { id:4, nombre:"Papa",    variedades:["Alpha","Fianna","Atlantic"] },
    { id:5, nombre:"Garbanzo",variedades:["M-38","Sonora"] },
    { id:6, nombre:"Trigo",   variedades:["Yécora Rojo","Cajeme 71"] },
  ],

  ciclos: [],

  // ── MAQUINARIA ──
  maquinaria: [
    { id:1, nombre:"Tractor T-1", tipo:"Tractor", marca:"", modelo:"", año:2020, placas:"T-1", propietario:"Propio", costoHora:850, horasTotales:0, horasCiclo:0, estado:"activo", notas:"" },
    { id:2, nombre:"Tractor T-2", tipo:"Tractor", marca:"", modelo:"", año:2020, placas:"T-2", propietario:"Propio", costoHora:850, horasTotales:0, horasCiclo:0, estado:"activo", notas:"" },
    { id:3, nombre:"Tractor T-4", tipo:"Tractor", marca:"", modelo:"", año:2020, placas:"T-4", propietario:"Propio", costoHora:850, horasTotales:0, horasCiclo:0, estado:"activo", notas:"" },
    { id:4, nombre:"Tractor T-6", tipo:"Tractor", marca:"", modelo:"", año:2020, placas:"T-6", propietario:"Propio", costoHora:850, horasTotales:0, horasCiclo:0, estado:"activo", notas:"" },
    { id:5, nombre:"Aspersora T-8", tipo:"Aspersora", marca:"", modelo:"", año:2020, placas:"T-8", propietario:"Propio", costoHora:650, horasTotales:0, horasCiclo:0, estado:"activo", notas:"" },
  ],

  // ── OPERADORES ──
  operadores: [
    { id:1, nombre:"Renato Urías",    puesto:"Operador de Tractor",   telefono:"", salarioDia:600, tarifaEspecial:750, diasTrabajados:0, activo:true, maquinaAsignada:"T-1", notas:"" },
    { id:2, nombre:"Jesús Jiménez",   puesto:"Operador de Aspersora", telefono:"", salarioDia:600, tarifaEspecial:750, diasTrabajados:0, activo:true, maquinaAsignada:"T-8", notas:"" },
    { id:3, nombre:"Ramón Lugo",      puesto:"Operador de Tractor",   telefono:"", salarioDia:600, tarifaEspecial:750, diasTrabajados:0, activo:true, maquinaAsignada:"T-2", notas:"" },
    { id:4, nombre:"Manuel Quintero", puesto:"Operador de Tractor",   telefono:"", salarioDia:600, tarifaEspecial:750, diasTrabajados:0, activo:true, maquinaAsignada:"T-4", notas:"" },
    { id:5, nombre:"Javier Ruelas",   puesto:"Operador de Tractor",   telefono:"", salarioDia:600, tarifaEspecial:750, diasTrabajados:0, activo:true, maquinaAsignada:"T-6", notas:"" },
  ],

  asistencias: [],
  pagosSemana: [],
  tarifaStd: { normal:600, especial:750 },

  // ── FLUJOS DE TRABAJO ──────────────────────────────────────────────────────
  // Solicitudes de compra/gasto/aplicación
  solicitudesCompra: [],    // {id, tipo, estatus, creadoPor, creadoEn, historial, ...}
  ordenesTrabajo:    [],    // {id, fecha, operadorId, loteId, maquinariaId, tipoTrabajo, insumoId, horaInicio, horasEstimadas, notas, estatus, creadoPor, creadoEn}
  ordenesCompra:     [],    // {id, solicitudId, cotizaciones[], ordenAprobada, ...}
  solicitudesGasto:  [],    // {id, tipo, estatus, monto, descripcion, historial, ...}
  recomendaciones:   [],    // {id, ingenieroId, descripcion, estatus, historial, ...}
  // Inventario en campo (entradas/salidas autorizadas)
  invCampo:          [],    // {id, insumoNombre, cantidad, unidad, movimientos[]}
  // Notificaciones pendientes por rol
  notificaciones:    [],    // {id, para, tipo, mensaje, leida, fecha, refId}
  // Cola offline (registros capturados sin internet)
  colaOffline:       [],    // {id, timestamp, accion, payload, sincronizado}
  delegaciones:      [],    // {id, de, para, desde, hasta, activa, creadoEn, motivo}

  horasMaq: [],

  // ── ACTIVOS ──
  activos: [],

  // ── CRÉDITOS REFACCIONARIOS ──
  creditosRef: [],

  // ── CAPITAL PROPIO ──
  capital: {
    aportaciones: [],
    retiros: [],
  },

  // ── PERSONAL Y HONORARIOS ──
  personal: [],

  // ── COSECHA Y MAQUILA ──
  cosecha: {
    boletas:    [],
    cuadrillas: [],
    fletes:     [],
    maquila:    [],
    secado:     [],
  },

  // ── RENTAS DE TIERRA ──
  // Cada contrato tiene su calendario de pagos flexible
  rentas: [],

  // ── PROYECCIÓN DEL CICLO (presupuesto por etapa fenológica) ──
  // Basado en hoja PROYECCION del Excel · 468 ha · datos reales del sistema
  proyeccion: [],
};

export function reducer(s, a) {
  switch(a.type) {
    // Lotes
    case "ADD_LOTE":    return { ...s, lotes: [...s.lotes, { ...a.payload, id: Date.now() }] };
    case "UPD_LOTE":   return { ...s, lotes: s.lotes.map(l => l.id===a.payload.id ? a.payload : l) };
    case "DEL_LOTE":   return { ...s, lotes: s.lotes.filter(l => l.id!==a.payload) };
    // Trabajos
    case "ADD_TRABAJO":  return { ...s, trabajos: [{ ...a.payload, id: Date.now() }, ...s.trabajos] };
    case "DEL_TRABAJO":  return { ...s, trabajos: s.trabajos.filter(t => t.id!==a.payload) };
    // Bitácora de campo
    case "ADD_BITACORA": return { ...s, bitacora: [{ ...a.payload, id: Date.now() }, ...(s.bitacora||[]) ] };
    case "DEL_BITACORA": return { ...s, bitacora: (s.bitacora||[]).filter(b => b.id!==a.payload) };
    // Insumos
    case "ADD_INSUMO":   return { ...s, insumos: [{ cicloId:s.cicloActivoId||1, ...a.payload, id: Date.now(), estatus:a.payload.estatus||"pedido", recepciones:a.payload.recepciones||[] }, ...s.insumos] };
    case "ADD_RECEPCION": return { ...s, insumos: s.insumos.map(ins => ins.id!==a.payload.insumoId ? ins : {
        ...ins, recepciones:[...(ins.recepciones||[]),{...a.payload,id:Date.now()}],
        cantidadRecibida:(parseFloat(ins.cantidadRecibida)||0)+parseFloat(a.payload.cantidad||0),
        estatus: ((parseFloat(ins.cantidadRecibida)||0)+parseFloat(a.payload.cantidad||0)) >= (parseFloat(ins.cantidad)||0) ? "recibido" : "parcial"
    })};
    case "RECIBIR_INSUMO": {
      const insumos2 = s.insumos.map(ins => {
        if (ins.id !== a.payload.insumoId) return ins;
        const receps = [...(ins.recepciones||[]), { id:Date.now(), ...a.payload }];
        const totRec = (receps||[]).reduce((sum,r)=>sum+(parseFloat(r.cantidad)||0),0);
        const estatus = totRec >= (parseFloat(ins.cantidad)||0) ? "recibido" : "parcial";
        return { ...ins, recepciones: receps, cantidadRecibida: totRec, estatus };
      });
      // itemId: usa invItemId si viene, si no usa insumoId como fallback
      const movItemId = a.payload.invItemId || a.payload.insumoId;
      return { ...s, insumos: insumos2,
        inventario: { ...s.inventario,
          movimientos: [...(s.inventario?.movimientos||[]), {
            id: Date.now()+1, itemId: movItemId, tipo:"entrada",
            cantidad: parseFloat(a.payload.cantidad)||0,
            fecha: a.payload.fecha,
            concepto: `Recepción desde insumos — ${a.payload.notas||""}`,
            ref: "insumos",
          }]
        }
      };
    }
    case "UPD_INSUMO":   return { ...s, insumos: s.insumos.map(i => i.id===a.payload.id ? a.payload : i) };
    case "DEL_INSUMO":   return { ...s, insumos: s.insumos.filter(i => i.id!==a.payload) };
    case "IMPORT_INSUMOS": return { ...s, insumos: [...(s.insumos||[]), ...a.payload.map(i=>({cicloId:s.cicloActivoId||1,...i,estatus:i.estatus||"pedido",recepciones:i.recepciones||[]}))] };
    // Diesel
    case "RECIBIR_DIESEL": {
      const diesel2 = s.diesel.map(d => {
        if (d.id !== a.payload.dieselId) return d;
        const receps = [...(d.recepciones||[]), { id:Date.now(), ...a.payload }];
        const totRec  = (receps||[]).reduce((sum,r)=>sum+(parseFloat(r.litros)||0),0);
        const pedido  = parseFloat(d.cantidad)||0;
        const estatus = totRec >= pedido ? "recibido" : "parcial";
        return { ...d, recepciones: receps, litrosRecibidos: totRec, estatus };
      });
      const dMovItemId = a.payload.invItemId || a.payload.dieselId;
      return { ...s, diesel: diesel2,
        inventario: { ...s.inventario,
          movimientos: [...(s.inventario?.movimientos||[]), {
            id: Date.now(), itemId: dMovItemId, tipo:"entrada",
            cantidad: parseFloat(a.payload.litros)||0,
            fecha: a.payload.fecha,
            concepto: `Recepción diesel en tanque`,
            ref: "diesel",
          }]
        }
      };
    }
    case "ADD_DIESEL":   return { ...s, diesel: [{ cicloId: s.cicloActivoId||1, ...a.payload, id: Date.now(), estatus: a.payload.estatus||"pedido" }, ...s.diesel] };
    case "DEL_DIESEL":   return { ...s, diesel: s.diesel.filter(d => d.id!==a.payload) };
    case "IMPORT_DIESEL":  return { ...s, diesel: [...(s.diesel||[]), ...a.payload] };
    // Gastos
    case "ADD_GASTO":    return { ...s, gastos: [{ ...a.payload, id: Date.now() }, ...s.gastos] };
    case "DEL_GASTO":    return { ...s, gastos: s.gastos.filter(g => g.id!==a.payload) };
    // Dispersiones (crédito parafinanciero / directo)
    case "ADD_DISPERSION":      return { ...s, dispersiones: [{ cicloId:s.cicloActivoId||1, ...a.payload }, ...(s.dispersiones||[])] };
    case "DEL_DISPERSION":      return { ...s, dispersiones: (s.dispersiones||[]).filter(d=>d.id!==a.payload) };
    case "UPD_DISPERSION":      return { ...s, dispersiones: (s.dispersiones||[]).map(d=>d.id===a.payload.id?a.payload:d) };
    case "IMPORT_DISPERSIONES": return { ...s, dispersiones: [...(s.dispersiones||[]), ...a.payload] };
    // Egresos manuales del ciclo
    case "ADD_EGRESO":  return { ...s, egresosManual: [{ cicloId:s.cicloActivoId||1, ...a.payload }, ...(s.egresosManual||[])] };
    case "DEL_EGRESO":  return { ...s, egresosManual: (s.egresosManual||[]).filter(g=>g.id!==a.payload) };
    case "UPD_EGRESO":  return { ...s, egresosManual: (s.egresosManual||[]).map(g=>g.id===a.payload.id?a.payload:g) };
    case "IMPORT_EGRESOS": return { ...s, egresosManual: [...(s.egresosManual||[]), ...a.payload] };
    // Cancelación / Reactivación de registros transaccionales
    case "CANCELAR_REGISTRO": {
      const { tabla, id, motivo, comentario, canceladoPor, fecha } = a.payload;
      const upd = r => r.id===id ? {...r,cancelado:true,motivoCancelacion:motivo,comentarioCancelacion:comentario,fechaCancelacion:fecha,canceladoPor} : r;
      if (tabla==="insumos")       return {...s,insumos:s.insumos.map(upd)};
      if (tabla==="diesel")        return {...s,diesel:s.diesel.map(upd)};
      if (tabla==="dispersiones")  return {...s,dispersiones:s.dispersiones.map(upd)};
      if (tabla==="egresosManual") return {...s,egresosManual:s.egresosManual.map(upd)};
      if (tabla==="rentas")        return {...s,rentas:s.rentas.map(upd)};
      return s;
    }
    case "REACTIVAR_REGISTRO": {
      const { tabla, id, motivo, comentario, reactivadoPor, fecha } = a.payload;
      const upd = r => r.id===id ? {...r,cancelado:false,motivoReactivacion:motivo,comentarioReactivacion:comentario,fechaReactivacion:fecha,reactivadoPor} : r;
      if (tabla==="insumos")       return {...s,insumos:s.insumos.map(upd)};
      if (tabla==="diesel")        return {...s,diesel:s.diesel.map(upd)};
      if (tabla==="dispersiones")  return {...s,dispersiones:s.dispersiones.map(upd)};
      if (tabla==="egresosManual") return {...s,egresosManual:s.egresosManual.map(upd)};
      if (tabla==="rentas")        return {...s,rentas:s.rentas.map(upd)};
      return s;
    }
    // Maquinaria
    case "ADD_MAQ":      return { ...s, maquinaria: [...s.maquinaria, { ...a.payload, id: Date.now() }] };
    case "UPD_MAQ":      return { ...s, maquinaria: s.maquinaria.map(m => m.id===a.payload.id ? a.payload : m) };
    case "DEL_MAQ":      return { ...s, maquinaria: s.maquinaria.filter(m => m.id!==a.payload) };
    case "ADD_HORAS":    return { ...s, horasMaq: [{ ...a.payload, id: Date.now() }, ...s.horasMaq] };
    case "DEL_HORAS":    return { ...s, horasMaq: s.horasMaq.filter(h => h.id!==a.payload) };
    // Operadores
    case "ADD_OPER":     return { ...s, operadores: [...s.operadores, { ...a.payload, id: Date.now() }] };
    case "UPD_OPER":     return { ...s, operadores: s.operadores.map(o => o.id===a.payload.id ? a.payload : o) };
    case "DEL_OPER":     return { ...s, operadores: s.operadores.filter(o => o.id!==a.payload) };
    case "UPD_TARIFA_STD": return { ...s, tarifaStd: { ...s.tarifaStd, ...a.payload } };
    case "ADD_ASISTENCIA":  return { ...s, asistencias: [...(s.asistencias||[]), { ...a.payload, id: Date.now() }] };
    case "UPD_ASISTENCIA":  return { ...s, asistencias: (s.asistencias||[]).map(x=>x.id===a.payload.id?a.payload:x) };
    case "DEL_ASISTENCIA":  return { ...s, asistencias: (s.asistencias||[]).filter(x=>x.id!==a.payload) };
    case "ADD_PAGO_SEM":    return { ...s, pagosSemana: [...(s.pagosSemana||[]), { ...a.payload, id: Date.now() }] };
    case "UPD_PAGO_SEM":    return { ...s, pagosSemana: (s.pagosSemana||[]).map(x=>x.id===a.payload.id?a.payload:x) };
    case "DEL_PAGO_SEM":    return { ...s, pagosSemana: (s.pagosSemana||[]).filter(x=>x.id!==a.payload) };
    case "RESTORE_KEY":     return { ...s, [a.payload.key]: a.payload.val };

    // ── FLUJOS DE TRABAJO ──────────────────────────────────────────────────────
    // Solicitudes de compra
    case "ADD_SOL_COMPRA":   return { ...s, solicitudesCompra: [{ ...a.payload, id:Date.now(), creadoEn:new Date().toISOString(), historial:[{accion:"Creada",usuario:a.payload.creadoPor,fecha:new Date().toISOString()}] }, ...(s.solicitudesCompra||[])] };
    // Órdenes de trabajo (flujo Encargado → Operador)
    case "ADD_ORDEN_TRABAJO": return { ...s, ordenesTrabajo: [{ ...a.payload, id: a.payload.id || Date.now(), creadoEn: a.payload.creadoEn || new Date().toISOString(), estatus: a.payload.estatus || "pendiente" }, ...(s.ordenesTrabajo||[])] };
    case "UPD_ORDEN_TRABAJO": return { ...s, ordenesTrabajo: (s.ordenesTrabajo||[]).map(x=>x.id===a.payload.id?{...x,...a.payload}:x) };
    case "DEL_ORDEN_TRABAJO": return { ...s, ordenesTrabajo: (s.ordenesTrabajo||[]).filter(x=>x.id!==a.payload) };
    case "UPD_SOL_COMPRA":   return { ...s, solicitudesCompra: (s.solicitudesCompra||[]).map(x=>x.id===a.payload.id?{...x,...a.payload}:x) };
    case "DEL_SOL_COMPRA":   return { ...s, solicitudesCompra: (s.solicitudesCompra||[]).filter(x=>x.id!==a.payload) };
    // Órdenes de compra
    case "ADD_ORDEN_COMPRA":  return { ...s, ordenesCompra: [{ ...a.payload, id:Date.now(), creadoEn:new Date().toISOString() }, ...(s.ordenesCompra||[])] };
    case "UPD_ORDEN_COMPRA":  return { ...s, ordenesCompra: (s.ordenesCompra||[]).map(x=>x.id===a.payload.id?{...x,...a.payload}:x) };
    // Solicitudes de gasto
    case "ADD_SOL_GASTO":    return { ...s, solicitudesGasto: [{ ...a.payload, id:Date.now(), creadoEn:new Date().toISOString(), historial:[{accion:"Creada",usuario:a.payload.creadoPor,fecha:new Date().toISOString()}] }, ...(s.solicitudesGasto||[])] };
    case "UPD_SOL_GASTO":    return { ...s, solicitudesGasto: (s.solicitudesGasto||[]).map(x=>x.id===a.payload.id?{...x,...a.payload}:x) };
    case "DEL_SOL_GASTO":    return { ...s, solicitudesGasto: (s.solicitudesGasto||[]).filter(x=>x.id!==a.payload) };
    // Recomendaciones de aplicación
    case "ADD_RECOM":        return { ...s, recomendaciones: [{ ...a.payload, id:Date.now(), creadoEn:new Date().toISOString(), historial:[{accion:"Creada",usuario:a.payload.creadoPor,fecha:new Date().toISOString()}] }, ...(s.recomendaciones||[])] };
    case "UPD_RECOM":        return { ...s, recomendaciones: (s.recomendaciones||[]).map(x=>x.id===a.payload.id?{...x,...a.payload}:x) };
    // Inventario en campo
    case "ADD_INV_CAMPO":    return { ...s, invCampo: [{ ...a.payload, id:Date.now(), movimientos:[] }, ...(s.invCampo||[])] };
    case "MOV_INV_CAMPO":    return { ...s, invCampo: (s.invCampo||[]).map(item=>item.id!==a.payload.itemId?item:{...item,
        cantidad:(parseFloat(item.cantidad)||0)+(a.payload.tipo==="entrada"?1:-1)*parseFloat(a.payload.cantidad),
        movimientos:[...(item.movimientos||[]),{...a.payload,id:Date.now(),fecha:new Date().toISOString()}]
      })};
    // Notificaciones
    case "ADD_NOTIF":        return { ...s, notificaciones: [{ ...a.payload, id:Date.now(), fecha:new Date().toISOString(), leida:false }, ...(s.notificaciones||[])] };
    case "LEER_NOTIF":       return { ...s, notificaciones: (s.notificaciones||[]).map(n=>n.id===a.payload?{...n,leida:true}:n) };
    case "LEER_ALL_NOTIF":   return { ...s, notificaciones: (s.notificaciones||[]).map(n=>({...n,leida:true})) };
    // Cola offline
    case "ADD_OFFLINE":      return { ...s, colaOffline: [...(s.colaOffline||[]), { ...a.payload, id:Date.now(), timestamp:new Date().toISOString(), sincronizado:false }] };
    case "SYNC_OFFLINE":     return { ...s, colaOffline: (s.colaOffline||[]).map(x=>x.id===a.payload?{...x,sincronizado:true}:x) };
    // Delegaciones
    case "ADD_DELEGACION":   return { ...s, delegaciones: [...(s.delegaciones||[]), { ...a.payload, id:Date.now(), creadoEn:new Date().toISOString(), activa:true }] };
    case "REV_DELEGACION":   return { ...s, delegaciones: (s.delegaciones||[]).map(d=>d.id===a.payload?{...d,activa:false,revocadaEn:new Date().toISOString()}:d) };
    // Crédito habilitación (global legacy)
    case "ADD_MINISTRACION": return { ...s, credito: { ...s.credito, ministraciones: [...s.credito.ministraciones, { ...a.payload, id: Date.now() }] } };
    case "DEL_MINISTRACION": return { ...s, credito: { ...s.credito, ministraciones: s.credito.ministraciones.filter(m => m.id!==a.payload) } };
    case "ADD_PAGO_CREDITO": return { ...s, credito: { ...s.credito, pagos: [...s.credito.pagos, { ...a.payload, id: Date.now() }] } };
    case "DEL_PAGO_CREDITO": return { ...s, credito: { ...s.credito, pagos: s.credito.pagos.filter(p => p.id!==a.payload) } };
    case "UPD_CREDITO_INFO": return { ...s, credito: { ...s.credito, ...a.payload } };
    // Expedientes por RESICO
    case "UPD_EXPEDIENTE": {
      const exists = s.expedientes.some(e=>e.id===a.payload.id||e.productorId===a.payload.productorId);
      if (exists) {
        return { ...s, expedientes: s.expedientes.map(e=>
          (e.id===a.payload.id || e.productorId===a.payload.productorId) ? {...e,...a.payload} : e
        )};
      }
      // Crear nuevo si no existe
      return { ...s, expedientes: [...s.expedientes, {...a.payload, id: a.payload.productorId||Date.now()}] };
    }
    case "ADD_MIN_EXP":      return { ...s, expedientes: s.expedientes.map(e => (e.id===a.payload.expId||e.productorId===a.payload.expId) ? {...e, ministraciones:[...(e.ministraciones||[]),{...a.payload,id:Date.now()}]} : e) };
    case "DEL_MIN_EXP":      return { ...s, expedientes: s.expedientes.map(e => (e.id===a.payload.expId||e.productorId===a.payload.expId) ? {...e, ministraciones:(e.ministraciones||[]).filter(m=>m.id!==a.payload.id)} : e) };
    case "ADD_PAGO_EXP":     return { ...s, expedientes: s.expedientes.map(e => (e.id===a.payload.expId||e.productorId===a.payload.expId) ? {...e, pagos:[...(e.pagos||[]),{...a.payload,id:Date.now()}]} : e) };
    case "DEL_PAGO_EXP":     return { ...s, expedientes: s.expedientes.map(e => (e.id===a.payload.expId||e.productorId===a.payload.expId) ? {...e, pagos:(e.pagos||[]).filter(p=>p.id!==a.payload.id)} : e) };
    case "ADD_DOC_EXP":      return { ...s, expedientes: s.expedientes.map(e => e.id===a.payload.expId ? {...e, documentos:[...e.documentos,{...a.payload,id:Date.now()}]} : e) };
    case "DEL_DOC_EXP":      return { ...s, expedientes: s.expedientes.map(e => e.id===a.payload.expId ? {...e, documentos:e.documentos.filter(d=>d.id!==a.payload.id)} : e) };
    // Activos
    case "ADD_ACTIVO":   return { ...s, activos: [...s.activos, { ...a.payload, id: Date.now() }] };
    case "UPD_ACTIVO":   return { ...s, activos: s.activos.map(a2 => a2.id===a.payload.id ? a.payload : a2) };
    case "DEL_ACTIVO":   return { ...s, activos: s.activos.filter(a2 => a2.id!==a.payload) };
    // Rentas de tierra
    case "ADD_RENTA":      return { ...s, rentas: [...s.rentas, { ...a.payload, id: Date.now(), pagos:[] }] };
    case "UPD_RENTA":      return { ...s, rentas: s.rentas.map(r => r.id===a.payload.id ? a.payload : r) };
    case "DEL_RENTA":      return { ...s, rentas: s.rentas.filter(r => r.id!==a.payload) };
    case "ADD_PAGO_RENTA": return { ...s, rentas: s.rentas.map(r => r.id===a.payload.rentaId ? {...r, pagos:[...r.pagos,{...a.payload,id:Date.now()}]} : r) };
    case "UPD_PAGO_RENTA": return { ...s, rentas: s.rentas.map(r => r.id===a.payload.rentaId ? {...r, pagos:r.pagos.map(p=>p.id===a.payload.id?a.payload:p)} : r) };
    case "DEL_PAGO_RENTA": return { ...s, rentas: s.rentas.map(r => r.id===a.payload.rentaId ? {...r, pagos:r.pagos.filter(p=>p.id!==a.payload.id)} : r) };
    // Créditos refaccionarios
    case "ADD_CRED_REF": return { ...s, creditosRef: [...s.creditosRef, { ...a.payload, id: Date.now(), ministraciones:[], pagos:[] }] };
    case "UPD_CRED_REF": return { ...s, creditosRef: s.creditosRef.map(c => c.id===a.payload.id ? {...c,...a.payload} : c) };
    case "DEL_CRED_REF": return { ...s, creditosRef: s.creditosRef.filter(c => c.id!==a.payload) };
    case "ADD_MIN_REF":  return { ...s, creditosRef: s.creditosRef.map(c => c.id===a.payload.credId ? {...c, ministraciones:[...c.ministraciones,{...a.payload,id:Date.now()}]} : c) };
    case "DEL_MIN_REF":  return { ...s, creditosRef: s.creditosRef.map(c => c.id===a.payload.credId ? {...c, ministraciones:c.ministraciones.filter(m=>m.id!==a.payload.id)} : c) };
    case "ADD_PAGO_REF": return { ...s, creditosRef: s.creditosRef.map(c => c.id===a.payload.credId ? {...c, pagos:[...c.pagos,{...a.payload,id:Date.now()}]} : c) };
    case "DEL_PAGO_REF": return { ...s, creditosRef: s.creditosRef.map(c => c.id===a.payload.credId ? {...c, pagos:c.pagos.filter(p=>p.id!==a.payload.id)} : c) };
    // Capital propio
    case "ADD_APORTACION": return { ...s, capital: { ...s.capital, aportaciones: [...s.capital.aportaciones, { ...a.payload, id: Date.now() }] } };
    case "DEL_APORTACION": return { ...s, capital: { ...s.capital, aportaciones: s.capital.aportaciones.filter(a2=>a2.id!==a.payload) } };
    case "ADD_RETIRO":     return { ...s, capital: { ...s.capital, retiros: [...s.capital.retiros, { ...a.payload, id: Date.now() }] } };
    case "DEL_RETIRO":     return { ...s, capital: { ...s.capital, retiros: s.capital.retiros.filter(r=>r.id!==a.payload) } };
    // Personal
    case "ADD_PERSONAL":   return { ...s, personal: [...s.personal, { ...a.payload, id: Date.now() }] };
    case "UPD_PERSONAL":   return { ...s, personal: s.personal.map(p => p.id===a.payload.id ? a.payload : p) };
    case "DEL_PERSONAL":   return { ...s, personal: s.personal.filter(p => p.id!==a.payload) };
    // Cosecha
    case "ADD_CUADRILLA":  return { ...s, cosecha: { ...s.cosecha, cuadrillas: [...s.cosecha.cuadrillas, { ...a.payload, id: Date.now() }] } };
    case "DEL_CUADRILLA":  return { ...s, cosecha: { ...s.cosecha, cuadrillas: s.cosecha.cuadrillas.filter(c=>c.id!==a.payload) } };
    case "ADD_FLETE":      return { ...s, cosecha: { ...s.cosecha, fletes: [...s.cosecha.fletes, { ...a.payload, id: Date.now() }] } };
    case "DEL_FLETE":      return { ...s, cosecha: { ...s.cosecha, fletes: s.cosecha.fletes.filter(f=>f.id!==a.payload) } };
    case "ADD_MAQUILA":    return { ...s, cosecha: { ...s.cosecha, maquila: [...s.cosecha.maquila, { ...a.payload, id: Date.now() }] } };
    case "DEL_MAQUILA":    return { ...s, cosecha: { ...s.cosecha, maquila: s.cosecha.maquila.filter(m=>m.id!==a.payload) } };
    case "ADD_SECADO":     return { ...s, cosecha: { ...s.cosecha, secado: [...s.cosecha.secado, { ...a.payload, id: Date.now() }] } };
    case "DEL_SECADO":     return { ...s, cosecha: { ...s.cosecha, secado: s.cosecha.secado.filter(s2=>s2.id!==a.payload) } };
    // Config
    case "SET_PRECIO_VENTA": return { ...s, precioVentaMXN: parseFloat(a.payload)||0 };
    // Proyección
    case "ADD_PROY":    return { ...s, proyeccion: [...s.proyeccion, { ...a.payload, id:`U${Date.now()}` }] };
    case "UPD_PROY":    return { ...s, proyeccion: s.proyeccion.map(p => p.id===a.payload.id ? a.payload : p) };
    case "DEL_PROY":    return { ...s, proyeccion: s.proyeccion.filter(p => p.id!==a.payload) };
    case "SET_REND_ESP": return { ...s, rendimientoEsperado: parseFloat(a.payload)||0 };
    case "SET_PRODUCTOR_ACTIVO": return { ...s, productorActivo: a.payload };
    case "ADD_PRODUCTOR":   return { ...s, productores: [...s.productores, { ...a.payload, id: Date.now() }] };
    case "UPD_PRODUCTOR":   return { ...s, productores: s.productores.map(p => p.id===a.payload.id ? a.payload : p) };
    case "DEL_PRODUCTOR":   return { ...s, productores: s.productores.filter(p => p.id!==a.payload) };
    // ── CICLOS ──

    case "ADD_CULTIVO_CAT":   return { ...s, cultivosCatalogo: [...(s.cultivosCatalogo||[]), {...a.payload,id:Date.now()}] };
    case "UPD_CULTIVO_CAT":   return { ...s, cultivosCatalogo: (s.cultivosCatalogo||[]).map(c=>c.id===a.payload.id?a.payload:c) };
    case "DEL_CULTIVO_CAT":   return { ...s, cultivosCatalogo: (s.cultivosCatalogo||[]).filter(c=>c.id!==a.payload) };
    case "ADD_VAR_CAT":       return { ...s, cultivosCatalogo: (s.cultivosCatalogo||[]).map(c=>c.id===a.payload.cultivoId?{...c,variedades:[...c.variedades,a.payload.variedad]}:c) };
    case "ADD_CICLO":      return { ...s, ciclos: [...(s.ciclos||[]), a.payload] };
    case "UPD_CICLO":      return { ...s, ciclos: (s.ciclos||[]).map(c=>c.id===a.payload.id?a.payload:c) };
    case "DEL_CICLO":      return { ...s, ciclos: (s.ciclos||[]).filter(c=>c.id!==a.payload) };
    case "UPD_USUARIO_BASE":  return { ...s, usuariosBaseEdit: { ...(s.usuariosBaseEdit||{}), [a.payload.id]: a.payload } };
    case "ADD_USUARIO_EXTRA": return { ...s, usuariosExtra: [...(s.usuariosExtra||[]), a.payload] };
    case "UPD_USUARIO_EXTRA": return { ...s, usuariosExtra: (s.usuariosExtra||[]).map(u=>u.id===a.payload.id?a.payload:u) };
    case "DEL_USUARIO_EXTRA": return { ...s, usuariosExtra: (s.usuariosExtra||[]).filter(u=>u.id!==a.payload) };
    case "ADD_INV_ITEM":      return { ...s, inventario: {...s.inventario, items:[...(s.inventario?.items||[]), {...a.payload,id:a.payload.id||Date.now()}]} };
    case "UPD_INV_ITEM":      return { ...s, inventario: {...s.inventario, items:(s.inventario?.items||[]).map(x=>x.id===a.payload.id?a.payload:x)} };
    case "DEL_INV_ITEM":      return { ...s, inventario: {...s.inventario, items:(s.inventario?.items||[]).filter(x=>x.id!==a.payload)} };
    case "ADD_INV_MOV":       return { ...s, inventario: {...s.inventario, movimientos:[...(s.inventario?.movimientos||[]), {...a.payload,id:Date.now()}]} };
    case "DEL_INV_MOV":       return { ...s, inventario: {...s.inventario, movimientos:(s.inventario?.movimientos||[]).filter(x=>x.id!==a.payload)} };
    case "IMPORT_BOLETAS":   return { ...s, cosecha: {...s.cosecha, boletas:[...(s.cosecha?.boletas||[]), ...a.payload]} };
    case "CANCELAR_BOLETA":  return { ...s, cosecha: {...s.cosecha, boletas:(s.cosecha?.boletas||[]).map(b=>b.id===a.payload?{...b,cancelado:true}:b)} };
    case "REACTIVAR_BOLETA": return { ...s, cosecha: {...s.cosecha, boletas:(s.cosecha?.boletas||[]).map(b=>b.id===a.payload?{...b,cancelado:false}:b)} };
    case "UPD_CONFIG": return { ...s, precioVentaMXN: a.payload.precioVentaMXN||s.precioVentaMXN, rendimientoEsperado: a.payload.rendimientoEsperado||s.rendimientoEsperado };
    case "UPD_PARAMS_CULTIVO": {
      // a.payload = { key:"cicloId|cultivoId|variedad", precio, rendimiento }
      return { ...s,
        paramsCultivo: { ...(s.paramsCultivo||{}), [a.payload.key]: { precio: a.payload.precio, rendimiento: a.payload.rendimiento } },
        // También actualizar globals para compatibilidad con módulos legacy
        precioVentaMXN: a.payload.precio,
        rendimientoEsperado: a.payload.rendimiento,
      };
    }
    case "SET_ALERTA_PARAMS": return { ...s, alertaParams: { ...(s.alertaParams||{}), ...a.payload } };
    case "SET_CREDITO_LIMITES": return { ...s, creditoLimites: { ...(s.creditoLimites||{}), ...a.payload } };
    case "MARCAR_ALERTA_LEIDA": return { ...s, alertasLeidas: [...new Set([...(s.alertasLeidas||[]), a.payload])] };
    case "DESMARCAR_ALERTA_LEIDA": return { ...s, alertasLeidas: (s.alertasLeidas||[]).filter(id=>id!==a.payload) };
    case "LIMPIAR_ALERTAS_LEIDAS": return { ...s, alertasLeidas: [] };
    case "SET_CREDITO_PARAMS": return { ...s, creditoParams: a.payload };
    case "SET_IA_CONFIG": return { ...s, iaMotor: a.payload.motor, iaKeyGemini: a.payload.keyGemini, iaKeyClaude: a.payload.keyClaude };
    case "SET_IA_HISTORIAL": return { ...s, iaHistorial: a.payload };
    case "UPD_PERMISOS_ROL": return { ...s, permisosUsuario: { ...s.permisosUsuario, [a.payload.rol]: a.payload.modulos } };
    case "SET_PERMISOS_USUARIO": return { ...s, permisosGranulares: { ...s.permisosGranulares, [a.payload.userId]: a.payload.permisos } };
    case "CLEAR_PERMISOS_USUARIO": { const n={...(s.permisosGranulares||{})}; delete n[a.payload]; return {...s, permisosGranulares:n}; }
    case "SET_ROL": return { ...s, rolesPersonalizados: { ...(s.rolesPersonalizados||{}), [a.payload.id]: a.payload } };
    case "SYNC_STATE": {
      // Actualiza solo las claves sincronizadas desde un peer remoto sin tocar el resto del state.
      const p = a.payload || {};
      const next = { ...s };
      SYNC_KEYS.forEach(k => { if (p[k] !== undefined) next[k] = p[k]; });
      return next;
    }
    case "DEL_ROL": { const n={...(s.rolesPersonalizados||{})}; delete n[a.payload]; return {...s, rolesPersonalizados:n}; }
    case "SET_CICLO_ACTIVO_ID": return { ...s, cicloActivoId: a.payload,
      cicloActual: (s.ciclos||[]).find(c=>c.id===a.payload)?.nombre || s.cicloActual,
      cultivoActivo: null };
    case "SET_CULTIVO_ACTIVO": return { ...s, cultivoActivo: a.payload };
    case "SET_CICLO_PRED": return {
      ...s,
      cicloActual: (s.ciclos||[]).find(c=>c.id===a.payload)?.nombre || s.cicloActual,
      ciclos: (s.ciclos||[]).map(c=>({...c, predeterminado: c.id===a.payload}))
    };
    default: return s;
  }
}

export const Ctx = createContext(null);

export function useData() {
  return useContext(Ctx);
}
