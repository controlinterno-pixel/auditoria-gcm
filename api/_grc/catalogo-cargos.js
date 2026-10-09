import { applyCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';
import { adminDb } from '../_lib/firebaseAdmin.js';

const ROLES_ADMIN = ['admin', 'administrador', 'auditor'];
const normalizar = valor => String(valor || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const subprocesosDelCargo = registro => (
  Array.isArray(registro?.subprocesos)
    ? registro.subprocesos
    : registro?.subproceso ? [registro.subproceso] : []
);

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'DELETE' && req.method !== 'POST') return sendError(res, 'Método no permitido.', 405);

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const perfilSnap = await adminDb.collection('usuarios').doc(user.uid).get();
    const perfil = perfilSnap.exists ? perfilSnap.data() : {};
    const esAdmin = ROLES_ADMIN.includes(normalizar(perfil.rol));

    if (req.method === 'POST') {
      const permisos = Array.isArray(perfil.permisos) ? perfil.permisos : [];
      if (!esAdmin && !permisos.includes('sub_informes')) {
        return sendError(res, 'No tiene permiso para consultar destinatarios de informes.', 403);
      }

      const solicitudes = req.body?.asignaciones;
      if (!Array.isArray(solicitudes) || solicitudes.length === 0 || solicitudes.length > 100) {
        return sendError(res, 'Debe indicar entre 1 y 100 cargos para consultar.', 400);
      }

      const snapshot = await adminDb.collection('workspace_compartido').doc('base_de_datos_grc').get();
      const catalogo = snapshot.exists && Array.isArray(snapshot.data()?.catalogoCargos)
        ? snapshot.data().catalogoCargos
        : [];
      const asignaciones = solicitudes.map(solicitud => {
        const cargo = String(solicitud?.cargo || '').trim();
        const macroproceso = normalizar(solicitud?.macroproceso);
        const subprocesos = Array.isArray(solicitud?.subprocesos)
          ? solicitud.subprocesos.map(normalizar)
          : [normalizar(solicitud?.subprocesos)];
        const candidatos = catalogo.filter(registro => (
          registro?.activo !== false &&
          normalizar(registro?.cargo) === normalizar(cargo) &&
          String(registro?.correoCorporativo || '').trim()
        ));
        const porMacroproceso = candidatos.filter(registro => normalizar(registro.macroproceso) === macroproceso);
        const asignacion = porMacroproceso.find(registro => (
          subprocesosDelCargo(registro).some(subproceso => subprocesos.includes(normalizar(subproceso)))
        )) || porMacroproceso[0] || candidatos[0];

        return {
          cargo,
          macroproceso: solicitud?.macroproceso || '',
          subprocesos: solicitud?.subprocesos || [],
          correoCorporativo: String(asignacion?.correoCorporativo || '').trim(),
        };
      });

      return sendSuccess(res, { asignaciones });
    }

    if (!esAdmin) {
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