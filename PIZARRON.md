# AgroSistema Charay — Pizarron de Trabajo
> Actualizado: 15 Abril 2026

---

## COMPLETADO

- Rediseño visual completo — paleta orgánica aprobada
  - Sidebar y topbar: #1a3a0f verde oscuro
  - Fondo contenido: #f8f6f2 crema
  - KPIs: borde superior de color semántico
  - Tipografía: Georgia serif en números y títulos
  - Cards: borde #ede5d8, borderRadius 10px
  - Botones: #1a3a0f con hover #2d5a1b
  - Tag de versión: v1.0-rediseno-20260415
- Realtime diesel entre admin y encargado (Postgres Changes + dieselChannel)
- Modulo Diesel refactorizado — 3 modales, vista unica, sin confusion de vistas
- Roles corregidos: encargado no ve precios, campo ve ordenes, socio ve credito
- Bitacora: botones visibles para encargado e ingeniero
- WhatsApp: emojis compatibles con iOS
- Selector de lotes con productor y hectareas en Ordenes del Dia y Bitacora
- IA embebida en 5 modulos con Edge Function en Supabase
- Responsive movil completo en todos los modulos
- diesel(30) restaurados con productor_legacy_id correcto
- Estado de Cuenta muestra diesel por productor
- Notificaciones push PWA con sesión persistente 8h
- Safe area iOS en topbar y content para PWA instalada

---

## PENDIENTE — REVISAR CON CALMA

- SONIA legacy_id: registro 2025-12-31 asignado a legacy_id 12 (MIRANDA) en lugar de 17 (SONIA MARLEN) — verificar si afecta estado de cuenta
- Discrepancias en cuentas de diesel: asignacion manual historica vs nuevo modelo de cilindro — necesita revision contable
- Diesel cargas a productor: cuando encargado carga tractor por lote, deducir productor del lote automaticamente (pendiente implementar)

---

## SUPABASE — TABLAS

- productores (17)
- lotes (107)
- ciclos (1 — OI 2025-2026)
- ciclo_asignaciones (107) — 455.88 ha total
- expedientes (15) — $15.7M credito parafinanciero
- operadores (5)
- maquinaria (5)
- insumos (105)
- dispersiones (148)
- egresos_manual (212)
- diesel (30) — con productor_legacy_id correcto
- ordenes_trabajo (activo, realtime)

---

## MAPA DE USUARIOS

- admin/123123 — Todo
- daniela/871005 — Todo
- socio/agro2025 — Solo lectura financiero (+ credito y egresos)
- encargado/charay25 — Campo, ordenes, bitacora, lotes, maquinaria, operadores, insumos (sin precios), diesel (sin precios ni registro)
- ingeniero/ing2025 — Lotes, bitacora, insumos sin precios, ordenes (lectura)
- compras/compras25 — Insumos, diesel, inventario, lotes y bitacora (lectura)
- campo/campo2025 — Ordenes del dia (lectura), bitacora, lotes, diesel (lectura)
- Tractoristas — sin usuario, reciben WhatsApp

---

## FLUJO DIESEL (nuevo modelo)

- Compra → Admin/Compras registra entrada al cilindro → saldo sube
- Carga tractor → Encargado registra salida interna → saldo baja → espejo en bitacora automatico
- Gasolinera → Admin/Compras registra salida externa → NO afecta cilindro
- Saldo realtime entre todos los usuarios via Postgres Changes
- Historico: 30 registros del ciclo OI 2025-2026 vinculados a productores

---

## NOTAS TECNICAS

- Rama dev = produccion en Vercel (agro-charay-dev.vercel.app)
- Supabase: oryixvodfqojunnqbkln.supabase.co
- GitHub: github.com/mickyarambula/agro-charay
- Telefono prueba Renato Urias: 6682226861
- Ultimo commit: 81352b0

---

## FASE 2 — COSECHA Y LIQUIDACIÓN

### Los dos momentos del ciclo:

MOMENTO 1 — Ya ocurrió (lo que muestra el sistema hoy):
- El banco prestó $21.1M (parafinanciero + directo)
- Se usó en semilla, insumos, renta, agua, diesel, etc.
- Intereses $957K y comisiones $864K acumulados pero AÚN NO pagados

MOMENTO 2 — Cuando llegue la cosecha (Fase 2 pendiente):
1. Vender el grano → registrar toneladas reales x precio real
2. Pagar al banco → capital + intereses + comisiones
3. El sistema calcula utilidad o pérdida REAL
4. Estado final por productor para liquidar

### Pendiente construir en Fase 2:
- Módulo Cosecha: boletas reales, precio, humedad, merma
- Ingresos parciales (cuando se vende por partes)
- Pago de crédito vinculado al ingreso real
- Cierre de ciclo y apertura del siguiente
