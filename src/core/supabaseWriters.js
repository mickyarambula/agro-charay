// ─── core/supabaseWriters.js ───────────────────────────────────
// Writers compartidos para Supabase. Centraliza POST de bitácora
// para que todos los módulos escriban con el mismo payload.
// ─────────────────────────────────────────────────────────────
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase.js';

/**
 * POST a bitacora_trabajos. Devuelve { ...rows[0], id: legacyId } o null en fallo.
 * @param {object} payload  Campos de bitácora (tipo, loteId/loteIds, fecha, etc.)
 * @param {number|string|null} cicloActivoId  Ciclo activo del state global
 * @param {object} [opts]
 * @param {boolean} [opts.silent=false]  Si true, no muestra alert() al usuario. Errores siguen en console.error.
 */
export async function postBitacora(payload, cicloActivoId, { silent = false } = {}) {
  const legacyId = Date.now();
  const body = {
    legacy_id: legacyId,
    tipo: payload.tipo,
    lote_id: payload.loteId != null ? String(payload.loteId) : null,
    lote_ids: payload.loteIds || [],
    fecha: payload.fecha,
    operador: payload.operador || null,
    operador_id: payload.operadorId ? String(payload.operadorId) : null,
    maquinaria_id: payload.maquinariaId ? String(payload.maquinariaId) : null,
    horas: payload.horas || null,
    notas: payload.notas || null,
    data: payload.data || {},
    fuente: 'bitacora',
    ciclo_id: cicloActivoId != null ? String(cicloActivoId) : null,
  };
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/bitacora_trabajos`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('[Bitacora] POST falló:', res.status, err);
      if (!silent) alert('Error al guardar bitácora: ' + res.status);
      return null;
    }
    const rows = await res.json();
    return { ...rows[0], id: legacyId };
  } catch (e) {
    console.error('[Bitacora] POST excepción:', e);
    if (!silent) alert('Error de red al guardar bitácora: ' + e.message);
    return null;
  }
}

/**
 * DELETE a bitacora_trabajos por legacy_id. Devuelve true si borró, false si falló.
 * @param {number|string} legacyId  legacy_id de la fila a borrar (el id local del reducer)
 * @param {object} [opts]
 * @param {boolean} [opts.silent=false]  Si true, no muestra alert() al usuario. Errores siguen en console.error.
 */
export async function deleteBitacora(legacyId, { silent = false } = {}) {
  if (legacyId == null) {
    console.error('[Bitacora] DELETE abortado: legacyId nulo');
    if (!silent) alert('Error al borrar bitácora: id faltante');
    return false;
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/bitacora_trabajos?legacy_id=eq.${legacyId}`, {
      method: 'DELETE',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('[Bitacora] DELETE falló:', res.status, err);
      if (!silent) alert('Error al borrar bitácora: ' + res.status);
      return false;
    }
    const rows = await res.json();
    if (!rows || rows.length === 0) {
      console.warn('[Bitacora] DELETE no afectó filas (legacy_id no existe en BD):', legacyId);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[Bitacora] DELETE excepción:', e);
    if (!silent) alert('Error de red al borrar bitácora: ' + e.message);
    return false;
  }
}

/**
 * POST capital_movimientos (aportación o retiro)
 */
export async function postCapital(signo, form) {
  const legacyId = Date.now();
  const row = {
    legacy_id: legacyId,
    signo,
    monto: parseFloat(form.monto),
    fecha: form.fecha,
    concepto: form.concepto || '',
    notas: form.referencia || form.notas || '',
  };
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/capital_movimientos`,
      { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(row) }
    );
    if (!res.ok) { console.error('[postCapital] error:', res.status, await res.text()); return null; }
    const rows = await res.json();
    return { ...rows[0], id: legacyId };
  } catch (e) { console.error('[postCapital] exception:', e); return null; }
}

/**
 * DELETE capital_movimientos por legacy_id
 */
export async function deleteCapital(legacyId) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/capital_movimientos?legacy_id=eq.${legacyId}`,
      { method: 'DELETE', headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, Prefer: 'return=representation' } }
    );
    if (!res.ok) { console.error('[deleteCapital] error:', res.status, await res.text()); return false; }
    const deleted = await res.json();
    if (deleted.length === 0) { console.warn('[deleteCapital] no rows matched legacy_id:', legacyId); }
    return true;
  } catch (e) { console.error('[deleteCapital] exception:', e); return false; }
}

