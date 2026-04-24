# AgroSistema Charay — Progress Log

## Sesión 24 Abril 2026 (tarde — sesión 3)

### ✅ Completado
- **Merge fix diesel a main**: mensaje mejorado de calculadora en producción.
- **Consumos provisionales**: insertadas 28 filas en maquinaria_consumos para T-2, T-4, T-6, Aspersora T-8 (7 labores × 4 tractores, valores copiados de T-1). Calculadora diesel ahora operativa para todos los equipos.
- **Actualización supabase-js**: 2.103.0 → 2.104.1. Build OK. Warning httpSend pendiente de verificar en dev.
- **Limpieza dead code en App.jsx**: eliminado helper restore muerto (8 líneas), 5 comentarios stale de migración GENERAL-01, lectura muerta de cosecha desde localStorage, header stale en PERSIST_KEYS. −23 líneas netas, cero cambio de comportamiento. Babel parse OK.

### 📋 Pendientes al cierre
Ver HANDOFF.md — merge limpieza a main, encargado ajustar consumos reales, migrar PATCH OrdenDia.

## Sesión 24 Abril 2026 (mediodía — sesión 2)

### ✅ Completado
- **Smoke test GENERAL-01 Fase 3**: probados los 5 módulos afectados (alertas, crédito params, costos/precio, ciclos/cultivos, crédito límites por productor). Los 5 pasaron — datos persisten tras recarga.
- **Merge GENERAL-01 a main**: tag backup-pre-merge-24abr2026-general01 creado, merge exitoso, producción estable en agro-charay.vercel.app.
- **Diagnóstico calculadora diesel**: no era bug de código. El fetch directo a maquinaria_consumos funciona correctamente (status 200, datos llegan). El problema es que solo Tractor T-1 tiene consumos configurados — los otros 4 tractores no tienen filas en la tabla. "Sin consumo configurado" es comportamiento correcto, no un bug.
- **Mejora UI mensaje calculadora**: mensaje ahora muestra nombre del tractor + tipo de labor + indicación clara de configurar en Maquinaria → ⛽. Estilo cambiado de gris neutro a ámbar warning. Commit: fix(diesel): mejorar mensaje calculadora sin consumo configurado.

### 🎓 Lección aprendida
- **Diagnosticar datos antes de asumir bug de código**: el "bug" de la calculadora diesel resultó ser datos faltantes, no un problema de lógica. La verificación con DevTools Network + query directa a Supabase confirmó que el código funcionaba correctamente. Regla nueva agregada a HANDOFF.

### 📋 Pendientes al cierre
Ver HANDOFF.md — merge fix diesel a main, configurar consumos para 4 tractores restantes.

## Sesión 24 Abril 2026 (mañana → mediodía, extendida)

**Sesión maratónica — GENERAL-01 cerrado completo.**

### ✅ Completado

**Fix #1 — Órdenes DashboardCampo no visibles en OrdenDia (timezone bug)**
- Root cause: toISOString() devuelve fecha UTC, rueda al día siguiente después de 18:00 MST.
- Fix: getFullYear()/getMonth()/getDate() — fecha local.

**Fix #2 — Chips de lotes duplicados en multi-select**
- Formato ahora "{apodo} {folioCorto} — {productor}" para desambiguar.

**Merge DashboardCampo Phase 2 a main** — 394cea3, validado en producción.

**GENERAL-01 Fase 1** — confirmada completada (5 tareas implementadas incrementalmente).

**Refactor OrdenDia** — eliminado GET inline con SUPA_URL2/SUPA_KEY2 hardcodeados. -50 líneas.

**GENERAL-01 Fase 2** — decisiones: las 5 claves config temporal son datos de negocio → todas a Supabase.

**GENERAL-01 Fase 3.1 — cultivosCatalogo**
- Tabla poblada con 6 registros (corregidos post-insert para coincidir con initState original).
- Loader, 3 writers, 3 call sites en Ciclos.jsx migrados. initState vaciado.

