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
