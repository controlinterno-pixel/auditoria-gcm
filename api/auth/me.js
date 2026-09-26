// api/auth/me.js - Verificación de sesión activa
import { applyCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { logger } from '../_lib/logger.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return; // requireAuth emite 401/403 si la sesión no existe

    return res.status(200).json({
      authenticated: true,
      user
    });
  } catch (err) {
    logger.error('Error al verificar sesión en me.js', err, { endpoint: req.url });
    return res.status(401).json({ authenticated: false });
  }
}