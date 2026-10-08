import { applyCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';
import { adminDb } from '../_lib/firebaseAdmin.js';

const ROLES_ADMIN = ['admin', 'administrador', 'auditor'];
const normalizar = valor => String(valor || '').trim().toLowerCase();

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'DELETE') return sendError(res, 'Método no permitido.', 405);

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const perfilSnap = await adminDb.collection('usuarios').doc(user.uid).get();
    const perfil = perfilSnap.exists ? perfilSnap.data() : {};
    if (!ROLES_ADMIN.includes(normalizar(perfil.rol))) {
      return sendError(res, 'Solo un administrador puede eliminar cargos del catálogo.', 403);
    }

    const id = String(req.body?.id || '').trim();
    if (!id) return sendError(res, 'Debe indicar la asignación que desea eliminar.', 400);

    const workspaceRef = adminDb.collection('workspace_compartido').doc('base_de_datos_grc');
    const resultado = await adminDb.runTransaction(async transaction => {
      const snapshot = await transaction.get(workspaceRef);
      if (!snapshot.exists) return { error: 'not-found' };

      const data = snapshot.data() || {};
      const cargos = Array.isArray(data.catalogoCargos) ? data.catalogoCargos : [];
      const cargoEliminado = cargos.find(registro => String(registro?.id) === id);
      if (!cargoEliminado) return { error: 'assignment-not-found' };

      const catalogoCargos = cargos.filter(registro => String(registro?.id) !== id);
      transaction.set(workspaceRef, { catalogoCargos }, { merge: true });
      return { catalogoCargos, cargoEliminado };
    });

    if (resultado.error === 'not-found') return sendError(res, 'No se encontró la base de datos GRC.', 404);
    if (resultado.error === 'assignment-not-found') return sendError(res, 'La asignación ya no existe en el catálogo.', 404);

    logger.info('Asignación de cargo eliminada del catálogo', {
      id,
      cargo: resultado.cargoEliminado.cargo,
      usuario: user.email,
    });
    return sendSuccess(res, { catalogoCargos: resultado.catalogoCargos });
  } catch (error) {
    logger.error('Error eliminando cargo del catálogo', error, { endpoint: req.url });
    return sendError(res, 'No se pudo eliminar la asignación del catálogo.', 500);
  }
}