**GENERAL-01 Fase 3.2 — alertaParams + creditoParams**
- Singletons en tabla `configuracion` (key-value jsonb). 2 filas insertadas.
- Loader con configMap. upsertConfiguracion helper. Call sites en Configuracion.jsx y Credito.jsx.

**GENERAL-01 Fase 3.3 — paramsCultivo**
- Tabla nueva `params_cultivo` con UNIQUE (ciclo_id, cultivo_id, variedad).
- Loader reconstruye map compuesto. upsertParamsCultivo helper. Call sites en Costos.jsx y App.jsx.

**GENERAL-01 Fase 3.4 — creditoLimites**
- Tabla nueva `credito_limites` con UNIQUE (productor_id).
- Loader reconstruye map por productor. upsertCreditoLimites helper. Call sites en Configuracion.jsx con onBlur.

**Limpieza PERSIST_KEYS**: las 5 claves config temporal eliminadas. Solo quedan Grupo B (UI prefs) + permisos/roles.

### 🎓 Lecciones aprendidas

1. **toISOString() peligroso para fechas locales en México** — usar getFullYear/getMonth/getDate.
2. **Verificar antes de implementar** — GENERAL-01 Fase 1 ya estaba hecha.
3. **uuid client-side con crypto.randomUUID()** — reducer y Supabase comparten identidad.
4. **onBlur para upserts en inputs** — dispatch onChange (UI reactiva) + upsert onBlur (1 escritura).
5. **UNIQUE constraints antes de on_conflict** — sin constraint el upsert silenciosamente inserta duplicados.
6. **Verificar datos seed contra initState original** — las variedades de cultivosCatalogo no coincidían.

### 📋 Pendientes al cierre
Ver HANDOFF.md — smoke test + merge a main, luego bug calculadora diesel.

## Sesión 23 Abril 2026 (noche)

### ✅ Completado
- **DashboardCampo Phase 2**: botón "🚜 Nueva orden" para encargado/admin. BottomSheet con form (operador, tractor, tipo, lotes multi-select, descripción, urgente).
- **Flujo Supabase-first**: `crypto.randomUUID()` antes del dispatch; una orden por cada lote seleccionado. `postOrdenTrabajo` extendido en supabaseWriters.js para aceptar id/legacy_id/ciclo_id/descripcion/operador_id/maquinaria_id/lote_id/urgente como opcionales.
- **Mensaje WhatsApp post-guardado**: preview en el sheet + botón "📲 Enviar WhatsApp". Si operador tiene teléfono, abre wa.me; si no, copia al portapapeles + Toast de aviso.
- **Fix productor en chips**: lotes con mismo apodo ahora muestran "{apodo} — {apellido}" para desambiguar.
- **Fix key warning**: `.map((orden, i) => ...)` con `key={`${orden.id}-${i}`}` en órdenes del día.

### 📋 Pendientes al cierre
Ver HANDOFF.md — próximo: diagnosticar por qué las órdenes no aparecen en OrdenDia.

### 🐛 Bugs descubiertos
1. **Órdenes no visibles en OrdenDia**: las órdenes creadas desde DashboardCampo no aparecen en el módulo OrdenDia (dice "Sin órdenes para hoy"). Posible causa: filtro de fecha UTC vs hora local, o OrdenDia filtra por un campo que DashboardCampo no setea.
2. **Chips lotes aún duplicados**: mostrar productor ayuda pero lotes del mismo productor con mismo apodo siguen idénticos (ej: "AVANCE — CASTRO" x5). Solución: agregar folio_corto al chip display.

## Sesión 24 Abril 2026 (tarde)

### ✅ Completado
- **Merge cosecha a main**: tag backup-pre-merge-24abr2026-cosecha, commit db29ac7.
- **Centralizar POST inline**: 10 fetch inline extraídos de OrdenDia (3) y CajaChica (6+1) → 7 helpers nuevos en supabaseWriters.js. ~188 líneas removidas de módulos.
- **Merge refactor a main**: tag backup-pre-merge-24abr2026-refactor.

