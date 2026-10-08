import { applyCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';
import { adminDb } from '../_lib/firebaseAdmin.js';
import { guardarInformesGrc, leerWorkspaceGrc } from '../_lib/grcWorkspace.js';

const esAdministrador = (rol) => ['admin', 'administrador', 'auditor'].includes(
  String(rol || '').toLowerCase().trim()
);

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 'Método no permitido.', 405);

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { id, destinatarios, fechaCorreoEnviado } = req.body || {};
    if (!id || typeof destinatarios !== 'string' || !destinatarios.trim() || !fechaCorreoEnviado) {
      return sendError(res, 'Los datos de envío del informe están incompletos.', 400);
    }

    const perfilSnap = await adminDb.collection('usuarios').doc(user.uid).get();
    const perfil = perfilSnap.exists ? perfilSnap.data() : {};
    const admin = esAdministrador(perfil.rol);
    const permisos = Array.isArray(perfil.permisos) ? perfil.permisos : [];
    if (!admin && !permisos.includes('sub_informes')) {
      return sendError(res, 'No tiene permiso para registrar el envío de informes.', 403);
    }
    const procesoAsignado = String(perfil.procesoAsignado || '').trim().toLowerCase();
    const subprocesoAsignado = String(perfil.subprocesoAsignado || '').trim().toLowerCase();

    const informeActualizado = await adminDb.runTransaction(async (transaction) => {
      const workspace = await leerWorkspaceGrc(transaction);
      const { data } = workspace;
      const informes = Array.isArray(data.informesAuditoria) ? data.informesAuditoria : [];
      const informe = informes.find(item => String(item.id) === String(id));
      const procesoInforme = String(informe?.macroproceso || String(informe?.proceso || '').split('/')[0]).trim().toLowerCase();
      const subprocesosInforme = (
        Array.isArray(informe?.subprocesos) ? informe.subprocesos : [informe?.subproceso]
      ).map(subproceso => String(subproceso || '').trim().toLowerCase());
      if (!informe || (!admin && (
        (procesoAsignado && procesoInforme !== procesoAsignado) ||
        (subprocesoAsignado && !subprocesosInforme.includes(subprocesoAsignado))
      ))) {
        return null;
      }

      const actualizado = { ...informe, correoEnviadoA: destinatarios.trim(), fechaCorreoEnviado };
      guardarInformesGrc(
        transaction,
        workspace,
        informes.map(item => String(item.id) === String(id) ? actualizado : item)
      );
      return actualizado;
    });

    if (!informeActualizado) return sendError(res, 'No se encontró el informe o no tiene permiso para actualizarlo.', 404);
    logger.info('Envío del informe registrado', { id, usuario: user.email });
    return sendSuccess(res, { informe: informeActualizado });
  } catch (error) {
    logger.error('Error registrando envío de informe', error, { endpoint: req.url });
    return sendError(res, 'No se pudo registrar el envío del informe.', 500);
  }
}