/**
 * PATCH singleton tarifa_std (tabla con 1 fila). Devuelve la fila actualizada o null.
 */
export async function updateTarifaStd(tarifaObj) {
  // PATCH al singleton — no necesita id, solo hay 1 fila
  const res = await fetch(`${SUPABASE_URL}/rest/v1/tarifa_std?id=not.is.null`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      normal: tarifaObj.normal,
      especial: tarifaObj.especial,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) { const t = await res.text(); console.error('updateTarifaStd error:', t); return null; }
  const rows = await res.json();
  return rows[0] || null;
}

// --- ASISTENCIAS ---
export async function postAsistencia(record) {
  const body = {
    legacy_id: record.id,  // Date.now() del reducer
    fecha: record.fecha,
    operador_id: record.operadorId,
    tarifa_dia: record.tarifaDia,
    nota: record.nota || '',
    lote_id: record.loteId || '',
    trabajo: record.trabajo || '',
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/asistencias`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const t = await res.text(); console.error('postAsistencia error:', t); return null; }
  const rows = await res.json();
  return rows[0] || null;
}

export async function deleteAsistencia(legacyId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/asistencias?legacy_id=eq.${legacyId}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) { const t = await res.text(); console.error('deleteAsistencia error:', t); return false; }
  return true;
}

// --- PAGOS SEMANA ---
export async function postPagoSemana(record) {
  const body = {
    legacy_id: record.id,
    semana: record.semana,
    label: record.label || '',
    fecha_pago: record.fechaPago,
    total: record.total,
    pagado: record.pagado ?? true,
    detalle: record.detalle || [],
    updated_at: new Date().toISOString(),
  };
  // UPSERT por semana (solo 1 pago por semana)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/pagos_semana?on_conflict=semana`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const t = await res.text(); console.error('postPagoSemana error:', t); return null; }
  const rows = await res.json();
  return rows[0] || null;
}

export async function deletePagoSemana(legacyId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/pagos_semana?legacy_id=eq.${legacyId}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) { const t = await res.text(); console.error('deletePagoSemana error:', t); return false; }
  return true;
}

// --- HORAS MAQ ---
export async function postHorasMaq(record) {
  const body = {
    legacy_id: record.id,
    maquinaria_id: String(record.maqId),
    horas: record.horas || 0,
    fecha: record.fecha,
    nota: record.concepto || '',
    fuente: record.fuente || 'manual',
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/horas_maq`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const t = await res.text(); console.error('postHorasMaq error:', t); return null; }
  const rows = await res.json();
  return rows[0] || null;
}

export async function deleteHorasMaq(legacyId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/horas_maq?legacy_id=eq.${legacyId}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) { const t = await res.text(); console.error('deleteHorasMaq error:', t); return false; }
  return true;
}

// --- PROYECCION ---
export async function postProyeccion(record) {
  const body = {
    legacy_id: String(record.id),
    etapa: record.etapa || '',
    concepto: record.concepto || '',
    categoria: record.categoria || '',
    unidad: record.unidad || 'ha',
    cantidad: record.cantidad || 0,
    costo_unit: record.costoUnit || 0,
    total_proy: record.totalProy || 0,
    ha: record.ha || 0,
    notas: record.notas || '',
    vinculo: record.vinculo || 'manual',
    egreso_ids: record.egresoIds || [],
    real_monto: record.real || 0,
    updated_at: new Date().toISOString(),
  };
  // UPSERT por legacy_id (para que UPD_PROY también funcione)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/proyeccion?on_conflict=legacy_id`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const t = await res.text(); console.error('postProyeccion error:', t); return null; }
  const rows = await res.json();
  return rows[0] || null;
}

