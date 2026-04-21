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
