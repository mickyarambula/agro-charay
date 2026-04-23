# AgroSistema Charay — HANDOFF

**Última actualización:** 23 Abril 2026 (mañana)
**Branch activo:** dev
**Último commit dev:** 72837fd (feat(operadores): migrar asistencias + pagosSemana de localStorage a Supabase)
**Último commit main:** 9b080ac (merge: MAQUINARIA-CONSUMOS-01 fix + docs)
**Tag de respaldo:** backup-pre-merge-22abr2026-session3
**Estado:** 3 claves residuales migradas a Supabase (tarifaStd, asistencias, pagosSemana). MAQUINARIA-CONSUMOS-01 en main. Pendiente merge de sesión actual.

## Estado al cierre

- Merge a main: MAQUINARIA-CONSUMOS-01 (tag backup-pre-merge-22abr2026-session3, main=9b080ac).
- tarifaStd migrada a Supabase: tabla tarifa_std (singleton), helper updateTarifaStd, RLS anon+authenticated.
- asistencias migrada a Supabase: tabla asistencias (legacy_id bigint UNIQUE), helpers postAsistencia/deleteAsistencia.
- pagosSemana migrada a Supabase: tabla pagos_semana (semana text UNIQUE, detalle jsonb), helpers postPagoSemana/deletePagoSemana, UPSERT por on_conflict=semana.
- GRUPO_A whitelist actualizada: +tarifaStd, +asistencias, +pagosSemana, +maquinariaConsumos.
- PERSIST_KEYS reducida: removidas tarifaStd, asistencias, pagosSemana.
- GENERAL-01 Fases 1-3 confirmadas completas. Solo quedan 2 claves residuales sin tabla Supabase: horasMaq, proyeccion.
- Lección RLS: tablas nuevas necesitan policy para rol `anon` además de `authenticated` — el proyecto usa anon key para todos los writes.

## Cambios técnicos de esta sesión

1. **Merge a main**: MAQUINARIA-CONSUMOS-01 → main 9b080ac (session3 tag).
2. **MAQUINARIA-CONSUMOS-01**: URL on_conflict + id removido del body + feedback visual botón + maquinariaConsumos en GRUPO_A.
3. **tarifa_std**: tabla creada (singleton), RLS anon+auth, fetch en loader, updateTarifaStd en writers, Operadores.jsx cableado.
4. **asistencias**: tabla recreada (schema alineado con código), RLS, fetch en loader, postAsistencia/deleteAsistencia en writers, 3 call sites en Operadores.jsx (guardarDia DEL+ADD, botón 🗑).
5. **pagos_semana**: tabla recreada (schema alineado), RLS, fetch en loader, postPagoSemana (UPSERT)/deletePagoSemana en writers, 2 call sites en Operadores.jsx (ADD/UPD).
6. **DataContext.jsx**: GRUPO_A +maquinariaConsumos, +tarifaStd, +asistencias, +pagosSemana.
7. **App.jsx**: PERSIST_KEYS y savedState IIFE limpiados de las 3 claves migradas.

## Bugs estructurales pendientes

Ninguno conocido activo.

## Tabla de pendientes actualizada

| # | Prioridad | Tarea | Tiempo | Categoría |
|---|-----------|-------|--------|-----------|
| 1 | Media | Verificar dev URL (tarifaStd + asistencias + pagosSemana) → merge a main | 20 min | Deploy |
| 2 | Baja | Migrar horasMaq a Supabase (o deprecar a favor de bitácora) | 30 min | Migración |
| 3 | Baja | Migrar proyeccion a Supabase | 45 min | Migración |
| 4 | Media | Refactor App.jsx — extraer routes | 45 min | Refactor |
| 5 | Baja | Actualizar supabase-js (warning httpSend) | 15 min | Infra |
| 6 | Baja | Alertas WhatsApp al socio | 2 hrs | Feature |
| 7 | Baja | Dashboard histórico entre ciclos | 3 hrs | Feature |
| 8 | Futuro | DashboardCampo Phase 1 — móvil encargado | 2 hrs | Feature |
| 9 | Futuro | Cosecha Fase 2: boletas → pago banco → cierre | 3 hrs | Cuando llegue cosecha |

## Siguiente sesión — recomendación

**Opción A: #1 — Verificar dev URL + merge a main (20 min).** Clear site data en agro-charay-dev.vercel.app, smoke test tarifaStd + asistencias + pagosSemana + maquinaria consumos, tag backup, merge.

**Opción B: #2/#3 — Migrar horasMaq o proyeccion (30-45 min).** Las últimas 2 claves residuales. horasMaq podría deprecarse si bitácora cubre los casos.

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
- Verificar TODOS los paths de hidratación al añadir campo nuevo (loader + realtime channels + cualquier otro mapper)
- Al añadir una clave al loader, verificar que también esté en GRUPO_A whitelist — sin esto los datos se descartan silenciosamente
- **NUEVO: Tablas nuevas en Supabase necesitan RLS policy para rol `anon` — el proyecto usa anon key, no JWT autenticado**
- **NUEVO: Generar id en el caller ANTES del dispatch cuando se necesita legacy_id para Supabase — el reducer genera id internamente pero no lo expone al caller**
