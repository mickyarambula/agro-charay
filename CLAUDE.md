# AgroSistema Charay

Sistema de control agrícola integral para una empresa que maneja ciclos de siembra, productores, lotes, insumos, maquinaria, créditos y finanzas. Producción en https://agro-charay.vercel.app.

## Stack

- **Vite 5 + React 18** (JavaScript puro, sin TypeScript)
- **Vercel** para hosting (`framework: vite`, Node 24)
- **localStorage** para persistencia — no hay backend, todo el estado vive en el navegador
- **SheetJS (XLSX)** cargado por CDN on-demand para exportar a Excel

## Arquitectura inusual: todo en un solo archivo

**`src/App.jsx` tiene ~18,700 líneas.** Contiene TODO: constantes, state inicial, reducer, context, todos los módulos, estilos CSS-in-JS, y el componente raíz. No es un error arquitectónico — es una decisión deliberada para mantener el bundle deployable sin tooling complejo.

Implicaciones prácticas:
- No leas el archivo completo con `Read` (falla por tamaño). Usa `Grep` + `Read` con `offset`/`limit` en la zona que te importa.
- Para cambios masivos (>20 ediciones mecánicas), escribe un script node temporal en lugar de hacer 50+ llamadas de `Edit`.
- Los números de línea cambian con cada edit — re-grepear antes de cada edit es más confiable que recordar offsets.

## Modelo de dominio clave

- **Ciclo agrícola**: contenedor raíz de una temporada (p.ej. "OI 2025-2026"). Hay un `cicloActivoId` global que filtra casi todo.
- **Productor**: persona física o moral. Tiene lotes, expedientes de crédito, dispersiones, egresos.
- **Lote**: parcela asignada a un productor dentro de un ciclo, con cultivo y variedad.
- **Asignación** (`ciclos[i].asignaciones`): enlaza productor + lote + cultivo + variedad en el ciclo.
- **Productor activo** (`productorActivo`): selector global en el topbar; cuando está seteado, los módulos filtran por ese productor.
- **Línea de crédito**: `parafinanciero` vs `directo` — tasas distintas y cálculo de intereses diferente.

## Sistema de permisos granulares

Reemplazó el sistema viejo de roles fijos. Vive en `state.permisosGranulares`:

```js
{ [userId]: { [moduleId]: "ver" | "editar" } }
```

- Helper: `getPermisosUsuario(state, userId, rol)` en la zona del reducer. Admin siempre recibe `editar` en todo. Sin entrada granular → fallback a `ACCESO[rol]` con nivel `"ver"`.
- El `App` raíz computa `permisosActual` y pasa `puedeEditar` como prop a cada módulo en `renderPage`.
- Convención en los módulos: `puedeEditar` controla agregar/editar/cancelar/reactivar. `userRol==="admin"` sigue controlando **borrar datos históricos** (🗑, `confirmarEliminar`, `btn-danger`) y acceso al `ConfiguracionModule`.
- UI de administración en `ConfiguracionModule` tab "Permisos de Acceso": selecciona usuario → 3 botones por módulo (Sin acceso / Solo ver / Ver y editar).

Al editar módulos, respeta la convención `puedeEditar` vs `userRol==="admin"`. No hagas replace blanket.

## State y reducer

- Único reducer gigante con muchos `case`s. Acciones útiles: `SET_PERMISOS_USUARIO`, `UPD_PERMISOS_ROL` (legacy), `SET_CICLO_ACTIVO_ID`, `SET_PRODUCTOR_ACTIVO`, `UPD_USUARIO_BASE`, `UPD_USUARIO_EXTRA`, `ADD_USUARIO_EXTRA`.
- Persistencia: `useEffect([state])` serializa a `localStorage.agroSistemaState`. Si agregas campos nuevos al state, **también añadilos a los bloques save y load** (`parsed.XXX || default` en load, `state.XXX || default` en save), o se perderán al recargar. Busca `permisosGranulares` para ver ambos puntos.
- Las fotos de bitácora en base64 se filtran al guardar para no saturar los 5MB de localStorage.

## Usuarios

