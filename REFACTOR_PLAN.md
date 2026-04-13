# Refactor de App.jsx — Plan de Continuación

## Estado actual

Rama: `refactor/modulos`

### Progreso

**Foundation completa:**

| Archivo | Estado | Integrado |
|---|---|---|
| `src/shared/roles.js` | ✅ Creado | ✅ Sí (App.jsx importa) |
| `src/shared/utils.js` | ✅ Creado (645 líneas) | ❌ No |
| `src/shared/Modal.jsx` | ✅ Creado (118 líneas) | ❌ No |
| `src/core/supabase.js` | ✅ Creado (26 líneas) | ❌ No |
| `src/core/DataContext.jsx` | ✅ Creado (534 líneas) | ❌ No |

**Módulos extraídos:** 0 de 25.

**Build actual:** ✅ Pasa (los archivos foundation no integrados no se importan, no afectan el bundle).

---

## Qué contiene cada archivo foundation

### `src/shared/roles.js` (YA integrado)
- `ROLES`, `ACCESO`, `USUARIOS`
- `getRolPermisos(state, rolId)`
- `getRolesDisponibles(state)`
- `getRolInfo(state, rolId)`
- `getPermisosUsuario(state, userId, rol)`

### `src/shared/utils.js`
- `T` — paleta de colores del tema
- `css` — template literal con todo el CSS-in-JS
- **Side effect al importar:** inyecta `<link>` de Google Fonts y `<style>` del CSS en `document.head`
- `confirmarEliminar`, `puedeEliminarLote`, `puedeEliminarProductor`, `puedeEliminarMaquina`, `puedeEliminarOperador`
- `MOTIVOS_CANCELACION`
- `CULTIVOS`, `ESTADOS_FENOL`, `TIPOS_TRABAJO`, `CAT_INSUMO`, `UNIDADES`, `CAT_GASTO`
- `filtrarPorProductor`, `PROD_COLORES`, `ordenarProductores`, `nomCompleto`
- `mxnFmt`, `fmt`, `today`, `fenologiaColor`, `estadoColor`

### `src/shared/Modal.jsx`
- `Modal`, `ModalCancelacion`, `ModalReactivacion`
- `BadgeCancelado`
- `BtnExport`, `NavBadge`
- Importa `T` y `MOTIVOS_CANCELACION` desde `./utils.js`

### `src/core/supabase.js`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SYNC_CHANNEL`, `SYNC_KEYS`
- `supabaseClient` — cliente inicializado (null si falla)

### `src/core/DataContext.jsx`
- `initState` (objeto grande con todo el state inicial)
- `reducer` (función con ~150 case statements)
- `Ctx`, `useData` hook
- **Falta:** wrappear en un `DataProvider` component si quieres encapsular el `useReducer` ahí. Actualmente App.jsx hace `useReducer(reducer, ...)` directamente.
- Importa `ACCESO` desde `../shared/roles.js`

---

## Siguiente sesión — Paso 1: Integrar foundation en App.jsx

Esto es lo primero a hacer. Secuencia:

### 1.1 Añadir imports al top de App.jsx

Después de las líneas de import existentes, añade:

```js
import {
  T, css, confirmarEliminar, puedeEliminarLote, puedeEliminarProductor,
  puedeEliminarMaquina, puedeEliminarOperador, MOTIVOS_CANCELACION,
  CULTIVOS, ESTADOS_FENOL, TIPOS_TRABAJO, CAT_INSUMO, UNIDADES, CAT_GASTO,
  filtrarPorProductor, PROD_COLORES, ordenarProductores, nomCompleto,
  mxnFmt, fmt, today, fenologiaColor, estadoColor
} from "./shared/utils.js";

import {
  Modal, ModalCancelacion, ModalReactivacion, BadgeCancelado,
  BtnExport, NavBadge
} from "./shared/Modal.jsx";

import {
  SUPABASE_URL, SUPABASE_ANON_KEY, SYNC_CHANNEL, SYNC_KEYS, supabaseClient
} from "./core/supabase.js";

import { initState, reducer, Ctx, useData } from "./core/DataContext.jsx";
```

