// =============================================================================
// 🧩 AGRUPACIÓN DE PLANES, HALLAZGOS E INFORMES (etapa 1: lectura doble)
// Cada colección se guardará en pocos documentos `base_de_datos_grc_grupo_<coleccion>_N` con el campo
// `registros: { [id]: registro }`, y el documento principal llevará el índice
// `coleccionesAgrupadas: { <coleccion>: { version, partes } }` (como ya se hizo con riesgos).
// Sin índice para una colección, se lee exactamente como antes: el índice viaja en el documento
// principal, así que comprobarlo no cuesta lecturas.
// Con índice, una parte faltante es un error: nunca se sirven las subcolecciones (podrían estar viejas).
// =============================================================================
import { adminDb } from './firebaseAdmin.js';

export const COLECCIONES_AGRUPABLES = ['planes', 'hallazgos', 'informes'];
// Nombre de la subcolección actual → nombre de la colección agrupada.
const SUBCOLECCIONES_AGRUPABLES = { planes_accion: 'planes', hallazgos: 'hallazgos', informes: 'informes' };
const MAX_PARTES_GRUPO = 10;

export const grupoParteRef = (coleccion, parte) => adminDb.collection('workspace_compartido')
  .doc(`base_de_datos_grc_grupo_${coleccion}_${parte}`);

export const nombreAgrupable = coleccionRef => SUBCOLECCIONES_AGRUPABLES[coleccionRef?.id] || null;

export function indiceAgrupado(datosWorkspace, coleccion) {
  const indice = datosWorkspace?.coleccionesAgrupadas?.[coleccion];
  return indice && typeof indice === 'object' && Number.isInteger(indice.partes) &&
    indice.partes >= 1 && indice.partes <= MAX_PARTES_GRUPO ? indice : null;
}

// Asignación estable de cada registro a una parte según su ID (misma fórmula que los riesgos).
export const parteDeRegistro = (id, partes) => {
  let hash = 0;
  for (const caracter of String(id)) hash = (hash * 31 + caracter.charCodeAt(0)) >>> 0;
  return hash % partes;
};

/**
 * Registros de las partes con el mismo formato y orden que una subcolección: `{ id: clave, ...datos }`
 * (el campo `id` guardado prevalece, igual que con `documento.data()`), ordenados por ID de documento.
 */
export function registrosDeSnapshots(snapshots) {
  const pares = [];
  snapshots.forEach(snapshot => Object.entries(snapshot.get('registros') || {}).forEach(([clave, datos]) => {
    if (datos && typeof datos === 'object') pares.push([clave, { id: clave, ...datos }]);
  }));
  pares.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return pares.map(([, registro]) => registro);
}

/** Informe visible para los procesos asignados (mismo criterio que las consultas `in` / `array-contains-any`). */
export const informeEnProcesos = (informe, procesos) => procesos.includes(informe?.macroproceso) ||
  procesos.includes(informe?.proceso) ||
  (Array.isArray(informe?.macroprocesos) && informe.macroprocesos.some(proceso => procesos.includes(proceso)));

/**
 * Lector de partes con caché: dentro de una transacción (o de una carga completa) cada parte se lee
 * una sola vez aunque varias consultas la necesiten. `documentos` cuenta las lecturas facturables.
 */
export function crearLectorGrupos(datosWorkspace, transaction = null) {
  const partes = new Map();
  let documentos = 0;

  const leerParte = async (coleccion, parte) => {
    const clave = `${coleccion}:${parte}`;
    if (!partes.has(clave)) {
      const referencia = grupoParteRef(coleccion, parte);
      documentos += 1;
      partes.set(clave, transaction ? transaction.get(referencia) : referencia.get());
    }
    const snapshot = await partes.get(clave);
    if (!snapshot.exists) throw new Error(`Agrupación incompleta: falta la parte ${parte} de ${coleccion}. No se usan datos parciales.`);
    return snapshot;
  };

  return {
    get documentos() { return documentos; },
    agrupada: coleccion => Boolean(indiceAgrupado(datosWorkspace, coleccion)),
    /** Todos los registros de la colección, o null si no está agrupada. */
    todos: async coleccion => {
      const indice = indiceAgrupado(datosWorkspace, coleccion);
      if (!indice) return null;
      const snapshots = await Promise.all(Array.from({ length: indice.partes }, (_, parte) => leerParte(coleccion, parte)));
      return registrosDeSnapshots(snapshots);
    },
    /** Un registro por ID (lee solo su parte), o null si no existe. */
    porId: async (coleccion, id) => {
      const indice = indiceAgrupado(datosWorkspace, coleccion);
      const clave = String(id ?? '').trim();
      if (!indice || !clave) return null;
      const snapshot = await leerParte(coleccion, parteDeRegistro(clave, indice.partes));
      const registros = snapshot.get('registros') || {};
      return Object.hasOwn(registros, clave) && registros[clave] && typeof registros[clave] === 'object'
        ? { id: clave, ...registros[clave] }
        : null;
    },
  };
}
