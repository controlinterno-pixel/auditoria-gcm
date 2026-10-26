import { parse, serialize } from 'cookie';
import { adminAuth } from '../_lib/firebaseAdmin.js';
import { applyCors } from '../_lib/cors.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';
import { opcionesCookieSesion } from '../_lib/sesion.js';
import { olvidarSesion } from '../_lib/authMiddleware.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 'Método no permitido. Usa POST.', 405);

  const sessionCookie = parse(req.headers.cookie || '').grc_session;
  res.setHeader('Set-Cookie', serialize('grc_session', '', opcionesCookieSesion(req, -1)));

  // 🔒 Borrar la cookie del navegador no basta: si alguien la copió, seguiría sirviendo. Se revocan las
  // sesiones del usuario en Firebase para que esa copia (y la renovación automática) dejen de funcionar.
  if (sessionCookie) {
    olvidarSesion(sessionCookie);
    try {
      const { uid } = await adminAuth.verifySessionCookie(sessionCookie, false);
      await adminAuth.revokeRefreshTokens(uid);
      logger.info('Sesión cerrada y revocada', { uid });
    } catch (error) {
      // Cookie ya vencida o inválida: no hay nada que revocar; el navegador ya la borró.
      logger.warn('Cierre de sesión sin revocación', { codigo: error?.code || error?.name || 'unknown' });
    }
  }

  return sendSuccess(res, { message: 'Sesión cerrada' });
}
