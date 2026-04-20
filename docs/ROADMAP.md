# AgroSistema Charay — Roadmap

## Visión del producto
Sistema de gestión agrícola integral para operación de riego en Sinaloa. Cubre el ciclo completo: crédito de avío → operación en campo → cosecha → liquidación. Diseñado para funcionar en campo (sin internet) y oficina (tiempo real entre roles).

---

## FASE 0 — Estabilización (URGENTE — esta semana)
Objetivo: app sin crashes, funcional para todos los roles.

- [x] Fix crash "Minified React error #31" — WidgetCBOTDashboard como prop sin pasar en todas las ocurrencias (c7004a3)
- [x] Verificar cero imports circulares: `grep -rn "from.*App.jsx" src/modules/` = vacío
- [x] Fix GENERAL-02 (reducer pisa id con Date.now) — 26 reducers corregidos (eae6d0e)
- [ ] Prueba completa por rol: admin, encargado, ingeniero, daniela
- [ ] Fix bug calculadora diesel: fetch directo a maquinaria_consumos al abrir modal

---

## FASE 1 — Campo operativo (próximas 2 semanas)
Objetivo: el encargado puede operar todo el día desde el celular sin problemas.

- [ ] Diesel: asignar productor automático desde el lote al cargar tractor
- [ ] Diesel: consumos L/ha funcionando para todos los tractores (encargado llena datos reales)
- [ ] Bitácora: migrar de localStorage a Supabase
- [ ] Órdenes del Día: prueba real con el encargado en campo
- [ ] Caja Chica: prueba flujo completo admin↔encargado con datos reales
- [ ] Modal detalle diesel: edición de registros para admin (litros, notas)

---

## FASE 2 — Modo offline (antes de próximo ciclo)
Objetivo: el encargado puede registrar sin internet y sincroniza al tener señal.

- [ ] IndexedDB como cola de operaciones pendientes
- [ ] Service Worker con Workbox para cache de activos
- [ ] Indicador visual en topbar: "Sin conexión — X operaciones pendientes"
- [ ] Sincronización automática al reconectar
- [ ] Resolución de conflictos por timestamp
- [ ] Módulos críticos offline: Órdenes del Día, Bitácora, Diesel, Caja Chica
- [ ] Módulos solo lectura offline: Lotes, Maquinaria, Operadores

---

## FASE 3 — Finanzas completas (antes de cosecha)
Objetivo: estados financieros precisos, Daniela puede exportar sin pedir ayuda.

- [x] Capital propio: migrar aportaciones/retiros a Supabase (3b2d789)
- [ ] Balance General: capital propio real (hoy vacío)
- [ ] Panel Daniela: exportación a formatos contables
- [ ] CBOT: precio en vivo desde API (hoy manual)
- [ ] Dashboard histórico: comparar OI vs PV entre ciclos
- [ ] Alertas WhatsApp al socio: resumen semanal automático (Twilio)

---

## FASE 4 — Cosecha y liquidación (cuando llegue la cosecha)
Objetivo: cerrar el ciclo financiero completo.

- [ ] Boletas reales de cosecha: importación y validación
- [ ] Pago al banco: registro de liquidación al acreditante
- [ ] Cierre financiero del ciclo: estado final por productor
- [ ] Apertura del nuevo ciclo: migración de lotes y productores
- [ ] Reporte final del ciclo: PDF/Excel para FEGA y banco

---

## IDEAS FUTURAS (backlog)
- App simplificada para tractoristas (solo registrar horas)
- Foto de evidencia en bitácora (geolocalización opcional)
- Dashboard comparativo entre ciclos (histórico de rentabilidad)
- Detección de consumo excesivo de diesel por tractor (mantenimiento)
- Integración con balanza de cosecha para boletas automáticas
- Portal de productores: cada quien ve su estado de cuenta

---

## Métricas de éxito
- Cero crashes en producción durante el ciclo
- Encargado opera sin internet en campo
- Daniela genera reportes sin soporte técnico
- Liquidación del ciclo procesada en el sistema (no en Excel)
