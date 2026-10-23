// api/_grc/corregir-escala-riesgos.js - Convierte a porcentaje los valores inherentes registrados como nivel 1–5.
// Solo administradores. Por defecto SIMULA (no escribe nada). Ejecutar exige confirmación escrita.
import { applyCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';
import { notificarSemaforo } from '../_lib/semaforo.js';
import { corregirEscalaInherente } from '../_lib/grcWorkspace.js';

export const CONFIRMACION_CORRECCION_ESCALA = 'CORREGIR-ESCALA';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 'Método no permitido. Usa POST.', 405);

  const user = await requireAuth(req, res);
  if (!user) return;
  if (!['admin', 'administrador'].includes(String(user.rol || '').trim().toLowerCase())) {
    return sendError(res, 'Solo un administrador puede corregir la escala de los riesgos.', 403);
  }

  const { ejecutar = false, confirmacion = '' } = req.body || {};
  if (ejecutar === true && confirmacion !== CONFIRMACION_CORRECCION_ESCALA) {
    return sendError(res, `Para ejecutar la corrección envía confirmacion: "${CONFIRMACION_CORRECCION_ESCALA}".`, 400);
  }

  try {
    const reporte = await corregirEscalaInherente({ ejecutar: ejecutar === true, usuario: user.email });
    if (reporte.estado === 'corregido') await notificarSemaforo();
    logger.info('[RIESGOS] Corrección de escala inherente', {
      estado: reporte.estado, usuario: user.email, corregidos: reporte.riesgosCorregidos, cambianDeZona: reporte.cambianDeZona,
    });
    return sendSuccess(res, reporte);
  } catch (error) {
    logger.error('[RIESGOS] Error en la corrección de escala', error, { usuario: user.email });
    return sendError(res, `No se corrigió nada: ${error.message}`, 500);
  }
}
