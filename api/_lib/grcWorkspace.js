import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebaseAdmin.js';

const workspaceRef = () => adminDb.collection('workspace_compartido').doc('base_de_datos_grc');
const informesRef = () => adminDb.collection('workspace_compartido').doc('base_de_datos_grc_informes');

export async function leerWorkspaceGrc(transaction = null) {
  const refWorkspace = workspaceRef();
  const refInformes = informesRef();
  const snapshotWorkspace = transaction
    ? await transaction.get(refWorkspace)
    : await refWorkspace.get();
  const snapshotInformes = transaction
    ? await transaction.get(refInformes)
    : await refInformes.get();
  const datosWorkspace = snapshotWorkspace.exists ? snapshotWorkspace.data() || {} : {};
  const informesSeparados = snapshotInformes.exists
    ? snapshotInformes.get('informesAuditoria')
    : null;
  const informesLegados = Array.isArray(datosWorkspace.informesAuditoria)
    ? datosWorkspace.informesAuditoria
    : [];

  return {
    workspaceRef: refWorkspace,
    informesRef: refInformes,
    workspaceExists: snapshotWorkspace.exists || snapshotInformes.exists,
    tieneInformesLegados: Array.isArray(datosWorkspace.informesAuditoria),
    data: {
      ...datosWorkspace,
      informesAuditoria: Array.isArray(informesSeparados) ? informesSeparados : informesLegados,
    },
  };
}

export function guardarInformesGrc(transaction, workspace, informesAuditoria) {
  transaction.set(workspace.informesRef, { informesAuditoria }, { merge: true });
  if (workspace.tieneInformesLegados) {
    transaction.set(workspace.workspaceRef, { informesAuditoria: FieldValue.delete() }, { merge: true });
  }
}

export async function guardarWorkspaceParcial(partialData) {
  const refWorkspace = workspaceRef();
  const refInformes = informesRef();
  const [snapshotWorkspace, snapshotInformes] = await Promise.all([
    refWorkspace.get(),
    refInformes.get(),
  ]);
  const datosWorkspace = snapshotWorkspace.exists ? snapshotWorkspace.data() || {} : {};
  const informesLegados = Array.isArray(datosWorkspace.informesAuditoria)
    ? datosWorkspace.informesAuditoria
    : null;
  const incluyeInformes = Object.hasOwn(partialData, 'informesAuditoria') && Array.isArray(partialData.informesAuditoria);
  const informesActualizados = incluyeInformes
    ? partialData.informesAuditoria
    : informesLegados && !snapshotInformes.exists ? informesLegados : null;
  const datosRestantes = { ...partialData };
  delete datosRestantes.informesAuditoria;

  if (informesActualizados || incluyeInformes) {
    const batch = adminDb.batch();
    batch.set(refInformes, { informesAuditoria: informesActualizados || [] }, { merge: true });
    if (Array.isArray(datosWorkspace.informesAuditoria)) {
      datosRestantes.informesAuditoria = FieldValue.delete();
    }
    batch.set(refWorkspace, datosRestantes, { merge: true });
    await batch.commit();
    return;
  }

  await refWorkspace.set(datosRestantes, { merge: true });
}