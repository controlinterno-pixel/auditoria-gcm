import { adminDb } from './firebaseAdmin.js';

export async function notificarSemaforo() {
  try {
    await adminDb.collection('sistema').doc('semaforo').set({
      ultimaModificacion: Date.now(),
    }, { merge: true });
  } catch (error) {
    console.warn('No se pudo actualizar el semáforo de Firestore:', error?.code || error?.message || 'error');
  }
}