# AgroSistema Charay — HANDOFF

**Última actualización:** 24 Abril 2026 (mañana)
**Branch activo:** dev
**Último commit dev:** e753dabd100bbbaf3cce72a5fbbb0e769b93e532
**Último commit main:** 87a38fad900be7da7c13db8ff601b30379f9391b
**Tag de respaldo:** backup-pre-merge-24abr2026
**Estado:** Main al día. Todos los cambios de dev mergeados.

## Estado al cierre

- Main actualizado con: responsive Bitácora, fix acceso socio (egresos→gastos), Toast global en 7 módulos.
- DashboardCampo Phase 1, postDieselCarga, GENERAL-01 ya estaban en main desde sesión anterior.
- Dev y main están sincronizados.

## Bugs estructurales pendientes

Ninguno activo. BITACORA-DELETE-01 resuelto (commit 3ee9b59).

## Tabla de pendientes actualizada

| # | Prioridad | Tarea | Tiempo | Categoría |
|---|-----------|-------|--------|-----------|
| 1 | Media | Centralizar POST inline restantes (OrdenDia, CajaChica) | 2 hrs | Refactor |
| 2 | Media | Migrar cosecha a Supabase | 45 min | Migración |
| 3 | Baja | Actualizar supabase-js (warning httpSend) | 15 min | Infra |
| 4 | Futuro | DashboardCampo Phase 2: crear órdenes + WhatsApp desde dashboard | 2 hrs | Feature |
| 5 | Futuro | Modo offline (IndexedDB + SW) | 8+ hrs | Feature |
| 6 | Futuro | Seguridad: quitar passwords de roles.js, JWT real | 2 hrs | Seguridad |

## Siguiente sesión — recomendación

Opción A: #1 — Centralizar POST inline (OrdenDia, CajaChica). Limpieza técnica, reduce deuda.
Opción B: #2 — Migrar cosecha a Supabase. Preparación para cosecha real del ciclo.
Opción C: #4 — DashboardCampo Phase 2. Feature de alto impacto operativo.

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
- Para prompts a Claude Code, dar el objetivo completo y dejar que lea el código y diseñe la solución — no pedir diagnósticos parciales
