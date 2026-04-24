# AgroSistema Charay — HANDOFF

**Última actualización:** 23 Abril 2026 (noche)
**Branch activo:** dev
**Último commit dev:** 97edc63 (feat(dashboardcampo): crear órdenes de trabajo + WhatsApp desde dashboard encargado)
**Último commit main:** e53489c (merge: centralizar POST inline OrdenDia + CajaChica)
**Tag de respaldo:** backup-pre-merge-24abr2026-refactor
**Estado:** DashboardCampo Phase 2 implementado en dev. 2 bugs descubiertos en uso real.

## Estado al cierre

- DashboardCampo Phase 2: botón "🚜 Nueva orden" visible para encargado/admin, BottomSheet con form (operador, tractor, tipo, lotes multi-select, descripción, urgente), guardado Supabase-first + mensaje WhatsApp post-guardado.
- Post-guardado: si operador tiene teléfono, abre wa.me; si no, copia al portapapeles + Toast.
- 2 fixes ya aplicados: productor mostrado en chips de lotes, key único `${id}-${i}` en .map de órdenes del día.
- 2 bugs nuevos detectados en uso real (ver sección de pendientes).
- Main al día con refactor POST inline. DashboardCampo pendiente de merge.

## Bugs estructurales pendientes

- **Órdenes creadas desde DashboardCampo no aparecen en OrdenDia** — posible UTC vs local o campo faltante.
- **Chips de lotes aún duplicados** — varios lotes del mismo productor con mismo apodo.

## Tabla de pendientes actualizada

| # | Prioridad | Tarea | Tiempo | Categoría |
|---|-----------|-------|--------|-----------|
| 1 | Alta | Fix: órdenes creadas desde DashboardCampo no aparecen en OrdenDia (filtro de fecha UTC vs local, o campo faltante) | 30 min | Bug |
| 2 | Alta | Fix: chips lotes aún duplicados — agregar folio_corto al display ("CHEVETO 5 — CASTRO" en vez de "CHEVETO — CASTRO") | 15 min | Bug |
| 3 | Media | Merge DashboardCampo Phase 2 a main (después de validar en campo) | 15 min | Deploy |
| 4 | Media | Capturar teléfonos de 4 operadores sin WhatsApp (Javier, Jesús, Manuel, Ramón) | 10 min | Data |
| 5 | Baja | Actualizar supabase-js (warning httpSend) | 15 min | Infra |
| 6 | Baja | Limpiar GET inline OrdenDia (SUPA_URL2/SUPA_KEY2) | 15 min | Refactor |
| 7 | Futuro | Modo offline (IndexedDB + SW) | 8+ hrs | Feature |
| 8 | Futuro | Seguridad: quitar passwords de roles.js, JWT real | 2 hrs | Seguridad |

## Siguiente sesión — recomendación

**Fix #1 (Órdenes no visibles en OrdenDia)**: diagnóstico primero — comparar el shape del registro que DashboardCampo inserta vs lo que OrdenDia filtra. Probablemente es un mismatch de formato de fecha o un campo que OrdenDia espera (como `fecha` tipo string "YYYY-MM-DD") que DashboardCampo está pasando en otro formato.

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
