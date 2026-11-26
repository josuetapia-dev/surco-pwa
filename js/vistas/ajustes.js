// =============================================================
// Vista "Ajustes": perfil, apariencia, permisos, almacenamiento y versión.
// =============================================================
import * as db from '../db.js';
import { RESPONSABLES, cargarDatosDemo } from '../datos-demo.js';
import { esc, toast } from '../ui.js';
import { icono } from '../iconos.js';
import { temaActual, cambiarTema } from '../tema.js';
import * as apis from '../apis.js';

export async function vistaAjustes(raiz, _params, ctx) {
  const responsable = await db.leerMeta('responsable', RESPONSABLES[0]);
  const [nPlantas, nActividades, nTareas] = await Promise.all([db.contar('plantas'), db.contar('actividades'), db.contar('tareas')]);
  const permisos = {
    camera: await apis.estadoPermiso('camera'),
    geolocation: await apis.estadoPermiso('geolocation'),
    notifications: await apis.estadoPermiso('notifications'),
  };
  const almacen = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
  const persistente = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
  const instalada = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const mb = (b) => (b / 1024 / 1024).toFixed(1);
  const tema = temaActual();
  const permiso = (p) => `<span class="badge permiso-${p}">${apis.TEXTO_PERMISO[p]}</span>`;
  const opcionTema = (valor, texto, ico) => `
    <label><input type="radio" name="tema" value="${valor}" ${tema === valor ? 'checked' : ''}>${icono(ico)}${texto}</label>`;

  raiz.innerHTML = `
    <header class="encabezado-vista">
      <div>
        <div class="migas"><span>Finca Tres Ríos</span><span>Ajustes</span></div>
        <h1>Ajustes</h1>
      </div>
    </header>

    <div class="rejilla-paneles">
      <section class="seccion">
        <div class="seccion-cabecera"><div><h2>Perfil</h2><p>Quién registra las actividades en esta tableta.</p></div></div>
        <div class="seccion-cuerpo">
          <label>Responsable
            <select id="sel-responsable">${RESPONSABLES.map((r) => `<option ${r === responsable ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select>
          </label>
          <p class="nota" style="margin-top: .75rem">No requiere usuario ni contraseña: es un perfil de demostración.</p>
        </div>
      </section>

      <section class="seccion">
        <div class="seccion-cabecera"><div><h2>Apariencia</h2><p>Tema de la aplicación. Se guarda en el dispositivo.</p></div></div>
        <div class="seccion-cuerpo">
          <div class="segmentado" role="radiogroup" aria-label="Tema">
            ${opcionTema('sistema', 'Sistema', 'monitor')}
            ${opcionTema('claro', 'Claro', 'sol')}
            ${opcionTema('oscuro', 'Oscuro', 'luna')}
          </div>
        </div>
      </section>

      <section class="seccion">
        <div class="seccion-cabecera"><div><h2>Permisos del dispositivo</h2><p>Se piden solo al usar la función (tomar foto, obtener ubicación, "Avisarme").</p></div></div>
        <div class="seccion-cuerpo">
          <ul class="lista-datos">
            <li><span>Cámara</span>${permiso(permisos.camera)}</li>
            <li><span>Ubicación</span>${permiso(permisos.geolocation)}</li>
            <li><span>Notificaciones</span>${permiso(permisos.notifications)}</li>
          </ul>
          <p class="nota" style="margin-top: .75rem">Si negaste alguno, reactívalo desde el candado de la barra de direcciones.</p>
        </div>
      </section>

      <section class="seccion">
        <div class="seccion-cabecera"><div><h2>Datos locales</h2><p>Base IndexedDB "surco" en este dispositivo.</p></div></div>
        <div class="seccion-cuerpo">
          <ul class="lista-datos">
            <li><span>Plantas</span><strong>${nPlantas}</strong></li>
            <li><span>Actividades</span><strong>${nActividades}</strong></li>
            <li><span>Tareas</span><strong>${nTareas}</strong></li>
            ${almacen ? `<li><span>Espacio usado</span><strong>${mb(almacen.usage)} MB de ${mb(almacen.quota)} MB</strong></li>` : ''}
            <li><span>Almacenamiento persistente</span><strong id="txt-persistente">${persistente ? 'Sí' : 'No'}</strong></li>
          </ul>
        </div>
        <div class="seccion-pie">
          ${persistente ? '' : '<button type="button" class="btn" id="btn-persistir">Evitar que se borren</button>'}
          <button type="button" class="btn" id="btn-exportar">Exportar respaldo (JSON)</button>
          <button type="button" class="btn btn-peligro" id="btn-restablecer">Restablecer datos demo</button>
        </div>
      </section>

      <section class="seccion">
        <div class="seccion-cabecera"><div><h2>Aplicación</h2><p>Estado de la instalación y del Service Worker.</p></div></div>
        <div class="seccion-cuerpo">
          <ul class="lista-datos">
            <li><span>Instalada</span>${instalada ? '<span class="badge b-success">Sí (modo app)</span>' : '<span class="badge b-gray">No (navegador)</span>'}</li>
            <li><span>Conexión</span>${navigator.onLine ? '<span class="badge b-success">En línea</span>' : '<span class="badge b-warning">Sin conexión</span>'}</li>
            <li><span>Service Worker</span>${navigator.serviceWorker?.controller ? '<span class="badge b-success">Activo</span>' : '<span class="badge b-gray">No activo</span>'}</li>
            <li><span>Versión de caché</span><code id="txt-version">…</code></li>
          </ul>
          ${instalada ? '' : '<p class="nota" style="margin-top: .75rem">Para instalar: botón <strong>Instalar</strong> arriba, o menú ⋮ del navegador › "Instalar app".</p>'}
        </div>
        <div class="seccion-pie">
          <button type="button" class="btn" id="btn-actualizar">Buscar actualización</button>
        </div>
      </section>
    </div>
  `;

  const $ = (s) => raiz.querySelector(s);

  $('#sel-responsable').addEventListener('change', async (e) => {
    await db.escribirMeta('responsable', e.target.value);
    toast(`Responsable: ${e.target.value}`);
  });

  raiz.querySelectorAll('input[name="tema"]').forEach((r) => r.addEventListener('change', async () => {
    await cambiarTema(r.value);
    toast(`Tema: ${r.parentElement.textContent.trim()}`);
  }));

  // Si se cambia el tema con el botón de la barra, reflejarlo aquí.
  const alCambiarTema = () => {
    const actual = temaActual();
    raiz.querySelectorAll('input[name="tema"]').forEach((r) => { r.checked = r.value === actual; });
  };
  window.addEventListener('tema-cambiado', alCambiarTema);

  $('#btn-persistir')?.addEventListener('click', async () => {
    const ok = await navigator.storage.persist();
    $('#txt-persistente').textContent = ok ? 'Sí' : 'No (el navegador lo decide según el uso)';
    toast(ok ? 'Los datos no se borrarán automáticamente' : 'El navegador no lo concedió por ahora');
  });

  $('#btn-exportar').addEventListener('click', async () => {
    const respaldo = {
      app: 'Surco', exportado: new Date().toISOString(),
      cultivos: await db.obtenerTodos('cultivos'),
      plantas: await db.obtenerTodos('plantas'),
      tareas: await db.obtenerTodos('tareas'),
      // Las fotos (Blob) no van en JSON; se indica si la actividad tenía foto.
      actividades: (await db.obtenerTodos('actividades')).map(({ foto, ...a }) => ({ ...a, tieneFoto: !!foto })),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(respaldo, null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `surco-respaldo-${respaldo.exportado.slice(0, 10)}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  $('#btn-restablecer').addEventListener('click', async () => {
    if (!confirm('¿Borrar todas las actividades, fotos y cambios, y volver a los datos de demostración?')) return;
    await db.vaciarTodo();
    await cargarDatosDemo();
    sessionStorage.clear();
    toast('Datos demo restablecidos');
    window.dispatchEvent(new Event('datos-cambiaron'));
    window.removeEventListener('tema-cambiado', alCambiarTema);
    vistaAjustes(raiz, _params, ctx);
  });

  $('#btn-actualizar').addEventListener('click', async () => {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (!reg) { toast('No hay Service Worker registrado'); return; }
    await reg.update();
    toast(reg.waiting || reg.installing ? 'Descargando nueva versión…' : 'Ya tienes la versión más reciente');
  });

  ctx.versionSW().then((v) => { const el = $('#txt-version'); if (el) el.textContent = v || 'desconocida'; });

  // Limpieza al salir de la vista.
  return () => window.removeEventListener('tema-cambiado', alCambiarTema);
}