export async function deleteProyeccion(legacyId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/proyeccion?legacy_id=eq.${encodeURIComponent(String(legacyId))}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) { const t = await res.text(); console.error('deleteProyeccion error:', t); return false; }
  return true;
}

// ───── COSECHA ─────────────────────────────────────────────────────
// 5 subtablas: boletas, cuadrillas, fletes, maquila, secado
// El shape del state y el schema de Supabase no coinciden 1:1 — se
// mapean los campos comunes a columnas, y los extras se guardan como
// JSON en la columna `notas` para preservar fidelidad en round-trip.

export async function postCosechaBoleta(record, cicloUuid, productorUuid) {
  const legacyId = record.id || Date.now();
  const extras = {
    codigo: record.codigo || '',
    cultivo: record.cultivo || '',
    pnsa: record.pnsa || 0,
    camion: record.camion || '',
    productorNombre: record.productorNombre || '',
  };
  const body = {
    legacy_id: legacyId,
    ciclo_id: cicloUuid || null,
    productor_id: productorUuid || null,
    fecha: record.fecha || null,
    num_boleta: record.boleta || '',
    kg_bruto: parseFloat(record.bruto) || 0,
    kg_tara: parseFloat(record.tara) || 0,
    kg_neto: parseFloat(record.pna) || 0,
    humedad: parseFloat(record.hum) || 0,
    placas: record.placas || '',
    chofer: record.chofer || '',
    cancelado: record.cancelado === true,
    notas: JSON.stringify(extras),
  };
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/cosecha_boletas`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(body),
    });
    if (!res.ok) { const t = await res.text(); console.error('postCosechaBoleta error:', t); return null; }
    const rows = await res.json();
    return rows[0] ? { ...rows[0], id: legacyId } : null;
  } catch (e) { console.error('postCosechaBoleta exception:', e); return null; }
}

export async function postCosechaCuadrilla(record, cicloUuid) {
  const legacyId = record.id || Date.now();
  const extras = {
    fecha: record.fecha || '',
    ha: parseFloat(record.ha) || 0,
    precioHa: parseFloat(record.precioHa) || 0,
    concepto: record.concepto || '',
    notas: record.notas || '',
  };
  const body = {
    legacy_id: legacyId,
    ciclo_id: cicloUuid || null,
    nombre: record.concepto || '',
    tarifa: parseFloat(record.precioHa) || 0,
    notas: JSON.stringify(extras),
  };
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/cosecha_cuadrillas`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(body),
    });
    if (!res.ok) { const t = await res.text(); console.error('postCosechaCuadrilla error:', t); return null; }
    const rows = await res.json();
    return rows[0] ? { ...rows[0], id: legacyId } : null;
  } catch (e) { console.error('postCosechaCuadrilla exception:', e); return null; }
}

