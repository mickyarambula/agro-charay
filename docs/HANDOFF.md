# AgroSistema Charay — HANDOFF

**Última actualización:** 24 Abril 2026 (mediodía)
**Branch activo:** dev
**Último commit dev:** 3c8ab69aadc365ffcffd062a9c04bab9b3772bb2
**Último commit main:** 87a38fa (merge: responsive Bitácora + fix acceso socio + Toast global + docs)
**Tag de respaldo:** backup-pre-merge-24abr2026
**Estado:** Cosecha migrada a Supabase. Main pendiente de merge.

## Estado al cierre

- Cosecha migrada: 5 subtablas (boletas, cuadrillas, fletes, maquila, secado) leen y escriben desde Supabase.
- cancelar/reactivar boleta sincroniza campo `cancelado` vía PATCH a Supabase.
- Schema mismatch resuelto con JSON round-trip en columna `notas` (extras del state que no tienen columna dedicada).
- Whitelist GRUPO_A incluye `cosecha`.
- Main al día con merge anterior (87a38fa). Dev tiene cosecha pendiente de merge.

## Bugs estructurales pendientes

Ninguno activo.

## Tabla de pendientes actualizada

| # | Prioridad | Tarea | Tiempo | Categoría |
|---|-----------|-------|--------|-----------|
| 1 | Alta | Verificar dev + merge cosecha a main | 20 min | Deploy |
| 2 | Media | Centralizar POST inline restantes (OrdenDia, CajaChica) | 2 hrs | Refactor |
| 3 | Baja | Actualizar supabase-js (warning httpSend) | 15 min | Infra |
| 4 | Futuro | DashboardCampo Phase 2: crear órdenes + WhatsApp desde dashboard | 2 hrs | Feature |
| 5 | Futuro | Modo offline (IndexedDB + SW) | 8+ hrs | Feature |
| 6 | Futuro | Seguridad: quitar passwords de roles.js, JWT real | 2 hrs | Seguridad |

## Siguiente sesión — recomendación

**Opción A: #1 — Verificar dev + merge cosecha a main (20 min).** Smoke test en dev, tag, merge.
**Opción B: #2 — Centralizar POST inline (OrdenDia, CajaChica).** Limpieza técnica.
**Opción C: #4 — DashboardCampo Phase 2.** Feature de alto impacto operativo.

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
- Schema mismatch state↔Supabase se resuelve con JSON en columna `notas` para round-trip sin pérdida
