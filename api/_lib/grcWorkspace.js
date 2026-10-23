import { FieldValue, Filter } from 'firebase-admin/firestore';
import { adminDb } from './firebaseAdmin.js';
import { logger } from './logger.js';
import { crearLectorGrupos, informeEnProcesos, nombreAgrupable } from './coleccionesAgrupadas.js';

// 📊 Cada documento devuelto por Firestore cuenta como una lectura facturable (incluye Admin SDK).
const registrarLecturas = (origen, documentos, inicio, transaccion = false) => {
  logger.info('[FS-READS]', { origen: origen || 'desconocido', documentos, ms: Date.now() - inicio, transaccion });
};

// Comparación estable (independiente del orden de las llaves) para detectar escrituras sin cambios.
const serializarEstable = valor => {
  if (Array.isArray(valor)) return `[${valor.map(serializarEstable).join(',')}]`;
  if (valor && typeof valor === 'object') {
    return `{${Object.keys(valor).sort().map(llave => `${JSON.stringify(llave)}:${serializarEstable(valor[llave])}`).join(',')}}`;
  }
  return JSON.stringify(valor ?? null);
};

// set(..., { merge: true }) no modifica nada si cada campo enviado ya es idéntico al guardado.
export const escrituraSinCambios = (nuevo, existente) => Boolean(existente) &&
  Object.keys(nuevo || {}).every(llave => (
    Object.hasOwn(existente, llave) && serializarEstable(nuevo[llave]) === serializarEstable(existente[llave])
  ));

const workspaceRef = () => adminDb.collection('workspace_compartido').doc('base_de_datos_grc');
const informesRef = () => adminDb.collection('workspace_compartido').doc('base_de_datos_grc_informes');

// SUBCOLECCIONES ESCALABLES
const coleccionInformesRef = () => adminDb.collection('workspace_compartido').doc('base_de_datos_grc').collection('informes');
const coleccionPlanesRef = () => adminDb.collection('workspace_compartido').doc('base_de_datos_grc').collection('planes_accion'); // NUEVO
const coleccionHallazgosRef = () => adminDb.collection('workspace_compartido').doc('base_de_datos_grc').collection('hallazgos');

// =============================================================================
// 🧩 MIGRACIÓN DE RIESGOS (fase 2: lectura doble)
// El campo `riesgos` ocupa ~74 % del documento principal (límite 1 MiB). La migración repartirá los
// riesgos en documentos `base_de_datos_grc_riesgos_N` y escribirá en el documento principal el índice
// `riesgosFragmentados: { version, partes, orden }`. Sin ese índice todo funciona exactamente como antes
// (cero lecturas adicionales).
// =============================================================================
const MAX_PARTES_RIESGOS = 10;
const riesgosParteRef = indice => adminDb.collection('workspace_compartido').doc(`base_de_datos_grc_riesgos_${indice}`);

const indiceRiesgosValido = indice => Boolean(indice) && typeof indice === 'object' &&
  Number.isInteger(indice.partes) && indice.partes >= 1 && indice.partes <= MAX_PARTES_RIESGOS;

async function leerRiesgosFragmentados(datosWorkspace, transaction = null) {
  const indice = datosWorkspace.riesgosFragmentados;
  if (!indiceRiesgosValido(indice)) return null;
  const referencias = Array.from({ length: indice.partes }, (_, parte) => riesgosParteRef(parte));
  const snapshots = await Promise.all(referencias.map(referencia => (
    transaction ? transaction.get(referencia) : referencia.get()
  )));
  if (snapshots.some(snapshot => !snapshot.exists)) {
    // Preferimos servir el campo original (aún presente hasta la limpieza) a mostrar una matriz incompleta.
    logger.error('[RIESGOS] Migración incompleta: falta una parte; se usa el campo original', null, { partes: indice.partes });
    return { riesgos: null, documentos: referencias.length };
  }
  const porId = new Map();
  const sinId = [];
  snapshots.forEach(snapshot => (snapshot.get('riesgos') || []).forEach(riesgo => {
    if (riesgo && riesgo.id !== undefined && riesgo.id !== null) porId.set(String(riesgo.id), riesgo);
    else if (riesgo) sinId.push(riesgo);
  }));
  // `orden` conserva el orden de la matriz (los riesgos nuevos se anteponen en el cliente).
  const orden = Array.isArray(indice.orden) ? indice.orden.map(String) : [];
  const enOrden = orden.filter(id => porId.has(id)).map(id => porId.get(id));
  const vistos = new Set(orden);
  const restantes = [...porId].filter(([id]) => !vistos.has(id)).map(([, riesgo]) => riesgo);
  return { riesgos: [...enOrden, ...restantes, ...sinId], documentos: referencias.length };
}

// =============================================================================
// 🧩 MIGRACIÓN DE RIESGOS (fases 3 y 4: copia y escrituras unificadas)
// Regla acordada: un riesgo solo se elimina con el botón Eliminar o con la importación de Excel
// (reemplazo total explícito y confirmado). Guardar una lista nunca borra los riesgos ausentes.
// =============================================================================
export const PARTES_RIESGOS = 4;
const LIMITE_BYTES_PARTE = 900_000; // margen bajo el límite de 1 MiB por documento
const tamanoBytes = valor => Buffer.byteLength(JSON.stringify(valor ?? null));
const tieneId = riesgo => Boolean(riesgo) && riesgo.id !== undefined && riesgo.id !== null && String(riesgo.id).trim() !== '';

// Asignación estable de cada riesgo a una parte según su ID.
export const parteDeRiesgo = (id, partes = PARTES_RIESGOS) => {
  let hash = 0;
  for (const caracter of String(id)) hash = (hash * 31 + caracter.charCodeAt(0)) >>> 0;
  return hash % partes;
};

const repartirRiesgos = (riesgos, partes) => {
  const contenido = Array.from({ length: partes }, () => []);
  riesgos.forEach(riesgo => contenido[tieneId(riesgo) ? parteDeRiesgo(riesgo.id, partes) : 0].push(riesgo));
  const tamanos = contenido.map(lista => tamanoBytes({ riesgos: lista }));
  const excedida = tamanos.findIndex(tamano => tamano > LIMITE_BYTES_PARTE);
  if (excedida !== -1) throw new Error(`La parte ${excedida} de riesgos superaría el tamaño seguro (${tamanos[excedida]} bytes).`);
  return { contenido, tamanos };
};