### 1.2 Eliminar duplicados de App.jsx

Las siguientes declaraciones están ahora en archivos foundation y deben BORRARSE de App.jsx (cuidado con el orden — hay dependencias):

| Qué borrar | Líneas aprox |
|---|---|
| `const confirmarEliminar = ...` | 32-36 |
| `const puedeEliminarLote = ...` | 41-69 |
| `const puedeEliminarProductor = ...` | 71-104 |
| `const puedeEliminarMaquina = ...` | 106-114 |
| `const puedeEliminarOperador = ...` | 116-124 |
| `const MOTIVOS_CANCELACION = ...` | 126-132 |
| `function ModalCancelacion(...)` | 134-167 |
| `function ModalReactivacion(...)` | 169-203 |
| `function BadgeCancelado(...)` | 205-215 |
| Inicialización de Supabase (`const SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SYNC_CHANNEL`, `SYNC_KEYS`, `let supabaseClient = null; try { ... }`) | ~8-24 |
| `const fontLink = ...` | 285-288 |
| `const T = { ... }` | 291-309 |
| `const css = \`...\`` | 310-733 |
| `const styleEl = ...` | 736-738 |
| `const Ctx = createContext(null)` | 870 |
| `const CULTIVOS = ...` | 872 |
| `const ESTADOS_FENOL = ...` | 873 |
| `const TIPOS_TRABAJO = ...` | 874 |
| `const CAT_INSUMO = ...` | 876 |
| `const UNIDADES = ...` | 877 |
| `const CAT_GASTO = ...` | 878 |
| `const initState = { ... }` | 886-1115 |
| `function reducer(s, a) { ... }` | 1117-1404 |
| `function useData() { ... }` | 1406 |
| `function filtrarPorProductor(...)` | 1412-1433 |
| `const PROD_COLORES = ...` | 1435 |
| `function ordenarProductores(...)` | 1437-1447 |
| `function nomCompleto(...)` | 1449-??? |
| `function Modal(...)` | ~2546 |
| `function BtnExport(...)` | ~2500 |
| `function NavBadge(...)` | ~2764 |

**IMPORTANTE — después de borrar cada bloque, corre `npm run build` para verificar.**

Los duplicados de `mxnFmt`, `fmt`, `today`, `fenologiaColor`, `estadoColor` que están dentro de módulos (como `const mxnFmt = ...` local a un módulo) pueden dejarse por ahora. Se limpian cuando extraigas ese módulo a su propio archivo.

### 1.3 Build final después de integración

```bash
cd ~/Desktop/agro-charay && npm run build
```

Debe pasar. Si falla, el mensaje de error indica qué falta o qué se duplica.

---

## Siguiente sesión — Paso 2: Extraer módulos uno por uno

Una vez que el foundation está integrado y `npm run build` pasa, empieza la extracción de módulos. **Un módulo a la vez, build después de cada uno.**

### Patrón general

Para extraer `ProductoresModule` (ejemplo):

1. **Buscar la función en App.jsx:**
   ```bash
   grep -n "^function ProductoresModule" src/App.jsx
   ```

2. **Identificar helpers que usa el módulo:**
   - Los que ya están en shared/utils.js o shared/Modal.jsx → se importan de ahí
   - Los que son específicos del módulo (ej. `exportarExcelProductor`, `generarHTMLProductor`, `calcularCreditoProd`) → se mueven junto con el módulo

3. **Crear el archivo nuevo en `src/modules/Productores.jsx`:**
   ```jsx
   import React, { useState, useRef } from 'react';
   import { useData } from '../core/DataContext.jsx';
   import { T, mxnFmt, confirmarEliminar, puedeEliminarProductor,
            nomCompleto, ordenarProductores, PROD_COLORES } from '../shared/utils.js';
   import { Modal, BadgeCancelado, BtnExport } from '../shared/Modal.jsx';
   import { getRolInfo } from '../shared/roles.js';

   // Helpers locales del módulo (copiar de App.jsx)
   function calcularCreditoProd(prodId, state) { ... }
   function exportarExcelProductor(p, datos, state) { ... }
   function generarHTMLProductor(p, datos, state) { ... }

   export default function ProductoresModule({ userRol, puedeEditar, onNavigate }) {
     // ... código de la función, sin cambios
   }
   ```

