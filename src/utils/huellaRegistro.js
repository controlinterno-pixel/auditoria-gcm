// src/utils/huellaRegistro.js - Huella de un registro para detectar que otra persona lo cambió.
// La calcula el servidor (al entregar los datos y al comparar en el guardado); el cliente solo la devuelve.

// Listas que el administrador guarda por /api/grc/sync, con la clave que identifica cada registro.
export const LISTAS_CON_HUELLA = {
  hallazgos: registro => registro.id,
  planes: registro => registro.id,
  informesAuditoria: registro => registro.id,
  evaluaciones: registro => registro.id,
  comites: registro => registro.id,
  incidentes: registro => registro.id,
  cronograma: registro => registro.id,
  monitoreo: registro => registro.id,
  programas: registro => registro.id,
  fuentesMejora: registro => registro.codigo || registro.id,
};

// Campos que no forman parte del contenido: el id (la lectura lo agrega desde el nombre del documento)
// y la huella de partida que envía el cliente.
const CAMPOS_FUERA_DE_HUELLA = new Set(['id', 'docId', 'huellaBase']);

/** Serialización estable: no depende del orden de las llaves; los campos sin valor no cuentan. */
export const serializarRegistro = (valor, nivel = 0) => {
  if (Array.isArray(valor)) return `[${valor.map(item => serializarRegistro(item, nivel + 1)).join(',')}]`;
  if (valor && typeof valor === 'object') {
    const llaves = Object.keys(valor)
      .filter(llave => valor[llave] !== undefined && !(nivel === 0 && CAMPOS_FUERA_DE_HUELLA.has(llave)))
      .sort();
    return `{${llaves.map(llave => `${JSON.stringify(llave)}:${serializarRegistro(valor[llave], nivel + 1)}`).join(',')}}`;
  }
  return JSON.stringify(valor ?? null);
};

/** Huella corta (cyrb53) del contenido del registro. */
export const huellaRegistro = registro => {
  const texto = serializarRegistro(registro);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < texto.length; i += 1) {
    const codigo = texto.charCodeAt(i);
    h1 = Math.imul(h1 ^ codigo, 2654435761);
    h2 = Math.imul(h2 ^ codigo, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};

export const claveRegistro = (obtener, registro) => {
  const clave = registro && typeof registro === 'object' ? obtener(registro) : null;
  return clave === undefined || clave === null || clave === '' ? null : String(clave);
};

/** { lista: { clave: huella } } de las listas con huella presentes en `datos`. */
export function huellasDeDatos(datos) {
  return Object.fromEntries(Object.entries(LISTAS_CON_HUELLA)
    .filter(([lista]) => Array.isArray(datos?.[lista]))
    .map(([lista, obtener]) => [lista, Object.fromEntries(datos[lista]
      .map(registro => [claveRegistro(obtener, registro), registro])
      .filter(([clave]) => clave !== null)
      .map(([clave, registro]) => [clave, huellaRegistro(registro)]))]));
}

