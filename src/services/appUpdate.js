// src/services/appUpdate.js - Recarga controlada cuando se publica una versión nueva de la app
// La sesión de Firebase persiste en IndexedDB: recargar NO cierra la sesión.

const CHUNK_RELOAD_KEY = 'gcm_chunk_reload_at';
const SKIP_WELCOME_KEY = 'gcm_skip_welcome';
const RESUME_CONTEXT_KEY = 'gcm_resume_context';
const UPDATE_NOTICE_KEY = 'gcm_update_notice';
const CHUNK_RELOAD_COOLDOWN_MS = 30_000;
export const UPDATE_AVAILABLE_EVENT = 'gcm:update-available';
export const UPDATE_NOTICE_MESSAGE = 'GCM se actualizó a la versión más reciente. Tu sesión sigue activa y volviste a donde estabas.';

// Campos de navegación que se restauran tras la recarga (pestaña, menú lateral y subpestañas).
export const CAMPOS_NAVEGACION = ['activeTab', 'menuAbierto', 'subTabPlanificar', 'subTabResultados', 'subTabPlanes', 'subTabGobernanza'];
const VALOR_NAVEGACION_VALIDO = /^[\w-]{1,60}$/;

let pendingChangesProbe = () => false;
let navegacionActual = {};
let contextoReanudacion; // undefined = todavía no leído en esta carga

const session = () => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export const setPendingChangesProbe = (probe) => {
  pendingChangesProbe = typeof probe === 'function' ? probe : () => false;
};

// Solo se guardan identificadores simples de navegación (nunca datos del usuario).
const sanearNavegacion = (navegacion = {}) => Object.fromEntries(
  CAMPOS_NAVEGACION
    .filter(campo => typeof navegacion[campo] === 'string' && VALOR_NAVEGACION_VALIDO.test(navegacion[campo]))
    .map(campo => [campo, navegacion[campo]])
);

export const rememberNavigation = (navegacion) => {
  navegacionActual = sanearNavegacion(navegacion);
};

export const rememberActiveTab = (tab) => rememberNavigation({ ...navegacionActual, activeTab: String(tab || '') });

export const isChunkLoadError = (error) => /dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk/i
  .test(`${error?.name || ''} ${error?.message || ''}`);

/** Recarga conservando el contexto de trabajo y deja un aviso para mostrarlo al volver. */
export const reloadPreservingContext = () => {
  const storage = session();
  storage?.setItem(SKIP_WELCOME_KEY, '1');
  storage?.setItem(UPDATE_NOTICE_KEY, '1');
  if (Object.keys(navegacionActual).length) storage?.setItem(RESUME_CONTEXT_KEY, JSON.stringify(navegacionActual));
  window.location.reload();
  return true;
};

/**
 * Recarga automática ante archivos de una versión anterior.
 * Si hay cambios sin guardar no recarga: avisa para que el usuario guarde primero.
 */
export const reloadForFreshAssets = () => {
  if (pendingChangesProbe()) {
    window.dispatchEvent(new CustomEvent(UPDATE_AVAILABLE_EVENT));
    return false;
  }
  const storage = session();
  const lastAttempt = Number(storage?.getItem(CHUNK_RELOAD_KEY) || 0);
  if (Date.now() - lastAttempt < CHUNK_RELOAD_COOLDOWN_MS) return false;
  storage?.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  return reloadPreservingContext();
};

export const consumeSkipWelcome = () => {
  const storage = session();
  const skip = storage?.getItem(SKIP_WELCOME_KEY) === '1';
  storage?.removeItem(SKIP_WELCOME_KEY);
  return skip;
};

/** Contexto de navegación a restaurar en esta carga (se lee una sola vez y se descarta). */
export const obtenerContextoReanudacion = () => {
  if (contextoReanudacion === undefined) {
    const storage = session();
    try {
      contextoReanudacion = sanearNavegacion(JSON.parse(storage?.getItem(RESUME_CONTEXT_KEY) || '{}'));
    } catch {
      contextoReanudacion = {};
    }
    storage?.removeItem(RESUME_CONTEXT_KEY);
  }
  return contextoReanudacion;
};

export const consumeResumeTab = () => obtenerContextoReanudacion().activeTab || '';

/** true una sola vez tras una recarga por versión nueva. */
export const consumeUpdateNotice = () => {
  const storage = session();
  const pendiente = storage?.getItem(UPDATE_NOTICE_KEY) === '1';
  storage?.removeItem(UPDATE_NOTICE_KEY);
  return pendiente;
};
