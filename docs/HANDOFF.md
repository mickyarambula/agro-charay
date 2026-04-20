# AgroSistema Charay — HANDOFF

**Última actualización:** 20 Abril 2026 (noche)
**Branch activo:** dev
**Último commit:** 2776839 (docs sesión 20-abr tarde) — esta sesión no tocó código, solo pruebas
**Estado:** los 6 handlers de escritura de Bitácora funcionan en dev. Lectura sigue por localStorage (pendiente).

## Estado al cierre

- Los 6 handlers de escritura de Bitácora verificados en dev con POST 201 + fila en Supabase:
  - saveReporte ✅ (sesión anterior)
  - saveRiego ✅ (sesión anterior)
  - saveInsumo ✅ (esta sesión)
  - saveDiesel ✅ (esta sesión)
  - saveFenol ✅ (esta sesión)
  - saveFoto ✅ (esta sesión)
- Registros de prueba (4 filas dummy) limpiados con DELETE filtrado por timestamp
- Cero cambios de código esta sesión — solo testing, verificación SQL y limpieza
- supabaseLoader.js sigue sin tocar — la lectura de Bitácora sigue por localStorage
- Observación menor: saveFoto deja `lote_id`, `operador`, `maquinaria_id` en NULL (consistente con diseño — la foto es comprobante suelto). No es bug, pero si se quiere ligar foto a lote en el futuro, revisar handler.

## Flujos Bitácora — estado final

| Handler | Escritura Supabase | Lectura Supabase |
|---------|-------------------|------------------|
| saveInsumo | ✅ | ❌ (localStorage) |
| saveDiesel | ✅ | ❌ (localStorage) |
| saveRiego | ✅ | ❌ (localStorage) |
| saveFenol | ✅ | ❌ (localStorage) |
| saveReporte | ✅ | ❌ (localStorage) |
| saveFoto | ✅ | ❌ (localStorage) |
| Bulk import Excel | ❌ (pendiente) | N/A |

## Bugs estructurales pendientes

### Bug GENERAL-01: Doble capa de persistencia
Severidad: Alta. App.jsx lee localStorage al montar, supabaseLoader re-escribe localStorage pero el reducer ya no se entera. Fix: dejar de inicializar reducer desde localStorage. Solo Supabase como fuente.

### Bug DIESEL-01
Manifestación de GENERAL-01 en el módulo Diesel.

## Tabla de pendientes actualizada

| # | Prioridad | Tarea | Tiempo | Categoría |
|---|-----------|-------|--------|-----------|
| 1 | Alta | Bitácora: migrar LECTURA — agregar fetch de bitacora_trabajos a supabaseLoader.js | 45 min | Migración |
| 2 | Alta | Bitácora: migrar bulk import Excel (el 7° flujo que no se ha tocado) | 30 min | Migración |
| 3 | Alta | Fix GENERAL-01 (doble persistencia) | 60 min | Bug estructural crítico |
| 4 | Media | Fix DIESEL-01 (consecuencia de #3) | 15 min después de #3 | Bug |
| 5 | Media | Merge dev → main cuando #1 esté terminado | 10 min | Deploy |
| 6 | Media | Refactor App.jsx — extraer routes | 45 min | Refactor |
| 7 | Media | Asignar productor auto desde lote al cargar tractor | 30 min | Feature Diesel |
| 8 | Baja | Actualizar supabase-js | 15 min | Infra |
| 9 | Baja | Alertas WhatsApp al socio (resumen semanal) | 2 hrs | Feature |
| 10 | Baja | Dashboard histórico entre ciclos | 3 hrs | Feature |
| 11 | Futuro | DashboardCampo Phase 1 — móvil encargado | 2 hrs | Feature |
| 12 | Futuro | Cosecha Fase 2: boletas → pago banco → cierre | 3 hrs | Cuando llegue cosecha |
| 13 | Futuro | saveFoto: opción de ligar foto a lote/operador si hace falta | 20 min | Mejora Bitácora |

## Siguiente sesión — recomendación

Arrancar con #1 (migración de LECTURA a supabaseLoader.js). Esta es la tarea de mayor riesgo del plan — cambia cómo arranca la app. Antes de tocar nada:
1. Ver supabaseLoader.js completo y expandido
2. Entender configPreservada
3. Revisar cómo capital_movimientos se integró al Promise.all (es el patrón a replicar)
4. Probar en local primero, luego dev, nunca directo a main

Después de #1, si sobra tiempo: #2 (bulk import Excel) con testing propio.

## Reglas de trabajo (reforzadas esta sesión)

- Sesiones cortas (30-50 min), un objetivo claro
- Testing en lote es aceptable cuando los handlers tienen estructura idéntica y se verifica con SQL al final
- Preserve log en DevTools Network es esencial para testing de varios POSTs seguidos
- Commit y push al cierre, siempre (esta sesión: sin commit de código, solo docs)
- Actualizar PROGRESS.md y HANDOFF.md antes de cerrar
- Si hubo varios cambios de estado durante el día, releer HANDOFF anterior antes de regenerarlo
- Un bug/feature por sesión — verificar, commit, cerrar
- Nunca importar desde App.jsx en módulos
- Verificar schema Supabase antes de POST
- Ver archivo completo y EXPANDIDO antes de editar — nunca confiar en resúmenes de "+X lines to expand"
- Un cambio a la vez, con prueba inmediata en dev antes de pensar en main
- Datos reales = tolerancia cero al cambio sin respaldo previo y sin prueba explícita
- Probar el cambio en local primero, luego dev, nunca directo a main
- Cuidado con listeners de Supabase: handler que llama signOut() nunca dentro de onAuthStateChange(SIGNED_OUT)
- Limpiar datos de prueba de Supabase con DELETE filtrado por timestamp al cierre (no a mano uno por uno)
