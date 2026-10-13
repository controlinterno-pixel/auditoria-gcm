import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebaseAdmin.js';

const workspaceRef = () => adminDb.collection('workspace_compartido').doc('base_de_datos_grc');
const informesRef = () => adminDb.collection('workspace_compartido').doc('base_de_datos_grc_informes');
// NUEVA ARQUITECTURA: Referencia a la futura subcolección escalable
const coleccionInformesRef = () => adminDb.collection('workspace_compartido').doc('base_de_datos_grc').collection('informes');
const WORKSPACE_READ_CACHE_TTL_MS = 30_000;
let workspaceReadCache = null;
let workspaceReadInFlight = null;

async function leerWorkspaceGrcDesdeFirestore(transaction = null) {
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
    const querySnapshot = await refColeccion.get();
    informesIndependientes = querySnapshot.docs.map(doc => doc.data());
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

export async function leerWorkspaceGrc(transaction = null, { usarCache = false } = {}) {
  if (transaction || !usarCache) return leerWorkspaceGrcDesdeFirestore(transaction);

  if (workspaceReadCache && workspaceReadCache.expiraEn > Date.now()) {
    return workspaceReadCache.valor;
  }
  if (workspaceReadInFlight) return workspaceReadInFlight;

  workspaceReadInFlight = leerWorkspaceGrcDesdeFirestore()
    .then(valor => {
      workspaceReadCache = { valor, expiraEn: Date.now() + WORKSPACE_READ_CACHE_TTL_MS };
      return valor;
    })
    .finally(() => {
      workspaceReadInFlight = null;
    });

  return workspaceReadInFlight;
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