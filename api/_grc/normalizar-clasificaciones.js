// api/_grc/normalizar-clasificaciones.js - Unifica la clasificación de los riesgos a las 7 del Manual (Tabla 5).
// Solo administradores. Por defecto SIMULA (no escribe nada). Ejecutar exige confirmación escrita.
import { applyCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';
import { notificarSemaforo } from '../_lib/semaforo.js';
import { normalizarClasificacionesMatriz } from '../_lib/grcWorkspace.js';

export const CONFIRMACION_CLASIFICACIONES = 'NORMALIZAR-CLASIFICACIONES';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 'Método no permitido. Usa POST.', 405);

  const user = await requireAuth(req, res);
  if (!user) return;
  if (!['admin', 'administrador'].includes(String(user.rol || '').trim().toLowerCase())) {
    return sendError(res, 'Solo un administrador puede unificar las clasificaciones.', 403);
  }

  const { ejecutar = false, confirmacion = '' } = req.body || {};
  if (ejecutar === true && confirmacion !== CONFIRMACION_CLASIFICACIONES) {
    return sendError(res, `Para ejecutar la corrección envía confirmacion: "${CONFIRMACION_CLASIFICACIONES}".`, 400);
  }

  try {
    const reporte = await normalizarClasificacionesMatriz({ ejecutar: ejecutar === true, usuario: user.email });
    if (reporte.estado === 'normalizado') await notificarSemaforo();
    logger.info('[RIESGOS] Unificación de clasificaciones', {
      estado: reporte.estado, usuario: user.email, corregidos: reporte.riesgosCorregidos,
    });
    return sendSuccess(res, reporte);
  } catch (error) {
    logger.error('[RIESGOS] Error al unificar clasificaciones', error, { usuario: user.email });
    return sendError(res, `No se corrigió nada: ${error.message}`, 500);
  }
}
