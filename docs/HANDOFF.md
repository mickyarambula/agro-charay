# AgroSistema Charay — HANDOFF

**Última actualización:** 23 Abril 2026 (noche)
**Branch activo:** dev
**Último commit dev:** 025613c (fix(roles): egresos→gastos socio + feat: Toast global en 7 módulos con feedback guardado)
**Último commit main:** d2111af (merge: DashboardCampo Phase 1 + postDieselCarga helper + docs)
**Tag de respaldo:** backup-pre-merge-23abr2026-session4
**Estado:** DashboardCampo Phase 1 completado. GENERAL-01 completo. Refactor App.jsx en main. Pendiente merge de horasMaq + proyeccion + DashboardCampo Phase 1.

## Estado al cierre

- Fix egresos→gastos acceso socio. Toast global implementado en 7 módulos.
- DashboardCampo Phase 1 completado: diesel actualiza saldo cilindro, selector tractor, precio dinámico, validación saldo, botón asistencia.
- postDieselCarga helper creado en supabaseWriters.js — Diesel.jsx refactoreado para usarlo también (fix latente: legacy_id ahora se envía).
- GENERAL-01 claves residuales completas (5/5): tarifaStd, asistencias, pagosSemana, horasMaq, proyeccion.
- Refactor App.jsx: AppRouter.jsx + useAppNavigation.js extraídos (−90 líneas).
- MAQUINARIA-CONSUMOS-01 resuelto (UPSERT + display + feedback).
- BITACORA-DELETE-01 confirmado resuelto (estaba stale en el HANDOFF).
- Bitácora responsive: filtros por rango de fecha, sticky grid tipos, botón limpiar filtros.
- Diesel y OrdenDia ya eran responsive — sin cambios necesarios.
- DashboardCampo Phase 1 + postDieselCarga ya en main. Pendiente merge: responsive Bitácora.

## Cambios técnicos de esta sesión

1. **Merge a main**: tarifaStd + asistencias + pagosSemana (session1).
2. **horasMaq migrada**: tabla horas_maq + 3 espejos muertos eliminados de Bitacora.jsx.
3. **proyeccion migrada**: tabla proyeccion + fix reducer ADD_PROY id override.
4. **Merge a main**: horasMaq + proyeccion (session2).
5. **Refactor App.jsx**: AppRouter.jsx + useAppNavigation.js (−90 líneas).
6. **Merge a main**: refactor (session3 pendiente — verificar).
7. **Auditoría completa**: documento Word generado con análisis de 32 módulos, UX, seguridad, plan de acción.
8. **DashboardCampo Phase 1**:
   - postDieselCarga helper en supabaseWriters.js (58 líneas).
   - guardarDiesel reescrito: espejo bitácora → POST diesel → dispatch ADD_DIESEL → saldo actualizado.
   - Selector de tractor (maquinariaId) en modal diesel.
   - precioLitro derivado del último registro (fallback 27).
   - Validación saldo cilindro (alert + warning inline).
   - Header contextual: saldo + precio visibles.
   - productorId derivado del lote vía ciclo_asignaciones.
   - Grid 5 botones: +✅ Asistencia (full-width).
9. **Diesel.jsx refactoreado**: POST inline → postDieselCarga helper (−20 líneas netas). Fix latente: legacy_id ahora se envía en body.

## Bugs estructurales pendientes

### BITACORA-DELETE-01: RESUELTO ✅ (confirmado — fix existía desde commit 3ee9b59)
El 🗑 en Bitácora usa patrón Supabase-first: `await deleteBitacora(b.id) → if (ok) dispatch DEL_BITACORA`. Entry en HANDOFF estaba stale.

## Tabla de pendientes actualizada

| # | Prioridad | Tarea | Tiempo | Categoría |
|---|-----------|-------|--------|-----------|
| 1 | Alta | Verificar dev URL (todo) → merge a main | 20 min | Deploy |
| 2 | Baja | Centralizar POST inline restantes (OrdenDia, CajaChica) | 2 hrs | Refactor |
| 3 | Baja | Actualizar supabase-js (warning httpSend) | 15 min | Infra |
| 4 | Baja | Migrar cosecha a Supabase | 45 min | Migración |
| 5 | Futuro | DashboardCampo Phase 2: crear órdenes + WhatsApp desde dashboard | 2 hrs | Feature |
| 6 | Futuro | Modo offline (IndexedDB + SW) | 8+ hrs | Feature |
| 7 | Futuro | Seguridad: quitar passwords de roles.js, JWT real | 2 hrs | Seguridad |

## Siguiente sesión — recomendación

**Opción A: #1 — Verificar dev URL + merge a main (20 min).** Smoke test completo de DashboardCampo + migraciones.

**Opción B: #2 — BITACORA-DELETE-01 (30 min).** Bug documentado, fix trivial, alto impacto operativo.

**Opción C: #3 — Responsive módulos campo (3-4 hrs).** Diesel, Bitácora, Órdenes del Día — tablas a cards en móvil.

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
- Tablas nuevas en Supabase necesitan RLS policy para rol `anon`
- Generar id en el caller ANTES del dispatch cuando se necesita legacy_id
- Al refactorear, pasar componentes declarados en App.jsx como props (no importar — causa circular)
- **NUEVO: Para prompts a Claude Code, dar el objetivo completo y dejar que lea el código y diseñe la solución — no pedir diagnósticos parciales**
