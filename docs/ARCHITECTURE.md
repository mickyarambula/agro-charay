# AgroSistema Charay — Architecture

## Stack
- **Frontend**: React 18 + Vite (SPA)
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Deploy**: Vercel — rama `dev` → agro-charay-dev.vercel.app | rama `main` → agro-charay.vercel.app
- **Repo**: github.com/mickyarambula/agro-charay
- **Local**: ~/Desktop/agro-charay

## File Structure
```
src/
├── App.jsx                    # Root: routing, login, sidebar, topbar, realtime channels
├── main.jsx                   # Entry point
├── supabaseLoader.js          # Carga inicial de todas las tablas al state global
├── core/
│   ├── DataContext.jsx        # Estado global (useReducer + Context), todos los reducers
│   ├── supabase.js            # Cliente Supabase, SUPABASE_URL, SUPABASE_ANON_KEY
│   └── push.js                # Notificaciones push PWA
├── shared/
│   ├── helpers.jsx            # Funciones financieras: calcularFinancieros, calcularCreditoProd,
│   │                          # calcularInteresCredito, exportarResumenCiclo, etc.
│   ├── utils.js               # Formatters (mxnFmt, fmt), constantes (CAPACIDAD_TANQUE_DIESEL,
│   │                          # CULTIVOS, TIPOS_TRABAJO, CAT_INSUMO, etc.), funciones auxiliares
│   ├── roles.js               # USUARIOS[], ROLES{}, ACCESO{} por módulo, getRolPermisos()
│   └── Modal.jsx              # Modal, ModalCancelacion, BadgeCancelado, BtnExport, NavBadge
├── components/
│   ├── AIInsight.jsx          # Componente de análisis IA
│   └── mobile/
│       ├── useIsMobile.js     # Hook detección móvil
│       ├── BottomSheet.jsx    # Sheet modal para móvil
│       ├── MobileCard.jsx     # Card responsive
│       ├── SkeletonCard.jsx   # Loading skeleton
│       └── Toast.jsx          # Notificaciones toast
└── modules/                   # 32 módulos independientes (ver DECISIONS.md)
```

## Data Flow
1. **Login**: handleLogin → fetch a tabla `usuarios` en Supabase → si match, signInWithPassword Auth → setUsuario/setRol
2. **Carga inicial**: supabaseLoader.js → Promise.all de ~20 tablas → dispatch al estado global
3. **Cambios del usuario**: dispatch local (UI inmediata) → POST/PATCH a Supabase en background
4. **Realtime**: canales Postgres Changes para diesel, ordenes_trabajo, caja_chica_fondos/movimientos
5. **Sesión**: Supabase Auth JWT (persistSession:true) + fallback localStorage 8h

## State Management
```javascript
// DataContext.jsx — estado global
const initState = {
  productores: [], lotes: [], ciclos: [], cicloActivoId: null,
  expedientes: [], dispersiones: [], egresosManual: [],
  insumos: [], diesel: [], maquinaria: [], maquinariaConsumos: [],
  operadores: [], inventario: { items: [], movimientos: [] },
  cajaChicaFondo: null, cajaChicaMovimientos: [],
  liquidaciones: [], ordenesTrabajo: [],
  bitacora: [], capital: { aportaciones: [], retiros: [] },
  cosecha: { boletas: [], cuadrillas: [], fletes: [], maquila: [], secado: [] },
  paramsCultivo: {}, fechaPrecio: null,
  usuariosDB: [], maquinariaConsumos: [],
}
```

## REGLA CRÍTICA — Imports
**NUNCA importar desde App.jsx en módulos hijos.** Causa dependencia circular → crash "Cannot access 'X' before initialization".

Verificar con:
```bash
grep -rn "from.*App.jsx" src/modules/
```
Debe retornar vacío. Si hay algún resultado, moverlo a shared/utils.js, shared/helpers.jsx o definirlo localmente.

## REGLA CRÍTICA — Supabase
**SIEMPRE verificar schema antes de POST/PATCH:**
```sql
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'nombre_tabla' ORDER BY ordinal_position;
```
Nunca enviar campos que no existan — causa 400/409.
