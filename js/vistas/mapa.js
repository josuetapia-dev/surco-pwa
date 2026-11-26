// =============================================================
// Vista "Mapa": cuadrícula de plantas por cultivo, coloreada por estado.
// Renderizado del lado del cliente (CSR) a partir de IndexedDB.
// =============================================================
import * as db from '../db.js';
import { ESTADOS, esc, abrirDialogo, cerrarDialogo, toast, fechaHora, badgeTipo } from '../ui.js';
import { icono } from '../iconos.js';

// Coordenadas genéricas de la zona norte de Veracruz (solo para el clima de la demo).
const CLIMA_URL = 'https://api.open-meteo.com/v1/forecast?latitude=20.45&longitude=-97.32'
  + '&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m&timezone=America%2FMexico_City';

export async function vistaMapa(raiz, params) {
  const cultivos = await db.obtenerTodos('cultivos');
  const cultivoId = params.get('cultivo') || sessionStorage.getItem('cultivo') || cultivos[0]?.id;
  const cultivo = cultivos.find((c) => c.id === cultivoId) || cultivos[0];
  if (!cultivo) {
    raiz.innerHTML = '<p class="vacio">No hay cultivos. Restablece los datos demo en Ajustes.</p>';
    return;
  }
  sessionStorage.setItem('cultivo', cultivo.id);

  const plantas = await db.obtenerPorIndice('plantas', 'porCultivo', cultivo.id);
  const porId = new Map(plantas.map((p) => [p.id, p]));

  raiz.innerHTML = `
    <header class="encabezado-vista">
      <div>
        <div class="migas"><span>Finca Tres Ríos</span><span>Mapa</span></div>
        <h1>Mapa de campo</h1>
      </div>
      <a class="btn btn-primario" href="#/actividades/nueva?cultivo=${cultivo.id}">${icono('mas')}Nueva actividad</a>
    </header>

    <nav class="tabs" aria-label="Cultivos">
      ${cultivos.map((c) => `
        <a href="#/mapa?cultivo=${c.id}" class="tab" ${c.id === cultivo.id ? 'aria-current="page"' : ''}>
          ${esc(c.nombre)} <small>· ${esc(c.lote)}</small>
        </a>`).join('')}
    </nav>

    <div class="stats">
      <div class="stat" id="clima" aria-live="polite">
        <span class="stat-etiqueta">${icono('nube')} Clima en la finca</span>
        <span class="stat-valor">—</span>
        <span class="stat-desc">Cargando…</span>
      </div>
      <div id="resumen" style="display: contents"></div>
    </div>

    <section class="seccion">
      <div class="seccion-cabecera">
        <div>
          <h2>${esc(cultivo.lote)} · ${esc(cultivo.nombre)}</h2>
          <p>${plantas.length} plantas en ${cultivo.surcos} surcos. Toca una planta para ver su ficha, cambiar su estado o registrar una actividad.</p>
        </div>
      </div>
      <div class="seccion-cuerpo">
        <div class="mapa-scroll">
          <div class="mapa" style="--columnas:${cultivo.plantasPorSurco}" role="grid" aria-label="Mapa de ${esc(cultivo.nombre)}">
            <div class="mapa-esquina" aria-hidden="true"></div>
            ${Array.from({ length: cultivo.plantasPorSurco }, (_, i) => `<div class="mapa-col" aria-hidden="true">${i + 1}</div>`).join('')}
            ${Array.from({ length: cultivo.surcos }, (_, s) => `
              <div class="mapa-surco">S${s + 1}</div>
              ${plantas.filter((p) => p.surco === s + 1).sort((a, b) => a.numero - b.numero).map(celda).join('')}
            `).join('')}
          </div>
        </div>
      </div>
      <div class="seccion-pie" style="justify-content: space-between">
        <ul class="leyenda" aria-label="Leyenda">
          ${Object.entries(ESTADOS).map(([k, v]) => `<li><span class="punto e-${k}"></span>${v.nombre}</li>`).join('')}
        </ul>
        <span class="nota">Regla: <strong>planta enferma no se cura, se quita y se repone</strong>.</span>
      </div>
    </section>
  `;

  pintarResumen(raiz, plantas);

  raiz.querySelector('.mapa').addEventListener('click', (e) => {
    const btn = e.target.closest('.planta');
    if (!btn) return;
    abrirFicha(porId.get(btn.dataset.id), cultivo, (actualizada) => {
      porId.set(actualizada.id, actualizada);
      btn.outerHTML = celda(actualizada);
      pintarResumen(raiz, [...porId.values()]);
    });
  });

  cargarClima(raiz.querySelector('#clima'));
}

function celda(p) {
  const e = ESTADOS[p.estado];
  return `<button type="button" class="planta e-${p.estado}" data-id="${p.id}"
    aria-label="Planta ${p.numero}, surco ${p.surco}: ${e.nombre}" title="${p.id} · ${e.nombre}">${p.numero}</button>`;
}

