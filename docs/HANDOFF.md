# AgroSistema Charay — HANDOFF

**Última actualización:** 19 Abril 2026 (noche, sesión extendida)
**Branch activo:** dev
**Estado:** sistema estable, 2 bugs menores diagnosticados

## Estado al cierre
- Dashboard carga sin crashes
- Diesel carga sin crashes (500 L en cilindro, 32 registros en historial)
- Calculadora L/ha FUNCIONA correctamente (verificado: 6.9 ha × 10 L/ha = 69 L)
- Warning key=null RESUELTO con fallback `diesel-${idx}`
- Login, realtime, navegación OK

## Bugs diagnosticados (pendientes de fix)

### Bug DIESEL-01: Doble fuente de datos en historial
**Severidad:** Media-Alta
**Diagnóstico realizado:** 19 Abril 2026

En el primer render del módulo Diesel, los 32 registros del historial llegan SIN `id`. Después de que Supabase termina de cargar, llegan 31 registros CON `id`. Esto causa 3 síntomas relacionados:

1. Warning "key=null" en consola (ya mitigado con fallback)
2. Cancelación de registros "aparenta funcionar" pero no quita del historial — porque el código intenta borrar por `id` que no existe
3. Bug visual ocasional de saldo mostrando valores fuera de rango (ej: 36,800/10,000)

**Hipótesis:** El historial se construye primero desde el state global de DataContext (que puede tener datos legacy o cache sin ids) y luego se sobreescribe con datos frescos de Supabase.

**Fix propuesto (próxima sesión):**
- Revisar cómo se construye el array `historial` en Diesel.jsx
- Asegurar que solo use la fuente de Supabase, no el state global como fallback
- O filtrar `historial.filter(d => d.id)` antes de renderizar
- Probar cancelación con admin después del fix

### Bug DIESEL-02: Realtime REST fallback deprecation
**Severidad:** Baja (warning, no bloqueante)
Cliente de Supabase usa REST fallback en vez de httpSend() explícito. Actualizar @supabase/supabase-js cuando se trabaje en Diesel.

## Tabla de pendientes actualizada

| # | Prioridad | Tarea | Tiempo | Categoría |
|---|-----------|-------|--------|-----------|
| 1 | Alta | Fix bug DIESEL-01 (doble fuente de datos) | 30 min | Bug |
| 2 | Alta | Migrar Capital Propio de localStorage a Supabase | 45 min | Migración |
| 3 | Alta | Migrar Bitácora de Trabajos a Supabase | 45 min | Migración |
| 4 | Media | Refactor App.jsx — extraer routes a src/core/routes.jsx | 45 min | Refactor |
| 5 | Media | Refactor App.jsx — extraer WidgetCBOTDashboard | 30 min | Refactor |
| 6 | Media | Asignar productor auto desde lote al cargar tractor | 30 min | Feature Diesel |
| 7 | Media | Edicion admin (litros, notas) en modal detalle Diesel | 30 min | Feature Diesel |
| 8 | Baja | Balance General: capital propio vacío (depende de #2) | 10 min | Finanzas |
| 9 | Baja | Actualizar @supabase/supabase-js (fix REST fallback) | 15 min | Infra |
| 10 | Baja | Alertas WhatsApp al socio (resumen semanal) | 2 hrs | Feature |
| 11 | Baja | Dashboard histórico entre ciclos | 3 hrs | Feature |
| 12 | Futuro | DashboardCampo Phase 1 — móvil encargado | 2 hrs | Feature |
| 13 | Futuro | Modo offline (IndexedDB + cola sync) | 4+ hrs | Infra |
| 14 | Futuro | Cosecha Fase 2: boletas → pago banco → cierre | 3 hrs | Cuando llegue cosecha |

## Siguiente sesión — empezar por #1 o #2
Recomiendo empezar con #2 (Capital a Supabase) — es migración mecánica sin debugging complejo. Deja #1 (bug DIESEL-01) para sesión fresca con energía para debugging.

## Reglas de trabajo (mantener)
- Sesiones cortas (30-50 min), un objetivo claro
- Commit y push al cierre, siempre
- Actualizar PROGRESS.md y HANDOFF.md antes de cerrar
- No agregar features nuevas hasta terminar migraciones pendientes
- Verificar schema Supabase antes de POST (information_schema.columns)
- Nunca importar desde App.jsx en módulos
- Un bug por sesión — verificar, commit, cerrar
