// api/_grc/recalcular-residuales.js - Recalcula el residual de toda la matriz con la regla del Manual de Riesgos.
// Solo administradores. Por defecto SIMULA (no escribe nada). Ejecutar exige confirmación escrita.
import { applyCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';
import { notificarSemaforo } from '../_lib/semaforo.js';
import { recalcularResidualesMatriz } from '../_lib/grcWorkspace.js';

export const CONFIRMACION_RECALCULO = 'RECALCULAR-RESIDUALES';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 'Método no permitido. Usa POST.', 405);

  const user = await requireAuth(req, res);
  if (!user) return;
  if (!['admin', 'administrador'].includes(String(user.rol || '').trim().toLowerCase())) {
    return sendError(res, 'Solo un administrador puede recalcular la matriz de riesgos.', 403);
  }

  const { ejecutar = false, confirmacion = '' } = req.body || {};
  if (ejecutar === true && confirmacion !== CONFIRMACION_RECALCULO) {
    return sendError(res, `Para ejecutar el recálculo envía confirmacion: "${CONFIRMACION_RECALCULO}".`, 400);
  }

  try {
    const reporte = await recalcularResidualesMatriz({ ejecutar: ejecutar === true, usuario: user.email });
    if (reporte.estado === 'recalculado') await notificarSemaforo();
    logger.info('[RIESGOS] Recálculo de residuales', {
      estado: reporte.estado, usuario: user.email, conCambio: reporte.riesgosConCambio, cambianDeZona: reporte.cambianDeZona,
    });
    return sendSuccess(res, reporte);
  } catch (error) {
    logger.error('[RIESGOS] Error en el recálculo de residuales', error, { usuario: user.email });
    return sendError(res, `No se recalculó nada: ${error.message}`, 500);
  }
}
