# AgroSistema Charay — HANDOFF

**Última actualización:** 20 Abril 2026 (noche tardía — migración 5 sitios externos a postBitacora)
**Branch activo:** dev
**Último commit código:** 9b615c4 (refactor(bitacora): migrar 5 sitios externos a postBitacora helper)
**Estado:** módulo Bitácora 100% migrado a Supabase en escritura. Los 5 sitios externos (Diesel, VistaOperador, OrdenDia, DashboardCampo×2) que hacían `dispatch(ADD_BITACORA)` en crudo ahora pasan por el helper `postBitacora`. Pendiente real: fix BITACORA-DELETE-01 y Bug GENERAL-01 estructural.

## Estado al cierre

- Sesión ~1h. Un objetivo cumplido con scope B estricto: 5 sitios migrados + smoke test verificado contra Supabase.
- Los 5 sitios (Diesel.jsx:194, VistaOperador.jsx:39, OrdenDia.jsx:432, DashboardCampo.jsx:102 y :122) ahora hacen `await postBitacora(payload, state.cicloActivoId, { silent: true })` antes del dispatch local.
- Patrón aplicado: offline-first — dispatch local siempre, aunque Supabase falle. `id: saved?.id || Date.now()`. `silent: true` porque son flujos automáticos (espejo diesel, finalizar orden, modales rápidos), no captura manual.
- Gap resuelto: VistaOperador no pasaba `loteIds`; ahora sí, derivado de `orden.loteId`.
- Firmas de 3 funciones convertidas a `async`: `finalizarTrabajo`, `marcarCompletada`, `guardarTrabajo`, `guardarDiesel`. `guardarMovimiento` (Diesel) ya era async.
- Smoke test verificado: carga de diesel real desde UI (Diesel y Combustible → Registrar carga de tractor → 50L) creó fila en `bitacora_trabajos` con `tipo='diesel'`, `fuente='bitacora'`, `ciclo_id='1'`. Cleanup al cierre: tabla en 0 filas.
- Build OK, parse Babel OK en los 4 archivos, deploy dev verificado (HTTP 200).

## Cómo quedó la hidratación de bitácora tras esta sesión

| Capa | Estado |
|------|--------|
| Lectura al login | ✅ Supabase |
| Escritura — 6 handlers en Bitacora.jsx | ✅ Supabase vía helper |
| Escritura — bulk import Excel en Bitacora.jsx | ✅ Supabase vía helper |
| Escritura — Diesel.jsx (espejo bitácora) | ✅ Supabase vía helper (nuevo) |
| Escritura — VistaOperador.jsx (finalizarTrabajo) | ✅ Supabase vía helper (nuevo) |
| Escritura — OrdenDia.jsx (marcarCompletada) | ✅ Supabase vía helper (nuevo) |
| Escritura — DashboardCampo.jsx (guardarTrabajo, guardarDiesel) | ✅ Supabase vía helper (nuevo) |
| DELETE desde UI | ❌ BITACORA-DELETE-01 pendiente |

Módulo bitácora 100% migrado en escritura. Único pendiente de bitácora: el fix DELETE.

## Bugs estructurales pendientes

### Bug GENERAL-01: Doble capa de persistencia (parcialmente mitigado)
Severidad: Alta. `App.jsx` inicializa el reducer desde `localStorage.agroSistemaState`, y `supabaseLoader` escribe encima. Para bitácora ya no hay conflicto (única fuente = Supabase), pero para otros módulos el patrón sigue. Fix completo: dejar de inicializar reducer desde localStorage, usar solo Supabase. 60 min estimados.

### Bug BITACORA-DELETE-01
Severidad: Alta. El botón 🗑 en UI de Bitácora borra del reducer local pero NO envía DELETE a Supabase. Workaround actual: borrar por SQL desde Supabase. Fix: añadir `deleteBitacora(id)` en `src/core/supabaseWriters.js` + llamarlo desde los handlers de UI antes del dispatch `DELETE_BITACORA`. 20 min.

### Bug DIESEL-01
Manifestación de GENERAL-01 en Diesel. Pendiente hasta fix de GENERAL-01.

## Tabla de pendientes actualizada

