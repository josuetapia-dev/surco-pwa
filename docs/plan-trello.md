# Plan de trabajo en Trello — PWA "Surco" (equipo obsi)

> Reparto de tareas para las 3 entregas. Cada tarjeta tiene **responsable, etiqueta, fecha y checklist**.
> Punto de partida: la **base funcional ya existe** en el repo (App Shell, mapa, Service Worker, IndexedDB, cámara, GPS, notificaciones; 17/17 pruebas automáticas). Lo que sigue es: **publicarla, entenderla, rediseñarla con estilo Filament, documentarla y defenderla en la demo**.

---

## 1. Integrantes y roles

| Integrante | Rol en el equipo | Área de la PWA (dueño del código) | Debe poder explicar en la demo |
|---|---|---|---|
| **Josué Pérez Tapia** | **Scrum Master** · Backend | Service Worker, IndexedDB, Git, despliegue | `sw.js`, `js/db.js`, `js/datos-demo.js`, estrategias de caché, ciclo de vida del SW |
| **Ángel de Gabriel Aparicio Maldonado** | Desarrollador **app en tableta** (frontend móvil) | Mapa, actividades, cámara y GPS | `js/app.js` (enrutador CSR), `js/vistas/mapa.js`, `js/vistas/actividades.js`, cámara y GPS de `js/apis.js` |
| **Andrey Emilio Cabriales Ramírez** | Desarrollador **panel web** · **Revisión cruzada (QA)** | Manifest, notificaciones, estilos base, README, pruebas | `manifest.json`, íconos, notificaciones de `js/apis.js` y `js/vistas/pendientes.js`, `js/vistas/ajustes.js`, `tools/probar-pwa.mjs` |

**Responsabilidades del Scrum Master:** mantener el tablero al día, desbloquear al equipo, hacer el *merge* final, cuidar las fechas de entrega y subir en Classroom.
**Responsabilidades de QA (Andrey):** ninguna tarjeta pasa a ✅ sin su revisión. Revisa los PR de los otros dos; los PR de Andrey los revisa Josué.

---

## 2. Cómo armar el tablero (10 min)

1. Tablero **"PWA Surco — obsi"** con las listas:
   `📥 Backlog` · `🎯 Esta semana` · `🔨 En progreso` · `👀 En revisión (PR)` · `✅ Hecho`
2. Etiquetas:
   - 🟥 **E1 · PWA en producción** — vence **mié 25-nov** *(SUPUESTO: 23:59)*
   - 🟪 **E1+ · Rediseño Filament** — listo **vie 27-nov antes de la demo**
   - 🟧 **E2 · Reporte PDF** — vence **jue 26-nov** *(Classroom dice "Mañana"; confírmalo)*
   - 🟩 **E3 · Live Demo** — **vie 27-nov**
   - ⬛ **Bloqueado**
3. Invita a Ángel y Andrey al tablero.
4. **Truco para cargar rápido:** copia un bloque de títulos (los recuadros grises de abajo), pégalo en "Añadir una tarjeta" y elige **"Crear N tarjetas"**. Luego asigna miembro, etiqueta y fecha, y pega el checklist de la tabla dentro de cada tarjeta (*Añadir › Checklist*; pegar varias líneas crea varios elementos).
5. Pon en **✅ Hecho** la tarjeta `E0-01` para que el tablero refleje lo que ya existe.

### Reglas del equipo
- **Una rama por persona** (`josue/...`, `angel/...`, `andrey/...`) y un **Pull Request** por tarjeta. Nadie sube directo a `main` salvo el SM en el merge final.
- **Commits pequeños y descriptivos** (`feat(mapa): ...`, `style(shell): ...`, `docs: ...`). La rúbrica premia un historial constante de varios autores.
- Si cambias algo de código ya publicado, **sube `VERSION` en `sw.js`** (`v1.1.0`, `v1.1.1`...). Si no, los dispositivos se quedan con la versión vieja.
- Todo dato es **ficticio** ("Finca Tres Ríos").

---

## 3. Resumen por integrante

