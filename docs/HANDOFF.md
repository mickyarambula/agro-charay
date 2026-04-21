# AgroSistema Charay — HANDOFF

**Última actualización:** 20 Abril 2026 (noche tardía — fix BITACORA-DELETE-01)
**Branch activo:** dev
**Último commit código:** 3ee9b59 (fix(bitacora): cerrar DELETE a Supabase — BITACORA-DELETE-01)
**Estado:** módulo Bitácora 100% migrado a Supabase en **ambas** direcciones (INSERT + DELETE). El botón 🗑 ya borra en BD. Bug BITACORA-DELETE-01 cerrado. Tabla `bitacora_trabajos` en 0 filas al cierre. Pendiente crítico real: Bug GENERAL-01 estructural.

## Estado al cierre

- Sesión ~30 min, scope B estricto. Un objetivo cumplido: fix BITACORA-DELETE-01.
- `deleteBitacora(legacyId, { silent })` añadido en `src/core/supabaseWriters.js` siguiendo el mismo patrón que `postBitacora` (mismos headers, prefijo `[Bitacora]`, opción silent). Retorno booleano (true/false). Guard early return si `legacyId == null`. Distingue "no existe en BD" (warn, no alert) de error HTTP/red (error + alert).
- Handler del botón 🗑 en `Bitacora.jsx:489` migrado a **Supabase-first**: `await deleteBitacora(b.id)` → si `true`, dispatch `DEL_BITACORA` local. Si falla, el registro permanece visible en UI para que el usuario reintente. Elegido sobre offline-first porque es borrado destructivo manual del admin sobre datos reales.
- Smoke test verificado end-to-end en local y en dev URL: crear 1 registro desde UI (Aplicación Insumos UREA, legacy_id=1776747262747) → clic 🗑 + Aceptar → UI "Sin registros" → `SELECT COUNT(*) FROM bitacora_trabajos` = 0. Consola sin errores.
- Build OK, parse Babel OK, deploy Vercel dev `Ready` (CA3jWS6ZC).
- Descubrimiento: el nombre real de la acción en el reducer es `DEL_BITACORA` (no `DELETE_BITACORA` como decía el HANDOFF anterior). Un solo call site en todo el proyecto. Reducer en `DataContext.jsx:254` filtra por `b.id !== a.payload` — el `b.id` local coincide 1:1 con `legacy_id` en Supabase (porque `postBitacora` retorna `{ ...rows[0], id: legacyId }`).
- Descubrimiento housekeeping: la ruta real del parser Babel es `./node_modules/@babel/parser` (local del proyecto), no `/tmp/babelparse/...` como decía HANDOFF/WORKFLOW. Actualizar el snippet en WORKFLOW.md la próxima sesión.

## Cómo quedó el módulo Bitácora tras esta sesión

| Capa | Estado |
|------|--------|
| Lectura al login | ✅ Supabase |
| Escritura INSERT — 6 handlers en Bitacora.jsx | ✅ Supabase vía helper |
| Escritura INSERT — bulk import Excel en Bitacora.jsx | ✅ Supabase vía helper |
| Escritura INSERT — Diesel.jsx, VistaOperador.jsx, OrdenDia.jsx, DashboardCampo.jsx×2 | ✅ Supabase vía helper |
| Escritura DELETE — botón 🗑 en Bitacora.jsx | ✅ Supabase vía helper (nuevo) |

Módulo bitácora cerrado en escritura. No quedan dispatchs de `ADD_BITACORA` ni `DEL_BITACORA` sin pasar por Supabase.

## Bugs estructurales pendientes

### Bug GENERAL-01: Doble capa de persistencia
Severidad: Alta. `App.jsx` inicializa el reducer desde `localStorage.agroSistemaState`, y `supabaseLoader` escribe encima. Para bitácora ya no hay conflicto (única fuente = Supabase), pero para otros módulos el patrón sigue. Fix completo: dejar de inicializar reducer desde localStorage, usar solo Supabase. 60 min estimados. **Siguiente objetivo natural.**

### Bug DIESEL-01
Manifestación de GENERAL-01 en Diesel. Pendiente hasta fix de GENERAL-01.

## Tabla de pendientes actualizada

