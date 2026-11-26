// =============================================================
// Vista "Pendientes": calendario de tareas. Muestra lo que tocaba
// hacer y no se hizo (vencidas) y permite avisar con notificaciones.
// =============================================================
import * as db from '../db.js';
import { TIPOS_ACTIVIDAD, esc, fechaLarga, fechaLocalISO, toast, badgeTipo } from '../ui.js';
import { icono } from '../iconos.js';
import * as apis from '../apis.js';

/** Clasifica las tareas por urgencia. Se usa también para el contador del menú. */
export async function resumenPendientes() {
  const hoy = fechaLocalISO();
  const tareas = await db.obtenerTodos('tareas');
  const pendientes = tareas.filter((t) => !t.hecha);
  return {
    hoy,
    vencidas: pendientes.filter((t) => t.fechaLimite < hoy),
    deHoy: pendientes.filter((t) => t.fechaLimite === hoy),
    proximas: pendientes.filter((t) => t.fechaLimite > hoy),
    hechas: tareas.filter((t) => t.hecha),
  };
}

/** Lanza la notificación con el resumen (si hay permiso). */
export async function avisarPendientes() {
  const r = await resumenPendientes();
  const total = r.vencidas.length + r.deHoy.length;
  if (!total) return apis.notificar('Surco: todo al día ✔', { cuerpo: 'No hay tareas vencidas ni para hoy.' });
  const lineas = [...r.vencidas, ...r.deHoy].slice(0, 4).map((t) => `• ${t.titulo}`).join('\n');
  return apis.notificar(`Surco: ${r.vencidas.length} vencida(s), ${r.deHoy.length} para hoy`, { cuerpo: lineas });
}

const ESTADO_TAREA = {
  vencida: '<span class="badge b-danger">Vencida</span>',
  hoy: '<span class="badge b-warning">Para hoy</span>',
  proxima: '<span class="badge b-success">Próxima</span>',
  hecha: '<span class="badge b-gray">Hecha</span>',
};

