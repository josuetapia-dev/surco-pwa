// =============================================================
// servidor-local.mjs — Servidor estático mínimo para probar la PWA en local.
// Uso:  node tools/servidor-local.mjs [puerto]      (por defecto 5173)
// Los Service Workers funcionan en http://localhost sin HTTPS.
// =============================================================
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = Number(process.argv[2]) || 5173;
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.md': 'text/markdown; charset=utf-8',
};

createServer(async (req, res) => {
  try {
    const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let archivo = normalize(join(RAIZ, ruta));
    if (!archivo.startsWith(RAIZ) || archivo.includes(`${sep}privado`)) { res.writeHead(403).end(); return; }
    if ((await stat(archivo).catch(() => null))?.isDirectory()) archivo = join(archivo, 'index.html');
    const datos = await readFile(archivo);
    res.writeHead(200, {
      'Content-Type': TIPOS[extname(archivo)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(datos);
    console.log(200, ruta);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('No encontrado');
    console.log(404, req.url);
  }
}).listen(PUERTO, () => console.log(`Surco en http://localhost:${PUERTO}`));