| # | Prioridad | Tarea | Tiempo | Categoría |
|---|-----------|-------|--------|-----------|
| 1 | Alta | Fix GENERAL-01 (doble persistencia de raíz) | 60 min | Bug estructural crítico |
| 2 | Media | Fix DIESEL-01 (consecuencia de #1) | 15 min tras #1 | Bug |
| 3 | Media | Merge dev → main cuando #1 esté terminado (o antes, si se decide shippar solo el fix de DELETE) | 10 min | Deploy |
| 4 | Media | Refactor App.jsx — extraer routes | 45 min | Refactor |
| 5 | Media | Asignar productor auto desde lote al cargar tractor | 30 min | Feature Diesel |
| 6 | Media | Cleanup imports huérfanos en Diesel.jsx (SUPABASE_URL/SUPABASE_ANON_KEY — verificar si siguen usándose tras los últimos refactors) | 10 min | Housekeeping |
| 7 | Baja | Corregir ruta del parser Babel en WORKFLOW.md: `./node_modules/@babel/parser` no `/tmp/babelparse/...` | 2 min | Docs |
| 8 | Baja | Actualizar supabase-js (warning httpSend — visible en consola en dev) | 15 min | Infra |
| 9 | Baja | Alertas WhatsApp al socio (resumen semanal) | 2 hrs | Feature |
| 10 | Baja | Dashboard histórico entre ciclos | 3 hrs | Feature |
| 11 | Futuro | DashboardCampo Phase 1 — móvil encargado | 2 hrs | Feature |
| 12 | Futuro | Cosecha Fase 2: boletas → pago banco → cierre | 3 hrs | Cuando llegue cosecha |
| 13 | Futuro | saveFoto: opción de ligar foto a lote/operador | 20 min | Mejora Bitácora |

## Siguiente sesión — recomendación

**Objetivo propuesto: #1 — fix GENERAL-01 (doble capa de persistencia).**

Es el bug estructural de raíz que causa DIESEL-01 y que mitigamos parcialmente para bitácora. Scope: dejar de inicializar el reducer desde `localStorage.agroSistemaState` en `App.jsx`, usar solo Supabase como fuente única. Requiere: entender qué módulos todavía dependen de la hidratación desde localStorage, diseñar el arranque (loading state mientras Supabase carga), migrar capital propio si quedaba pendiente, y smoke test por módulo. 60 min estimados; si el scope crece, partirlo en dos sesiones.

Alternativa más corta si se quiere shippar el fix de DELETE a main antes: ejecutar #3 (merge dev → main) en 10 min, luego arrancar GENERAL-01 en siguiente sesión. Decisión abierta.

Preparación: leer `App.jsx` donde se define el `initState` del reducer, y `supabaseLoader.js` completo para ver qué tablas ya sobreescribe.

## Reglas de trabajo (reforzadas esta sesión)

- Sesiones cortas (30-50 min), un objetivo claro
- Diagnóstico antes que fix
- Ver archivo completo y EXPANDIDO antes de editar
- Un cambio a la vez, con prueba inmediata
- Probar en local primero, luego dev, nunca directo a main
- `clear site data` en local antes de diagnosticar falsos bugs causados por localStorage residual
- Verificar schema Supabase antes de POST/DELETE (`information_schema.columns`)
- Verificar sintaxis con Babel parse después de editar (parser local: `./node_modules/@babel/parser`)
- Commit y push al cierre, siempre
- Nunca importar desde App.jsx en módulos
- Datos reales = tolerancia cero al cambio sin respaldo previo y sin prueba explícita
- `SELECT COUNT(*)` después de un DELETE. "Success, no rows returned" no garantiza que borró filas
- Cuidado con listeners de Supabase: handler con `signOut()` nunca dentro de `onAuthStateChange(SIGNED_OUT)`
- Al migrar un dispatch de reducer a un helper async, verificar si la función contenedora es async. Si no lo es, convertirla antes del edit
- En flujos automáticos o modales rápidos preferir `silent: true`. En captura manual por el usuario, dejar default (`silent: false`) para que vea feedback si falla
- Los extras que no procesa el helper van solo en el dispatch local, no en el payload del helper
- **Nueva (hoy):** para borrados destructivos manuales sobre datos reales, usar patrón **Supabase-first** (bloqueante): `const ok = await deleteX(id); if (ok) dispatch(...)`. Si falla, el registro permanece visible en UI para reintentar. El patrón offline-first (dispatch local + helper silent) es correcto para flujos automáticos, no para borrados manuales del usuario
- **Nueva (hoy):** al añadir funciones DELETE al helper, incluir guard temprano si el id es null/undefined. `DELETE ?columna=eq.null` borraría todas las filas con esa columna NULL — catastrófico
- **Nueva (hoy):** al añadir DELETE con `Prefer: return=representation`, validar `rows.length === 0` para distinguir "no existe en BD" de error HTTP. El primer caso no es fallo de red — usar `console.warn` no `console.error`, y no disparar alert
- **Nueva (hoy):** cuando el HANDOFF mencione un nombre de acción del reducer, validarlo con `grep` antes de confiar. En esta sesión el HANDOFF decía `DELETE_BITACORA` pero el código real usa `DEL_BITACORA` — un grep al inicio evitó ir al sitio equivocado
- **Nueva (hoy):** Claude Code a veces interpreta "haz smoke test" como "compila y ya" cuando el dev server arranca limpio. El smoke test real requiere click-through manual en el navegador con consola abierta. Explicitar los pasos manuales en el prompt