### 📋 Pendientes al cierre
Ver HANDOFF.md — próximo objetivo: DashboardCampo Phase 2.

## Sesión 24 Abril 2026 (mediodía)

### ✅ Completado
- **Migración cosecha a Supabase**: 5 subtablas (boletas, cuadrillas, fletes, maquila, secado) con lectura en supabaseLoader.js, 5 post helpers + 1 delete genérico + 1 patch helper en supabaseWriters.js.
- **Cancelar/reactivar boleta**: migrado a Supabase-first con PATCH a campo `cancelado`.
- **Import Excel boletas**: migrado a Supabase-first con Promise.all.
- **Schema mismatch**: resuelto con JSON round-trip en columna `notas` para campos sin columna dedicada.
- Whitelist GRUPO_A actualizada con `cosecha`.

### 🎓 Lección aprendida
- Cuando el shape del state no coincide 1:1 con las columnas de Supabase, codificar los extras como JSON en una columna `notas` permite round-trip sin pérdida y sin alterar el schema de la tabla.

### 📋 Pendientes al cierre
Ver HANDOFF.md — próximo: merge cosecha a main o centralizar POST inline.

## Sesión 24 Abril 2026 (mañana)

### ✅ Completado
- **Merge dev → main**: responsive Bitácora + fix acceso socio (egresos→gastos) + Toast global en 7 módulos.
- Tag de respaldo: backup-pre-merge-24abr2026.
- Main y dev sincronizados — no hay delta pendiente.

### 📋 Pendientes al cierre
Ver HANDOFF.md — próximo objetivo sugerido: centralizar POST inline o migrar cosecha.

## Sesión 23 Abril 2026 (noche)

### ✅ Completado

**Fix acceso socio** — "egresos"→"gastos" en ACCESO de roles.js. Socio ahora puede ver Egresos del Ciclo.

**Toast global** — ToastContainer montado en App.jsx (global, desktop+mobile). showToast integrado en 7 módulos: DashboardCampo (2), Bitácora (6), Operadores (3), Maquinaria (1), Proyección (2), Capital (3), OrdenDia (existente). Total: ~20 puntos de feedback al usuario.

### 📋 Pendientes al cierre
Ver HANDOFF.md — tabla actualizada.

## Sesión 23 Abril 2026 (tarde, sesión 2)

### ✅ Completado

**Merge a main** — DashboardCampo Phase 1 + postDieselCarga helper + docs. Tag backup-pre-merge-23abr2026-session4.

**BITACORA-DELETE-01 confirmado resuelto** — El bug estaba listado como pendiente pero ya había sido fixeado en commit 3ee9b59 (sesión 20-abr). El handler usa patrón Supabase-first: await deleteBitacora → if ok → dispatch DEL_BITACORA. HANDOFF limpiado.

**Responsive Bitácora** — Añadidos filtros por rango de fecha (desde/hasta) con botón "Limpiar filtros". Grid de tipos de registro sticky en móvil (position:sticky + z-index + shadow). Diesel.jsx y OrdenDia.jsx ya eran responsive — sin cambios.

### 📋 Pendientes al cierre
Ver HANDOFF.md — tabla actualizada.

## Sesión 23 Abril 2026 (tarde)

### ✅ Completado

**DashboardCampo Phase 1** — 4 mejoras operativas para uso en campo:
1. Fix diesel: guardarDiesel ahora crea registro en tabla diesel + actualiza saldo cilindro + dispatch ADD_DIESEL. Antes solo creaba espejo en bitácora (saldo no se actualizaba). Helper postDieselCarga creado en supabaseWriters.js.
2. Selector de tractor añadido al modal diesel (maquinariaId).
3. precioLitro derivado del último registro en state.diesel (antes hardcoded 27).
4. Validación saldo cilindro: alert si excede + warning inline en input.
5. Botón "✅ Asistencia" añadido al grid (5 botones, el 5to full-width).
6. Header contextual en modal: saldo cilindro + precio visibles.
7. productorId derivado del lote vía ciclo_asignaciones.

