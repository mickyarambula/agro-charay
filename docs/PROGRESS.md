# AgroSistema Charay — Progress Log

## Sesión 21 Abril 2026 (mediodía — diagnóstico GENERAL-01)

### ✅ Completado
- Merge dev → main ejecutado con tag de respaldo (`backup-pre-merge-20abr2026`). Fix BITACORA-DELETE-01 desplegado a producción (`agro-charay.vercel.app`, commit 92bfe7d). Smoke test en prod: crear + borrar registro bitácora end-to-end OK, consola limpia.
- Diagnóstico completo de GENERAL-01 (sin tocar código): leídos App.jsx (2156 líneas), supabaseLoader.js (420 líneas), DataContext.jsx sección initState (L11–241). Resultado: 52 claves en initState, solo 17 hidratadas desde Supabase (indirectamente vía localStorage, no vía dispatch), 35 viven solo en localStorage, 6 extras en state sin estar en initState.
- Decisión arquitectónica tomada y documentada: migración por fases, NO big-bang. Clasificación en Grupo A (Supabase fuente única, 22 ya + 21 por migrar), Grupo B (config local legítima, 7 claves), Grupo C (requiere decisión de negocio, 6 claves).
- Creado `docs/GENERAL-01-PLAN.md` con plan operacional completo en 3 fases.
- Actualizados `docs/DECISIONS.md` (bloque apuntando al plan) y `docs/HANDOFF.md` (reemplazo total con pendientes reclasificados).
- Commit `514bf2f` en dev.

### 🎓 Lecciones aprendidas
- **El HANDOFF puede subestimar scope.** La estimación "60 min" para GENERAL-01 era optimista por un factor de 3-5x. El fix real requiere 3 fases y múltiples sesiones. Regla nueva: cuando un objetivo del HANDOFF toque estructura, diagnosticar ANTES de comprometerse al tiempo.
- **"Módulos migrados" ≠ "Supabase es fuente única".** Las sesiones previas migraron los INSERT/DELETE de bitácora a helpers Supabase, lo cual es necesario pero NO suficiente: el reducer sigue inicializándose desde localStorage y reescribiéndolo en cada cambio de state. Distinguir nivel de mutación vs nivel de inicialización explícitamente.
- **supabaseLoader NO dispatcha.** Escribe a localStorage y confía en que el próximo mount del `<App/>` lea de ahí. Esto explica por qué cambios en otra sesión no aparecen hasta recargar (bug DIESEL-01).
- **Claude Code puede truncar lecturas a línea 1** por hooks de prior-observations. Fallback legítimo: pedirle explícitamente usar `cat` o `sed -n` como backup cuando el tool dedicado falla.
- **Separar "shippar lo probado" de "arrancar lo grande".** Hacer merge dev → main del fix contenido ANTES de abrir un bug estructural de alto riesgo es un patrón a mantener.

### 📋 Pendientes al cierre
Ver `docs/HANDOFF.md` y `docs/GENERAL-01-PLAN.md`. Próximo objetivo: Fase 1 de GENERAL-01 (60-90 min).

## Sesión 20 Abril 2026 (noche tardía — fix DELETE)

### ✅ Completado
Fix bug BITACORA-DELETE-01. El botón 🗑 de Bitácora ya envía DELETE a Supabase.
- Añadido `deleteBitacora(legacyId, { silent })` en `src/core/supabaseWriters.js` siguiendo el patrón de `postBitacora` (mismos headers, prefijo `[Bitacora]`, opción silent). Retorno booleano, guard early si legacyId null, distingue "no existe en BD" (warn) de error HTTP (error + alert).
- Migrado handler del botón 🗑 en `Bitacora.jsx:489` (único call site en todo el proyecto) a patrón Supabase-first: `await deleteBitacora(b.id)` → si `true`, dispatch `DEL_BITACORA` local. Si falla, registro permanece en UI.
- Smoke test verificado end-to-end (local + dev URL): crear 1 registro (legacy_id=1776747262747) → clic 🗑 → UI "Sin registros" → `SELECT COUNT(*)`=0. Consola sin errores.
- Commit 3ee9b59 en dev, deploy Vercel Ready (CA3jWS6ZC), tabla `bitacora_trabajos` en 0 al cierre.
- Módulo bitácora: 100% migrado a Supabase en INSERT y DELETE. Fin de la migración del módulo.