const escribirRiesgosTx = (transaction, riesgos, indiceAnterior, extrasIndice = {}) => {
  const partes = indiceAnterior.partes;
  const { contenido, tamanos } = repartirRiesgos(riesgos, partes);
  contenido.forEach((lista, parte) => transaction.set(riesgosParteRef(parte), { riesgos: lista }));
  transaction.set(workspaceRef(), {
    riesgosFragmentados: {
      ...indiceAnterior,
      ...extrasIndice,
      partes,
      orden: riesgos.filter(tieneId).map(riesgo => String(riesgo.id)),
      actualizadoEn: new Date().toISOString(),
    },
  }, { merge: true });
  return tamanos;
};

/** Lee (dentro de la transacción) el índice y la matriz completa. null si los riesgos no están migrados. */
async function leerMatrizRiesgosTx(transaction) {
  const snapshotWorkspace = await transaction.get(workspaceRef());
  const datosWorkspace = snapshotWorkspace.exists ? snapshotWorkspace.data() || {} : {};
  if (!indiceRiesgosValido(datosWorkspace.riesgosFragmentados)) return null;
  const lectura = await leerRiesgosFragmentados(datosWorkspace, transaction);
  if (!lectura?.riesgos) throw new Error('Migración de riesgos incompleta: falta una parte. No se guardan cambios.');
  return { indice: datosWorkspace.riesgosFragmentados, riesgos: lectura.riesgos };
}

/** ¿Están migrados los riesgos? (1 lectura del documento principal) */
export async function riesgosMigrados() {
  const snapshot = await workspaceRef().get();
  return indiceRiesgosValido(snapshot.exists ? snapshot.data()?.riesgosFragmentados : null);
}

/** Matriz vigente para el endpoint de riesgos (documento principal + partes, sin listar subcolecciones). */
export async function leerRiesgosVigentes() {
  const snapshot = await workspaceRef().get();
  const datosWorkspace = snapshot.exists ? snapshot.data() || {} : {};
  const lectura = await leerRiesgosFragmentados(datosWorkspace);
  return lectura?.riesgos || (Array.isArray(datosWorkspace.riesgos) ? datosWorkspace.riesgos : []);
}

/**
 * Guarda una lista de riesgos en las partes (fase 4).
 * - Actualiza o agrega cada riesgo recibido; el orden recibido define el orden de la matriz.
 * - Los riesgos ausentes se conservan, salvo `reemplazoTotal` (importación de Excel confirmada).
 */
export async function guardarListaRiesgosFragmentada(riesgosRecibidos, { reemplazoTotal = false } = {}) {
  return adminDb.runTransaction(async transaction => {
    const matriz = await leerMatrizRiesgosTx(transaction);
    if (!matriz) throw new Error('Los riesgos no están migrados.');
    const recibidos = (Array.isArray(riesgosRecibidos) ? riesgosRecibidos : []).filter(Boolean);
    const recibidosSinId = recibidos.filter(riesgo => !tieneId(riesgo));
    const vistos = new Set();
    const resultado = [];
    recibidos.filter(tieneId).forEach(riesgo => {
      const clave = String(riesgo.id);
      if (vistos.has(clave)) return;
      vistos.add(clave);
      resultado.push(riesgo);
    });
    const sinIdSerializados = new Set(recibidosSinId.map(serializarEstable));
    resultado.push(...recibidosSinId);
    if (!reemplazoTotal) {
      matriz.riesgos.forEach(riesgo => {
        if (tieneId(riesgo)) {
          if (!vistos.has(String(riesgo.id))) resultado.push(riesgo);
        } else if (!sinIdSerializados.has(serializarEstable(riesgo))) {
          resultado.push(riesgo);
        }
      });
    }
    escribirRiesgosTx(transaction, resultado, matriz.indice);
    logger.info('[RIESGOS] Lista guardada en partes', {
      total: resultado.length, anteriores: matriz.riesgos.length, reemplazoTotal,
    });
    return { total: resultado.length };
  });
}

/**
 * Guarda un riesgo individual (módulo Riesgos). `autorizar(existente)` aplica los permisos sobre la
 * versión guardada. El nuevo contenido se fusiona sobre la existente (igual que set con merge).
 */
export async function guardarRiesgoFragmentado(riesgo, { autorizar = () => true } = {}) {
  return adminDb.runTransaction(async transaction => {
    const matriz = await leerMatrizRiesgosTx(transaction);
    if (!matriz) throw new Error('Los riesgos no están migrados.');
    const posicion = matriz.riesgos.findIndex(item => tieneId(item) && String(item.id) === String(riesgo.id));
    const existente = posicion === -1 ? null : matriz.riesgos[posicion];
    if (existente && !autorizar(existente)) return { autorizado: false };
    const actualizado = { ...(existente || {}), ...riesgo };
    const riesgos = [...matriz.riesgos];
    if (posicion === -1) riesgos.push(actualizado);
    else riesgos[posicion] = actualizado;
    escribirRiesgosTx(transaction, riesgos, matriz.indice);
    return { autorizado: true, riesgo: actualizado };
  });
}

/** Elimina un riesgo de la matriz migrada. Devuelve 'not-found', false (sin permiso) o true. */
export async function eliminarRiesgoFragmentado(id, { autorizar = () => true } = {}) {
  return adminDb.runTransaction(async transaction => {
    const matriz = await leerMatrizRiesgosTx(transaction);
    if (!matriz) throw new Error('Los riesgos no están migrados.');
    const existente = matriz.riesgos.find(item => tieneId(item) && String(item.id) === String(id));
    if (!existente) return 'not-found';
    if (!autorizar(existente)) return false;
    escribirRiesgosTx(transaction, matriz.riesgos.filter(item => item !== existente), matriz.indice);
    return true;
  });
}

/**
 * Fase 3: copia los riesgos del documento principal a las partes.
 * - No borra el campo original ni la colección raíz `riesgos` (quedan como respaldo).
 * - Si un riesgo también existe en la colección raíz, se conserva la versión con historial más largo
 *   (decisión acordada: la del módulo Riesgos cuando es más reciente, p. ej. el riesgo 539).
 * - `ejecutar: false` (por defecto) solo simula y no escribe nada. Idempotente: si ya está migrado, no hace nada.
 */