| | Josué | Ángel | Andrey |
|---|---|---|---|
| **E1 hoy** | Repo, commits base, Netlify, entrega | Prueba en tableta real (instalar, foto, GPS, offline) | Prueba en escritorio, Lighthouse, URL en README |
| **E0 estudio** | `sw.js`, `db.js` | `app.js`, `mapa.js`, `actividades.js`, cámara/GPS | `manifest.json`, notificaciones, `pendientes.js`, `ajustes.js` |
| **E1+ Filament** | Dividir CSS, rediseño de Pendientes y Ajustes, merge y despliegue `v1.1.0` | Rediseño del Mapa (widgets) y de Actividades (tabla/form) | Tokens de diseño, fuente, shell (barra/sidebar), botones, badges, modo oscuro |
| **E2 reporte** | Intro, Service Worker, IndexedDB, conclusiones | App Shell + manifest, Web APIs | Portada, pruebas + Lighthouse, formato APA, PDF |
| **E3 demo** | Guion, banco de preguntas, plan B | Instalación en vivo y modo offline | Permisos en vivo y consola limpia |

---

## 4. Tarjetas

### ✅ E0 — Lo que ya existe (base funcional)

```
E0-01 Base de la PWA construida (shell, mapa, SW, IndexedDB, cámara, GPS, notificaciones)
E0-02 Estudiar mi parte del código para poder sustentarla (Josué)
E0-03 Estudiar mi parte del código para poder sustentarla (Ángel)
E0-04 Estudiar mi parte del código para poder sustentarla (Andrey)
```

| Tarjeta | Responsable | Checklist |
|---|---|---|
| E0-01 | Josué | ☐ Mover a ✅ Hecho · ☐ Adjuntar el resultado de `node tools/probar-pwa.mjs` (17/17) |
| E0-02 | **Josué** | ☐ Leer `sw.js` y explicar en voz alta install → activate → fetch · ☐ Explicar por qué cache-first en estáticos y network-first en el clima · ☐ Leer `db.js`: stores, índices y por qué se espera `oncomplete` · ☐ Probar en DevTools › Application › IndexedDB y Cache Storage |
| E0-03 | **Ángel** | ☐ Leer `app.js`: enrutador por hash y `limpiarVista` · ☐ Leer `mapa.js`: cómo se pinta la cuadrícula y se abre la ficha · ☐ Leer `actividades.js` + cámara/GPS de `apis.js`: flujo de permisos (concedido/negado/no soportado) · ☐ Explicar la regla "retiro → hueco, resiembra → bueno" |
| E0-04 | **Andrey** | ☐ Leer `manifest.json`: explicar cada parámetro · ☐ Leer notificaciones en `apis.js` y `pendientes.js`: por qué el permiso se pide solo con el botón y por qué `showNotification` · ☐ Leer `ajustes.js` (Permissions API, storage) · ☐ Correr `node tools/probar-pwa.mjs` y entender cada prueba |

---

### 🟥 E1 — PWA en producción (HOY, mié 25-nov)

```
E1-01 Crear repo público surco-pwa y subir commits por módulo
E1-02 Publicar en Netlify con HTTPS
E1-03 Probar en tableta/celular real: instalar, foto, GPS, notificación y modo avión
E1-04 Probar en escritorio: DevTools Manifest, Service Worker y Offline
E1-05 Correr Lighthouse y guardar el reporte
E1-06 README: URL real de producción y capturas del dispositivo
E1-07 Entregar URL y repositorio en Classroom
```

