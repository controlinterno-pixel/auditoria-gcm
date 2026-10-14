import { FieldValue, Filter } from 'firebase-admin/firestore';
import { adminDb } from './firebaseAdmin.js';

const workspaceRef = () => adminDb.collection('workspace_compartido').doc('base_de_datos_grc');
const informesRef = () => adminDb.collection('workspace_compartido').doc('base_de_datos_grc_informes');
// NUEVA ARQUITECTURA: Referencia a la futura subcolección escalable
const coleccionInformesRef = () => adminDb.collection('workspace_compartido').doc('base_de_datos_grc').collection('informes');
const WORKSPACE_READ_CACHE_TTL_MS = 30_000;
const workspaceReadCache = new Map();
const workspaceReadInFlight = new Map();

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

async function leerWorkspaceGrcDesdeFirestore(transaction = null, procesosAsignados = null) {
  const refWorkspace = workspaceRef();
  const refInformes = informesRef();
  const refColeccion = coleccionInformesRef();

  const snapshotWorkspace = transaction
    ? await transaction.get(refWorkspace)
    : await refWorkspace.get();

  const snapshotInformes = transaction
    ? await transaction.get(refInformes)
    : await refInformes.get();

  // PATRÓN HÍBRIDO: Firestore no permite leer colecciones en transacciones.
  // Si es una petición GET (sync.js), leemos la subcolección nueva.
  let informesIndependientes = [];
  if (!transaction) {
    informesIndependientes = await leerInformesFragmentados(refColeccion, procesosAsignados);
  }

  const datosWorkspace = snapshotWorkspace.exists ? snapshotWorkspace.data() || {} : {};
  const informesSeparados = snapshotInformes.exists
    ? snapshotInformes.get('informesAuditoria')
    : null;
  const informesLegados = Array.isArray(datosWorkspace.informesAuditoria)
    ? datosWorkspace.informesAuditoria
    : [];

  // FUSIÓN SEGURA: Unimos el array heredado con los documentos fragmentados
  const informesBase = Array.isArray(informesSeparados) ? informesSeparados : informesLegados;
  const informesCombinados = [...informesBase, ...informesIndependientes];

  // 🛡️ DEDUPLICACIÓN EN MEMORIA: Evita duplicados visuales en el frontend durante la migración
  const mapaInformes = new Map();
  informesCombinados.forEach(inf => {
    if (inf && inf.id) mapaInformes.set(String(inf.id), inf);
  });

  return {
    workspaceRef: refWorkspace,
    informesRef: refInformes,
    coleccionInformesRef: refColeccion, // Se expone para futuras escrituras
    workspaceExists: snapshotWorkspace.exists || snapshotInformes.exists,
    tieneInformesLegados: Array.isArray(datosWorkspace.informesAuditoria),
    data: {
      ...datosWorkspace,
      informesAuditoria: Array.from(mapaInformes.values()),
    },
  };
}

export function invalidarCacheWorkspaceGrc() {
  workspaceReadCache.clear();
}

export async function leerWorkspaceGrc(transaction = null, { usarCache = false, procesosAsignados = null } = {}) {
  if (transaction || !usarCache) return leerWorkspaceGrcDesdeFirestore(transaction, procesosAsignados);

  const cacheKey = Array.isArray(procesosAsignados) && procesosAsignados.length
    ? [...new Set(procesosAsignados.map(proceso => String(proceso || '').trim()).filter(Boolean))].sort().join('|')
    : '*';
  const cacheEntry = workspaceReadCache.get(cacheKey);
  if (cacheEntry && cacheEntry.expiraEn > Date.now()) return cacheEntry.valor;
  if (workspaceReadInFlight.has(cacheKey)) return workspaceReadInFlight.get(cacheKey);

  const lectura = leerWorkspaceGrcDesdeFirestore(null, procesosAsignados)
    .then(valor => {
      if (workspaceReadCache.size >= 100 && !workspaceReadCache.has(cacheKey)) {
        const cacheMasAntigua = workspaceReadCache.keys().next().value;
        if (cacheMasAntigua) workspaceReadCache.delete(cacheMasAntigua);
      }
      workspaceReadCache.set(cacheKey, { valor, expiraEn: Date.now() + WORKSPACE_READ_CACHE_TTL_MS });
      return valor;
    })
    .finally(() => {
      workspaceReadInFlight.delete(cacheKey);
    });

  workspaceReadInFlight.set(cacheKey, lectura);
  return lectura;
}

