# AgroSistema Charay — HANDOFF

**Última actualización:** 24 Abril 2026 (tarde)
**Branch activo:** dev
**Último commit dev:** fa91e73 (refactor: centralizar POST inline OrdenDia + CajaChica → supabaseWriters.js)
**Último commit main:** e53489c10be9a3e085f8e5cf81c54ee16499d4a5
**Tag de respaldo:** backup-pre-merge-24abr2026-refactor
**Estado:** Main al día. Refactor POST inline completo. Cosecha migrada.

## Estado al cierre

- POST inline centralizados: OrdenDia (3 helpers) y CajaChica (4 helpers) extraídos a supabaseWriters.js.
- Cosecha migrada a Supabase (5 subtablas + cancelar/reactivar boleta) — mergeado a main.
- Todos los módulos con mutaciones a Supabase ahora usan helpers centralizados excepto: GET de recargarOrdenes en OrdenDia (deuda menor).
- Dev y main sincronizados.

## Bugs estructurales pendientes

Ninguno activo.

## Tabla de pendientes actualizada

| # | Prioridad | Tarea | Tiempo | Categoría |
|---|-----------|-------|--------|-----------|
| 1 | Alta | DashboardCampo Phase 2: crear órdenes + WhatsApp desde dashboard | 2 hrs | Feature |
| 2 | Baja | Actualizar supabase-js (warning httpSend) | 15 min | Infra |
| 3 | Baja | Limpiar GET inline OrdenDia (SUPA_URL2/SUPA_KEY2) | 15 min | Refactor |
| 4 | Futuro | Modo offline (IndexedDB + SW) | 8+ hrs | Feature |
| 5 | Futuro | Seguridad: quitar passwords de roles.js, JWT real | 2 hrs | Seguridad |

## Siguiente sesión — recomendación

**DashboardCampo Phase 2**: crear órdenes de trabajo y generar mensaje WhatsApp para tractoristas desde el dashboard del encargado. Abrir chat nuevo con contexto limpio.

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
