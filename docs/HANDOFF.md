# AgroSistema Charay — HANDOFF

**Última actualización:** 20 Abril 2026 (tarde — migración lectura bitácora)
**Branch activo:** dev
**Último commit:** bb31030 (feat(bitacora): migrar lectura a Supabase — fuera de localStorage)
**Estado:** migración de LECTURA de bitácora a Supabase completada y desplegada en dev. Los 6 registros fantasma resueltos. Queda pendiente migrar el bulk import Excel (7° flujo de bitácora) y atacar GENERAL-01 de raíz.

## Estado al cierre

- Sesión de ~45 min. Un objetivo, un commit, un deploy verificado.
- `supabaseLoader.js` ahora hidrata bitácora desde `bitacora_trabajos` en el `Promise.all`. Mapper normaliza `lote_ids` (jsonb) + fallback `lote_id` (text). `configPreservada` ya NO preserva bitácora de localStorage.
- Ciclo completo verificado end-to-end: crear registro en UI → POST a Supabase → reload → aparece en UI leído desde Supabase. Confirmado también en `agro-charay-dev.vercel.app` desde incógnito.
- Supabase `bitacora_trabajos` quedó con 0 filas al cierre (el registro de prueba se borró con `DELETE WHERE legacy_id = 1776725608364`).
- Main sigue intacto. Este cambio vive solo en dev.

## Cómo quedó la hidratación de bitácora

| Capa | Antes | Ahora |
|------|-------|-------|
| Escritura (6 handlers) | Supabase ✅ | Supabase ✅ (sin cambio) |
| Lectura al login | localStorage ❌ | Supabase ✅ |
| `configPreservada.bitacora` | Preservaba de localStorage | Removido — comentario explicativo |
| Fuente de verdad | localStorage | `bitacora_trabajos` en Supabase |

## Flujos Bitácora — estado

| Handler | Escritura Supabase | Lectura Supabase |
|---------|-------------------|------------------|
| saveInsumo | ✅ | ✅ (via supabaseLoader) |
| saveDiesel | ✅ | ✅ |
| saveRiego | ✅ | ✅ |
| saveFenol | ✅ | ✅ |
| saveReporte | ✅ | ✅ |
| saveFoto | ✅ | ✅ |
| Bulk import Excel | ❌ PENDIENTE | N/A |

## Bugs estructurales pendientes

### Bug GENERAL-01: Doble capa de persistencia (parcialmente mitigado)
Severidad: Alta. El problema raíz sigue vivo: `App.jsx` inicializa el reducer desde `localStorage.agroSistemaState`, y `supabaseLoader` escribe encima a ese mismo localStorage. Para el módulo bitácora ya NO hay conflicto (su único origen ahora es Supabase), pero para otros módulos que aún se preservan de localStorage (`creditosRef, activos, rentas, personal, proyeccion`, workflow local) el patrón sigue. Fix completo: dejar de inicializar reducer desde localStorage, usar solo Supabase. 60 min estimados.

### Bug DIESEL-01
Manifestación de GENERAL-01 en Diesel. Pendiente hasta fix de #2.

### ~~Bug GENERAL-03~~ (retirado previamente)
No existe tercera capa. Ya documentado.

## Tabla de pendientes actualizada

| # | Prioridad | Tarea | Tiempo | Categoría |
|---|-----------|-------|--------|-----------|
| 1 | Alta | Fix GENERAL-01 (doble persistencia localStorage↔Supabase, de raíz) | 60 min | Bug estructural crítico |
| 2 | Alta | Bitácora: migrar bulk import Excel (7° flujo) | 30 min | Migración |
| 3 | Media | Fix DIESEL-01 (consecuencia de #1) | 15 min tras #1 | Bug |
| 4 | Media | Merge dev → main cuando #1 y #2 estén terminados | 10 min | Deploy |
| 5 | Media | Refactor App.jsx — extraer routes | 45 min | Refactor |
| 6 | Media | Asignar productor auto desde lote al cargar tractor | 30 min | Feature Diesel |
| 7 | Baja | Actualizar supabase-js (warning httpSend) | 15 min | Infra |
| 8 | Baja | Alertas WhatsApp al socio (resumen semanal) | 2 hrs | Feature |
| 9 | Baja | Dashboard histórico entre ciclos | 3 hrs | Feature |
| 10 | Futuro | DashboardCampo Phase 1 — móvil encargado | 2 hrs | Feature |
| 11 | Futuro | Cosecha Fase 2: boletas → pago banco → cierre | 3 hrs | Cuando llegue cosecha |
| 12 | Futuro | saveFoto: opción de ligar foto a lote/operador | 20 min | Mejora Bitácora |

## Siguiente sesión — recomendación

**Objetivo propuesto: #2 — migrar bulk import Excel de bitácora.**

Es más chico (30 min), cierra el último flujo pendiente del módulo bitácora, y deja el módulo 100% limpio antes de atacar GENERAL-01 de raíz (que es más invasivo). Si queda tiempo en esa misma sesión, empezar #1.

Preparación antes de abrir chat nuevo:
- Tener a mano el componente de bulk import (`src/modules/Bitacora.jsx` o similar — buscar la función que dispara `ADD_BITACORA` N veces al leer Excel).
- Entender cómo el mapper construye el payload — debe igualar los campos de los 6 handlers ya migrados (`tipo`, `fuente`, `lote_id`/`lote_ids`, `fecha`, `operador_id`, `maquinaria_id`, `horas`, `notas`, `data`, `ciclo_id`).
- Plan: leer archivo → identificar función de import → añadir POST a `bitacora_trabajos` por cada fila (o bulk insert con `Prefer: resolution=merge-duplicates` si aplica) → probar con Excel pequeño en local → dev → commit.

## Reglas de trabajo (reforzadas esta sesión)

- Sesiones cortas (30-50 min), un objetivo claro
- Diagnóstico antes que fix
- Ver archivo completo y EXPANDIDO antes de editar
- Un cambio a la vez, con prueba inmediata
- Probar en local primero, luego dev, nunca directo a main
- **Nueva:** cuando un cambio de hidratación parece "romper" el dashboard en local, probar primero con `clear site data` antes de diagnosticar como bug. localStorage residual de sesiones anteriores puede arrastrar estado incompatible y simular un fallo que no existe.
- **Nueva:** el criterio "los fantasmas desaparecen por sí solos al cargar desde Supabase vacío" es una verificación limpia y rápida cuando se migra lectura de un módulo. Sirve de smoke test.
- Verificar schema Supabase antes de POST (`information_schema.columns`)
- Verificar sintaxis con Babel parse después de editar
- Commit y push al cierre, siempre
- Nunca importar desde App.jsx en módulos
- Datos reales = tolerancia cero al cambio sin respaldo previo y sin prueba explícita
- Cuidado con listeners de Supabase: handler con `signOut()` nunca dentro de `onAuthStateChange(SIGNED_OUT)`
