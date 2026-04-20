# AgroSistema Charay — HANDOFF

**Última actualización:** 19 Abril 2026 (noche)
**Branch activo:** dev
**Último commit:** c7004a3 — fix crash React #31 + TDZ Diesel
**Estado:** sistema estable, sin crashes activos

## Estado al cierre
- Dashboard carga sin crashes
- Diesel carga sin crashes (500 L en cilindro, 32 registros en historial)
- Login y realtime funcionando
- 2 warnings menores en consola (no bloqueantes): key=null en Diesel.jsx:411, Realtime REST fallback

## Tabla de pendientes

| # | Prioridad | Tarea | Tiempo | Categoría |
|---|-----------|-------|--------|-----------|
| 1 | Alta | Probar calculadora L/ha en modal Cargar tractor | 5 min | Verificación |
| 2 | Media | Warning key=null en Diesel.jsx:411 | 15 min | Bug menor |
| 3 | Media | Asignar productor auto desde lote al cargar tractor | 30 min | Feature Diesel |
| 4 | Media | Edicion admin (litros, notas) en modal detalle Diesel | 30 min | Feature Diesel |
| 5 | Alta | Migrar Capital Propio de localStorage a Supabase | 45 min | Migración |
| 6 | Alta | Migrar Bitácora de Trabajos a Supabase | 45 min | Migración |
| 7 | Baja | Balance General: capital propio vacío (depende de #5) | 10 min | Finanzas |
| 8 | Baja | Alertas WhatsApp al socio (resumen semanal) | 2 hrs | Feature |
| 9 | Baja | Dashboard histórico entre ciclos | 3 hrs | Feature |
| 10 | Futuro | DashboardCampo Phase 1 — móvil encargado | 2 hrs | Feature |
| 11 | Futuro | Modo offline (IndexedDB + cola sync) | 4+ hrs | Infra |
| 12 | Futuro | Cosecha Fase 2: boletas → pago banco → cierre | 3 hrs | Cuando llegue cosecha |

## Siguiente sesión — empezar por el #1
Probar la calculadora L/ha en modal Cargar tractor. Si funciona, seguir con #5 o #6 (migraciones a Supabase, más valor).

## Reglas de trabajo (mantener)
- Sesiones cortas (30-50 min), un objetivo claro
- Commit y push al cierre, siempre
- Actualizar PROGRESS.md y HANDOFF.md antes de cerrar
- No agregar features nuevas hasta terminar migraciones pendientes
- Verificar schema Supabase antes de POST (information_schema.columns)
- Nunca importar desde App.jsx en módulos
