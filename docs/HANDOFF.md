# AgroSistema Charay — HANDOFF

**Última actualización:** 24 Abril 2026 (mañana)
**Branch activo:** dev
**Último commit dev:** refactor(ordendia): eliminar GET inline Supabase, leer de state global + Realtime
**Último commit main:** 394cea3 (merge: DashboardCampo Phase 2 — órdenes de trabajo + WhatsApp + fix timezone + folioCorto)
**Tag de respaldo:** backup-pre-merge-24abr2026-dashcampo
**Estado:** Sesión productiva — 2 bug fixes, merge a main, GENERAL-01 Fase 1 cerrada, refactor OrdenDia.

## Estado al cierre

- DashboardCampo Phase 2 mergeado a main y validado en producción.
- Fix timezone (fecha local vs UTC) aplicado en DashboardCampo — órdenes ya aparecen en OrdenDia.
- Fix chips lotes con folioCorto para desambiguar lotes con mismo apodo.
- GENERAL-01 Fase 1 marcada como completada — las 5 tareas ya estaban implementadas incrementalmente.
- cosecha removida de PERSIST_KEYS (ya está en Grupo A, hidrata vía Supabase).
- OrdenDia refactorizado: eliminado GET inline con SUPA_URL2/SUPA_KEY2 hardcodeados, ahora lee de state global + Realtime. -50 líneas.

## Bugs estructurales pendientes

- Ninguno conocido.

## Tabla de pendientes actualizada

| # | Prioridad | Tarea | Tiempo | Categoría |
|---|-----------|-------|--------|-----------|
| 1 | Media | Capturar teléfonos de 4 operadores sin WhatsApp (Javier, Jesús, Manuel, Ramón) | 10 min | Data |
| 2 | Baja | Actualizar supabase-js (warning httpSend) | 15 min | Infra |
| 3 | Futuro | GENERAL-01 Fase 3: migrar config temporal a Supabase (5 claves, orden: cultivosCatalogo → alertaParams+creditoParams → paramsCultivo → creditoLimites) | 4-5 sesiones | Arquitectura |
| 4 | Futuro | Modo offline (IndexedDB + SW) | 8+ hrs | Feature |
| 5 | Futuro | Seguridad: quitar passwords de roles.js, JWT real | 2 hrs | Seguridad |

## Siguiente sesión — recomendación

**GENERAL-01 Fase 2** (decisiones Grupo C): sesión sin código. Revisar las 5 claves de config temporal que siguen en PERSIST_KEYS (alertaParams, creditoLimites, creditoParams, paramsCultivo, cultivosCatalogo) y decidir si son datos de negocio (→ Supabase) o config local legítima (→ se quedan). Resultado: entrada en DECISIONS.md.

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
- Nunca usar toISOString() para fechas locales en México — usar getFullYear/getMonth/getDate para evitar desfase UTC después de las 18:00 MST
