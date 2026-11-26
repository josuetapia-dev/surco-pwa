// =============================================================
// generar-iconos.mjs — Genera los íconos PNG de la PWA sin dependencias.
// Uso:  node tools/generar-iconos.mjs
// Dibuja una "parcela" de 3×3 plantas (colores de estado) sobre fondo verde.
// =============================================================
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SALIDA = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
mkdirSync(SALIDA, { recursive: true });

// ---------- Codificador PNG mínimo (RGBA 8 bits) ----------
const TABLA_CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function bloque(tipo, datos) {
  const largo = Buffer.alloc(4); largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}
function png(ancho, alto, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0); ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const filas = Buffer.alloc((ancho * 4 + 1) * alto);
  for (let y = 0; y < alto; y++) {
    filas[y * (ancho * 4 + 1)] = 0;
    rgba.copy(filas, y * (ancho * 4 + 1) + 1, y * ancho * 4, (y + 1) * ancho * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloque('IHDR', ihdr), bloque('IDAT', deflateSync(filas, { level: 9 })), bloque('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- Dibujo con suavizado (supermuestreo 4×4) ----------
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const FONDO = hex('#1f5130');
const SURCO = hex('#2f7a47');
const PLANTAS = [
  ['#7ee29a', '#7ee29a', '#f2c94c'],
  ['#7ee29a', '#ef6b6b', '#7ee29a'],
  ['#7ee29a', '#7ee29a', '#7ee29a'],
].map((f) => f.map(hex));

/**
 * Devuelve el color [r,g,b,a] en el punto (u,v) normalizado 0..1.
 * modo: 'normal' (esquinas redondeadas), 'maskable' (fondo completo, dibujo en zona segura),
 *       'badge' (silueta blanca sobre transparente, para la barra de notificaciones).
 */
function muestra(u, v, modo) {
  const escala = modo === 'maskable' ? 0.62 : 0.8; // zona segura del ícono maskable ≈ 80% de diámetro
  const x = (u - 0.5) / escala + 0.5;
  const y = (v - 0.5) / escala + 0.5;

  // Fondo
  let fondo = null;
  if (modo === 'maskable') fondo = [...FONDO, 255];
  if (modo === 'normal') {
    const r = 0.22, dx = Math.max(Math.abs(u - 0.5) - (0.5 - r), 0), dy = Math.max(Math.abs(v - 0.5) - (0.5 - r), 0);
    if (dx * dx + dy * dy <= r * r) fondo = [...FONDO, 255];
  }

  // Tres surcos (bandas) con tres plantas cada uno
  for (let fila = 0; fila < 3; fila++) {
    const cy = 0.2 + fila * 0.3;
    for (let col = 0; col < 3; col++) {
      const cx = 0.2 + col * 0.3;
      const d = Math.hypot(x - cx, y - cy);
      if (d <= 0.115) {
        if (modo === 'badge') return [255, 255, 255, 255];
        return [...PLANTAS[fila][col], 255];
      }
    }
    if (modo !== 'badge' && fondo && Math.abs(y - cy) < 0.03 && x > 0.06 && x < 0.94) return [...SURCO, 255];
  }
  return fondo || [0, 0, 0, 0];
}

function dibujar(tam, modo) {
  const datos = Buffer.alloc(tam * tam * 4);
  const ss = 4;
  for (let py = 0; py < tam; py++) {
    for (let px = 0; px < tam; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const [cr, cg, cb, ca] = muestra((px + (sx + 0.5) / ss) / tam, (py + (sy + 0.5) / ss) / tam, modo);
          r += cr * ca; g += cg * ca; b += cb * ca; a += ca;
        }
      }
      const i = (py * tam + px) * 4;
      datos[i] = a ? Math.round(r / a) : 0;
      datos[i + 1] = a ? Math.round(g / a) : 0;
      datos[i + 2] = a ? Math.round(b / a) : 0;
      datos[i + 3] = Math.round(a / (ss * ss));
    }
  }
  return png(tam, tam, datos);
}

const ICONOS = [
  ['icon-192.png', 192, 'normal'],
  ['icon-512.png', 512, 'normal'],
  ['maskable-192.png', 192, 'maskable'],
  ['maskable-512.png', 512, 'maskable'],
  ['apple-touch-icon.png', 180, 'maskable'], // iOS no admite transparencia
  ['favicon-32.png', 32, 'normal'],
  ['badge-96.png', 96, 'badge'],
];

for (const [nombre, tam, modo] of ICONOS) {
  writeFileSync(join(SALIDA, nombre), dibujar(tam, modo));
  console.log(`✔ icons/${nombre} (${tam}×${tam}, ${modo})`);
}