export async function postCosechaFlete(record, cicloUuid) {
  const legacyId = record.id || Date.now();
  const toneladas = parseFloat(record.toneladas) || 0;
  const precioTon = parseFloat(record.precioTon) || 0;
  const extras = {
    toneladas,
    precioTon,
    concepto: record.concepto || '',
    notas: record.notas || '',
  };
  const body = {
    legacy_id: legacyId,
    ciclo_id: cicloUuid || null,
    fecha: record.fecha || null,
    transportista: record.concepto || '',
    kg: toneladas * 1000,
    tarifa_ton: precioTon,
    importe: toneladas * precioTon,
    notas: JSON.stringify(extras),
  };
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/cosecha_fletes`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(body),
    });
    if (!res.ok) { const t = await res.text(); console.error('postCosechaFlete error:', t); return null; }
    const rows = await res.json();
    return rows[0] ? { ...rows[0], id: legacyId } : null;
  } catch (e) { console.error('postCosechaFlete exception:', e); return null; }
}

export async function postCosechaMaquila(record, cicloUuid) {
  const legacyId = record.id || Date.now();
  const ha = parseFloat(record.ha) || 0;
  const precioHa = parseFloat(record.precioHa) || 0;
  const extras = {
    fecha: record.fecha || '',
    ha,
    precioHa,
    concepto: record.concepto || '',
    notas: record.notas || '',
  };
  const body = {
    legacy_id: legacyId,
    ciclo_id: cicloUuid || null,
    fecha: record.fecha || null,
    concepto: record.concepto || '',
    importe: ha * precioHa,
    notas: JSON.stringify(extras),
  };
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/cosecha_maquila`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(body),
    });
    if (!res.ok) { const t = await res.text(); console.error('postCosechaMaquila error:', t); return null; }
    const rows = await res.json();
    return rows[0] ? { ...rows[0], id: legacyId } : null;
  } catch (e) { console.error('postCosechaMaquila exception:', e); return null; }
}

export async function postCosechaSecado(record, cicloUuid) {
  const legacyId = record.id || Date.now();
  const toneladas = parseFloat(record.toneladas) || 0;
  const costoTon = parseFloat(record.costoTon) || 0;
  const extras = {
    toneladas,
    costoTon,
    concepto: record.concepto || '',
    notas: record.notas || '',
  };
  const body = {
    legacy_id: legacyId,
    ciclo_id: cicloUuid || null,
    fecha: record.fecha || null,
    planta: record.concepto || '',
    kg_humedo: toneladas * 1000,
    tarifa_punto: costoTon,
    importe: toneladas * costoTon,
    notas: JSON.stringify(extras),
  };
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/cosecha_secado`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(body),
    });
    if (!res.ok) { const t = await res.text(); console.error('postCosechaSecado error:', t); return null; }
    const rows = await res.json();
    return rows[0] ? { ...rows[0], id: legacyId } : null;
  } catch (e) { console.error('postCosechaSecado exception:', e); return null; }
}

export async function patchCosechaBoleta(legacyId, fields) {
  if (legacyId == null) { console.error('patchCosechaBoleta: legacyId nulo'); return false; }
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/cosecha_boletas?legacy_id=eq.${encodeURIComponent(String(legacyId))}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(fields),
    });
    if (!res.ok) { const t = await res.text(); console.error('patchCosechaBoleta error:', t); return false; }
    const rows = await res.json();
    if (!rows || rows.length === 0) { console.warn('patchCosechaBoleta: sin filas afectadas para legacy_id', legacyId); return false; }
    return true;
  } catch (e) { console.error('patchCosechaBoleta exception:', e); return false; }
}

const COSECHA_TABLAS = {
  boletas: 'cosecha_boletas',
  cuadrillas: 'cosecha_cuadrillas',
  fletes: 'cosecha_fletes',
  maquila: 'cosecha_maquila',
  secado: 'cosecha_secado',
};

export async function deleteCosechaRecord(tabla, legacyId) {
  const tablaReal = COSECHA_TABLAS[tabla] || tabla;
  if (legacyId == null) { console.error('[Cosecha] DELETE abortado: legacyId nulo'); return false; }
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${tablaReal}?legacy_id=eq.${encodeURIComponent(String(legacyId))}`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (!res.ok) { const t = await res.text(); console.error('deleteCosechaRecord error:', tablaReal, t); return false; }
    return true;
  } catch (e) { console.error('deleteCosechaRecord exception:', e); return false; }
}

/**
 * POST a tabla diesel — registra un movimiento (entrada/salida_interna/salida_externa).
 * Encapsula el payload completo para que DashboardCampo y Diesel.jsx compartan el mismo schema.
 *
 * @param {object} record  Shape del state:
 *   { tipo, fecha, litros, precioLitro, proveedor, maquinariaId,
 *     operador, concepto, productorId, bitacoraLegacyId, notas,
 *     id? (opcional — si no se pasa, se genera con Date.now()) }
 * @param {object} opts    { registradoPor }
 * @returns {object|null}  La fila insertada (o null si falló).
 */
