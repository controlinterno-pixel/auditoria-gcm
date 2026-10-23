// =============================================================================
// 🧩 AGRUPACIÓN DE PLANES, HALLAZGOS E INFORMES (etapa 1: lectura doble)
// Cada colección se guardará en pocos documentos `base_de_datos_grc_grupo_<coleccion>_N` con el campo
// `registros: { [id]: registro }`, y el documento principal llevará el índice
// `coleccionesAgrupadas: { <coleccion>: { version, partes } }` (como ya se hizo con riesgos).
// Sin índice para una colección, se lee exactamente como antes: el índice viaja en el documento
// principal, así que comprobarlo no cuesta lecturas.
// Con índice, una parte faltante es un error: nunca se sirven las subcolecciones (podrían estar viejas).
// =============================================================================
import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebaseAdmin.js';
import { logger } from './logger.js';

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

/** Tras la limpieza (etapa 4) el documento `base_de_datos_grc_informes` ya no existe ni se lee. */
export const informesLegadosEliminados = datosWorkspace => Boolean(indiceAgrupado(datosWorkspace, 'informes')?.legadoEliminadoEn);

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
const paresDeSnapshots = snapshots => {
  const pares = [];
  snapshots.forEach(snapshot => Object.entries(snapshot.get('registros') || {}).forEach(([clave, datos]) => {
    if (datos && typeof datos === 'object') pares.push([clave, datos]);
  }));
  return pares.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
};

export const registrosDeSnapshots = snapshots => paresDeSnapshots(snapshots).map(([clave, datos]) => ({ id: clave, ...datos }));

// Aviso temprano: una parte nunca debe acercarse al límite de 1 MiB por documento.
const BYTES_AVISO_PARTE = 700_000;
const avisarSiParteGrande = (coleccion, parte, snapshot) => {
  const bytes = Buffer.byteLength(JSON.stringify(snapshot.get('registros') || {}));
  if (bytes > BYTES_AVISO_PARTE) logger.warn('[GRUPOS] Parte cerca del límite de 1 MiB: hay que repartirla', { coleccion, parte, bytes });
};

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
      partes.set(clave, Promise.resolve(transaction ? transaction.get(referencia) : referencia.get()).then(snapshot => {
        if (snapshot.exists) avisarSiParteGrande(coleccion, parte, snapshot);
        return snapshot;
      }));
    }
    const snapshot = await partes.get(clave);
    if (!snapshot.exists) throw new Error(`Agrupación incompleta: falta la parte ${parte} de ${coleccion}. No se usan datos parciales.`);
    return snapshot;
  };
  const leerTodas = coleccion => {
    const indice = indiceAgrupado(datosWorkspace, coleccion);
    return indice ? Promise.all(Array.from({ length: indice.partes }, (_, parte) => leerParte(coleccion, parte))) : null;
  };
  // Datos guardados de un registro (sin agregar el id), o null si no existe.
  const datosPorId = async (coleccion, id) => {
    const indice = indiceAgrupado(datosWorkspace, coleccion);
    const clave = String(id ?? '').trim();
    if (!indice || !clave) return null;
    const snapshot = await leerParte(coleccion, parteDeRegistro(clave, indice.partes));
    const registros = snapshot.get('registros') || {};
    return Object.hasOwn(registros, clave) && registros[clave] && typeof registros[clave] === 'object' ? registros[clave] : null;
  };

  return {
    get documentos() { return documentos; },
    agrupada: coleccion => Boolean(indiceAgrupado(datosWorkspace, coleccion)),
    /** Todos los registros de la colección, o null si no está agrupada. */
    todos: async coleccion => {
      const snapshots = await leerTodas(coleccion);
      return snapshots ? registrosDeSnapshots(snapshots) : null;
    },
    /** Map(clave → datos guardados) como los documentos de una subcolección, o null si no está agrupada. */
    mapa: async coleccion => {
      const snapshots = await leerTodas(coleccion);
      return snapshots ? new Map(paresDeSnapshots(snapshots)) : null;
    },
    datosPorId,
    /** Un registro por ID (lee solo su parte), o null si no existe. */
    porId: async (coleccion, id) => {
      const datos = await datosPorId(coleccion, id);
      return datos ? { id: String(id).trim(), ...datos } : null;
    },
    /** Lo mismo que `transaction.get(subcoleccion.doc(id))`: { exists, id, data() }. */
    snapshotPorId: async (coleccion, id) => {
      const datos = await datosPorId(coleccion, id);
      return { exists: Boolean(datos), id: String(id).trim(), data: () => (datos ? { ...datos } : undefined) };
    },
    guardar: (escritor, coleccion, registros, opciones) => guardarRegistrosAgrupados(escritor, datosWorkspace, coleccion, registros, opciones),
    eliminar: (escritor, coleccion, ids) => eliminarRegistrosAgrupados(escritor, datosWorkspace, coleccion, ids),
  };
}

