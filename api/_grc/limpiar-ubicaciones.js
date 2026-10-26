// api/_grc/limpiar-ubicaciones.js - Ajusta el macroproceso y subproceso de cada riesgo al catálogo de
// "Cargos y Procesos": lo que no existe en el catálogo queda en blanco para corregirlo a mano (el valor
// anterior queda en el riesgo y en su historial). Solo administradores. Por defecto SIMULA (no escribe nada).
// Ejecutar exige confirmación escrita.
import { applyCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';
import { notificarSemaforo } from '../_lib/semaforo.js';
import { limpiarUbicacionesRiesgos } from '../_lib/grcWorkspace.js';

export const CONFIRMACION_UBICACIONES = 'LIMPIAR-UBICACIONES';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 'Método no permitido. Usa POST.', 405);

  const user = await requireAuth(req, res);
  if (!user) return;
  if (!['admin', 'administrador'].includes(String(user.rol || '').trim().toLowerCase())) {
    return sendError(res, 'Solo un administrador puede ajustar las ubicaciones de los riesgos.', 403);
  }

  const { ejecutar = false, confirmacion = '' } = req.body || {};
  if (ejecutar === true && confirmacion !== CONFIRMACION_UBICACIONES) {
    return sendError(res, `Para ejecutar el ajuste envía confirmacion: "${CONFIRMACION_UBICACIONES}".`, 400);
  }

  try {
    const reporte = await limpiarUbicacionesRiesgos({ ejecutar: ejecutar === true, usuario: user.email });
    if (reporte.estado === 'limpiado') await notificarSemaforo();
    logger.info('[RIESGOS] Ubicaciones ajustadas al catálogo', {
      estado: reporte.estado, usuario: user.email, conCambios: reporte.riesgosConCambios, sinMacroproceso: reporte.riesgosQueQuedanSinMacroproceso,
    });
    return sendSuccess(res, reporte);
  } catch (error) {
    logger.error('[RIESGOS] Error al ajustar ubicaciones', error, { usuario: user.email });
    return sendError(res, `No se cambió nada: ${error.message}`, 500);
  }
}