### 🎓 Lecciones aprendidas
- **Supabase-first vs offline-first según tipo de acción**: borrados destructivos manuales sobre datos reales merecen patrón bloqueante (`if (ok) dispatch`), no offline-first silencioso. El usuario necesita saber si el DELETE llegó. Offline-first sigue siendo correcto para flujos automáticos (espejo diesel, finalizar orden, modales rápidos).
- **DELETE con guards obligatorios**: `DELETE ?columna=eq.null` sin guard borraría todas las filas con esa columna NULL. Early return si el id es null/undefined es no-negociable en helpers de DELETE.
- **"Success no rows returned" ≠ borró**: usar `Prefer: return=representation` + `rows.length === 0` para distinguir "id inexistente" (warn) de error HTTP (error). El primero no es fallo de red y no debe disparar alert.
- **Validar nombres del reducer con grep antes de migrar**: el HANDOFF previo decía `DELETE_BITACORA`, el código real usaba `DEL_BITACORA`. Un `grep -rn` al inicio evitó 5 minutos de búsqueda vacía.
- **"Smoke test" en Claude Code ≠ smoke test real**: cuando el dev server arranca limpio Claude Code tiende a declarar victoria. El smoke test real requiere pasos manuales en el navegador con consola abierta. Explicitar cada clic en el prompt.
- **Ruta del parser Babel**: la ruta real en este proyecto es `./node_modules/@babel/parser`, no `/tmp/babelparse/...` como decía la documentación. Pendiente corregir WORKFLOW.md.

### 📋 Pendientes al cierre
Ver docs/HANDOFF.md. Siguiente objetivo propuesto: Bug GENERAL-01 (doble capa de persistencia) — bug estructural de raíz que afecta todos los módulos que aún dependen de localStorage.

## Sesión 20 Abril 2026 (noche tardía — 5 sitios externos)

### ✅ Completado

Migración de los 5 sitios externos que escribían bitácora solo al reducer local sin persistir a Supabase, usando el helper `postBitacora` ya extraído en sesión anterior.

- **Diesel.jsx** (L194): espejo bitácora tras salida_interna ahora pasa por helper.
- **VistaOperador.jsx** (L39): `finalizarTrabajo` convertida a async, ahora persiste a Supabase. Gap resuelto: añadido `loteIds: orden.loteId ? [orden.loteId] : []` al payload (antes faltaba y habría causado que los registros aparecieran "sin lote" al filtrar por array).
- **OrdenDia.jsx** (L432): `marcarCompletada` convertida a async, ahora persiste a Supabase (ya tenía `loteIds` correcto).
- **DashboardCampo.jsx** (L102, L122): `guardarTrabajo` y `guardarDiesel` convertidas a async y migradas.

Patrón aplicado en los 5: `await postBitacora(bitacoraPayload, state.cicloActivoId, { silent: true })` + dispatch local con `id: saved?.id || Date.now()`. Offline-first: dispatch local ocurre siempre, aunque Supabase falle.

Los extras que no van al helper (origen, ordenId, foto, cantidad, unidad) se mueven al dispatch local, NO al helper.

Smoke test: carga real de diesel desde UI (Diesel y Combustible → Registrar carga de tractor → 50L en T-1) creó fila correcta en `bitacora_trabajos` (tipo='diesel', fuente='bitacora', ciclo_id='1'). Cleanup al cierre: tabla en 0 filas.

Commit: **9b615c4** (`refactor(bitacora): migrar 5 sitios externos a postBitacora helper` — 4 files, +52/−23).

### 🎓 Lecciones aprendidas

- Migrar un dispatch local a helper async requiere convertir la función contenedora a async primero — olvidarlo rompe el Babel parse.
- Cuando un payload de bitácora tenga `loteId` pero no `loteIds`, el helper enviará `lote_ids: []` por default. Si la UI filtra por array, el registro aparecerá "sin lote" tras migrar — añadir `loteIds` derivado preventivamente.
- Flujos automáticos y modales rápidos se benefician de `silent: true` en el helper; reservar el alert default (`silent: false`) para captura manual explícita.
- El paso previo de diagnóstico de payloads contra el contrato del helper (tabla cobertura 10/10) evita sorpresas en runtime — detectamos el gap de loteIds antes de editar, no después.

### 📋 Pendientes al cierre

Ver HANDOFF.md para tabla actualizada. Siguiente objetivo recomendado: Fix BITACORA-DELETE-01 (20 min).

## Sesión 20 Abril 2026 (noche — extracción postBitacora + bulk import)

