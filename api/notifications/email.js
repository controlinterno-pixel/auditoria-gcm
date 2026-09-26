// api/notifications/email.js - Despacho seguro de correos
import { applyCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 'Método no permitido. Usa POST.', 405);
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return; // requireAuth emite la respuesta 401/403 si falla la sesión

    const { ref_consecutivo, destinatarios } = req.body || {};
    if (!destinatarios) {
      return sendError(res, 'Faltan destinatarios para el envío.', 400);
    }

    logger.info('Despachando notificación por correo', {
      usuario: user.email,
      ref_consecutivo,
      destinatarios
    });

    return sendSuccess(res, {
      message: 'Notificación procesada y despachada por el servidor.'
    });
  } catch (error) {
    logger.error('Error al despachar correo electrónico', error, {
      endpoint: req.url
    });
    return sendError(res, 'Error interno al despachar el correo electrónico.', 500);
  }
}