| Tarjeta | Responsable | Checklist | Rúbrica |
|---|---|---|---|
| E1-01 | **Josué** | ☐ Seguir `docs/guia-git-despliegue.md`, pasos 1 y 2 · ☐ `git check-ignore privado/...` confirma que se excluye · ☐ 9 commits por módulo · ☐ Invitar a Ángel y Andrey como colaboradores | 8 |
| E1-02 | **Josué** | ☐ Netlify › Import from GitHub › publish `.` · ☐ Renombrar el sitio (p. ej. `surco-obsi`) · ☐ Pegar la URL en esta tarjeta | 7 |
| E1-03 | **Ángel** | ☐ Chrome Android › URL › **Instalar** · ☐ Ícono en el inicio + splash · ☐ Tomar foto (aceptar permiso) · ☐ Obtener ubicación · ☐ Pendientes › Avisarme · ☐ Modo avión: abrir la app, registrar una actividad y verla en la lista · ☐ **Capturas de cada paso** (sirven para el README y el reporte) | 1, 4, 6 |
| E1-04 | **Andrey** | ☐ F12 › Application › Manifest sin errores · ☐ Service Workers: *activated* · ☐ Casilla *Offline* + recargar: la app funciona · ☐ Consola sin errores rojos · ☐ Capturas | 1, 3, 4 |
| E1-05 | **Andrey** | ☐ F12 › Lighthouse › Mobile · ☐ Guardar el HTML/PDF del reporte en `docs/lighthouse/` · ☐ Anotar las 4 calificaciones · ☐ Ojo: desde Lighthouse 12 ya no existe la categoría "PWA"; la instalabilidad se demuestra con Application › Manifest | Reporte 7 |
| E1-06 | **Andrey** | ☐ Reemplazar "PENDIENTE" (URL y repo) en el README · ☐ Cambiar la captura de la cámara simulada por la foto real de Ángel · ☐ Commit desde su cuenta | 9 |
| E1-07 | **Josué** | ☐ Confirmar la **nomenclatura** que pide el docente · ☐ Subir URL + repo · ☐ "Marcar como completado" antes de la hora límite | 10 |

---

### 🟪 E1+ — Rediseño con estilo Filament (jue 26 → vie 27 antes de la demo)

> **Por qué después de publicar:** la versión actual ya cumple la rúbrica. Se publica hoy y el rediseño entra como **v1.1.0** antes de la demo, sin arriesgar la entrega de hoy.
> **Orden obligatorio:** E1P-01 y E1P-02 primero (son la base); después las demás en paralelo, cada quien en su archivo para **no pisarse** en Git.

```
E1P-01 Dividir css/app.css en archivos por módulo
E1P-02 Tokens de diseño Filament, fuente Inter local y componentes base
E1P-03 Shell estilo Filament: barra superior y sidebar
E1P-04 Mapa: widgets de estadísticas y tarjeta del mapa estilo Filament
E1P-05 Actividades: lista tipo tabla Filament y formulario por secciones
E1P-06 Pendientes y Ajustes: secciones, badges y lista tipo tabla
E1P-07 Modo oscuro (prefers-color-scheme + interruptor)
E1P-08 Revisión responsiva en móvil, tableta y escritorio
E1P-09 Merge, subir VERSION a v1.1.0 y desplegar
```

