// =============================================================
// apis.js — Integración de Web APIs nativas del dispositivo
//   1) Cámara          (MediaDevices.getUserMedia)
//   2) Geolocalización (navigator.geolocation)
//   3) Notificaciones  (Notification + ServiceWorkerRegistration.showNotification)
//   + Permissions API para consultar el estado de cada permiso.
// Cada función maneja: soportado / concedido / negado / error de hardware.
// =============================================================

// ---------------- Permisos ----------------

/**
 * Consulta el estado de un permiso sin pedirlo.
 * Devuelve 'granted' | 'denied' | 'prompt' | 'no-soportado'.
 */
export async function estadoPermiso(nombre) {
  if (nombre === 'notifications' && !('Notification' in window)) return 'no-soportado';
  if (nombre === 'geolocation' && !('geolocation' in navigator)) return 'no-soportado';
  if (nombre === 'camera' && !navigator.mediaDevices?.getUserMedia) return 'no-soportado';
  try {
    const r = await navigator.permissions.query({ name: nombre });
    return r.state;
  } catch {
    // Algunos navegadores (Firefox/Safari) no permiten consultar 'camera'.
    if (nombre === 'notifications') return Notification.permission === 'default' ? 'prompt' : Notification.permission;
    return 'prompt';
  }
}

export const TEXTO_PERMISO = {
  granted: 'Concedido',
  denied: 'Negado',
  prompt: 'Sin solicitar',
  'no-soportado': 'No soportado',
};

// ---------------- 1) Cámara ----------------

export const camaraSoportada = () => !!navigator.mediaDevices?.getUserMedia;

/** Solicita la cámara trasera y la muestra en el <video>. Lanza error si se niega. */
export async function abrirCamara(video) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  return stream;
}

export function detenerCamara(stream) {
  stream?.getTracks().forEach((t) => t.stop());
}

/** Toma un cuadro del video y lo comprime a JPEG (máx. 1280 px). */
export function capturarFoto(video, maxLado = 1280, calidad = 0.72) {
  const escala = Math.min(1, maxLado / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * escala);
  canvas.height = Math.round(video.videoHeight * escala);
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', calidad));
}

/** Alternativa cuando no hay getUserMedia: comprime un archivo elegido con <input capture>. */
export async function comprimirArchivo(archivo, maxLado = 1280, calidad = 0.72) {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', calidad));
}

export function mensajeErrorCamara(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Permiso de cámara negado. Actívalo desde el candado de la barra de direcciones › Permisos.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No se encontró una cámara en este dispositivo.';
    case 'NotReadableError':
      return 'La cámara está ocupada por otra aplicación.';
    default:
      return `No se pudo abrir la cámara (${err?.message || 'error desconocido'}).`;
  }
}

// ---------------- 2) Geolocalización ----------------

export const geoSoportada = () => 'geolocation' in navigator;

/** Obtiene la posición actual. Resuelve {lat, lon, precision, fecha}. */
export function obtenerUbicacion({ timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!geoSoportada()) {
      reject(Object.assign(new Error('Geolocalización no soportada'), { code: 0 }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({
        lat: Number(p.coords.latitude.toFixed(6)),
        lon: Number(p.coords.longitude.toFixed(6)),
        precision: Math.round(p.coords.accuracy),
        fecha: new Date(p.timestamp).toISOString(),
      }),
      reject,
      { enableHighAccuracy: true, timeout, maximumAge: 60000 },
    );
  });
}

export function mensajeErrorGeo(err) {
  switch (err?.code) {
    case 0: return 'Este dispositivo no soporta geolocalización.';
    case 1: return 'Permiso de ubicación negado. La actividad se guardará sin coordenadas.';
    case 2: return 'No hay señal GPS disponible. Sal a cielo abierto e inténtalo de nuevo.';
    case 3: return 'El GPS tardó demasiado en responder. Inténtalo de nuevo.';
    default: return 'No se pudo obtener la ubicación.';
  }
}

export const enlaceMapa = (u) => `https://www.openstreetmap.org/?mlat=${u.lat}&mlon=${u.lon}#map=18/${u.lat}/${u.lon}`;

// ---------------- 3) Notificaciones ----------------

export const notificacionesSoportadas = () => 'Notification' in window && 'serviceWorker' in navigator;

/** Pide permiso SOLO por acción del usuario. Devuelve 'granted' | 'denied' | 'default' | 'no-soportado'. */
export async function pedirPermisoNotificaciones() {
  if (!notificacionesSoportadas()) return 'no-soportado';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

/**
 * Muestra una notificación a través del Service Worker
 * (en Android, `new Notification()` no está permitido; showNotification sí).
 */
export async function notificar(titulo, { cuerpo, url = './#/pendientes', etiqueta = 'surco' } = {}) {
  if (!notificacionesSoportadas() || Notification.permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification(titulo, {
    body: cuerpo,
    icon: 'icons/icon-192.png',
    badge: 'icons/badge-96.png',
    tag: etiqueta,
    renotify: true,
    data: { url },
    vibrate: [120, 60, 120],
  });
  return true;
}