export async function migrarRiesgos({ ejecutar = false, usuario = '' } = {}) {
  return adminDb.runTransaction(async transaction => {
    const snapshotWorkspace = await transaction.get(workspaceRef());
    const datosWorkspace = snapshotWorkspace.exists ? snapshotWorkspace.data() || {} : {};
    if (indiceRiesgosValido(datosWorkspace.riesgosFragmentados)) {
      const { orden: _orden, ...resumenIndice } = datosWorkspace.riesgosFragmentados;
      return { estado: 'ya-migrado', indice: resumenIndice };
    }
    const snapshotRaiz = await transaction.get(adminDb.collection('riesgos'));
    const originales = Array.isArray(datosWorkspace.riesgos) ? datosWorkspace.riesgos : [];
    const raiz = snapshotRaiz.docs.map(documento => ({ id: documento.id, ...documento.data() }));
    const raizPorId = new Map(raiz.filter(tieneId).map(riesgo => [String(riesgo.id), riesgo]));

    const decisiones = [];
    const usados = new Set();
    const riesgos = originales.map(riesgo => {
      if (!tieneId(riesgo)) return riesgo;
      const clave = String(riesgo.id);
      const version = raizPorId.get(clave);
      if (!version) return riesgo;
      usados.add(clave);
      const historialRaiz = (version.historialCambios || []).length;
      const historialDocumento = (riesgo.historialCambios || []).length;
      const usarRaiz = historialRaiz > historialDocumento;
      decisiones.push({ id: clave, conservada: usarRaiz ? 'coleccion-riesgos' : 'documento-principal', historialRaiz, historialDocumento });
      return usarRaiz ? { ...version, id: riesgo.id } : riesgo;
    });
    raiz.forEach(version => {
      if (tieneId(version) && !usados.has(String(version.id))) {
        riesgos.push(version);
        decisiones.push({ id: String(version.id), conservada: 'coleccion-riesgos', motivo: 'solo existía en la colección' });
      }
    });

    const { tamanos } = repartirRiesgos(riesgos, PARTES_RIESGOS); // valida tamaños también al simular
    const reporte = {
      estado: ejecutar ? 'migrado' : 'simulacion',
      riesgosDocumentoPrincipal: originales.length,
      riesgosColeccionRaiz: raiz.length,
      riesgosMigrados: riesgos.length,
      riesgosSinId: riesgos.filter(riesgo => !tieneId(riesgo)).length,
      decisiones,
      tamanoPartesKB: tamanos.map(tamano => Math.round(tamano / 1024)),
    };
    if (ejecutar) {
      escribirRiesgosTx(transaction, riesgos, { version: 1, partes: PARTES_RIESGOS }, {
        migradoEn: new Date().toISOString(), migradoPor: usuario,
      });
    }
    return reporte;
  });
}

/**
 * Fase 6: elimina las copias antiguas de los riesgos (campo `riesgos` del documento principal y
 * colección raíz `riesgos`) una vez migrados.
 * - Solo actúa si los riesgos están migrados y todas las partes existen.
 * - Verifica que cada riesgo de las copias antiguas exista en la matriz vigente. Si falta alguno
 *   (p. ej. se eliminó después de migrar), no borra nada salvo que esos IDs se confirmen explícitamente.
 * - `ejecutar: false` (por defecto) solo simula. Idempotente.
 */
export async function limpiarRiesgosLegados({ ejecutar = false, faltantesConfirmados = [], usuario = '' } = {}) {
  return adminDb.runTransaction(async transaction => {
    const snapshotWorkspace = await transaction.get(workspaceRef());
    const datosWorkspace = snapshotWorkspace.exists ? snapshotWorkspace.data() || {} : {};
    if (!indiceRiesgosValido(datosWorkspace.riesgosFragmentados)) {
      return { estado: 'no-migrado', mensaje: 'Primero hay que migrar los riesgos.' };
    }
    const vigente = await leerRiesgosFragmentados(datosWorkspace, transaction);
    if (!vigente?.riesgos) {
      return { estado: 'bloqueado', mensaje: 'Falta una parte de la matriz vigente: no se borra nada.' };
    }
    const snapshotRaiz = await transaction.get(adminDb.collection('riesgos'));
    const campoLegado = Array.isArray(datosWorkspace.riesgos) ? datosWorkspace.riesgos : null;
    if (!campoLegado && snapshotRaiz.docs.length === 0) return { estado: 'ya-limpio', riesgosVigentes: vigente.riesgos.length };

    const idsVigentes = new Set(vigente.riesgos.filter(tieneId).map(riesgo => String(riesgo.id)));
    const vigentesSinId = new Set(vigente.riesgos.filter(riesgo => !tieneId(riesgo)).map(serializarEstable));
    const faltantes = [];
    (campoLegado || []).forEach(riesgo => {
      if (tieneId(riesgo) ? !idsVigentes.has(String(riesgo.id)) : !vigentesSinId.has(serializarEstable(riesgo))) {
        faltantes.push(tieneId(riesgo) ? String(riesgo.id) : '(sin id)');
      }
    });
    snapshotRaiz.docs.forEach(documento => {
      const id = String(documento.data()?.id ?? documento.id);
      if (!idsVigentes.has(id) && !faltantes.includes(id)) faltantes.push(id);
    });

    const confirmados = new Set((Array.isArray(faltantesConfirmados) ? faltantesConfirmados : []).map(String));
    const faltantesSinConfirmar = faltantes.filter(id => !confirmados.has(id));
    const reporte = {
      estado: 'simulacion',
      riesgosVigentes: vigente.riesgos.length,
      riesgosEnCampoAntiguo: campoLegado ? campoLegado.length : 0,
      documentosColeccionAparte: snapshotRaiz.docs.length,
      faltantesEnMatrizVigente: faltantes,
      tamanoCampoAntiguoKB: campoLegado ? Math.round(tamanoBytes(campoLegado) / 1024) : 0,
    };
    if (faltantesSinConfirmar.length > 0) {
      return { ...reporte, estado: 'bloqueado', mensaje: 'Hay riesgos antiguos que no están en la matriz vigente; revísalos antes de limpiar.' };
    }
    if (!ejecutar) return reporte;

    if (campoLegado) {
      transaction.set(workspaceRef(), {
        riesgos: FieldValue.delete(),
        riesgosFragmentados: { ...datosWorkspace.riesgosFragmentados, legadoEliminadoEn: new Date().toISOString(), legadoEliminadoPor: usuario },
      }, { merge: true });
    }
    snapshotRaiz.docs.forEach(documento => transaction.delete(documento.ref));
    return { ...reporte, estado: 'limpiado' };
  });
}

const WORKSPACE_READ_CACHE_TTL_MS = 30_000;
// Con revisión del semáforo, los datos de esa revisión no cambian mientras siga vigente (cada escritura
// la incrementa y limpia esta caché): varios usuarios que recargan tras un cambio comparten una sola lectura.
const WORKSPACE_READ_CACHE_TTL_REVISION_MS = 10 * 60_000;
const WORKSPACE_READ_CACHE_MAX = 30;
const workspaceReadCache = new Map();
const workspaceReadInFlight = new Map();
let workspaceCacheGeneration = 0;