### ✅ Completado
- Extracción del helper `postBitacora` a `src/core/supabaseWriters.js`. Firma: `postBitacora(payload, cicloActivoId, { silent = false } = {})`. Modo silent evita N alerts en bulk import.
- Refactor `src/modules/Bitacora.jsx`:
  - Import del helper desde `../core/supabaseWriters.js`
  - Helper local eliminado (43 líneas)
  - Imports huérfanos `SUPABASE_URL` y `SUPABASE_ANON_KEY` eliminados
  - 6 handlers manuales (saveInsumo, saveDiesel, saveRiego, saveFenol, saveReporte, saveFoto) ahora llaman `postBitacora(payload, state.cicloActivoId)`
  - Bulk import Excel (línea 223) migrado con `Promise.all` + `silent:true`. Contador `failedBulk` separado de `ok` para distinguir fallos de parseo vs de persistencia.
- Commit: e6b3554 (neto −31 líneas en Bitacora.jsx).
- Smoke test manual: 2 Reportes Diarios creados desde UI → persistidos en `bitacora_trabajos` → visibles tras F5 → deploy dev verificado.

### 🎓 Lecciones aprendidas
- **El HANDOFF anterior subcontaba el scope pendiente.** Decía "queda un flujo (bulk import)"; el `grep` reveló 6 puntos en 5 archivos. Lección: no confiar en diagnósticos rápidos para estimar scope. Un `grep -rn "ADD_BITACORA"` al inicio del diagnóstico habría calibrado expectativas desde el principio.
- **"Success. No rows returned" en SQL no significa "filas borradas".** Significa "la query se ejecutó sin error". Si el WHERE no matcheó nada, sale el mismo mensaje. Siempre `SELECT COUNT(*)` después de un DELETE para confirmar.
- **`NULL LIKE '%x%'` es NULL, no TRUE**. Las filas de prueba tenían `notas = NULL` porque el contenido del Reporte Diario se guarda en la columna `data` (jsonb), no en `notas`. Los LIKE nunca las tocaron. Si una columna puede ser NULL, usar `WHERE notas IS NOT NULL AND notas LIKE '%x%'` o identificar por PK/legacy_id.
- **Descubrimiento nuevo durante smoke test: DELETE de bitácora desde UI no va a Supabase.** Preexistente, no introducido hoy. Documentado como BITACORA-DELETE-01 en HANDOFF.
- **Scope B estricto funciona.** Las tentaciones de "ya que estamos, migremos los otros 5" aparecieron 3 veces en la sesión (al ver el diagnóstico, en la propuesta del plan de `supabaseWriters.js`, al cierre del smoke test). Mantener el scope dio un commit limpio, coherente, con smoke test representativo.

### 📋 Pendientes al cierre
Ver HANDOFF.md — tabla de pendientes. Siguiente sesión recomendada: #1 (migrar los 5 sitios externos) + opcional #2 (fix DELETE) si sobra tiempo.

## Sesión 20 Abril 2026 (tarde — tercera de la tarde)

