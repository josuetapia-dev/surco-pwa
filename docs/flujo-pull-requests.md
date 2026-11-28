# Flujo de trabajo: ramas, Pull Requests y CI

Nadie sube cambios directo a `main`. Cada cambio pasa por: **rama → Pull Request → CI en verde → revisión de otro integrante → merge**. Al hacer merge, Netlify publica solo.

```
rama angel/e1p-04-mapa ──► Pull Request ──► CI ✅ + vista previa Netlify ──► revisión (Andrey) ──► merge a main ──► Netlify publica
```

## 1. Configuración única (Josué, 5 min en GitHub)

**a) Colaboradores:** *Settings › Collaborators › Add people* → Ángel y Andrey (rol *Write*).

**b) Proteger `main`:** *Settings › Branches › Add branch ruleset* (o *Add classic branch protection rule*):
- Branch name pattern: `main`
- ✅ **Require a pull request before merging** → *Required approvals*: **1**
- ✅ **Require status checks to pass** → buscar y agregar **`Pruebas de la PWA`** (aparece después de la primera corrida del CI)
- Guardar.

**c) Netlify — vistas previas de PR:** vienen activadas por defecto (*Site configuration › Build & deploy › Deploy Previews*). En cada PR, el bot de Netlify comenta una URL de prueba con los cambios, antes del merge.

## 2. Trabajar una tarjeta de Trello (cada integrante)

```powershell
git checkout main
git pull
git checkout -b angel/e2-06-docs-web-apis      # nombre: persona/tarjeta-descripcion
# ... hacer los cambios ...
node tools/verificar-shell.mjs                  # revisión rápida
node tools/probar-pwa.mjs                       # pruebas completas (1 min)
git add .
git commit -m "docs(apis): flujo de permisos de cámara y GPS"
git push -u origin angel/e2-06-docs-web-apis
```

En GitHub aparece el botón amarillo **"Compare & pull request"** → se llena solo con la plantilla → completar el checklist → **Create pull request** → en *Reviewers* elegir a quien revisa.

Mover la tarjeta de Trello a **👀 En revisión (PR)** y pegar el enlace del PR en la tarjeta.

## 3. Revisar un PR (el revisor)

1. Esperar el CI: debe aparecer ✅ **Pruebas de la PWA**. Si sale ❌, entrar a *Details* para ver qué prueba falló; las capturas quedan en *Summary › Artifacts*.
2. Abrir la **vista previa de Netlify** que comentó el bot y probarla en el celular.
3. *Files changed* → revisar el código → **Review changes › Approve** (o *Request changes* con comentarios).

## 4. Merge

El autor pulsa **Merge pull request** (opción *Create a merge commit*, que conserva los commits de cada integrante en el historial) → **Delete branch**. Mover la tarjeta a **✅ Hecho**.

## Qué revisa el CI (`.github/workflows/ci.yml`)

| Paso | Qué detecta |
|---|---|
| Sintaxis de JavaScript | Errores de escritura en cualquier `.js` / `.mjs` |
| `verificar-shell.mjs` | Archivos de `APP_SHELL` que no existen; CSS/JS **sin precargar** (fallaría offline); íconos y capturas del manifest que faltan o miden distinto |
| `probar-pwa.mjs` en Chrome | Service Worker, caché, instalabilidad, IndexedDB, cámara/GPS/notificaciones simuladas, **funcionamiento sin servidor**, desborde en 320/375/768 px y consola sin errores |

Las capturas de cada corrida se guardan 14 días como *artifact*.
