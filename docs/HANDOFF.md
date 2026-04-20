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

### Bug GENERAL-03: Tercera capa de persistencia desconocida (PWA/Service Worker/IndexedDB)

Severidad: Alta. Descubierto al intentar limpiar registros de prueba de Bitácora al cierre de sesión 20-abr noche.

Síntoma: después de
1. `DELETE FROM bitacora_trabajos;` en Supabase (0 filas confirmado)
2. Vaciar `state.bitacora = []` dentro de `localStorage.agroSistemaState` (verificado con console.log antes/después)
3. Reload completo de la página

…la UI seguía mostrando los 6 registros de prueba. El supabaseLoader reportaba `productores: 18, lotes: 107, insumos: 105, egresos: 212` pero la bitácora con 6 entradas apareció de otra fuente.

Hipótesis: el Service Worker del PWA (`[PWA] SW registrado, scope: ...`) está cacheando respuestas de API o sirviendo state desde IndexedDB que no se está invalidando en el reload normal. Esto significa que actualmente existen TRES fuentes de datos en paralelo: Supabase, localStorage y una tercera capa (SW cache + probable IndexedDB).

Implicaciones:
- La migración de LECTURA a Supabase (#1 del HANDOFF) no es suficiente por sí sola — también hay que identificar y limpiar la tercera capa, o el problema persistirá.
- Cualquier "DELETE en Supabase" no tiene efecto real en dispositivos donde el SW ya cacheó la data.
- Es plausible que GENERAL-01 y GENERAL-03 sean manifestaciones del mismo problema arquitectónico, pero hay que confirmarlo con diagnóstico (no asumir).

Siguiente paso cuando se ataque: SOLO diagnóstico — abrir DevTools → Application → Service Workers + IndexedDB + Cache Storage para mapear qué guarda el SW y qué vive en IndexedDB. NO intentar limpieza sin tener el mapa completo.

## Tabla de pendientes actualizada

| # | Prioridad | Tarea | Tiempo | Categoría |
|---|-----------|-------|--------|-----------|
| 1 | Alta | Bitácora: migrar LECTURA — agregar fetch de bitacora_trabajos a supabaseLoader.js | 45 min | Migración |
| 2 | Alta | Bitácora: migrar bulk import Excel (el 7° flujo que no se ha tocado) | 30 min | Migración |
| 3 | Alta | Fix GENERAL-01 (doble persistencia localStorage↔Supabase) | 60 min | Bug estructural crítico |
| 4 | Alta | Diagnóstico GENERAL-03 (tercera capa PWA/SW/IndexedDB) — solo mapeo, sin tocar | 30 min | Bug estructural crítico |
| 5 | Media | Fix DIESEL-01 (consecuencia de #3) | 15 min después de #3 | Bug |
| 6 | Media | Merge dev → main cuando #1, #3 y #4 estén terminados | 10 min | Deploy |
| 7 | Media | Refactor App.jsx — extraer routes | 45 min | Refactor |
| 8 | Media | Asignar productor auto desde lote al cargar tractor | 30 min | Feature Diesel |
| 9 | Baja | Actualizar supabase-js (warning de httpSend en consola) | 15 min | Infra |
| 10 | Baja | Alertas WhatsApp al socio (resumen semanal) | 2 hrs | Feature |
| 11 | Baja | Dashboard histórico entre ciclos | 3 hrs | Feature |
| 12 | Futuro | DashboardCampo Phase 1 — móvil encargado | 2 hrs | Feature |
| 13 | Futuro | Cosecha Fase 2: boletas → pago banco → cierre | 3 hrs | Cuando llegue cosecha |
| 14 | Futuro | saveFoto: opción de ligar foto a lote/operador si hace falta | 20 min | Mejora Bitácora |

## Siguiente sesión — recomendación

Orden recomendado (NO cambiar sin pensar):
1. Empezar con #4 (diagnóstico GENERAL-03, 30 min, sin tocar nada). Necesitamos entender la tercera capa antes de cualquier migración de lectura. Si #4 revela que el SW está cacheando la app entera pero no los datos del state, se puede saltar a #1. Si revela que IndexedDB guarda state, #1 se complica y hay que replantear.
2. Después #1 (migración de lectura a supabaseLoader.js).
3. Después #3 (fix GENERAL-01, que puede volverse trivial si #1 y #4 ya resolvieron la raíz).

Antes de tocar supabaseLoader.js:
- Ver el archivo completo y expandido
- Entender configPreservada
- Revisar cómo capital_movimientos se integró al Promise.all (patrón a replicar)
- Probar en local primero, luego dev, nunca directo a main

Mientras tanto: los 6 registros "fantasma" de bitácora visibles en dev son puras pruebas y no estorban. Se limpiarán solos cuando #4+#1 estén resueltos. Tolerancia cero con limpiezas improvisadas mientras no entendamos la tercera capa.

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
- Si una limpieza "simple" (DELETE + borrar localStorage) no produce el efecto esperado en la UI, PARAR de inmediato. No improvisar más limpiezas. Documentar lo descubierto y cerrar sesión. Las sorpresas de persistencia son síntoma de arquitectura no entendida — requieren diagnóstico planeado, no parches.
