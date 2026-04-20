# AgroSistema Charay — HANDOFF

**Última actualización:** 20 Abril 2026 (mañana)
**Branch activo:** dev
**Último commit:** 3b2d789 — feat(capital): migrar Capital Propio a Supabase
**Estado:** sistema estable, migración Capital OK, 2 bugs estructurales identificados

## Estado al cierre
- Capital Propio migrado a Supabase (fetch + save + guards anti-duplicados)
- Tabla capital_movimientos limpia en DB (lista para datos reales)
- Dashboard y Diesel estables
- localStorage aún contiene datos operativos de otros módulos (bitácora, trabajos, etc)

## Bugs estructurales descubiertos (críticos para sesiones futuras)

### Bug GENERAL-01: Doble capa de persistencia
**Severidad:** Alta (afecta todo el sistema)

App.jsx:1144 lee localStorage al montar, reducer se inicializa con esos datos, UI renderiza, y DESPUÉS supabaseLoader re-escribe localStorage pero el reducer ya no se entera. Resultado: el usuario ve datos viejos hasta que alguna mutación fuerza refresh.

Fix propuesto: en App.jsx, no inicializar reducer con localStorage. Solo usar Supabase como fuente. localStorage queda como cache de UI opcional.

### Bug GENERAL-02: Reducer pisa id con Date.now()
**Severidad:** Media

DataContext.jsx líneas 444, 446 hacen {...payload, id: Date.now()} sobrescribiendo el legacy_id que el componente envía después del POST exitoso a Supabase. Rompe correlación local-DB.

Fix propuesto: cambiar a id: payload.id ?? Date.now() en todos los ADD_* y similares.

### Bug DIESEL-01: Doble fuente de datos en historial
(Ya documentado en sesión anterior — es manifestación de GENERAL-01)

## Tabla de pendientes actualizada

| # | Prioridad | Tarea | Tiempo | Categoría |
|---|-----------|-------|--------|-----------|
| 1 | Alta | Fix GENERAL-02 (reducer pisa id) | 20 min | Bug estructural |
| 2 | Alta | Migrar Bitácora de Trabajos a Supabase | 45 min | Migración |
| 3 | Alta | Fix GENERAL-01 (doble persistencia) | 60 min | Bug estructural crítico |
| 4 | Media | Fix DIESEL-01 (consecuencia de #3) | 15 min después de #3 | Bug |
| 5 | Media | Refactor App.jsx — extraer routes | 45 min | Refactor |
| 6 | Media | Refactor App.jsx — extraer WidgetCBOTDashboard | 30 min | Refactor |
| 7 | Media | Asignar productor auto desde lote al cargar tractor | 30 min | Feature Diesel |
| 8 | Baja | Actualizar supabase-js (fix REST fallback) | 15 min | Infra |
| 9 | Baja | Alertas WhatsApp al socio (resumen semanal) | 2 hrs | Feature |
| 10 | Baja | Dashboard histórico entre ciclos | 3 hrs | Feature |
| 11 | Futuro | DashboardCampo Phase 1 — móvil encargado | 2 hrs | Feature |
| 12 | Futuro | Cosecha Fase 2: boletas → pago banco → cierre | 3 hrs | Cuando llegue cosecha |

## Siguiente sesión — recomendación
Empezar por #1 (fix GENERAL-02) — es corto, mecánico, y desbloquea que los ids de Supabase se propaguen al reducer sin pisarse. Después #2 (Bitácora) aplicando el mismo patrón que Capital. Dejar #3 (GENERAL-01) para una sesión dedicada porque toca App.jsx en profundidad.

## Reglas de trabajo (mantener)
- Sesiones cortas (30-50 min), un objetivo claro
- Commit y push al cierre, siempre
- Actualizar PROGRESS.md y HANDOFF.md antes de cerrar
- Un bug por sesión — verificar, commit, cerrar
- Nunca importar desde App.jsx en módulos
- Verificar schema Supabase antes de POST
