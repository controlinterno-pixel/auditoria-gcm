import { applyCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';
import { adminDb } from '../_lib/firebaseAdmin.js';

const CAMPOS_EDITABLES = [
  'titulo', 'proceso', 'macroproceso', 'subproceso', 'programaId',
  'tipoFuente', 'detalleFuente', 'fecha', 'elaboradoPor', 'revisadoPor',
  'aprobadoPor', 'auditorResponsable', 'auditor', 'correoAuditor',
  'correoAuditorResponsable', 'socializado', 'fechaSocializacion',
  'fecha_socializacion', 'socializadoCon', 'participantes', 'evidenciaUrl',
  'actaSocializacionUrl', 'anexos', 'anexosMultiples', 'correoEnviadoA',
];

const ROLES_ADMIN = ['admin', 'administrador', 'auditor'];
const normalizar = valor => String(valor || '').trim().toLowerCase();

const obtenerProceso = registro => normalizar(
  registro?.macroproceso || String(registro?.proceso || '').split('/')[0]
);

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'PUT') return sendError(res, 'Método no permitido.', 405);

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { coleccion, id, registro, motivo = '' } = req.body || {};
    if (coleccion !== 'informesAuditoria' || !id) {
      return sendError(res, 'El informe indicado no es válido.', 400);
    }
    if (!registro || typeof registro !== 'object' || Array.isArray(registro)) {
      return sendError(res, 'Los cambios enviados no son válidos.', 400);
    }
    if (JSON.stringify(registro).length > 500000) {
      return sendError(res, 'Los cambios exceden el tamaño permitido.', 413);
    }

    const perfilSnap = await adminDb.collection('usuarios').doc(user.uid).get();
    const perfil = perfilSnap.exists ? perfilSnap.data() : {};
    const esAdmin = ROLES_ADMIN.includes(normalizar(perfil.rol));
    const permisos = Array.isArray(perfil.permisos) ? perfil.permisos : [];
    if (!esAdmin && !permisos.includes('sub_informes')) {
      return sendError(res, 'No tiene permiso para editar informes.', 403);
    }

    const procesoAsignado = normalizar(perfil.procesoAsignado || user.procesoAsignado);
    const subprocesoAsignado = normalizar(perfil.subprocesoAsignado);
    if (!esAdmin && !procesoAsignado) {
      return sendError(res, 'Debe tener un proceso asignado para editar informes.', 403);
    }

    const cambios = Object.fromEntries(
      CAMPOS_EDITABLES.filter(campo => Object.hasOwn(registro, campo))
        .map(campo => [campo, registro[campo]])
    );
    const nuevoRegistro = { ...registro, ...cambios };
    if (!normalizar(nuevoRegistro.titulo) || !obtenerProceso(nuevoRegistro)) {
      return sendError(res, 'El título y el proceso son obligatorios.', 400);
    }
    if (!esAdmin && obtenerProceso(nuevoRegistro) !== procesoAsignado) {
      return sendError(res, 'Solo puede editar informes de su proceso asignado.', 403);
    }
    if (subprocesoAsignado && normalizar(nuevoRegistro.subproceso) !== subprocesoAsignado) {
      return sendError(res, 'Solo puede editar informes de su subproceso asignado.', 403);
    }

    const workspaceRef = adminDb.collection('workspace_compartido').doc('base_de_datos_grc');
    const resultado = await adminDb.runTransaction(async transaction => {
      const snapshot = await transaction.get(workspaceRef);
      if (!snapshot.exists) return { error: 'not-found' };

      const data = snapshot.data() || {};
      const informes = Array.isArray(data.informesAuditoria) ? data.informesAuditoria : [];
      const informeAnterior = informes.find(item => String(item.id) === String(id));
      if (!informeAnterior) return { error: 'not-found' };

      if (!esAdmin && (
        obtenerProceso(informeAnterior) !== procesoAsignado ||
        (subprocesoAsignado && normalizar(informeAnterior.subproceso) !== subprocesoAsignado)
      )) {
        return { error: 'forbidden' };
      }

      const camposCambiados = Object.keys(cambios).filter(campo => (
        JSON.stringify(informeAnterior[campo] ?? null) !== JSON.stringify(cambios[campo] ?? null)
      ));
      const historial = Array.isArray(informeAnterior.historialCambios) ? informeAnterior.historialCambios : [];
      const ahora = new Date();
      const motivoSeguro = String(motivo || '').trim().slice(0, 500);
      const informeActualizado = {
        ...informeAnterior,
        ...cambios,
        id: informeAnterior.id,
        ref: informeAnterior.ref,
        historialCambios: camposCambiados.length === 0 ? historial : [
          ...historial,
          {
            fecha: ahora.toLocaleString('es-CO'),
            timestamp: ahora.toISOString(),
            usuario: user.email,
            accion: motivoSeguro ? `Actualización del informe — ${motivoSeguro}` : 'Actualización del informe',
            motivo: motivoSeguro || 'Actualización del registro',
            version: historial.length + 1,
            detalle: Object.fromEntries(camposCambiados.map(campo => [campo, {
              anterior: informeAnterior[campo] ?? null,
              actual: cambios[campo] ?? null,
            }])),
          },
        ],
      };

      transaction.set(workspaceRef, {
        informesAuditoria: informes.map(item => String(item.id) === String(id) ? informeActualizado : item),
      }, { merge: true });
      return { informe: informeActualizado };
    });

    if (resultado.error === 'not-found') return sendError(res, 'No se encontró el informe.', 404);
    if (resultado.error === 'forbidden') return sendError(res, 'No tiene permiso para editar este informe.', 403);

    logger.info('Informe actualizado con permiso de módulo', { id, usuario: user.email });
    return sendSuccess(res, { registro: resultado.informe });
  } catch (error) {
    logger.error('Error actualizando informe GRC', error, { endpoint: req.url });
    return sendError(res, 'No se pudo actualizar el informe.', 500);
  }
}