const leerInformesFragmentados = async (refColeccion, procesosAsignados) => {
  if (!Array.isArray(procesosAsignados) || procesosAsignados.length === 0) {
    const snapshot = await refColeccion.get();
    return { documentos: snapshot.size, informes: snapshot.docs.map(documento => ({ id: documento.id, ...documento.data() })) };
  }

  const procesos = [...new Set(procesosAsignados.map(proceso => String(proceso || '').trim()).filter(Boolean))];
  const chunks = [];
  for (let indice = 0; indice < procesos.length; indice += 10) {
    chunks.push(procesos.slice(indice, indice + 10));
  }

  const snapshots = await Promise.all(chunks.flatMap(chunk => ([
    refColeccion.where(Filter.or(
      Filter.where('macroproceso', 'in', chunk),
      Filter.where('proceso', 'in', chunk)
    )).get(),
    refColeccion.where('macroprocesos', 'array-contains-any', chunk).get(),
  ])));
  const informesPorId = new Map();
  snapshots.forEach(snapshot => snapshot.docs.forEach(documento => {
    informesPorId.set(documento.id, { id: documento.id, ...documento.data() });
  }));
  // Un informe que coincide con ambas consultas se cobra dos veces.
  return {
    documentos: snapshots.reduce((total, snapshot) => total + snapshot.size, 0),
    informes: [...informesPorId.values()],
  };
};

async function leerWorkspaceGrcDesdeFirestore(transaction = null, procesosAsignados = null, origen = '') {
  const inicio = Date.now();
  let documentosLeidos = 2;
  const refWorkspace = workspaceRef();
  const refInformes = informesRef();
  const refColeccionInformes = coleccionInformesRef();
  const refColeccionPlanes = coleccionPlanesRef();
  const refColeccionHallazgos = coleccionHallazgosRef();

  const [snapshotWorkspace, snapshotInformes] = transaction
    ? [await transaction.get(refWorkspace), await transaction.get(refInformes)]
    : await Promise.all([refWorkspace.get(), refInformes.get()]);
  const datosWorkspace = snapshotWorkspace.exists ? snapshotWorkspace.data() || {} : {};

  // Lectura híbrida: Legacy + Subcolecciones, o las partes agrupadas si la colección ya tiene índice.
  const grupos = crearLectorGrupos(datosWorkspace, transaction);
  const leerSubcoleccion = async referencia => {
    const snapshot = transaction ? await transaction.get(referencia) : await referencia.get();
    documentosLeidos += snapshot.size;
    return snapshot.docs.map(conId);
  };
  const leerInformes = async () => {
    if (transaction) return [];
    if (!grupos.agrupada('informes')) {
      const lecturaInformes = await leerInformesFragmentados(refColeccionInformes, procesosAsignados);
      documentosLeidos += lecturaInformes.documentos;
      return lecturaInformes.informes;
    }
    const informes = await grupos.todos('informes');
    if (!Array.isArray(procesosAsignados) || procesosAsignados.length === 0) return informes;
    const procesos = [...new Set(procesosAsignados.map(proceso => String(proceso || '').trim()).filter(Boolean))];
    return informes.filter(informe => informeEnProcesos(informe, procesos));
  };
  const [informesIndependientes, planesIndependientes, hallazgosIndependientes] = await Promise.all([
    leerInformes(),
    grupos.agrupada('planes') ? grupos.todos('planes') : leerSubcoleccion(refColeccionPlanes),
    grupos.agrupada('hallazgos') ? grupos.todos('hallazgos') : leerSubcoleccion(refColeccionHallazgos),
  ]);
  documentosLeidos += grupos.documentos;
  registrarLecturas(origen, documentosLeidos, inicio, Boolean(transaction));

  // Fase 2 de la migración de riesgos: solo lee las partes si el índice existe (si no, 0 lecturas extra).
  const riesgosFragmentados = await leerRiesgosFragmentados(datosWorkspace, transaction);
  if (riesgosFragmentados) {
    registrarLecturas(`${origen || 'desconocido'}:riesgos`, riesgosFragmentados.documentos, inicio, Boolean(transaction));
  }
  const { riesgosFragmentados: _indiceRiesgos, coleccionesAgrupadas: _indiceGrupos, ...datosPublicos } = datosWorkspace;
  const informesSeparados = snapshotInformes.exists
    ? snapshotInformes.get('informesAuditoria')
    : null;
    
  const informesLegados = Array.isArray(datosWorkspace.informesAuditoria) ? datosWorkspace.informesAuditoria : [];
  const planesLegados = [
    ...(Array.isArray(datosWorkspace.planesAccion) ? datosWorkspace.planesAccion : []),
    ...(Array.isArray(datosWorkspace.planes) ? datosWorkspace.planes : []),
  ];
  const hallazgosLegados = Array.isArray(datosWorkspace.hallazgos) ? datosWorkspace.hallazgos : [];

  const informesCombinados = [...(Array.isArray(informesSeparados) ? informesSeparados : informesLegados), ...informesIndependientes];
  const planesCombinados = [...planesLegados, ...planesIndependientes];

  // Deduplicación en memoria
  const mapaInformes = new Map();
  informesCombinados.forEach(inf => { if (inf && inf.id) mapaInformes.set(String(inf.id), inf); });
  
  const mapaPlanes = new Map();
  planesCombinados.forEach(plan => { if (plan && plan.id) mapaPlanes.set(String(plan.id), plan); });

  const mapaHallazgos = new Map();
  hallazgosLegados.forEach(hallazgo => { if (hallazgo && hallazgo.id) mapaHallazgos.set(String(hallazgo.id), hallazgo); });
  hallazgosIndependientes.forEach(hallazgo => { if (hallazgo && hallazgo.id) mapaHallazgos.set(String(hallazgo.id), hallazgo); });

  return {
    workspaceRef: refWorkspace,
    informesRef: refInformes,
    coleccionInformesRef: refColeccionInformes,
    coleccionPlanesRef: refColeccionPlanes,
    coleccionHallazgosRef: refColeccionHallazgos,
    workspaceExists: snapshotWorkspace.exists || snapshotInformes.exists || hallazgosIndependientes.length > 0 || planesIndependientes.length > 0,
    tieneInformesLegados: Array.isArray(datosWorkspace.informesAuditoria),
    tienePlanesLegados: Array.isArray(datosWorkspace.planesAccion),
    data: {
      ...datosPublicos,
      ...(riesgosFragmentados?.riesgos ? { riesgos: riesgosFragmentados.riesgos } : {}),
      hallazgos: [
        ...hallazgosLegados.filter(hallazgo => !hallazgo?.id),
        ...mapaHallazgos.values(),
      ],
      informesAuditoria: Array.from(mapaInformes.values()),
      planes: Array.from(mapaPlanes.values()),
      planesAccion: Array.from(mapaPlanes.values()),
    },
  };
}

