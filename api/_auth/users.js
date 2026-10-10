import { adminDb } from '../_lib/firebaseAdmin.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { applyCors } from '../_lib/cors.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';

const CAMPOS_EDITABLES = new Set([
  'rol',
  'permisos',
  'procesosAsignados',
  'subprocesosAsignados',
  'procesoAsignado',
  'subprocesoAsignado',
  'nombreResponsable',
]);

function cambiosValidos(cambios) {
  if (!cambios || typeof cambios !== 'object' || Array.isArray(cambios)) return false;
  const entradas = Object.entries(cambios);
  if (entradas.length === 0 || entradas.some(([campo]) => !CAMPOS_EDITABLES.has(campo))) return false;

  return entradas.every(([campo, valor]) => {
    if (campo === 'rol') return ['admin', 'auditor', 'lider'].includes(valor);
    if (campo === 'permisos' || campo === 'procesosAsignados' || campo === 'subprocesosAsignados') {
      return Array.isArray(valor) && valor.length <= 200 && valor.every(item => typeof item === 'string' && item.length <= 160);
    }
    return typeof valor === 'string' && valor.length <= 160;
  });
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET' && req.method !== 'PATCH') {
    return sendError(res, 'Método no permitido.', 405);
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const adminRef = adminDb.collection('usuarios').doc(user.uid);
    const adminSnapshot = await adminRef.get();
    if (!adminSnapshot.exists || adminSnapshot.get('rol') !== 'admin') {
      return sendError(res, 'Permisos insuficientes.', 403);
    }

    if (req.method === 'GET') {
      const snapshot = await adminDb.collection('usuarios').get();
      const usuarios = snapshot.docs.map(documento => ({ id: documento.id, ...documento.data() }));
      return sendSuccess(res, { usuarios });
    }

    const { uid, cambios } = req.body || {};
    if (typeof uid !== 'string' || !uid || uid.length > 128 || !cambiosValidos(cambios)) {
      return sendError(res, 'La actualización del usuario no es válida.', 400);
    }

    await adminDb.collection('usuarios').doc(uid).update(cambios);
    return sendSuccess(res, { message: 'Usuario actualizado.' });
  } catch (error) {
    logger.error('Error en administración de usuarios', error, { endpoint: req.url });
    return sendError(res, 'No se pudo procesar la administración de usuarios.', 500);
  }
}