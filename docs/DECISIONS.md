# AgroSistema Charay — Decisions & Context

## Por qué existe este sistema
Sistema de gestión agrícola para una empresa de riego en el norte de Sinaloa, México.
Maneja crédito de avío (FEGA/parafinanciero + directo), operación de campo, finanzas del ciclo y liquidación al final de cosecha.

## Ciclo activo: OI 2025-2026
- 17 productores, 107 lotes, 455.88 ha
- Capital parafinanciero: $16,462,543 MXN (FEGA/parafinanciero — tasas preferenciales)
- Capital directo: $4,700,000 MXN (directo empresa — tasa 18% anual)
- Intereses acumulados: $957,231 MXN
- Comisiones: $864,948 MXN
- **TOTAL A LIQUIDAR: $22,984,723 MXN**
- Diesel: 37,000L comprados, 600L saldo actual

## Roles y usuarios
| Usuario | Password | Rol | Uso |
|---------|----------|-----|-----|
| admin | 123123 | Administrador | Miguel — acceso total |
| daniela | 871005 | Contable | Daniela — estados financieros |
| socio | agro2025 | Socio | Dirección, dashboard, crédito |
| encargado | charay25 | Encargado de Campo | Operación diaria campo |
| ingeniero | ing2025 | Ingeniero | Lotes, bitácora, insumos |
| compras | compras25 | Compras | Egresos, solicitudes |
| campo | campo2025 | Operador | Vista simplificada campo |

Contraseñas actualizables desde Configuración → Usuarios (admin). Se persisten en tabla `usuarios` de Supabase y el login las verifica fetch directo (no localStorage).

## Módulos por sección

### CAMPO Y OPERACIONES
- **OrdenDia**: Asignación de tareas a tractoristas. Genera mensaje WhatsApp. Realtime.
- **Bitacora**: Registro de labores por lote. PENDIENTE migrar a Supabase (hoy localStorage).
- **Lotes**: 107 lotes con superficie, asignación por ciclo, productor.
- **Maquinaria**: 5 tractores (UUID en Supabase). Consumos L/ha por tipo de labor (tabla maquinaria_consumos). Botón ⛽ para configurar consumos.
- **Operadores**: 5 tractoristas con asignación por tractor.
- **DashboardCampo**: Vista móvil para encargado — Phase 1 pendiente.

### INSUMOS
- **Insumos**: 105 registros. Solicitudes por productor y lote.
- **Diesel**: Cilindro 10,000L. Entradas (compra proveedor), salidas internas (carga tractor), salidas externas (gasolinera). Modal detalle al clic. Cancelación por rol (encargado: propio mismo día; admin: cualquiera). Calculadora L/ha al registrar carga (requiere maquinaria_consumos configurados). Realtime.
- **Inventario**: 25 productos en Supabase (catálogo de insumos).

### FINANCIERO — CRÉDITO
- **Credito**: Estado de cuenta por productor. Dos líneas: parafinanciero (con tasas FEGA) y directo (18% anual). Intereses calculados por ministración (calcularInteresCredito en helpers.jsx). calcularCreditoProd() es la función central — NO duplicar.
- **Egresos**: 212 registros, $9.6M. 8 categorías. Reembolsos para encargado y socio.
- **Flujos**: Solicitudes de gasto y compra. Flujo: solicitud → aprobación admin → egreso automático.
- **Capital**: Aportaciones y retiros del socio. PENDIENTE migrar a Supabase.
- **CreditosRef**: Créditos refaccionarios (maquinaria, equipos).
- **Rentas**: Contratos de arrendamiento por lote.

### FINANCIERO — ESTADOS
- **EdoResultados**: Ingresos vs egresos. Semilla separada de insumos.
- **Balance**: Activos vs pasivos. Capital propio vacío (sin aportaciones capturadas).
- **FlujoCaja**: Entradas reales, salidas operativas, pendientes de liquidar.
- **Costos**: Desglose por categoría, punto de equilibrio, costo/ha.
- **Proyeccion**: Proyectado vs real por categoría.
- **PanelDaniela**: Vista ejecutiva para Daniela y admin. 3 tabs: resumen, estado por productor, movimientos. Export Excel.

### COSECHA Y CIERRE
- **Cosecha**: Importación boletas. Liquidación por productor. PENDIENTE: ingreso real → pago banco → cierre.
- **Ciclos**: Gestión de ciclos. Persiste en Supabase.