export async function postDieselCarga(record, { registradoPor } = {}) {
  const legacyId = record.id || Date.now();
  const litros = parseFloat(record.litros) || 0;
  const precio = parseFloat(record.precioLitro) || 0;
  const body = {
    legacy_id: legacyId,
    fecha: record.fecha,
    fecha_solicitud: record.fecha,
    fecha_orden: record.fecha,
    cantidad: litros,
    litros_recibidos: record.tipo === 'salida_interna' ? litros : 0,
    precio_litro: precio,
    importe: litros * precio,
    proveedor: record.proveedor || '',
    unidad: 'LT',
    ieps: record.ieps || 'SIN IEPS',
    es_ajuste: false,
    estatus: 'pendiente',
    cancelado: false,
    tipo_movimiento: record.tipo,
    operador: record.operador || null,
    concepto: record.concepto || '',
    productor_legacy_id: record.productorId || null,
    bitacora_legacy_id: record.bitacoraLegacyId || null,
    registrado_por: registradoPor || 'desconocido',
    notas: record.notas || '',
  };
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/diesel`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) { const t = await res.text(); console.error('postDieselCarga error:', t); return null; }
    const rows = await res.json();
    return rows[0] ? { ...rows[0], legacy_id: legacyId } : null;
  } catch (e) {
    console.error('postDieselCarga exception:', e);
    return null;
  }
}

// ───── ÓRDENES DE TRABAJO (OrdenDia) ────────────────────────────
// Tabla ordenes_trabajo. Usa id (uuid generado por Supabase) como PK.
// Helpers extraídos de OrdenDia.jsx (guardar/completar/actualizar).

export async function postOrdenTrabajo(orden, operador, lote, maquina) {
  try {
    const body = {
      fecha: orden.fecha,
      tipo: orden.tipoTrabajo || orden.tipo,
      estatus: orden.estatus || 'pendiente',
      operador_nombre:   orden.operador_nombre ?? (operador?.nombre || ''),
      maquinaria_nombre: orden.maquinaria_nombre ?? (maquina?.nombre || ''),
      lote_nombre:       orden.lote_nombre ?? (lote?.apodo || lote?.nombre || ''),
      insumo_nombre:     orden.insumo_nombre ?? (orden.insumoNombre || ''),
      hora_inicio:       orden.hora_inicio ?? (orden.horaInicio || null),
      horas_estimadas:   parseFloat(orden.horas_estimadas ?? orden.horasEstimadas) || 0,
      notas:             orden.notas || '',
      creado_por:        orden.creado_por ?? (orden.creadoPor || ''),
    };
    // Campos opcionales: solo se incluyen si el caller los provee
    if (orden.id) body.id = orden.id;
    if (orden.legacy_id != null) body.legacy_id = orden.legacy_id;
    if (orden.ciclo_id) body.ciclo_id = orden.ciclo_id;
    if (orden.descripcion != null) body.descripcion = orden.descripcion;
    if (orden.operador_id) body.operador_id = orden.operador_id;
    if (orden.maquinaria_id) body.maquinaria_id = orden.maquinaria_id;
    if (orden.lote_id) body.lote_id = orden.lote_id;
    if (orden.urgente != null) body.urgente = !!orden.urgente;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/ordenes_trabajo`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error('[Supabase] orden POST failed:', res.status, errText);
      return null;
    }
    const rows = await res.json();
    const row = Array.isArray(rows) ? rows[0] : rows;
    return row?.id || null;
  } catch (e) { console.warn('[Supabase] orden save failed:', e.message); return null; }
}

