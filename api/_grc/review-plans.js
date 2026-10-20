import { applyCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';
import { notificarSemaforo } from '../_lib/semaforo.js';
import { adminDb } from '../_lib/firebaseAdmin.js';
import { guardarInformesGrc, guardarPlanesGrc, leerWorkspaceGrc } from '../_lib/grcWorkspace.js';
import { esInformePrograma, pendienteEvaluacionInicial, calcularPuntajeDiseno, ESTADO_AJUSTES_INICIALES, TIPO_EVALUACION_INICIAL } from '../../src/utils/programPlanWorkflow.js';

const ROLES_ADMIN = ['admin', 'administrador', 'auditor'];
const ESTADO_VALIDACION_REVISOR = 'Pendiente Validación Revisor';
const normalizar = valor => String(valor || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

function esAuditorAsignado(plan, user, perfil) {
  const correosAsignados = [plan?.correoAuditor, plan?.correoAuditorResponsable, plan?.correo_auditor]
    .map(normalizar)
    .filter(Boolean);
  if (correosAsignados.length > 0) return correosAsignados.includes(normalizar(user.email));

  const auditorAsignado = normalizar(plan?.auditorAsignado || plan?.auditorResponsable || plan?.auditor);
  const identidadesUsuario = [perfil?.nombreResponsable, perfil?.nombre, perfil?.cargo]
    .map(normalizar)
    .filter(Boolean);
  return Boolean(auditorAsignado && identidadesUsuario.includes(auditorAsignado));
}

async function evaluarDiseno(res, user, { idInforme, idsPlanes, criterios, justificacion }) {
  let puntaje;
  try {
    puntaje = calcularPuntajeDiseno(criterios);
  } catch (error) {
    return sendError(res, error.message, 400);
  }
  const motivo = String(justificacion || '').trim().slice(0, 2000);
  if (!idInforme || !Array.isArray(idsPlanes) || !idsPlanes.length || idsPlanes.length > 100 ||
      new Set(idsPlanes.map(String)).size !== idsPlanes.length) {
    return sendError(res, 'Selecciona entre 1 y 100 acciones distintas del informe.', 400);
  }
  if (puntaje < 80 && !motivo) return sendError(res, 'Justifica el resultado inferior al 80%.', 400);
  const perfilSnap = await adminDb.collection('usuarios').doc(user.uid).get();
  const perfil = perfilSnap.exists ? perfilSnap.data() : {};
  const resultado = await adminDb.runTransaction(async transaction => {
    const workspace = await leerWorkspaceGrc(transaction);
    if (!workspace.workspaceExists) return { error: 'not-found' };
    const { data } = workspace;
    let informe = (data.informesAuditoria || []).find(item => String(item.id) === String(idInforme));
    if (!informe) {
      const snap = await transaction.get(workspace.coleccionInformesRef.doc(String(idInforme).trim()));
      if (snap.exists) informe = { id: idInforme, ...snap.data() };
    }
    if (!esInformePrograma(informe, data.fuentesMejora)) return { error: 'not-program' };
    const planes = Array.isArray(data.planes) ? data.planes : [];
    const hallazgos = Array.isArray(data.hallazgos) ? data.hallazgos : [];
    const seleccionados = idsPlanes.map(id => planes.find(plan => String(plan.id) === String(id)));
    if (seleccionados.some(plan => {
      const hallazgo = hallazgos.find(item => String(item.id) === String(plan?.idHallazgo));
      return !plan || String(hallazgo?.idInforme || plan.idInforme) !== String(idInforme);
    })) return { error: 'invalid-selection' };
    if (seleccionados.some(plan => !esAuditorAsignado({
      ...plan,
      correoAuditor: plan.correoAuditor || informe.correoAuditor || informe.correoAuditorResponsable,
      auditorAsignado: plan.auditorAsignado || informe.auditorResponsable || informe.auditor,
    }, user, perfil) ||
        String(plan.correoResponsable || '').split(',').map(normalizar).includes(normalizar(user.email)))) {
      return { error: 'not-auditor' };
    }
    if (seleccionados.some(plan => !pendienteEvaluacionInicial(plan))) return { error: 'not-pending' };
    const ahora = new Date();
    const aprobado = puntaje >= 80;
    const evaluacion = {
      tipo: TIPO_EVALUACION_INICIAL, fecha: ahora.toLocaleString('es-CO'), timestamp: ahora.toISOString(),
      usuario: user.email, puntaje, aprobado, criterios, justificacion: motivo,
    };
    const actualizados = seleccionados.map(plan => ({
      ...plan,
      evaluacionHolistica: evaluacion,
      historialEvaluaciones: [evaluacion, ...(plan.historialEvaluaciones || (plan.evaluacionHolistica ? [plan.evaluacionHolistica] : []))],
      estadoWorkflow: aprobado ? 'En Ejecución' : ESTADO_AJUSTES_INICIALES,
      estado: 'En Proceso',
      aprobadoPorCorreo: aprobado ? user.email : '',
      aprobadoEn: aprobado ? ahora.toISOString() : '',
      motivoRechazo: aprobado ? '' : motivo,
      historialCambios: [...(plan.historialCambios || []), {
        fecha: evaluacion.fecha, timestamp: evaluacion.timestamp, usuario: user.email,
        accion: aprobado
          ? `Diseño aprobado (${puntaje}%). Ejecución habilitada por el auditor asignado.`
          : `Diseño no aprobado (${puntaje}%). Devuelto para correcciones. Motivo: ${motivo}`,
      }],
    }));
    if (workspace.tieneInformesLegados) guardarInformesGrc(transaction, workspace, data.informesAuditoria);
    guardarPlanesGrc(transaction, workspace, actualizados);
    return { planes: actualizados };
  });
  const errores = {
    'not-found': ['No se encontró la matriz GRC.', 404],
    'not-program': ['La evaluación inicial corresponde únicamente a fuentes Programa de Auditoría.', 409],
    'invalid-selection': ['Las acciones no pertenecen al informe seleccionado.', 400],
    'not-auditor': ['Solo el auditor asignado, distinto del ejecutor, puede evaluar estas acciones.', 403],
    'not-pending': ['Las acciones ya no están pendientes de evaluación inicial. Actualiza la vista.', 409],
  };
  if (resultado.error) return sendError(res, ...errores[resultado.error]);
  await notificarSemaforo();
  logger.info('Evaluación inicial de acciones', { idInforme, puntaje, usuario: user.email });
  return sendSuccess(res, resultado);
}

async function decidirComoAuditor(res, user, { idPlan, idInforme, idsPlanes, alcance, decision, motivo, evaluacionEficacia }) {
  const cerrar = decision === 'cerrar';
  const conjunta = alcance === 'todas';
  const seleccion = conjunta ? idsPlanes : [idPlan];
  const motivoSeguro = String(motivo || '').trim().slice(0, 2000);
  if (!Array.isArray(seleccion) || !seleccion.length || seleccion.length > 100 ||
      seleccion.some(id => !['string', 'number'].includes(typeof id) || !String(id).trim() || String(id).includes('/')) ||
      new Set(seleccion.map(String)).size !== seleccion.length || (conjunta && !idInforme)) {
    return sendError(res, 'Selecciona entre 1 y 100 acciones distintas de un informe.', 400);
  }
  if (!cerrar && !motivoSeguro) return sendError(res, 'Escribe el motivo del rechazo de la evidencia.', 400);
  if ((conjunta || evaluacionEficacia !== null) && (
    !evaluacionEficacia || typeof evaluacionEficacia !== 'object' ||
    !String(evaluacionEficacia.conclusion || '').trim()
  )) return sendError(res, 'Escribe la conclusión de la evaluación de eficacia.', 400);

  const perfilSnap = await adminDb.collection('usuarios').doc(user.uid).get();
  const perfil = perfilSnap.exists ? perfilSnap.data() : {};

  const resultado = await adminDb.runTransaction(async transaction => {
    const workspace = await leerWorkspaceGrc(transaction);
    if (!workspace.workspaceExists) return { error: 'not-found' };
    const { data } = workspace;
    const planes = Array.isArray(data.planes) ? data.planes : [];
    const seleccionados = seleccion.map(id => planes.find(item => String(item.id) === String(id)));
    if (seleccionados.some(plan => !plan)) return { error: 'plan-not-found' };
    const hallazgos = Array.isArray(data.hallazgos) ? data.hallazgos : [];
    const informeDePlan = plan => hallazgos.find(item => String(item.id) === String(plan.idHallazgo))?.idInforme || plan.idInforme;
    const idInformePlan = informeDePlan(seleccionados[0]);
    if (conjunta && (String(idInformePlan) !== String(idInforme) ||
        seleccionados.some(plan => String(informeDePlan(plan)) !== String(idInforme)))) return { error: 'invalid-selection' };
    let informePlan = (Array.isArray(data.informesAuditoria) ? data.informesAuditoria : [])
      .find(item => String(item.id) === String(idInformePlan));
    if (!informePlan && idInformePlan) {
      const informeSnapshot = await transaction.get(
        workspace.coleccionInformesRef.doc(String(idInformePlan).trim())
      );
      if (informeSnapshot.exists) informePlan = { id: idInformePlan, ...informeSnapshot.data() };
    }
    if (!informePlan) return { error: 'report-not-found' };
    const esPrograma = esInformePrograma(informePlan, data.fuentesMejora);
    if (seleccionados.some(plan => !esAuditorAsignado({
      ...plan,
      correoAuditor: plan.correoAuditor || plan.correoAuditorResponsable || plan.correo_auditor ||
        informePlan.correoAuditor || informePlan.correoAuditorResponsable || informePlan.correo_auditor,
      auditorAsignado: plan.auditorAsignado || plan.auditorResponsable || plan.auditor ||
        informePlan.auditorResponsable || informePlan.auditor,
    }, user, perfil) || String(plan.correoResponsable || '').split(',').map(normalizar).includes(normalizar(user.email)))) {
      return { error: 'not-auditor' };
    }
    if (seleccionados.some(plan => Number(plan.progreso) !== 100 ||
        !(plan.estadoWorkflow === 'En Revisión (100%)' || (!esPrograma && plan.estadoWorkflow === 'En Ejecución')))) {
      return { error: 'not-in-review' };
    }
    if (conjunta) {
      const abiertasInforme = planes.filter(plan => String(informeDePlan(plan)) === String(idInforme) &&
        !(plan.estadoWorkflow === 'Cerrado' || (!plan.estadoWorkflow && plan.estado === 'Cerrado')));
      if (abiertasInforme.length !== seleccion.length ||
          abiertasInforme.some(plan => !seleccion.some(id => String(id) === String(plan.id)))) return { error: 'incomplete-report' };
    }

    const ahora = new Date();
    const evaluacion = evaluacionEficacia && typeof evaluacionEficacia === 'object' ? {
      fecha: ahora.toLocaleString('es-CO'),
      timestamp: ahora.toISOString(),
      usuario: user.email,
      alcance: conjunta ? 'todas' : 'accion',
      conclusion: String(evaluacionEficacia.conclusion || '').trim().slice(0, 2000),
      fueEficaz: cerrar,
      requiereAccionesAdicionales: Boolean(evaluacionEficacia.requiereAccionesAdicionales),
      observaciones: String(evaluacionEficacia.observaciones || '').trim().slice(0, 2000),
    } : null;
    const actualizados = seleccionados.map(plan => ({
      ...plan,
      estadoWorkflow: cerrar ? 'Cerrado' : 'En Ejecución',
      estado: cerrar ? 'Cerrado' : 'En Proceso',
      progreso: cerrar ? 100 : 90,
      ...(!cerrar ? { validadoPorRevisorCorreo: '', validadoPorRevisorEn: '' } : { fechaCierre: ahora.toISOString().slice(0, 10) }),
      ...(evaluacion ? { evaluacionEficaciaCierre: evaluacion } : {}),
      ...(evaluacion ? { historialEficacia: [...(Array.isArray(plan.historialEficacia) ? plan.historialEficacia : plan.evaluacionEficaciaCierre ? [plan.evaluacionEficaciaCierre] : []), evaluacion] } : {}),
      historialCambios: [...(Array.isArray(plan.historialCambios) ? plan.historialCambios : []), {
        fecha: ahora.toLocaleString('es-CO'),
        timestamp: ahora.toISOString(),
        usuario: user.email,
        accion: cerrar
          ? (evaluacion ? '✅ Eficacia confirmada. Acción cerrada.' : '✅ Evidencias aprobadas. Plan CERRADO.')
          : `❌ Evidencia rechazada. Motivo: ${motivoSeguro}`,
        ...(motivoSeguro ? { motivo: motivoSeguro } : {}),
      }],
    }));
    const porId = new Map(actualizados.map(plan => [String(plan.id), plan]));
    const planesActualizados = planes.map(item => porId.get(String(item.id)) || item);
    const idsHallazgos = new Set(seleccionados.map(plan => String(plan.idHallazgo)));
    const hallazgosCerrados = esPrograma && cerrar ? hallazgos.filter(hallazgo => idsHallazgos.has(String(hallazgo.id)) &&
      planesActualizados.filter(plan => String(plan.idHallazgo) === String(hallazgo.id)).every(plan => plan.estadoWorkflow === 'Cerrado')
    ).map(hallazgo => ({
      ...hallazgo, estado: 'Cerrado',
      historialCambios: [...(Array.isArray(hallazgo.historialCambios) ? hallazgo.historialCambios : []), {
        fecha: ahora.toLocaleString('es-CO'), usuario: user.email, accion: 'Hallazgo cerrado: todas sus acciones fueron aprobadas por el auditor asignado.',
      }],
    })) : [];
    if (workspace.tieneInformesLegados) guardarInformesGrc(transaction, workspace, data.informesAuditoria);
    guardarPlanesGrc(transaction, workspace, actualizados);
    hallazgosCerrados.forEach(hallazgo => transaction.set(workspace.coleccionHallazgosRef.doc(String(hallazgo.id)), hallazgo));
    return {
      planes: actualizados, hallazgos: hallazgosCerrados,
      ...(!conjunta ? { plan: actualizados[0], ...(hallazgosCerrados[0] ? { hallazgo: hallazgosCerrados[0] } : {}) } : {}),
    };
  });

  const errores = {
    'not-found': ['No se encontró la matriz GRC.', 404],
    'plan-not-found': ['No se encontró el plan de acción.', 404],
    'not-auditor': ['Solo el auditor de seguimiento asignado puede decidir este plan.', 403],
    'not-in-review': ['El plan no está en revisión del auditor.', 409],
    'report-not-found': ['No se encontró el informe de origen de la acción.', 404],
    'invalid-selection': ['Las acciones deben pertenecer al informe seleccionado.', 400],
    'incomplete-report': ['Para evaluar todas, todas las acciones pendientes del informe deben estar listas para cierre. Actualiza la vista.', 409],
  };
  if (resultado.error && errores[resultado.error]) {
    const [mensaje, estado] = errores[resultado.error];
    return sendError(res, mensaje, estado);
  }

  await notificarSemaforo();
  logger.info('Decisión del auditor sobre plan', { idPlan, decision, usuario: user.email });
  return sendSuccess(res, resultado);
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 'Método no permitido.', 405);

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { idInforme, idPlan, idsPlanes, alcance, decision, motivo = '', evaluacionEficacia = null } = req.body || {};
    if (decision === 'evaluar-diseno') return await evaluarDiseno(res, user, req.body);
    if (['cerrar', 'rechazar'].includes(decision)) {
      return await decidirComoAuditor(res, user, { idPlan, idInforme, idsPlanes, alcance, decision, motivo, evaluacionEficacia });
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
      const { data } = workspace;
      const planes = Array.isArray(data.planes) ? data.planes : [];
      const hallazgos = Array.isArray(data.hallazgos) ? data.hallazgos : [];
      let informeActual = (Array.isArray(data.informesAuditoria) ? data.informesAuditoria : [])
        .find(informe => String(informe.id) === String(idInforme));
      if (!informeActual) {
        // Los informes nuevos viven en una subcolección que la transacción no lista.
        const informeSnapshot = await transaction.get(
          workspace.coleccionInformesRef.doc(String(idInforme).trim())
        );
        if (informeSnapshot.exists) informeActual = { id: idInforme, ...informeSnapshot.data() };
      }
      if (!informeActual) return { error: 'report-not-found' };
      const esPrograma = esInformePrograma(informeActual, data.fuentesMejora);

      const pendientes = planes.filter(plan => {
        if (!['Pendiente Revisión Jefatura', ESTADO_VALIDACION_REVISOR].includes(plan.estadoWorkflow)) return false;
        if (esPrograma && plan.estadoWorkflow === 'Pendiente Revisión Jefatura') return false;
        if (esPrograma && Number(plan.progreso) !== 100) return false;
        const hallazgo = hallazgos.find(item => String(item.id) === String(plan.idHallazgo));
        const planInformeId = plan.idInforme || hallazgo?.idInforme;
        if (String(planInformeId) !== String(idInforme)) return false;
        return normalizar(plan.correoRevisor) === normalizar(user.email);
      });
      if (pendientes.length === 0) return { error: 'no-pending-plans' };

      const ahora = new Date();
      const actualizados = pendientes.map(plan => {
        const aprobado = decision === 'aprobar';
        const validaEjecucionCompleta = plan.estadoWorkflow === ESTADO_VALIDACION_REVISOR;
        const evento = {
          fecha: ahora.toLocaleString('es-CO'),
          timestamp: ahora.toISOString(),
          usuario: user.email,
          accion: validaEjecucionCompleta
            ? aprobado ? 'Ejecución al 100% validada por el revisor y enviada al aprobador' : 'Evidencias devueltas por el revisor al ejecutor'
            : aprobado ? 'Diseño aprobado por el revisor' : 'Corrección solicitada por el revisor',
          ...(motivoSeguro ? { motivo: motivoSeguro } : {}),
        };
        return {
          ...plan,
          estadoWorkflow: validaEjecucionCompleta
            ? aprobado ? 'En Revisión (100%)' : 'En Ejecución'
            : aprobado
              ? (Number(plan.progreso) >= 100 ? ESTADO_VALIDACION_REVISOR : 'En Ejecución')
              : 'Borrador',
          estado: 'En Proceso',
          ...(validaEjecucionCompleta && !aprobado ? { progreso: 90 } : {}),
          ...(aprobado
            ? validaEjecucionCompleta
              ? { validadoPorRevisorCorreo: user.email, validadoPorRevisorEn: ahora.toISOString(), motivoRechazo: '' }
              : { aprobadoPorCorreo: user.email, aprobadoEn: ahora.toISOString(), motivoRechazo: '' }
            : { aprobadoPorCorreo: '', motivoRechazo: motivoSeguro }),
          historialCambios: [...(Array.isArray(plan.historialCambios) ? plan.historialCambios : []), evento],
        };
      });
      if (workspace.tieneInformesLegados) guardarInformesGrc(transaction, workspace, data.informesAuditoria);
      guardarPlanesGrc(transaction, workspace, actualizados);
      return { planes: actualizados };
    });

    const errores = {
      'not-found': ['No se encontró la matriz GRC.', 404],
      'report-not-found': ['No se encontró el informe seleccionado.', 404],
      'no-pending-plans': ['No hay planes pendientes asignados a este revisor para el informe.', 409],
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