// api/_grc/limpiar-colecciones.js - Etapa 4: borra las copias antiguas de planes, hallazgos e informes.
// Solo administradores. Por defecto SIMULA (no borra nada). Ejecutar exige confirmación escrita.
import { applyCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';
import { notificarSemaforo } from '../_lib/semaforo.js';
import { COLECCIONES_AGRUPABLES, limpiarColeccionesLegadas } from '../_lib/coleccionesAgrupadas.js';

export const CONFIRMACION_LIMPIEZA_COLECCIONES = 'LIMPIAR-COLECCIONES';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 'Método no permitido. Usa POST.', 405);

  const user = await requireAuth(req, res);
  if (!user) return;
  if (!['admin', 'administrador'].includes(String(user.rol || '').trim().toLowerCase())) {
    return sendError(res, 'Solo un administrador puede limpiar las copias antiguas.', 403);
  }

  const { ejecutar = false, confirmacion = '', colecciones = COLECCIONES_AGRUPABLES, faltantesConfirmados = {} } = req.body || {};
  if (ejecutar === true && confirmacion !== CONFIRMACION_LIMPIEZA_COLECCIONES) {
    return sendError(res, `Para ejecutar la limpieza envía confirmacion: "${CONFIRMACION_LIMPIEZA_COLECCIONES}".`, 400);
  }
  if (!Array.isArray(colecciones) || colecciones.length === 0 || colecciones.some(coleccion => !COLECCIONES_AGRUPABLES.includes(coleccion))) {
    return sendError(res, `colecciones debe ser una lista con: ${COLECCIONES_AGRUPABLES.join(', ')}.`, 400);
  }
  if (!faltantesConfirmados || typeof faltantesConfirmados !== 'object' || Array.isArray(faltantesConfirmados)) {
    return sendError(res, 'faltantesConfirmados debe ser un objeto { coleccion: [ids] }.', 400);
  }

  try {
    const reporte = await limpiarColeccionesLegadas({ ejecutar: ejecutar === true, colecciones, faltantesConfirmados, usuario: user.email });
    if (reporte.estado === 'limpiado') await notificarSemaforo();
    logger.info('[GRUPOS] Limpieza de copias antiguas', {
      estado: reporte.estado, usuario: user.email,
      colecciones: Object.fromEntries(Object.entries(reporte.colecciones).map(([coleccion, valor]) => [coleccion, valor.estado])),
    });
    return sendSuccess(res, reporte);
  } catch (error) {
    logger.error('[GRUPOS] Error en la limpieza', error, { usuario: user.email });
    return sendError(res, `No se borró nada: ${error.message}`, 500);
  }
}
