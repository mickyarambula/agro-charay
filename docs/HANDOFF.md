# AgroSistema Charay — HANDOFF

**Última actualización:** 20 Abril 2026 (tarde — sesión diagnóstico)
**Branch activo:** dev
**Último commit:** 70e028e (docs: descubierto GENERAL-03 al cierre) — esta sesión no tocó código
**Estado:** diagnóstico GENERAL-03 completado. GENERAL-03 NO existe como bug separado — es GENERAL-01.

## Estado al cierre

- Sesión de diagnóstico PWA/SW/IndexedDB completada en ~20 min. Mapeo exhaustivo hecho en Chrome desktop vs agro-charay-dev.vercel.app.
- **Conclusión principal: NO hay tercera capa de persistencia.** Solo existen dos: Supabase y localStorage. GENERAL-03 se reclasifica como manifestación de GENERAL-01.
- Cero cambios de código esta sesión — solo inspección DevTools.
- Los 6 registros fantasma de bitácora siguen visibles en dev (y en localStorage). Se quedan ahí hasta atacar GENERAL-01.

## Mapa de persistencia (diagnóstico 20-abr tarde)

| Capa | Estado | Contenido |
|------|--------|-----------|
| Supabase `bitacora_trabajos` | Vacío | 0 filas (DELETE confirmado sesión anterior) |
| Service Worker `sw.js` | Activo (#74) | Solo registrado, sin cachear data |
| Cache Storage `agro-charay-v1` | 37 entries | 100% assets (JS/HTML) — **cero URLs de supabase** |
| IndexedDB | **No existe** | "No indexedDB detected" — nunca se creó |
| localStorage `agroSistemaState` | **6 registros** | La bitácora "fantasma" vive aquí, hidratada al montar |
| localStorage `agro_session` | 1 entrada | Sesión del usuario (Miguel admin) |

Verificación final en Console:
`JSON.parse(localStorage.getItem('agroSistemaState')).bitacora` → `(6) [{…}, {…}, {…}, {…}, {…}, {…}]`

## Hipótesis de por qué los 6 registros persisten

Anoche se hizo:
1. DELETE en Supabase ✅ (confirmado 0 filas)
2. Setear `state.bitacora = []` en localStorage ✅ (verificado con console.log)
3. Reload → 6 registros vuelven ❌

Con supabaseLoader.js sin migrar la LECTURA de bitácora (pendiente #1 del HANDOFF anterior), al recargar:
- App.jsx lee `agroSistemaState` desde localStorage (bitacora vacío en ese instante)
- supabaseLoader hidrata el resto del state
- En el reducer/merge, algo reintroduce bitacora desde una fuente (state inicial, fallback, configPreservada, o memoria de React anterior al reload)
- React serializa el nuevo state a localStorage → bitacora vuelve a tener 6 registros

Esto es exactamente el patrón de GENERAL-01. **GENERAL-03 queda retirado como bug separado.**

## Flujos Bitácora — estado sin cambio

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

### Bug GENERAL-01: Doble capa de persistencia (CONFIRMADO como raíz)
Severidad: Alta. App.jsx lee localStorage al montar, supabaseLoader re-escribe localStorage pero el reducer ya no se entera. Además, algo reintroduce bitácora en el state después del reload. Fix: dejar de inicializar reducer desde localStorage, o limpiar bitácora del initState cuando se migre la lectura. Solo Supabase como fuente.

### Bug DIESEL-01
Manifestación de GENERAL-01 en el módulo Diesel.

### ~~Bug GENERAL-03~~ (retirado)
Diagnóstico 20-abr tarde demostró que no existe tercera capa. Re-clasificado como manifestación de GENERAL-01.

## Tabla de pendientes actualizada

| # | Prioridad | Tarea | Tiempo | Categoría |
|---|-----------|-------|--------|-----------|
| 1 | Alta | Bitácora: migrar LECTURA — agregar fetch de bitacora_trabajos a supabaseLoader.js | 45 min | Migración |
| 2 | Alta | Fix GENERAL-01 (doble persistencia localStorage↔Supabase) | 60 min | Bug estructural crítico |
| 3 | Alta | Bitácora: migrar bulk import Excel (el 7° flujo) | 30 min | Migración |
| 4 | Media | Fix DIESEL-01 (consecuencia de #2) | 15 min después de #2 | Bug |
| 5 | Media | Merge dev → main cuando #1 y #2 estén terminados | 10 min | Deploy |
| 6 | Media | Refactor App.jsx — extraer routes | 45 min | Refactor |
| 7 | Media | Asignar productor auto desde lote al cargar tractor | 30 min | Feature Diesel |
| 8 | Baja | Actualizar supabase-js (warning de httpSend en consola) | 15 min | Infra |
| 9 | Baja | Alertas WhatsApp al socio (resumen semanal) | 2 hrs | Feature |
| 10 | Baja | Dashboard histórico entre ciclos | 3 hrs | Feature |
| 11 | Futuro | DashboardCampo Phase 1 — móvil encargado | 2 hrs | Feature |
| 12 | Futuro | Cosecha Fase 2: boletas → pago banco → cierre | 3 hrs | Cuando llegue cosecha |
| 13 | Futuro | saveFoto: opción de ligar foto a lote/operador si hace falta | 20 min | Mejora Bitácora |

## Siguiente sesión — recomendación

**Objetivo propuesto: #1 del HANDOFF — migrar LECTURA de bitácora a Supabase.**

Preparación antes de abrir chat nuevo:
- Tener a mano `src/supabaseLoader.js` y `src/core/DataContext.jsx` completos
- Tener a mano el schema de `bitacora_trabajos` en Supabase (`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='bitacora_trabajos' ORDER BY ordinal_position;`)
- Revisar cómo se integró `capital_movimientos` al Promise.all de supabaseLoader — es el patrón a replicar
- Plan: leer archivos → proponer cambio → probar en local → deploy a dev → verificar que los 6 registros fantasma desaparecen por sí solos al cargar desde Supabase (que ya está vacío) → commit

Si la migración de lectura funciona y los 6 registros desaparecen de la UI sin tocar localStorage, eso es evidencia fuerte de que GENERAL-01 también se arregla parcialmente con #1. Después se ataca #2 (fix GENERAL-01 completo) como segunda sesión.

## Reglas de trabajo (reforzadas esta sesión)

- Sesiones cortas (30-50 min), un objetivo claro
- **Diagnóstico antes que fix**: no improvisar "limpiezas rápidas" sobre arquitectura no entendida
- **Un hallazgo por sesión cuando es estructural**: esta sesión se disciplinó a diagnóstico puro y entregó claridad — no se encimó un fix apresurado encima
- Preserve log en DevTools Network es esencial para testing de varios POSTs seguidos
- Commit y push al cierre, siempre (esta sesión: sin commit de código, solo docs)
- Actualizar PROGRESS.md y HANDOFF.md antes de cerrar
- Un bug/feature por sesión — verificar, commit, cerrar
- Nunca importar desde App.jsx en módulos
- Verificar schema Supabase antes de POST
- Ver archivo completo y EXPANDIDO antes de editar
- Un cambio a la vez, con prueba inmediata en dev antes de pensar en main
- Datos reales = tolerancia cero al cambio sin respaldo previo y sin prueba explícita
- Probar el cambio en local primero, luego dev, nunca directo a main
- Cuidado con listeners de Supabase: handler que llama signOut() nunca dentro de onAuthStateChange(SIGNED_OUT)
- Si una limpieza "simple" no produce el efecto esperado en la UI, PARAR y documentar. Las sorpresas de persistencia son síntoma de arquitectura no entendida
- **Antes de llamar "tercera capa" a algo, confirmar con DevTools qué hay en cada capa real** (SW / Cache / IndexedDB / localStorage / Session storage). La sorpresa puede ser una capa conocida comportándose raro, no una nueva capa.
