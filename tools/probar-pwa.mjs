// =============================================================
// probar-pwa.mjs — Prueba automática de la PWA con Microsoft Edge/Chrome (DevTools Protocol)
// Uso:  node tools/probar-pwa.mjs
// Verifica: registro del SW, cachés, manifest e instalabilidad, IndexedDB,
// funcionamiento SIN servidor (offline real) y errores en consola.
// Además genera las capturas que usa manifest.json (carpeta screenshots/).
// =============================================================
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = 5199;
const URL_APP = `http://localhost:${PUERTO}/`;
const NAVEGADORES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
];
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const resultados = [];
const ok = (nombre, paso, detalle = '') => { resultados.push({ nombre, paso, detalle }); console.log(`${paso ? '✅' : '❌'} ${nombre}${detalle ? ` — ${detalle}` : ''}`); };

// ---------- Servidor y navegador ----------
const servidor = spawn(process.execPath, [join(RAIZ, 'tools', 'servidor-local.mjs'), String(PUERTO)], { stdio: 'ignore' });
const perfil = mkdtempSync(join(tmpdir(), 'surco-prueba-'));
const ejecutable = NAVEGADORES.find(existsSync);
if (!ejecutable) { console.error('No se encontró Edge ni Chrome'); process.exit(1); }
const PUERTO_DEBUG = 9300 + Math.floor(Math.random() * 600); // puerto distinto en cada corrida
const navegador = spawn(ejecutable, [
  '--headless=new', `--remote-debugging-port=${PUERTO_DEBUG}`, `--user-data-dir=${perfil}`,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--use-fake-device-for-media-stream', // cámara simulada (patrón de prueba) para probar la Web API de cámara
  'about:blank',
], { stdio: 'ignore' });

async function conectar() {
  for (let i = 0; i < 50; i++) {
    try {
      const lista = await (await fetch(`http://127.0.0.1:${PUERTO_DEBUG}/json/list`)).json();
      const pagina = lista.find((t) => t.type === 'page');
      if (pagina) return pagina.webSocketDebuggerUrl;
    } catch { /* aún arrancando */ }
    await espera(200);
  }
  throw new Error('No se pudo conectar al navegador');
}

