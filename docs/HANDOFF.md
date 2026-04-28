# AgroSistema Charay — HANDOFF

**Última actualización:** 27 Abril 2026 (noche, fin del día)
**Branch activo:** dev
**Último commit dev:** 4491829 (feat(cosecha): renombrar UI Cuadrillas→Trilla y Maquila→Criba)
**Último commit main:** 8738b93 (merge: fix DIESEL-AUTOFILL-01)
**Tag de respaldo:** backup-pre-merge-25abr2026-autofill
**Estado:** Cosecha avanzada. Importación XLSX y persistencia funcionando. Renombrado UI a terminología real (Trilla/Criba). Liquidación pendiente de probar.

## Estado al cierre del día

- DIESEL-AUTOFILL-01 resuelto y en producción.
- Calculadora diesel verificada funcionando (no requirió fix).
- Auditoría exhaustiva: el sistema está mucho más completo de lo que el HANDOFF anterior documentaba. 8 migraciones a Supabase ya hechas, no las "21 candidatos" que decía.
- Cosecha 95% lista: 5 tablas wired (boletas, cuadrillas, fletes, maquila, secado), liquidaciones funciona end-to-end (con fetch inline como deuda técnica menor).
- Smoke test Cosecha:
  - Test #1 Importación XLSX: ✅ pasó (3 boletas, fuzzy match correcto).
  - Test #2 Persistencia Supabase: ✅ pasó (productor_id asignado, kg correctos).
  - Test #3 Modal Trilla: ✅ pasó (registro de prueba 20ha × $2000 = $40,000 guardado y luego limpiado).
  - Test #4 Liquidación: ⏸️ pendiente para mañana.
- Renombrado UI Cosecha: Cuadrillas → 🌾 Trilla, Maquila → 🧹 Criba. Sin migración de tablas Supabase (mantienen sus nombres internos).

## Bugs estructurales pendientes

- Ninguno abierto.

## Cosecha — gaps menores detectados

- Captura individual de boletas (1 por 1) NO existe. Solo importación masiva XLSX. Posiblemente decisión de diseño.
- Schema mismatch documentado: cosecha_cuadrillas tiene columnas (nombre, responsable, integrantes, tarifa) pero el código guarda fecha/ha/precio_ha/concepto en columna notas como JSON. Funciona, es deuda técnica.
- postLiquidacion es fetch inline en Cosecha.jsx:911, no hay wrapper. Funciona.
- Parser XLSX no llena lote_id, impurezas, precio_kg, importe, destino. Evaluar si es bloqueante.

## Plan pre-cosecha (3-4 semanas, ~8-10 sesiones)

### Sprint 1 — Bloqueantes cosecha (semana 1)
1. Probar Liquidación (modal cierre por productor) — 30 min — MAÑANA
2. Decidir: captura individual de boletas sí/no — 5-60 min
3. Reporte de cierre de ciclo (PDF/Excel para FEGA y banco) — 90 min
4. Smoke test completo por rol (admin, encargado, daniela, socio) — 60 min

### Sprint 2 — Operación campo + finanzas (semana 2)
5. Captura datos reales: consumos L/ha (T-2/T-4/T-6/T-8) — 20 min
6. Captura 4 teléfonos de operadores — 10 min
7. Auditoría rápida Activos/Personal/CreditosRef — 60 min
8. Wirear lo que falte de #7 — 60-120 min

### Sprint 3 — Pulido (semana 3)
9. Borrar src/App.jsx.bak-20260413 + limpiar TODO de CreditosRef:30 — 15 min
10. Actualizar CLAUDE.md (ya no es monolito) — 15 min
11. postLiquidacion wrapper — 30 min
12. Buffer para bugs y ajustes — 2-3 sesiones

### Fuera de scope pre-cosecha
- Permisos Grupo C → Supabase
- Push remoto (VAPID propio)
- Modo offline (IndexedDB + SW)
- CBOT precio en vivo
- Quitar passwords de roles.js / JWT real
- Dashboard histórico entre ciclos
- Alertas WhatsApp socio
- Renombrar tablas Supabase (cosecha_cuadrillas → cosecha_trilla, etc.)

## Siguiente sesión — recomendación

Mañana arrancar con Sprint 1 #1: probar el modal de Liquidación. Crear datos de prueba (1 productor con boleta + costos), abrir modal de Liquidación, verificar cálculo de cierre integra correctamente con calcularCreditoProd y guardar en tabla liquidaciones. Después Sprint 1 #2 si queda tiempo.

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
- Schema mismatch state↔Supabase se resuelve con JSON en columna notas para round-trip sin pérdida
- Nunca usar toISOString() para fechas locales en México — usar getFullYear/getMonth/getDate para evitar desfase UTC después de las 18:00 MST
- onBlur para upserts en inputs numéricos — dispatch onChange para UI, upsert onBlur para no spamear Supabase
- Tablas con upsert necesitan UNIQUE constraint — verificar antes de crear el helper
- Diagnosticar antes de asumir bug de código — verificar datos en Supabase primero
- Al enviar IDs a Supabase, siempre resolver a uuid (_uuid) — las columnas FK son uuid, no legacy_id
- Cuando un feature necesita nueva columna en Supabase, completar todo el ciclo: ALTER TABLE + loader + writer + call sites antes de probar
- Claude web siempre incluye los comandos para correr local (npm run dev, etc.) en cada bloque de instrucciones — el usuario no debe inferirlos
- Al comparar IDs entre state hidratado y datos en optLotes/optMaquinaria, considerar tanto legacy_id como _uuid — los registros viejos vs nuevos pueden venir en formato distinto post-reload
- Antes de fixear un bug viejo de la lista de pendientes, hacer diagnóstico fresco — puede haberse resuelto como efecto colateral de cambios posteriores
- Al hacer diagnóstico con console.log, usar JSON.stringify() para revelar caracteres invisibles en strings
- HANDOFF se desactualiza si no se audita periódicamente — pendientes "marcados como pendientes" pueden estar resueltos. Revisar grep + Supabase information_schema antes de planear sprints
- Smoke test no destructivo: verificar primero que tablas estén en 0 registros para usar prefijo TEST- y luego DELETE WHERE LIKE 'TEST-%'
- Renombrar UI sin renombrar tablas Supabase es seguro y rápido cuando hay datos en producción del ciclo activo. Las funciones técnicas (postCosechaCuadrilla, ADD_CUADRILLA) y nombres de tablas se mantienen.
- Claude web NO propone cierre de sesión a menos que el usuario lo pida. Trabajar en bloques continuos de horas si es necesario, no fragmentar.