// -----------------------------------------------------------------------------
// Escrituras sobre partes. `escritor` es una transacción o un lote (misma API set/delete).
// Cada llamada hace una sola escritura por parte y nunca reemplaza la parte completa: solo toca los
// registros indicados, así que dos cambios simultáneos sobre registros distintos no se pisan.
// -----------------------------------------------------------------------------
const agruparPorParte = (indice, entradas) => {
  const porParte = new Map();
  entradas.forEach(([clave, valor]) => {
    const parte = parteDeRegistro(clave, indice.partes);
    if (!porParte.has(parte)) porParte.set(parte, {});
    porParte.get(parte)[clave] = valor;
  });
  return porParte;
};

const exigirIndice = (datosWorkspace, coleccion) => {
  const indice = indiceAgrupado(datosWorkspace, coleccion);
  if (!indice) throw new Error(`La colección ${coleccion} no está agrupada.`);
  return indice;
};

const clavesValidas = registros => registros.map(([id, datos]) => [String(id ?? '').trim(), datos])
  .filter(([clave]) => clave);

/**
 * Guarda registros completos. `merge: false` reemplaza cada registro (como `set(doc, datos)`);
 * `merge: true` fusiona los campos (como `set(doc, datos, { merge: true })`).
 * Devuelve el número de escrituras (una por parte tocada).
 */
export function guardarRegistrosAgrupados(escritor, datosWorkspace, coleccion, registros, { merge = false } = {}) {
  const indice = exigirIndice(datosWorkspace, coleccion);
  const porParte = agruparPorParte(indice, clavesValidas(registros));
  porParte.forEach((contenido, parte) => {
    const referencia = grupoParteRef(coleccion, parte);
    if (merge) escritor.set(referencia, { registros: contenido }, { merge: true });
    else escritor.set(referencia, { registros: contenido }, { mergeFields: Object.keys(contenido).map(clave => new FieldPath('registros', clave)) });
  });
  return porParte.size;
}

/** Elimina registros por ID (como `delete(doc)`). Devuelve el número de escrituras. */
export function eliminarRegistrosAgrupados(escritor, datosWorkspace, coleccion, ids) {
  const indice = exigirIndice(datosWorkspace, coleccion);
  const porParte = agruparPorParte(indice, clavesValidas(ids.map(id => [id, FieldValue.delete()])));
  porParte.forEach((contenido, parte) => escritor.set(grupoParteRef(coleccion, parte), { registros: contenido }, { merge: true }));
  return porParte.size;
}

