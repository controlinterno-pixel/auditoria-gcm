// api/_grc/agrupar-colecciones.js - Etapa 2: copia planes, hallazgos e informes a pocos documentos agrupados.
// Solo administradores. Por defecto SIMULA (no escribe nada). Ejecutar exige confirmación escrita.
// No borra las subcolecciones ni los campos antiguos: quedan como respaldo hasta la limpieza.
import { applyCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';
import { notificarSemaforo } from '../_lib/semaforo.js';
import { agruparColecciones, COLECCIONES_AGRUPABLES } from '../_lib/coleccionesAgrupadas.js';

export const CONFIRMACION_AGRUPACION = 'AGRUPAR-COLECCIONES';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 'Método no permitido. Usa POST.', 405);

  const user = await requireAuth(req, res);
  if (!user) return;
  if (!['admin', 'administrador'].includes(String(user.rol || '').trim().toLowerCase())) {
    return sendError(res, 'Solo un administrador puede agrupar las colecciones.', 403);
  }

  const { ejecutar = false, confirmacion = '', colecciones = COLECCIONES_AGRUPABLES } = req.body || {};
  if (ejecutar === true && confirmacion !== CONFIRMACION_AGRUPACION) {
    return sendError(res, `Para ejecutar la agrupación envía confirmacion: "${CONFIRMACION_AGRUPACION}".`, 400);
  }
  if (!Array.isArray(colecciones) || colecciones.length === 0 || colecciones.some(coleccion => !COLECCIONES_AGRUPABLES.includes(coleccion))) {
    return sendError(res, `colecciones debe ser una lista con: ${COLECCIONES_AGRUPABLES.join(', ')}.`, 400);
  }

  try {
    const reporte = await agruparColecciones({ ejecutar: ejecutar === true, usuario: user.email, colecciones });
    // El semáforo también limpia la caché del servidor: todos recargan desde las partes.
    if (reporte.estado === 'agrupado') await notificarSemaforo();
    logger.info('[GRUPOS] Agrupación', { estado: reporte.estado, usuario: user.email, colecciones: Object.keys(reporte.colecciones) });
    return sendSuccess(res, reporte);
  } catch (error) {
    logger.error('[GRUPOS] Error en la agrupación', error, { usuario: user.email });
    return sendError(res, `No se agrupó nada: ${error.message}`, 500);
  }
}