### EMPRESA
- **Activos**: Activos fijos.
- **Personal**: Nómina y honorarios.
- **CajaChica**: Fondo variable, aprobación admin, foto ticket. Realtime admin↔encargado.
- **Reportes**: HTML y Excel por productor.
- **Asiste**: Asistente IA con contexto del ciclo.
- **Configuracion**: Usuarios/contraseñas, parámetros, monitor de errores (tabla error_logs).

## Decisiones técnicas clave

### Reducers — preservar payload.id
Usar SIEMPRE `id: a.payload.id ?? Date.now()` en reducers ADD_*. Nunca `{ ...a.payload, id: Date.now() }` porque eso pisa el legacy_id que manda el componente después del POST a Supabase. GENERAL-02 (20-abr-2026).

### calcularCreditoProd — fuente única de verdad
En helpers.jsx. Calcula para un productor: capital para, capital directo, intereses, comisiones, total a liquidar. NO duplicar esta lógica en ningún módulo.

### Autenticación en dos capas
1. Supabase Auth JWT (signInWithPassword) para sesión persistente
2. Tabla `usuarios` en Supabase como fuente de contraseñas actualizables
3. USUARIOS[] en roles.js como fallback hardcoded

### Realtime
Canales Supabase Realtime (Postgres Changes) en App.jsx para:
- `diesel` — saldo del cilindro en tiempo real
- `ordenes_trabajo` — órdenes del día entre roles
- `caja_chica_fondos` y `caja_chica_movimientos` — caja chica admin↔encargado

### Export/Respaldo
Botón 📥 en sidebar (admin y daniela). exportarResumenCiclo(state) en helpers.jsx. Genera Excel con 5 hojas: Resumen, Dispersiones, Egresos, Insumos, Diesel.

### Error monitoring
ErrorBoundary global en App.jsx. Cualquier crash de React hace POST a tabla `error_logs` en Supabase con: usuario, rol, dispositivo, URL, mensaje, stack. Monitor visible en Configuración → admin.

## Problemas que causaron el reinicio
1. **Imports circulares**: múltiples módulos importaban desde App.jsx → crash "Cannot access 'X' before initialization". Solución: NUNCA importar desde App.jsx en módulos. Definir todo localmente o en shared/.
2. **POSTs sin verificar schema**: enviaban campos inexistentes → 400/409. Solución: verificar siempre con information_schema.columns antes de escribir el body.
3. **Contexto de conversación saturado**: conversaciones muy largas degradan la calidad.

## Pendientes al momento del reinicio
1. Bug calculadora diesel: dice "Sin consumo configurado" aunque hay 7 registros en maquinaria_consumos para T-1. Root cause: race condition — modal renderiza antes de que el state esté poblado. Fix: fetch directo a Supabase al abrir el modal de carga, no depender del state global.
2. Diesel: asignar productor automático desde el lote al cargar tractor.
3. Modo offline: IndexedDB + cola de sincronización. Probado en campo sin internet — no funciona.
4. Bitácora, capital → migrar a Supabase.
5. Fase 2 cosecha: boletas reales → pago banco → cierre de ciclo.
6. Alertas WhatsApp al socio (resumen semanal).
7. Dashboard histórico entre ciclos.

## GENERAL-01 — Migración a Supabase como fuente única (21-abr-2026)

Diagnóstico reveló 35 claves del reducer viven solo en localStorage y nunca se sincronizan con Supabase. Decidido migración por fases, NO big-bang. Clasificación en 3 grupos: A (Supabase, fuente única), B (config local legítima), C (requiere decisión de negocio). Plan operacional detallado en `docs/GENERAL-01-PLAN.md`. Fase 1 (fix del ciclo de vida de las 22 claves ya en Supabase) es el próximo objetivo activo.

## GENERAL-01 Fase 2 — Decisiones Grupo C (22-abr-2026)

### Permisos y usuarios (5 claves) → Supabase
Claves: permisosUsuario, permisosGranulares, rolesPersonalizados, usuariosExtra, usuariosBaseEdit.
Decisión: migrar a Supabase (tabla config_permisos o similar) en Fase 3.
Razón: son datos de negocio (quién puede hacer qué), no preferencias de UI. localStorage es por dispositivo — si admin configura en su laptop, encargado no ve los cambios en su celular.
Prioridad: baja. Hoy los roles están hardcoded en roles.js y estas claves tienen poco uso activo.

### proyeccion → pendiente de revisión
Decisión aplazada. Necesita inspección del módulo Proyeccion para determinar si es data capturada (→ Supabase) o cálculo derivado (→ computed, no persiste). Se decide al migrar en Fase 3.
