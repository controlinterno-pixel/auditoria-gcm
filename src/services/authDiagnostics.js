// src/services/authDiagnostics.js - Trazabilidad segura del ciclo de vida de la sesión
// 🛡️ Nunca se registran tokens, contraseñas, correos, UID ni contenido de documentos.

const EVENTS_KEY = 'gcm_auth_diag';
const NOTICE_KEY = 'gcm_auth_notice';
const MAX_EVENTS = 20;
const CHANNEL_NAME = 'gcm-auth';
const REASON_TTL_MS = 30_000;
const initializedAt = Date.now();

let pendingLocalReason = null;
let pendingRemoteReason = null;
let channel = null;

const safeStorage = (storageName) => {
  try {
    return typeof window !== 'undefined' ? window[storageName] : null;
  } catch {
    return null;
  }
};

// Solo admite valores primitivos cortos para impedir que se cuele información sensible.
const sanitizeDetails = (details = {}) => Object.fromEntries(
  Object.entries(details)
    .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
    .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 80) : value])
);

export const readAuthEvents = () => {
  try {
    const parsed = JSON.parse(safeStorage('localStorage')?.getItem(EVENTS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const recordAuthEvent = (type, details = {}) => {
  const event = {
    type,
    at: new Date().toISOString(),
    sinceInitMs: Date.now() - initializedAt,
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    ...sanitizeDetails(details),
  };
  try {
    const events = [...readAuthEvents(), event].slice(-MAX_EVENTS);
    safeStorage('localStorage')?.setItem(EVENTS_KEY, JSON.stringify(events));
  } catch {
    // El diagnóstico nunca debe interrumpir la aplicación.
  }
  if (type !== 'token-refreshed') console.info('[AUTH-DIAG]', event);
  return event;
};

const getChannel = () => {
  if (channel || typeof BroadcastChannel === 'undefined') return channel;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.unref?.(); // Solo existe en Node (pruebas): no mantiene vivo el proceso.
    channel.onmessage = ({ data }) => {
      if (data?.type === 'signout') pendingRemoteReason = { reason: String(data.reason || 'other-tab'), at: Date.now() };
    };
  } catch {
    channel = null;
  }
  return channel;
};

/** Registra el motivo ANTES de llamar a signOut() para poder explicar el cierre al usuario. */
export const markSignOutReason = (reason, notice = '') => {
  pendingLocalReason = { reason, at: Date.now() };
  recordAuthEvent('signout-requested', { reason });
  if (notice) setAuthNotice(notice);
  try {
    getChannel()?.postMessage({ type: 'signout', reason });
  } catch {
    // Sin BroadcastChannel solo se pierde la distinción entre pestañas.
  }
};

/** Devuelve el origen del último cierre: local (esta pestaña), other-tab o external (Firebase). */
export const consumeSignOutReason = () => {
  const vigente = (entry) => entry && Date.now() - entry.at < REASON_TTL_MS;
  const result = vigente(pendingLocalReason)
    ? { reason: pendingLocalReason.reason, origin: 'local' }
    : vigente(pendingRemoteReason)
      ? { reason: pendingRemoteReason.reason, origin: 'other-tab' }
      : { reason: 'firebase-session-ended', origin: 'external' };
  pendingLocalReason = null;
  pendingRemoteReason = null;
  return result;
};

export const AUTH_NOTICE_EVENT = 'gcm:auth-notice';

export const setAuthNotice = (message) => {
  try {
    safeStorage('sessionStorage')?.setItem(NOTICE_KEY, String(message).slice(0, 240));
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(AUTH_NOTICE_EVENT));
  } catch {
    // Ignorado: el aviso es una ayuda visual, no un control de seguridad.
  }
};

export const consumeAuthNotice = () => {
  try {
    const storage = safeStorage('sessionStorage');
    const notice = storage?.getItem(NOTICE_KEY) || '';
    storage?.removeItem(NOTICE_KEY);
    return notice;
  } catch {
    return '';
  }
};

export const SIGN_OUT_NOTICES = {
  'other-tab': 'Cerraste la sesión en otra pestaña o ventana de este navegador.',
  'firebase-session-ended': 'Tu sesión terminó por seguridad (cambio de contraseña, cuenta deshabilitada o credenciales revocadas). Inicia sesión de nuevo.',
};

/** Instala listeners de conectividad y renovación de token. Devuelve la función de limpieza. */
export const installAuthDiagnostics = (auth, onIdTokenChanged) => {
  if (typeof window === 'undefined') return () => {};
  getChannel();
  const online = () => recordAuthEvent('network-online');
  const offline = () => recordAuthEvent('network-offline');
  window.addEventListener('online', online);
  window.addEventListener('offline', offline);
  let lastUid = null;
  const unsubscribe = onIdTokenChanged(auth, user => {
    const uid = user?.uid || null;
    if (uid && uid === lastUid) recordAuthEvent('token-refreshed');
    lastUid = uid;
  });
  window.gcmAuthDiagnostics = readAuthEvents;
  return () => {
    window.removeEventListener('online', online);
    window.removeEventListener('offline', offline);
    unsubscribe();
  };
};
