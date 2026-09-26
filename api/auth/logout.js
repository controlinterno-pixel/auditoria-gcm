import { serialize } from 'cookie';
import { applyCors } from '../_lib/cors.js';
import { sendSuccess } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  const cookieSerialized = serialize('grc_session', '', {
    maxAge: -1,
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
  });

  res.setHeader('Set-Cookie', cookieSerialized);
logger.info('Sesión cerrada correctamente');
  return sendSuccess(res, { message: 'Sesión cerrada' });
}