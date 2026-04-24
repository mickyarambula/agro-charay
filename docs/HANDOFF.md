# AgroSistema Charay — HANDOFF

**Última actualización:** 24 Abril 2026 (mañana)
**Branch activo:** dev
**Último commit dev:** fix(dashboardcampo): fecha local en vez de UTC + folioCorto en chips de lotes
**Último commit main:** e53489c (merge: centralizar POST inline OrdenDia + CajaChica)
**Tag de respaldo:** backup-pre-merge-24abr2026-refactor
**Estado:** DashboardCampo Phase 2 estable con 2 fixes aplicados. Pendiente validación en campo.

## Estado al cierre

- Fix timezone: DashboardCampo ahora usa fecha local (getFullYear/getMonth/getDate) en vez de UTC (toISOString). Esto corrige que órdenes creadas después de las 18:00 MST aparecían con fecha del día siguiente y no se mostraban en OrdenDia.
- Fix chips lotes: el multi-select y las órdenes guardadas ahora muestran "{apodo} {folioCorto} — {productor}" (ej: "CHEVETO 5 — CASTRO") para desambiguar lotes con mismo apodo.
- El fix de fecha también beneficia guardarTrabajo y guardarDiesel en DashboardCampo, que usaban la misma variable `hoy`.
- Solo se modificó DashboardCampo.jsx. OrdenDia.jsx no requirió cambios.

## Bugs estructurales pendientes

- Ninguno nuevo. Los 2 bugs de la sesión anterior (#1 y #2) fueron resueltos.

## Tabla de pendientes actualizada

| # | Prioridad | Tarea | Tiempo | Categoría |
|---|-----------|-------|--------|-----------|
| 1 | Alta | Validar en campo: crear orden desde DashboardCampo y verificar que aparece en OrdenDia | 10 min | Validación |
| 2 | Media | Merge DashboardCampo Phase 2 a main (después de validar en campo) | 15 min | Deploy |
| 3 | Media | Capturar teléfonos de 4 operadores sin WhatsApp (Javier, Jesús, Manuel, Ramón) | 10 min | Data |
| 4 | Baja | Actualizar supabase-js (warning httpSend) | 15 min | Infra |
| 5 | Baja | Limpiar GET inline OrdenDia (SUPA_URL2/SUPA_KEY2) | 15 min | Refactor |
| 6 | Futuro | GENERAL-01 Fase 1: fix ciclo de vida localStorage → Supabase fuente única | 2-3 sesiones | Arquitectura |
| 7 | Futuro | Modo offline (IndexedDB + SW) | 8+ hrs | Feature |
| 8 | Futuro | Seguridad: quitar passwords de roles.js, JWT real | 2 hrs | Seguridad |

## Siguiente sesión — recomendación

**Validación en campo**: crear una orden real desde DashboardCampo en el celular del encargado, verificar que aparece en OrdenDia tanto en el celular como en desktop admin. Si pasa, merge a main. Si no, diagnosticar con DevTools del celular.

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
- Tablas nuevas en Supabase necesitan RLS policy para rol anon
- Generar id en el caller ANTES del dispatch cuando se necesita legacy_id
- Al refactorear, pasar componentes declarados en App.jsx como props (no importar — causa circular)
- Para prompts a Claude Code, dar el objetivo completo y dejar que lea el código y diseñe la solución
- Schema mismatch state↔Supabase se resuelve con JSON en columna `notas` para round-trip sin pérdida
- **NUEVO: Nunca usar toISOString() para fechas locales en México — usar getFullYear/getMonth/getDate para evitar desfase UTC después de las 18:00 MST**
