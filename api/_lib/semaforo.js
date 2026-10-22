import { adminDb } from './firebaseAdmin.js';
import { invalidarCacheWorkspaceGrc } from './grcWorkspace.js';

// Revisión vigente (1 lectura). Mismo formato que calcula el cliente desde su listener del semáforo.
export async function leerRevisionSemaforo() {
  const snapshot = await adminDb.collection('sistema').doc('semaforo').get();
  return snapshot.exists ? String(snapshot.data()?.ultimaModificacion || '0') : '0';
}

// Avisa a los clientes que hubo un cambio. Si se pasa `res`, devuelve en cabeceras la revisión anterior y la
// nueva: el cliente que hizo el cambio y ya aplicó la respuesta puede evitar volver a descargar todo,
// siempre que nadie más haya escrito entre medio (su revisión cargada coincide con la anterior).
export async function notificarSemaforo(res = null) {
  invalidarCacheWorkspaceGrc();
  try {
    const referencia = adminDb.collection('sistema').doc('semaforo');
    const { anterior, nueva } = await adminDb.runTransaction(async transaction => {
      const snapshot = await transaction.get(referencia);
      const previa = snapshot.exists ? Number(snapshot.data()?.ultimaModificacion) || 0 : 0;
      // Siempre creciente, aunque dos escrituras caigan en el mismo milisegundo.
      const siguiente = Math.max(Date.now(), previa + 1);
      transaction.set(referencia, { ultimaModificacion: siguiente }, { merge: true });
      return { anterior: String(previa), nueva: String(siguiente) };
    });
    if (res && typeof res.setHeader === 'function' && !res.headersSent) {
      res.setHeader('X-GRC-Revision-Anterior', anterior);
      res.setHeader('X-GRC-Revision', nueva);
    }
    return { anterior, nueva };
  } catch (error) {
    console.warn('No se pudo actualizar el semáforo de Firestore:', error?.code || error?.message || 'error');
    return null;
  }
}
