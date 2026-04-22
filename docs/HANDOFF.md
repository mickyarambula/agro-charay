# AgroSistema Charay — HANDOFF

**Última actualización:** 22 Abril 2026 (mediodía)
**Branch activo:** dev
**Último commit código:** e0f1061 (fix(core): GENERAL-01 Fase 3 — migrar 10 claves vacías + cicloActual)
**Último commit main:** 3bb4a85 (merge: dev → main — GENERAL-01 Fase 3)
**Tag de respaldo:** backup-pre-merge-22abr2026-fase3
**Estado:** GENERAL-01 Fases 1, 2 y 3 completadas. 28 claves Grupo A hidratadas desde Supabase. localStorage reducido a 21 claves (Grupo B + C + 5 pendientes: asistencias, pagosSemana, tarifaStd, horasMaq, proyeccion). Capital DELETE fix en producción.

## Estado al cierre

- Sesión ~90 min. Objetivo: GENERAL-01 Fase 1 — fix del ciclo de vida del reducer.
- 5 pasos ejecutados en 4 archivos: DataContext.jsx, supabaseLoader.js, App.jsx (×3 ediciones).
- Todos los pasos con Babel parse OK.
- Smoke test manual: login → "Cargando datos…" → dashboard con datos reales → localStorage limpio (solo 32 claves, sin Grupo A) → módulos Bitácora, Diesel, Capital, Caja Chica verificados.
- DIESEL-01 resuelto como efecto colateral (datos vienen directo de Supabase, no requiere recargar).

## Cambios técnicos de esta sesión

1. **DataContext.jsx**: +5 claves extras en initState (liquidaciones, cajaChicaFondo, cajaChicaMovimientos, usuariosDB, maquinariaConsumos). +case HYDRATE_FROM_SUPABASE con whitelist de 17 claves Grupo A.
2. **supabaseLoader.js**: eliminado localStorage.setItem. Ahora retorna estadoNuevo. configPreservada conservada (se limpia en Fase 3).
3. **App.jsx IIFE savedState**: reducida de 48 a 32 claves (eliminadas 17 Grupo A + trabajos).
4. **App.jsx useEffect persist**: refactorizado a PERSIST_KEYS (32 claves simétricas con IIFE). Eliminados credito/gastos legacy.
5. **App.jsx useEffect post-load**: reemplazado SYNC_STATE parcial (10 claves, solo 2 efectivas) por HYDRATE_FROM_SUPABASE completo (17 claves).
6. **App.jsx handleLogin**: eliminado await loadStateFromSupabase() redundante. Conservado window.location.reload().
7. **App.jsx loading gate**: hydrating state + pantalla "Cargando datos…" entre login y render principal.

## Bugs estructurales pendientes

### Bug GENERAL-01: Doble capa de persistencia (Fase 1 COMPLETADA)
- Fase 1 ✅ — 17 claves Grupo A ya son Supabase-first. localStorage no las lee ni escribe.
- Fase 2 pendiente — decisiones Grupo C (permisos, proyeccion). 30 min.
- Fase 3 pendiente — migrar módulos restantes uno por uno (11 claves en PERSIST_KEYS marcadas "pendientes migrar").

### Bug DIESEL-01: RESUELTO
Consecuencia de GENERAL-01. Resuelto al completar Fase 1 — datos diesel vienen directo de Supabase.

## Tabla de pendientes actualizada

| # | Prioridad | Tarea | Tiempo | Categoría |
|---|-----------|-------|--------|-----------|
| 1 | Media | GENERAL-01: migrar 5 claves residuales (asistencias, pagosSemana, tarifaStd, horasMaq, proyeccion) | 60 min c/u | Migración |
| 2 | Media | Refactor App.jsx — extraer routes (archivo grande) | 45 min | Refactor |
| 3 | Media | Asignar productor auto desde lote al cargar tractor | 30 min | Feature Diesel |
| 4 | Media | Cleanup imports huérfanos en Diesel.jsx | 10 min | Housekeeping |
| 5 | Baja | Actualizar supabase-js (warning httpSend) | 15 min | Infra |
| 6 | Baja | Alertas WhatsApp al socio | 2 hrs | Feature |
| 7 | Baja | Dashboard histórico entre ciclos | 3 hrs | Feature |
| 8 | Futuro | DashboardCampo Phase 1 — móvil encargado | 2 hrs | Feature |
| 9 | Futuro | Cosecha Fase 2: boletas → pago banco → cierre | 3 hrs | Cuando llegue cosecha |

## Siguiente sesión — recomendación

**Opción A: #1 — GENERAL-01 Fase 2 (30 min, sin código).** Decidir qué claves del Grupo C van a Supabase y cuáles quedan locales. Resultado: entrada en DECISIONS.md.

**Opción B: verificar deploy en dev URL** (`agro-charay-dev.vercel.app`) y luego hacer `clear site data` + login para confirmar que la app funciona sin localStorage previo (test definitivo de Fase 1).

**Opción C: merge dev → main** si el smoke test en dev URL pasa. Crear tag backup-pre-merge-22abr2026 primero.

## Reglas de trabajo

- Sesiones cortas (30-50 min base, 60-90 min cuando dimensionado)
- Diagnóstico antes que fix
- Ver archivo completo antes de editar
- Un cambio a la vez, con prueba inmediata (excepto cambios estructuralmente dependientes)
- Probar en local → dev → nunca directo a main
- Verificar schema Supabase antes de POST/DELETE
- Verificar con Babel parse: node -e "require('@babel/parser').parse(require('fs').readFileSync('ARCHIVO','utf8'),{sourceType:'module',plugins:['jsx']}); console.log('PARSE OK')"
- Tag de respaldo antes de merge a main
- Commit y push al cierre
- docs/ NO raíz — git add docs/HANDOFF.md docs/PROGRESS.md
- HYDRATE_FROM_SUPABASE whitelist protege contra claves no-Grupo-A
- Las 5 claves extras (liquidaciones, cajaChica*, usuariosDB, maquinariaConsumos) se auto-gestionan con SET_* en sus módulos — no meterlas en HYDRATE
- configPreservada en supabaseLoader es peso muerto temporal — limpiar en Fase 3
- SYNC_STATE sigue existiendo para realtime (2 sites legítimos) — no tocar
