// =============================================================
// sw.js — Service Worker de Surco
//
// Ciclo de vida:
//   install  → precarga (precache) el App Shell en CACHE_SHELL
//   activate → borra cachés de versiones anteriores y toma control
//   fetch    → aplica una estrategia según el tipo de recurso:
//      · Navegación (HTML)          → App Shell desde caché (cache-first) con respaldo offline.html
//      · Estáticos propios (css/js/img) → cache-first; si no está, red y se guarda (runtime)
//      · API de clima (Open-Meteo)  → network-first con tiempo límite; si falla, último dato en caché
//
// Para publicar una nueva versión: cambiar VERSION. El SW nuevo se instala,
// queda "en espera" y la app muestra el botón "Actualizar" (SKIP_WAITING).
// =============================================================

const VERSION = 'v1.1.0'; // v1.1.0: rediseño estilo Filament + modo oscuro
const CACHE_SHELL = `surco-shell-${VERSION}`;
const CACHE_RUNTIME = `surco-runtime-${VERSION}`;
const CACHE_API = 'surco-api'; // los datos dinámicos sobreviven entre versiones
const MAX_ENTRADAS_RUNTIME = 40;
const TIEMPO_LIMITE_RED_MS = 4000;

const APP_SHELL = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './css/base.css',
  './css/mapa.css',
  './css/actividades.css',
  './css/pendientes-ajustes.css',
  './js/app.js',
  './js/db.js',
  './js/ui.js',
  './js/iconos.js',
  './js/tema.js',
  './js/apis.js',
  './js/datos-demo.js',
  './js/vistas/mapa.js',
  './js/vistas/actividades.js',
  './js/vistas/pendientes.js',
  './js/vistas/ajustes.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/badge-96.png',
  './icons/favicon-32.png',
  './icons/apple-touch-icon.png',
];

// ---------------- INSTALL ----------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_SHELL)
      // cache: 'reload' evita guardar copias viejas que estén en la caché HTTP del navegador.
      .then((cache) => cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => console.log(`[SW] ${VERSION} instalado: App Shell en caché (${APP_SHELL.length} archivos)`)),
  );
  // No llamamos skipWaiting() aquí: la app pregunta al usuario antes de actualizar.
});

// ---------------- ACTIVATE ----------------
self.addEventListener('activate', (event) => {
  const vigentes = [CACHE_SHELL, CACHE_RUNTIME, CACHE_API];
  event.waitUntil((async () => {
    const nombres = await caches.keys();
    const viejas = nombres.filter((n) => n.startsWith('surco-') && !vigentes.includes(n));
    await Promise.all(viejas.map((n) => caches.delete(n)));
    if (viejas.length) console.log('[SW] Cachés antiguas eliminadas:', viejas);
    await self.clients.claim(); // controlar de inmediato las pestañas abiertas
    console.log(`[SW] ${VERSION} activo`);
  })());
});

// ---------------- MENSAJES desde la app ----------------
self.addEventListener('message', (event) => {
  const { tipo } = event.data || {};
  if (tipo === 'SKIP_WAITING') self.skipWaiting();
  if (tipo === 'VERSION') event.ports[0]?.postMessage({ version: VERSION });
});

// ---------------- FETCH ----------------
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // POST/PUT van directo a la red

  const url = new URL(request.url);

  // 1) Datos dinámicos: API de clima → network-first
  if (url.origin === 'https://api.open-meteo.com') {
    event.respondWith(networkFirst(request, CACHE_API));
    return;
  }

  // Solo manejamos recursos de nuestro propio origen.
  if (url.origin !== self.location.origin) return;

  // 2) Navegación: siempre se entrega el App Shell (la app usa rutas con #)
  if (request.mode === 'navigate') {
    event.respondWith(appShell(request));
    return;
  }

  // 3) Estáticos propios → cache-first
  event.respondWith(cacheFirst(request));
});

// ---------------- Estrategias ----------------

/**
 * Navegación:
 *  · La raíz de la app ("/" o "/index.html") → App Shell desde caché (cache-first).
 *  · Cualquier otra página → red; si no hay red, la página de respaldo offline.html.
 */
async function appShell(request) {
  const cache = await caches.open(CACHE_SHELL);
  const ruta = new URL(request.url).pathname;
  const raiz = new URL(self.registration.scope).pathname;
  const esRaiz = ruta === raiz || ruta === `${raiz}index.html`;

  if (esRaiz) {
    const enCache = await cache.match('./index.html');
    if (enCache) return enCache;
  }
  try {
    return await fetch(request);
  } catch {
    return (await cache.match('./offline.html')) || new Response('Sin conexion', { status: 503 });
  }
}

/** Cache-first: rápido y funciona offline. Lo que no estaba precargado se guarda al pedirlo. */
async function cacheFirst(request) {
  const enCache = await caches.match(request, { ignoreSearch: true });
  if (enCache) return enCache;
  try {
    const respuesta = await fetch(request);
    if (respuesta.ok) {
      const cache = await caches.open(CACHE_RUNTIME);
      await cache.put(request, respuesta.clone());
      recortarCache(CACHE_RUNTIME, MAX_ENTRADAS_RUNTIME);
    }
    return respuesta;
  } catch {
    if (request.destination === 'image') {
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="90"><rect width="100%" height="100%" fill="#e7e3d6"/><text x="50%" y="50%" text-anchor="middle" font-size="12" fill="#6b6b5e">Sin conexión</text></svg>',
        { headers: { 'Content-Type': 'image/svg+xml' } },
      );
    }
    return new Response('', { status: 504, statusText: 'Offline - sin copia en cache' });
  }
}

/** Network-first: dato fresco si hay red; si falla o tarda, el último guardado. */
async function networkFirst(request, nombreCache) {
  const cache = await caches.open(nombreCache);
  try {
    const respuesta = await conTiempoLimite(fetch(request), TIEMPO_LIMITE_RED_MS);
    if (respuesta.ok) await cache.put(request, respuesta.clone());
    return respuesta;
  } catch {
    const enCache = await cache.match(request);
    if (enCache) return enCache;
    return new Response(JSON.stringify({ error: 'sin-conexion' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }
}

function conTiempoLimite(promesa, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promesa.then((r) => { clearTimeout(t); resolve(r); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/** Evita que la caché runtime crezca sin límite (borra las entradas más antiguas). */
async function recortarCache(nombre, max) {
  const cache = await caches.open(nombre);
  const llaves = await cache.keys();
  for (let i = 0; i < llaves.length - max; i++) await cache.delete(llaves[i]);
}

// ---------------- Notificaciones ----------------
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = new URL(event.notification.data?.url || './#/pendientes', self.registration.scope).href;
  event.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const v of ventanas) {
      if ('focus' in v) {
        await v.focus();
        if ('navigate' in v) return v.navigate(destino);
        return undefined;
      }
    }
    return self.clients.openWindow(destino);
  })());
});
