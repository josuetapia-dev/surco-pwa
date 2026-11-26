# Guía: subir a GitHub y publicar con HTTPS (Entrega 1)

> Tiempo estimado: 30–40 min. **Hagan los commits ustedes**, cada quien desde su cuenta.

## Paso 1 — Josué crea el repositorio (5 min)

1. En GitHub: **New repository** → nombre `surco-pwa` → **Public** → *sin* README ni .gitignore (ya existen).
2. *Settings › Collaborators* → invitar a Ángel y Andrey.

## Paso 2 — Josué sube el proyecto en commits por módulo (15 min)

En PowerShell, dentro de `C:\dev\PWA DECEMBER`:

```powershell
git init
git branch -M main
git remote add origin https://github.com/TU-USUARIO/surco-pwa.git
git check-ignore privado/propuesta-modulos-y-presupuesto.md   # debe imprimir la ruta = está excluido
```

Hagan **un commit por módulo**, no uno gigante. Un historial descriptivo da puntos en el criterio 8:

```powershell
git add .gitignore netlify.toml vercel.json .vercelignore docs/
git commit -m "chore: estructura inicial, configuración de despliegue y plan de trabajo"

git add index.html css/
git commit -m "feat(shell): App Shell responsivo con navegación inferior/lateral"

git add manifest.json icons/ tools/generar-iconos.mjs
git commit -m "feat(manifest): manifest de instalación e íconos 192/512/maskable"

git add js/db.js js/datos-demo.js
git commit -m "feat(db): capa IndexedDB con stores cultivos, plantas, actividades y tareas"

git add sw.js offline.html
git commit -m "feat(sw): service worker con precache, limpieza en activate y estrategias de caché"

git add js/ui.js js/app.js js/vistas/mapa.js
git commit -m "feat(mapa): enrutador CSR y mapa de campo con estados y ficha de planta"

git add js/apis.js js/vistas/actividades.js
git commit -m "feat(apis): registro de actividades con cámara y geolocalización"

git add js/vistas/pendientes.js js/vistas/ajustes.js
git commit -m "feat(pendientes): calendario de tareas, notificaciones y ajustes"

git add tools/servidor-local.mjs tools/probar-pwa.mjs screenshots/ README.md
git commit -m "test/docs: pruebas automáticas, capturas y README"

git status          # debe decir "nothing to commit"; privado/ NO debe aparecer
git push -u origin main
```

## Paso 3 — Publicar (10 min)

**Netlify (recomendado):** entrar con GitHub → *Add new site › Import an existing project › GitHub* → `surco-pwa`.
- Build command: *(vacío)* · Publish directory: `.`
- Deploy → copiar la URL `https://xxxx.netlify.app` (en *Site configuration › Change site name* se puede poner `surco-obsi`).

**Vercel (alternativa):** *Add New › Project* → importar `surco-pwa` → Framework *Other* → Deploy.

## Paso 4 — Verificar en producción (10 min)

- [ ] La URL abre con candado 🔒 (HTTPS).
- [ ] Chrome escritorio: F12 › *Application › Manifest*, sin errores. *Service Workers*: estado **activated**.
- [ ] *Application › Service Workers ›* marcar **Offline** → recargar → la app sigue funcionando.
- [ ] Celular o tableta Android con Chrome: abrir la URL → **Instalar** → el ícono aparece en el inicio y abre con splash screen.
- [ ] En el dispositivo: tomar una foto, obtener la ubicación y pulsar *Avisarme* (aceptar los permisos).
- [ ] Modo avión → abrir la app instalada → registrar una actividad → aparece en la lista.

## Paso 5 — Commits de Ángel y Andrey (hoy y los próximos días)

El historial debe verse **constante y de varias personas**. Cada uno clona y hace cambios reales:

```powershell
git clone https://github.com/TU-USUARIO/surco-pwa.git
cd surco-pwa
# ...cambios...
git add .
git commit -m "docs: URL de producción y capturas reales en tableta"
git push
```

Commits que les tocan:
- **Andrey:** poner la URL real en el README (líneas "PENDIENTE") · capturas reales del dispositivo · reporte de Lighthouse en `docs/`.
- **Ángel:** ajustes que salgan al probar en la tableta (tamaños, textos) · reemplazar la captura de la cámara simulada por una foto real.
- **Josué:** cada cambio de código posterior **sube `VERSION` en `sw.js`** (p. ej. `v1.0.1`); si no, los dispositivos se quedan con la versión vieja.

## Paso 6 — Entregar en Classroom

URL de producción + URL del repositorio, con la **nomenclatura que pidió el docente** (confírmenla), **antes de la hora límite**.

## Nota sobre Lighthouse

Desde Lighthouse 12 (2024), Chrome **ya no tiene la categoría "PWA"**. Corran Lighthouse (F12 › *Lighthouse* › Mobile) para **Rendimiento, Accesibilidad, Buenas prácticas y SEO**. Como evidencia de instalabilidad usen la pestaña *Application › Manifest* y el botón de instalar. Expliquen esto en el reporte: suma puntos por análisis técnico.
