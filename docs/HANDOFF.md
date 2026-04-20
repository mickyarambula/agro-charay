# AgroSistema Charay — HANDOFF

**Última actualización:** 20 Abril 2026 (tarde)
**Branch activo:** dev
**Último commit:** eae6d0e — fix(reducers): preservar payload.id en 26 reducers ADD_*
**Estado:** sistema estable. Capital migrado. GENERAL-02 resuelto. Logout limpio. Siguiente: migrar Bitácora.

## Estado al cierre

- Logout limpio: storage + Supabase Auth + estado local, sin residuos entre usuarios
- GENERAL-02 resuelto: 26 reducers ADD_* ahora usan `id: payload.id ?? Date.now()` (commit eae6d0e)
- Capital Propio migrado a Supabase (fetch + save + guards anti-duplicados)
- Dashboard y Diesel estables
- localStorage aún contiene datos operativos de: bitácora de trabajos

## Bugs estructurales pendientes

### Bug GENERAL-01: Doble capa de persistencia
**Severidad:** Alta (afecta todo el sistema)

App.jsx lee localStorage al montar, reducer se inicializa con esos datos, UI renderiza, y DESPUÉS supabaseLoader re-escribe localStorage pero el reducer ya no se entera. Resultado: el usuario ve datos viejos hasta que alguna mutación fuerza refresh.

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
| 7 | Baja | Actualizar supabase-js (fix REST fallback) | 15 min | Infra |
| 8 | Baja | Alertas WhatsApp al socio (resumen semanal) | 2 hrs | Feature |
| 9 | Baja | Dashboard histórico entre ciclos | 3 hrs | Feature |
| 10 | Futuro | DashboardCampo Phase 1 — móvil encargado | 2 hrs | Feature |
| 11 | Futuro | Cosecha Fase 2: boletas → pago banco → cierre | 3 hrs | Cuando llegue cosecha |

## Siguiente sesión — recomendación

Arrancar #1 (migrar Bitácora). Aplicar el mismo patrón que Capital: tabla en Supabase con legacy_id, fetch en supabaseLoader.js, POST directo antes del dispatch local, guards anti doble-click. Dejar #2 (GENERAL-01) para una sesión dedicada porque toca App.jsx en profundidad.

## Reglas de trabajo (mantener)

- Sesiones cortas (30-50 min), un objetivo claro
- Commit y push al cierre, siempre
- Actualizar PROGRESS.md y HANDOFF.md antes de cerrar
- Si hubo varios cambios de estado durante el día, releer HANDOFF anterior antes de regenerarlo (no basarse solo en el del inicio del chat)
- Un bug por sesión — verificar, commit, cerrar
- Nunca importar desde App.jsx en módulos
- Verificar schema Supabase antes de POST
- Cuidado con listeners de Supabase que puedan generar loops: un handler que llama `signOut()` nunca debe estar dentro del propio `onAuthStateChange` de SIGNED_OUT
