// =============================================================
// app.js — Punto de entrada. Arranca el App Shell:
//   · registra el Service Worker y gestiona sus actualizaciones
//   · enrutador por hash (#/mapa, #/actividades, ...) con renderizado en cliente (CSR)
//   · indicador de conexión, botón de instalación y contador de pendientes
// =============================================================
import { sembrarSiVacio } from './datos-demo.js';
import { toast, esc } from './ui.js';
import * as db from './db.js';
import { vistaMapa } from './vistas/mapa.js';
import { vistaActividades, vistaNuevaActividad } from './vistas/actividades.js';
import { vistaPendientes, resumenPendientes, avisarPendientes } from './vistas/pendientes.js';
import { vistaAjustes } from './vistas/ajustes.js';
import { pintarTema, cambiarTema } from './tema.js';

const RUTAS = {
  mapa: vistaMapa,
  actividades: vistaActividades,
  'actividades/nueva': vistaNuevaActividad,
  pendientes: vistaPendientes,
  ajustes: vistaAjustes,
};

const main = document.getElementById('vista');
let limpiarVista = null;

// ---------------- Service Worker ----------------

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('Este navegador no soporta Service Workers: no habrá modo offline.');
    return;
  }
  const habiaControlador = !!navigator.serviceWorker.controller;

  navigator.serviceWorker.register('./sw.js', { scope: './' }).then((reg) => {
    // Ya había una versión nueva esperando (instalada en una visita anterior).
    if (reg.waiting && habiaControlador) avisarActualizacion(reg.waiting);

    reg.addEventListener('updatefound', () => {
      const nuevo = reg.installing;
      nuevo?.addEventListener('statechange', () => {
        if (nuevo.state === 'installed' && navigator.serviceWorker.controller) avisarActualizacion(nuevo);
      });
    });
  }).catch((err) => console.error('Error al registrar el Service Worker:', err));

  // Cuando el SW nuevo toma el control, recargamos una sola vez para usar los archivos nuevos.
  let recargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!habiaControlador || recargando) return; // primera instalación: no hace falta recargar
    recargando = true;
    location.reload();
  });
}

function avisarActualizacion(swEnEspera) {
  toast('Hay una nueva versión de Surco.', {
    accion: 'Actualizar',
    duracion: 0,
    alAccion: () => swEnEspera.postMessage({ tipo: 'SKIP_WAITING' }),
  });
}

/** Pregunta al Service Worker activo qué versión de caché usa. */
function versionSW() {
  return new Promise((resolve) => {
    const sw = navigator.serviceWorker?.controller;
    if (!sw) { resolve(null); return; }
    const canal = new MessageChannel();
    canal.port1.onmessage = (e) => resolve(e.data?.version ?? null);
    sw.postMessage({ tipo: 'VERSION' }, [canal.port2]);
    setTimeout(() => resolve(null), 1500);
  });
}

// ---------------- Enrutador (CSR) ----------------

