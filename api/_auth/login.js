// api/auth/login.js - Autenticación y Emisión de Cookie HttpOnly
import { adminAuth, adminDb } from '../_lib/firebaseAdmin.js';
import { serialize } from 'cookie';
import { applyCors } from '../_lib/cors.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';

// 🛡️ Rate Limiting en memoria por instancia de función
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 1000; // 60 segundos

/**
 * Extrae la IP de origen real del cliente evitando fallas por múltiples proxies.
 */
function obtenerIpCliente(req) {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor && typeof xForwardedFor === 'string') {
    return xForwardedFor.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown-ip';
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 'Método no permitido. Usa POST.', 405);
  }

  // 🛡️ Control de Tasa (Rate Limiting)
  const clientIp = obtenerIpCliente(req);
  const now = Date.now();
  const userAttempts = loginAttempts.get(clientIp) || { count: 0, resetTime: now + WINDOW_MS };

  if (now > userAttempts.resetTime) {
    userAttempts.count = 0;
    userAttempts.resetTime = now + WINDOW_MS;
  }

  if (userAttempts.count >= MAX_ATTEMPTS) {
    const secondsLeft = Math.ceil((userAttempts.resetTime - now) / 1000);
    logger.warn('Rate limit excedido en login', { clientIp });
    return sendError(res, `Demasiados intentos fallidos. Intente nuevamente en ${secondsLeft} segundos.`, 429);
  }

  try {
    const { idToken } = req.body || {};
    if (!idToken || typeof idToken !== 'string') {
      return sendError(res, 'idToken requerido o con formato inválido.', 400);
    }

    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 días de validez
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
    const decoded = await adminAuth.verifySessionCookie(sessionCookie);

    const userDoc = await adminDb.collection('usuarios').doc(decoded.uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    const origin = req.headers.origin || '';
    
    // CAMBIO ARQUITECTÓNICO: Consideramos "producción" a cualquier entorno que NO sea localhost.
    // Esto garantiza que los dominios personalizados (ej. termales.com.co) reciban la configuración estricta CORS.
    const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
    const isProd = process.env.NODE_ENV === 'production' || !isLocalhost;

    const cookieSerialized = serialize('grc_session', sessionCookie, {
      maxAge: expiresIn / 1000,
      httpOnly: true, // 🔒 Inaccesible para scripts del cliente (Anti-XSS)
      secure: isProd, // 🔒 En producción exige HTTPS
      sameSite: isProd ? 'none' : 'lax', // 🔒 'none' es OBLIGATORIO para peticiones CORS (APIs separadas del Front)
      path: '/',
    });

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
    userAttempts.count += 1;
    loginAttempts.set(clientIp, userAttempts);

    logger.error('Error durante la autenticación en login.js', error, { clientIp });
    return sendError(res, 'Autenticación fallida o credenciales inválidas.', 401);
  }
}