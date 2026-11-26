// =============================================================
// Vistas "Actividades": historial y formulario de registro
// (cámara + geolocalización + guardado offline en IndexedDB).
// =============================================================
import * as db from '../db.js';
import { RESPONSABLES } from '../datos-demo.js';
import { TIPOS_ACTIVIDAD, esc, fechaHora, toast, abrirDialogo, cerrarDialogo, fechaLocalISO, badgeTipo } from '../ui.js';
import { icono } from '../iconos.js';
import * as apis from '../apis.js';

// ---------------- Historial ----------------

export async function vistaActividades(raiz, params) {
  const [actividades, cultivos] = await Promise.all([db.obtenerTodos('actividades'), db.obtenerTodos('cultivos')]);
  const nombreCultivo = Object.fromEntries(cultivos.map((c) => [c.id, c.nombre]));
  const filtro = params.get('tipo') || '';
  const lista = actividades
    .filter((a) => !filtro || a.tipo === filtro)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const urls = [];

  raiz.innerHTML = `
    <header class="encabezado-vista">
      <div>
        <div class="migas"><span>Finca Tres Ríos</span><span>Actividades</span></div>
        <h1>Actividades</h1>
      </div>
      <a class="btn btn-primario" href="#/actividades/nueva">${icono('mas')}Nueva actividad</a>
    </header>

    <nav class="tabs" aria-label="Filtrar por tipo">
      <a href="#/actividades" class="tab" ${!filtro ? 'aria-current="true"' : ''}>Todas</a>
      ${TIPOS_ACTIVIDAD.map((t) => `<a href="#/actividades?tipo=${encodeURIComponent(t)}" class="tab" ${t === filtro ? 'aria-current="true"' : ''}>${t}</a>`).join('')}
    </nav>

    <section class="seccion">
      <div class="seccion-cabecera">
        <div>
          <h2>Registro de actividades</h2>
          <p>${lista.length} registro(s) guardados en este dispositivo (IndexedDB). Funciona sin conexión.</p>
        </div>
      </div>
      <div class="seccion-cuerpo sin-padding tabla-envoltura">
        ${lista.length ? `
        <table class="tabla">
          <thead><tr><th>Actividad</th><th>Tipo</th><th>Ubicación en campo</th><th>Responsable</th><th>Fecha</th><th>GPS</th></tr></thead>
          <tbody>
            ${lista.map((a) => {
              let foto = `<span class="miniatura-vacia" title="Sin foto">${icono('foto')}</span>`;
              if (a.foto) { const u = URL.createObjectURL(a.foto); urls.push(u); foto = `<img class="miniatura" src="${u}" alt="Evidencia: ${esc(a.tipo)}" loading="lazy">`; }
              return `
              <tr>
                <td><div class="celda-actividad">${foto}<span class="notas">${esc(a.notas) || '<span class="suave">Sin observaciones</span>'}</span></div></td>
                <td data-col="Tipo">${badgeTipo(a.tipo)}</td>
                <td data-col="Ubicación en campo">${esc(nombreCultivo[a.cultivoId] || a.cultivoId)} · Surco ${a.surco}${a.plantaId ? `<br><code>${esc(a.plantaId)}</code>` : ''}</td>
                <td data-col="Responsable">${esc(a.responsable)}</td>
                <td data-col="Fecha" class="suave">${fechaHora(a.fecha)}</td>
                <td data-col="GPS">${a.ubicacion
                  ? `<a class="badge b-success" href="${apis.enlaceMapa(a.ubicacion)}" target="_blank" rel="noopener" title="${a.ubicacion.lat}, ${a.ubicacion.lon}">±${a.ubicacion.precision} m</a>`
                  : '<span class="badge b-gray">Sin GPS</span>'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>` : '<p class="vacio">Aún no hay actividades. Registra la primera.</p>'}
      </div>
    </section>
  `;

  return () => urls.forEach((u) => URL.revokeObjectURL(u));
}

// ---------------- Formulario de nueva actividad ----------------

export async function vistaNuevaActividad(raiz, params) {
  const cultivos = await db.obtenerTodos('cultivos');
  const responsable = await db.leerMeta('responsable', RESPONSABLES[0]);
  const pre = {
    cultivo: params.get('cultivo') || sessionStorage.getItem('cultivo') || cultivos[0].id,
    surco: Number(params.get('surco')) || 1,
    planta: params.get('planta') || '',
    tipo: params.get('tipo') || 'Poda',
    tarea: params.get('tarea') || '',
  };

  let foto = null;          // Blob JPEG
  let fotoUrl = null;
  let ubicacion = null;     // {lat, lon, precision}
  let stream = null;        // MediaStream activo

  raiz.innerHTML = `
    <header class="encabezado-vista">
      <div>
        <div class="migas"><span>Actividades</span><span>Nueva</span></div>
        <h1>Nueva actividad</h1>
      </div>
    </header>

    <form id="form-actividad" class="formulario" novalidate>
      <section class="seccion">
        <div class="seccion-cabecera">
          <div><h2>Datos de la actividad</h2><p>Se guarda en el dispositivo aunque no haya internet.</p></div>
        </div>
        <div class="seccion-cuerpo campos">
          <label>Tipo de actividad
            <select name="tipo" required>
              ${TIPOS_ACTIVIDAD.map((t) => `<option ${t === pre.tipo ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </label>
          <label>Cultivo
            <select name="cultivoId" required>
              ${cultivos.map((c) => `<option value="${c.id}" ${c.id === pre.cultivo ? 'selected' : ''}>${esc(c.nombre)} (${esc(c.lote)})</option>`).join('')}
            </select>
          </label>
          <label>Surco
            <input name="surco" type="number" min="1" required value="${pre.surco}">
          </label>
          <label>Planta (opcional)
            <input name="plantaId" placeholder="Ej. LIM-S03-P07" value="${esc(pre.planta)}" autocomplete="off">
          </label>
          <label>Responsable
            <select name="responsable">
              ${RESPONSABLES.map((r) => `<option ${r === responsable ? 'selected' : ''}>${esc(r)}</option>`).join('')}
            </select>
          </label>
          <label class="ancho">Observaciones
            <textarea name="notas" rows="3" placeholder="¿Qué se hizo? ¿Qué se observó?"></textarea>
          </label>
        </div>
      </section>

      <section class="seccion">
        <div class="seccion-cabecera">
          <div><h2>Evidencia</h2><p>Foto y ubicación de quien registra. El navegador pide permiso la primera vez.</p></div>
        </div>
        <div class="seccion-cuerpo evidencia">
          <div>
            <h3>${icono('camara')} Foto</h3>
            <div id="foto-vista" class="foto-vista"><span>Sin foto</span></div>
            <div class="fila-botones">
              <button type="button" class="btn" id="btn-camara">${icono('camara')}Tomar foto</button>
              <label class="btn" id="lbl-archivo">${icono('foto')}Elegir imagen
                <input type="file" accept="image/*" capture="environment" id="input-archivo" hidden>
              </label>
            </div>
            <p class="estado-api" id="estado-camara"></p>
          </div>
          <div>
            <h3>${icono('ubicacion')} Ubicación GPS</h3>
            <div id="geo-vista" class="geo-vista">Sin ubicación</div>
            <div class="fila-botones">
              <button type="button" class="btn" id="btn-geo">${icono('ubicacion')}Obtener ubicación</button>
            </div>
            <p class="estado-api" id="estado-geo"></p>
          </div>
        </div>
      </section>

      <p class="error-form" id="error-form" role="alert"></p>
      <div class="fila-botones fin" style="margin-top: 0">
        <a class="btn" href="#/actividades">Cancelar</a>
        <button type="submit" class="btn btn-primario btn-grande">${icono('check')}Guardar actividad</button>
      </div>
    </form>
  `;

  const $ = (s) => raiz.querySelector(s);
  const form = $('#form-actividad');

  // ---- Foto ----
  function ponerFoto(blob) {
    foto = blob;
    if (fotoUrl) URL.revokeObjectURL(fotoUrl);
    fotoUrl = URL.createObjectURL(blob);
    $('#foto-vista').innerHTML = `<img src="${fotoUrl}" alt="Vista previa de la foto">`;
    $('#estado-camara').textContent = `Foto lista (${Math.round(blob.size / 1024)} KB, comprimida).`;
    $('#btn-camara').innerHTML = `${icono('camara')}Repetir foto`;
  }

  if (!apis.camaraSoportada()) {
    $('#btn-camara').hidden = true;
    $('#estado-camara').textContent = 'Este navegador no permite abrir la cámara en vivo; usa "Elegir imagen".';
  }

  $('#btn-camara').addEventListener('click', async () => {
    const d = abrirDialogo(`
      <div class="camara">
        <h2>Tomar foto de evidencia</h2>
        <video playsinline muted autoplay></video>
        <p class="estado-api" id="estado-dialogo">Solicitando permiso de cámara…</p>
        <div class="fila-botones fin" style="margin-top: 0">
          <button type="button" class="btn" data-cerrar>Cancelar</button>
          <button type="button" class="btn btn-primario" id="btn-capturar" disabled>${icono('camara')}Capturar</button>
        </div>
      </div>`, { alCerrar: () => { apis.detenerCamara(stream); stream = null; } });
    const video = d.querySelector('video');
    try {
      stream = await apis.abrirCamara(video);
      d.querySelector('#estado-dialogo').textContent = 'Encuadra la planta o el surco y pulsa Capturar.';
      const btn = d.querySelector('#btn-capturar');
      btn.disabled = false;
      btn.addEventListener('click', async () => {
        ponerFoto(await apis.capturarFoto(video));
        cerrarDialogo();
      });
    } catch (err) {
      cerrarDialogo();
      $('#estado-camara').textContent = apis.mensajeErrorCamara(err);
      $('#estado-camara').classList.add('alerta');
    }
  });

  $('#input-archivo').addEventListener('change', async (e) => {
    const archivo = e.target.files?.[0];
    if (archivo) ponerFoto(await apis.comprimirArchivo(archivo));
  });

  // ---- GPS ----
  async function tomarUbicacion() {
    const estado = $('#estado-geo');
    estado.classList.remove('alerta');
    estado.textContent = 'Buscando señal GPS…';
    $('#btn-geo').disabled = true;
    try {
      ubicacion = await apis.obtenerUbicacion();
      $('#geo-vista').innerHTML = `<strong>${ubicacion.lat}, ${ubicacion.lon}</strong>
        <span>Precisión ±${ubicacion.precision} m</span>
        <a href="${apis.enlaceMapa(ubicacion)}" target="_blank" rel="noopener">Ver en el mapa</a>`;
      estado.textContent = ubicacion.precision > 30
        ? 'Precisión baja (bajo árboles es normal). Se guardará igual.'
        : 'Ubicación lista.';
    } catch (err) {
      estado.textContent = apis.mensajeErrorGeo(err);
      estado.classList.add('alerta');
    } finally {
      $('#btn-geo').disabled = false;
    }
  }
  $('#btn-geo').addEventListener('click', tomarUbicacion);
  // Si el permiso ya fue concedido antes, tomamos la ubicación sin preguntar.
  if (await apis.estadoPermiso('geolocation') === 'granted') tomarUbicacion();
  else $('#estado-geo').textContent = 'Pulsa el botón: el navegador pedirá permiso de ubicación.';

  // ---- Guardar ----
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(form));
    const cultivo = cultivos.find((c) => c.id === datos.cultivoId);
    const surco = Number(datos.surco);
    const plantaId = datos.plantaId.trim().toUpperCase() || null;
    const error = $('#error-form');

    if (!surco || surco < 1 || surco > cultivo.surcos) {
      error.textContent = `El surco debe estar entre 1 y ${cultivo.surcos} para ${cultivo.nombre}.`;
      return;
    }
    let planta = null;
    if (plantaId) {
      planta = await db.obtener('plantas', plantaId);
      if (!planta || planta.cultivoId !== cultivo.id) {
        error.textContent = `La planta ${plantaId} no existe en ${cultivo.nombre}.`;
        return;
      }
    }
    error.textContent = '';

    await db.guardar('actividades', {
      tipo: datos.tipo,
      cultivoId: cultivo.id,
      surco: planta ? planta.surco : surco,
      plantaId,
      responsable: datos.responsable,
      notas: datos.notas.trim(),
      fecha: new Date().toISOString(),
      foto,
      ubicacion,
    });
    await db.escribirMeta('responsable', datos.responsable);

    // Regla de la finca: se quita → queda hueco; se resiembra → buen desarrollo.
    if (planta && (datos.tipo === 'Retiro de planta' || datos.tipo === 'Resiembra')) {
      planta.estado = datos.tipo === 'Retiro de planta' ? 'hueco' : 'bueno';
      planta.actualizado = new Date().toISOString();
      await db.guardar('plantas', planta);
    }

    // Si había una tarea pendiente de este tipo y cultivo, se marca como hecha.
    const tareas = await db.obtenerTodos('tareas');
    const tarea = pre.tarea
      ? tareas.find((t) => String(t.id) === pre.tarea && !t.hecha)
      : tareas.filter((t) => !t.hecha && t.tipo === datos.tipo && t.cultivoId === cultivo.id && t.fechaLimite <= fechaLocalISO(new Date(Date.now() + 3 * 864e5)))
        .sort((a, b) => a.fechaLimite.localeCompare(b.fechaLimite))[0];
    if (tarea) {
      await db.guardar('tareas', { ...tarea, hecha: true, hechaEn: new Date().toISOString() });
      toast(`Actividad guardada ✔ · Tarea "${tarea.titulo}" marcada como hecha`, { duracion: 5000 });
    } else {
      toast(navigator.onLine ? 'Actividad guardada ✔' : 'Actividad guardada sin conexión ✔');
    }
    window.dispatchEvent(new Event('datos-cambiaron'));
    location.hash = '#/actividades';
  });

  // Limpieza al salir de la vista: apagar cámara y liberar memoria.
  return () => {
    apis.detenerCamara(stream);
    if (fotoUrl) URL.revokeObjectURL(fotoUrl);
  };
}
