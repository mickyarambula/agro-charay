# AgroSistema Charay — HANDOFF

**Última actualización:** 24 Abril 2026 (mediodía)
**Branch activo:** dev
**Último commit dev:** 117a7a6 (feat(config): GENERAL-01 Fase 3.4 — creditoLimites → Supabase, cierra Fase 3)
**Último commit main:** 394cea3 (merge: DashboardCampo Phase 2)
**Tag de respaldo:** backup-pre-merge-24abr2026-dashcampo
**Estado:** GENERAL-01 COMPLETO. Las 5 claves de config temporal migradas a Supabase. localStorage solo persiste UI prefs + permisos/roles.

## Estado al cierre

- GENERAL-01 Fase 3 completa: cultivosCatalogo (3.1), alertaParams+creditoParams (3.2), paramsCultivo (3.3), creditoLimites (3.4) — todas en Supabase.
- PERSIST_KEYS limpio: solo quedan Grupo B (UI prefs) y Grupo C permisos/roles. Cero config temporal en localStorage.
- Tabla `configuracion` (key-value) usada para singletons alertaParams y creditoParams.
- Tabla `params_cultivo` nueva con UNIQUE constraint en (ciclo_id, cultivo_id, variedad).
- Tabla `credito_limites` nueva con UNIQUE en productor_id.
- Tabla `cultivos_catalogo` poblada con 6 registros corregidos (variedades alineadas con initState original).
- DashboardCampo Phase 2 en producción (main 394cea3).
- OrdenDia refactorizado sin GET inline (-50 líneas).
- onBlur pattern en creditoLimites: dispatch onChange (UI reactiva) + upsert onBlur (1 escritura por edición).

## Bugs estructurales pendientes

- Ninguno conocido.

## Tabla de pendientes actualizada

| # | Prioridad | Tarea | Tiempo | Categoría |
|---|-----------|-------|--------|-----------|
| 1 | Alta | Merge acumulado de GENERAL-01 Fase 3 a main (después de smoke test) | 30 min | Deploy |
| 2 | Media | Capturar teléfonos de 4 operadores sin WhatsApp (Javier, Jesús, Manuel, Ramón) | 10 min | Data |
| 3 | Media | Fix bug calculadora diesel: fetch directo a maquinaria_consumos al abrir modal | 30 min | Bug |
| 4 | Baja | Actualizar supabase-js (warning httpSend) | 15 min | Infra |
| 5 | Baja | Limpiar dead code: helper restore en App.jsx, comentarios stale en PERSIST_KEYS/IIFE | 15 min | Refactor |
| 6 | Baja | Migrar PATCH inline de OrdenDia (completar/editar) a supabaseWriters.js | 30 min | Refactor |
| 7 | Futuro | Permisos/roles Grupo C restante → Supabase (permisosGranulares, rolesPersonalizados, etc.) | 2 hrs | Arquitectura |
| 8 | Futuro | Diesel: asignar productor automático desde lote al cargar tractor | 45 min | Feature |
| 9 | Futuro | Panel Daniela: exportación a formatos contables | 2 hrs | Feature |
| 10 | Futuro | Modo offline (IndexedDB + SW) | 8+ hrs | Feature |
| 11 | Futuro | Seguridad: quitar passwords de roles.js, JWT real | 2 hrs | Seguridad |

## Siguiente sesión — recomendación

**Smoke test + merge a main**: probar en dev los módulos afectados por GENERAL-01 Fase 3 (Configuracion → alertas y crédito params, Credito → guardar params, Costos → precio/rendimiento, Ciclos → crear cultivo/variedad). Si todo pasa, merge a main con tag de respaldo. Después, atacar el bug de la calculadora diesel (#3).

## Reglas de trabajo

- Sesiones cortas (30-50 min base, 60-90 min cuando dimensionado)
- Diagnóstico antes que fix
- Ver archivo completo antes de editar
- Un cambio a la vez, con prueba inmediata
- Probar en local → dev → nunca directo a main
- Verificar schema Supabase antes de POST/DELETE
- Verificar con Babel parse después de edits
- Tag de respaldo antes de merge a main
- Commit y push al cierre
- docs/ NO raíz — git add docs/HANDOFF.md docs/PROGRESS.md
- HYDRATE_FROM_SUPABASE whitelist protege contra claves no-Grupo-A
- Para debugging, usar Claude Code directo (no Claude web paso a paso)
- Cualquier mapper de Supabase (loader, realtime, etc.) debe tener schema simétrico
- Verificar TODOS los paths de hidratación al añadir campo nuevo
- Al añadir una clave al loader, verificar que también esté en GRUPO_A whitelist
- Tablas nuevas en Supabase necesitan RLS policy para rol anon
- Generar id en el caller ANTES del dispatch cuando se necesita legacy_id
- Al refactorear, pasar componentes declarados en App.jsx como props (no importar — causa circular)
- Para prompts a Claude Code, dar el objetivo completo y dejar que lea el código y diseñe la solución
- Schema mismatch state↔Supabase se resuelve con JSON en columna `notas` para round-trip sin pérdida
- Nunca usar toISOString() para fechas locales en México — usar getFullYear/getMonth/getDate para evitar desfase UTC después de las 18:00 MST
- onBlur para upserts en inputs numéricos — dispatch onChange para UI, upsert onBlur para no spamear Supabase
- Tablas con upsert necesitan UNIQUE constraint — verificar antes de crear el helper
