import { adminDb } from './firebaseAdmin.js';
import { invalidarCacheWorkspaceGrc } from './grcWorkspace.js';

// Revisión vigente (1 lectura). Mismo formato que calcula el cliente desde su listener del semáforo.
export async function leerRevisionSemaforo() {
  const snapshot = await adminDb.collection('sistema').doc('semaforo').get();
  return snapshot.exists ? String(snapshot.data()?.ultimaModificacion || '0') : '0';
}

export async function notificarSemaforo() {
  invalidarCacheWorkspaceGrc();
  try {
    await adminDb.collection('sistema').doc('semaforo').set({
      ultimaModificacion: Date.now(),
    }, { merge: true });
  } catch (error) {
    console.warn('No se pudo actualizar el semáforo de Firestore:', error?.code || error?.message || 'error');
  }
}