**Diesel.jsx refactoreado** — POST inline (36 líneas) reemplazado por postDieselCarga helper (16 líneas). Fix latente: legacy_id ahora se envía en body (antes rows en DB quedaban con legacy_id=NULL).

**Auditoría integral** — Documento Word con análisis de 32 módulos, calificaciones por área, problemas de seguridad, y plan de acción priorizado.

### 🎓 Lecciones aprendidas
1. **Para prompts a Claude Code, dar autonomía.** En vez de pedir diagnósticos parciales y armar la solución en Claude web, dar el objetivo completo con contexto y dejar que Claude Code lea el código, diseñe e implemente. Más eficiente.
2. **DashboardCampo creaba diesel "fantasma".** Solo espejo bitácora sin actualizar tabla diesel = el cilindro no sabe que se usaron litros. Bug silencioso que invalida la operación real.

### 📋 Pendientes al cierre
Ver HANDOFF.md — tabla actualizada. Próximo: verificar dev URL + merge a main, luego BITACORA-DELETE-01.

## Sesión 23 Abril 2026 (mediodía)

### ✅ Completado

**Merge a main** — horasMaq + proyeccion + docs mergeados (7f9c4fb). Tag backup-pre-merge-23abr2026-session2.

**horasMaq migrada a Supabase** — Tabla horas_maq creada. Helpers postHorasMaq/deleteHorasMaq. 3 dispatches ADD_HORAS fuente:"bitacora" eliminados de Bitacora.jsx (eran peso muerto — Maquinaria.jsx los filtraba con fuente!=="bitacora"). Solo queda el path manual.

**proyeccion migrada a Supabase** — Tabla proyeccion (legacy_id text porque ids son strings "P123"/"U123", real_monto en vez de real por palabra reservada PostgreSQL). UPSERT por on_conflict=legacy_id sirve para ADD y UPD. Fix reducer ADD_PROY: id override corregido con patrón GENERAL-02 (a.payload.id ?? fallback).

**GENERAL-01 claves residuales completas** — Las 5 claves (tarifaStd, asistencias, pagosSemana, horasMaq, proyeccion) migradas. PERSIST_KEYS solo contiene Grupo B (UI/prefs), Grupo C (permisos/config) y cosecha.

**Refactor App.jsx** — renderPage (switch 29 cases + 31 imports de módulos) extraído a src/core/AppRouter.jsx. Navegación (page, pageStack, navTo, goBack, getNavFiltro) extraída a src/core/useAppNavigation.js. App.jsx −90 líneas (2097→2007). WidgetCBOTDashboard pasado como prop para evitar import circular.

### 🎓 Lecciones aprendidas
1. **Espejos muertos acumulan deuda técnica silenciosa.** Los 3 dispatches ADD_HORAS fuente:"bitacora" en Bitacora.jsx existían desde antes de la migración de bitácora a Supabase. Nadie los notó porque Maquinaria.jsx los filtraba. La migración los reveló.
2. **legacy_id no siempre es bigint.** proyeccion usa strings como id ("P1234", "U1234"). Usar text para legacy_id en la tabla Supabase mantiene compatibilidad sin refactorear el reducer.
3. **Componentes de App.jsx → props, no imports.** WidgetCBOTDashboard vive en App.jsx. Importarlo desde AppRouter.jsx causaría circular. Pasarlo como prop es el patrón limpio.

### 📋 Pendientes al cierre
Ver HANDOFF.md — tabla actualizada. Próximo: verificar dev URL refactor + merge a main.

## Sesión 23 Abril 2026 (mañana)

### ✅ Completado

**Merge a main** — MAQUINARIA-CONSUMOS-01 mergeado (9b080ac). Tag backup-pre-merge-22abr2026-session3.

**MAQUINARIA-CONSUMOS-01 verificado en dev URL** — Smoke test OK, merge limpio.

**tarifaStd migrada a Supabase** — Tabla tarifa_std (singleton {normal, especial}). Helper updateTarifaStd con PATCH. Bug RLS descubierto: policy era solo para `authenticated` pero el proyecto usa `anon` key → añadida policy para `anon`. Commit 28f972b.

