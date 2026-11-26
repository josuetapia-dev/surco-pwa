// =============================================================
// db.js — Capa de persistencia local con IndexedDB (sin librerías)
// Base: "surco"  ·  Versión: 1
// Stores (almacenes de objetos):
//   cultivos    keyPath "id"                     → lotes/cultivos de la finca
//   plantas     keyPath "id"   idx porCultivo     → cada planta del mapa y su estado
//   actividades keyPath "id"   autoIncrement      → poda, fertilización... con foto (Blob) y GPS
//   tareas      keyPath "id"   autoIncrement      → calendario de lo que toca hacer
//   meta        keyPath "clave"                   → ajustes y banderas (perfil, semilla, avisos)
// =============================================================

const DB_NOMBRE = 'surco';
const DB_VERSION = 1;
export const STORES = ['cultivos', 'plantas', 'actividades', 'tareas', 'meta'];

let dbPromesa = null;

/** Abre (o crea/actualiza) la base de datos. Se reutiliza la misma conexión. */
export function abrirDB() {
  if (dbPromesa) return dbPromesa;
  dbPromesa = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NOMBRE, DB_VERSION);

    // Solo se ejecuta al crear la base o al subir DB_VERSION: aquí se define el esquema.
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('cultivos')) {
        db.createObjectStore('cultivos', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('plantas')) {
        const s = db.createObjectStore('plantas', { keyPath: 'id' });
        s.createIndex('porCultivo', 'cultivoId');
        s.createIndex('porEstado', 'estado');
      }
      if (!db.objectStoreNames.contains('actividades')) {
        const s = db.createObjectStore('actividades', { keyPath: 'id', autoIncrement: true });
        s.createIndex('porFecha', 'fecha');
        s.createIndex('porPlanta', 'plantaId');
        s.createIndex('porCultivo', 'cultivoId');
      }
      if (!db.objectStoreNames.contains('tareas')) {
        const s = db.createObjectStore('tareas', { keyPath: 'id', autoIncrement: true });
        s.createIndex('porFecha', 'fechaLimite');
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'clave' });
      }
    };

    req.onsuccess = () => {
      const db = req.result;
      // Si otra pestaña abre una versión más nueva, cerramos para no bloquearla.
      db.onversionchange = () => { db.close(); dbPromesa = null; };
      resolve(db);
    };
    req.onerror = () => { dbPromesa = null; reject(req.error); };
    req.onblocked = () => console.warn('[db] Apertura bloqueada: cierra otras pestañas de Surco.');
  });
  return dbPromesa;
}

/** Convierte un IDBRequest en Promesa. */
function promesa(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Ejecuta `fn` dentro de una transacción y resuelve cuando la transacción
 * termina (oncomplete), garantizando que los datos ya quedaron escritos.
 */
async function transaccion(stores, modo, fn) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, modo);
    let resultado;
    Promise.resolve(fn(tx)).then((r) => { resultado = r; }, (e) => { try { tx.abort(); } catch { /* ya terminada */ } reject(e); });
    tx.oncomplete = () => resolve(resultado);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transacción abortada'));
  });
}

// ---------- Operaciones CRUD genéricas ----------

export const obtenerTodos = (store) =>
  transaccion(store, 'readonly', (tx) => promesa(tx.objectStore(store).getAll()));

export const obtener = (store, clave) =>
  transaccion(store, 'readonly', (tx) => promesa(tx.objectStore(store).get(clave)));

export const obtenerPorIndice = (store, indice, valor) =>
  transaccion(store, 'readonly', (tx) => promesa(tx.objectStore(store).index(indice).getAll(valor)));

export const contar = (store) =>
  transaccion(store, 'readonly', (tx) => promesa(tx.objectStore(store).count()));

/** Inserta o actualiza. Devuelve la llave (útil con autoIncrement). */
export const guardar = (store, objeto) =>
  transaccion(store, 'readwrite', (tx) => promesa(tx.objectStore(store).put(objeto)));

export const guardarVarios = (store, lista) =>
  transaccion(store, 'readwrite', (tx) => {
    const s = tx.objectStore(store);
    lista.forEach((o) => s.put(o));
  });

export const borrar = (store, clave) =>
  transaccion(store, 'readwrite', (tx) => promesa(tx.objectStore(store).delete(clave)));

/** Vacía todos los almacenes en una sola transacción. */
export const vaciarTodo = () =>
  transaccion(STORES, 'readwrite', (tx) => { STORES.forEach((s) => tx.objectStore(s).clear()); });

// ---------- Ayudantes para la tabla meta ----------

export async function leerMeta(clave, porDefecto = null) {
  const r = await obtener('meta', clave);
  return r ? r.valor : porDefecto;
}

export const escribirMeta = (clave, valor) => guardar('meta', { clave, valor });
