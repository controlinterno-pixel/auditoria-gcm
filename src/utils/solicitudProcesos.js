// 🏢 Macroprocesos y subprocesos que pide un usuario al registrarse (uno o varios, con todos o algunos de sus
// subprocesos). Lo usan el formulario de registro (armar la solicitud) y el servidor (validarla contra el catálogo).
// Convención: subprocesos vacíos = todos los subprocesos de los macroprocesos elegidos (como en Configuración).

const MAX_MACROPROCESOS = 30;
const MAX_SUBPROCESOS = 300;

/**
 * seleccion: { [macroproceso]: { todos: boolean, subprocesos: string[] } } → { procesos, subprocesos, error }.
 * Si todos los macroprocesos van con "todos", subprocesos queda vacío (= todos); si alguno lleva solo algunos,
 * se listan explícitos los de cada macroproceso (los "todos" con su lista completa del catálogo).
 */
export function armarSolicitudProcesos(seleccion = {}, mapaProcesos = {}) {
  const procesos = Object.keys(seleccion || {}).filter(macroproceso => Array.isArray(mapaProcesos?.[macroproceso]));
  if (procesos.length === 0) return { procesos: [], subprocesos: [], error: 'Elige al menos un macroproceso.' };
  const sinSubproceso = procesos.find(macroproceso => !seleccion[macroproceso].todos && !(seleccion[macroproceso].subprocesos || []).length);
  if (sinSubproceso) return { procesos, subprocesos: [], error: `En ${sinSubproceso} marca "Todos los subprocesos" o elige al menos uno.` };
  const todosCompletos = procesos.every(macroproceso => seleccion[macroproceso].todos);
  const subprocesos = todosCompletos ? [] : [...new Set(procesos.flatMap(macroproceso => (
    seleccion[macroproceso].todos ? mapaProcesos[macroproceso] : seleccion[macroproceso].subprocesos
  )))];
  return { procesos, subprocesos, error: '' };
}

/** Valida en el servidor lo que llega del registro. Devuelve { procesos, subprocesos } o null si no es válido. */
export function validarSolicitudProcesos({ procesos, subprocesos }, mapaProcesos = {}) {
  if (!Array.isArray(procesos) || procesos.length === 0 || procesos.length > MAX_MACROPROCESOS) return null;
  if (!Array.isArray(subprocesos) || subprocesos.length > MAX_SUBPROCESOS) return null;
  if (procesos.some(proceso => typeof proceso !== 'string' || !Object.hasOwn(mapaProcesos, proceso) || !Array.isArray(mapaProcesos[proceso]))) return null;
  const disponibles = new Set(procesos.flatMap(proceso => mapaProcesos[proceso]));
  if (subprocesos.some(subproceso => typeof subproceso !== 'string' || !disponibles.has(subproceso))) return null;
  return { procesos: [...new Set(procesos)], subprocesos: [...new Set(subprocesos)] };
}
