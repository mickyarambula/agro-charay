# AgroSistema Charay — HANDOFF

**Última actualización:** 24 Abril 2026 (tarde, sesión 3)
**Branch activo:** dev
**Último commit dev:** 2c30aaf (refactor: limpiar dead code — helper restore, comentarios stale, lectura muerta cosecha)
**Último commit main:** 811a5dd (merge: fix diesel mensaje calculadora + docs cierre sesión)
**Tag de respaldo:** backup-pre-merge-24abr2026-general01
**Estado:** GENERAL-01 + fix diesel en producción. Dead code limpiado. supabase-js actualizado. Consumos provisionales para 5 tractores.

## Estado al cierre

- GENERAL-01 en producción (main). Smoke test aprobado.
- Fix diesel (mensaje calculadora) en producción (main).
- Consumos provisionales insertados para T-2, T-4, T-6, Aspersora T-8 (mismos valores que T-1). Encargado debe ajustar a valores reales desde Maquinaria → ⛽.
- supabase-js actualizado de 2.103.0 a 2.104.1.
- Dead code limpiado en App.jsx: helper restore muerto, 5 comentarios stale de migración, lectura muerta de cosecha, header stale en PERSIST_KEYS. −23 líneas netas.
- Calculadora diesel operativa para los 5 tractores.

## Bugs estructurales pendientes

- Ninguno conocido.

## Tabla de pendientes actualizada

| # | Prioridad | Tarea | Tiempo | Categoría |
|---|-----------|-------|--------|-----------|
| 1 | Alta | Merge limpieza + supabase-js de dev a main | 10 min | Deploy |
| 2 | Media | Encargado: ajustar consumos L/ha reales para T-2, T-4, T-6, Aspersora T-8 en Maquinaria → ⛽ | 20 min | Data |
| 3 | Media | Capturar teléfonos de 4 operadores sin WhatsApp (Javier, Jesús, Manuel, Ramón) | 10 min | Data |
| 4 | Futuro | Permisos/roles Grupo C restante → Supabase | 2 hrs | Arquitectura |
| 5 | Futuro | Diesel: asignar productor automático desde lote al cargar tractor | 45 min | Feature |
| 6 | Futuro | Panel Daniela: exportación a formatos contables | 2 hrs | Feature |
| 7 | Futuro | Modo offline (IndexedDB + SW) | 8+ hrs | Feature |
| 8 | Futuro | Seguridad: quitar passwords de roles.js, JWT real | 2 hrs | Seguridad |

## Siguiente sesión — recomendación

Merge rápido de limpieza + supabase-js a main (10 min). Después, migrar PATCH inline de OrdenDia a supabaseWriters.js (#4, 30 min) — es el último refactor pendiente de baja complejidad.

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
