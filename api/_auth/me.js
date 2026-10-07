// api/auth/me.js - Verificación de Sesión Activa
import { applyCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, 'Método no permitido. Usa GET.', 405);
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return; // requireAuth emite 401/403 si la sesión no existe o expiró

    return sendSuccess(res, {
      authenticated: true,
      user
    });
  } catch (err) {
    logger.error('Error al verificar sesión en me.js', err, { endpoint: req.url });
    return sendError(res, 'Sesión no válida o expirada.', 401);
  }
}