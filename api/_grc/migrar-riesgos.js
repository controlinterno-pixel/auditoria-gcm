// api/_grc/migrar-riesgos.js - Fase 3: copia la matriz de riesgos a sus documentos propios.
// Solo administradores. Por defecto SIMULA (no escribe nada). Ejecutar exige confirmación escrita.
// No borra el campo original `riesgos` ni la colección raíz `riesgos`: quedan como respaldo.
import { applyCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';
import { notificarSemaforo } from '../_lib/semaforo.js';
import { migrarRiesgos } from '../_lib/grcWorkspace.js';

export const CONFIRMACION_MIGRACION = 'MIGRAR-RIESGOS';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 'Método no permitido. Usa POST.', 405);

  const user = await requireAuth(req, res);
  if (!user) return;
  if (!['admin', 'administrador'].includes(String(user.rol || '').trim().toLowerCase())) {
    return sendError(res, 'Solo un administrador puede migrar la matriz de riesgos.', 403);
  }

  const { ejecutar = false, confirmacion = '' } = req.body || {};
  if (ejecutar === true && confirmacion !== CONFIRMACION_MIGRACION) {
    return sendError(res, `Para ejecutar la migración envía confirmacion: "${CONFIRMACION_MIGRACION}".`, 400);
  }

  try {
    const reporte = await migrarRiesgos({ ejecutar: ejecutar === true, usuario: user.email });
    if (reporte.estado === 'migrado') await notificarSemaforo();
    logger.info('[RIESGOS] Migración', {
      estado: reporte.estado, usuario: user.email,
      migrados: reporte.riesgosMigrados, decisiones: reporte.decisiones?.length || 0,
    });
    return sendSuccess(res, reporte);
  } catch (error) {
    logger.error('[RIESGOS] Error en la migración', error, { usuario: user.email });
    return sendError(res, `No se migró nada: ${error.message}`, 500);
  }
}
