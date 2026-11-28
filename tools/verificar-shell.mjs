// =============================================================
// verificar-shell.mjs — Revisión estática rápida (sin navegador). La corre el CI.
// Uso:  node tools/verificar-shell.mjs
// Detecta los errores que rompen el modo offline o la instalación:
//   1. Un archivo listado en APP_SHELL (sw.js) que no existe → el SW no se instala.
//   2. Un CSS/JS del proyecto que NO está en APP_SHELL → falla sin conexión.
//   3. Íconos y capturas del manifest que no existen o no miden lo que dicen.
// =============================================================
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const errores = [];
const leer = (ruta) => readFileSync(join(RAIZ, ruta), 'utf8');

// ---------- 1 y 2: APP_SHELL del Service Worker ----------
const sw = leer('sw.js');
const bloque = sw.match(/const APP_SHELL = \[([\s\S]*?)\];/);
if (!bloque) {
  errores.push('No se encontró la lista APP_SHELL en sw.js');
} else {
  const shell = [...bloque[1].matchAll(/'([^']+)'/g)].map((m) => m[1].replace(/^\.\//, ''));
  for (const archivo of shell.filter((a) => a !== '')) {
    if (!existsSync(join(RAIZ, archivo))) errores.push(`APP_SHELL incluye "${archivo}", pero el archivo no existe`);
  }
  const listar = (dir) => readdirSync(join(RAIZ, dir)).flatMap((n) => {
    const ruta = join(dir, n);
    return statSync(join(RAIZ, ruta)).isDirectory() ? listar(ruta) : [ruta.split(sep).join('/')];
  });
  for (const archivo of [...listar('css'), ...listar('js')]) {
    if (!shell.includes(archivo)) errores.push(`"${archivo}" no está en APP_SHELL de sw.js: fallará sin conexión`);
  }
  // Todo lo que index.html carga también debe estar precargado
  for (const [, ruta] of leer('index.html').matchAll(/(?:href|src)="([^"#:]+\.(?:css|js|png|json))"/g)) {
    if (!shell.includes(ruta)) errores.push(`index.html carga "${ruta}", pero no está en APP_SHELL`);
  }
  console.log(`APP_SHELL: ${shell.length} archivos revisados`);
}

// ---------- 3: manifest, íconos y capturas ----------
/** Lee ancho y alto de un PNG desde su cabecera IHDR. */
function medidaPng(ruta) {
  const b = readFileSync(join(RAIZ, ruta));
  if (b.toString('ascii', 1, 4) !== 'PNG') return null;
  return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
}

let manifest;
try {
  manifest = JSON.parse(leer('manifest.json'));
} catch (e) {
  errores.push(`manifest.json no es JSON válido: ${e.message}`);
}
if (manifest) {
  for (const campo of ['name', 'short_name', 'start_url', 'display', 'theme_color', 'background_color', 'icons']) {
    if (!manifest[campo]) errores.push(`Al manifest le falta "${campo}"`);
  }
  const tamanos = new Set();
  for (const img of [...(manifest.icons || []), ...(manifest.screenshots || [])]) {
    if (!existsSync(join(RAIZ, img.src))) { errores.push(`El manifest apunta a "${img.src}", que no existe`); continue; }
    const real = medidaPng(img.src);
    if (real !== img.sizes) errores.push(`"${img.src}" dice medir ${img.sizes} pero mide ${real}`);
    tamanos.add(img.sizes);
  }
  for (const requerido of ['192x192', '512x512']) {
    if (!tamanos.has(requerido)) errores.push(`Falta un ícono de ${requerido} (lo exige la rúbrica)`);
  }
  console.log(`Manifest: ${(manifest.icons || []).length} íconos y ${(manifest.screenshots || []).length} capturas revisados`);
}

if (errores.length) {
  console.error(`\n❌ ${errores.length} problema(s):\n- ${errores.join('\n- ')}`);
  process.exit(1);
}
console.log('\n✅ App Shell y manifest correctos');
