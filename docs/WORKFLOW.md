# AgroSistema Charay — Workflow de sesión

Método de trabajo entre Claude web (chat) y Claude Code (local) para sesiones de desarrollo.

---

## Inicio de sesión (nueva conversación en Claude web)

Al abrir un chat nuevo, pegar como primer mensaje:

1. Contexto corto del proyecto (stack, branch activo, último commit)
2. Proceso de trabajo que sigue Miguel (ver sección abajo)
3. Los 3 docs clave: HANDOFF.md, ARCHITECTURE.md, DECISIONS.md
4. Objetivo concreto de la sesión (UN solo objetivo)

Claude web responde con el primer paso. A partir de ahí, loop:
**Claude web genera prompt → Miguel pega en Claude Code → Miguel reporta resultado → Claude web siguiente paso.**

---

## Reglas de interacción con Claude web

Claude web SIEMPRE debe:
- Dar prompts y comandos en **code blocks copiables**
- Hacer preguntas como **multiple-choice con botones**, no abiertas
- Dar instrucciones **paso a paso**, incluyendo git push/deploy
- Ser **conciso** — sin textos largos explicativos
- **Avisar cuando sea hora de abrir nuevo chat** (contexto saturado o sesión larga)

---

## Cierre de sesión (proceso fijo)

Al terminar el objetivo de la sesión, seguir estos pasos en orden:

### 1. Commit del código modificado

En terminal (fuera de Claude Code, más rápido):

    cd ~/Desktop/agro-charay
    git add <archivos_modificados>
    git commit -m "tipo(scope): mensaje descriptivo"
    git push origin dev

Tipos: `feat`, `fix`, `docs`, `refactor`, `chore`.

### 2. Actualizar HANDOFF.md y PROGRESS.md vía Claude Code

Pedirle a Claude web:
> "Genérame el prompt para Claude Code que actualiza HANDOFF.md y PROGRESS.md con los cambios de esta sesión."

Claude web debe responder con UN solo prompt que contenga:
- **HANDOFF.md**: contenido completo nuevo (reemplazo total — evita edits parciales propensos a error)
- **PROGRESS.md**: bloque nuevo a INSERTAR al inicio (después del título, antes de la sesión anterior)
- Los 3 comandos git al final (add + commit + push)

Miguel pega el prompt en Claude Code y listo.

### 3. Verificar deploy en Vercel

Revisar que `agro-charay-dev.vercel.app` haya actualizado correctamente.

---

## Qué debe incluir cada cierre en HANDOFF.md

- **Última actualización**: fecha + turno (AM / mediodía / noche)
- **Último commit**: hash corto + mensaje
- **Estado al cierre**: 3-6 bullets de lo que quedó funcionando
- **Bugs estructurales pendientes**: actualizar si se resolvió o descubrió alguno nuevo
- **Tabla de pendientes**: renumerada y con tiempos estimados
- **Siguiente sesión — recomendación**: 1 párrafo concreto
- **Reglas de trabajo**: agregar regla nueva si la sesión reveló una

---

## Qué debe incluir cada entrada nueva en PROGRESS.md

- Título: `## Sesión DD Mes AAAA (turno)`
- `### ✅ Completado` con descripción del bug/feature + cambios concretos + hash del commit
- `### 🎓 Lección aprendida` (solo si hubo descubrimiento real — no forzar)
- `### 📋 Pendientes al cierre`: puntero a HANDOFF.md

---

## Principios transversales

- **Sesiones cortas**: 30-50 minutos, UN objetivo claro
- **Un bug por sesión**: verificar, commit, cerrar
- **Nunca importar desde App.jsx** en módulos (imports circulares)
- **Verificar schema Supabase antes de POST**: 
```sql
  SELECT column_name, data_type FROM information_schema.columns 
  WHERE table_name = 'tabla' ORDER BY ordinal_position;
```
- **Verificar sintaxis con Babel parse** después de edits a App.jsx:
```bash
  node -e "require('@babel/parser').parse(require('fs').readFileSync('src/App.jsx','utf8'),{sourceType:'module',plugins:['jsx']}); console.log('OK')"
```
- **Cuidado con listeners de Supabase**: un handler que llama `signOut()` nunca debe vivir dentro del propio `onAuthStateChange` de SIGNED_OUT (causa loop)
