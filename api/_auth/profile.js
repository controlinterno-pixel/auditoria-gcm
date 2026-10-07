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

  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    const { nombreResponsable, cargo } = req.body || {};

    // 🛡️ BLOQUEO DE ESCALAMIENTO RLS: NUNCA se actualiza 'procesoAsignado' ni 'rol' desde este endpoint.
    const datosActualizar = {
      nombreResponsable: typeof nombreResponsable === 'string' ? nombreResponsable.trim() : user.nombreResponsable,
      cargo: typeof cargo === 'string' ? cargo.trim() : (user.cargo || ''),
      ultimaActualizacion: new Date().toISOString()
    };

    await adminDb.collection('usuarios').doc(user.uid).set(datosActualizar, { merge: true });

    logger.info('Perfil de usuario actualizado con éxito', { usuario: user.email, uid: user.uid });

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