**asistencias migrada a Supabase** — Tabla asistencias recreada con schema alineado al código (operador_id int, tarifa_dia, nota, lote_id text). Helpers postAsistencia/deleteAsistencia. 3 call sites en Operadores.jsx cableados con patrón dispatch-first + Supabase-background. Complicación resuelta: colisión Date.now() en forEach multi-operador → baseId+idx. Commit 72837fd.

**pagosSemana migrada a Supabase** — Tabla pagos_semana recreada (semana UNIQUE, detalle jsonb). UPSERT con on_conflict=semana. Complicación resuelta: detalle jsonb doble-stringify prevenido. Commit 72837fd.

**GENERAL-01 estado confirmado** — Fases 1-3 completas. Solo quedan 2 claves residuales: horasMaq (candidata a deprecar), proyeccion.

### 🎓 Lecciones aprendidas
1. **RLS para anon obligatoria.** El proyecto usa SUPABASE_ANON_KEY para todos los writes. Tablas nuevas necesitan `CREATE POLICY ... FOR ALL TO anon`. Sin esto, writes fallan silenciosamente (tarifa_std lo demostró).
2. **Generar id antes del dispatch.** Cuando el caller necesita el id para postX(legacy_id), debe generarlo ANTES del dispatch — el reducer lo genera internamente pero no lo devuelve.
3. **Date.now() colisiona en loops.** Múltiples dispatches en el mismo ms producen legacy_ids duplicados → UNIQUE violation. Usar baseId + idx.

### 📋 Pendientes al cierre
Ver HANDOFF.md — tabla actualizada. Próximo: verificar dev URL + merge a main.

## Sesión 22 Abril 2026 (noche, sesión 2)

### ✅ Completado

**Merge a main** — DIESEL-ESPEJO-01 + REALTIME-MAPPER-GAP mergeados a main (46b1fcf). Tag backup-pre-merge-22abr2026-session2.

**MAQUINARIA-CONSUMOS-01 resuelto** — 409 Conflict al guardar consumos L/ha en maquinaria_consumos.
- Causa raíz 1 (409): POST usaba `resolution=merge-duplicates` que resuelve por PK, pero el conflicto real era en UNIQUE constraint compuesta `(maquinaria_id, tipo_labor)`. Fix: `?on_conflict=maquinaria_id,tipo_labor` en URL + remover `id` del body.
- Causa raíz 2 (display): `maquinariaConsumos` no estaba en whitelist GRUPO_A de HYDRATE_FROM_SUPABASE en DataContext.jsx — el loader traía los datos de Supabase pero el reducer los descartaba. Fix: añadir a whitelist.
- Bonus: feedback visual en botón ✓ (✅ ok / ❌ error / ✓ default) con timeout 2s.
- Commit: 7cac871

### 🎓 Lección aprendida
**Whitelist GRUPO_A es un gate silencioso.** Si una clave se añade al loader pero no a GRUPO_A, los datos llegan del fetch pero se descartan en el dispatch sin warning. Al migrar cualquier clave nueva a Supabase, verificar ambos: loader + whitelist.

### 📋 Pendientes al cierre
Ver HANDOFF.md — tabla actualizada.

## Sesión 22 Abril 2026 (noche)

### ✅ Completado
**DIESEL-ESPEJO-01** — Cancelar diesel ahora borra espejo en bitácora.

Problema: al cancelar una carga de diesel (salida_interna), la fila en diesel se marcaba cancelado=true pero el espejo en bitacora_trabajos quedaba huérfano. No había FK ni columna que las vinculara.

Fix aplicado:
- ALTER TABLE diesel ADD COLUMN bitacora_legacy_id bigint
- Reordenado guardarMovimiento: postBitacora se ejecuta PRIMERO, su legacy_id se captura y se incluye en el POST a diesel
- Cancel handler: deleteBitacora(d.bitacoraLegacyId) + DEL_BITACORA antes del PATCH diesel
- Loader map + realtime channel: mapean bitacora_legacy_id → bitacoraLegacyId

