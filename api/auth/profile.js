// api/auth/profile.js - Actualización segura de perfiles en el servidor
import { adminDb } from '../_lib/firebaseAdmin.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { applyCors } from '../_lib/cors.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 'Método no permitido. Usa POST.', 405);
  }

  // 🔒 1. Validar sesión HttpOnly en el servidor
  const user = await requireAuth(req, res);
  if (!user) return; // Si falla la sesión, la función se detiene aquí

  try {
    const { nombreResponsable, procesoAsignado, cargo } = req.body;

    // 🛡️ 2. Filtrar únicamente los campos permitidos.
    // NUNCA permitimos que el usuario envíe o modifique la propiedad "rol" desde este endpoint.
    const datosActualizar = {
      nombreResponsable: nombreResponsable || user.nombreResponsable,
      procesoAsignado: procesoAsignado || '',
      cargo: cargo || '',
      ultimaActualizacion: new Date().toISOString()
    };

    // 3. Escribir los cambios en la colección usuarios usando el UID extraído del token verificado
    await adminDb.collection('usuarios').doc(user.uid).set(datosActualizar, { merge: true });

   logger.info('Perfil de usuario actualizado', { usuario: user.email, uid: user.uid });

    return sendSuccess(res, {
      message: 'Perfil actualizado correctamente.',
      user: {
        ...user,
        ...datosActualizar
      }
    });

  } catch (error) {
    logger.error('Error al actualizar perfil en profile.js', error, { endpoint: req.url });
    return sendError(res, 'Error interno al actualizar el perfil.', 500);
  }
}