export function invalidarCacheWorkspaceGrc() {
  workspaceCacheGeneration += 1;
  workspaceReadCache.clear();
  workspaceReadInFlight.clear();
}

export async function leerWorkspaceGrc(transaction = null, { usarCache = false, procesosAsignados = null, revision = '', origen = '' } = {}) {
  if (transaction || !usarCache) return leerWorkspaceGrcDesdeFirestore(transaction, procesosAsignados, origen);

  const scopeKey = Array.isArray(procesosAsignados) && procesosAsignados.length
    ? [...new Set(procesosAsignados.map(proceso => String(proceso || '').trim()).filter(Boolean))].sort().join('|')
    : '*';
  const cacheKey = JSON.stringify([String(revision).slice(0, 100), scopeKey]);
  const generation = workspaceCacheGeneration;
  const cacheEntry = workspaceReadCache.get(cacheKey);
  if (cacheEntry && cacheEntry.expiraEn > Date.now()) return cacheEntry.valor;
  if (workspaceReadInFlight.has(cacheKey)) return workspaceReadInFlight.get(cacheKey);

  const lectura = leerWorkspaceGrcDesdeFirestore(null, procesosAsignados, origen)
    .then(valor => {
      if (generation !== workspaceCacheGeneration) return valor;
      if (workspaceReadCache.size >= WORKSPACE_READ_CACHE_MAX && !workspaceReadCache.has(cacheKey)) {
        const cacheMasAntigua = workspaceReadCache.keys().next().value;
        if (cacheMasAntigua) workspaceReadCache.delete(cacheMasAntigua);
      }
      const ttl = revision ? WORKSPACE_READ_CACHE_TTL_REVISION_MS : WORKSPACE_READ_CACHE_TTL_MS;
      workspaceReadCache.set(cacheKey, { valor, expiraEn: Date.now() + ttl });
      return valor;
    })
    .finally(() => {
      if (workspaceReadInFlight.get(cacheKey) === lectura) workspaceReadInFlight.delete(cacheKey);
    });

  workspaceReadInFlight.set(cacheKey, lectura);
  return lectura;
}

// Etapa 1 de la agrupación: las escrituras sobre partes llegan en la etapa 3. Hasta entonces, escribir en
// la subcolección de una colección agrupada dejaría el cambio invisible: se bloquea en vez de perderlo.
const exigirSinAgrupar = (workspace, coleccion) => {
  if (workspace?.grupos?.agrupada(coleccion)) {
    throw new Error(`La colección ${coleccion} está agrupada y aún no admite escrituras.`);
  }
};

export function guardarInformesGrc(transaction, workspace, informesAuditoria) {
  exigirSinAgrupar(workspace, 'informes');
  if (Array.isArray(informesAuditoria)) {
    informesAuditoria.forEach(informe => {
      if (informe && informe.id) {
        const docRef = workspace.coleccionInformesRef.doc(String(informe.id));
        transaction.set(docRef, informe, { merge: true });
      }
    });
  }

  transaction.set(workspace.informesRef, { informesAuditoria: FieldValue.delete() }, { merge: true });
  if (workspace.tieneInformesLegados) {
    transaction.set(workspace.workspaceRef, { informesAuditoria: FieldValue.delete() }, { merge: true });
  }
}

export function guardarPlanesGrc(transaction, workspace, planes) {
  exigirSinAgrupar(workspace, 'planes');
  planes.forEach(plan => {
    transaction.set(workspace.coleccionPlanesRef.doc(String(plan.id)), plan);
  });
}

// =============================================================================
// 📉 LECTURAS PUNTUALES PARA TRANSACCIONES
// leerWorkspaceGrc(transaction) descarga planes_accion y hallazgos completos (~116 lecturas).
// Estas funciones leen solo los documentos que cada transacción usa, conservando la misma
// precedencia que la lectura completa: el documento de la subcolección prevalece sobre el legado.
// =============================================================================

// Los IDs relacionales pueden estar guardados como texto o como número: se consultan ambas formas.
const variantesId = valor => {
  const texto = String(valor ?? '').trim();
  if (!texto) return [];
  const numero = Number(texto);
  return /^\d+$/.test(texto) && Number.isSafeInteger(numero) ? [texto, numero] : [texto];
};
const idDocumentoValido = valor => {
  const texto = String(valor ?? '').trim();
  return texto && !texto.includes('/') ? texto : '';
};
const conId = documento => ({ id: documento.id, ...documento.data() });

/** Documento principal + informes legados (2 lecturas), sin listar subcolecciones. */
export async function leerWorkspaceGrcLigero(transaction, { origen = '' } = {}) {
  const inicio = Date.now();
  const refWorkspace = workspaceRef();
  const refInformes = informesRef();
  const snapshotWorkspace = await transaction.get(refWorkspace);
  const snapshotInformes = await transaction.get(refInformes);
  registrarLecturas(origen, 2, inicio, true);

  const datosWorkspace = snapshotWorkspace.exists ? snapshotWorkspace.data() || {} : {};
  const informesSeparados = snapshotInformes.exists ? snapshotInformes.get('informesAuditoria') : null;
  const informesLegados = Array.isArray(datosWorkspace.informesAuditoria) ? datosWorkspace.informesAuditoria : [];
  const planesLegados = new Map();
  [
    ...(Array.isArray(datosWorkspace.planesAccion) ? datosWorkspace.planesAccion : []),
    ...(Array.isArray(datosWorkspace.planes) ? datosWorkspace.planes : []),
  ].forEach(plan => { if (plan && plan.id) planesLegados.set(String(plan.id), plan); });

  return {
    workspaceRef: refWorkspace,
    informesRef: refInformes,
    coleccionInformesRef: coleccionInformesRef(),
    coleccionPlanesRef: coleccionPlanesRef(),
    coleccionHallazgosRef: coleccionHallazgosRef(),
    workspaceExists: snapshotWorkspace.exists || snapshotInformes.exists,
    tieneInformesLegados: Array.isArray(datosWorkspace.informesAuditoria),
    tienePlanesLegados: Array.isArray(datosWorkspace.planesAccion),
    origen,
    // Partes agrupadas leídas en esta transacción (cada parte se cobra una sola vez).
    grupos: crearLectorGrupos(datosWorkspace, transaction),
    data: {
      ...datosWorkspace,
      informesAuditoria: Array.isArray(informesSeparados) ? informesSeparados : informesLegados,
      planes: [...planesLegados.values()],
      planesAccion: [...planesLegados.values()],
      hallazgos: Array.isArray(datosWorkspace.hallazgos) ? datosWorkspace.hallazgos : [],
    },
  };
}