async function navegar() {
  const [ruta, consulta] = (location.hash.replace(/^#\/?/, '') || 'mapa').split('?');
  const vista = RUTAS[ruta] || RUTAS.mapa;
  const params = new URLSearchParams(consulta || '');

  if (typeof limpiarVista === 'function') { try { limpiarVista(); } catch { /* sin acción */ } }
  limpiarVista = null;

  const seccion = (RUTAS[ruta] ? ruta : 'mapa').split('/')[0];
  document.querySelectorAll('.navegacion a').forEach((a) => {
    if (a.dataset.ruta === seccion) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  main.setAttribute('aria-busy', 'true');
  try {
    limpiarVista = await vista(main, params, { versionSW });
  } catch (err) {
    console.error(err);
    main.innerHTML = `<div class="panel alerta"><h2>Algo salió mal</h2><p>${esc(err.message)}</p>
      <a class="btn" href="#/mapa">Volver al mapa</a></div>`;
  } finally {
    main.removeAttribute('aria-busy');
  }
  main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

// ---------------- Estado de conexión ----------------

function actualizarEstadoRed() {
  const chip = document.getElementById('estado-red');
  const enLinea = navigator.onLine;
  chip.textContent = enLinea ? 'En línea' : 'Sin conexión';
  chip.classList.toggle('offline', !enLinea);
  document.body.classList.toggle('sin-conexion', !enLinea);
}

window.addEventListener('online', () => { actualizarEstadoRed(); toast('Conexión recuperada'); });
window.addEventListener('offline', () => { actualizarEstadoRed(); toast('Sin conexión: puedes seguir trabajando, todo se guarda en el dispositivo.', { duracion: 5000 }); });

// ---------------- Instalación (beforeinstallprompt) ----------------

let eventoInstalacion = null;
const btnInstalar = document.getElementById('btn-instalar');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();           // usamos nuestro propio botón
  eventoInstalacion = e;
  btnInstalar.hidden = false;
});

btnInstalar.addEventListener('click', async () => {
  if (!eventoInstalacion) return;
  eventoInstalacion.prompt();
  const { outcome } = await eventoInstalacion.userChoice;
  eventoInstalacion = null;
  btnInstalar.hidden = true;
  if (outcome === 'accepted') toast('Instalando Surco…');
});

window.addEventListener('appinstalled', () => {
  btnInstalar.hidden = true;
  toast('Surco quedó instalada en tu dispositivo ✔');
});

// ---------------- Contador de pendientes y aviso diario ----------------

async function actualizarContador() {
  const r = await resumenPendientes();
  const n = r.vencidas.length + r.deHoy.length;
  const badge = document.getElementById('badge-pendientes');
  badge.textContent = n;
  badge.hidden = n === 0;
  return r;
}

/** Una vez al día, si el usuario ya dio permiso, avisa de lo vencido. */
async function avisoDiario(r) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (!r.vencidas.length && !r.deHoy.length) return;
  const ultimo = await db.leerMeta('ultimoAviso');
  if (ultimo === r.hoy) return;
  await avisarPendientes();
  await db.escribirMeta('ultimoAviso', r.hoy);
}

window.addEventListener('datos-cambiaron', actualizarContador);

// ---------------- Insignia de Netlify (plan gratuito) ----------------
// Netlify inyecta un botón "Powered by Netlify" fijo abajo a la derecha (#nl-badge-frame).
// No lo ocultamos: subimos el menú inferior del celular para que ambos se vean y se puedan tocar.
function vigilarInsigniaNetlify() {
  const revisar = () => document.body.classList.toggle('con-insignia', !!document.getElementById('nl-badge-frame'));
  revisar();
  new MutationObserver(revisar).observe(document.body, { childList: true });
}

// ---------------- Tema claro / oscuro ----------------

document.getElementById('btn-tema').addEventListener('click', async () => {
  const oscuroAhora = document.documentElement.hasAttribute('data-oscuro');
  await cambiarTema(oscuroAhora ? 'claro' : 'oscuro');
  window.dispatchEvent(new Event('tema-cambiado'));
});

// ---------------- Arranque ----------------

async function iniciar() {
  pintarTema();
  vigilarInsigniaNetlify();
  registrarServiceWorker();
  actualizarEstadoRed();
  try {
    await sembrarSiVacio();
  } catch (err) {
    console.error('No se pudo abrir IndexedDB:', err);
    main.innerHTML = '<div class="panel alerta"><h2>Sin almacenamiento local</h2><p>Este navegador bloqueó IndexedDB (¿modo incógnito?). La app necesita almacenamiento para funcionar sin conexión.</p></div>';
    return;
  }
  window.addEventListener('hashchange', navegar);
  await navegar();
  const r = await actualizarContador();
  avisoDiario(r).catch((e) => console.warn('Aviso diario no enviado:', e));
}

iniciar();