Causa raíz del primer fallo en smoke test: el realtime channel de diesel en App.jsx re-mapeaba las filas con schema incompleto (sin bitacoraLegacyId), pisando el state del loader.

Commit: 637f1e0

### 🎓 Lecciones aprendidas
1. **Verificar TODOS los paths de hidratación**: al añadir un campo nuevo a una tabla, no basta con actualizar el loader — hay que actualizar también los realtime channels y cualquier otro mapper que reconstruya los objetos.
2. **Para debugging, usar Claude Code directo**: el workflow "Claude web genera prompt → Miguel pega en Claude Code → reporta resultado" es eficiente para cambios planificados, pero para debugging es muy lento. Claude Code tiene acceso completo al código y puede diagnosticar + fixear en un solo paso.
3. **`deleteBitacora` nunca lanza**: retorna boolean. Usar patrón `const ok = await deleteBitacora(...); if (ok) dispatch(...)` en vez de try/catch.

### 📋 Pendientes al cierre
Ver HANDOFF.md — #1 prioridad: verificar en dev URL y merge a main.

## Sesión 22 Abril 2026 (tarde-3)

### ✅ Completado

**GENERAL-01 Fase 3 — migración lote 10 claves + cicloActual**
- 10 fetches añadidos en supabaseLoader, HYDRATE ampliado a 27 claves (28 menos cosecha devuelta a localStorage).
- IIFE/PERSIST reducidos de 32 a 22 claves (simétricos). localStorage limpio.

**Fix cosecha — prevenir data loss**
- cosecha devuelta a IIFE/PERSIST y removida de HYDRATE (no tiene tabla Supabase aún).

**Feature: productor auto desde lote al cargar tractor**
- Helper productorIdFromLote via ciclo_asignaciones. productor_legacy_id ahora se escribe al POST de diesel.
- Indicador UI verde "👤 Productor: X" debajo del select de lote. Warning amarillo si lote sin asignación.

### 🐛 Bugs descubiertos (preexistentes)
- DIESEL-ESPEJO-01: cancelar diesel no cancela espejo en bitácora. Fix diseñado (Opción 3), pendiente.
- MAQUINARIA-CONSUMOS-01: 409 Conflict al guardar consumos L/ha. Pendiente investigar.

### 📋 Pendientes al cierre
Ver HANDOFF.md.

## Sesión 22 Abril 2026 (tarde-2)

### ✅ Completado

**GENERAL-01 Fase 3 — migración lote de 10 claves vacías + cicloActual**
- 10 tablas ya existían en Supabase (todas vacías, 0 filas): recomendaciones, notificaciones, delegaciones, solicitudes_compra, ordenes_compra, solicitudes_gasto, activos, personal, creditos_refaccionarios, rentas_tierra.
- Añadidos 10 fetches en supabaseLoader.js con passthrough crudo (|| []).
- HYDRATE_FROM_SUPABASE ampliado de 17 a 28 claves.
- IIFE savedState + PERSIST_KEYS reducidos de 32 a 21 claves (simétricos).
- cicloActual: ya se derivaba del loader, ahora incluido en HYDRATE whitelist.
- Caveat: mapeo snake_case → camelCase pendiente para cuando cada módulo capture datos reales.

Commits: e0f1061 (código), 3bb4a85 (merge main).

### 🎓 Lección aprendida
- Tablas vacías en Supabase se pueden migrar en lote sin riesgo de data loss. El patrón es mecánico: fetch + whitelist + quitar de IIFE/PERSIST.

### 📋 Pendientes al cierre
5 claves aún en localStorage: asistencias, pagosSemana, tarifaStd, horasMaq, proyeccion. Ver HANDOFF.md.

## Sesión 22 Abril 2026 (tarde)

### ✅ Completado

**GENERAL-01 Fase 2 — Decisiones Grupo C**
- permisosUsuario, permisosGranulares, rolesPersonalizados, usuariosExtra, usuariosBaseEdit → Supabase en Fase 3 (datos de negocio, no preferencias UI).
- proyeccion → decisión aplazada, revisar módulo primero.
- Documentado en docs/DECISIONS.md.