// =============================================================================
// 🧩 ETAPA 2: COPIA DE LAS SUBCOLECCIONES A LAS PARTES
// - No borra las subcolecciones ni los campos antiguos (quedan como respaldo hasta la limpieza).
// - Combina igual que la carga completa: el documento de la subcolección prevalece sobre la copia legada.
// - `ejecutar: false` (por defecto) solo simula. Idempotente: una colección ya agrupada no se toca.
// - Todo ocurre en una transacción: la copia y el índice se escriben juntos o no se escribe nada.
// =============================================================================
const raizRef = () => adminDb.collection('workspace_compartido').doc('base_de_datos_grc');
const SUBCOLECCION_DE = { planes: 'planes_accion', hallazgos: 'hallazgos', informes: 'informes' };
// Tamaño objetivo por parte: ~30 % del límite de 1 MiB, para que pueda triplicarse sin repartirse.
export const BYTES_OBJETIVO_PARTE_GRUPO = 300_000;
// Firestore indexa cada campo anidado: se limita también el número de campos por parte.
export const CAMPOS_OBJETIVO_PARTE_GRUPO = 6_000;
const BYTES_MAXIMO_PARTE_GRUPO = 900_000;

const tamanoJson = valor => Buffer.byteLength(JSON.stringify(valor ?? null));
export const contarCampos = valor => {
  if (Array.isArray(valor)) return valor.reduce((total, item) => total + contarCampos(item), 0);
  if (valor && typeof valor === 'object') return Object.values(valor).reduce((total, item) => total + 1 + contarCampos(item), 0);
  return 0;
};

/** Reparte registros [[clave, datos]] en partes que respetan los objetivos de tamaño y campos. Puro. */
export function planificarPartes(pares) {
  const bytes = pares.reduce((total, [clave, datos]) => total + tamanoJson({ [clave]: datos }), 0);
  const campos = pares.reduce((total, [, datos]) => total + 1 + contarCampos(datos), 0);
  let partes = Math.max(1, Math.ceil(bytes / BYTES_OBJETIVO_PARTE_GRUPO), Math.ceil(campos / CAMPOS_OBJETIVO_PARTE_GRUPO));
  if (partes > MAX_PARTES_GRUPO) throw new Error(`Se necesitarían ${partes} partes (máximo ${MAX_PARTES_GRUPO}).`);
  const repartir = cantidad => {
    const contenido = Array.from({ length: cantidad }, () => ({}));
    pares.forEach(([clave, datos]) => { contenido[parteDeRegistro(clave, cantidad)][clave] = datos; });
    return contenido;
  };
  let contenido = repartir(partes);
  // El reparto por hash puede desequilibrarse: se agrega una parte mientras alguna supere el máximo.
  while (contenido.some(registros => tamanoJson({ registros }) > BYTES_MAXIMO_PARTE_GRUPO)) {
    partes += 1;
    if (partes > MAX_PARTES_GRUPO) throw new Error('Una parte superaría el tamaño seguro.');
    contenido = repartir(partes);
  }
  return {
    partes,
    contenido,
    resumen: contenido.map(registros => ({
      registros: Object.keys(registros).length,
      kb: Math.round(tamanoJson({ registros }) / 1024),
      campos: contarCampos({ registros }),
    })),
  };
}

const tieneClave = registro => Boolean(registro) && registro.id !== undefined && registro.id !== null && String(registro.id).trim() !== '';

