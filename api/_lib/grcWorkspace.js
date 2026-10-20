import { FieldValue, Filter } from 'firebase-admin/firestore';
import { adminDb } from './firebaseAdmin.js';

const workspaceRef = () => adminDb.collection('workspace_compartido').doc('base_de_datos_grc');
const informesRef = () => adminDb.collection('workspace_compartido').doc('base_de_datos_grc_informes');

// SUBCOLECCIONES ESCALABLES
const coleccionInformesRef = () => adminDb.collection('workspace_compartido').doc('base_de_datos_grc').collection('informes');
const coleccionPlanesRef = () => adminDb.collection('workspace_compartido').doc('base_de_datos_grc').collection('planes_accion'); // NUEVO
const coleccionHallazgosRef = () => adminDb.collection('workspace_compartido').doc('base_de_datos_grc').collection('hallazgos');

const WORKSPACE_READ_CACHE_TTL_MS = 30_000;
const workspaceReadCache = new Map();
const workspaceReadInFlight = new Map();
let workspaceCacheGeneration = 0;

const leerInformesFragmentados = async (refColeccion, procesosAsignados) => {
  if (!Array.isArray(procesosAsignados) || procesosAsignados.length === 0) {
    const snapshot = await refColeccion.get();
    return snapshot.docs.map(documento => ({ id: documento.id, ...documento.data() }));
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
  return [...informesPorId.values()];
};

// NUEVO: Función para leer planes desde la subcolección
const leerPlanesFragmentados = async (refColeccion) => {
  const snapshot = await refColeccion.get();
  return snapshot.docs.map(documento => ({ id: documento.id, ...documento.data() }));
};

async function leerWorkspaceGrcDesdeFirestore(transaction = null, procesosAsignados = null) {
  const refWorkspace = workspaceRef();
  const refInformes = informesRef();
  const refColeccionInformes = coleccionInformesRef();
  const refColeccionPlanes = coleccionPlanesRef();
  const refColeccionHallazgos = coleccionHallazgosRef();

  const snapshotWorkspace = transaction
    ? await transaction.get(refWorkspace)
    : await refWorkspace.get();

  const snapshotInformes = transaction
    ? await transaction.get(refInformes)
    : await refInformes.get();

  // Lectura híbrida: Legacy + Subcolecciones
  let informesIndependientes = [];
  let planesIndependientes;
  let hallazgosIndependientes;
  if (transaction) {
    const snapshotPlanes = await transaction.get(refColeccionPlanes);
    planesIndependientes = snapshotPlanes.docs.map(documento => ({ id: documento.id, ...documento.data() }));
    const snapshotHallazgos = await transaction.get(refColeccionHallazgos);
    hallazgosIndependientes = snapshotHallazgos.docs.map(documento => ({ id: documento.id, ...documento.data() }));
  } else {
    informesIndependientes = await leerInformesFragmentados(refColeccionInformes, procesosAsignados);
    planesIndependientes = await leerPlanesFragmentados(refColeccionPlanes);
    const snapshotHallazgos = await refColeccionHallazgos.get();
    hallazgosIndependientes = snapshotHallazgos.docs.map(documento => ({ id: documento.id, ...documento.data() }));
  }

  const datosWorkspace = snapshotWorkspace.exists ? snapshotWorkspace.data() || {} : {};
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
      ...datosWorkspace,
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

export async function leerWorkspaceGrc(transaction = null, { usarCache = false, procesosAsignados = null, revision = '' } = {}) {
  if (transaction || !usarCache) return leerWorkspaceGrcDesdeFirestore(transaction, procesosAsignados);

  const scopeKey = Array.isArray(procesosAsignados) && procesosAsignados.length
    ? [...new Set(procesosAsignados.map(proceso => String(proceso || '').trim()).filter(Boolean))].sort().join('|')
    : '*';
  const cacheKey = JSON.stringify([String(revision).slice(0, 100), scopeKey]);
  const generation = workspaceCacheGeneration;
  const cacheEntry = workspaceReadCache.get(cacheKey);
  if (cacheEntry && cacheEntry.expiraEn > Date.now()) return cacheEntry.valor;
  if (workspaceReadInFlight.has(cacheKey)) return workspaceReadInFlight.get(cacheKey);

  const lectura = leerWorkspaceGrcDesdeFirestore(null, procesosAsignados)
    .then(valor => {
      if (generation !== workspaceCacheGeneration) return valor;
      if (workspaceReadCache.size >= 100 && !workspaceReadCache.has(cacheKey)) {
        const cacheMasAntigua = workspaceReadCache.keys().next().value;
        if (cacheMasAntigua) workspaceReadCache.delete(cacheMasAntigua);
      }
      workspaceReadCache.set(cacheKey, { valor, expiraEn: Date.now() + WORKSPACE_READ_CACHE_TTL_MS });
      return valor;
    })
    .finally(() => {
      if (workspaceReadInFlight.get(cacheKey) === lectura) workspaceReadInFlight.delete(cacheKey);
    });

  workspaceReadInFlight.set(cacheKey, lectura);
  return lectura;
}

export function guardarInformesGrc(transaction, workspace, informesAuditoria) {
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
  planes.forEach(plan => {
    transaction.set(workspace.coleccionPlanesRef.doc(String(plan.id)), plan);
  });
}

export async function guardarWorkspaceParcial(partialData) {
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
  const hallazgosActualizados = incluyeHallazgos ? partialData.hallazgos : null;
    
  const datosRestantes = { ...partialData };
  delete datosRestantes.informesAuditoria;
  delete datosRestantes.informesEliminados;
  delete datosRestantes.planesAccion; // Aseguramos que NO se guarde en el documento padre
  delete datosRestantes.planes;
  delete datosRestantes.planesEliminados;
  delete datosRestantes.hallazgos;

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
        operaciones.push({ tipo: 'guardar', referencia: refColeccionPlanes.doc(String(plan.id)), data: plan });
      }
    });
    planesEliminados.forEach(id => operaciones.push({ tipo: 'eliminar', referencia: refColeccionPlanes.doc(id) }));
    if (incluyePlanes) {
      const snapshotPlanes = await refColeccionPlanes.get();
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
      operaciones.push({ tipo: 'guardar', referencia: refColeccionHallazgos.doc(id), data: hallazgo });
    });
    snapshotHallazgos.docs.forEach(documento => {
      if (!idsHallazgos.has(documento.id)) {
        operaciones.push({ tipo: 'eliminar', referencia: documento.ref });
      }
    });
  }

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