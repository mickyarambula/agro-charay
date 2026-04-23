# AgroSistema Charay — HANDOFF

**Última actualización:** 22 Abril 2026 (noche, sesión 2)
**Branch activo:** dev
**Último commit dev:** 7cac871 (fix(maquinaria): MAQUINARIA-CONSUMOS-01 — UPSERT on_conflict + display hydration + save feedback)
**Último commit main:** 46b1fcf (merge: DIESEL-ESPEJO-01 + REALTIME-MAPPER-GAP fixes)
**Tag de respaldo:** backup-pre-merge-22abr2026-session2
**Estado:** MAQUINARIA-CONSUMOS-01 resuelto. Main al día con DIESEL-ESPEJO-01 + REALTIME-MAPPER-GAP.

## Estado al cierre

- Merge a main exitoso: DIESEL-ESPEJO-01 + REALTIME-MAPPER-GAP (tag backup-pre-merge-22abr2026-session2).
- MAQUINARIA-CONSUMOS-01 resuelto: 409 Conflict eliminado, valores persisten tras recarga, feedback visual al guardar.
- Causa raíz del display bug: `maquinariaConsumos` faltaba en whitelist GRUPO_A de HYDRATE_FROM_SUPABASE — datos de Supabase se descartaban silenciosamente.
- Fix: 3 cambios en 2 archivos (DataContext.jsx whitelist + Maquinaria.jsx URL on_conflict + feedback botón).

## Cambios técnicos de esta sesión

1. **Merge a main**: DIESEL-ESPEJO-01 + REALTIME-MAPPER-GAP → main 46b1fcf.
2. **Maquinaria.jsx**: URL del POST cambiada a `?on_conflict=maquinaria_id,tipo_labor` para UPSERT por constraint compuesta.
3. **Maquinaria.jsx**: `id` removido del body del POST — PK auto-generado por Supabase (`gen_random_uuid()`).
4. **Maquinaria.jsx**: Feedback visual en botón ✓ — estado 'ok' (✅ verde 2s), 'error' (❌ rojo 2s), null (✓ default).
5. **DataContext.jsx**: `'maquinariaConsumos'` añadido a GRUPO_A whitelist de HYDRATE_FROM_SUPABASE.

## Bugs estructurales pendientes

Ninguno conocido activo.

## Tabla de pendientes actualizada

| # | Prioridad | Tarea | Tiempo | Categoría |
|---|-----------|-------|--------|-----------|
| 1 | Media | Verificar MAQUINARIA-CONSUMOS-01 en dev URL → merge a main | 15 min | Deploy |
| 2 | Media | GENERAL-01 Fase 1: migrar ciclo de vida 22 claves | 60-90 min | Migración |
| 3 | Media | Refactor App.jsx — extraer routes | 45 min | Refactor |
| 4 | Baja | Actualizar supabase-js (warning httpSend) | 15 min | Infra |
| 5 | Baja | Alertas WhatsApp al socio | 2 hrs | Feature |
| 6 | Baja | Dashboard histórico entre ciclos | 3 hrs | Feature |
| 7 | Futuro | DashboardCampo Phase 1 — móvil encargado | 2 hrs | Feature |
| 8 | Futuro | Cosecha Fase 2: boletas → pago banco → cierre | 3 hrs | Cuando llegue cosecha |

## Siguiente sesión — recomendación

**Opción A: #1 — Verificar dev URL + merge a main (15 min).** Clear site data en agro-charay-dev.vercel.app, smoke test consumos maquinaria, tag backup, merge.

**Opción B: #2 — GENERAL-01 Fase 1 (60-90 min).** Migrar ciclo de vida de las 22 claves ya en Supabase. Sesión larga pero alto impacto.

## Reglas de trabajo

- Sesiones cortas (30-50 min base, 60-90 min cuando dimensionado)
- Diagnóstico antes que fix
- Ver archivo completo antes de editar
- Un cambio a la vez, con prueba inmediata
- Probar en local → dev → nunca directo a main
- Verificar schema Supabase antes de POST/DELETE
- Verificar con Babel parse después de edits
- Tag de respaldo antes de merge a main
- Commit y push al cierre
- docs/ NO raíz — git add docs/HANDOFF.md docs/PROGRESS.md
- HYDRATE_FROM_SUPABASE whitelist protege contra claves no-Grupo-A
- Para debugging, usar Claude Code directo (no Claude web paso a paso)
- Cualquier mapper de Supabase (loader, realtime, etc.) debe tener schema simétrico
- Verificar TODOS los paths de hidratación al añadir campo nuevo (loader + realtime channels + cualquier otro mapper)
- **NUEVO: Al añadir una clave al loader, verificar que también esté en GRUPO_A whitelist — sin esto los datos se descartan silenciosamente**