| Tarjeta | Responsable | Checklist |
|---|---|---|
| E1P-01 | **Josué** | ☐ Separar `css/app.css` en `css/base.css` (variables, shell, componentes), `css/mapa.css`, `css/actividades.css` y `css/pendientes-ajustes.css` · ☐ Enlazarlos en `index.html` · ☐ **Agregarlos a `APP_SHELL` en `sw.js`** (si no, fallan sin conexión) · ☐ Probar que todo se ve igual · ☐ PR |
| E1P-02 | **Andrey** | ☐ Variables CSS de la guía de abajo (colores, radios, sombras, anillos) en `base.css` · ☐ Descargar **Inter** (woff2) a `fonts/`, declararla con `@font-face` y **agregarla a `APP_SHELL`** (una fuente de Google Fonts no cargaría offline) · ☐ Botones, inputs, badges y secciones con el estilo de la guía · ☐ PR |
| E1P-03 | **Andrey** | ☐ Barra superior blanca con borde inferior · ☐ Sidebar blanco: activo con fondo gris claro e ícono de color primario · ☐ Íconos **Heroicons** outline (licencia MIT) en línea · ☐ En móvil se mantiene la navegación inferior · ☐ PR |
| E1P-04 | **Ángel** | ☐ Indicadores como **Stats widgets**: etiqueta pequeña gris, número grande, descripción con color · ☐ Mapa dentro de una **sección** (encabezado con título + descripción, cuerpo con padding) · ☐ Pestañas de cultivo como *tabs* de Filament · ☐ Mantener los colores semáforo de las plantas · ☐ PR |
| E1P-05 | **Ángel** | ☐ Lista de actividades en **tabla** (escritorio) / tarjetas (móvil) con badges por tipo · ☐ Formulario en **secciones** ("Datos", "Evidencia") como los *Forms* de Filament · ☐ Diálogo de la ficha de planta con estilo de *modal* de Filament · ☐ PR |
| E1P-06 | **Josué** | ☐ Pendientes como **tabla** con columnas Tarea / Cultivo / Fecha / Estado · ☐ Badges: vencida = *danger*, hoy = *warning*, próxima = *success*, hecha = *gray* · ☐ Ajustes en **secciones** de Filament · ☐ PR |
| E1P-07 | **Andrey** | ☐ Paleta oscura (fondo gray-950, superficies gray-900, anillos white/10) · ☐ Respetar `prefers-color-scheme` · ☐ Interruptor en Ajustes guardado en IndexedDB (`meta`) · ☐ PR |
| E1P-08 | **Andrey (QA)** | ☐ Revisar a 375 px, 768 px (tableta) y 1280 px · ☐ Sin desbordes ni textos cortados · ☐ Capturas antes/después para el reporte |
| E1P-09 | **Josué** | ☐ Merge de los PR revisados · ☐ `VERSION = 'v1.1.0'` en `sw.js` · ☐ `node tools/probar-pwa.mjs` pasa · ☐ Push → Netlify despliega · ☐ En la tableta aparece "Actualizar" y se ve el diseño nuevo |

#### Guía de estilo "tipo Filament" (para E1P-02 a E1P-07)

| Elemento | Valor de referencia |
|---|---|
| Fuente | **Inter** (local en `fonts/`), respaldo `system-ui` |
| Color primario | **Decidir en equipo:** ámbar Filament `#f59e0b` / hover `#d97706`, **o** verde campo `#059669` / hover `#047857` (Filament permite cambiar el primario) |
| Fondo de la app | `#f9fafb` (gray-50) |
| Superficies (secciones, tarjetas) | Blanco, **radio 12 px**, anillo `1px rgb(3 7 18 / .05)`, sombra `0 1px 2px rgb(0 0 0 / .05)` |
| Texto / texto suave | `#030712` (gray-950) / `#6b7280` (gray-500) |
| Botón primario | Radio 8 px, `padding .5rem .75rem`, 14 px semibold, fondo primario, texto blanco |
| Botón secundario | Blanco con anillo `1px rgb(3 7 18 / .1)`, texto gray-950 |
| Inputs | Radio 8 px, anillo `1px rgb(3 7 18 / .1)`; foco: anillo 2 px del color primario |
| Badges | Radio 6 px, 12 px medium, fondo color-50 + texto color-700 + anillo color-600/10 · success `#16a34a` · warning `#d97706` · danger `#dc2626` · gray `#6b7280` |
| Sección | Encabezado (título 16 px semibold + descripción 14 px gris) · separador · cuerpo con `padding 1.5rem` |
| Stats widget | Etiqueta 14 px gris · valor 30 px semibold · descripción 14 px con el color del estado |
| Sidebar | Blanco, ítems 14 px medium, ícono 24 px gris-400; activo: fondo `#f3f4f6`, ícono y texto primario |
| Tabla | Encabezado `#f9fafb` 14 px semibold; filas con separador `#f3f4f6` |

---

### 🟧 E2 — Reporte técnico en PDF (jue 26-nov)

```
E2-01 Portada institucional UTGZ e índice paginado
E2-02 Introducción y justificación técnica del uso de PWA
E2-03 Documentar App Shell y manifest.json
E2-04 Explicar Service Worker y estrategias de caché
E2-05 Diseño de persistencia en IndexedDB
E2-06 Documentar Web APIs nativas y manejo de permisos
E2-07 Evidencias de pruebas offline y análisis de Lighthouse
E2-08 Conclusiones y lecciones aprendidas
E2-09 Formato, ortografía y bibliografía APA
E2-10 Exportar a PDF y entregar
```

