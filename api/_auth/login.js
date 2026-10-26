// api/auth/login.js - Autenticación y Emisión de Cookie HttpOnly
import { adminAuth, adminDb } from '../_lib/firebaseAdmin.js';
import { serialize } from 'cookie';
import { applyCors } from '../_lib/cors.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';
import { almacenCompartidoConfigurado, consultarLimite, limpiarIntentos, registrarFallo } from '../_lib/rateLimit.js';
import { opcionesCookieSesion, DURACION_SESION_MS } from '../_lib/sesion.js';
import { obtenerIpCliente } from '../_lib/seguridad.js';

// 🛡️ H8: límite de intentos compartido entre instancias (Upstash/Vercel KV) con respaldo en memoria.
const LIMITE = { maximo: 5, ventanaMs: 60 * 1000 }; // 5 intentos por 60 segundos

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 'Método no permitido. Usa POST.', 405);
  }

  // 🛡️ Control de Tasa (Rate Limiting)
  const clientIp = obtenerIpCliente(req);
  const limite = await consultarLimite(clientIp, LIMITE);
  if (limite.bloqueado) {
    logger.warn('Rate limit excedido en login', { clientIp, compartido: almacenCompartidoConfigurado() });
    return sendError(res, `Demasiados intentos fallidos. Intente nuevamente en ${limite.segundosRestantes} segundos.`, 429);
  }
  const limpiarSiHabiaFallos = () => (limite.intentos > 0 ? limpiarIntentos(clientIp) : Promise.resolve());

  try {
    const { idToken } = req.body || {};
    if (!idToken || typeof idToken !== 'string') {
      return sendError(res, 'idToken requerido o con formato inválido.', 400);
    }

    const decodedIdToken = await adminAuth.verifyIdToken(idToken);
    const email = String(decodedIdToken.email || '').trim().toLowerCase();
    if (!email.endsWith('@termales.com.co')) {
      logger.warn('Renovación de sesión rechazada: dominio no autorizado', { motivo: 'domain-not-allowed' });
      return sendError(res, 'Solo se permiten cuentas institucionales.', 403);
    }
    if (decodedIdToken.email_verified !== true) {
      logger.warn('Renovación de sesión rechazada: correo no verificado', { motivo: 'email-not-verified' });
      return sendError(res, 'Verifica tu correo institucional antes de iniciar sesión.', 403);
    }

    // 🔒 Sesión corta: si alguien copia la cookie, deja de servir pronto. La app la renueva sola mientras
    // el usuario siga activo (y el cierre por inactividad del navegador corta esa renovación).
    const expiresIn = DURACION_SESION_MS;
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
    const decoded = await adminAuth.verifySessionCookie(sessionCookie);

    const userRef = adminDb.collection('usuarios').doc(decoded.uid);
    let userDoc = await userRef.get();
    if (!userDoc.exists) {
      const perfilPendiente = {
        correo: email,
        email,
        nombreResponsable: decoded.name || 'Usuario GRC',
        rol: 'lider',
        permisos: [],
        estadoAcceso: 'pendiente',
        procesosSolicitados: [],
        subprocesosSolicitados: [],
        procesosAsignados: [],
        subprocesosAsignados: [],
        creadoEn: new Date().toISOString(),
      };
      try {
        await userRef.create(perfilPendiente);
      } catch (error) {
        if (error.code !== 6 && error.code !== 'already-exists') throw error;
      }
      userDoc = await userRef.get();
    }

    const userData = userDoc.data() || {};
    if (userData.estadoAcceso && userData.estadoAcceso !== 'activo') {
      logger.warn('Renovación de sesión rechazada: acceso no activo', {
        motivo: 'access-not-active',
        estadoAcceso: userData.estadoAcceso,
      });
      await limpiarSiHabiaFallos();
      const message = userData.estadoAcceso === 'rechazado'
        ? 'La solicitud de acceso fue rechazada. Contacta a un administrador.'
        : 'Tu correo está verificado. Espera la aprobación de un administrador para acceder.';
      return sendError(res, message, 403);
    }

    const cookieSerialized = serialize('grc_session', sessionCookie, opcionesCookieSesion(req, expiresIn / 1000));

    await limpiarSiHabiaFallos();

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
    const erroresToken = new Set([
      'auth/argument-error',
      'auth/id-token-expired',
      'auth/id-token-revoked',
      'auth/invalid-id-token',
    ]);
    if (erroresToken.has(String(error?.code || ''))) {
      await registrarFallo(clientIp, LIMITE);
      logger.warn('Token de Firebase rechazado durante el inicio de sesión', { clientIp, codigo: error.code });
      return sendError(res, 'No se pudo validar la sesión de Firebase. Intenta iniciar sesión de nuevo.', 401);
    }

    logger.error('Error interno creando la sesión de servidor en login.js', error, { clientIp });
    return sendError(res, 'El servidor no pudo crear la sesión. Tus credenciales no se han cambiado; inténtalo de nuevo más tarde.', 500);
  }
}