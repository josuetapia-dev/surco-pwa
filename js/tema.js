// =============================================================
// tema.js — Modo claro / oscuro.
// Preferencia: 'sistema' | 'claro' | 'oscuro'. Se guarda en localStorage
// (para aplicarla antes de pintar, sin parpadeo) y en IndexedDB (meta.tema).
// =============================================================
import * as db from './db.js';

const CLAVE = 'surco-tema';
const consulta = matchMedia('(prefers-color-scheme: dark)');

export const temaActual = () => localStorage.getItem(CLAVE) || 'sistema';

/** Pone o quita data-oscuro en <html> y ajusta el color de la barra del sistema. */
export function pintarTema(tema = temaActual()) {
  const oscuro = tema === 'oscuro' || (tema === 'sistema' && consulta.matches);
  document.documentElement.toggleAttribute('data-oscuro', oscuro);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', oscuro ? '#111827' : '#ffffff');
}

export async function cambiarTema(tema) {
  localStorage.setItem(CLAVE, tema);
  pintarTema(tema);
  await db.escribirMeta('tema', tema);
}

// Si el usuario eligió "sistema", seguimos los cambios del sistema operativo en vivo.
consulta.addEventListener('change', () => { if (temaActual() === 'sistema') pintarTema(); });
