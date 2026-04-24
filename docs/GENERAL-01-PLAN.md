# GENERAL-01 — Plan de migración a Supabase como fuente única

**Creado:** 21 abril 2026
**Estado:** Aprobado. Fase 1 pendiente de arranque.
**Contexto:** Diagnóstico en sesión 21-abr-2026 reveló que el problema es mayor al asumido. Este documento es el plan operacional.

---

## Problema diagnosticado

- 52 claves en initState del reducer (src/core/DataContext.jsx L11–241)
- 17 hidratadas desde Supabase (indirectamente vía localStorage, no vía dispatch)
- 35 viven solo en localStorage — nunca viajan a Supabase
- 6 extras viven en state pero no en initState: liquidaciones, cajaChicaFondo, cajaChicaMovimientos, usuariosDB, maquinariaConsumos, _supabaseCargado
- El reducer se inicializa desde localStorage (src/App.jsx:1218)
- Cada cambio de state reescribe el blob completo a localStorage (src/App.jsx:1289)
- Las mutaciones nuevas (postBitacora, deleteBitacora, etc.) escriben a Supabase Y a localStorage en paralelo, sin coordinación

## Consecuencias observables

- **DIESEL-01**: cambios en otra sesión no se ven hasta recargar
- Bugs futuros cuando claves localStorage-only se desincronicen entre roles (encargado vs socio vs admin ven datos distintos)
- localStorage crece sin control (blob serializado entero en cada cambio)

---

## Clasificación de las 58 claves (52 initState + 6 extras)

### Grupo A — Persistencia en Supabase (fuente única)
Datos del negocio que TODOS los roles deben ver sincronizados.

**Ya en Supabase (22 claves):**
productores, lotes, bitacora, insumos, diesel, dispersiones, egresosManual, expedientes, inventario, cicloActual, cicloActivoId, ciclos, maquinaria, operadores, ordenesTrabajo, capital, liquidaciones, cajaChicaFondo, cajaChicaMovimientos, usuariosDB, maquinariaConsumos, _supabaseCargado

**Por migrar (21 candidatos):**
activos, creditosRef, rentas, personal, cosecha, asistencias, pagosSemana, horasMaq, trabajos, solicitudesCompra, ordenesCompra, solicitudesGasto, recomendaciones, notificaciones, delegaciones, cultivosCatalogo, creditoParams, creditoLimites, alertaParams, tarifaStd, paramsCultivo

### Grupo B — Config local legítima (UI/preferencias, no sync)
alertasLeidas, cultivoActivo, productorActivo, invCampo, colaOffline, precioVentaMXN, rendimientoEsperado

### Grupo C — Requiere decisión del negocio (resolver en Fase 2)
- permisosUsuario, permisosGranulares, rolesPersonalizados, usuariosExtra, usuariosBaseEdit → ¿Supabase tabla permisos o config local admin?
- proyeccion → ¿cálculo derivado o data capturada?

---

## Plan de ejecución

### Fase 1 — Fix del ciclo de vida (1-2 sesiones, 60-90 min c/u)

Objetivo: que las 22 claves YA en Supabase realmente sean fuente única. Sin migrar nada nuevo.

Tareas:
1. Añadir action HYDRATE_FROM_SUPABASE al reducer con merge selectivo solo de claves del Grupo A ya migradas.
2. Reemplazar en supabaseLoader la escritura a localStorage por dispatch de la action anterior.
3. Eliminar lectura de localStorage en App.jsx:1218 → reducer inicia con initState puro.
4. Convertir useEffect([state]) en App.jsx:1289 en escritura SELECTIVA de claves del Grupo B + Grupo C (temporalmente).
5. Añadir loading state post-login mientras supabaseLoader corre.
6. Smoke test exhaustivo por módulo Grupo A: bitácora, diesel, capital, inventario, dispersiones, egresos, caja chica, órdenes de trabajo, productores, lotes, ciclos, maquinaria, operadores, expedientes, insumos.

Resuelve: DIESEL-01, bug "requiere recargar", blob localStorage sin control.

Regla: si al smoke-test del módulo X aparece cualquier regresión, PARAR la fase, documentar en HANDOFF, no mergear a main.

### Fase 2 — Decisiones del Grupo C (1 sesión, 30 min)

No código. Definir qué va a Supabase del Grupo C y qué permanece local. Resultado: entrada en DECISIONS.md.

### Fase 3 — Migración módulo por módulo (N sesiones, 60 min c/u)

Una clave del Grupo A pendiente por sesión, siguiendo el patrón bitácora:
1. Crear tabla en Supabase (verificar information_schema antes)
2. Añadir lectura en supabaseLoader
3. Añadir helpers postX/deleteX en supabaseWriters.js
4. Migrar los call sites del módulo
5. Smoke test end-to-end
6. Commit + push dev

Orden sugerido por prioridad de negocio (confirmar al arrancar Fase 3):
1. trabajos (investigar primero si es distinto de bitacora)
2. cosecha (viene cosecha real)
3. solicitudesCompra, ordenesCompra, solicitudesGasto (flujos activos)
4. activos, personal, creditosRef, rentas (contabilidad Daniela)
5. asistencias, pagosSemana, horasMaq (cuando se activen)
6. Resto

---

## Riesgo aceptado

- Durante Fase 1 los módulos Grupo A deben funcionar igual; los 21 candidatos pendientes siguen en localStorage como hoy (nada empeora).
- Ningún cambio toca main hasta que Fase 1 complete smoke test exhaustivo en dev.
- Tag de respaldo antes de cada merge a main (patrón backup-pre-merge-<fecha>).

---

## Estado actual

- [x] Fase 1 (completada incrementalmente, sesiones 21-23 abr 2026)
- [x] Fase 2 (decisiones tomadas 24-abr-2026, documentadas en DECISIONS.md)
- [ ] Fase 3 (por módulo, ver checklist dinámico en HANDOFF.md)