4. **En App.jsx:**
   - Añadir al top: `import ProductoresModule from "./modules/Productores.jsx";`
   - Borrar la función `ProductoresModule` completa
   - Borrar los helpers locales que se movieron (si no son usados por otros módulos)

5. **Build:**
   ```bash
   npm run build
   ```

6. **Si pasa, commit:**
   ```bash
   git add -A && git commit -m "refactor: extraer ProductoresModule"
   ```

7. **Siguiente módulo.**

### Lista de módulos a extraer (por orden sugerido, simples primero)

1. `Rentas.jsx` — `RentasModule` (simple, pocas dependencias)
2. `Capital.jsx` — `CapitalModule`
3. `Activos.jsx` — `ActivosModule`
4. `Operadores.jsx` — `OperadoresModule`
5. `Maquinaria.jsx` — `MaquinariaModule`
6. `Personal.jsx` — `PersonalModule`
7. `Reportes.jsx` — `ReportesModule`
8. `Cosecha.jsx` — `CosechaModule`
9. `Inventario.jsx` — `InventarioModule`
10. `Lotes.jsx` — `LotesModule`
11. `Bitacora.jsx` — `BitacoraModule`
12. `Ciclos.jsx` — `CiclosModule`
13. `Insumos.jsx` — `InsumosModule`
14. `Diesel.jsx` — `DieselModule`
15. `Egresos.jsx` — `EgresosModule`
16. `Credito.jsx` — `CreditoModule`
17. `Dashboard.jsx` — `Dashboard`
18. `DashboardCampo.jsx` — `DashboardCampo`
19. `Productores.jsx` — `ProductoresModule` (complejo, muchas dependencias)
20. `Configuracion.jsx` — `ConfiguracionModule` (complejo, UI grande)
21. `Flujos.jsx` — `FlujoModule` (complejo, muchas sub-UIs)
22. `Costos.jsx` — `CostosModule`
23. `Proyeccion.jsx` — `ProyeccionModule`
24. `EdoResultados.jsx`, `Balance.jsx`, `FlujoCaja.jsx` — los 3 estados financieros
25. `Asiste.jsx` — `AsisteModule` (usa API de Gemini, delicado)

### Componentes auxiliares que quedan en App.jsx

Estos NO son módulos de negocio sino piezas del shell de la app. Déjalos en App.jsx:

- `LoginScreen`
- `ProductorSelector` (se usa en el topbar)
- `WidgetCBOTCompact`, `WidgetCBOTDashboard` + `_mercadoState`, `useMercadoGlobal`, `calcPrecioMaiz`, `aplicarMercado`
- `PanelAlertas`
- `FiltroSelect` (o moverlo a shared/Modal.jsx si prefieres)
- `MUNICIPIOS_SINALOA`, `useComboDinamico`, `ComboConNuevo`
- La función `App()` raíz con el router/layout

---

## Archivos pendientes antes de dar por terminado

- [ ] Integración foundation en App.jsx
- [ ] Extracción de los 25 módulos
- [ ] Verificar que `npm run build` pasa
- [ ] `git add -A && git commit -m "refactor: separar App.jsx en módulos"`
- [ ] `git push origin refactor/modulos`
- [ ] PR a `dev` (opcional) o merge directo

---

## Nota sobre escala

El refactor completo requiere aproximadamente 150-200 operaciones (edits, reads, builds). En una sesión de chat típica no cabe. Divide en varias sesiones:

- **Sesión 1:** Foundation creada (hecho)
- **Sesión 2:** Integración foundation + extraer 5-8 módulos simples
- **Sesión 3:** Extraer 8-10 módulos medios
- **Sesión 4:** Extraer los complejos (FlujoModule, ConfiguracionModule, ProductoresModule)
- **Sesión 5:** Cleanup final + commit + push