### ✅ Completado
- **Migración de LECTURA de bitácora a Supabase (#1 del HANDOFF).** Añadido fetch de `bitacora_trabajos` al `Promise.all` de `supabaseLoader.js`, replicando el patrón de `capital_movimientos`. Tres cambios atómicos en `src/supabaseLoader.js`:
  1. `bitacoraRows` añadido al destructuring + `supaFetch('bitacora_trabajos', 'order=fecha.desc')` al array de promesas con `.catch` defensivo.
  2. Línea `bitacora: estadoExistente.bitacora || []` eliminada de `configPreservada` — reemplazada por comentario explicativo.
  3. Mapper `const bitacora = (bitacoraRows || []).map(...)` con prioridad `lote_ids` (jsonb array) + fallback a `lote_id` (text único). Incluido en `estadoNuevo` entre `inventario,` y `usuariosDB:`.
- Commit: feat(bitacora): migrar lectura a Supabase (fuera de localStorage)
- Verificación end-to-end: registro de prueba creado en UI → aparece en Supabase con schema correcto (`tipo: insumo, fuente: bitacora, lote_ids: [1], data: {dosis: ".350"...}`) → sobrevive reload (viene de Supabase, no localStorage) → deploy a dev confirmado desde incógnito.
- **Resultado:** los 6 registros fantasma que persistían en localStorage desaparecen de la UI al cargar desde Supabase (que ya estaba vacío). GENERAL-01 parcialmente mitigado para el módulo bitácora.

### 🎓 Lección aprendida
**`localStorage` sucio de sesiones previas puede hacer que un cambio correcto se vea como roto.** En la primera recarga local tras el cambio, el dashboard apareció en ceros (0 ha, 0 productores) aunque el log decía `Cargado: {productores: 18, lotes: 107...}`. La causa: localStorage contenía datos residuales de sesiones anteriores que el merge con `configPreservada` estaba arrastrando. Un `clear site data` + reload resolvió todo. Implicación para producción: al desplegar este cambio, cualquier usuario con la app previamente abierta puede necesitar un login limpio o clear de sitio para que el localStorage viejo deje de interferir. No es un bug del cambio — es residuo del esquema de doble persistencia (GENERAL-01) que seguiremos atacando.

### 📋 Pendientes al cierre
Ver HANDOFF.md actualizado.

## Sesión 20 Abril 2026 (tarde — diagnóstico)

### ✅ Completado
- Diagnóstico exhaustivo de persistencia en Chrome desktop vs agro-charay-dev.vercel.app
- Mapeadas las capas reales del PWA: SW, Cache Storage, IndexedDB, localStorage, session storage
- **GENERAL-03 retirado como bug separado** — confirmado que es una manifestación de GENERAL-01
- Mapa final de persistencia documentado en HANDOFF.md con estado de cada capa
- Cero cambios de código (sesión disciplinada a solo diagnóstico, como se planeó)

### 🎓 Lección aprendida
Las "sorpresas de persistencia" pueden venir de una capa conocida comportándose raro, no necesariamente de una nueva capa. Antes de teorizar sobre "tercera capa PWA/SW/IndexedDB", verificar con DevTools qué contiene cada una. En este caso: Cache Storage solo tenía assets (37 entries JS/HTML, cero supabase), IndexedDB ni siquiera existía ("No indexedDB detected"), y los 6 registros fantasma vivían simplemente en localStorage — la capa que ya sabíamos que existe. La hipótesis original de "tercera capa" era especulativa; el diagnóstico real tomó 15 minutos y descartó toda la teoría.

Segunda lección: la disciplina de "solo diagnóstico" funcionó. A mitad de sesión apareció la tentación de "ya que sabemos, arreglemos" — se resistió y se difirió GENERAL-01 a sesión propia con presupuesto adecuado. Un bug por sesión.

### 📋 Pendientes al cierre
Ver HANDOFF.md. Próxima sesión recomendada: #1 de la tabla (migrar LECTURA de bitácora a supabaseLoader.js).

## Sesión 20 Abril 2026 (noche — lectura bitácora)

### ✅ Completado

**Testing de los 4 handlers restantes de Bitácora en dev**

Los 4 flujos no probados en la sesión anterior (saveInsumo, saveDiesel, saveFenol, saveFoto) verificados en agro-charay-dev.vercel.app:

| Handler | POST | Fila en Supabase | data JSONB |
|---------|------|------------------|------------|
| saveInsumo | 201 ✅ | insumo / Ramón Lugo / lote 8 / maq 3 | `{"dosis":".300",...}` |
| saveDiesel | 201 ✅ | diesel / Renato Urías / lote 16 / maq 1 | `{"litros":50,"ac...}` |
| saveFenol | 201 ✅ | fenol / Manuel Quintero / lote 39 / maq 4 | `{"fenologia":"Ve...}` |
| saveFoto | 201 ✅ | foto / NULLs (diseño) | `{"descripcion":"...}` |

Método: registros con valores mínimos desde la UI, Preserve log activo en DevTools Network, verificación final con un SELECT único a bitacora_trabajos filtrado por timestamp de la sesión. Los 4 registros de prueba fueron limpiados con DELETE al cierre.

Observación del handler saveFoto: deja lote_id, operador y maquinaria_id en NULL. Es consistente con el diseño actual (foto como comprobante suelto, no atado a lote). Queda anotado en pendientes como mejora futura por si se decide ligar.

Sin cambios de código esta sesión. Sin commit de código, solo docs de cierre.

### 🎓 Lección aprendida

Cuando varios handlers comparten la misma estructura (en este caso postBitacora() con payloads distintos), el testing en lote con verificación SQL final es más eficiente que probar uno a uno con SQL entre cada uno. Requisito: Preserve log activo en DevTools, y un SELECT con rango de timestamp acotado para que aparezcan todas las filas del lote en una sola captura.

Anti-patrón a evitar: correr el SELECT de verificación antes de terminar todos los POSTs del lote. Pasó una vez en esta sesión (solo salió 1 fila en vez de 4 esperadas) porque la query se lanzó prematuramente. No es error de código, es de secuencia de pasos.

### 🎓 Lección aprendida adicional (post-commit fb32dc8)

Al intentar limpiar los 4 registros de prueba al cierre, descubrimos que después de
(a) `DELETE FROM bitacora_trabajos` en Supabase (verificado 0 filas), y
(b) vaciar `state.bitacora = []` dentro de `localStorage.agroSistemaState` (verificado con console.log antes/después),
la UI SEGUÍA mostrando los 6 registros tras un reload completo.

Esto reveló un bug estructural nuevo — documentado como **GENERAL-03** en HANDOFF.md: hay una tercera capa de persistencia (presumiblemente Service Worker del PWA y/o IndexedDB) que no se está invalidando. Implica que actualmente existen TRES fuentes de datos en paralelo, no dos como asumimos.

Decisión: parar la limpieza, NO improvisar más parches, documentar y cerrar sesión. Se agregó #4 al plan: diagnóstico GENERAL-03 con mapeo de SW + IndexedDB + Cache Storage antes de cualquier acción. También se añadió una regla nueva al WORKFLOW: si una limpieza simple no produce el efecto esperado, parar de inmediato.

### 📋 Pendientes al cierre de sesión
Ver `docs/HANDOFF.md`. Próximo: migrar LECTURA de Bitácora a supabaseLoader.js (#1 del HANDOFF).

## Sesión 20 Abril 2026 (tarde)

### ✅ Completado

**Migración de ESCRITURA de Bitácora a Supabase**

Bug a resolver: los registros de bitácora de trabajos vivían solo en localStorage del navegador. Si el encargado capturaba en campo, nadie más podía verlos. Si borraba caché, se perdía todo.

Cambios:
- Tabla `bitacora_trabajos` creada en Supabase: 16 columnas (id uuid, legacy_id, tipo, lote_id, lote_ids jsonb, fecha, operador, operador_id, maquinaria_id, horas, notas, data jsonb, fuente, ciclo_id, created_at, updated_at) + 5 índices + trigger updated_at + 8 políticas RLS (4 para authenticated, 4 para anon consistente con capital_movimientos)
- Decisión de diseño: NO se incluyó columna `foto` — las fotos base64 quedan solo en estado local por ahora (migrar a Supabase Storage es tarea futura)
- Bitacora.jsx modificado: import de SUPABASE_URL/KEY, helper postBitacora() con legacy_id+ciclo_id, 6 guards savingX anti doble-click, los 6 handlers (saveInsumo, saveDiesel, saveRiego, saveFenol, saveReporte, saveFoto) reescritos a async con POST previo al dispatch local
- Si el POST falla → NO hay dispatch local → UI consistente con DB (no zombie data)
- Bulk import Excel (7° flujo) NO migrado — queda para sesión separada con testing propio

Commits:
- e4b0df7 docs(handoff): sync con estado real post GENERAL-02
- 90faaf3 feat(bitacora): POST a Supabase antes del dispatch local

Probado en dev.vercel.app:
- saveReporte → status 201 + fila en Supabase ✅
- saveRiego → status 201 + fila en Supabase ✅
- Los otros 4 handlers (insumo, diesel, fenol, foto) no fueron probados — tienen estructura idéntica, se verificarán en sesión siguiente

NO tocado:
- supabaseLoader.js (la lectura sigue por localStorage) — migrar en sesión siguiente

### 🎓 Lecciones aprendidas

**Primera, sobre documentación:** empecé la sesión creyendo que GENERAL-02 estaba pendiente (lo decía HANDOFF.md) cuando en realidad ya estaba resuelto (lo decía PROGRESS.md). La inconsistencia se coló porque cerré la sesión anterior regenerando HANDOFF.md desde el estado inicial del chat, no desde el estado real al final del día. Regla nueva: si hubo varios cambios de estado durante el día, releer el HANDOFF más reciente antes de regenerarlo.

**Segunda, sobre RLS de Supabase:** la tabla nueva se creó solo con policies para `authenticated`, pero el código (patrón heredado de Capital) hace POST con la anon key. Resultado: 401 en el primer intento. Fix: agregar policies espejo para rol `anon`. A futuro todo el sistema debería migrar a JWT de usuario + policies basadas en el usuario logueado, pero eso es refactor grande — por ahora mantener consistencia con capital_movimientos.

**Tercera, sobre trabajar con datos reales:** a la mitad de la sesión pausé para reafirmar reglas antes de tocar supabaseLoader.js (que carga TODO el state inicial). Decisión: dividir la migración en dos fases — ESCRITURA ahora (bajo riesgo, solo agrega datos nuevos), LECTURA en sesión separada (alto riesgo, cambia cómo arranca la app). Mejor dos sesiones de 30 min con deploys verificados que una sesión de 60 min sin red de seguridad.

### 📋 Pendientes al cierre de sesión
Ver `docs/HANDOFF.md`. Próximo: probar los 4 handlers restantes de Bitácora en dev, luego migrar LECTURA a supabaseLoader.js.

## Sesión 20 Abril 2026 (AM)

### ✅ Completado

**Fix GENERAL-02: reducers preservan payload.id**
- Bug: patrón `{ ...a.payload, id: Date.now() }` en 26 reducers pisaba el id del payload con un timestamp nuevo, rompiendo correlación local↔Supabase cuando los componentes mandan legacy_id ya asignado después del POST
- Fix aplicado: cambiar a `id: a.payload.id ?? Date.now()` en 26 casos
- Reducers arreglados: ADD_LOTE, ADD_TRABAJO, ADD_BITACORA, ADD_INSUMO, ADD_DIESEL, ADD_GASTO, ADD_MAQ, ADD_HORAS, ADD_OPER, ADD_ASISTENCIA, ADD_PAGO_SEM, ADD_MINISTRACION, ADD_PAGO_CREDITO, ADD_ACTIVO, ADD_RENTA, ADD_CRED_REF, ADD_APORTACION, ADD_RETIRO, ADD_PERSONAL, ADD_CUADRILLA, ADD_FLETE, ADD_MAQUILA, ADD_SECADO, ADD_PRODUCTOR, RECIBIR_INSUMO (recepciones), RECIBIR_DIESEL (recepciones)
- Líneas 275 y 301 intactas: son movimientos de inventario auto-generados por el reducer, no vienen del payload
- Commits: eae6d0e (fix) + 70bf11b (trigger redeploy)
- Deploy productivo: dpl_v1mip2zCrrU4MatRdoVdD8RuhLZT READY

**Infraestructura**
- Integración Vercel↔GitHub estaba desconectada desde hace días. Reconectada durante la sesión. Por eso los pushes desde 16-abril no disparaban deploys.

### 📋 Pendientes al cierre

Sin cambios mayores respecto a sesión anterior. Nuevo ítem menor:
- Considerar cleanup de sessionStorage/localStorage al logout. Síntoma observado: login con admin cargó vista de operador por sesión pegada de usuario `campo` en localStorage. Fix temporal: Clear Storage manual desde DevTools.

### 📝 Aprendizaje

- Anti-pattern: `{ ...payload, id: Date.now() }` en reducers que reciben datos post-Supabase. Usar siempre `id: payload.id ?? Date.now()`.
- sed con delimitador simple no captura casos con props trailing (ej: `id: Date.now(), estatus:...`). Segundo pase requerido.

---

## Sesión 20 Abril 2026 (mediodía)

### ✅ Completado

**Fix: Cleanup completo de storage en logout**

Bug observado en producción: al hacer logout de un usuario (ej: `campo`) y loguear después como otro (ej: `admin`), la app cargaba vista del rol anterior por sesión pegada en localStorage. Los 3 handlers de logout inline (topbar ⏏, VistaOperador onLogout, listener onAuthStateChange) solo limpiaban `agro_session` y dejaban intacto el resto del localStorage + sessionStorage + token Supabase.

Cambios:
- Nuevo helper `handleLogout` unificado en App.jsx (línea 1655 aprox)
- Limpia selectivamente localStorage con prefijos: `agro_`, `agroSistema`, `sb-`, `supabase.auth`
- `sessionStorage.clear()` (solo usamos `agroLoginUser` como bridge, seguro borrar todo)
- `supabase.auth.signOut()` con catch no bloqueante
- `setUsuario(null)` al final para forzar render del login
- Reemplazados los 3 call sites duplicados por llamadas a `handleLogout`
- Listener `onAuthStateChange` ahora solo hace `setUsuario(null)` en SIGNED_OUT (NO `handleLogout` — causaba loop porque `handleLogout` llama `signOut()` → Supabase re-emite SIGNED_OUT → loop → pantalla en blanco)

Commit: d806aa2

### 🎓 Lección aprendida

Al arreglar un bug de logout, el fix inicial (llamar `handleLogout` desde el listener de `onAuthStateChange`) causó pantalla en blanco al clic ⏏. Root cause: `handleLogout` llama `signOut()`, que dispara otro SIGNED_OUT, que volvía a llamar `handleLogout` — loop. Regla: **un handler que llama `signOut()` no puede vivir dentro del propio `onAuthStateChange` de SIGNED_OUT**. El listener de SIGNED_OUT solo debe reaccionar a señales externas (token expirado por Supabase, logout desde otra pestaña) limpiando el estado local sin volver a llamar signOut.

### 📋 Pendientes al cierre de sesión
Ver `docs/HANDOFF.md` para tabla actualizada. Próxima sesión recomendada: Fix GENERAL-02 (reducer pisa id con Date.now()).

---

## Sesión 20 Abril 2026 (mañana)

### ✅ Completado

**Migración de Capital Propio a Supabase**
- Tabla `capital_movimientos` en Supabase (schema: id uuid, legacy_id bigint, signo +1/-1, monto numeric, fecha, concepto, socio, notas, timestamps)
- supabaseLoader.js: agregado fetch de capital_movimientos al Promise.all paralelo, mapeo a formato {aportaciones, retiros}
- Capital.jsx: saveA/saveR ahora hacen POST directo a Supabase antes del dispatch local
- Fix bonus: guards savingA/savingR + botones con disabled + texto "Guardando..." para prevenir inserts duplicados por doble-click
- Commit: 3b2d789

**Bugs descubiertos durante la migración (documentados para próximas sesiones)**
- Bug GENERAL-01: doble capa de persistencia (localStorage + Supabase) causa zombie data — el flujo actual carga primero de localStorage y luego "refresca" desde Supabase, pero el reducer ya quedó con datos viejos. Afecta a todos los módulos migrados.
- Bug GENERAL-02: reducer sobreescribe id con Date.now() en ADD_APORTACION/ADD_RETIRO (DataContext.jsx:444/446), descorrelacionando el local vs el UUID de Supabase.
- Bug DIESEL-01 (ya conocido): mismo patrón — doble fuente de datos causa cancelación fantasma.

### 🎓 Lección aprendida
Las migraciones parciales revelan el bug estructural más grande del proyecto: **el modelo híbrido localStorage+Supabase no es sostenible**. Cada módulo migrado lo manifiesta. Solución definitiva (próximas sesiones): eliminar localStorage como fuente de datos operativos, dejarlo solo como cache temporal de UI.

---

## Sesión 19 Abril 2026 (noche)

### ✅ Completado
- Kit de documentación copiado a `/docs` y commiteado en dev (commit 8c7d56b)
- Fix crash React #31 en Dashboard: `{widgetCBOT}` se parseaba como object literal shorthand en la rama `!isMobile` del ternario. Resuelto envolviendo en fragment: `<>{widgetCBOT}</>`
- Fix fallbacks faltantes en App.jsx: los casos `configuracion` (rol no admin) y `default` del switch de renderPage renderizaban `<Dashboard>` sin la prop `widgetCBOT`. Agregada la prop a ambos
- Fix TDZ en Diesel.jsx: `maqConsumos` (línea 37) usaba `localConsumos` antes de su declaración (línea 46). Movido el bloque después de las declaraciones useState
- Commit de los 3 fixes: c7004a3 (pusheado a dev)
- Dashboard y módulo Diesel cargan correctamente con datos reales (18 productores, 107 lotes, 212 egresos, $23M costo total)
- Calculadora L/ha verificada en vivo: 6.9 ha × 10 L/ha = 69 L correcto (bug del HANDOFF original resuelto implícitamente por el fix de TDZ)
- Warning React key=null en Diesel.jsx:411 resuelto con fallback `diesel-${idx}`
- Bug DIESEL-01 diagnosticado (doble fuente de datos en historial — causa síntomas de cancelación fantasma y saldo visual incorrecto). Detalle técnico completo documentado en HANDOFF.md

### 📋 Pendientes al cierre de sesión
Ver `docs/HANDOFF.md` para tabla actualizada.

---

## Sesión 16-17 Abril 2026

### ✅ Completado

**Autenticación y sesión**
- Supabase Auth con JWT persistente (persistSession: true)
- 7 usuarios creados en auth.users con emails sintéticos @agro-charay.local
- Login verifica contraseña directo en Supabase (no localStorage)
- Sesión persiste entre recargas y cierre de browser
- Gestión de contraseñas desde Configuración → admin (PATCH a tabla usuarios)

**Persistencia de datos**
- Maquinaria, operadores, inventario migrados de localStorage a Supabase
- Ciclos nuevos y cierre de ciclos persisten en Supabase
- configPreservada limpia — solo quedan en localStorage: capital, cosecha, bitácora
- Export/Respaldo Excel: botón 📥 para admin y daniela (5 hojas: Resumen, Dispersiones, Egresos, Insumos, Diesel)

**Módulo Diesel**
- Cilindro 10,000L con validación de capacidad
- Modal detalle al hacer clic en cualquier registro del historial
- Cancelación por rol: encargado (propios del mismo día), admin (cualquiera)
- POST completo a Supabase: operador, tractor, lote, tipo labor, registrado_por
- Calculadora L/ha: campos tipo labor + hectáreas en modal de carga
- UI consumos L/ha en Configuración → Maquinaria (botón ⛽)
- Tabla maquinaria_consumos con constraint UNIQUE(maquinaria_id, tipo_labor)
- 7 consumos configurados para T-1 (10 L/ha todas las labores)
- Realtime: saldo del cilindro en tiempo real entre dispositivos

**Módulo Caja Chica**
- Fondo variable, foto ticket opcional, aprobación admin
- Realtime entre admin y encargado (Postgres Changes)
- Fondo activo: $5,000 MXN

**Finanzas**
- Balance General: NaN corregido
- Estado de Resultados: semilla separada, sumas cuadran
- Flujo de Efectivo: entradas reales $21.1M, pendientes desglosados
- Panel Contable Daniela: 3 tabs (resumen ciclo, estado por productor, movimientos)
- Análisis de Costos: desglose por categoría y productor

**CBOT y mercado**
- Links a Barchart (ZCN26 — Julio 2026) y Banxico
- Badge de vigencia del precio (verde/amarillo/rojo)
- fechaPrecio persiste en state entre sesiones

**Solicitudes y Flujos**
- Encargado puede registrar reembolsos igual que socio
- Flujo completo: solicitud → aprobación → egreso automático

**Infraestructura**
- ErrorBoundary global: crashes reportados a tabla error_logs en Supabase
- Monitor de errores en Configuración (solo admin)
- PWA con icono de espiga de trigo

---

### ❌ Crash activo al momento del handoff

**React error #31 — objeto renderizado como componente**

Root cause: Al eliminar imports circulares de App.jsx, `WidgetCBOTDashboard` fue convertido en prop del componente Dashboard. Pero hay al menos una ocurrencia en App.jsx donde `<Dashboard>` se renderiza sin la prop `widgetCBOT`. Esto hace que el componente reciba `undefined` donde espera un elemento React.

Fix: buscar todas las ocurrencias de `<Dashboard` en App.jsx y asegurar que TODAS tengan `widgetCBOT={<WidgetCBOTDashboard />}`.

Commit donde ocurrió: f82c638 — "fix: eliminar TODOS los imports circulares de App.jsx en módulos"

---

### 📋 Pendientes al cierre de sesión

**Urgente**
- [ ] Fix crash React error #31 (ver arriba)
- [ ] Bug calculadora diesel: "Sin consumo configurado" aunque hay datos en maquinaria_consumos. Fix: fetch directo a Supabase al abrir modal, no depender del state global.

**Diesel**
- [ ] Asignar productor automático desde el lote al cargar tractor
- [ ] Edición de campos para admin (litros, notas) en modal detalle

**Migración a Supabase**
- [ ] Bitácora de Trabajos (hoy en localStorage)
- [ ] Capital propio — aportaciones y retiros (hoy en localStorage)

**Campo**
- [ ] Modo offline: IndexedDB + cola de sync (probado en campo — no funciona sin internet)
- [ ] DashboardCampo Phase 1 — vista móvil encargado

**Finanzas**
- [ ] Balance General: capital propio vacío (sin aportaciones registradas)
- [ ] Alertas WhatsApp al socio (resumen semanal)

**Cosecha (cuando llegue)**
- [ ] Fase 2: boletas reales → pago banco → cierre de ciclo

---

## Sesiones anteriores (resumen)

### Antes de Abril 2026
- Sistema base con módulos principales
- Datos reales del ciclo OI 2025-2026 cargados a Supabase
- 17 productores, 107 lotes, 148 dispersiones, 212 egresos

---

## Números clave del ciclo OI 2025-2026
| Concepto | Valor |
|----------|-------|
| Hectáreas | 455.88 ha |
| Productores | 17 |
| Lotes | 107 |
| Capital parafinanciero | $16,462,543 MXN |
| Capital directo | $4,700,000 MXN |
| Total aplicado | $21,162,543 MXN |
| Intereses acumulados | $957,231 MXN |
| Comisiones | $864,948 MXN |
| **Total a liquidar** | **$22,984,723 MXN** |
| Diesel comprado | 37,000 L |
| Saldo cilindro | 600 L |