const ws = new WebSocket(await conectar());
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let siguienteId = 0;
const pendientes = new Map();
const erroresConsola = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pendientes.has(m.id)) {
    const { resolve, reject } = pendientes.get(m.id);
    pendientes.delete(m.id);
    m.error ? reject(new Error(m.error.message)) : resolve(m.result);
  } else if (m.method === 'Runtime.exceptionThrown') {
    erroresConsola.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    erroresConsola.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  } else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
    erroresConsola.push(`${m.params.entry.text} ${m.params.entry.url || ''}`);
  }
});
const cdp = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++siguienteId;
  pendientes.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluar = async (expresion) => {
  const r = await cdp('Runtime.evaluate', { expression: expresion, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};
async function esperarA(expresion, ms = 10000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    try { if (await evaluar(expresion)) return true; } catch { /* página recargando */ }
    await espera(150);
  }
  return false;
}
async function ir(hash, ancho, alto, movil = false) {
  await cdp('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: 1, mobile: movil });
  await evaluar(`location.hash = ${JSON.stringify(hash)}`);
  await espera(900);
}
async function captura(nombre) {
  const { data } = await cdp('Page.captureScreenshot', { format: 'png' });
  mkdirSync(join(RAIZ, 'screenshots'), { recursive: true });
  writeFileSync(join(RAIZ, 'screenshots', nombre), Buffer.from(data, 'base64'));
}

try {
  await Promise.all([cdp('Page.enable'), cdp('Runtime.enable'), cdp('Log.enable')]);
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url: URL_APP });

  // 1) App Shell + IndexedDB sembrada
  ok('App Shell y mapa renderizados', await esperarA("document.querySelectorAll('.planta').length > 0"));
  const nPlantas = await evaluar("document.querySelectorAll('.planta').length");
  ok('IndexedDB con datos demo', nPlantas === 112, `${nPlantas} plantas en el mapa de Limón`);

  // 2) Service Worker
  ok('Service Worker registrado y activo', await esperarA("navigator.serviceWorker.ready.then(r => !!r.active)"));
  ok('Service Worker controla la página (clients.claim)', await esperarA('!!navigator.serviceWorker.controller'));
  const cachés = await evaluar(`(async () => { const o = {}; for (const k of await caches.keys()) o[k] = (await (await caches.open(k)).keys()).length; return o; })()`);
  const shell = Object.entries(cachés).find(([k]) => k.startsWith('surco-shell-'));
  ok('Precache del App Shell (install)', !!shell && shell[1] >= 19, JSON.stringify(cachés));
  // En la 1.ª visita el SW aún no controlaba la página; al volver al mapa, el clima ya pasa por el SW.
  await ir('#/ajustes', 1280, 800); await ir('#/mapa', 1280, 800);
  ok('Recurso dinámico (clima) guardado con network-first', await esperarA("caches.open('surco-api').then(c => c.keys()).then(k => k.length > 0)", 8000));

  // 3) Manifest e instalabilidad
  const manifest = await cdp('Page.getAppManifest');
  ok('Manifest sin errores', manifest.errors.length === 0, manifest.errors.map((e) => e.message).join(' | ') || 'sin errores');
  let instal = null;
  for (let i = 0; i < 10 && !instal; i++) {
    instal = await cdp('Page.getInstallabilityErrors').catch(() => null); // puede fallar mientras la página cambia
    if (!instal) await espera(500);
  }
  instal ??= { installabilityErrors: [{ errorId: 'no se pudo consultar' }] };
  ok('Instalable (sin errores de instalabilidad)', instal.installabilityErrors.length === 0, instal.installabilityErrors.map((e) => e.errorId).join(', ') || 'instalable');

  // 4) Capturas para el manifest y el README
  await ir('#/mapa', 1280, 800); await captura('escritorio-mapa.png');
  await ir('#/mapa', 540, 1080, true); await captura('movil-mapa.png');
  await ir('#/pendientes', 540, 1080, true); await captura('movil-pendientes.png');
  await ir('#/actividades/nueva?cultivo=limon&surco=3&planta=LIM-S03-P02', 540, 1080, true); await captura('movil-nueva-actividad.png');
  await ir('#/actividades', 1280, 800); await captura('escritorio-actividades.png');
  await ir('#/ajustes', 1280, 800); await captura('escritorio-ajustes.png');

  // 4b) Web APIs nativas con permisos CONCEDIDOS (cámara simulada + GPS simulado + notificaciones)
  await cdp('Browser.grantPermissions', { origin: URL_APP.slice(0, -1), permissions: ['videoCapture', 'geolocation', 'notifications'] });
  await cdp('Emulation.setGeolocationOverride', { latitude: 20.453, longitude: -97.321, accuracy: 8 });
  await ir('#/actividades/nueva?cultivo=naranja&surco=2', 1280, 800);
  await evaluar("document.querySelector('#btn-geo').click()");
  ok('Geolocalización: obtiene coordenadas', await esperarA("document.querySelector('#geo-vista').innerText.includes('20.453')", 8000),
    await evaluar("document.querySelector('#geo-vista').innerText.replace(/\\n/g, ' ')"));
  await evaluar("document.querySelector('#btn-camara').click()");
  const camaraLista = await esperarA("!!document.querySelector('#btn-capturar') && !document.querySelector('#btn-capturar').disabled", 8000);
  if (camaraLista) await evaluar("new Promise(r => setTimeout(r, 600)).then(() => document.querySelector('#btn-capturar').click())");
  ok('Cámara: abre, captura y comprime la foto', await esperarA("!!document.querySelector('#foto-vista img')", 6000),
    await evaluar("document.querySelector('#estado-camara').textContent"));
  await captura('escritorio-actividad-con-foto-gps.png');
  const conEvidencia = await evaluar(`(async () => {
    const db = await import('/js/db.js');
    document.querySelector('[name=notas]').value = 'Prueba con foto y GPS';
    document.querySelector('#form-actividad').requestSubmit();
    await new Promise(r => setTimeout(r, 1200));
    const a = (await db.obtenerTodos('actividades')).find(x => x.notas === 'Prueba con foto y GPS');
    return a ? { fotoKB: Math.round((a.foto?.size || 0) / 1024), tipoFoto: a.foto?.type, ubicacion: a.ubicacion } : null;
  })()`);
  ok('IndexedDB guarda la foto (Blob) y el GPS de la actividad', !!conEvidencia?.fotoKB && !!conEvidencia?.ubicacion, JSON.stringify(conEvidencia));
  await ir('#/actividades', 1280, 800); await captura('escritorio-actividades.png');
  await ir('#/pendientes', 1280, 800);
  await evaluar("document.querySelector('#btn-avisar').click()");
  ok('Notificaciones: se muestra el aviso de pendientes', await esperarA("navigator.serviceWorker.ready.then(r => r.getNotifications()).then(n => n.length > 0)", 6000),
    await evaluar("navigator.serviceWorker.ready.then(r => r.getNotifications()).then(n => n.map(x => x.title).join(' | ') || document.querySelector('#estado-notif').textContent)"));

  // 5) OFFLINE REAL: apagamos el servidor y recargamos
  servidor.kill();
  await espera(500);
  const servidorCaido = await fetch(URL_APP).then(() => false, () => true); // se comprueba desde Node, no desde la página
  await cdp('Page.navigate', { url: `${URL_APP}#/mapa` });
  await cdp('Page.reload', { ignoreCache: true });
  ok('Sin servidor: la app carga desde caché', await esperarA("document.querySelectorAll('.planta').length === 112", 10000), servidorCaido ? 'servidor apagado' : 'OJO: el servidor seguía respondiendo');
  await captura('escritorio-offline-mapa.png');
  await ir('#/actividades/nueva', 1280, 800);
  const guardado = await evaluar(`(async () => {
    const db = await import('/js/db.js');
    const antes = await db.contar('actividades');
    document.querySelector('[name=notas]').value = 'Prueba automática sin conexión';
    document.querySelector('#form-actividad').requestSubmit();
    await new Promise(r => setTimeout(r, 1200));
    return { antes, despues: await db.contar('actividades'), hash: location.hash };
  })()`);
  ok('Sin servidor: se guarda una actividad en IndexedDB', guardado.despues === guardado.antes + 1, JSON.stringify(guardado));
  await captura('escritorio-offline-actividades.png');
  ok('Sin servidor: la actividad aparece en la lista', await evaluar("document.body.innerText.includes('Prueba automática sin conexión')"));

  // 6) Navegar a una página no guardada sin servidor → offline.html (no el dinosaurio del navegador)
  await cdp('Page.navigate', { url: `${URL_APP}pagina-no-guardada` });
  ok('Sin servidor: página no guardada muestra offline.html', await esperarA("document.body.innerText.includes('Estás sin conexión')", 6000));
  await captura('escritorio-offline-respaldo.png');

  // 7) Consola limpia
  const reales = erroresConsola.filter((e) => !/ERR_CONNECTION_REFUSED|Failed to fetch/.test(e));
  ok('Consola sin errores', reales.length === 0, reales.join(' | ') || `${erroresConsola.length} aviso(s) esperados de la prueba offline`);
} catch (err) {
  ok('Ejecución de la prueba', false, err.message);
} finally {
  ws.close();
  servidor.kill();
  // Edge abre varios procesos hijos: en Windows se cierra el árbol completo.
  if (process.platform === 'win32') spawn('taskkill', ['/PID', String(navegador.pid), '/T', '/F'], { stdio: 'ignore' });
  else navegador.kill();
  await espera(800);
  try { rmSync(perfil, { recursive: true, force: true }); } catch { /* Edge puede tardar en soltar archivos */ }
  const fallos = resultados.filter((r) => !r.paso).length;
  console.log(`\n${resultados.length - fallos}/${resultados.length} pruebas pasaron`);
  process.exit(fallos ? 1 : 0);
}
