import { adminDb } from '../_lib/firebaseAdmin.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { applyCors } from '../_lib/cors.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';
import { PERMISOS_BASICOS } from '../../src/utils/permisosVista.js';

const CAMPOS_EDITABLES = new Set([
  'rol',
  'permisos',
  'procesosAsignados',
  'subprocesosAsignados',
  'procesoAsignado',
  'subprocesoAsignado',
  'nombreResponsable',
  'cargo',
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

async function obtenerMapaProcesos() {
  const snapshot = await adminDb.collection('workspace_compartido').doc('base_de_datos_grc').get();
  const data = snapshot.exists ? snapshot.data() || {} : {};
  return data.mapaProcesos && typeof data.mapaProcesos === 'object' ? data.mapaProcesos : {};
}

async function resolverSolicitud(uid, accion) {
  const userRef = adminDb.collection('usuarios').doc(uid);
  const userSnapshot = await userRef.get();
  if (!userSnapshot.exists) return { error: 'Usuario no encontrado.', status: 404 };

  const userData = userSnapshot.data() || {};
  if (accion === 'rechazar') {
    if (userData.estadoAcceso !== 'pendiente') {
      return { error: 'La solicitud ya fue resuelta.', status: 409 };
    }
    await userRef.update({ estadoAcceso: 'rechazado' });
    return { estadoAcceso: 'rechazado' };
  }

  if (accion !== 'aprobar' || userData.estadoAcceso !== 'pendiente') {
    return { error: 'La solicitud no está pendiente de aprobación.', status: 409 };
  }

  const mapaProcesos = await obtenerMapaProcesos();
  const procesos = Array.isArray(userData.procesosAsignados) && userData.procesosAsignados.length
    ? userData.procesosAsignados
    : (Array.isArray(userData.procesosSolicitados) ? userData.procesosSolicitados : []);
  const subprocesos = Array.isArray(userData.subprocesosAsignados) && userData.subprocesosAsignados.length
    ? userData.subprocesosAsignados
    : (Array.isArray(userData.subprocesosSolicitados) ? userData.subprocesosSolicitados : []);
  const procesosValidos = procesos.length > 0 && procesos.every(proceso => (
    Object.hasOwn(mapaProcesos, proceso) && Array.isArray(mapaProcesos[proceso])
  ));
  const subprocesosValidos = subprocesos.length > 0 && subprocesos.every(subproceso => (
    procesos.some(proceso => mapaProcesos[proceso].includes(subproceso))
  ));
  if (!procesosValidos || !subprocesosValidos) {
    return { error: 'Asigna al menos un macroproceso y subproceso válidos antes de aprobar.', status: 400 };
  }

  await userRef.update({
    estadoAcceso: 'activo',
    // Sin casillas asignadas, el usuario aprobado recibe el paquete básico (luego se ajusta en Configuración).
    ...(Array.isArray(userData.permisos) && userData.permisos.length > 0 ? {} : { permisos: PERMISOS_BASICOS }),
    procesosAsignados: procesos,
    subprocesosAsignados: subprocesos,
    procesoAsignado: procesos.length === 1 ? procesos[0] : '',
    subprocesoAsignado: subprocesos.length === 1 ? subprocesos[0] : '',
  });
  return { estadoAcceso: 'activo', procesosAsignados: procesos, subprocesosAsignados: subprocesos };
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

    const { uid, cambios, accion } = req.body || {};
    if (typeof uid !== 'string' || !uid || uid.length > 128) {
      return sendError(res, 'La actualización del usuario no es válida.', 400);
    }

    if (accion) {
      const resultado = await resolverSolicitud(uid, accion);
      if (resultado.error) return sendError(res, resultado.error, resultado.status);
      return sendSuccess(res, resultado);
    }

    if (!cambiosValidos(cambios)) {
      return sendError(res, 'La actualización del usuario no es válida.', 400);
    }

    await adminDb.collection('usuarios').doc(uid).update(cambios);
    return sendSuccess(res, { message: 'Usuario actualizado.' });
  } catch (error) {
    logger.error('Error en administración de usuarios', error, { endpoint: req.url });
    return sendError(res, 'No se pudo procesar la administración de usuarios.', 500);
  }
}