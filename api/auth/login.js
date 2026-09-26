import { adminAuth, adminDb } from '../_lib/firebaseAdmin.js';
import { serialize } from 'cookie';
import { applyCors } from '../_lib/cors.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';
// 🛡️ Memoria en servidor para registrar intentos fallidos por IP (Rate Limiting)
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 1000; // Ventana de 60 segundos

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 'Solo POST.', 405);
  }

  // 🛡️ Rate Limiting por IP de origen
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
  const now = Date.now();
  const userAttempts = loginAttempts.get(clientIp) || { count: 0, resetTime: now + WINDOW_MS };

  // Reiniciar ventana de tiempo si transcurrieron los 60 segundos
  if (now > userAttempts.resetTime) {
    userAttempts.count = 0;
    userAttempts.resetTime = now + WINDOW_MS;
  }

  // Si supera los 5 intentos, bloquea de inmediato la petición en el servidor
  if (userAttempts.count >= MAX_ATTEMPTS) {
    const secondsLeft = Math.ceil((userAttempts.resetTime - now) / 1000);
    logger.warn('Rate limit excedido en login', { clientIp });
    return sendError(res, `Demasiados intentos fallidos. Intente nuevamente en ${secondsLeft} segundos.`, 429);
  }

  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'Falta idToken' });

    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 días
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
    const decoded = await adminAuth.verifySessionCookie(sessionCookie);

    const userDoc = await adminDb.collection('usuarios').doc(decoded.uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};

const origin = req.headers.origin || '';
    const isProd = process.env.NODE_ENV === 'production' || origin.includes('vercel.app');
    const cookieSerialized = serialize('grc_session', sessionCookie, {
      maxAge: expiresIn / 1000,
      httpOnly: true, // 🔒 Inaccesible para JS del cliente
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
    });

    // 🟢 Si el inicio de sesión es exitoso, limpiamos el contador de la IP
    loginAttempts.delete(clientIp);

   res.setHeader('Set-Cookie', cookieSerialized);
    logger.info('Inicio de sesión exitoso', { usuario: decoded.email, uid: decoded.uid });

    return sendSuccess(res, {
      user: {
        email: decoded.email,
        uid: decoded.uid,
        rol: userData.rol || 'lider',
        nombreResponsable: userData.nombreResponsable || userData.nombre || 'Usuario GRC'
      }
    });
  } catch (error) {
    // 🔴 Si falla la autenticación, incrementamos el contador de intentos fallidos
    userAttempts.count += 1;
    loginAttempts.set(clientIp, userAttempts);

    logger.error('Error durante la autenticación en login.js', error, { clientIp });
    return sendError(res, "Autenticación fallida o credenciales inválidas.", 401);
  }
}