export async function vistaPendientes(raiz) {
  const [r, cultivos] = await Promise.all([resumenPendientes(), db.obtenerTodos('cultivos')]);
  const nombre = Object.fromEntries(cultivos.map((c) => [c.id, `${c.nombre} (${c.lote})`]));
  const permiso = await apis.estadoPermiso('notifications');
  const porFecha = (a, b) => a.fechaLimite.localeCompare(b.fechaLimite);

  // Orden de la tabla: lo vencido primero, luego hoy, próximas y al final las hechas.
  const filas = [
    ...r.vencidas.sort(porFecha).map((t) => [t, 'vencida']),
    ...r.deHoy.map((t) => [t, 'hoy']),
    ...r.proximas.sort(porFecha).map((t) => [t, 'proxima']),
    ...r.hechas.sort((a, b) => (b.hechaEn || '').localeCompare(a.hechaEn || '')).map((t) => [t, 'hecha']),
  ];

  const stat = (etiqueta, valor, desc, clase, ico) => `
    <div class="stat">
      <span class="stat-etiqueta">${icono(ico)}${etiqueta}</span>
      <span class="stat-valor">${valor}</span>
      <span class="stat-desc ${clase}">${desc}</span>
    </div>`;

  raiz.innerHTML = `
    <header class="encabezado-vista">
      <div>
        <div class="migas"><span>Finca Tres Ríos</span><span>Pendientes</span></div>
        <h1>Pendientes</h1>
        <p class="sub">El sistema como supervisor: lo que tocaba hacer y no se hizo aparece en rojo.</p>
      </div>
      <button type="button" class="btn btn-primario" id="btn-avisar">${icono('campana')}Avisarme</button>
    </header>

    <div class="stats">
      ${stat('Vencidas', r.vencidas.length, r.vencidas.length ? 'No se hicieron a tiempo' : 'Nada vencido', r.vencidas.length ? 'c-danger' : 'c-success', 'alerta')}
      ${stat('Para hoy', r.deHoy.length, 'Programadas para hoy', r.deHoy.length ? 'c-warning' : '', 'reloj')}
      ${stat('Próximas', r.proximas.length, 'En los próximos días', '', 'calendario')}
      ${stat('Hechas', r.hechas.length, 'Completadas', 'c-success', 'check')}
    </div>

    <section class="seccion">
      <div class="seccion-cabecera">
        <div>
          <h2>Calendario de tareas</h2>
          <p id="estado-notif">Notificaciones: ${apis.TEXTO_PERMISO[permiso] || permiso}</p>
        </div>
      </div>
      <div class="seccion-cuerpo sin-padding tabla-envoltura">
        ${filas.length ? `
        <table class="tabla">
          <thead><tr><th>Tarea</th><th>Cultivo</th><th>Fecha límite</th><th>Estado</th><th class="acciones"><span class="sr">Acciones</span></th></tr></thead>
          <tbody>
            ${filas.map(([t, estado]) => `
              <tr class="${estado === 'vencida' ? 'fila-vencida' : ''} ${estado === 'hecha' ? 'fila-hecha' : ''}">
                <td><span class="titulo-tarea">${esc(t.titulo)}</span><br>${badgeTipo(t.tipo)}</td>
                <td data-col="Cultivo">${esc(nombre[t.cultivoId] || t.cultivoId)}</td>
                <td data-col="Fecha límite" class="suave">${estado === 'hecha' && t.hechaEn ? `Hecha el ${fechaLarga(t.hechaEn.slice(0, 10))}` : fechaLarga(t.fechaLimite)}</td>
                <td data-col="Estado">${ESTADO_TAREA[estado]}</td>
                <td class="acciones">${estado === 'hecha' ? '' : `
                  <a class="btn btn-chico" href="#/actividades/nueva?tipo=${encodeURIComponent(t.tipo)}&cultivo=${t.cultivoId}&tarea=${t.id}">Registrar</a>
                  <button type="button" class="btn btn-chico" data-hecha="${t.id}">${icono('check')}Hecha</button>`}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>` : '<p class="vacio">No hay tareas programadas.</p>'}
      </div>
    </section>

    <details class="seccion programar">
      <summary><div><h2>Programar una tarea</h2><p class="sub">Se guarda en el dispositivo y aparecerá en el calendario.</p></div></summary>
      <form id="form-tarea" class="seccion-cuerpo campos">
        <label class="ancho">Descripción <input name="titulo" required placeholder="Ej. Fertilización surcos 5–8"></label>
        <label>Tipo <select name="tipo">${TIPOS_ACTIVIDAD.map((t) => `<option>${t}</option>`).join('')}</select></label>
        <label>Cultivo <select name="cultivoId">${cultivos.map((c) => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('')}</select></label>
        <label>Fecha límite <input name="fechaLimite" type="date" required value="${r.hoy}"></label>
        <div class="fila-botones fin ancho" style="margin-top: 0"><button class="btn btn-primario">${icono('mas')}Guardar tarea</button></div>
      </form>
    </details>
  `;

  raiz.querySelectorAll('[data-hecha]').forEach((btn) => btn.addEventListener('click', async () => {
    const tarea = await db.obtener('tareas', Number(btn.dataset.hecha));
    await db.guardar('tareas', { ...tarea, hecha: true, hechaEn: new Date().toISOString() });
    toast(`"${tarea.titulo}" marcada como hecha`);
    window.dispatchEvent(new Event('datos-cambiaron'));
    vistaPendientes(raiz);
  }));

  raiz.querySelector('#form-tarea').addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(e.target));
    if (!datos.titulo.trim()) return;
    await db.guardar('tareas', { ...datos, titulo: datos.titulo.trim(), hecha: false });
    toast('Tarea programada');
    window.dispatchEvent(new Event('datos-cambiaron'));
    vistaPendientes(raiz);
  });

  raiz.querySelector('#btn-avisar').addEventListener('click', async () => {
    const estado = raiz.querySelector('#estado-notif');
    estado.classList.remove('estado-api', 'alerta');
    const resultado = await apis.pedirPermisoNotificaciones();
    if (resultado === 'granted') {
      await avisarPendientes();
      estado.textContent = 'Notificaciones: Concedido. Aviso enviado.';
    } else if (resultado === 'denied') {
      estado.textContent = 'Notificaciones negadas. Actívalas desde el candado de la barra de direcciones › Notificaciones.';
      estado.classList.add('estado-api', 'alerta');
    } else if (resultado === 'no-soportado') {
      estado.textContent = 'Este navegador no soporta notificaciones.';
      estado.classList.add('estado-api', 'alerta');
    } else {
      estado.textContent = 'No se concedió el permiso (puedes intentarlo de nuevo).';
    }
  });
}