// Lector con contador de documentos para registrar el costo real de cada transacción.
const crearLectorTx = (transaction, workspace) => {
  let documentos = 0;
  const grupos = workspace.grupos || null;
  const documentosGruposAlInicio = grupos?.documentos || 0;
  const agrupada = coleccionRef => {
    const nombre = nombreAgrupable(coleccionRef);
    return nombre && grupos?.agrupada(nombre) ? nombre : null;
  };
  // Documento por ID (subcolección o parte agrupada); null si no existe.
  const leerPorId = async (coleccionRef, id) => {
    const nombre = agrupada(coleccionRef);
    if (nombre) return grupos.porId(nombre, id);
    const clave = idDocumentoValido(id);
    if (!clave) return undefined;
    const snapshot = await transaction.get(coleccionRef.doc(clave));
    documentos += 1;
    return snapshot.exists ? conId(snapshot) : null;
  };
  const lector = {
    get documentos() { return documentos + (grupos ? grupos.documentos - documentosGruposAlInicio : 0); },
    // Documento por ID; si no existe en la subcolección se usa la copia legada (misma precedencia).
    porId: async (coleccionRef, legados, id) => {
      const actual = await leerPorId(coleccionRef, id);
      if (actual) return actual;
      return (legados || []).find(registro => String(registro?.id) === String(id)) || null;
    },
    consultar: async consulta => {
      const snapshot = await transaction.get(consulta);
      documentos += snapshot.size ?? snapshot.docs.length;
      return snapshot.docs.map(conId);
    },
    // Registros cuyo `campo` es igual a alguno de los valores (consultas `in` de hasta 30 valores).
    filtrar: async (coleccionRef, campo, valores) => {
      const nombre = agrupada(coleccionRef);
      if (nombre) return (await grupos.todos(nombre)).filter(registro => valores.includes(registro[campo]));
      const resultado = [];
      for (let indice = 0; indice < valores.length; indice += 30) {
        resultado.push(...await lector.consultar(coleccionRef.where(campo, 'in', valores.slice(indice, indice + 30))));
      }
      return resultado;
    },
    // Un registro legado solo cuenta si no existe su versión en la subcolección.
    completarLegados: async (mapa, legados, coleccionRef, pertenece) => {
      for (const legado of legados || []) {
        const clave = String(legado?.id ?? '');
        if (!clave || mapa.has(clave) || !pertenece(legado)) continue;
        const actual = await leerPorId(coleccionRef, clave);
        if (actual) {
          if (pertenece(actual)) mapa.set(clave, actual);
        } else {
          mapa.set(clave, legado);
        }
      }
    },
    // Planes cuyo idHallazgo está en la lista.
    planesDeHallazgos: async (idsHallazgos, mapa = new Map()) => {
      const variantes = [...new Set([...idsHallazgos].map(String))].flatMap(variantesId);
      (await lector.filtrar(workspace.coleccionPlanesRef, 'idHallazgo', variantes))
        .forEach(plan => mapa.set(String(plan.id), plan));
      return mapa;
    },
  };
  return lector;
};

/** Un hallazgo por ID (1 lectura). */
export async function obtenerHallazgoTx(transaction, workspace, id) {
  const inicio = Date.now();
  const lector = crearLectorTx(transaction, workspace);
  const hallazgo = await lector.porId(workspace.coleccionHallazgosRef, workspace.data.hallazgos, id);
  registrarLecturas(`${workspace.origen}:hallazgo`, lector.documentos, inicio, true);
  return hallazgo;
}

/** Planes por ID, en el mismo orden solicitado (null si no existe). */
export async function obtenerPlanesTx(transaction, workspace, ids) {
  const inicio = Date.now();
  const lector = crearLectorTx(transaction, workspace);
  const planes = await Promise.all((ids || []).map(id => lector.porId(workspace.coleccionPlanesRef, workspace.data.planes, id)));
  registrarLecturas(`${workspace.origen}:planes`, lector.documentos, inicio, true);
  return planes;
}

/** Hallazgos por ID como Map(String(id) → hallazgo); los ausentes no se incluyen. */
export async function obtenerHallazgosTx(transaction, workspace, ids) {
  const inicio = Date.now();
  const lector = crearLectorTx(transaction, workspace);
  const claves = [...new Set((ids || [])
    .filter(id => id !== undefined && id !== null)
    .map(id => String(id).trim())
    .filter(Boolean))];
  const encontrados = await Promise.all(claves.map(id => lector.porId(workspace.coleccionHallazgosRef, workspace.data.hallazgos, id)));
  registrarLecturas(`${workspace.origen}:hallazgos`, lector.documentos, inicio, true);
  return new Map(claves.flatMap((id, indice) => (encontrados[indice] ? [[id, encontrados[indice]]] : [])));
}

/** Todos los planes vinculados a alguno de los hallazgos indicados (incluye legados). */
export async function obtenerPlanesDeHallazgosTx(transaction, workspace, idsHallazgos) {
  const inicio = Date.now();
  const lector = crearLectorTx(transaction, workspace);
  const ids = new Set([...(idsHallazgos || [])].map(String));
  const planes = await lector.planesDeHallazgos(ids);
  const pertenece = plan => ids.has(String(plan?.idHallazgo));
  await lector.completarLegados(planes, workspace.data.planes, workspace.coleccionPlanesRef, pertenece);
  registrarLecturas(`${workspace.origen}:planes-hallazgos`, lector.documentos, inicio, true);
  return [...planes.values()].filter(pertenece);
}

/**
 * Reserva IDs numéricos para planes nuevos sin leer la colección completa.
 * Los IDs existentes siguen el formato Date.now(): se parte de la hora actual y se verifica que el
 * documento no exista (ni como legado). Si otra transacción concurrente reserva el mismo ID,
 * Firestore reintenta esta transacción y la verificación avanza al siguiente número.
 */
export async function reservarIdsPlanesTx(transaction, workspace, cantidad) {
  const inicio = Date.now();
  const legados = new Set((workspace.data.planes || []).map(plan => String(plan?.id)));
  const maximoLegado = (workspace.data.planes || []).reduce((maximo, plan) => Math.max(maximo, Number(plan?.id) || 0), 0);
  const ids = [];
  let candidato = Math.max(Date.now(), maximoLegado + 1);
  let documentos = 0;
  // Con planes agrupados, las partes ya traen todos los IDs: no hace falta consultar cada candidato.
  const lecturasGrupos = workspace.grupos?.documentos || 0;
  const agrupados = workspace.grupos?.agrupada('planes') ? await workspace.grupos.todos('planes') : null;
  if (agrupados) {
    agrupados.forEach(plan => legados.add(String(plan.id)));
    documentos += workspace.grupos.documentos - lecturasGrupos;
  }
  for (let intentos = 0; ids.length < cantidad; intentos += 1) {
    if (intentos > cantidad + 100) throw new Error('No se pudo reservar un ID libre para el plan de acción.');
    let existe = legados.has(String(candidato));
    if (!agrupados && !existe) {
      existe = (await transaction.get(workspace.coleccionPlanesRef.doc(String(candidato)))).exists;
      documentos += 1;
    }
    if (!existe) ids.push(candidato);
    candidato += 1;
  }
  registrarLecturas(`${workspace.origen}:reservar-ids`, documentos, inicio, true);
  return ids;
}

