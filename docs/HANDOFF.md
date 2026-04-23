# AgroSistema Charay — HANDOFF

**Última actualización:** 22 Abril 2026 (noche)
**Branch activo:** dev
**Último commit código:** 637f1e0 (fix(diesel): DIESEL-ESPEJO-01 — cancelar diesel borra espejo en bitácora)
**Último commit main:** 0c2ac5f (merge: feat productor auto diesel + docs Fase 3)
**Tag de respaldo:** backup-pre-merge-22abr2026-fase3
**Estado:** DIESEL-ESPEJO-01 resuelto. Pendiente: verificar en dev URL → merge a main.

## Estado al cierre

- Sesión ~90 min. Objetivo: fix DIESEL-ESPEJO-01 — cancelar diesel no borra espejo en bitácora.
- ALTER TABLE diesel ADD COLUMN bitacora_legacy_id bigint aplicado via Supabase MCP.
- 5 edits en 3 archivos: Diesel.jsx (import, guardarMovimiento reorder, cancel handler), supabaseLoader.js (diesel map), App.jsx (realtime channel mapper).
- Causa raíz descubierta: el realtime channel de diesel en App.jsx re-mapeaba las filas con schema incompleto (sin bitacoraLegacyId), pisando el state que el loader había hidratado correctamente.
- Smoke test exitoso: crear carga → cancelar → espejo en bitacora_trabajos desaparece (hard delete). Verificado con SQL: COUNT=0.
- Babel parse OK en los 3 archivos.

## Cambios técnicos de esta sesión

1. **Supabase**: ALTER TABLE diesel ADD COLUMN bitacora_legacy_id bigint.
2. **Diesel.jsx L12**: import extendido con deleteBitacora.
3. **Diesel.jsx guardarMovimiento**: bloque bitácora movido ANTES del POST diesel. postBitacora primero → captura saved.id → bitacoraLegacyId incluido en nuevoReg y POST body.
4. **Diesel.jsx cancel handler**: if (d.bitacoraLegacyId) → deleteBitacora + DEL_BITACORA (patrón Supabase-first, sin try/catch muerto).
5. **supabaseLoader.js L156**: bitacoraLegacyId: r.bitacora_legacy_id || null en diesel map.
6. **App.jsx realtime diesel channel**: bitacoraLegacyId: r.bitacora_legacy_id || null en mapper (causa raíz del bug de smoke test).

## Bugs estructurales pendientes

### Bug DIESEL-ESPEJO-01: RESUELTO ✅
Cancelar diesel ahora borra el espejo en bitacora_trabajos via hard delete. Registros pre-fix (bitacora_legacy_id=NULL) son backward-compatible: cancel no intenta delete del espejo.

### Bug REALTIME-MAPPER-GAP: RESUELTO ✅
Schema realtime diesel channel alineado con loader. 4 propiedades añadidas + precioUnitario corregido. Commit a68ca4c.

### Bug MAQUINARIA-CONSUMOS-01: 409 Conflict al guardar consumos L/ha
Severidad: Baja. POST a maquinaria_consumos da 409 duplicate key. Necesita UPSERT en vez de INSERT. ~20 min.

## Tabla de pendientes actualizada

| # | Prioridad | Tarea | Tiempo | Categoría |
|---|-----------|-------|--------|-----------|
| 1 | Media | Verificar DIESEL-ESPEJO-01 en dev URL → merge a main | 15 min | Deploy |
| 2 | Media | GENERAL-01: migrar 5 claves residuales | 60 min c/u | Migración |
| 3 | Media | Refactor App.jsx — extraer routes | 45 min | Refactor |
| 4 | Baja | Actualizar supabase-js (warning httpSend) | 15 min | Infra |
| 5 | Baja | MAQUINARIA-CONSUMOS-01: 409 Conflict | 20 min | Bug |
| 6 | Baja | Alertas WhatsApp al socio | 2 hrs | Feature |
| 7 | Baja | Dashboard histórico entre ciclos | 3 hrs | Feature |
| 8 | Futuro | DashboardCampo Phase 1 — móvil encargado | 2 hrs | Feature |
| 9 | Futuro | Cosecha Fase 2: boletas → pago banco → cierre | 3 hrs | Cuando llegue cosecha |

## Siguiente sesión — recomendación

**Opción A: #1 — Verificar dev URL + merge a main (15 min).** Clear site data en agro-charay-dev.vercel.app, smoke test rápido, tag backup, merge.

**Opción B: #4 — REALTIME-MAPPER-GAP (30 min).** Completar el schema del realtime diesel channel para que sea simétrico con el loader. Previene bugs futuros similares al que encontramos hoy.

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
- **NUEVO: Para debugging, usar Claude Code directo (no Claude web paso a paso)**
- **NUEVO: Cualquier mapper de Supabase (loader, realtime, etc.) debe tener schema simétrico — verificar con diff cuando se añade columna nueva**
- **NUEVO: Verificar TODOS los paths de hidratación al añadir campo nuevo (loader + realtime channels + cualquier otro mapper)**
