// =============================================================
// Vista "Mapa": cuadrícula de plantas por cultivo, coloreada por estado.
// Renderizado del lado del cliente (CSR) a partir de IndexedDB.
// =============================================================
import * as db from '../db.js';
import { ESTADOS, esc, abrirDialogo, cerrarDialogo, toast, fechaHora } from '../ui.js';

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
    <section class="encabezado-vista">
      <div>
        <h1>Mapa de campo</h1>
        <p class="sub">${esc(cultivo.lote)} · ${esc(cultivo.nombre)} · ${plantas.length} plantas</p>
      </div>
      <div id="clima" class="clima" aria-live="polite">Clima…</div>
    </section>

    <nav class="tabs" aria-label="Cultivos">
      ${cultivos.map((c) => `
        <a href="#/mapa?cultivo=${c.id}" class="tab" ${c.id === cultivo.id ? 'aria-current="page"' : ''}>
          ${esc(c.nombre)}<small>${esc(c.lote)}</small>
        </a>`).join('')}
    </nav>

    <div class="resumen" id="resumen"></div>

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

    <ul class="leyenda" aria-label="Leyenda">
      ${Object.entries(ESTADOS).map(([k, v]) => `<li><span class="punto e-${k}"></span>${v.nombre}</li>`).join('')}
    </ul>
    <p class="nota">Toca una planta para ver su ficha, cambiar su estado o registrar una actividad.
    Regla de la finca: <strong>planta enferma no se cura, se quita y se repone</strong>.</p>
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

function pintarResumen(raiz, plantas) {
  const conteo = Object.fromEntries(Object.keys(ESTADOS).map((k) => [k, 0]));
  plantas.forEach((p) => { conteo[p.estado]++; });
  const sanas = plantas.length ? Math.round((conteo.bueno / plantas.length) * 100) : 0;
  const semaforo = sanas >= 85 ? 'verde' : sanas >= 70 ? 'amarillo' : 'rojo';
  raiz.querySelector('#resumen').innerHTML = `
    <div class="kpi semaforo-${semaforo}"><strong>${sanas}%</strong><span>plantas sanas</span></div>
    ${Object.entries(ESTADOS).filter(([k]) => k !== 'bueno').map(([k, v]) => `
      <div class="kpi"><strong><span class="punto e-${k}"></span>${conteo[k]}</strong><span>${v.nombre}</span></div>`).join('')}
  `;
}

async function abrirFicha(planta, cultivo, alActualizar) {
  const actividades = (await db.obtenerPorIndice('actividades', 'porPlanta', planta.id))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const urls = [];

  const d = abrirDialogo(`
    <form method="dialog" class="ficha">
      <header class="ficha-cabecera">
        <div>
          <p class="sub">${esc(cultivo.nombre)} · ${esc(cultivo.lote)}</p>
          <h2>Planta ${planta.numero} · Surco ${planta.surco}</h2>
          <code>${planta.id}</code>
        </div>
        <button type="button" class="btn-icono" data-cerrar aria-label="Cerrar">✕</button>
      </header>

      <fieldset class="estados">
        <legend>Estado actual</legend>
        ${Object.entries(ESTADOS).map(([k, v]) => `
          <label class="opcion-estado">
            <input type="radio" name="estado" value="${k}" ${k === planta.estado ? 'checked' : ''}>
            <span class="punto e-${k}"></span>${v.nombre}
          </label>`).join('')}
      </fieldset>

      <h3>Historial (${actividades.length})</h3>
      <ul class="historial">
        ${actividades.length ? actividades.map((a) => {
          let img = '';
          if (a.foto) { const u = URL.createObjectURL(a.foto); urls.push(u); img = `<img src="${u}" alt="Foto de ${esc(a.tipo)}">`; }
          return `<li>${img}<div><strong>${esc(a.tipo)}</strong> · ${fechaHora(a.fecha)}<br>
            <small>${esc(a.responsable)}${a.notas ? ` — ${esc(a.notas)}` : ''}</small></div></li>`;
        }).join('') : '<li class="vacio">Sin actividades registradas.</li>'}
      </ul>

      <footer class="ficha-acciones">
        <a class="btn" href="#/actividades/nueva?cultivo=${cultivo.id}&surco=${planta.surco}&planta=${planta.id}">Registrar actividad</a>
        <button type="submit" class="btn btn-primario" value="guardar">Guardar estado</button>
      </footer>
    </form>
  `, { alCerrar: () => urls.forEach((u) => URL.revokeObjectURL(u)) });

  d.querySelector('a.btn').addEventListener('click', () => cerrarDialogo());

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
  try {
    const r = await fetch(CLIMA_URL);
    if (!r.ok) throw new Error(r.status);
    const { current: c } = await r.json();
    const hora = c.time.slice(11, 16);
    caja.innerHTML = `<strong>${Math.round(c.temperature_2m)}°C</strong>
      <span>Humedad ${c.relative_humidity_2m}% · Lluvia ${c.precipitation} mm</span>
      <small>Dato de las ${hora}${navigator.onLine ? '' : ' (guardado)'}</small>`;
  } catch {
    caja.innerHTML = '<span>Clima no disponible sin conexión</span>';
  }
}