| # | Prioridad | Tarea | Tiempo | Categoría |
|---|-----------|-------|--------|-----------|
| 1 | Alta | Fix BITACORA-DELETE-01 — añadir `deleteBitacora` al helper y llamarlo desde handlers de UI | 20 min | Bug |
| 2 | Alta | Fix GENERAL-01 (doble persistencia de raíz) | 60 min | Bug estructural crítico |
| 3 | Media | Fix DIESEL-01 (consecuencia de #2) | 15 min tras #2 | Bug |
| 4 | Media | Merge dev → main cuando #1 y #2 estén terminados | 10 min | Deploy |
| 5 | Media | Refactor App.jsx — extraer routes | 45 min | Refactor |
| 6 | Media | Asignar productor auto desde lote al cargar tractor | 30 min | Feature Diesel |
| 7 | Media | Cleanup imports huérfanos en Diesel.jsx (SUPABASE_URL/SUPABASE_ANON_KEY — verificar si siguen usándose tras los últimos refactors) | 10 min | Housekeeping |
| 8 | Baja | Actualizar supabase-js (warning httpSend) | 15 min | Infra |
| 9 | Baja | Alertas WhatsApp al socio (resumen semanal) | 2 hrs | Feature |
| 10 | Baja | Dashboard histórico entre ciclos | 3 hrs | Feature |
| 11 | Futuro | DashboardCampo Phase 1 — móvil encargado | 2 hrs | Feature |
| 12 | Futuro | Cosecha Fase 2: boletas → pago banco → cierre | 3 hrs | Cuando llegue cosecha |
| 13 | Futuro | saveFoto: opción de ligar foto a lote/operador | 20 min | Mejora Bitácora |

## Siguiente sesión — recomendación

**Objetivo propuesto: #1 — fix BITACORA-DELETE-01.**

Scope acotado (~20 min): añadir `deleteBitacora(id)` en `src/core/supabaseWriters.js` siguiendo el mismo patrón que `postBitacora` (fetch a Supabase REST, log de errores, return boolean/null). Luego buscar los handlers que hacen `dispatch({type:"DELETE_BITACORA", ...})` y anteponer `await deleteBitacora(id)`. Cerrar ambas direcciones de escritura de bitácora en una sola sesión coherente.

Si sobra tiempo (5-10 min extras): verificar si los imports SUPABASE_URL / SUPABASE_ANON_KEY en Diesel.jsx siguen vivos tras la migración al helper, o quedaron huérfanos (pendiente #7 de la tabla).

Preparación: leer los handlers de UI que disparan DELETE_BITACORA (probablemente en Bitacora.jsx — botón 🗑) y confirmar que el `id` que reciben sea el mismo `legacy_id` que se usó en el POST.

## Reglas de trabajo (reforzadas esta sesión)

- Sesiones cortas (30-50 min), un objetivo claro
- Diagnóstico antes que fix
- Ver archivo completo y EXPANDIDO antes de editar
- Un cambio a la vez, con prueba inmediata
- Probar en local primero, luego dev, nunca directo a main
- `clear site data` en local antes de diagnosticar falsos bugs causados por localStorage residual
- Verificar schema Supabase antes de POST (`information_schema.columns`)
- Verificar sintaxis con Babel parse después de editar
- Commit y push al cierre, siempre
- Nunca importar desde App.jsx en módulos
- Datos reales = tolerancia cero al cambio sin respaldo previo y sin prueba explícita
- `SELECT COUNT(*)` después de un DELETE. "Success, no rows returned" no garantiza que borró filas.
- Cuidado con listeners de Supabase: handler con `signOut()` nunca dentro de `onAuthStateChange(SIGNED_OUT)`
- **Nueva (hoy):** cuando se migre un dispatch de reducer local a un helper de Supabase con firma async, verificar si la función contenedora es async. Si no lo es, convertirla antes del edit — olvidar esto causa `await postBitacora(...)` en función no-async y Babel parse lo marca.
- **Nueva (hoy):** cuando un payload de bitácora tenga `loteId` pero no `loteIds`, el helper enviará `lote_ids: []` por default. Si la UI filtra bitácora por `lote_ids`, el registro aparecerá "sin lote" tras migrar. Fix preventivo: añadir `loteIds: payload.loteId ? [payload.loteId] : []` al migrar.
- **Nueva (hoy):** en flujos automáticos o modales rápidos (espejo bitácora, finalizar orden, quick-actions), preferir `silent: true` en el helper — el alert() default del helper bloquea la UX silenciosa esperada. En captura manual por el usuario, dejar default (`silent: false`).
- **Nueva (hoy):** los extras que no procesa el helper (origen, ordenId, foto, cantidad, unidad) van solo en el dispatch local, NO en el payload del helper. Patrón: construir `bitacoraPayload` con los 10 campos del contrato, pasarlo al helper, y hacer `dispatch({...bitacoraPayload, ...extras, id: saved?.id || Date.now()})`.
