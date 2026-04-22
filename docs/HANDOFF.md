# AgroSistema Charay — HANDOFF

**Última actualización:** 21 Abril 2026 (sesión diagnóstico GENERAL-01)
**Branch activo:** dev
**Último commit código:** 3ee9b59 (fix(bitacora): cerrar DELETE a Supabase)
**Último commit main:** 92bfe7d (merge: dev → main — fix BITACORA-DELETE-01)
**Tag de respaldo:** backup-pre-merge-20abr2026
**Estado:** fix BITACORA-DELETE-01 ya en producción. Diagnóstico de GENERAL-01 completado — scope real mucho mayor al estimado. Plan de 3 fases documentado en `docs/GENERAL-01-PLAN.md`. Ningún código modificado esta sesión.

## Estado al cierre

- Sesión ~75 min. Objetivo original (fix GENERAL-01 en 60 min) reevaluado tras diagnóstico.
- Parte A cerrada: merge dev → main ejecutado con tag de respaldo. Smoke test en producción (`agro-charay.vercel.app`): crear + borrar registro bitácora end-to-end OK, consola limpia excepto warning conocido httpSend.
- Parte B cerrada como diagnóstico puro (no edits): reveló que 35 de 52 claves del reducer viven solo en localStorage. La "hidratación desde Supabase" de las otras 17 es indirecta — supabaseLoader escribe a localStorage, reducer lee de localStorage en el próximo mount, NO hay dispatches.
- Decisión tomada y documentada: migración por fases (plan en `docs/GENERAL-01-PLAN.md`), NO big-bang. Aprobado por Miguel.

## Bugs estructurales pendientes

### Bug GENERAL-01: Doble capa de persistencia (activo)
Severidad: Alta. Plan completo en `docs/GENERAL-01-PLAN.md`. Próximo paso: Fase 1 — fix del ciclo de vida de las 22 claves ya en Supabase (60-90 min). Objetivo de Fase 1: reemplazar init-desde-localStorage por init-desde-initState + dispatch desde supabaseLoader, y hacer el persist-a-localStorage selectivo (solo Grupo B). Resuelve DIESEL-01 como efecto.

### Bug DIESEL-01
Consecuencia de GENERAL-01. Se resuelve automáticamente al completar Fase 1.

## Tabla de pendientes actualizada

| # | Prioridad | Tarea | Tiempo | Categoría |
|---|-----------|-------|--------|-----------|
| 1 | Alta | GENERAL-01 Fase 1: fix del ciclo de vida (22 claves ya en Supabase) | 60-90 min | Bug estructural |
| 2 | Media | GENERAL-01 Fase 2: decisiones Grupo C (permisos + proyeccion) | 30 min | Arquitectura |
| 3 | Media | GENERAL-01 Fase 3: migrar `trabajos` a Supabase (investigar vs bitacora primero) | 60 min | Migración |
| 4 | Media | GENERAL-01 Fase 3: migrar `cosecha` a Supabase | 60 min | Migración |
| 5 | Media | Refactor App.jsx — extraer routes (archivo de 2156 líneas) | 45 min | Refactor |
| 6 | Media | Asignar productor auto desde lote al cargar tractor | 30 min | Feature Diesel |
| 7 | Media | Cleanup imports huérfanos en Diesel.jsx (SUPABASE_URL/SUPABASE_ANON_KEY) | 10 min | Housekeeping |
| 8 | Baja | Corregir ruta del parser Babel en WORKFLOW.md: `./node_modules/@babel/parser` | 2 min | Docs |
| 9 | Baja | Actualizar supabase-js (warning httpSend) | 15 min | Infra |
| 10 | Baja | Alertas WhatsApp al socio (resumen semanal) | 2 hrs | Feature |
| 11 | Baja | Dashboard histórico entre ciclos | 3 hrs | Feature |
| 12 | Futuro | GENERAL-01 Fase 3: solicitudesCompra, ordenesCompra, solicitudesGasto | 60 min c/u | Migración |
| 13 | Futuro | GENERAL-01 Fase 3: activos, personal, creditosRef, rentas | 60 min c/u | Migración |
| 14 | Futuro | DashboardCampo Phase 1 — móvil encargado | 2 hrs | Feature |
| 15 | Futuro | Cosecha Fase 2: boletas → pago banco → cierre | 3 hrs | Cuando llegue cosecha |
| 16 | Futuro | saveFoto: opción de ligar foto a lote/operador | 20 min | Mejora Bitácora |

## Siguiente sesión — recomendación

**Objetivo propuesto: #1 — GENERAL-01 Fase 1 (fix del ciclo de vida).**

Leer primero `docs/GENERAL-01-PLAN.md` Fase 1 completo. Preparación mental: este cambio toca App.jsx:1218 (useReducer init), App.jsx:1289 (useEffect persist), src/supabaseLoader.js (dispatches en lugar de localStorage.setItem), y DataContext.jsx (nueva action HYDRATE_FROM_SUPABASE). Presupuesto 60-90 min. Si al smoke-test aparece regresión en cualquier módulo Grupo A, PARAR y documentar. Arranque sugerido: diseñar la action HYDRATE_FROM_SUPABASE primero (payload shape), luego editar supabaseLoader, luego App.jsx. Smoke test por módulo al final, no entre edits (los edits son estructuralmente dependientes).

Alternativa corta si el tiempo es limitado ese día: ejecutar #8 (corregir ruta Babel en WORKFLOW.md) como warm-up de 2 min antes de Fase 1.

## Reglas de trabajo (confirmadas esta sesión)

- Sesiones cortas (30-50 min base, 60-90 min cuando el objetivo lo amerite y esté dimensionado)
- Diagnóstico antes que fix — SIEMPRE. Esta sesión el diagnóstico reveló que el scope era 2-3x más grande que la estimación del HANDOFF anterior.
- Ver archivo completo y EXPANDIDO antes de editar (Claude Code a veces trunca a línea 1 por hooks de prior-observations; si pasa, usar `cat` o `sed` como fallback)
- Un cambio a la vez, con prueba inmediata — excepto cuando los cambios son estructuralmente dependientes (Fase 1 es un ejemplo)
- Probar en local primero, luego dev, nunca directo a main
- Verificar schema Supabase antes de POST/DELETE (`information_schema.columns`)
- Verificar sintaxis con Babel parse después de editar (parser local: `./node_modules/@babel/parser`)
- Tag de respaldo antes de cada merge a main
- Commit y push al cierre, siempre
- `docs/` NO raíz — `git add docs/HANDOFF.md docs/PROGRESS.md`
- **Nueva (hoy):** el HANDOFF puede subestimar scope. Cuando un objetivo diga "60 min" pero el diagnóstico revele que toca estructura, PARAR y re-planear antes de editar. La regla de scope estricto aplica también cuando el sub-estimado viene de mi propio documento anterior.
- **Nueva (hoy):** "X módulos migrados" ≠ "fuente única es Supabase". La migración de INSERT/DELETE a helpers es necesaria pero NO suficiente si el reducer sigue inicializándose desde localStorage. Distinguir ambos niveles explícitamente.
- **Nueva (hoy):** Claude Code a veces trunca lecturas a 1 línea por hooks de prior-observations. Cuando pase, pedirle explícitamente usar `cat` o `sed` como fallback.
