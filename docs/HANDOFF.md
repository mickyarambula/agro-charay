# AgroSistema Charay — HANDOFF

**Última actualización:** 27 Abril 2026 (tarde, sesión 6)
**Branch activo:** dev
**Último commit dev:** 7130047 (docs: cierre sesión 5 — DIESEL-AUTOFILL-01 resuelto y en producción)
**Último commit main:** 8738b93 (merge: fix DIESEL-AUTOFILL-01 — autofill lote post-reload)
**Tag de respaldo:** backup-pre-merge-25abr2026-autofill
**Estado:** App estable. Bug calculadora diesel ya estaba resuelto (verificado por diagnóstico). Sin bugs urgentes.

## Estado al cierre

- Diagnóstico exhaustivo de calculadora diesel: el bug "Sin consumo configurado" reportado en DECISIONS.md ya estaba resuelto. Probablemente como efecto colateral del fetch directo en Diesel.jsx (líneas 44-76) o de fixes previos en el ciclo loader/writer.
- Smoke test confirmó funcionamiento: T-1 + Fertilización + 6 ha → "✅ Diesel suficiente — necesitas 60L, cargas 90L (30L de margen)".
- 35 registros en maquinaria_consumos (5 tractores × 7 labores) con UUIDs correctos en Supabase.
- Sin código modificado en esta sesión — solo verificación.

## Bugs estructurales pendientes

- Ninguno abierto.

## Tabla de pendientes actualizada

| # | Prioridad | Tarea | Tiempo | Categoría |
|---|-----------|-------|--------|-----------|
| 1 | Media | Encargado: ajustar consumos L/ha reales para T-2, T-4, T-6, Aspersora T-8 | 20 min | Data |
| 2 | Media | Capturar teléfonos de 4 operadores sin WhatsApp | 10 min | Data |
| 3 | Media | Actualizar CLAUDE.md — ya no es monolito App.jsx 18.7k líneas, está modularizado en src/modules/, src/core/, src/shared/ | 15 min | Docs |
| 4 | Futuro | Permisos/roles Grupo C restante → Supabase | 2 hrs | Arquitectura |
| 5 | Futuro | Panel Daniela: exportación a formatos contables | 2 hrs | Feature |
| 6 | Futuro | Modo offline (IndexedDB + SW) | 8+ hrs | Feature |
| 7 | Futuro | Seguridad: quitar passwords de roles.js, JWT real | 2 hrs | Seguridad |
| 8 | Futuro | Modal detalle diesel: edición de registros para admin (litros, notas) | 45 min | Feature |
| 9 | Futuro | Dashboard histórico entre ciclos | 3 hrs | Feature |
| 10 | Futuro | Alertas WhatsApp al socio (resumen semanal) | 4 hrs | Feature |
| 11 | Futuro | Push notifications remoto (VAPID propio + backend Supabase Edge Function) | 3 hrs | Feature |

## Siguiente sesión — recomendación

Tareas cortas y de valor: actualizar CLAUDE.md (la doc dice monolito pero ya está modularizado) o avanzar Panel Daniela exportación contable. Sin bugs urgentes pendientes.

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
- Al hacer diagnóstico con console.log, usar JSON.stringify() para revelar caracteres invisibles en strings; el primer maqConsumos[0] no necesariamente es del tractor buscado — usar filter() para ver los registros relevantes
