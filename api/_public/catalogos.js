import { applyCors } from '../_lib/cors.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { adminDb } from '../_lib/firebaseAdmin.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return sendError(res, 'Método no permitido.', 405);

  try {
    const snapshot = await adminDb.collection('workspace_compartido').doc('base_de_datos_grc').get();
    const data = snapshot.exists ? snapshot.data() || {} : {};
    const catalogosInicializados = data.catalogosInicializados === true;
    const cargos = catalogosInicializados
      ? [...new Set((Array.isArray(data.catalogoCargos) ? data.catalogoCargos : [])
        .filter(registro => registro?.activo !== false)
        .map(registro => String(registro?.cargo || '').trim())
        .filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'es'))
      : [];
    const mapaProcesos = catalogosInicializados && data.mapaProcesos && typeof data.mapaProcesos === 'object'
      ? data.mapaProcesos
      : {};

    return sendSuccess(res, { catalogosInicializados, cargos, mapaProcesos });
  } catch (error) {
    console.error('Error leyendo catálogo público de registro:', error);
    return sendError(res, 'No fue posible cargar las opciones de registro.', 500);
  }
}