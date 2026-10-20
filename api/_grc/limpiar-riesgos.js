// api/_grc/limpiar-riesgos.js - Fase 6: elimina las copias antiguas de la matriz de riesgos.
// Solo administradores. Por defecto SIMULA (no borra nada). Ejecutar exige confirmación escrita y
// solo procede si cada riesgo antiguo existe en la matriz vigente (o se confirmó explícitamente).
import { applyCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';
import { notificarSemaforo } from '../_lib/semaforo.js';
import { limpiarRiesgosLegados } from '../_lib/grcWorkspace.js';

export const CONFIRMACION_LIMPIEZA = 'LIMPIAR-RIESGOS';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 'Método no permitido. Usa POST.', 405);

  const user = await requireAuth(req, res);
  if (!user) return;
  if (!['admin', 'administrador'].includes(String(user.rol || '').trim().toLowerCase())) {
    return sendError(res, 'Solo un administrador puede limpiar la matriz de riesgos.', 403);
  }

  const { ejecutar = false, confirmacion = '', faltantesConfirmados = [] } = req.body || {};
  if (ejecutar === true && confirmacion !== CONFIRMACION_LIMPIEZA) {
    return sendError(res, `Para ejecutar la limpieza envía confirmacion: "${CONFIRMACION_LIMPIEZA}".`, 400);
  }

  try {
    const reporte = await limpiarRiesgosLegados({ ejecutar: ejecutar === true, faltantesConfirmados, usuario: user.email });
    if (reporte.estado === 'limpiado') await notificarSemaforo();
    logger.info('[RIESGOS] Limpieza de copias antiguas', {
      estado: reporte.estado, usuario: user.email, faltantes: reporte.faltantesEnMatrizVigente?.length || 0,
    });
    return sendSuccess(res, reporte);
  } catch (error) {
    logger.error('[RIESGOS] Error en la limpieza', error, { usuario: user.email });
    return sendError(res, `No se borró nada: ${error.message}`, 500);
  }
}
