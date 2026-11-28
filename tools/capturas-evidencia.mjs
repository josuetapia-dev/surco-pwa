// =============================================================
// capturas-evidencia.mjs — Toma capturas del sitio PUBLICADO para la entrega.
// Uso:  node tools/capturas-evidencia.mjs [url]     (por defecto https://surcopwa.netlify.app/)
// Emula un celular Android (412×915) y un escritorio (1366×768) en Edge/Chrome.
// Guarda las imágenes en docs/evidencias/.
// Nota: la cámara y el GPS son SIMULADOS por el navegador de prueba; las capturas
// de instalación, splash, permisos nativos y notificación se toman en el celular real.
// =============================================================
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const URL_APP = process.argv[2] || 'https://surcopwa.netlify.app/';
const SALIDA = join(RAIZ, 'docs', 'evidencias');
const NAVEGADORES = [
  process.env.CHROME_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
];
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 15; SM-X230) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(SALIDA, { recursive: true });

const perfil = mkdtempSync(join(tmpdir(), 'surco-evidencia-'));
const PUERTO = 9300 + Math.floor(Math.random() * 600);
const ejecutable = NAVEGADORES.find((r) => r && existsSync(r));
const navegador = spawn(ejecutable, [
  '--headless=new', `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--use-fake-device-for-media-stream', 'about:blank',
], { stdio: 'ignore' });

// ---------- Conexión DevTools ----------
async function objetivos() {
  for (let i = 0; i < 50; i++) {
    try { return await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json(); } catch { await espera(200); }
  }
  throw new Error('No se pudo conectar al navegador');
}
async function sesion(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0; const pend = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
  });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => { const n = ++id; pend.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params })); });
  return { ws, cdp };
}

const pagina = (await objetivos()).find((t) => t.type === 'page');
const { ws, cdp } = await sesion(pagina.webSocketDebuggerUrl);
const evaluar = async (expr) => {
  const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};
async function esperarA(expr, ms = 10000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) { try { if (await evaluar(expr)) return true; } catch { /* recargando */ } await espera(150); }
  return false;
}
async function movil() {
  await cdp('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });
  await cdp('Emulation.setUserAgentOverride', { userAgent: UA_ANDROID, platform: 'Android' });
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
}
async function escritorio() {
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
}
const ir = async (hash) => { await evaluar(`location.hash = ${JSON.stringify(hash)}`); await espera(1000); };
const desplazarA = (sel) => evaluar(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (el) window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 80); return !!el; })()`).then(() => espera(400));
const tomadas = [];
async function captura(nombre, descripcion) {
  const { data } = await cdp('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(SALIDA, nombre), Buffer.from(data, 'base64'));
  tomadas.push({ nombre, descripcion });
  console.log(`📸 ${nombre} — ${descripcion}`);
}

/** Corta (o restablece) la red de la página Y del Service Worker. */
async function sinRed(offline) {
  const cond = { offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 };
  await cdp('Network.enable');
  await cdp('Network.emulateNetworkConditions', cond);
  for (const t of (await objetivos()).filter((o) => o.type === 'service_worker' && o.webSocketDebuggerUrl)) {
    const s = await sesion(t.webSocketDebuggerUrl);
    await s.cdp('Network.enable');
    await s.cdp('Network.emulateNetworkConditions', cond);
    s.ws.close();
  }
}

try {
  await Promise.all([cdp('Page.enable'), cdp('Runtime.enable')]);
  await movil();
  await cdp('Page.navigate', { url: `${URL_APP}#/mapa` });
  if (!await esperarA("document.querySelectorAll('.planta').length > 0", 20000)) throw new Error('La app no cargó');
  await esperarA('!!navigator.serviceWorker.controller', 15000);
  await espera(1500); // clima

  // ---- En línea ----
  await captura('01-movil-mapa.png', 'Mapa de campo con el estado de cada planta (semáforo) y widgets de estadísticas');
  await desplazarA('.seccion');
  await captura('02-movil-mapa-cuadricula.png', 'Cuadrícula de surcos y plantas con su leyenda');
  await evaluar("document.querySelector('[data-id=\"LIM-S03-P02\"]').click()");
  await espera(700);
  await captura('03-movil-ficha-planta.png', 'Ficha de la planta: cambiar estado e historial');
  await evaluar("document.getElementById('dialogo').close()");

  // Web APIs (permisos concedidos por el navegador de prueba; cámara y GPS simulados)
  await cdp('Browser.grantPermissions', { origin: new URL(URL_APP).origin, permissions: ['videoCapture', 'geolocation', 'notifications'] }).catch(() => {});
  await cdp('Emulation.setGeolocationOverride', { latitude: 20.4531, longitude: -97.3214, accuracy: 6 });
  await ir('#/actividades/nueva?cultivo=limon&surco=3&planta=LIM-S03-P02&tipo=Poda');
  await evaluar("document.querySelector('[name=notas]').value = 'Poda de formación en el surco 3'");
  await captura('04-movil-nueva-actividad.png', 'Formulario de nueva actividad (se guarda aunque no haya internet)');
  await evaluar("document.querySelector('#btn-geo').click()");
  await esperarA("document.querySelector('#geo-vista').innerText.includes('20.45')", 8000);
  await evaluar("document.querySelector('#btn-camara').click()");
  if (await esperarA("!!document.querySelector('#btn-capturar') && !document.querySelector('#btn-capturar').disabled", 8000)) {
    await espera(800);
    await captura('05-movil-camara-abierta.png', 'Web API de cámara abierta (cámara simulada del navegador de prueba)');
    await evaluar("document.querySelector('#btn-capturar').click()");
  }
  await esperarA("!!document.querySelector('#foto-vista img')", 6000);
  await desplazarA('.evidencia');
  await captura('06-movil-evidencia-foto-gps.png', 'Evidencia: foto comprimida y coordenadas GPS con su precisión');
  await evaluar("document.querySelector('#form-actividad').requestSubmit()");
  await esperarA("location.hash === '#/actividades'", 6000);
  await espera(900);
  await captura('07-movil-actividades.png', 'Registro de actividades con foto, tipo, responsable y GPS (guardado en IndexedDB)');

  await ir('#/pendientes');
  await captura('08-movil-pendientes.png', 'Pendientes: tareas vencidas (lo que no se hizo), de hoy y próximas');
  await evaluar("document.querySelector('#btn-avisar').click()");
  await espera(1200);
  await captura('09-movil-aviso-enviado.png', 'Botón "Avisarme": permiso de notificaciones concedido y aviso enviado');

  await ir('#/ajustes');
  await captura('10-movil-ajustes-permisos.png', 'Ajustes: estado de los permisos de cámara, ubicación y notificaciones');
  await desplazarA('.seccion:last-child');
  await esperarA("document.querySelector('#txt-version')?.textContent.startsWith('v')", 4000);
  await captura('11-movil-ajustes-service-worker.png', 'Service Worker activo y versión de caché publicada');

  // ---- SIN CONEXIÓN (página y Service Worker sin red) ----
  await sinRed(true);
  await cdp('Page.navigate', { url: `${URL_APP}#/mapa` });
  await cdp('Page.reload', { ignoreCache: true });
  await esperarA("document.querySelectorAll('.planta').length > 0", 15000);
  await espera(1200);
  await captura('12-movil-offline-mapa.png', 'SIN CONEXIÓN: la app abre desde la caché del Service Worker (indicador en ámbar)');
  await ir('#/actividades/nueva?cultivo=naranja&surco=2&tipo=Fertilizaci%C3%B3n');
  await evaluar("document.querySelector('[name=notas]').value = 'Registrada sin internet'; document.querySelector('#form-actividad').requestSubmit()");
  await esperarA("location.hash === '#/actividades'", 6000);
  await espera(700);
  await captura('13-movil-offline-actividad-guardada.png', 'SIN CONEXIÓN: actividad guardada en IndexedDB y visible en la lista');
  await cdp('Page.navigate', { url: `${URL_APP}pagina-no-guardada` });
  await esperarA("document.body.innerText.includes('Estás sin conexión')", 8000);
  await captura('14-movil-offline-respaldo.png', 'SIN CONEXIÓN: página no guardada → página de respaldo offline.html (no el error del navegador)');
  await sinRed(false);

  // ---- Modo oscuro y escritorio ----
  await cdp('Page.navigate', { url: `${URL_APP}#/mapa` });
  await esperarA("document.querySelectorAll('.planta').length > 0", 15000);
  await evaluar("import('/js/tema.js').then(m => m.cambiarTema('oscuro'))");
  await espera(1200);
  await captura('15-movil-modo-oscuro.png', 'Modo oscuro');
  await evaluar("import('/js/tema.js').then(m => m.cambiarTema('claro'))");
  await escritorio();
  await ir('#/mapa'); await espera(800);
  await captura('16-escritorio-mapa.png', 'Escritorio: App Shell con menú lateral y mapa');
  await ir('#/actividades');
  await captura('17-escritorio-actividades.png', 'Escritorio: tabla de actividades');
  await ir('#/pendientes');
  await captura('18-escritorio-pendientes.png', 'Escritorio: calendario de pendientes');

  // Índice de evidencias
  const md = ['# Evidencias del sitio publicado', '', `Sitio: ${URL_APP} · tomadas el ${new Date().toLocaleString('es-MX')} con \`node tools/capturas-evidencia.mjs\`.`, '',
    '> La cámara y el GPS de las capturas 05–06 son **simulados** por el navegador de prueba. La instalación, la splash screen, los diálogos de permiso nativos y la notificación del sistema se capturan en el celular real.', '',
    ...tomadas.map((t) => `### ${t.nombre}\n${t.descripcion}\n\n![${t.descripcion}](${t.nombre})\n`)];
  writeFileSync(join(SALIDA, 'README.md'), md.join('\n'));
  console.log(`\n✅ ${tomadas.length} capturas en docs/evidencias/`);
} catch (err) {
  console.error('❌', err.message);
  process.exitCode = 1;
} finally {
  ws.close();
  if (process.platform === 'win32') spawn('taskkill', ['/PID', String(navegador.pid), '/T', '/F'], { stdio: 'ignore' });
  else navegador.kill();
  await espera(800);
  try { rmSync(perfil, { recursive: true, force: true }); } catch { /* sin acción */ }
}
