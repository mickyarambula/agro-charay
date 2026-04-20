# AgroSistema Charay — HANDOFF

**Última actualización:** 20 Abril 2026 (mediodía)
**Branch activo:** dev
**Último commit:** d806aa2 — fix(auth): cleanup completo de storage en logout
**Estado:** sistema estable, bug de sesión pegada resuelto, 2 bugs estructurales aún pendientes

## Estado al cierre

- Logout limpio: storage + Supabase Auth + estado local, sin residuos entre usuarios
- Helper `handleLogout` unificado en App.jsx (reemplaza 3 call sites duplicados)
- Listener `onAuthStateChange` blindado contra loop (solo `setUsuario(null)` en SIGNED_OUT)
- Capital Propio migrado a Supabase (fetch + save + guards anti-duplicados)
- Dashboard y Diesel estables
- localStorage aún contiene datos operativos de otros módulos (bitácora, trabajos, etc)

## Bugs estructurales pendientes (críticos para sesiones futuras)

### Bug GENERAL-01: Doble capa de persistencia
**Severidad:** Alta (afecta todo el sistema)

App.jsx lee localStorage al montar, reducer se inicializa con esos datos, UI renderiza, y DESPUÉS supabaseLoader re-escribe localStorage pero el reducer ya no se entera. Resultado: el usuario ve datos viejos hasta que alguna mutación fuerza refresh.

Fix propuesto: en App.jsx, no inicializar reducer con localStorage. Solo usar Supabase como fuente. localStorage queda como cache de UI opcional.

### Bug GENERAL-02: Reducer pisa id con Date.now()
**Severidad:** Media

DataContext.jsx líneas 444, 446 hacen `{...payload, id: Date.now()}` sobrescribiendo el legacy_id que el componente envía después del POST exitoso a Supabase. Rompe correlación local-DB.

Fix propuesto: cambiar a `id: payload.id ?? Date.now()` en todos los ADD_* y similares.

### Bug DIESEL-01: Doble fuente de datos en historial
(Ya documentado — es manifestación de GENERAL-01)

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
- Cuidado con listeners de Supabase que puedan generar loops: un handler que llama `signOut()` nunca debe estar dentro del propio `onAuthStateChange` de SIGNED_OUT
