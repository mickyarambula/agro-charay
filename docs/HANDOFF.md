# AgroSistema Charay — HANDOFF

**Última actualización:** 20 Abril 2026 (noche — extracción postBitacora + migración bulk import)
**Branch activo:** dev
**Último commit código:** e6b3554 (refactor(bitacora): extraer postBitacora a helper compartido + migrar bulk import Excel a Supabase)
**Estado:** módulo Bitácora 100% migrado a Supabase en lectura Y en los 7 flujos de escritura internos. Helper compartido `postBitacora` extraído a `src/core/supabaseWriters.js`. Queda por migrar escritura de bitácora desde los 4 archivos externos (Diesel, VistaOperador, OrdenDia, DashboardCampo) y el bug de DELETE descubierto en esta sesión.

## Estado al cierre

- Sesión ~1h 15min. Un objetivo cumplido con scope B estricto (extraer helper + migrar bulk import Excel).
- `src/core/supabaseWriters.js` creado — helper compartido `postBitacora(payload, cicloActivoId, {silent=false})`. Modo `silent:true` para bulk (evita N alerts).
- Bitacora.jsx refactorizado: helper local eliminado (43 líneas), imports huérfanos SUPABASE_URL/SUPABASE_ANON_KEY removidos, los 6 handlers manuales ahora llaman al helper compartido pasando `state.cicloActivoId`.
- Bulk import Excel (línea 223) migrado con `Promise.all` + `silent:true`. Log `failedBulk` separado del conteo `ok` para distinguir fallos de parseo vs fallos de persistencia.
- Smoke test manual: 2 Reportes Diarios creados desde UI → llegaron a Supabase con `fuente='bitacora'`, `tipo='reporte'`, `ciclo_id='1'`. Confirmado que el helper extraído funciona igual que el local.
- Build OK, parse Babel OK, deploy dev verificado en agro-charay-dev.vercel.app.
- Supabase `bitacora_trabajos` quedó con 0 filas al cierre (cleanup por `legacy_id IN (...)`).

## Descubrimiento nuevo: bug DELETE_BITACORA no persiste a Supabase

Durante el smoke test de esta sesión se descubrió que el botón 🗑 de la UI de Bitácora borra del reducer local pero NO hace DELETE a Supabase. Los registros desaparecen en UI pero quedan vivos en la tabla. Es preexistente, no introducido por esta sesión — mismo patrón estructural que el bug de INSERT que acabamos de cerrar: la capa de escritura nunca se había migrado. **Pendiente nuevo, prioridad Alta.**

## Descubrimiento nuevo: el HANDOFF anterior subcontaba flujos pendientes

El HANDOFF previo decía "queda UN flujo pendiente (bulk import)". La realidad del diagnóstico: son 6 puntos en 5 archivos. Los 6 handlers dentro de Bitacora.jsx ya estaban migrados — pero había 5 dispatches `ADD_BITACORA` en crudo en otros módulos (Diesel, VistaOperador, OrdenDia, DashboardCampo) que nunca llegaron a Supabase. Hoy cerramos el bulk import; los 5 externos quedan pendientes.

## Cómo quedó la hidratación de bitácora tras esta sesión

| Capa | Estado |
|------|--------|
| Lectura al login | ✅ Supabase (migrado sesión anterior) |
| Escritura — 6 handlers en Bitacora.jsx | ✅ Supabase vía helper compartido |
| Escritura — bulk import Excel en Bitacora.jsx | ✅ Supabase (hoy) |
| Escritura — Diesel.jsx:194 | ❌ solo reducer local |
| Escritura — VistaOperador.jsx:39 | ❌ solo reducer local |
| Escritura — OrdenDia.jsx:432 | ❌ solo reducer local |
| Escritura — DashboardCampo.jsx:102, :122 | ❌ solo reducer local |
| DELETE desde UI | ❌ solo reducer local (bug nuevo) |

## Bugs estructurales pendientes

### Bug GENERAL-01: Doble capa de persistencia (parcialmente mitigado)
Severidad: Alta. `App.jsx` inicializa el reducer desde `localStorage.agroSistemaState`, y `supabaseLoader` escribe encima. Para bitácora ya no hay conflicto (única fuente = Supabase), pero para otros módulos el patrón sigue. Fix completo: dejar de inicializar reducer desde localStorage, usar solo Supabase. 60 min estimados.

### Bug BITACORA-DELETE-01 (nuevo, descubierto 20-abr sesión noche)
Severidad: Alta. El botón 🗑 en UI de Bitácora borra del reducer local pero NO envía DELETE a Supabase. Workaround actual: borrar por SQL desde Supabase. Fix: añadir `deleteBitacora(id)` en `src/core/supabaseWriters.js` + llamarlo desde los handlers de UI antes del dispatch `DELETE_BITACORA`. 20 min.

