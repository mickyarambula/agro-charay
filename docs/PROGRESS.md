# AgroSistema Charay — Progress Log

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
