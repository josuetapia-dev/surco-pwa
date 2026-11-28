## ¿Qué cambia?

<!-- Una o dos líneas. Ejemplo: "Rediseño de la vista Pendientes como tabla con badges". -->

**Tarjeta de Trello:** <!-- p. ej. E1P-06 -->

## Tipo de cambio

- [ ] ✨ Funcionalidad nueva (`feat`)
- [ ] 🐛 Corrección (`fix`)
- [ ] 🎨 Estilos / diseño (`style`)
- [ ] 📝 Documentación (`docs`)
- [ ] 🔧 Configuración / pruebas (`chore` / `test`)

## ¿Cómo lo probaste?

- [ ] `node tools/probar-pwa.mjs` pasa en mi computadora
- [ ] Lo revisé en celular (375 px) y en escritorio
- [ ] Lo probé **sin conexión** (DevTools › Application › Service Workers › Offline)
- [ ] La consola no muestra errores

## Checklist de PWA

- [ ] Si cambié código que ya está publicado, subí `VERSION` en `sw.js`
- [ ] Si agregué un archivo CSS/JS nuevo, lo agregué a `APP_SHELL` en `sw.js` (el CI lo revisa)
- [ ] No subí datos reales ni archivos de `privado/`

## Capturas (si cambia algo visual)

<!-- Arrastra aquí las imágenes: antes / después. -->

---
**Revisor:** revisa el código, abre la **vista previa de Netlify** que aparece en los comentarios del PR y aprueba solo si el CI está en verde ✅.
