// api/grc/sync.js - Sincronización GRC con Row-Level Security
import { applyCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';
import { adminDb } from '../_lib/firebaseAdmin.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendError(res, 'Método no permitido.', 405);
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const rawRol = String(user.rol || '').toLowerCase().trim();
    const isAdmin = rawRol === 'admin' || rawRol === 'administrador' || rawRol.includes('admin') || rawRol === 'auditor';
    // =========================================================================
    // 🛡️ LÓGICA GET: LECTURA CON ROW-LEVEL SECURITY (RLS) SERVER-SIDE
    // Cierra el Hallazgo #N1 (Fuga de datos completa en red)
    // =========================================================================
    if (req.method === 'GET') {
      const dbDoc = await adminDb.collection('workspace_compartido').doc('base_de_datos_grc').get();
      const data = dbDoc.exists ? dbDoc.data() : {};

      // Si es un alto mando, enviamos todo el documento completo
      if (isAdmin) {
        return res.status(200).json(data);
      }

      // Si es un Líder normal, podamos los datos confidenciales ANTES de responder
      const userEmail = user.email.toLowerCase();
      const userName = user.nombreResponsable?.toLowerCase() || '';
      const userProcess = user.procesoAsignado;

      const applyRLS = (list = [], keyProceso, keyResp, keyCorreoResp) => {
        return list.filter(item => {
          if (keyCorreoResp && item[keyCorreoResp]?.toLowerCase() === userEmail) return true;
          if (keyResp && userName && item[keyResp]?.toLowerCase().includes(userName)) return true;
          if (keyProceso && userProcess && item[keyProceso] === userProcess) return true;
          return false;
        });
      };

      const filteredData = {
        ...data,
        planes: applyRLS(data.planes || [], 'proceso', 'responsable', 'correoResponsable'),
        hallazgos: applyRLS(data.hallazgos || [], 'proceso', 'responsable', null),
        riesgos: applyRLS(data.riesgos || [], 'proceso', 'responsable', null),
        evaluaciones: applyRLS(data.evaluaciones || [], 'proceso', null, null)
      };

      return res.status(200).json(filteredData);
    }

    // =========================================================================
    // 🛡️ LÓGICA POST: ESCRITURA ESTRICTA
    // Cierra el Hallazgo #6 y #N2 (Escritura no autorizada)
    // =========================================================================
    if (req.method === 'POST') {
      if (!isAdmin) {
        return res.status(403).json({ error: 'Permisos insuficientes. Solo administradores pueden modificar la estructura GRC.' });
      }

      const { partialData } = req.body;
      await adminDb.collection('workspace_compartido').doc('base_de_datos_grc').set(partialData, { merge: true });
      logger.info('Estructura GRC actualizada por administrador', { usuario: user.email });
      return sendSuccess(res, { message: 'Guardado exitoso.' });
    }

  } catch (error) {
    logger.error('Error interno en sync.js', error, { endpoint: req.url });
    return sendError(res, 'Error interno al procesar la base de datos.', 500);
  }
}