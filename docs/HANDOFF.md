# AgroSistema Charay — HANDOFF

**Última actualización:** 24 Abril 2026 (mediodía, sesión 2)
**Branch activo:** dev
**Último commit dev:** c43b4cc (fix(diesel): mejorar mensaje calculadora sin consumo configurado — muestra tractor y labor)
**Último commit main:** 3217a33 (merge: GENERAL-01 completo — config temporal migrada a Supabase)
**Tag de respaldo:** backup-pre-merge-24abr2026-general01
**Estado:** GENERAL-01 en producción. Calculadora diesel mejorada en dev.

## Estado al cierre

- GENERAL-01 Fase 3 mergeada a main — smoke test aprobado, producción estable.
- Tag backup-pre-merge-24abr2026-general01 creado antes del merge.
- Calculadora diesel: no era bug de código — solo T-1 tiene consumos configurados. Los otros 4 tractores (T-2, T-4, T-6, Aspersora T-8) no tienen datos en maquinaria_consumos.
- Mensaje mejorado: ahora muestra nombre del tractor + tipo de labor + indicación de configurar en Maquinaria → ⛽. Estilo ámbar warning en vez de gris neutro.
- DashboardCampo Phase 2 en producción (main 394cea3).

## Bugs estructurales pendientes

- Ninguno conocido.

## Tabla de pendientes actualizada

| # | Prioridad | Tarea | Tiempo | Categoría |
|---|-----------|-------|--------|-----------|
| 1 | Alta | Merge fix diesel (mensaje calculadora) de dev a main | 10 min | Deploy |
| 2 | Media | Capturar teléfonos de 4 operadores sin WhatsApp (Javier, Jesús, Manuel, Ramón) | 10 min | Data |
| 3 | Media | Configurar consumos L/ha para T-2, T-4, T-6, Aspersora T-8 (encargado con datos reales) | 20 min | Data |
| 4 | Baja | Actualizar supabase-js (warning httpSend) | 15 min | Infra |
| 5 | Baja | Limpiar dead code: helper restore en App.jsx, comentarios stale en PERSIST_KEYS/IIFE | 15 min | Refactor |
| 6 | Baja | Migrar PATCH inline de OrdenDia (completar/editar) a supabaseWriters.js | 30 min | Refactor |
| 7 | Futuro | Permisos/roles Grupo C restante → Supabase | 2 hrs | Arquitectura |
| 8 | Futuro | Diesel: asignar productor automático desde lote al cargar tractor | 45 min | Feature |
| 9 | Futuro | Panel Daniela: exportación a formatos contables | 2 hrs | Feature |
| 10 | Futuro | Modo offline (IndexedDB + SW) | 8+ hrs | Feature |
| 11 | Futuro | Seguridad: quitar passwords de roles.js, JWT real | 2 hrs | Seguridad |

## Siguiente sesión — recomendación

Merge rápido del fix diesel a main (10 min). Después, el encargado debería configurar los consumos L/ha reales para los 4 tractores sin datos desde Maquinaria → ⛽. Con eso, la calculadora diesel queda 100% operativa para todos los equipos.

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
