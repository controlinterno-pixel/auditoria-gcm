// src/services/appUpdate.js - Recarga controlada cuando se publica una versión nueva de la app
// La sesión de Firebase persiste en IndexedDB: recargar NO cierra la sesión.

const CHUNK_RELOAD_KEY = 'gcm_chunk_reload_at';
const SKIP_WELCOME_KEY = 'gcm_skip_welcome';
const RESUME_TAB_KEY = 'gcm_resume_tab';
const CHUNK_RELOAD_COOLDOWN_MS = 30_000;
export const UPDATE_AVAILABLE_EVENT = 'gcm:update-available';

let pendingChangesProbe = () => false;
let currentTab = '';

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

export const rememberActiveTab = (tab) => {
  currentTab = String(tab || '');
};

export const isChunkLoadError = (error) => /dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk/i
  .test(`${error?.name || ''} ${error?.message || ''}`);

/** Recarga conservando el contexto de trabajo. Devuelve false si no recargó. */
export const reloadPreservingContext = () => {
  const storage = session();
  storage?.setItem(SKIP_WELCOME_KEY, '1');
  if (currentTab) storage?.setItem(RESUME_TAB_KEY, currentTab);
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

export const consumeResumeTab = () => {
  const storage = session();
  const tab = storage?.getItem(RESUME_TAB_KEY) || '';
  storage?.removeItem(RESUME_TAB_KEY);
  return tab;
};
