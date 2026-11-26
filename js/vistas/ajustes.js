// =============================================================
// Vista "Ajustes": perfil, permisos, almacenamiento, datos y versión.
// =============================================================
import * as db from '../db.js';
import { RESPONSABLES, cargarDatosDemo } from '../datos-demo.js';
import { esc, toast } from '../ui.js';
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

  raiz.innerHTML = `
    <section class="encabezado-vista"><div><h1>Ajustes</h1><p class="sub">Finca Tres Ríos (datos de demostración)</p></div></section>

    <div class="rejilla-paneles">
      <section class="panel">
        <h2>👤 ¿Quién registra?</h2>
        <label>Responsable en esta tableta
          <select id="sel-responsable">${RESPONSABLES.map((r) => `<option ${r === responsable ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select>
        </label>
        <p class="sub">No requiere usuario ni contraseña: es un perfil de demostración.</p>
      </section>

      <section class="panel">
        <h2>🔐 Permisos del dispositivo</h2>
        <ul class="lista-permisos">
          <li><span>📷 Cámara</span><span class="chip permiso-${permisos.camera}">${apis.TEXTO_PERMISO[permisos.camera]}</span></li>
          <li><span>📍 Ubicación</span><span class="chip permiso-${permisos.geolocation}">${apis.TEXTO_PERMISO[permisos.geolocation]}</span></li>
          <li><span>🔔 Notificaciones</span><span class="chip permiso-${permisos.notifications}">${apis.TEXTO_PERMISO[permisos.notifications]}</span></li>
        </ul>
        <p class="sub">Los permisos se piden solo cuando usas la función (tomar foto, obtener ubicación, "Avisarme").
        Si negaste alguno, reactívalo desde el candado de la barra de direcciones.</p>
      </section>

      <section class="panel">
        <h2>💾 Datos locales (IndexedDB)</h2>
        <ul class="lista-permisos">
          <li><span>Plantas</span><strong>${nPlantas}</strong></li>
          <li><span>Actividades</span><strong>${nActividades}</strong></li>
          <li><span>Tareas</span><strong>${nTareas}</strong></li>
          ${almacen ? `<li><span>Espacio usado</span><strong>${mb(almacen.usage)} MB de ${mb(almacen.quota)} MB</strong></li>` : ''}
          <li><span>Almacenamiento persistente</span><strong id="txt-persistente">${persistente ? 'Sí' : 'No'}</strong></li>
        </ul>
        <div class="fila-botones">
          ${persistente ? '' : '<button type="button" class="btn btn-secundario" id="btn-persistir">Evitar que el navegador borre los datos</button>'}
          <button type="button" class="btn btn-secundario" id="btn-exportar">Exportar respaldo (JSON)</button>
          <button type="button" class="btn btn-peligro" id="btn-restablecer">Restablecer datos demo</button>
        </div>
      </section>

      <section class="panel">
        <h2>📲 Aplicación</h2>
        <ul class="lista-permisos">
          <li><span>Instalada</span><strong>${instalada ? 'Sí (modo app)' : 'No (navegador)'}</strong></li>
          <li><span>Conexión</span><strong>${navigator.onLine ? 'En línea' : 'Sin conexión'}</strong></li>
          <li><span>Service Worker</span><strong id="txt-sw">${navigator.serviceWorker?.controller ? 'Activo' : 'No activo'}</strong></li>
          <li><span>Versión de caché</span><strong id="txt-version">…</strong></li>
        </ul>
        <div class="fila-botones">
          <button type="button" class="btn btn-secundario" id="btn-actualizar">Buscar actualización</button>
        </div>
        ${instalada ? '' : '<p class="sub">Para instalar: botón <strong>Instalar</strong> arriba, o menú ⋮ del navegador › "Instalar app" / "Agregar a pantalla de inicio".</p>'}
      </section>
    </div>
  `;

  const $ = (s) => raiz.querySelector(s);

  $('#sel-responsable').addEventListener('change', async (e) => {
    await db.escribirMeta('responsable', e.target.value);
    toast(`Responsable: ${e.target.value}`);
  });

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
    vistaAjustes(raiz, _params, ctx);
  });

  $('#btn-actualizar').addEventListener('click', async () => {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (!reg) { toast('No hay Service Worker registrado'); return; }
    await reg.update();
    toast(reg.waiting || reg.installing ? 'Descargando nueva versión…' : 'Ya tienes la versión más reciente');
  });

  ctx.versionSW().then((v) => { const el = $('#txt-version'); if (el) el.textContent = v || 'desconocida'; });
}
