// =============================================================
// pdf-evidencias.mjs — Une las capturas de docs/evidencias/ en un PDF.
// Uso:  node tools/pdf-evidencias.mjs     (primero: node tools/capturas-evidencia.mjs)
// Genera docs/evidencias/Evidencias-Surco-PWA.pdf con Edge/Chrome (--print-to-pdf).
// =============================================================
import { spawn } from 'node:child_process';
import { readdirSync, writeFileSync, existsSync, readFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(RAIZ, 'docs', 'evidencias');
const NAVEGADORES = [process.env.CHROME_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'];

// Descripciones tomadas del índice que genera capturas-evidencia.mjs
const indice = readFileSync(join(DIR, 'README.md'), 'utf8');
const desc = Object.fromEntries([...indice.matchAll(/### (.+\.png)\n(.+)\n/g)].map((m) => [m[1], m[2]]));
const fecha = (indice.match(/tomadas el (.+?) con/) || [])[1] || '';
const imagenes = readdirSync(DIR).filter((f) => f.endsWith('.png')).sort();
const moviles = imagenes.filter((f) => f.includes('-movil-'));
const escritorio = imagenes.filter((f) => f.includes('-escritorio-'));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const figura = (f) => `<figure><img src="${f}"><figcaption><b>${f.slice(0, 2)}.</b> ${esc(desc[f] || f)}</figcaption></figure>`;

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Evidencias — Surco PWA</title>
<style>
  @page { size: Letter; margin: 14mm; }
  body { font-family: "Segoe UI", system-ui, sans-serif; color: #111827; margin: 0; }
  h1 { font-size: 20pt; margin: 0 0 2mm; color: #047857; }
  .meta { font-size: 10pt; color: #4b5563; line-height: 1.5; margin-bottom: 4mm; }
  .nota { font-size: 9pt; background: #f0fdf4; border-left: 3px solid #059669; padding: 2mm 3mm; margin-bottom: 5mm; }
  .rejilla { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5mm 6mm; }
  .rejilla.ancha { grid-template-columns: 1fr; }
  figure { margin: 0; break-inside: avoid; text-align: center; }
  figure img { max-width: 100%; max-height: 105mm; border: 1px solid #d1d5db; border-radius: 3mm; }
  .ancha figure img { max-height: 95mm; }
  figcaption { font-size: 8.5pt; color: #374151; margin-top: 1.5mm; line-height: 1.35; }
  h2 { font-size: 13pt; margin: 6mm 0 3mm; break-after: avoid; }
  .salto { break-before: page; }
</style></head><body>
<h1>Evidencias de funcionamiento — Surco (PWA)</h1>
<div class="meta">
  <b>Sitio en producción:</b> https://surcopwa.netlify.app &nbsp;·&nbsp; <b>Repositorio:</b> https://github.com/josuetapia-dev/surco-pwa<br>
  <b>Equipo obsi:</b> Josué Pérez Tapia · Ángel de Gabriel Aparicio Maldonado · Andrey Emilio Cabriales Ramírez<br>
  Aplicaciones Web Progresivas · Docente: Guillermo Martínez Maza · Capturas del sitio publicado (${esc(fecha)})
</div>
<div class="nota">Capturas tomadas automáticamente sobre el sitio publicado, emulando un celular Android (412×915) y un escritorio (1366×768).
Las capturas 12–14 se tomaron <b>con la red cortada</b> (página y Service Worker). En las capturas 05–06 la cámara y el GPS son simulados por el navegador de prueba.</div>
<h2>Celular</h2>
<div class="rejilla">${moviles.map(figura).join('')}</div>
<h2 class="salto">Escritorio</h2>
<div class="rejilla ancha">${escritorio.map(figura).join('')}</div>
</body></html>`;

const archivoHtml = join(DIR, '_evidencias.html');
const salida = join(DIR, 'Evidencias-Surco-PWA.pdf');
writeFileSync(archivoHtml, html);
const nav = NAVEGADORES.find((r) => r && existsSync(r));
// Se imprime con DevTools (Page.printToPDF): más confiable que --print-to-pdf en Windows.
const temporal = mkdtempSync(join(tmpdir(), 'surco-pdf-'));
const puerto = 9300 + Math.floor(Math.random() * 600);
const proceso = spawn(nav, ['--headless=new', `--remote-debugging-port=${puerto}`, `--user-data-dir=${temporal}`,
  '--no-first-run', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
try {
  let wsUrl;
  for (let i = 0; i < 50 && !wsUrl; i++) {
    try { wsUrl = (await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl; } catch { /* arrancando */ }
    if (!wsUrl) await new Promise((r) => setTimeout(r, 200));
  }
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0; const pend = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
  const cdp = (method, params = {}) => new Promise((res) => { const n = ++id; pend.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
  await cdp('Page.enable');
  await cdp('Page.navigate', { url: pathToFileURL(archivoHtml).href });
  await new Promise((r) => setTimeout(r, 2500)); // que carguen las imágenes
  const r = await cdp('Page.printToPDF', { printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false });
  if (r.error) throw new Error(r.error.message);
  writeFileSync(salida, Buffer.from(r.result.data, 'base64'));
  ws.close();
} finally {
  if (process.platform === 'win32') spawn('taskkill', ['/PID', String(proceso.pid), '/T', '/F'], { stdio: 'ignore' });
  else proceso.kill();
  rmSync(archivoHtml, { force: true });
  setTimeout(() => { try { rmSync(temporal, { recursive: true, force: true }); } catch { /* sin acción */ } }, 1000);
}
console.log(`✅ ${salida} (${imagenes.length} capturas)`);
