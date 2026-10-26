// api/notifications/email.js - Prepara el soporte de una evaluación para adjuntarlo al correo.
// Los correos los envía el navegador con la cuenta de Gmail de cada usuario (src/services/gmailService.js).
// 🛡️ El envío por SMTP desde el servidor se retiró: no lo usaba la app y permitía a cualquier usuario con
// sesión mandar correos con HTML libre, a cualquier destinatario, en nombre de la cuenta institucional.
import { applyCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';
import { descargarAdjuntoEvaluacion, validarAdjuntoEvaluacion } from '../../src/utils/evaluationAttachment.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 'Método no permitido. Usa POST.', 405);
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { operacion, adjuntoEvaluacion } = req.body || {};
    if (operacion !== 'preparar-adjunto') {
      logger.warn('Solicitud de envío SMTP rechazada: el servidor ya no envía correos', { usuario: user.email });
      return sendError(res, 'El servidor no envía correos: la app los envía desde tu cuenta de Gmail.', 410);
    }
    try {
      validarAdjuntoEvaluacion(adjuntoEvaluacion);
    } catch (error) {
      return sendError(res, error.message, 400);
    }
    const archivo = await descargarAdjuntoEvaluacion(adjuntoEvaluacion);
    return sendSuccess(res, { ...validarAdjuntoEvaluacion(archivo), contenidoBase64: Buffer.from(archivo.contenido).toString('base64') });
  } catch (error) {
    logger.error('Error preparando el adjunto del correo', error, { endpoint: req.url });
    return sendError(res, 'No se pudo preparar el soporte para el correo. Intenta de nuevo.', 500);
  }
}
