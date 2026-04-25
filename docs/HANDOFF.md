# AgroSistema Charay — HANDOFF

**Última actualización:** 25 Abril 2026 (mediodía, sesión 5)
**Branch activo:** dev
**Último commit dev:** bc0262d (fix(diesel): autofill lote post-reload — match uuid o legacy_id (DIESEL-AUTOFILL-01))
**Último commit main:** 8738b93 (merge: fix DIESEL-AUTOFILL-01 — autofill lote post-reload)
**Tag de respaldo:** backup-pre-merge-25abr2026-autofill
**Estado:** DIESEL-AUTOFILL-01 resuelto y en producción. Sin bugs estructurales abiertos.

## Estado al cierre

- DIESEL-AUTOFILL-01 resuelto: el auto-fill de lote al seleccionar tractor ahora funciona post-reload. La comparación en Diesel.jsx onChange del tractor matchea contra l.id (legacy_id) o l._uuid, y asigna siempre l.id al state para que el select lo encuentre.
- Smoke test pasado: 3 escenarios verificados (T-2 con historial → CHAYO GARCIA auto-llenado, T-6 sin historial → vacío sin error, lote elegido manualmente → respeta elección al cambiar tractor).
- Merge a main con tag de respaldo backup-pre-merge-25abr2026-autofill.
- Cargas de prueba eliminadas de Supabase (legacy_id 1777095023040 de 70L y 1777078821456 de 95L).
- GENERAL-01 + fix diesel completo en producción. App estable.

## Bugs estructurales pendientes

- Ninguno abierto.

## Tabla de pendientes actualizada

| # | Prioridad | Tarea | Tiempo | Categoría |
|---|-----------|-------|--------|-----------|
| 1 | Media | Encargado: ajustar consumos L/ha reales para T-2, T-4, T-6, Aspersora T-8 | 20 min | Data |
| 2 | Media | Capturar teléfonos de 4 operadores sin WhatsApp | 10 min | Data |
| 3 | Futuro | Permisos/roles Grupo C restante → Supabase | 2 hrs | Arquitectura |
| 4 | Futuro | Panel Daniela: exportación a formatos contables | 2 hrs | Feature |
| 5 | Futuro | Modo offline (IndexedDB + SW) | 8+ hrs | Feature |
| 6 | Futuro | Seguridad: quitar passwords de roles.js, JWT real | 2 hrs | Seguridad |
| 7 | Futuro | Bug calculadora diesel: fetch directo a maquinaria_consumos al abrir modal | 30 min | Bug |
| 8 | Futuro | Modal detalle diesel: edición de registros para admin (litros, notas) | 45 min | Feature |
| 9 | Futuro | Dashboard histórico entre ciclos | 3 hrs | Feature |
| 10 | Futuro | Alertas WhatsApp al socio (resumen semanal) | 4 hrs | Feature |

## Siguiente sesión — recomendación

Decisión abierta: priorizar entre Fase 1 operativa (consumos reales L/ha + teléfonos operadores, ambos rápidos y desbloquean el uso real en campo) o avanzar a Fase 3 finanzas (Panel Daniela exportación). Sin bugs urgentes — la siguiente sesión puede ser planificación de feature o data entry.

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
- Claude web siempre incluye los comandos para correr local (npm run dev, etc.) en cada bloque de instrucciones — el usuario no debe inferirlos
- Al comparar IDs entre state hidratado y datos en optLotes/optMaquinaria, considerar tanto legacy_id como _uuid — los registros viejos vs nuevos pueden venir en formato distinto post-reload