export function guardarInformesGrc(transaction, workspace, informesAuditoria) {
  // 🛡️ ESCRITURA FRAGMENTADA (Transacciones): Cada informe va a su propio documento.
  if (Array.isArray(informesAuditoria)) {
    informesAuditoria.forEach(informe => {
      if (informe && informe.id) {
        const docRef = workspace.coleccionInformesRef.doc(String(informe.id));
        transaction.set(docRef, informe, { merge: true });
      }
    });
  }

  // 💥 DESTRUCCIÓN DEL MURO DE 1MB: Borramos el mega-arreglo heredado
  transaction.set(workspace.informesRef, { informesAuditoria: FieldValue.delete() }, { merge: true });
  if (workspace.tieneInformesLegados) {
    transaction.set(workspace.workspaceRef, { informesAuditoria: FieldValue.delete() }, { merge: true });
  }
}

export async function guardarWorkspaceParcial(partialData) {
  const refWorkspace = workspaceRef();
  const refInformes = informesRef();
  const refColeccion = coleccionInformesRef();
  
  const [snapshotWorkspace, snapshotInformes] = await Promise.all([
    refWorkspace.get(),
    refInformes.get(),
  ]);
  
  const datosWorkspace = snapshotWorkspace.exists ? snapshotWorkspace.data() || {} : {};
  const informesLegados = Array.isArray(datosWorkspace.informesAuditoria) ? datosWorkspace.informesAuditoria : null;
  const incluyeInformes = Object.hasOwn(partialData, 'informesAuditoria') && Array.isArray(partialData.informesAuditoria);
  
  const informesActualizados = incluyeInformes 
    ? partialData.informesAuditoria 
    : (informesLegados && !snapshotInformes.exists ? informesLegados : null);
  const informesEliminados = [...new Set(
    (Array.isArray(partialData.informesEliminados) ? partialData.informesEliminados : [])
      .map(id => String(id || '').trim())
      .filter(Boolean)
  )];
    
  const datosRestantes = { ...partialData };
  delete datosRestantes.informesAuditoria;
  delete datosRestantes.informesEliminados;

  if (informesActualizados || incluyeInformes) {
    const listaInformes = Array.isArray(informesActualizados) ? informesActualizados : [];
    
    const chunkSize = 400;
    const idsEliminados = new Set(informesEliminados);
    const informesPorId = new Map(
      listaInformes
        .filter(informe => informe && informe.id && !idsEliminados.has(String(informe.id)))
        .map(informe => [String(informe.id), informe])
    );
    const operaciones = [
      ...[...informesPorId].map(([id, informe]) => ({ tipo: 'guardar', id, informe })),
      ...informesEliminados.map(id => ({ tipo: 'eliminar', referencia: refColeccion.doc(id) })),
    ];

    // Keep each batch below Firestore's 500-write limit, including legacy cleanup writes.
    for (let i = 0; i < operaciones.length; i += chunkSize) {
      const chunk = operaciones.slice(i, i + chunkSize);
      const batch = adminDb.batch();
      
      chunk.forEach(operacion => {
        if (operacion.tipo === 'guardar') {
          batch.set(refColeccion.doc(operacion.id), operacion.informe, { merge: true });
        } else {
          batch.delete(operacion.referencia);
        }
      });

      if (i + chunkSize >= operaciones.length) {
        batch.set(refInformes, { informesAuditoria: FieldValue.delete() }, { merge: true });
        if (Array.isArray(datosWorkspace.informesAuditoria)) {
          datosRestantes.informesAuditoria = FieldValue.delete();
        }
        batch.set(refWorkspace, datosRestantes, { merge: true });
      }
      
      await batch.commit();
    }
    
    if (operaciones.length === 0) {
       const batch = adminDb.batch();
       batch.set(refInformes, { informesAuditoria: FieldValue.delete() }, { merge: true });
       if (Array.isArray(datosWorkspace.informesAuditoria)) {
         datosRestantes.informesAuditoria = FieldValue.delete();
       }
       batch.set(refWorkspace, datosRestantes, { merge: true });
       await batch.commit();
    }
    return;
  }

  await refWorkspace.set(datosRestantes, { merge: true });
}