/** Hallazgos legados + subcolección (sin planes): solo para calcular el consecutivo HAL-AAAA-NNN. */
export async function listarHallazgosTx(transaction, workspace) {
  const inicio = Date.now();
  const lector = crearLectorTx(transaction, workspace);
  const actuales = workspace.grupos?.agrupada('hallazgos')
    ? await workspace.grupos.todos('hallazgos')
    : await lector.consultar(workspace.coleccionHallazgosRef);
  registrarLecturas(`${workspace.origen}:hallazgos`, lector.documentos, inicio, true);
  const mapa = new Map();
  (workspace.data.hallazgos || []).forEach(hallazgo => { if (hallazgo?.id) mapa.set(String(hallazgo.id), hallazgo); });
  actuales.forEach(hallazgo => mapa.set(String(hallazgo.id), hallazgo));
  return [...(workspace.data.hallazgos || []).filter(hallazgo => !hallazgo?.id), ...mapa.values()];
}

/**
 * Hallazgos y planes que pertenecen a un informe: planes con ese idInforme o cuyo hallazgo
 * pertenece al informe (los planes antiguos no siempre guardan idInforme).
 * Devuelve un superconjunto seguro: cada transacción aplica después su propio criterio exacto.
 */
export async function obtenerPlanesDeInformeTx(transaction, workspace, idInforme) {
  const variantesInforme = variantesId(idInforme);
  if (!variantesInforme.length) return { planes: [], hallazgos: [] };
  const inicio = Date.now();
  const lector = crearLectorTx(transaction, workspace);

  const delInforme = registro => String(registro?.idInforme) === String(idInforme);
  const hallazgos = new Map();
  (await lector.filtrar(workspace.coleccionHallazgosRef, 'idInforme', variantesInforme))
    .forEach(hallazgo => hallazgos.set(String(hallazgo.id), hallazgo));
  await lector.completarLegados(hallazgos, workspace.data.hallazgos, workspace.coleccionHallazgosRef, delInforme);
  const hallazgosInforme = [...hallazgos.values()].filter(delInforme);
  const idsHallazgos = new Set(hallazgosInforme.map(hallazgo => String(hallazgo.id)));

  const planes = new Map();
  (await lector.filtrar(workspace.coleccionPlanesRef, 'idInforme', variantesInforme))
    .forEach(plan => planes.set(String(plan.id), plan));
  await lector.planesDeHallazgos(idsHallazgos, planes);
  const delInformeOHallazgo = plan => delInforme(plan) || idsHallazgos.has(String(plan?.idHallazgo));
  await lector.completarLegados(planes, workspace.data.planes, workspace.coleccionPlanesRef, delInformeOHallazgo);

  registrarLecturas(`${workspace.origen}:planes-informe`, lector.documentos, inicio, true);
  return { planes: [...planes.values()].filter(delInformeOHallazgo), hallazgos: hallazgosInforme };
}