export async function patchOrdenTrabajoCompletar(orden) {
  try {
    const wid = orden?.supabaseId || orden?.id;
    if (!wid) return false;
    await fetch(`${SUPABASE_URL}/rest/v1/ordenes_trabajo?id=eq.${encodeURIComponent(String(wid))}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        estatus: 'completado',
        hora_fin: new Date().toISOString().slice(0,19),
      }),
    });
    return true;
  } catch (e) { console.warn('[Supabase] orden update failed:', e.message); return false; }
}

export async function patchOrdenTrabajo(orden, operador, lote, maquina) {
  try {
    const wid = orden?.supabaseId || orden?.id;
    if (!wid) return false;
    await fetch(`${SUPABASE_URL}/rest/v1/ordenes_trabajo?id=eq.${encodeURIComponent(String(wid))}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        tipo: orden.tipoTrabajo,
        operador_nombre:   operador?.nombre || '',
        maquinaria_nombre: maquina?.nombre || '',
        lote_nombre:       lote?.apodo || lote?.nombre || '',
        insumo_nombre:     orden.insumoNombre || '',
        hora_inicio:       orden.horaInicio || null,
        horas_estimadas:   parseFloat(orden.horasEstimadas) || 0,
        notas:             orden.notas || '',
      }),
    });
    return true;
  } catch (e) { console.warn('[Supabase] orden patch failed:', e.message); return false; }
}

// ───── CAJA CHICA ───────────────────────────────────────────────
// Tablas: caja_chica_fondos, caja_chica_movimientos. Usan id (uuid)
// como PK. Helpers extraídos de CajaChica.jsx (guardar/aprobar/rechazar).

export async function postCajaChicaMovimiento(payload) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/caja_chica_movimientos`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(payload),
    });
    return true;
  } catch (e) { console.warn('[Supabase] caja_chica gasto fail:', e); return false; }
}

export async function patchCajaChicaMovimiento(id, fields) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/caja_chica_movimientos?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(fields),
    });
    return true;
  } catch (e) { console.warn('[Supabase] caja_chica mov patch fail:', e); return false; }
}

export async function postCajaChicaFondo(payload) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/caja_chica_fondos`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(payload),
    });
    return true;
  } catch (e) { console.warn('[Supabase] caja_chica fondo post fail:', e); return false; }
}

export async function patchCajaChicaFondo(id, fields) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/caja_chica_fondos?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(fields),
    });
    return true;
  } catch (e) { console.warn('[Supabase] caja_chica fondo patch fail:', e); return false; }
}

// ───── CULTIVOS CATÁLOGO ────────────────────────────────────────
// Tabla cultivos_catalogo. El id (uuid) se genera client-side con
// crypto.randomUUID() y se pasa en el body para que reducer y Supabase
// compartan identificador.

export async function postCultivoCatalogo(record) {
  try {
    const body = {
      nombre: record.nombre || '',
      variedades: record.variedades || [],
    };
    if (record.id) body.id = record.id;
    if (record.legacyId != null) body.legacy_id = record.legacyId;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/cultivos_catalogo`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) { const t = await res.text(); console.error('postCultivoCatalogo error:', t); return null; }
    const rows = await res.json();
    return rows[0] || null;
  } catch (e) { console.error('postCultivoCatalogo exception:', e); return null; }
}

export async function patchCultivoCatalogo(id, fields) {
  if (id == null) { console.error('patchCultivoCatalogo: id nulo'); return false; }
  try {
    const body = {};
    if (fields.nombre != null)     body.nombre = fields.nombre;
    if (fields.variedades != null) body.variedades = fields.variedades;
    body.updated_at = new Date().toISOString();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/cultivos_catalogo?id=eq.${encodeURIComponent(String(id))}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) { const t = await res.text(); console.error('patchCultivoCatalogo error:', t); return false; }
    return true;
  } catch (e) { console.error('patchCultivoCatalogo exception:', e); return false; }
}

export async function deleteCultivoCatalogo(id) {
  if (id == null) { console.error('deleteCultivoCatalogo: id nulo'); return false; }
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/cultivos_catalogo?id=eq.${encodeURIComponent(String(id))}`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (!res.ok) { const t = await res.text(); console.error('deleteCultivoCatalogo error:', t); return false; }
    return true;
  } catch (e) { console.error('deleteCultivoCatalogo exception:', e); return false; }
}

