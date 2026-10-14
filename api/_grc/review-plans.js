import { applyCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';
import { notificarSemaforo } from '../_lib/semaforo.js';
import { adminDb } from '../_lib/firebaseAdmin.js';
import { guardarInformesGrc, leerWorkspaceGrc } from '../_lib/grcWorkspace.js';

const ROLES_ADMIN = ['admin', 'administrador', 'auditor'];
const normalizar = valor => String(valor || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

function esAuditorAsignado(plan, user, perfil) {
  const correosAsignados = [plan?.correoAuditor, plan?.correoAuditorResponsable, plan?.correo_auditor]
    .map(normalizar)
    .filter(Boolean);
  if (correosAsignados.includes(normalizar(user.email))) return true;

  const auditorAsignado = normalizar(plan?.auditorAsignado || plan?.auditorResponsable || plan?.auditor);
  const identidadesUsuario = [perfil?.nombreResponsable, perfil?.nombre, perfil?.cargo]
    .map(normalizar)
    .filter(Boolean);
  return Boolean(auditorAsignado && identidadesUsuario.includes(auditorAsignado));
}

async function decidirComoAuditor(res, user, { idPlan, decision, motivo, evaluacionEficacia }) {
  const cerrar = decision === 'cerrar';
  const motivoSeguro = String(motivo || '').trim().slice(0, 2000);
  if (!idPlan) return sendError(res, 'Falta el plan a decidir.', 400);
  if (!cerrar && !motivoSeguro) return sendError(res, 'Escribe el motivo del rechazo de la evidencia.', 400);

  const perfilSnap = await adminDb.collection('usuarios').doc(user.uid).get();
  const perfil = perfilSnap.exists ? perfilSnap.data() : {};
  const admin = ROLES_ADMIN.includes(normalizar(perfil.rol));

  const resultado = await adminDb.runTransaction(async transaction => {
    const workspace = await leerWorkspaceGrc(transaction);
    if (!workspace.workspaceExists) return { error: 'not-found' };
    const { data, workspaceRef } = workspace;
    const planes = Array.isArray(data.planes) ? data.planes : [];
    const plan = planes.find(item => String(item.id) === String(idPlan));
    if (!plan) return { error: 'plan-not-found' };
    if (!admin && !esAuditorAsignado(plan, user, perfil)) return { error: 'not-auditor' };
    const enRevision = plan.estadoWorkflow === 'En Revisión (100%)' ||
      (plan.estadoWorkflow === 'En Ejecución' && Number(plan.progreso) >= 100);
    if (!enRevision) return { error: 'not-in-review' };

    const ahora = new Date();
    const evaluacion = evaluacionEficacia && typeof evaluacionEficacia === 'object' ? {
      fecha: ahora.toLocaleString('es-CO'),
      usuario: user.email,
      conclusion: String(evaluacionEficacia.conclusion || '').trim().slice(0, 2000),
      fueEficaz: cerrar,
      requiereAccionesAdicionales: Boolean(evaluacionEficacia.requiereAccionesAdicionales),
      observaciones: String(evaluacionEficacia.observaciones || '').trim().slice(0, 2000),
    } : null;
    const actualizado = {
      ...plan,
      estadoWorkflow: cerrar ? 'Cerrado' : 'En Ejecución',
      estado: cerrar ? 'Cerrado' : 'En Proceso',
      progreso: cerrar ? 100 : 90,
      ...(evaluacion ? { evaluacionEficaciaCierre: evaluacion } : {}),
      historialCambios: [...(Array.isArray(plan.historialCambios) ? plan.historialCambios : []), {
        fecha: ahora.toLocaleString('es-CO'),
        timestamp: ahora.toISOString(),
        usuario: user.email,
        accion: cerrar
          ? (evaluacion ? '✅ Eficacia confirmada. Acción cerrada.' : '✅ Evidencias aprobadas. Plan CERRADO.')
          : `❌ Evidencia rechazada. Motivo: ${motivoSeguro}`,
        ...(motivoSeguro ? { motivo: motivoSeguro } : {}),
      }],
    };
    if (workspace.tieneInformesLegados) guardarInformesGrc(transaction, workspace, data.informesAuditoria);
    transaction.set(workspaceRef, {
      planes: planes.map(item => String(item.id) === String(idPlan) ? actualizado : item),
    }, { merge: true });
    return { plan: actualizado };
  });

  const errores = {
    'not-found': ['No se encontró la matriz GRC.', 404],
    'plan-not-found': ['No se encontró el plan de acción.', 404],
    'not-auditor': ['Solo el auditor de seguimiento asignado puede decidir este plan.', 403],
    'not-in-review': ['El plan no está en revisión del auditor.', 409],
  };
  if (resultado.error && errores[resultado.error]) {
    const [mensaje, estado] = errores[resultado.error];
    return sendError(res, mensaje, estado);
  }

  await notificarSemaforo();
  logger.info('Decisión del auditor sobre plan', { idPlan, decision, usuario: user.email });
  return sendSuccess(res, { plan: resultado.plan });
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 'Método no permitido.', 405);

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { idInforme, idPlan, decision, motivo = '', evaluacionEficacia = null } = req.body || {};
    if (['cerrar', 'rechazar'].includes(decision)) {
      return await decidirComoAuditor(res, user, { idPlan, decision, motivo, evaluacionEficacia });
    }
    if (!idInforme || !['aprobar', 'corregir'].includes(decision)) {
      return sendError(res, 'La decisión de revisión no es válida.', 400);
    }
    const motivoSeguro = String(motivo || '').trim().slice(0, 2000);
    if (decision === 'corregir' && !motivoSeguro) {
      return sendError(res, 'Escribe el motivo de la corrección solicitada.', 400);
    }

    const perfilSnap = await adminDb.collection('usuarios').doc(user.uid).get();
    const perfil = perfilSnap.exists ? perfilSnap.data() : {};
    const admin = ROLES_ADMIN.includes(normalizar(perfil.rol));
    const permisos = Array.isArray(perfil.permisos) ? perfil.permisos : [];
    if (!admin && !permisos.includes('sub_seguimiento_planes')) {
      return sendError(res, 'No tiene permiso para revisar planes de acción.', 403);
    }

    const resultado = await adminDb.runTransaction(async transaction => {
      const workspace = await leerWorkspaceGrc(transaction);
      const { data, workspaceRef } = workspace;
      const planes = Array.isArray(data.planes) ? data.planes : [];
      const hallazgos = Array.isArray(data.hallazgos) ? data.hallazgos : [];
      let informeExiste = (Array.isArray(data.informesAuditoria) ? data.informesAuditoria : [])
        .some(informe => String(informe.id) === String(idInforme));
      if (!informeExiste) {
        // Los informes nuevos viven en una subcolección que la transacción no lista.
        const informeSnapshot = await transaction.get(
          workspace.coleccionInformesRef.doc(String(idInforme).trim())
        );
        informeExiste = informeSnapshot.exists;
      }
      if (!informeExiste) return { error: 'report-not-found' };

      const pendientes = planes.filter(plan => {
        if (plan.estadoWorkflow !== 'Pendiente Revisión Jefatura') return false;
        const hallazgo = hallazgos.find(item => String(item.id) === String(plan.idHallazgo));
        const planInformeId = plan.idInforme || hallazgo?.idInforme;
        if (String(planInformeId) !== String(idInforme)) return false;
        return admin || normalizar(plan.correoRevisor) === normalizar(user.email);
      });
      if (pendientes.length === 0) return { error: 'no-pending-plans' };

      const ahora = new Date();
      const actualizados = pendientes.map(plan => {
        const aprobado = decision === 'aprobar';
        const evento = {
          fecha: ahora.toLocaleString('es-CO'),
          timestamp: ahora.toISOString(),
          usuario: user.email,
          accion: aprobado ? 'Diseño aprobado por el revisor' : 'Corrección solicitada por el revisor',
          ...(motivoSeguro ? { motivo: motivoSeguro } : {}),
        };
        return {
          ...plan,
          estadoWorkflow: aprobado
            ? (Number(plan.progreso) >= 100 ? 'En Revisión (100%)' : 'En Ejecución')
            : 'Borrador',
          estado: 'En Proceso',
          ...(aprobado
            ? { aprobadoPorCorreo: user.email, aprobadoEn: ahora.toISOString(), motivoRechazo: '' }
            : { aprobadoPorCorreo: '', motivoRechazo: motivoSeguro }),
          historialCambios: [...(Array.isArray(plan.historialCambios) ? plan.historialCambios : []), evento],
        };
      });
      const porId = new Map(actualizados.map(plan => [String(plan.id), plan]));
      if (workspace.tieneInformesLegados) guardarInformesGrc(transaction, workspace, data.informesAuditoria);
      transaction.set(workspaceRef, {
        planes: planes.map(plan => porId.get(String(plan.id)) || plan),
      }, { merge: true });
      return { planes: actualizados };
    });

    const errores = {
      'not-found': ['No se encontró la matriz GRC.', 404],
      'report-not-found': ['No se encontró el informe seleccionado.', 404],
      'no-pending-plans': ['No hay planes pendientes asignados a este aprobador para el informe.', 409],
    };
    if (resultado.error && errores[resultado.error]) {
      const [mensaje, estado] = errores[resultado.error];
      return sendError(res, mensaje, estado);
    }

    await notificarSemaforo();
    logger.info('Revisión de planes completada', { idInforme, decision, cantidad: resultado.planes.length, usuario: user.email });
    return sendSuccess(res, { planes: resultado.planes });
  } catch (error) {
    logger.error('Error al revisar planes de acción', error, { endpoint: req.url });
    return sendError(res, 'No se pudo guardar la decisión de revisión.', 500);
  }
}