**Capital DELETE fix + refactor**
- Bug: botón 🗑 eliminaba de UI pero no de Supabase (patrón BITACORA-DELETE-01).
- Fix: extraer postCapital + deleteCapital a supabaseWriters.js. Capital.jsx usa helpers importados.
- Eliminado postCapital inline + imports huérfanos SUPABASE_URL/SUPABASE_ANON_KEY de Capital.jsx.
- Smoke test: crear → recargar → borrar → recargar → confirmado que no reaparece.

Commits: 00672bb (código), e6a784d (decisiones).

### 🎓 Lección aprendida
- form.referencia vs form.notas: Capital.jsx usa "referencia" como nombre del campo del form, pero la columna Supabase se llama "notas". Sin fallback form.referencia || form.notas, el dato se perdía silenciosamente. Siempre verificar mapping campo-UI ↔ columna-DB.

### 📋 Pendientes al cierre
Ver HANDOFF.md — próximo: Fase 3 módulo por módulo o merge a main.

## Sesión 22 Abril 2026 (mediodía)

### ✅ Completado
**GENERAL-01 Fase 1 — fix del ciclo de vida del reducer**

Problema: las 17 claves Grupo A (productores, lotes, bitácora, diesel, etc.) se inicializaban desde localStorage vía IIFE savedState. Supabase escribía a localStorage, el reducer leía de localStorage en el siguiente mount. No había dispatch directo. Consecuencia: datos stale entre sesiones/roles (DIESEL-01), blob localStorage creciente, window.location.reload() como muleta.

Cambios (5 pasos, 4 archivos):
1. DataContext.jsx: +5 claves extras en initState + case HYDRATE_FROM_SUPABASE (whitelist 17 claves)
2. supabaseLoader.js: eliminar localStorage.setItem, retornar estadoNuevo
3. App.jsx IIFE: reducir de 48 a 32 claves (sin Grupo A)
4. App.jsx persist: PERSIST_KEYS selectivo (32 claves simétricas)
5. App.jsx: useEffect HYDRATE reemplaza SYNC_STATE parcial, handleLogin sin loadStateFromSupabase redundante, loading gate "Cargando datos…"

Commits: 1f1e85c (código).

Resuelve: GENERAL-01 Fase 1, DIESEL-01 (efecto colateral).

### 🎓 Lecciones aprendidas
- SYNC_STATE existente era un no-op para 8 de 10 claves (filtradas por SYNC_KEYS). El trabajo real lo hacía window.location.reload() — diagnóstico reveló que NO había hidratación vía dispatch efectiva.
- Las 5 claves extras (liquidaciones, cajaChica*, usuariosDB, maquinariaConsumos) ya eran Supabase-first por su cuenta (SET_* en módulos). Incluirlas en HYDRATE habría creado race conditions.
- La IIFE savedState y el useEffect persist deben ser simétricas (mismas claves). Asimetría = data loss silencioso.

### 📋 Pendientes al cierre
Ver HANDOFF.md — próximo: Fase 2 (decisiones Grupo C) o merge a main.

## Sesión 22 Abril 2026 (mañana — warm-up)

### ✅ Completado
- Verificación del pendiente #8 (ruta parser Babel en docs): los docs ya tenían la ruta correcta (`./node_modules/@babel/parser`). Sesión anterior ya lo había arreglado implícitamente. Pendiente cerrado sin cambios.
- HANDOFF.md actualizado removiendo #8 de la tabla de pendientes.

### 🎓 Lección aprendida
- El HANDOFF puede contener pendientes fantasma — tareas ya resueltas por una sesión previa sin que se hayan removido de la lista. Verificar antes de ejecutar cualquier pendiente de housekeeping; puede que no haya nada que hacer.

### 📋 Pendientes al cierre
Ver `docs/HANDOFF.md`. Próximo objetivo: Fase 1 de GENERAL-01 (chat nuevo, 60-90 min).

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
