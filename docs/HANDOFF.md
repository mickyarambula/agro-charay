# AgroSistema Charay — HANDOFF

**Última actualización:** 20 Abril 2026 (AM)
**Branch activo:** dev
**Último commit (dev):** eae6d0e — fix(GENERAL-02): preservar payload.id en 26 reducers
**Último commit (main):** 70bf11b — chore: trigger redeploy after github reconnect
**Estado:** sistema estable en producción, GENERAL-02 resuelto, integración Vercel↔GitHub reconectada

## Estado al cierre
- Capital Propio migrado a Supabase (fetch + save + guards anti-duplicados)
- Tabla capital_movimientos limpia en DB (lista para datos reales)
- Dashboard y Diesel estables
- GENERAL-02 resuelto en 26 reducers (ADD_* y recepciones). Los ids de Supabase se propagan al reducer sin pisarse.
- Integración Vercel↔GitHub reconectada — pushes a main vuelven a disparar deploy automático
- Deploy productivo verificado: dpl_v1mip2zCrrU4MatRdoVdD8RuhLZT READY
- localStorage aún contiene datos operativos de otros módulos (bitácora, trabajos, etc)

## Bugs estructurales pendientes

### Bug GENERAL-01: Doble capa de persistencia
**Severidad:** Alta (afecta todo el sistema)

App.jsx:1144 lee localStorage al montar, reducer se inicializa con esos datos, UI renderiza, y DESPUÉS supabaseLoader re-escribe localStorage pero el reducer ya no se entera. Resultado: el usuario ve datos viejos hasta que alguna mutación fuerza refresh.

Fix propuesto: en App.jsx, no inicializar reducer con localStorage. Solo usar Supabase como fuente. localStorage queda como cache de UI opcional.

### Bug DIESEL-01: Doble fuente de datos en historial
(Ya documentado — es manifestación de GENERAL-01)

## Tabla de pendientes actualizada

| # | Prioridad | Tarea | Tiempo | Categoría |
|---|-----------|-------|--------|-----------|
| 1 | Alta | Migrar Bitácora de Trabajos a Supabase | 45 min | Migración |
| 2 | Alta | Fix GENERAL-01 (doble persistencia) | 60 min | Bug estructural crítico |
| 3 | Media | Fix DIESEL-01 (consecuencia de #2) | 15 min después de #2 | Bug |
| 4 | Media | Refactor App.jsx — extraer routes | 45 min | Refactor |
| 5 | Media | Refactor App.jsx — extraer WidgetCBOTDashboard | 30 min | Refactor |
| 6 | Media | Asignar productor auto desde lote al cargar tractor | 30 min | Feature Diesel |
| 7 | Baja | Cleanup sessionStorage/localStorage al logout | 15 min | Bug menor UX |
| 8 | Baja | Actualizar supabase-js (fix REST fallback) | 15 min | Infra |
| 9 | Baja | Alertas WhatsApp al socio (resumen semanal) | 2 hrs | Feature |
| 10 | Baja | Dashboard histórico entre ciclos | 3 hrs | Feature |
| 11 | Futuro | DashboardCampo Phase 1 — móvil encargado | 2 hrs | Feature |
| 12 | Futuro | Cosecha Fase 2: boletas → pago banco → cierre | 3 hrs | Cuando llegue cosecha |

## Siguiente sesión — recomendación
Empezar por #1 (Bitácora) aplicando el mismo patrón que Capital. Dejar #2 (GENERAL-01) para una sesión dedicada porque toca App.jsx en profundidad y requiere repensar el flujo de hidratación del state.

## Reglas de trabajo (mantener)
- Sesiones cortas (30-50 min), un objetivo claro
- Commit y push al cierre, siempre
- Actualizar PROGRESS.md y HANDOFF.md antes de cerrar
- Un bug por sesión — verificar, commit, cerrar
- Nunca importar desde App.jsx en módulos
- Verificar schema Supabase antes de POST
- Reducers nuevos: `id: payload.id ?? Date.now()`, nunca `{...payload, id: Date.now()}`
