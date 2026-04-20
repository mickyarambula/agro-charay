# AgroSistema Charay — HANDOFF

**Última actualización:** 20 Abril 2026 (tarde)
**Branch activo:** dev
**Último commit:** 90faaf3 — feat(bitacora): POST a Supabase antes del dispatch local
**Estado:** escritura de bitácora a Supabase funcionando en dev. Lectura sigue por localStorage (pendiente).

## Estado al cierre

- Tabla `bitacora_trabajos` creada en Supabase (16 columnas, 8 policies anon+authenticated)
- Bitacora.jsx: 6 handlers (saveInsumo, saveDiesel, saveRiego, saveFenol, saveReporte, saveFoto) ahora hacen POST a Supabase ANTES del dispatch local, con guards savingX anti doble-click
- Helper postBitacora() replica patrón de Capital (fetch REST + legacy_id + ciclo_id)
- Probado en dev.vercel.app con admin: saveReporte y saveRiego → status 201 + filas en Supabase
- NO se tocó supabaseLoader.js — la lectura sigue por localStorage (mismo patrón pre-migración)
- Capital Propio y GENERAL-02 ya resueltos en sesiones anteriores
- Logout limpio operativo

## Flujos probados vs no probados

| Handler | Probado | Donde |
|---------|---------|-------|
| saveReporte | ✅ | localhost + dev.vercel |
| saveRiego | ✅ | dev.vercel |
| saveInsumo | ⚠️ no probado | — |
| saveDiesel | ⚠️ no probado | — |
| saveFenol | ⚠️ no probado | — |
| saveFoto | ⚠️ no probado | — |

Los 4 no probados tienen estructura idéntica a los probados — alta probabilidad de funcionar, pero verificar antes de merge a main.

## Bugs estructurales pendientes

### Bug GENERAL-01: Doble capa de persistencia
Severidad: Alta. App.jsx lee localStorage al montar, supabaseLoader re-escribe localStorage pero el reducer ya no se entera. Fix: dejar de inicializar reducer desde localStorage. Solo Supabase como fuente.

### Bug DIESEL-01
Manifestación de GENERAL-01 en el módulo Diesel.

## Tabla de pendientes actualizada

| # | Prioridad | Tarea | Tiempo | Categoría |
|---|-----------|-------|--------|-----------|
| 1 | Alta | Bitácora: probar en dev los 4 handlers restantes (saveInsumo, saveDiesel, saveFenol, saveFoto) | 20 min | Testing |
| 2 | Alta | Bitácora: migrar LECTURA — agregar fetch de bitacora_trabajos a supabaseLoader.js | 45 min | Migración |
| 3 | Alta | Bitácora: migrar bulk import Excel (el 7° flujo que no tocamos hoy) | 30 min | Migración |
| 4 | Alta | Fix GENERAL-01 (doble persistencia) | 60 min | Bug estructural crítico |
| 5 | Media | Fix DIESEL-01 (consecuencia de #4) | 15 min después de #4 | Bug |
| 6 | Media | Merge dev → main cuando los 4 handlers estén probados | 10 min | Deploy |
| 7 | Media | Refactor App.jsx — extraer routes | 45 min | Refactor |
| 8 | Media | Asignar productor auto desde lote al cargar tractor | 30 min | Feature Diesel |
| 9 | Baja | Actualizar supabase-js | 15 min | Infra |
| 10 | Baja | Alertas WhatsApp al socio (resumen semanal) | 2 hrs | Feature |
| 11 | Baja | Dashboard histórico entre ciclos | 3 hrs | Feature |
| 12 | Futuro | DashboardCampo Phase 1 — móvil encargado | 2 hrs | Feature |
| 13 | Futuro | Cosecha Fase 2: boletas → pago banco → cierre | 3 hrs | Cuando llegue cosecha |

## Siguiente sesión — recomendación

Arrancar con #1 (20 min de testing rápido de los 4 handlers pendientes en dev). Si pasan, #2 (migrar lectura a supabaseLoader.js) es la continuación natural. #2 requiere ver supabaseLoader.js completo y entender configPreservada antes de tocar nada — no improvisar sobre memoria.

## Reglas de trabajo (reforzadas esta sesión)

- Sesiones cortas (30-50 min), un objetivo claro
- Commit y push al cierre, siempre
- Actualizar PROGRESS.md y HANDOFF.md antes de cerrar
- Si hubo varios cambios de estado durante el día, releer HANDOFF anterior antes de regenerarlo
- Un bug/feature por sesión — verificar, commit, cerrar
- Nunca importar desde App.jsx en módulos
- Verificar schema Supabase antes de POST
- Ver archivo completo y EXPANDIDO antes de editar — nunca confiar en resúmenes de "+X lines to expand"
- Un cambio a la vez, con prueba inmediata en dev antes de pensar en main
- **Datos reales = tolerancia cero** al cambio sin respaldo previo y sin prueba explícita
- Probar el cambio en local primero, luego dev, nunca directo a main
- Cuidado con listeners de Supabase: handler que llama signOut() nunca dentro de onAuthStateChange(SIGNED_OUT)