### Bug DIESEL-01
Manifestación de GENERAL-01 en Diesel. Pendiente hasta fix de GENERAL-01.

## Tabla de pendientes actualizada

| # | Prioridad | Tarea | Tiempo | Categoría |
|---|-----------|-------|--------|-----------|
| 1 | Alta | Migrar escritura bitácora desde 4 archivos restantes (Diesel, VistaOperador, OrdenDia, DashboardCampo — 5 sitios) usando `postBitacora` ya extraído | 25-35 min | Migración |
| 2 | Alta | Fix BITACORA-DELETE-01 — añadir `deleteBitacora` al helper y llamarlo desde handlers de UI | 20 min | Bug |
| 3 | Alta | Fix GENERAL-01 (doble persistencia de raíz) | 60 min | Bug estructural crítico |
| 4 | Media | Fix DIESEL-01 (consecuencia de #3) | 15 min tras #3 | Bug |
| 5 | Media | Merge dev → main cuando #1, #2 y #3 estén terminados | 10 min | Deploy |
| 6 | Media | Refactor App.jsx — extraer routes | 45 min | Refactor |
| 7 | Media | Asignar productor auto desde lote al cargar tractor | 30 min | Feature Diesel |
| 8 | Baja | Actualizar supabase-js (warning httpSend) | 15 min | Infra |
| 9 | Baja | Alertas WhatsApp al socio (resumen semanal) | 2 hrs | Feature |
| 10 | Baja | Dashboard histórico entre ciclos | 3 hrs | Feature |
| 11 | Futuro | DashboardCampo Phase 1 — móvil encargado | 2 hrs | Feature |
| 12 | Futuro | Cosecha Fase 2: boletas → pago banco → cierre | 3 hrs | Cuando llegue cosecha |
| 13 | Futuro | saveFoto: opción de ligar foto a lote/operador | 20 min | Mejora Bitácora |

## Siguiente sesión — recomendación

**Objetivo propuesto: #1 — migrar los 5 sitios externos usando `postBitacora` ya extraído.**

El helper ya existe y está probado en producción (vía los 6 handlers + bulk import). Los 5 sitios restantes son una línea de cambio cada uno: reemplazar `dispatch(ADD_BITACORA, ...)` directo por `await postBitacora(payload, state.cicloActivoId)` → `if (saved) dispatch(...)`. Scope acotado (~30 min) y cierra el módulo bitácora 100% en escritura.

**Opcional si sobra tiempo en esa misma sesión:** #2 (fix DELETE). Son 20 min adicionales, cierran ambas direcciones de escritura de bitácora en una sola sesión coherente. Preparación: leer cada uno de los 5 archivos completos antes de editar (patrón actual: `dispatch({type:"ADD_BITACORA", payload: {...}})`), confirmar la forma del payload coincide con lo que espera `postBitacora`.

## Reglas de trabajo (reforzadas esta sesión)

- Sesiones cortas (30-50 min), un objetivo claro
- Diagnóstico antes que fix
- Ver archivo completo y EXPANDIDO antes de editar
- Un cambio a la vez, con prueba inmediata
- Probar en local primero, luego dev, nunca directo a main
- `clear site data` en local antes de diagnosticar falsos bugs causados por localStorage residual
- Verificar schema Supabase antes de POST (`information_schema.columns`)
- Verificar sintaxis con Babel parse después de editar
- Commit y push al cierre, siempre
- Nunca importar desde App.jsx en módulos
- Datos reales = tolerancia cero al cambio sin respaldo previo y sin prueba explícita
- **Nueva (hoy):** cuando Claude Code diagnostique "queda X flujo pendiente" basado en lectura rápida, verificar con `grep -rn` el scope real antes de confiar. El HANDOFF anterior sobrevivió varias sesiones subcontando 5 sitios.
- **Nueva (hoy):** `SELECT COUNT(*)` después de un DELETE. En SQL "Success, no rows returned" significa "no hubo error", NO "se borraron filas". `NULL LIKE '%x%'` es NULL (no TRUE) — si una columna puede ser NULL, los LIKE no borran esas filas.
- **Nueva (hoy):** cuando se extrae un helper de un archivo a módulo compartido, verificar si los imports que usaba el helper quedan huérfanos en el archivo origen. Si quedan, eliminarlos — dead code en archivo con lógica financiera confunde a devs futuros.
- **Nueva (hoy):** un smoke test manual (ej. 1 handler + ver Supabase + F5) es suficiente para validar que un refactor de helper compartido mantiene el contrato. Ahorra instalar toolchains extra (Excel/LibreOffice) por la prueba del bulk cuando los handlers individuales usan el mismo helper.
- Cuidado con listeners de Supabase: handler con `signOut()` nunca dentro de `onAuthStateChange(SIGNED_OUT)`