- 7 usuarios base hardcoded en `USUARIOS` (admin, socio, campo, daniela, encargado, ingeniero, compras). Passwords en plano.
- Los admin pueden crear `usuariosExtra` y editar base users vía overrides en `usuariosBaseEdit`.
- Login en `LoginScreen`. Tras login, el `rol` del usuario resuelve los permisos vía `getPermisosUsuario`.

## Flujos (aprobaciones)

`FlujoModule` maneja solicitudes de compra, órdenes, solicitudes de gasto, recomendaciones. Tiene lógica multi-rol propia (`PUEDE_APROBAR = ["admin","socio"]`) que **no** usa el sistema de permisos granulares. Los checks de rol ahí son parte del workflow de negocio, no de permisos de UI.

## Ramas y flujo de trabajo

El repo tiene dos ramas principales:

- **`dev`** — staging. Aquí van los cambios experimentales, features en progreso, prototipos que todavía no están listos para usuarios finales. Cada push a `dev` dispara una preview deployment automática de Vercel (ambiente de staging).
- **`main`** — producción. Aquí solo llegan cambios ya aprobados y probados. Los push a `main` disparan deploy automático a https://agro-charay.vercel.app, pero el deploy "oficial" a producción se hace explícitamente con `vercel@latest --prod`.

**Regla general:** los cambios experimentales o en desarrollo se commitean y pushean a `dev` primero. Cuando el feature está validado, se mergea a `main`. Nunca trabajar directamente sobre `main` para features nuevas.

```bash
# Feature nueva o cambio experimental → dev
git checkout dev
# ...hacer cambios...
git add . && git commit -m "..."
git push origin dev      # deploy automático a staging (preview)

# Merge a main cuando esté aprobado
git checkout main
git merge dev
git push origin main
```

## Build y deploy

```bash
npm run build                                 # vite build → dist/ (verificación local)

# Deploy a STAGING (preview desde dev)
cd ~/Desktop/agro-charay && git push origin dev

# Deploy a PRODUCCIÓN
cd ~/Desktop/agro-charay && npm run build && npx vercel@latest --prod
```

El bundle minificado pasa de 500KB (warning de Vite que ignoramos). El build local siempre debe pasar antes de intentar deploy a producción.

**Nota de deploy:** si `vercel --prod` falla con `deploy_failed` y mensaje vacío y build de 0ms, es un problema del lado de Vercel (rate limit, integración rota, platform outage), no del código. Revisa el dashboard web directamente. Importante: usar `vercel@latest`, no `vercel` — versiones viejas del CLI tienen interferencia con plugins.

## Archivos del repo

- `src/App.jsx` — todo el código de la app
- `src/main.jsx` — entry point mínimo (monta `<App />`)
- `index.html` — shell HTML
- `vite.config.js` — config Vite estándar
- `.claude/settings.local.json` — NO commitear (está en `.gitignore`)

## Convenciones de código en este repo

- Emojis en UI son bienvenidos — la app entera los usa (🌾👷💰🗑 etc). Cuando agregues botones o estados, mantén el estilo.
- Nombres de variables y comentarios en español. Mantén consistencia.
- Estilos inline con objetos JS, no clases CSS (excepto las pocas clases globales definidas en el `styleEl` al inicio: `.card`, `.btn`, `.form-input`, `.tabs`, etc.).
- Colores de la paleta en el objeto `T` (straw, fog, sand, paper, line, etc.). Úsalos en lugar de literales.
- Formato monetario: `"es-MX"` con `MXN`. Hay helpers locales (`mxnFmt`) en varios módulos.

## Módulos principales (para navegar)

`ProductoresModule`, `LotesModule`, `CiclosModule`, `BitacoraModule`, `InsumosModule`, `DieselModule`, `InventarioModule`, `CreditoModule`, `EgresosModule`, `MaquinariaModule`, `OperadoresModule`, `CapitalModule`, `RentasModule`, `ActivosModule`, `PersonalModule`, `CosechaModule`, `ProyeccionModule`, `CostosModule`, `EdoResultadosModule`, `BalanceModule`, `FlujoCajaModule`, `ReportesModule`, `ConfiguracionModule`, `FlujoModule`, `AsisteModule`, `Dashboard`, `DashboardCampo`.

Cada uno recibe al menos `userRol`. Los que permiten editar también reciben `puedeEditar`. Los con navegación reciben `onNavigate`.
