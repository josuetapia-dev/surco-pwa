// =============================================================
// ui.js — Utilidades de interfaz compartidas por las vistas.
// =============================================================

export const ESTADOS = {
  bueno: { nombre: 'Buen desarrollo', corto: 'Bien' },
  deshidratada: { nombre: 'Deshidratada', corto: 'Deshidr.' },
  enferma: { nombre: 'Enferma', corto: 'Enferma' },
  quitar: { nombre: 'Por quitar', corto: 'Quitar' },
  hueco: { nombre: 'Hueco por resembrar', corto: 'Hueco' },
};

export const TIPOS_ACTIVIDAD = [
  'Poda',
  'Fertilización',
  'Desmamonado',
  'Redondeo',
  'Composta',
  'Observación',
  'Retiro de planta',
  'Resiembra',
];

/** Escapa texto para insertarlo de forma segura en HTML. */
export function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/** Fecha local en formato YYYY-MM-DD (sin desfase por zona horaria). */
export function fechaLocalISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fechaHora(iso) {
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

export function fechaLarga(yyyyMmDd) {
  const [a, m, d] = yyyyMmDd.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Muestra un aviso breve en la parte inferior. */
export function toast(mensaje, { accion, alAccion, duracion = 3500, tipo = '' } = {}) {
  const cont = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = `toast ${tipo}`;
  t.setAttribute('role', 'status');
  t.textContent = mensaje;
  if (accion) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = accion;
    b.addEventListener('click', () => { alAccion?.(); t.remove(); });
    t.append(b);
  }
  cont.append(t);
  if (duracion > 0) setTimeout(() => t.remove(), duracion);
  return t;
}

/** Abre el <dialog> global con el HTML indicado. Devuelve el elemento. */
export function abrirDialogo(html, { alCerrar } = {}) {
  const d = document.getElementById('dialogo');
  d.innerHTML = html;
  d.onclose = () => { alCerrar?.(); d.innerHTML = ''; };
  d.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', () => d.close()));
  if (!d.open) d.showModal();
  return d;
}

export function cerrarDialogo() {
  const d = document.getElementById('dialogo');
  if (d.open) d.close();
}