/** Stats widgets: % de plantas sanas (semáforo) y conteo por estado. */
function pintarResumen(raiz, plantas) {
  const conteo = Object.fromEntries(Object.keys(ESTADOS).map((k) => [k, 0]));
  plantas.forEach((p) => { conteo[p.estado]++; });
  const sanas = plantas.length ? Math.round((conteo.bueno / plantas.length) * 100) : 0;
  const [clase, texto] = sanas >= 85 ? ['c-success', 'Semáforo verde'] : sanas >= 70 ? ['c-warning', 'Semáforo amarillo'] : ['c-danger', 'Semáforo rojo'];
  const stat = (etiqueta, valor, desc, claseDesc = '', estado = '') => `
    <div class="stat">
      <span class="stat-etiqueta">${estado ? `<span class="punto e-${estado}"></span>` : ''}${etiqueta}</span>
      <span class="stat-valor">${valor}</span>
      <span class="stat-desc ${claseDesc}">${desc}</span>
    </div>`;
  raiz.querySelector('#resumen').innerHTML = [
    stat('Plantas sanas', `${sanas}%`, `${texto} · ${conteo.bueno} de ${plantas.length}`, clase, 'bueno'),
    stat('Deshidratadas', conteo.deshidratada, 'Revisar riego', conteo.deshidratada ? 'c-warning' : '', 'deshidratada'),
    stat('Enfermas', conteo.enferma, 'Marcar para quitar', conteo.enferma ? 'c-danger' : '', 'enferma'),
    stat('Por quitar', conteo.quitar, 'Retirar y reponer', '', 'quitar'),
    stat('Huecos', conteo.hueco, 'Por resembrar', '', 'hueco'),
  ].join('');
}

async function abrirFicha(planta, cultivo, alActualizar) {
  const actividades = (await db.obtenerPorIndice('actividades', 'porPlanta', planta.id))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const urls = [];

  const d = abrirDialogo(`
    <form method="dialog" class="ficha">
      <header class="modal-cabecera">
        <div>
          <h2>Planta ${planta.numero} · Surco ${planta.surco}</h2>
          <p class="sub">${esc(cultivo.nombre)} · ${esc(cultivo.lote)} · <code>${planta.id}</code></p>
        </div>
        <button type="button" class="btn-icono" data-cerrar aria-label="Cerrar">${icono('cerrar')}</button>
      </header>

      <div class="modal-cuerpo">
        <fieldset class="estados">
          <legend>Estado actual</legend>
          ${Object.entries(ESTADOS).map(([k, v]) => `
            <label class="opcion-estado">
              <input type="radio" name="estado" value="${k}" ${k === planta.estado ? 'checked' : ''}>
              <span class="punto e-${k}"></span>${v.nombre}
            </label>`).join('')}
        </fieldset>

        <h3 style="margin-top: 1.25rem">Historial <span class="badge b-gray">${actividades.length}</span></h3>
        <ul class="historial">
          ${actividades.length ? actividades.map((a) => {
            let img = '';
            if (a.foto) { const u = URL.createObjectURL(a.foto); urls.push(u); img = `<img src="${u}" alt="Foto de ${esc(a.tipo)}">`; }
            return `<li>${img}<div>${badgeTipo(a.tipo)} <small>${fechaHora(a.fecha)}</small><br>
              <small>${esc(a.responsable)}${a.notas ? ` — ${esc(a.notas)}` : ''}</small></div></li>`;
          }).join('') : '<li class="vacio" style="padding: 1rem">Sin actividades registradas.</li>'}
        </ul>
      </div>

      <footer class="modal-pie">
        <a class="btn" href="#/actividades/nueva?cultivo=${cultivo.id}&surco=${planta.surco}&planta=${planta.id}">Registrar actividad</a>
        <button type="submit" class="btn btn-primario" value="guardar">Guardar estado</button>
      </footer>
    </form>
  `, { alCerrar: () => urls.forEach((u) => URL.revokeObjectURL(u)) });

  d.querySelector('.modal-pie a.btn').addEventListener('click', () => cerrarDialogo());

  d.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nuevo = new FormData(e.target).get('estado');
    if (nuevo === planta.estado) { cerrarDialogo(); return; }
    const anterior = planta.estado;
    const actualizada = { ...planta, estado: nuevo, actualizado: new Date().toISOString() };
    await db.guardar('plantas', actualizada);
    // Dejamos rastro del cambio en el historial de la planta.
    await db.guardar('actividades', {
      tipo: 'Observación', cultivoId: cultivo.id, surco: planta.surco, plantaId: planta.id,
      responsable: await db.leerMeta('responsable', 'Sin nombre'),
      notas: `Estado: ${ESTADOS[anterior].nombre} → ${ESTADOS[nuevo].nombre}`,
      fecha: new Date().toISOString(), foto: null, ubicacion: null,
    });
    alActualizar(actualizada);
    cerrarDialogo();
    toast(`Planta ${planta.id}: ${ESTADOS[nuevo].nombre}`);
  });
}

/** Recurso DINÁMICO: el Service Worker lo atiende con estrategia network-first. */
async function cargarClima(caja) {
  const valor = caja.querySelector('.stat-valor');
  const desc = caja.querySelector('.stat-desc');
  try {
    const r = await fetch(CLIMA_URL);
    if (!r.ok) throw new Error(r.status);
    const { current: c } = await r.json();
    valor.innerHTML = `<span class="clima-valor">${Math.round(c.temperature_2m)}°C <small>${c.relative_humidity_2m}% humedad</small></span>`;
    desc.textContent = `Lluvia ${c.precipitation} mm · dato de las ${c.time.slice(11, 16)}${navigator.onLine ? '' : ' (guardado)'}`;
  } catch {
    valor.textContent = '—';
    desc.textContent = 'Sin conexión y sin dato guardado';
  }
}
