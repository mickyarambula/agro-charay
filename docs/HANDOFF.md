# AgroSistema Charay — HANDOFF

**Última actualización:** 23 Abril 2026 (mediodía)
**Branch activo:** dev
**Último commit dev:** 92accec (refactor(app): extraer renderPage → AppRouter.jsx + navegación → useAppNavigation.js (−90 líneas))
**Último commit main:** 7f9c4fb (merge: horasMaq + proyeccion migración Supabase — GENERAL-01 residuales completas)
**Tag de respaldo:** backup-pre-merge-23abr2026-session2
**Estado:** GENERAL-01 claves residuales completas. Refactor App.jsx en dev pendiente merge.

## Estado al cierre

- Merge a main: tarifaStd + asistencias + pagosSemana + horasMaq + proyeccion (7f9c4fb).
- GENERAL-01 claves residuales completadas: las 5 (tarifaStd, asistencias, pagosSemana, horasMaq, proyeccion) migradas a Supabase.
- horasMaq: 3 espejos muertos en Bitacora.jsx eliminados (dispatches ADD_HORAS fuente:"bitacora" que se ignoraban en el render).
- proyeccion: fix reducer ADD_PROY id override (patrón GENERAL-02).
- Refactor App.jsx: renderPage extraído a AppRouter.jsx, navegación extraída a useAppNavigation.js. App.jsx −90 líneas.
- PERSIST_KEYS reducida a solo: Grupo B (UI/prefs) + Grupo C (permisos/config) + cosecha.

## Cambios técnicos de esta sesión

1. **Merge a main**: tarifaStd + asistencias + pagosSemana → 7f9c4fb (session1).
2. **horasMaq migrada**: tabla horas_maq, helpers postHorasMaq/deleteHorasMaq, 3 espejos muertos eliminados de Bitacora.jsx.
3. **proyeccion migrada**: tabla proyeccion (legacy_id text, real_monto por palabra reservada), helpers postProyeccion (UPSERT)/deleteProyeccion, fix reducer ADD_PROY.
4. **Merge a main**: horasMaq + proyeccion → main (session2).
5. **Refactor App.jsx**: 2 archivos nuevos (useAppNavigation.js 42 líneas, AppRouter.jsx 64 líneas), −90 líneas netas de App.jsx (2097→2007). WidgetCBOTDashboard pasado como prop para evitar import circular.

## Bugs estructurales pendientes

Ninguno conocido activo.

## Tabla de pendientes actualizada

| # | Prioridad | Tarea | Tiempo | Categoría |
|---|-----------|-------|--------|-----------|
| 1 | Media | Verificar refactor App.jsx en dev URL → merge a main | 15 min | Deploy |
| 2 | Baja | Actualizar supabase-js (warning httpSend) | 15 min | Infra |
| 3 | Baja | Alertas WhatsApp al socio | 2 hrs | Feature |
| 4 | Baja | Dashboard histórico entre ciclos | 3 hrs | Feature |
| 5 | Futuro | DashboardCampo Phase 1 — móvil encargado | 2 hrs | Feature |
| 6 | Futuro | Cosecha Fase 2: boletas → pago banco → cierre | 3 hrs | Cuando llegue cosecha |
| 7 | Futuro | Migrar cosecha a Supabase (última clave en localStorage) | 45 min | Migración |

## Siguiente sesión — recomendación

**Opción A: #1 — Verificar dev URL + merge a main (15 min).** Smoke test navegación en agro-charay-dev.vercel.app, tag backup, merge.

**Opción B: Feature work.** Con GENERAL-01 y el refactor cerrados, el sistema está estable. Buen momento para DashboardCampo Phase 1 o alertas WhatsApp.

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
- Verificar TODOS los paths de hidratación al añadir campo nuevo
- Al añadir una clave al loader, verificar que también esté en GRUPO_A whitelist
- Tablas nuevas en Supabase necesitan RLS policy para rol `anon`
- Generar id en el caller ANTES del dispatch cuando se necesita legacy_id para Supabase
- **NUEVO: Al refactorear, pasar componentes declarados en App.jsx como props (no importar desde App.jsx — causa circular)**
