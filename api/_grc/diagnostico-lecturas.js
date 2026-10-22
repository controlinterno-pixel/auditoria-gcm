// api/_grc/diagnostico-lecturas.js - Etapa 0 de la agrupación: diagnóstico de SOLO LECTURA.
// Solo administradores. No escribe nada ni avisa al semáforo.
import { applyCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';
import { diagnosticarLecturas } from '../_lib/diagnosticoLecturas.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 'Método no permitido. Usa POST.', 405);

  const user = await requireAuth(req, res);
  if (!user) return;
  if (!['admin', 'administrador'].includes(String(user.rol || '').trim().toLowerCase())) {
    return sendError(res, 'Solo un administrador puede ejecutar el diagnóstico de lecturas.', 403);
  }

  try {
    const reporte = await diagnosticarLecturas();
    logger.info('[LECTURAS] Diagnóstico', {
      usuario: user.email,
      actual: reporte.proyeccion.lecturasPorCargaActual,
      propuesta: reporte.proyeccion.lecturasPorCargaPropuesta,
    });
    return sendSuccess(res, reporte);
  } catch (error) {
    logger.error('[LECTURAS] Error en el diagnóstico', error, { usuario: user.email });
    return sendError(res, `No se pudo completar el diagnóstico: ${error.message}`, 500);
  }
}
