# AgroSistema Charay — Handoff para nuevo chat

## INSTRUCCIONES PARA CLAUDE
Eres el nuevo Claude en este proyecto. Lee este documento completo antes de hacer cualquier cosa.
Luego lee ARCHITECTURE.md y DECISIONS.md adjuntos.

---

## CONTEXTO DEL PROYECTO
Sistema de gestión agrícola para empresa de riego en Sinaloa, México.
Maneja crédito de avío, operación de campo, finanzas del ciclo OI 2025-2026.

**Stack**: React 18 + Vite, Supabase (oryixvodfqojunnqbkln), Vercel
**Repo**: github.com/mickyarambula/agro-charay  
**Local**: ~/Desktop/agro-charay
**Dev**: agro-charay-dev.vercel.app | **Prod**: agro-charay.vercel.app
**Rama activa**: dev

## POR QUÉ ESTAMOS CAMBIANDO DE CHAT
Esta es una mecánica deliberada — cambiamos de chat cuando el contexto se satura para mantener calidad. NO es porque algo esté roto o perdido. Los documentos ARCHITECTURE.md y DECISIONS.md se actualizan cada sesión para que el contexto se transfiera perfectamente.

## ESTADO ACTUAL DEL SISTEMA (al momento del handoff)
**Último commit**: f82c638 — "fix: eliminar TODOS los imports circulares de App.jsx"
**Problema activo**: La app crashea con "Minified React error #31" al cargar.

### Root cause identificado
WidgetCBOTDashboard fue movido como prop de App.jsx a Dashboard.jsx para evitar imports circulares. Pero hay al menos un lugar en App.jsx donde se renderiza Dashboard SIN pasarle la prop `widgetCBOT`. Eso causa el error #31 (objeto renderizado como componente).

### Fix concreto a aplicar PRIMERO
En App.jsx, buscar TODAS las ocurrencias donde se renderiza `<Dashboard` y verificar que TODAS tengan `widgetCBOT={<WidgetCBOTDashboard />}`. Si alguna no lo tiene, agregarlo.

También verificar que no queden imports circulares:
```bash
grep -rn "from.*App.jsx" src/modules/
```
Debe retornar vacío.

## FLUJO DE TRABAJO (obligatorio)
1. Tú analizas y escribes prompts en bloques de código
2. Miguel los pega en **Claude Code** (terminal ~/Desktop/agro-charay, ya en el directorio correcto)
3. Claude Code ejecuta + `npm run build` + `git push origin dev && git push origin main`
4. Vercel despliega automáticamente
5. Miguel reporta resultado

## MCPs DISPONIBLES
- **Supabase MCP**: execute_sql directo a BD
- **Vercel MCP**: ver deployments  
- **Chrome MCP**: ver browser
- **Mac MCP**: leer archivos con osascript

## REGLAS ABSOLUTAS
1. **NUNCA** `import { algo } from "../App.jsx"` en módulos — causa crash inmediato
2. **SIEMPRE** verificar schema antes de POST: `SELECT column_name FROM information_schema.columns WHERE table_name='x'`
3. Explicar qué harás ANTES de mandar prompts
4. Un problema a la vez — prompts pequeños y específicos
5. Verificar build verde antes de dar por resuelto

## USUARIOS
admin/123123 | daniela/871005 | socio/agro2025 | encargado/charay25 | ingeniero/ing2025 | compras/compras25 | campo/campo2025

## DATOS EN SUPABASE (intactos, NO recrear)
17 productores, 107 lotes, 455.88 ha, ciclo OI 2025-2026
148 dispersiones ($9.6M), 212 egresos, 105 insumos
7 usuarios en auth.users, 5 tractores UUID, 5 operadores, 25 inventario_items
7 consumos en maquinaria_consumos (T-1 configurado 10 L/ha)

## PENDIENTES DESPUÉS DEL CRASH
1. Bug calculadora diesel: fetch directo a Supabase al abrir modal de carga
2. Diesel: productor automático desde lote
3. Modo offline: IndexedDB + cola sync
4. Bitácora y capital → migrar a Supabase
5. Fase 2 cosecha: boletas → pago → cierre

## MECÁNICA DE CAMBIO DE CHAT
Cuando el contexto se sature, Claude avisará: "Es momento de cambiar de chat".
Antes de cambiar: actualizar DECISIONS.md con pendientes del día y hacer commit.
El nuevo chat arranca pegando este HANDOFF.md + adjuntando ARCHITECTURE.md y DECISIONS.md.