export async function agruparColecciones({ ejecutar = false, usuario = '', colecciones = COLECCIONES_AGRUPABLES } = {}) {
  const solicitadas = COLECCIONES_AGRUPABLES.filter(coleccion => colecciones.includes(coleccion));
  if (solicitadas.length === 0) throw new Error('No se indicó ninguna colección válida (planes, hallazgos, informes).');

  return adminDb.runTransaction(async transaction => {
    const snapshotRaiz = await transaction.get(raizRef());
    const snapshotInformes = await transaction.get(adminDb.collection('workspace_compartido').doc('base_de_datos_grc_informes'));
    const datosRaiz = snapshotRaiz.exists ? snapshotRaiz.data() || {} : {};
    const informesSeparados = snapshotInformes.exists ? snapshotInformes.get('informesAuditoria') : null;
    const legados = {
      planes: [
        ...(Array.isArray(datosRaiz.planesAccion) ? datosRaiz.planesAccion : []),
        ...(Array.isArray(datosRaiz.planes) ? datosRaiz.planes : []),
      ],
      hallazgos: Array.isArray(datosRaiz.hallazgos) ? datosRaiz.hallazgos : [],
      informes: Array.isArray(informesSeparados) ? informesSeparados
        : (Array.isArray(datosRaiz.informesAuditoria) ? datosRaiz.informesAuditoria : []),
    };

    const reporte = { estado: ejecutar ? 'agrupado' : 'simulacion', colecciones: {} };
    const escrituras = [];
    for (const coleccion of solicitadas) {
      if (indiceAgrupado(datosRaiz, coleccion)) {
        const { partes, registros, migradoEn } = datosRaiz.coleccionesAgrupadas[coleccion];
        reporte.colecciones[coleccion] = { estado: 'ya-agrupada', partes, registros, migradoEn };
        continue;
      }
      const sinId = legados[coleccion].filter(registro => registro && !tieneClave(registro)).length;
      if (sinId > 0) {
        reporte.colecciones[coleccion] = { estado: 'bloqueada', motivo: `${sinId} registros legados sin ID no se pueden agrupar.` };
        continue;
      }
      const snapshot = await transaction.get(raizRef().collection(SUBCOLECCION_DE[coleccion]));
      const porClave = new Map();
      legados[coleccion].filter(tieneClave).forEach(registro => porClave.set(String(registro.id), registro));
      const idsDocumentos = new Set(snapshot.docs.map(documento => documento.id));
      const soloLegados = [...porClave.keys()].filter(clave => !idsDocumentos.has(clave)).length;
      snapshot.docs.forEach(documento => porClave.set(documento.id, documento.data()));
      const plan = planificarPartes([...porClave]);
      reporte.colecciones[coleccion] = {
        estado: ejecutar ? 'agrupada' : 'simulacion',
        documentosSubcoleccion: snapshot.size,
        legadosSinDocumento: soloLegados,
        registros: porClave.size,
        partes: plan.partes,
        detallePartes: plan.resumen,
      };
      escrituras.push({ coleccion, plan, registros: porClave.size });
    }

    if (!ejecutar) return reporte;
    if (escrituras.length === 0) return { ...reporte, estado: 'sin-cambios' };
    const migradoEn = new Date().toISOString();
    const indice = {};
    escrituras.forEach(({ coleccion, plan, registros }) => {
      plan.contenido.forEach((contenido, parte) => transaction.set(grupoParteRef(coleccion, parte), { registros: contenido }));
      indice[coleccion] = { version: 1, partes: plan.partes, registros, migradoEn, migradoPor: usuario };
    });
    transaction.set(raizRef(), { coleccionesAgrupadas: indice }, { merge: true });
    return reporte;
  });
}

// =============================================================================
// 🧹 ETAPA 4: LIMPIEZA DE LAS COPIAS ANTIGUAS
// Borra las subcolecciones (respaldo congelado desde la copia), los campos legados del documento
// principal y, con informes, el documento `base_de_datos_grc_informes`.
// - Solo actúa sobre colecciones agrupadas con todas sus partes presentes.
// - Cada registro antiguo debe existir en las partes. Si falta alguno (p. ej. se eliminó después de la
//   copia), no se borra nada de esa colección salvo que esos IDs se confirmen explícitamente.
// - `ejecutar: false` (por defecto) solo simula. Idempotente. Todo en una transacción.
// =============================================================================
const LEGADOS_PRINCIPAL = { planes: ['planes', 'planesAccion'], hallazgos: ['hallazgos'], informes: ['informesAuditoria'] };
const MAX_ESCRITURAS_LIMPIEZA = 450;

