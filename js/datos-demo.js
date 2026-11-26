// =============================================================
// datos-demo.js — Datos FICTICIOS de "Finca Tres Ríos" para la demostración.
// Se cargan en IndexedDB la primera vez que se abre la app.
// =============================================================
import * as db from './db.js';
import { fechaLocalISO } from './ui.js';

export const CULTIVOS = [
  { id: 'limon', clave: 'LIM', nombre: 'Limón persa', lote: 'Lote 1', surcos: 8, plantasPorSurco: 14 },
  { id: 'naranja', clave: 'NAR', nombre: 'Naranja valencia', lote: 'Lote 2', surcos: 6, plantasPorSurco: 12 },
  { id: 'pitahaya', clave: 'PIT', nombre: 'Pitahaya', lote: 'Lote 3', surcos: 5, plantasPorSurco: 16 },
];

export const RESPONSABLES = [
  'Ana Ruiz (técnica)',
  'Luis Méndez',
  'Rosa Torres',
  'Pedro Aguilar',
  'Carmen Díaz',
];

/** Generador pseudoaleatorio con semilla: el mapa demo siempre sale igual. */
function aleatorio(semilla) {
  let s = semilla;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const pad = (n) => String(n).padStart(2, '0');
export const idPlanta = (cultivo, surco, numero) => `${cultivo.clave}-S${pad(surco)}-P${pad(numero)}`;

function generarPlantas(cultivo, semilla) {
  const azar = aleatorio(semilla);
  const plantas = [];
  for (let s = 1; s <= cultivo.surcos; s++) {
    for (let p = 1; p <= cultivo.plantasPorSurco; p++) {
      const r = azar();
      const estado = r < 0.78 ? 'bueno' : r < 0.87 ? 'deshidratada' : r < 0.93 ? 'enferma' : r < 0.98 ? 'hueco' : 'quitar';
      plantas.push({
        id: idPlanta(cultivo, s, p),
        cultivoId: cultivo.id,
        surco: s,
        numero: p,
        estado,
        actualizado: new Date().toISOString(),
      });
    }
  }
  return plantas;
}

function diaRelativo(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return fechaLocalISO(d);
}

function generarTareas() {
  return [
    { titulo: 'Fertilización surcos 1–4', tipo: 'Fertilización', cultivoId: 'limon', fechaLimite: diaRelativo(-3), hecha: false },
    { titulo: 'Desmamonado de todo el lote', tipo: 'Desmamonado', cultivoId: 'naranja', fechaLimite: diaRelativo(-1), hecha: false },
    { titulo: 'Retirar plantas marcadas "por quitar"', tipo: 'Retiro de planta', cultivoId: 'limon', fechaLimite: diaRelativo(0), hecha: false },
    { titulo: 'Composta surcos 1–3', tipo: 'Composta', cultivoId: 'pitahaya', fechaLimite: diaRelativo(2), hecha: false },
    { titulo: 'Poda de formación', tipo: 'Poda', cultivoId: 'naranja', fechaLimite: diaRelativo(5), hecha: false },
    { titulo: 'Redondeo (cajete) surcos 5–8', tipo: 'Redondeo', cultivoId: 'limon', fechaLimite: diaRelativo(9), hecha: false },
    { titulo: 'Poda sanitaria', tipo: 'Poda', cultivoId: 'limon', fechaLimite: diaRelativo(-6), hecha: true, hechaEn: new Date(Date.now() - 6 * 864e5).toISOString() },
  ];
}

function generarActividades() {
  const hace = (h) => new Date(Date.now() - h * 3600e3).toISOString();
  return [
    { tipo: 'Poda', cultivoId: 'limon', surco: 2, plantaId: null, responsable: 'Luis Méndez', notas: 'Poda sanitaria del surco completo.', fecha: hace(150), foto: null, ubicacion: null },
    { tipo: 'Observación', cultivoId: 'naranja', surco: 4, plantaId: 'NAR-S04-P07', responsable: 'Ana Ruiz (técnica)', notas: 'Hojas amarillas, posible deshidratación.', fecha: hace(30), foto: null, ubicacion: null },
    { tipo: 'Composta', cultivoId: 'pitahaya', surco: 1, plantaId: null, responsable: 'Rosa Torres', notas: '2 carretillas por surco.', fecha: hace(6), foto: null, ubicacion: null },
  ];
}

/** Carga los datos demo solo si la base está vacía. Devuelve true si sembró. */
export async function sembrarSiVacio() {
  const yaSembrado = await db.leerMeta('sembrado', false);
  if (yaSembrado) return false;
  await cargarDatosDemo();
  return true;
}

export async function cargarDatosDemo() {
  await db.guardarVarios('cultivos', CULTIVOS);
  const plantas = CULTIVOS.flatMap((c, i) => generarPlantas(c, 1234 + i * 97));
  await db.guardarVarios('plantas', plantas);
  await db.guardarVarios('tareas', generarTareas());
  await db.guardarVarios('actividades', generarActividades());
  await db.escribirMeta('sembrado', true);
  await db.escribirMeta('responsable', RESPONSABLES[1]);
}