| Tarjeta | Responsable | Para sacar "Excelente" (rúbrica) | Material de apoyo en el repo |
|---|---|---|---|
| E2-01 | **Andrey** | Portada completa (logo, carrera, materia, docente, integrantes, grupo, fecha) + índice **con páginas correctas** (en Word: *Referencias › Tabla de contenido*) | — |
| E2-02 | **Josué** | Problema (registro en papel, sin señal), objetivos y **por qué una PWA** (offline, instalable, sin tienda, una sola base de código) | README §1 |
| E2-03 | **Ángel** | Diagrama del App Shell (qué es estático y qué dinámico) + tabla de parámetros del manifest + fragmentos de código | README §3 y §4 |
| E2-04 | **Josué** | Ciclo de vida (register → install → activate → fetch) + **justificación** de cada estrategia + código de `sw.js` | README §5 |
| E2-05 | **Josué** | Modelo de datos (stores, llaves, índices) + flujo de lectura/escritura offline | README §6 |
| E2-06 | **Ángel** | Cámara, GPS y notificaciones: código + **flujo de permisos** (concedido / negado / no soportado) + capturas | README §7, `js/apis.js` |
| E2-07 | **Andrey** | Capturas offline **en dispositivo real** (de E1-03) + Lighthouse **con análisis** de cada métrica + resultado de las 17 pruebas automáticas | `screenshots/`, `tools/probar-pwa.mjs` |
| E2-08 | **Todos** (Josué integra) | Análisis crítico: retos, aprendizajes y mejoras futuras (sincronización con servidor, mapa satelital...) | — |
| E2-09 | **Andrey** | Ortografía, márgenes, numeración de figuras y referencias **APA 7** (MDN, web.dev, W3C) | — |
| E2-10 | **Andrey** | PDF que abre bien + nomenclatura correcta + subido a tiempo | — |

---

### 🟩 E3 — Demostración en vivo (vie 27-nov)

```
E3-01 Guion de la demo (5 min) y quién habla en cada parte
E3-02 Ensayo: instalación desde cero en la tableta
E3-03 Ensayo: modo avión creando y consultando datos
E3-04 Ensayo: permisos de cámara, GPS y notificaciones en vivo
E3-05 Consola sin errores durante toda la demo (chrome://inspect)
E3-06 Banco de 15 preguntas de sustentación y práctica de los 3
E3-07 Plan B: video grabado, segundo dispositivo y datos móviles
```

| Tarjeta | Responsable | Checklist |
|---|---|---|
| E3-01 | **Josué** | ☐ Orden: instalar → splash → mapa → cambiar estado → actividad con foto y GPS → modo avión → notificación → preguntas · ☐ Reparto de quién habla |
| E3-02 | **Ángel** | ☐ **Antes de la demo:** desinstalar la app y borrar los datos del sitio (si ya estaba instalada, la rúbrica la baja a "Regular") · ☐ Instalar desde la URL pública · ☐ Mostrar el ícono y la splash |
| E3-03 | **Ángel** | ☐ Modo avión → abrir app → registrar actividad → verla en la lista y en la ficha de la planta |
| E3-04 | **Andrey** | ☐ Restablecer los permisos del sitio para que **se vea la solicitud** · ☐ Mostrar también qué pasa si se niega uno |
| E3-05 | **Andrey** | ☐ Tableta conectada por USB a la laptop · ☐ `chrome://inspect` con la consola abierta · ☐ Cero errores en rojo |
| E3-06 | **Josué** | ☐ 15 preguntas probables (SW, caché, IndexedDB, manifest, permisos) con respuesta · ☐ **Los 3** las practican: el docente pregunta a cualquiera, y si solo uno sabe la calificación baja a "Regular" |
| E3-07 | **Josué** | ☐ Video de la demo completa · ☐ Celular con la app como respaldo · ☐ Datos móviles por si falla el WiFi del aula |