export async function guardarWorkspaceParcial(partialData) {
  const inicio = Date.now();
  const refWorkspace = workspaceRef();
  const refInformes = informesRef();
  const refColeccionInformes = coleccionInformesRef();
  const refColeccionPlanes = coleccionPlanesRef();
  const refColeccionHallazgos = coleccionHallazgosRef();
  
  const [snapshotWorkspace, snapshotInformes] = await Promise.all([
    refWorkspace.get(),
    refInformes.get(),
  ]);
  
  const datosWorkspace = snapshotWorkspace.exists ? snapshotWorkspace.data() || {} : {};

  // 🧩 Migración de riesgos: el índice solo lo administra el servidor.
  if (Object.hasOwn(partialData, 'riesgosFragmentados')) {
    throw new Error('El índice de riesgos solo lo administra la migración.');
  }
  if (Object.hasOwn(partialData, 'coleccionesAgrupadas')) {
    throw new Error('El índice de colecciones agrupadas solo lo administra la migración.');
  }
  const workspaceAgrupado = { grupos: crearLectorGrupos(datosWorkspace) };
  if (Object.hasOwn(partialData, 'informesAuditoria') || Object.hasOwn(partialData, 'informesEliminados')) exigirSinAgrupar(workspaceAgrupado, 'informes');
  if (['planes', 'planesAccion', 'planesEliminados'].some(campo => Object.hasOwn(partialData, campo))) exigirSinAgrupar(workspaceAgrupado, 'planes');
  if (Object.hasOwn(partialData, 'hallazgos')) exigirSinAgrupar(workspaceAgrupado, 'hallazgos');
  // Fase 4: con riesgos migrados, la lista se guarda en sus partes (nunca en el campo original, que ya
  // no se lee). Se hace primero para que, si falla, no se guarde el resto a medias.
  const riesgosEnPartes = indiceRiesgosValido(datosWorkspace.riesgosFragmentados);
  if (riesgosEnPartes && Array.isArray(partialData.riesgos)) {
    await guardarListaRiesgosFragmentada(partialData.riesgos, { reemplazoTotal: partialData.riesgosReemplazoTotal === true });
  } else if (riesgosEnPartes && Object.hasOwn(partialData, 'riesgos')) {
    throw new Error('La lista de riesgos enviada no es válida.');
  }

  // Procesamiento Informes
  const informesLegados = Array.isArray(datosWorkspace.informesAuditoria) ? datosWorkspace.informesAuditoria : null;
  const incluyeInformes = Object.hasOwn(partialData, 'informesAuditoria') && Array.isArray(partialData.informesAuditoria);
  const informesActualizados = incluyeInformes ? partialData.informesAuditoria : (informesLegados && !snapshotInformes.exists ? informesLegados : null);
  const informesEliminados = [...new Set((Array.isArray(partialData.informesEliminados) ? partialData.informesEliminados : []).map(id => String(id || '').trim()).filter(Boolean))];

  // Procesamiento Planes de Acción
  const incluyePlanes = Array.isArray(partialData.planes) || Array.isArray(partialData.planesAccion);
  const planesActualizados = incluyePlanes ? (partialData.planes || partialData.planesAccion) : null;
  const planesEliminados = [...new Set((Array.isArray(partialData.planesEliminados) ? partialData.planesEliminados : []).map(id => String(id || '').trim()).filter(Boolean))];

  const incluyeHallazgos = Object.hasOwn(partialData, 'hallazgos') && Array.isArray(partialData.hallazgos);
  const snapshotHallazgos = incluyeHallazgos ? await refColeccionHallazgos.get() : null;
  const snapshotPlanes = incluyePlanes ? await refColeccionPlanes.get() : null;
  registrarLecturas('sync-post-guardar', 2 + (snapshotHallazgos?.size || 0) + (snapshotPlanes?.size || 0), inicio);
  const planesGuardados = new Map((snapshotPlanes?.docs || []).map(documento => [documento.id, documento.data()]));
  const hallazgosGuardados = new Map((snapshotHallazgos?.docs || []).map(documento => [documento.id, documento.data()]));
  let escriturasOmitidas = 0;
  const hallazgosActualizados = incluyeHallazgos ? partialData.hallazgos : null;
    
  const datosRestantes = { ...partialData };
  delete datosRestantes.informesAuditoria;
  delete datosRestantes.informesEliminados;
  delete datosRestantes.planesAccion; // Aseguramos que NO se guarde en el documento padre
  delete datosRestantes.planes;
  delete datosRestantes.planesEliminados;
  delete datosRestantes.hallazgos;
  // La marca de la importación de Excel nunca se persiste; con riesgos migrados, la lista ya se guardó en partes.
  delete datosRestantes.riesgosReemplazoTotal;
  if (riesgosEnPartes) delete datosRestantes.riesgos;

  const operaciones = [];

  // Encolar operaciones de informes
  if (informesActualizados || incluyeInformes) {
    const listaInformes = Array.isArray(informesActualizados) ? informesActualizados : [];
    const idsEliminados = new Set(informesEliminados);
    listaInformes.forEach(informe => {
      if (informe && informe.id && !idsEliminados.has(String(informe.id))) {
        operaciones.push({ tipo: 'guardar', referencia: refColeccionInformes.doc(String(informe.id)), data: informe });
      }
    });
    informesEliminados.forEach(id => operaciones.push({ tipo: 'eliminar', referencia: refColeccionInformes.doc(id) }));
  }

  // Encolar operaciones de planes de acción
  if (planesActualizados || incluyePlanes) {
    const listaPlanes = Array.isArray(planesActualizados) ? planesActualizados : [];
    const idsEliminados = new Set(planesEliminados);
    listaPlanes.forEach(plan => {
      if (plan && plan.id && !idsEliminados.has(String(plan.id))) {
        if (escrituraSinCambios(plan, planesGuardados.get(String(plan.id)))) {
          escriturasOmitidas += 1;
          return;
        }
        operaciones.push({ tipo: 'guardar', referencia: refColeccionPlanes.doc(String(plan.id)), data: plan });
      }
    });
    planesEliminados.forEach(id => operaciones.push({ tipo: 'eliminar', referencia: refColeccionPlanes.doc(id) }));
    if (incluyePlanes) {
      const idsConservados = new Set(listaPlanes.map(plan => String(plan.id)));
      snapshotPlanes.docs.forEach(documento => {
        if (!idsConservados.has(documento.id) && !idsEliminados.has(documento.id)) {
          operaciones.push({ tipo: 'eliminar', referencia: documento.ref });
        }
      });
    }
  }

  if (incluyeHallazgos) {
    const idsHallazgos = new Set();
    hallazgosActualizados.forEach(hallazgo => {
      if (!hallazgo || hallazgo.id === undefined || hallazgo.id === null) return;
      const id = String(hallazgo.id);
      idsHallazgos.add(id);
      if (escrituraSinCambios(hallazgo, hallazgosGuardados.get(id))) {
        escriturasOmitidas += 1;
        return;
      }
      operaciones.push({ tipo: 'guardar', referencia: refColeccionHallazgos.doc(id), data: hallazgo });
    });
    snapshotHallazgos.docs.forEach(documento => {
      if (!idsHallazgos.has(documento.id)) {
        operaciones.push({ tipo: 'eliminar', referencia: documento.ref });
      }
    });
  }

  if (escriturasOmitidas > 0) logger.info('[FS-WRITES] Escrituras sin cambios omitidas', { escriturasOmitidas });

  // Ejecución en lotes seguros (Batches de 400 operaciones máximo)
  const chunkSize = 400;
  if (operaciones.length > 0) {
    for (let i = 0; i < operaciones.length; i += chunkSize) {
      const chunk = operaciones.slice(i, i + chunkSize);
      const batch = adminDb.batch();
      
      chunk.forEach(operacion => {
        if (operacion.tipo === 'guardar') {
          batch.set(operacion.referencia, operacion.data, { merge: true });
        } else {
          batch.delete(operacion.referencia);
        }
      });

      // Limpiar datos legados en el documento monolítico
      if (i + chunkSize >= operaciones.length) {
        batch.set(refInformes, { informesAuditoria: FieldValue.delete() }, { merge: true });
        if (Array.isArray(datosWorkspace.informesAuditoria)) datosRestantes.informesAuditoria = FieldValue.delete();
        if (incluyePlanes && Array.isArray(datosWorkspace.planesAccion)) datosRestantes.planesAccion = FieldValue.delete();
        if (incluyePlanes && Array.isArray(datosWorkspace.planes)) datosRestantes.planes = FieldValue.delete();
        if (Array.isArray(datosWorkspace.hallazgos) && incluyeHallazgos) datosRestantes.hallazgos = FieldValue.delete();
        batch.set(refWorkspace, datosRestantes, { merge: true });
      }
      
      await batch.commit();
    }
  } else {
    // Si no hay actualizaciones de listas, solo persistimos los metadatos y limpiamos la basura
    const batch = adminDb.batch();
    batch.set(refInformes, { informesAuditoria: FieldValue.delete() }, { merge: true });
    if (Array.isArray(datosWorkspace.informesAuditoria)) datosRestantes.informesAuditoria = FieldValue.delete();
    if (incluyePlanes && Array.isArray(datosWorkspace.planesAccion)) datosRestantes.planesAccion = FieldValue.delete();
    if (incluyePlanes && Array.isArray(datosWorkspace.planes)) datosRestantes.planes = FieldValue.delete();
    if (Array.isArray(datosWorkspace.hallazgos) && incluyeHallazgos) datosRestantes.hallazgos = FieldValue.delete();
    batch.set(refWorkspace, datosRestantes, { merge: true });
    await batch.commit();
  }
}