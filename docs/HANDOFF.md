# AgroSistema Charay — HANDOFF

**Última actualización:** 24 Abril 2026 (noche, sesión 4)
**Branch activo:** dev
**Último commit dev:** 09828d6 (fix(diesel): resolver loteId a uuid antes de POST — match con schema Supabase)
**Último commit main:** 3f9f148 (merge: limpieza dead code + supabase-js 2.104.1 + docs sesión 3)
**Tag de respaldo:** backup-pre-merge-24abr2026-general01
**Estado:** Feature auto-fill diesel en dev con bug pendiente. GENERAL-01 + fix diesel + limpieza en producción.

## Estado al cierre

- GENERAL-01 + fix diesel + limpieza dead code + supabase-js 2.104.1 en producción (main).
- Feature auto-fill tractor→lote implementado en dev pero NO funciona post-reload.
- Bug: el auto-fill compara loteId del state (legacy_id numérico) con loteId guardado en Supabase (uuid). Post-reload, los registros diesel hidratan loteId como uuid pero optLotes usa l.id (legacy_id) → no hay match.
- Fix pendiente: en Diesel.jsx onChange del tractor, la comparación debe considerar ambos formatos, o normalizar en el loader.
- Columna maquinaria_id agregada a tabla diesel en Supabase. Writer y loader wired.
- Columna lote_id ya existía en tabla diesel. Writer ahora envía uuid resuelto. Loader mapea loteId.
- Consumos provisionales para 5 tractores (28 filas insertadas).
- Carga de prueba de 70L (T-2, CHAYO GARCIA) en Supabase — limpiar después del fix.

## Bugs estructurales pendientes

- **DIESEL-AUTOFILL-01**: Auto-fill lote al seleccionar tractor no funciona post-reload. Mismatch legacy_id vs uuid en comparación. Ver descripción arriba.

## Tabla de pendientes actualizada

| # | Prioridad | Tarea | Tiempo | Categoría |
|---|-----------|-------|--------|-----------|
| 1 | Alta | Fix DIESEL-AUTOFILL-01 — normalizar comparación loteId uuid vs legacy_id | 20 min | Bug |
| 2 | Alta | Merge feature diesel auto-fill a main (después de fix) | 10 min | Deploy |
| 3 | Media | Encargado: ajustar consumos L/ha reales para T-2, T-4, T-6, Aspersora T-8 | 20 min | Data |
| 4 | Media | Capturar teléfonos de 4 operadores sin WhatsApp | 10 min | Data |
| 5 | Media | Limpiar cargas de prueba diesel (95L y 70L) | 5 min | Data |
| 6 | Futuro | Permisos/roles Grupo C restante → Supabase | 2 hrs | Arquitectura |
| 7 | Futuro | Panel Daniela: exportación a formatos contables | 2 hrs | Feature |
| 8 | Futuro | Modo offline (IndexedDB + SW) | 8+ hrs | Feature |
| 9 | Futuro | Seguridad: quitar passwords de roles.js, JWT real | 2 hrs | Seguridad |

## Siguiente sesión — recomendación

Fix DIESEL-AUTOFILL-01: en Diesel.jsx, el filter del onChange del tractor compara String(d.loteId) con los lotes de optLotes usando String(l.id). Post-reload, d.loteId es uuid (viene del loader) pero l.id es legacy_id. Solución: comparar también contra l._uuid. Después smoke test, merge a main, limpiar cargas de prueba.

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
- Schema mismatch state↔Supabase se resuelve con JSON en columna notas para round-trip sin pérdida
- Nunca usar toISOString() para fechas locales en México — usar getFullYear/getMonth/getDate para evitar desfase UTC después de las 18:00 MST
- onBlur para upserts en inputs numéricos — dispatch onChange para UI, upsert onBlur para no spamear Supabase
- Tablas con upsert necesitan UNIQUE constraint — verificar antes de crear el helper
- Diagnosticar antes de asumir bug de código — verificar datos en Supabase primero
- Al enviar IDs a Supabase, siempre resolver a uuid (_uuid) — las columnas FK son uuid, no legacy_id
- Cuando un feature necesita nueva columna en Supabase, completar todo el ciclo: ALTER TABLE + loader + writer + call sites antes de probar