// ───── CONFIGURACION (key-value singleton) ──────────────────────
// Tabla configuracion: clave PK text + valor jsonb. Usada para
// alertaParams y creditoParams (Fase 3.2 — GENERAL-01).

export async function upsertConfiguracion(clave, valor) {
  if (!clave) { console.error('upsertConfiguracion: clave vacía'); return false; }
  try {
    const body = {
      clave,
      valor,
      updated_at: new Date().toISOString(),
    };
    // UPSERT por clave (PK). Prefer resolution=merge-duplicates merge con on_conflict=clave.
    const res = await fetch(`${SUPABASE_URL}/rest/v1/configuracion?on_conflict=clave`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) { const t = await res.text(); console.error('upsertConfiguracion error:', clave, t); return false; }
    return true;
  } catch (e) { console.error('upsertConfiguracion exception:', e); return false; }
}

// ───── PARAMS CULTIVO (mapa compuesto) ──────────────────────────
// Tabla params_cultivo: ciclo_id + cultivo_id + variedad + precio + rendimiento.
// Key shape en state: "cicloId|cultivoId|variedad" o "cicloId|global".
// Variedad null ↔ key "cicloId|global". Fase 3.3 — GENERAL-01.

export async function upsertParamsCultivo(key, data) {
  if (!key) { console.error('upsertParamsCultivo: key vacía'); return false; }
  try {
    // Parsear key: "cicloId|cultivoId|variedad" o "cicloId|global"
    const parts = String(key).split('|');
    const cicloId = parts[0] ? parseInt(parts[0], 10) || null : null;
    const cultivoId = (parts[1] && parts[1] !== 'global') ? parseInt(parts[1], 10) || null : null;
    const variedad = (parts[2] && parts[1] !== 'global') ? parts[2] : null;
    const body = {
      ciclo_id: cicloId,
      cultivo_id: cultivoId,
      variedad,
      precio: data.precio != null ? Number(data.precio) || 0 : 0,
      rendimiento: data.rendimiento != null ? Number(data.rendimiento) || 0 : 0,
      fecha_precio: data.fechaPrecio || null,
      updated_at: new Date().toISOString(),
    };
    // UPSERT por combinación ciclo_id + cultivo_id + variedad (constraint nombre puede variar — usar merge-duplicates)
    const res = await fetch(`${SUPABASE_URL}/rest/v1/params_cultivo?on_conflict=ciclo_id,cultivo_id,variedad`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) { const t = await res.text(); console.error('upsertParamsCultivo error:', key, t); return false; }
    return true;
  } catch (e) { console.error('upsertParamsCultivo exception:', e); return false; }
}

// ───── CRÉDITO LÍMITES (por productor) ──────────────────────────
// Tabla credito_limites: productor_id UNIQUE + limite_para/dir/total + notificar_cambio.
// Fase 3.4 — última clave de config temporal migrada a Supabase.

export async function upsertCreditoLimites(productorId, data) {
  if (productorId == null) { console.error('upsertCreditoLimites: productorId nulo'); return false; }
  try {
    const body = {
      productor_id: parseInt(productorId, 10) || productorId,
      limite_para: data.limitePara != null ? Number(data.limitePara) || 0 : 0,
      limite_dir: data.limiteDir != null ? Number(data.limiteDir) || 0 : 0,
      limite_total: data.limiteTotal != null ? Number(data.limiteTotal) || 0 : 0,
      notificar_cambio: data.notificarCambio ?? true,
      updated_at: new Date().toISOString(),
    };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/credito_limites?on_conflict=productor_id`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) { const t = await res.text(); console.error('upsertCreditoLimites error:', productorId, t); return false; }
    return true;
  } catch (e) { console.error('upsertCreditoLimites exception:', e); return false; }
}
