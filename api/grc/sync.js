// api/grc/sync.js - Sincronización GRC con Row-Level Security Optimizada
import { applyCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';
import { adminDb } from '../_lib/firebaseAdmin.js';

/**
 * Valida de forma estricta si el usuario posee rol administrativo o de auditoría.
 */
function esRolAdministrador(rol) {
  if (!rol || typeof rol !== 'string') return false;
  const normalizado = rol.toLowerCase().trim();
  return normalizado === 'admin' || normalizado === 'administrador' || normalizado === 'auditor';
}

/**
 * Helper defensivo para RLS: Filtra colecciones evitando TypeErrors.
 */
function aplicarRLS(lista = [], keyProceso, keyResp, keyCorreoResp, userEmail, userName, userProcess) {
  if (!Array.isArray(lista)) return [];

  return lista.filter(item => {
    if (!item || typeof item !== 'object') return false;

    // 1. Validación por Correo Electrónico
    if (keyCorreoResp && item[keyCorreoResp] && typeof item[keyCorreoResp] === 'string') {
      if (item[keyCorreoResp].toLowerCase().trim() === userEmail) return true;
    }

    // 2. Validación por Nombre de Responsable
    if (keyResp && userName && item[keyResp] && typeof item[keyResp] === 'string') {
      if (item[keyResp].toLowerCase().includes(userName)) return true;
    }

    // 3. Validación por Proceso Asignado
    if (keyProceso && userProcess && item[keyProceso]) {
      const procItem = String(item[keyProceso]).trim().toLowerCase();
      const procUser = String(userProcess).trim().toLowerCase();
      if (procItem === procUser || procItem.includes(procUser)) return true;
    }

    return false;
  });
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendError(res, 'Método no permitido.', 405);
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const isAdmin = esRolAdministrador(user.rol);

    // =========================================================================
    // 🛡️ LÓGICA GET: LECTURA CON ROW-LEVEL SECURITY (RLS) SERVER-SIDE
    // =========================================================================
    if (req.method === 'GET') {
      const dbDoc = await adminDb.collection('workspace_compartido').doc('base_de_datos_grc').get();
      
      if (!dbDoc.exists) {
        return sendSuccess(res, {});
      }

      const data = dbDoc.data() || {};

      // Administradores y Auditores acceden a la totalidad del documento
      if (isAdmin) {
        return sendSuccess(res, data);
      }

      // Aplicación de RLS sanitizada para usuarios estándar
      const userEmail = String(user.email || '').toLowerCase().trim();
      const userName = String(user.nombreResponsable || '').toLowerCase().trim();
      const userProcess = user.procesoAsignado || user.proceso || null;

      const filteredData = {
        ...data,
        planes: aplicarRLS(data.planes, 'proceso', 'responsable', 'correoResponsable', userEmail, userName, userProcess),
        hallazgos: aplicarRLS(data.hallazgos, 'proceso', 'responsable', null, userEmail, userName, userProcess),
        riesgos: aplicarRLS(data.riesgos, 'proceso', 'responsable', null, userEmail, userName, userProcess),
        evaluaciones: aplicarRLS(data.evaluaciones, 'proceso', null, null, userEmail, userName, userProcess)
      };

      return sendSuccess(res, filteredData);
    }

    // =========================================================================
    // 🛡️ LÓGICA POST: ESCRITURA ESTRICTA
    // =========================================================================
    if (req.method === 'POST') {
      if (!isAdmin) {
        logger.warn('Intento de escritura RLS denegado', { usuario: user.email, rol: user.rol });
        return sendError(res, 'Permisos insuficientes. Solo administradores pueden modificar la estructura GRC.', 403);
      }

      const { partialData } = req.body || {};

      if (!partialData || typeof partialData !== 'object' || Array.isArray(partialData)) {
        return sendError(res, 'Estructura de datos (partialData) inválida o ausente.', 400);
      }

      await adminDb.collection('workspace_compartido').doc('base_de_datos_grc').set(partialData, { merge: true });
      logger.info('Estructura GRC actualizada por administrador', { usuario: user.email });
      return sendSuccess(res, { message: 'Guardado exitoso.' });
    }

  } catch (error) {
    logger.error('Error interno en sync.js', error, { endpoint: req.url });
    return sendError(res, 'Error interno al procesar la base de datos.', 500);
  }
}