export async function limpiarColeccionesLegadas({ ejecutar = false, colecciones = COLECCIONES_AGRUPABLES, faltantesConfirmados = {}, usuario = '' } = {}) {
  const solicitadas = COLECCIONES_AGRUPABLES.filter(coleccion => colecciones.includes(coleccion));
  if (solicitadas.length === 0) throw new Error('No se indicó ninguna colección válida (planes, hallazgos, informes).');

  return adminDb.runTransaction(async transaction => {
    const snapshotRaiz = await transaction.get(raizRef());
    const datosRaiz = snapshotRaiz.exists ? snapshotRaiz.data() || {} : {};
    const refInformesLegados = adminDb.collection('workspace_compartido').doc('base_de_datos_grc_informes');
    const snapshotInformesLegados = solicitadas.includes('informes') && !informesLegadosEliminados(datosRaiz)
      ? await transaction.get(refInformesLegados) : null;
    const grupos = crearLectorGrupos(datosRaiz, transaction);

    const reporte = { estado: ejecutar ? 'limpiado' : 'simulacion', colecciones: {} };
    const limpiezas = [];
    for (const coleccion of solicitadas) {
      const indice = indiceAgrupado(datosRaiz, coleccion);
      if (!indice) {
        reporte.colecciones[coleccion] = { estado: 'no-agrupada', mensaje: 'Primero hay que agrupar la colección.' };
        continue;
      }
      if (indice.legadoEliminadoEn) {
        reporte.colecciones[coleccion] = { estado: 'ya-limpia', legadoEliminadoEn: indice.legadoEliminadoEn };
        continue;
      }
      const vigentes = await grupos.mapa(coleccion); // falla si falta una parte: no se borra nada
      const snapshot = await transaction.get(raizRef().collection(SUBCOLECCION_DE[coleccion]));
      const campos = LEGADOS_PRINCIPAL[coleccion].filter(campo => Array.isArray(datosRaiz[campo]));
      const legados = campos.flatMap(campo => datosRaiz[campo]);
      if (coleccion === 'informes' && Array.isArray(snapshotInformesLegados?.get('informesAuditoria'))) {
        legados.push(...snapshotInformesLegados.get('informesAuditoria'));
      }
      const faltantes = [...new Set([
        ...snapshot.docs.map(documento => documento.id),
        ...legados.map(registro => (tieneClave(registro) ? String(registro.id) : '(sin id)')),
      ])].filter(id => !vigentes.has(id));
      const confirmados = new Set((Array.isArray(faltantesConfirmados?.[coleccion]) ? faltantesConfirmados[coleccion] : []).map(String));
      const sinConfirmar = faltantes.filter(id => !confirmados.has(id));
      reporte.colecciones[coleccion] = {
        estado: sinConfirmar.length ? 'bloqueada' : (ejecutar ? 'limpia' : 'simulacion'),
        registrosVigentes: vigentes.size,
        documentosSubcoleccion: snapshot.size,
        camposLegados: campos,
        registrosLegados: legados.length,
        // Registros antiguos que ya no están en las partes (eliminados después de la copia, o un problema).
        faltantesEnPartes: faltantes,
        ...(sinConfirmar.length ? { mensaje: 'Hay registros antiguos que no están en las partes; revísalos y confírmalos para borrar.' } : {}),
      };
      if (!sinConfirmar.length) limpiezas.push({ coleccion, indice, snapshot, campos });
    }

    if (!ejecutar) return reporte;
    if (limpiezas.length === 0) return { ...reporte, estado: 'sin-cambios' };
    const escrituras = limpiezas.reduce((total, { snapshot }) => total + snapshot.size, 0) + limpiezas.length + 2;
    if (escrituras > MAX_ESCRITURAS_LIMPIEZA) throw new Error(`Son ${escrituras} escrituras: limpia una colección a la vez.`);

    const ahora = new Date().toISOString();
    const cambiosRaiz = { coleccionesAgrupadas: {} };
    limpiezas.forEach(({ coleccion, indice, snapshot, campos }) => {
      snapshot.docs.forEach(documento => transaction.delete(documento.ref));
      campos.forEach(campo => { cambiosRaiz[campo] = FieldValue.delete(); });
      if (coleccion === 'informes' && snapshotInformesLegados?.exists) transaction.delete(refInformesLegados);
      cambiosRaiz.coleccionesAgrupadas[coleccion] = { ...indice, legadoEliminadoEn: ahora, legadoEliminadoPor: usuario };
    });
    transaction.set(raizRef(), cambiosRaiz, { merge: true });
    return reporte;
  });
}
