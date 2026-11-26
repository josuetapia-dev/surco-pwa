// =============================================================
// Vista "Pendientes": calendario de tareas. Muestra lo que tocaba
// hacer y no se hizo (vencidas) y permite avisar con notificaciones.
// =============================================================
import * as db from '../db.js';
import { TIPOS_ACTIVIDAD, esc, fechaLarga, fechaLocalISO, toast } from '../ui.js';
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

export async function vistaPendientes(raiz) {
  const [r, cultivos] = await Promise.all([resumenPendientes(), db.obtenerTodos('cultivos')]);
  const nombre = Object.fromEntries(cultivos.map((c) => [c.id, `${c.nombre} (${c.lote})`]));
  const permiso = await apis.estadoPermiso('notifications');

  const item = (t, clase) => `
    <li class="tarea ${clase}">
      <div>
        <strong>${esc(t.titulo)}</strong>
        <p class="sub">${esc(t.tipo)} · ${esc(nombre[t.cultivoId] || t.cultivoId)}</p>
        <p class="sub">${t.hecha ? `Hecha el ${fechaLarga(t.hechaEn.slice(0, 10))}` : `Fecha límite: ${fechaLarga(t.fechaLimite)}`}</p>
      </div>
      ${t.hecha ? '<span class="chip">✔ Hecha</span>' : `
        <div class="tarea-acciones">
          <a class="btn btn-chico" href="#/actividades/nueva?tipo=${encodeURIComponent(t.tipo)}&cultivo=${t.cultivoId}&tarea=${t.id}">Registrar</a>
          <button type="button" class="btn btn-chico btn-secundario" data-hecha="${t.id}">Marcar hecha</button>
        </div>`}
    </li>`;

  const grupo = (titulo, lista, clase, vacio) => `
    <section class="grupo-tareas">
      <h2>${titulo} <span class="contador">${lista.length}</span></h2>
      <ul>${lista.length ? lista.sort((a, b) => a.fechaLimite.localeCompare(b.fechaLimite)).map((t) => item(t, clase)).join('') : `<li class="vacio">${vacio}</li>`}</ul>
    </section>`;

  raiz.innerHTML = `
    <section class="encabezado-vista">
      <div>
        <h1>Pendientes</h1>
        <p class="sub">El sistema como supervisor: lo que tocaba hacer y no se hizo aparece en rojo.</p>
      </div>
      <button type="button" class="btn btn-primario" id="btn-avisar">🔔 Avisarme</button>
    </section>
    <p class="estado-api" id="estado-notif">Notificaciones: ${apis.TEXTO_PERMISO[permiso] || permiso}</p>

    ${grupo('⛔ Vencidas (no se hicieron)', r.vencidas, 'vencida', 'Nada vencido. ¡Bien!')}
    ${grupo('📅 Para hoy', r.deHoy, 'hoy', 'Nada programado para hoy.')}
    ${grupo('🗓️ Próximas', r.proximas, 'proxima', 'Sin tareas próximas.')}

    <details class="panel">
      <summary><strong>+ Programar una tarea</strong></summary>
      <form id="form-tarea" class="campos">
        <label class="ancho">Descripción <input name="titulo" required placeholder="Ej. Fertilización surcos 5–8"></label>
        <label>Tipo <select name="tipo">${TIPOS_ACTIVIDAD.map((t) => `<option>${t}</option>`).join('')}</select></label>
        <label>Cultivo <select name="cultivoId">${cultivos.map((c) => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('')}</select></label>
        <label>Fecha límite <input name="fechaLimite" type="date" required value="${r.hoy}"></label>
        <div class="fila-botones fin ancho"><button class="btn btn-primario">Guardar tarea</button></div>
      </form>
    </details>

    ${grupo('✅ Hechas', r.hechas, 'hecha', 'Aún no hay tareas hechas.')}
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
    estado.classList.remove('alerta');
    const resultado = await apis.pedirPermisoNotificaciones();
    if (resultado === 'granted') {
      await avisarPendientes();
      estado.textContent = 'Notificaciones: Concedido. Aviso enviado.';
    } else if (resultado === 'denied') {
      estado.textContent = 'Notificaciones negadas. Actívalas desde el candado de la barra de direcciones › Notificaciones.';
      estado.classList.add('alerta');
    } else if (resultado === 'no-soportado') {
      estado.textContent = 'Este navegador no soporta notificaciones.';
      estado.classList.add('alerta');
    } else {
      estado.textContent = 'No se concedió el permiso (puedes intentarlo de nuevo).';
    }
  });
}
