import { applyCors } from '../_lib/cors.js';
import { esInformePrograma, disenoInicialBloqueado, puedeEditarAsignacionPlan, ESTADO_EVALUACION_INICIAL, ESTADO_AJUSTES_INICIALES } from '../../src/utils/programPlanWorkflow.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';
import { notificarSemaforo } from '../_lib/semaforo.js';
import { adminDb } from '../_lib/firebaseAdmin.js';
import {
  guardarInformesGrc, guardarPlanesGrc, leerWorkspaceGrcLigero,
  obtenerHallazgoTx, obtenerHallazgosTx, obtenerPlanesDeInformeTx, obtenerPlanesTx, reservarIdsPlanesTx,
} from '../_lib/grcWorkspace.js';
import { obtenerProcesosAsignados, obtenerSubprocesosAsignados, registroDentroDelAlcance } from '../_lib/assignmentScope.js';
import { sanitizarUrls } from '../_lib/validation.js';

const CAMPOS_EDITABLES = [
  'titulo', 'proceso', 'macroproceso', 'macroprocesos', 'subproceso', 'subprocesos', 'subprocesosPorMacroproceso', 'programaId',
  'tipoFuente', 'detalleFuente', 'fecha', 'elaboradoPor', 'revisadoPor',
  'aprobadoPor', 'auditorResponsable', 'auditor', 'correoAuditor',
  'correoAuditorResponsable', 'socializado', 'fechaSocializacion',
  'fecha_socializacion', 'socializadoCon', 'participantes', 'evidenciaUrl',
  'actaSocializacionUrl', 'anexos', 'anexosMultiples', 'correoEnviadoA',
];
const CAMPOS_EDITABLES_HALLAZGO = [
  'idInforme', 'sede', 'proceso', 'macroproceso', 'macroprocesos', 'subproceso', 'subprocesos', 'subprocesosPorMacroproceso', 'responsable', 'auditor',
  'normaReferencia', 'tipoFuente', 'detalleFuente', 'metodologiaCausa',
  'analisisCausa', 'titulo', 'severidad', 'evidenciaUrl', 'evidencias',
  'causa', 'claseObservacion',
];
const CAMPOS_EDITABLES_PLAN = [
  'accion', 'sede', 'fechaInicio', 'fecha', 'evidenciaUrl', 'tipoAccion', 'progreso',
  'matrizRiesgos', 'matrizAspectos', 'matrizPeligros', 'matrizLegal',
  'correoResponsable', 'correoRevisor', 'correoAuditor',
];
const ROLES_ADMIN = ['admin', 'administrador', 'auditor'];
const normalizar = valor => String(valor || '').trim().toLowerCase();
const subprocesosDe = registro => (
  Array.isArray(registro?.subprocesos) ? registro.subprocesos : [registro?.subproceso]
).map(normalizar);
const correoValido = valor => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(valor || '').trim());
const hayRolesDuplicados = ({ correoResponsable, correoRevisor, correoAuditor }) => {
  const correos = [correoResponsable, correoRevisor, correoAuditor]
    .map(normalizar)
    .filter(Boolean);
  return new Set(correos).size !== correos.length;
};
const obtenerProceso = registro => normalizar(
  registro?.macroproceso || String(registro?.proceso || '').split('/')[0]
);
const obtenerMacroprocesos = registro => (
  Array.isArray(registro?.macroprocesos) && registro.macroprocesos.length > 0
    ? registro.macroprocesos
    : [obtenerProceso(registro)]
);
const obtenerAuditor = informe => String(
  informe?.auditorResponsable || informe?.auditor || informe?.auditorLider || ''
).trim();
const obtenerCorreoAuditor = informe => String(
  informe?.correoAuditor || informe?.correoAuditorResponsable || informe?.correo_auditor || ''
).trim();

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'PUT') return sendError(res, 'Método no permitido.', 405);

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    // 🛡️ H13: solo enlaces http/https en campos URL (misma regla que aplica el cliente).
    const cuerpo = sanitizarUrls(req.body || {});
    const { coleccion, id, registro, motivo = '' } = cuerpo;
    if (coleccion === 'planes') {
      const matrizPayload = (registro && typeof registro === 'object') ? registro : cuerpo;
      if (!matrizPayload || typeof matrizPayload !== 'object') {
        return sendError(res, 'La matriz enviada no es válida.', 400);
      }
      if (JSON.stringify(registro).length > 500000) {
        return sendError(res, 'La matriz excede el tamaño permitido.', 413);
      }

      const perfilSnap = await adminDb.collection('usuarios').doc(user.uid).get();
      const perfil = perfilSnap.exists ? perfilSnap.data() : {};
      const admin = ROLES_ADMIN.includes(normalizar(perfil.rol));
      const permisos = Array.isArray(perfil.permisos) ? perfil.permisos : [];
      if (!admin && !permisos.includes('sub_seguimiento_planes')) {
        return sendError(res, 'No tiene permiso para gestionar planes de acción.', 403);
      }

      const idInforme = String(registro.idInforme || '');
      const actualizaciones = Array.isArray(registro.actualizaciones) ? registro.actualizaciones : [];
      const nuevas = Array.isArray(registro.nuevas) ? registro.nuevas : [];
      if (!idInforme || actualizaciones.length + nuevas.length === 0 || actualizaciones.length + nuevas.length > 100) {
        return sendError(res, 'La matriz debe incluir un informe y entre 1 y 100 cambios.', 400);
      }
      if (actualizaciones.some(plan => !plan?.id) || nuevas.some(plan => !plan?.idHallazgo)) {
        return sendError(res, 'Cada actividad debe estar vinculada a un hallazgo.', 400);
      }

      const resultado = await adminDb.runTransaction(async transaction => {
        // Lecturas puntuales: el informe, las acciones editadas y los hallazgos involucrados.
        const workspace = await leerWorkspaceGrcLigero(transaction, { origen: 'update-planes-tx' });
        if (!workspace.workspaceExists) return { error: 'not-found' };
        const { data } = workspace;
        const planesSolicitados = await obtenerPlanesTx(transaction, workspace, actualizaciones.map(plan => plan.id));
        const hallazgosPorId = await obtenerHallazgosTx(transaction, workspace, [
          ...planesSolicitados.filter(Boolean).map(plan => plan.idHallazgo),
          ...nuevas.map(item => item.idHallazgo),
        ]);
        const informes = Array.isArray(data.informesAuditoria) ? data.informesAuditoria : [];
        const idInformeDocumento = String(idInforme || '').trim();
        const idInformeStr = String(idInforme || '').trim().toLowerCase();

        // Preserve exact legacy ID/ref matching, then check the fragmented report document.
        let informeActual = informes.find(inf => {
          const idStr = String(inf?.id || '').trim().toLowerCase();
          const refStr = String(inf?.ref || '').trim().toLowerCase();
          return idStr === idInformeStr || refStr === idInformeStr;
        });
        if (!informeActual && idInformeDocumento) {
          const informeSnapshot = await transaction.get(
            workspace.coleccionInformesRef.doc(idInformeDocumento)
          );
          if (informeSnapshot.exists) informeActual = { id: informeSnapshot.id, ...informeSnapshot.data() };
        }

        if (!informeActual) return { error: 'report-not-found' };
        const esPrograma = esInformePrograma(informeActual, data.fuentesMejora);
        const correoAuditorInforme = String(
          informeActual.correoAuditor || informeActual.correoAuditorResponsable || informeActual.correo_auditor || ''
        ).trim();

        const planesPorId = new Map(planesSolicitados.flatMap((plan, indice) => (
          plan ? [[String(actualizaciones[indice].id), plan]] : []
        )));
        const idsActualizados = new Set();
        const ahora = new Date();
        const usuarioEmail = normalizar(user.email);
        const planesActualizados = [];

        for (const peticion of actualizaciones) {
          const clave = String(peticion.id);
          const anterior = planesPorId.get(clave);
          const hallazgoAnterior = anterior ? hallazgosPorId.get(String(anterior.idHallazgo)) : null;
          const idInformeAnterior = anterior?.idInforme || hallazgoAnterior?.idInforme;
          if (!anterior || idsActualizados.has(clave) || String(idInformeAnterior) !== String(idInforme)) {
            return { error: 'plan-not-found' };
          }
          idsActualizados.add(clave);
          if (!admin && normalizar(anterior.correoResponsable) !== usuarioEmail) return { error: 'not-owner' };

          const actualizaCorreoResponsable = Object.hasOwn(peticion, 'correoResponsable') || Object.hasOwn(peticion, 'correoConfirmacion');
          const actualizaCorreoRevisor = Object.hasOwn(peticion, 'correoRevisor') || Object.hasOwn(peticion, 'correoRevisorConfirmacion');
          const actualizaCorreoAuditor = Object.hasOwn(peticion, 'correoAuditor');
          if (!puedeEditarAsignacionPlan(anterior, user.email, admin) && [
            ['responsable', anterior.responsable],
            ['revisor', anterior.revisor],
            ['correoResponsable', anterior.correoResponsable],
            ['correoConfirmacion', anterior.correoResponsable],
            ['correoRevisor', anterior.correoRevisor],
            ['correoRevisorConfirmacion', anterior.correoRevisor],
            ['correoAuditor', anterior.correoAuditor || correoAuditorInforme],
          ].some(([campo, previo]) => Object.hasOwn(peticion, campo) && normalizar(peticion[campo]) !== normalizar(previo))) {
            return { error: 'assignment-forbidden' };
          }
          if (actualizaCorreoResponsable) {
            const correoResponsable = String(peticion.correoResponsable ?? anterior.correoResponsable ?? '').trim();
            const correoConfirmacion = String(peticion.correoConfirmacion || '').trim();
            if (!Object.hasOwn(peticion, 'correoResponsable') || !Object.hasOwn(peticion, 'correoConfirmacion') || !correoValido(correoResponsable) || normalizar(correoResponsable) !== normalizar(correoConfirmacion)) {
              return { error: 'invalid-executor-email' };
            }
          }
          if (actualizaCorreoRevisor) {
            const correoRevisor = String(peticion.correoRevisor ?? anterior.correoRevisor ?? '').trim();
            const correoRevisorConfirmacion = String(peticion.correoRevisorConfirmacion || '').trim();
            if (!Object.hasOwn(peticion, 'correoRevisor') || !Object.hasOwn(peticion, 'correoRevisorConfirmacion') || !correoValido(correoRevisor) || normalizar(correoRevisor) !== normalizar(correoRevisorConfirmacion)) {
              return { error: 'invalid-reviewer-email' };
            }
          }
          if (actualizaCorreoAuditor) {
            const correoAuditor = String(peticion.correoAuditor ?? anterior.correoAuditor ?? '').trim();
            if (!correoValido(correoAuditor)) {
              return { error: 'invalid-auditor-email' };
            }
          }
          const correoAuditorAnterior = anterior.correoAuditor || correoAuditorInforme;
          const correoResponsableActualizado = peticion.correoResponsable ?? anterior.correoResponsable;
          const correoRevisorActualizado = peticion.correoRevisor ?? anterior.correoRevisor;
          const correoAuditorActualizado = peticion.correoAuditor ?? correoAuditorAnterior;
          const cambianRoles = [
            [correoResponsableActualizado, anterior.correoResponsable],
            [correoRevisorActualizado, anterior.correoRevisor],
            [correoAuditorActualizado, correoAuditorAnterior],
          ].some(([nuevo, anteriorValor]) => normalizar(nuevo) !== normalizar(anteriorValor));
          if (cambianRoles && hayRolesDuplicados({
            correoResponsable: correoResponsableActualizado,
            correoRevisor: correoRevisorActualizado,
            correoAuditor: correoAuditorActualizado,
          })) return { error: 'duplicate-plan-roles' };

          const camposEditablesPlan = admin
            ? [...CAMPOS_EDITABLES_PLAN, 'responsable', 'revisor']
            : CAMPOS_EDITABLES_PLAN;
          const cambios = Object.fromEntries(
            camposEditablesPlan.filter(campo => Object.hasOwn(peticion, campo))
              .map(campo => [campo, peticion[campo]])
          );
          if (Object.hasOwn(cambios, 'accion') && !normalizar(cambios.accion)) return { error: 'invalid-action' };
          if (Object.hasOwn(cambios, 'progreso')) {
            const progreso = Number(cambios.progreso);
            if (!Number.isInteger(progreso) || progreso < 0 || progreso > 100) return { error: 'invalid-progress' };
            cambios.progreso = progreso;
          }

          const camposCambiados = Object.keys(cambios).filter(campo => (
            JSON.stringify(anterior[campo] ?? null) !== JSON.stringify(cambios[campo] ?? null)
          ));
          const atascadoAlCien = anterior.estadoWorkflow === 'En Ejecución' && Number(anterior.progreso) === 100;
          if (camposCambiados.length === 0 && !atascadoAlCien) continue;
          const cambioProgreso = camposCambiados.includes('progreso');
          // Subir evidencia es ejecución, no una corrección del diseño aprobado.
          const cambioDiseno = camposCambiados.some(campo => !['progreso', 'evidenciaUrl'].includes(campo));
          const corrigeDisenoInicial = esPrograma && disenoInicialBloqueado(anterior);
          if (corrigeDisenoInicial && Number(cambios.progreso ?? anterior.progreso) !== Number(anterior.progreso)) {
            return { error: 'progress-forbidden' };
          }
          if (!admin && camposCambiados.length > 0 && anterior.estadoWorkflow !== 'En Ejecución' &&
              !(corrigeDisenoInicial && anterior.estadoWorkflow === ESTADO_AJUSTES_INICIALES && !cambioProgreso)) {
            return { error: 'progress-forbidden' };
          }
          const reenviaRevision = (cambioDiseno || (corrigeDisenoInicial && camposCambiados.length > 0)) && (!admin || esPrograma);
          let estadoWorkflow = anterior.estadoWorkflow;
          const alCien = Number(cambios.progreso ?? anterior.progreso) === 100;
          if (admin && (cambioProgreso || atascadoAlCien)) {
            if (alCien && anterior.estadoWorkflow === 'En Ejecución') estadoWorkflow = 'Pendiente Validación Revisor';
            else if (!alCien && ['Pendiente Validación Revisor', 'En Revisión (100%)'].includes(anterior.estadoWorkflow)) estadoWorkflow = 'En Ejecución';
          }
          if (!admin && !reenviaRevision && (cambioProgreso || atascadoAlCien)) {
            if (alCien) estadoWorkflow = 'Pendiente Validación Revisor';
            else if (anterior.estadoWorkflow === 'En Revisión (100%)') estadoWorkflow = 'En Ejecución';
          }
          const cambiaEstadoEjecucion = (
            !admin && !reenviaRevision && (cambioProgreso || atascadoAlCien)
          ) || (
            admin && (cambioProgreso || atascadoAlCien) && estadoWorkflow !== anterior.estadoWorkflow
          );
          const historial = Array.isArray(anterior.historialCambios) ? anterior.historialCambios : [];
          planesActualizados.push({
            ...anterior,
            ...cambios,
            id: anterior.id,
            idHallazgo: anterior.idHallazgo,
            idInforme: idInformeAnterior,
            ...(cambiaEstadoEjecucion ? { estadoWorkflow, estado: 'En Proceso' } : {}),
            ...(reenviaRevision ? {
              estadoWorkflow: esPrograma ? ESTADO_EVALUACION_INICIAL : 'Pendiente Revisión Jefatura',
              estado: 'En Proceso',
              ...(esPrograma ? { evaluacionHolistica: null, aprobadoPorCorreo: '', aprobadoEn: '', validadoPorRevisorCorreo: '', validadoPorRevisorEn: '' } : {}),
            } : {}),
            historialCambios: (camposCambiados.length || atascadoAlCien) ? [
              ...historial,
              {
                fecha: ahora.toLocaleString('es-CO'),
                usuario: user.email,
                accion: reenviaRevision
                  ? 'Diseño corregido y reenviado a revisión por su responsable'
                  : cambiaEstadoEjecucion
                    ? estadoWorkflow === 'Pendiente Validación Revisor'
                      ? 'Ejecución al 100% enviada a validación del revisor'
                      : 'Avance de ejecución actualizado por su responsable'
                    : 'Acción de plan actualizada',
                detalleCambios: camposCambiados.map(campo => ({
                  campo,
                  antes: anterior[campo] ?? '',
                  despues: cambios[campo] ?? '',
                })),
              },
            ] : historial,
          });
        }

        const procesosPerfil = obtenerProcesosAsignados(perfil, user);
        const subprocesosPerfil = obtenerSubprocesosAsignados(perfil);
        const planesNuevos = [];
        // IDs libres verificados en la transacción (antes: máximo de toda la colección + 1).
        const idsNuevos = nuevas.length ? await reservarIdsPlanesTx(transaction, workspace, nuevas.length) : [];
        let indiceNuevo = 0;

        for (const item of nuevas) {
          const hallazgo = hallazgosPorId.get(String(item.idHallazgo));
          if (!hallazgo || String(hallazgo.idInforme) !== String(informeActual.id)) return { error: 'hallazgo-not-found' };
          const procesoHallazgo = normalizar(hallazgo.macroproceso || String(hallazgo.proceso || '').split('/')[0]);
          const subprocesosHallazgo = (Array.isArray(hallazgo.subprocesos) ? hallazgo.subprocesos : [hallazgo.subproceso])
            .map(normalizar);
          const esCreadorHallazgo = normalizar(hallazgo.correoCreador || hallazgo.creadoPor) === usuarioEmail;
          const perteneceProcesoAsignado = procesosPerfil.length > 0 && registroDentroDelAlcance(
            procesosPerfil,
            subprocesosPerfil,
            procesoHallazgo,
            subprocesosHallazgo
          );
          if (!admin && !esCreadorHallazgo && !perteneceProcesoAsignado) return { error: 'hallazgo-forbidden' };

          const correoResponsable = String(item.correoResponsable || '').trim();
          const correoRevisor = String(item.correoRevisor || '').trim();
          const correoAuditor = String(item.correoAuditor || correoAuditorInforme).trim();
          if (esPrograma && !correoValido(correoAuditor)) return { error: 'invalid-auditor-email' };
          if (
            !normalizar(item.accion) ||
            !correoValido(correoResponsable) ||
            !correoValido(correoRevisor) ||
            normalizar(correoResponsable) !== normalizar(item.correoConfirmacion) ||
            normalizar(correoRevisor) !== normalizar(item.correoRevisorConfirmacion)
          ) return { error: 'invalid-email-confirmation' };
          if (hayRolesDuplicados({
            correoResponsable,
            correoRevisor,
            correoAuditor,
          })) return { error: 'duplicate-plan-roles' };

          const { correoConfirmacion: _correoConfirmacion, correoRevisorConfirmacion: _correoRevisorConfirmacion, ...datosPlan } = item;
          planesNuevos.push({
            ...datosPlan,
            id: idsNuevos[indiceNuevo++],
            idInforme,
            idHallazgo: hallazgo.id,
            ...(correoAuditor ? { correoAuditor } : {}),
            progreso: 0,
            ...(esPrograma ? {
              evaluacionHolistica: null, historialEvaluaciones: [],
              aprobadoPorCorreo: '', aprobadoEn: '', validadoPorRevisorCorreo: '', validadoPorRevisorEn: '',
            } : {}),
            estadoWorkflow: esPrograma ? ESTADO_EVALUACION_INICIAL : 'Pendiente Revisión Jefatura',
            estado: 'En Proceso',
            creadoPor: user.email,
            historialCambios: [{
              fecha: ahora.toLocaleString('es-CO'),
              usuario: user.email,
              accion: 'Actividad registrada en matriz',
            }],
          });
        }

        if (workspace.tieneInformesLegados) guardarInformesGrc(transaction, workspace, data.informesAuditoria);
        guardarPlanesGrc(transaction, workspace, [...planesNuevos, ...planesActualizados]);
        return { planesActualizados, planesNuevos };
      });

      const errores = {
        'not-found': ['No se encontró la matriz de planes.', 404],
        'report-not-found': ['No se encontró el informe seleccionado.', 404],
        'plan-not-found': ['No se encontró una acción que se intentó editar.', 404],
        'not-owner': ['Solo puede editar acciones asignadas a su correo.', 403],
        'invalid-action': ['La descripción de la acción no puede quedar vacía.', 400],
        'invalid-progress': ['El avance debe ser un número entero entre 0 y 100.', 400],
        'progress-forbidden': ['El plan solo se puede modificar durante la ejecución; está bloqueado mientras espera validación del revisor o aprobación final.', 403],
        'invalid-executor-email': ['El correo del ejecutor debe ser válido y coincidir con su confirmación.', 400],
        'assignment-forbidden': ['El ejecutor no puede modificar los cargos ni correos asignados. Solicita el ajuste a un administrador distinto del ejecutor.', 403],
        'invalid-reviewer-email': ['El correo del revisor debe ser válido y coincidir con su confirmación.', 400],
        'invalid-auditor-email': ['El correo del auditor debe ser válido.', 400],
        'duplicate-plan-roles': ['Ejecutor, revisor y auditor deben ser personas distintas. Revisa los correos asignados.', 400],
        'hallazgo-not-found': ['El informe tiene un hallazgo que no está disponible.', 404],
        'hallazgo-forbidden': ['No tiene permiso para crear planes para este hallazgo.', 403],
        'invalid-email-confirmation': ['Los correos del ejecutor y revisor deben ser válidos y coincidir con sus confirmaciones.', 400],
      };
      if (resultado.error && errores[resultado.error]) {
        const [mensaje, estado] = errores[resultado.error];
        return sendError(res, mensaje, estado);
      }

      await notificarSemaforo();
      logger.info('Matriz de planes guardada', { informe: idInforme, usuario: user.email });
      return sendSuccess(res, resultado);
    }

    if (!['informesAuditoria', 'hallazgos'].includes(coleccion) || !id) {
      return sendError(res, 'El registro indicado no es válido.', 400);
    }
    if (!registro || typeof registro !== 'object' || Array.isArray(registro)) {
      return sendError(res, 'Los cambios enviados no son válidos.', 400);
    }
    if (JSON.stringify(registro).length > 500000) {
      return sendError(res, 'Los cambios exceden el tamaño permitido.', 413);
    }

    const perfilSnap = await adminDb.collection('usuarios').doc(user.uid).get();
    const perfil = perfilSnap.exists ? perfilSnap.data() : {};
    const admin = ROLES_ADMIN.includes(normalizar(perfil.rol));
    const permisos = Array.isArray(perfil.permisos) ? perfil.permisos : [];

    if (coleccion === 'hallazgos') {
      if (!admin && !permisos.includes('sub_hallazgos')) {
        return sendError(res, 'No tiene permiso para editar hallazgos.', 403);
      }

      const cambios = Object.fromEntries(
        CAMPOS_EDITABLES_HALLAZGO.filter(campo => Object.hasOwn(registro, campo))
          .map(campo => [campo, registro[campo]])
      );
      if (!normalizar(cambios.titulo) || !obtenerProceso(cambios)) {
        return sendError(res, 'El título y el proceso del hallazgo son obligatorios.', 400);
      }
      const subprocesosActualizados = subprocesosDe(cambios);
      if (subprocesosActualizados.length === 0) {
        return sendError(res, 'El hallazgo debe tener al menos un subproceso.', 400);
      }

      const resultado = await adminDb.runTransaction(async transaction => {
        // Solo se necesita el hallazgo editado (y el informe destino si cambia): no se listan colecciones.
        const workspace = await leerWorkspaceGrcLigero(transaction, { origen: 'update-hallazgos-tx' });
        if (!workspace.workspaceExists) return { error: 'not-found' };
        const { data } = workspace;
        const anterior = await obtenerHallazgoTx(transaction, workspace, id);
        if (!anterior) return { error: 'not-found' };

        const cambiaInforme = Object.hasOwn(cambios, 'idInforme') &&
          String(cambios.idInforme || '').trim() !== String(anterior.idInforme || '').trim();
        let informeDestino = null;
        if (cambiaInforme) {
          const idInformeSolicitado = String(cambios.idInforme || '').trim();
          if (!idInformeSolicitado) return { error: 'report-required' };

          const informes = Array.isArray(data.informesAuditoria) ? data.informesAuditoria : [];
          const informeEncontrado = informes.find(informe => (
            String(informe.id || '').trim() === idInformeSolicitado ||
            String(informe.ref || '').trim().toLowerCase() === idInformeSolicitado.toLowerCase()
          ));
          if (informeEncontrado) {
            informeDestino = informeEncontrado;
          } else {
            const informeSnapshot = await transaction.get(
              workspace.coleccionInformesRef.doc(idInformeSolicitado)
            );
            if (informeSnapshot.exists) {
              informeDestino = { id: informeSnapshot.id, ...informeSnapshot.data() };
            }
          }
          if (!informeDestino) return { error: 'report-not-found' };

          if (!admin) {
            const procesosAsignados = obtenerProcesosAsignados(perfil, user);
            const subprocesosAsignados = obtenerSubprocesosAsignados(perfil);
            if (!registroDentroDelAlcance(
              procesosAsignados,
              subprocesosAsignados,
              obtenerMacroprocesos(informeDestino),
              subprocesosDe(informeDestino),
              informeDestino.subprocesosPorMacroproceso
            )) return { error: 'report-forbidden' };
          }
        }

        const autor = normalizar(
          anterior.correoCreador || anterior.creadoPor || anterior.historialCambios?.[0]?.usuario
        );
        if (!admin && autor !== normalizar(user.email)) return { error: 'forbidden' };

        const camposCambiados = Object.keys(cambios).filter(campo => (
          JSON.stringify(anterior[campo] ?? null) !== JSON.stringify(cambios[campo] ?? null)
        ));
        const historial = Array.isArray(anterior.historialCambios) ? anterior.historialCambios : [];
        const ahora = new Date();
        const actualizado = {
          ...anterior,
          ...cambios,
          id: anterior.id,
          ref: anterior.ref,
          idInforme: cambiaInforme ? String(informeDestino.id) : anterior.idInforme,
          correoCreador: anterior.correoCreador || anterior.creadoPor || user.email,
          creadoPor: anterior.creadoPor || anterior.correoCreador || user.email,
          historialCambios: camposCambiados.length ? [
            ...historial,
            {
              fecha: ahora.toLocaleString('es-CO'),
              timestamp: ahora.toISOString(),
              usuario: user.email,
              accion: 'Hallazgo actualizado por su creador',
              detalleCambios: camposCambiados.map(campo => ({
                campo,
                antes: anterior[campo] ?? '',
                despues: cambios[campo] ?? '',
              })),
            },
          ] : historial,
        };
        transaction.set(workspace.coleccionHallazgosRef.doc(String(id)), actualizado);
        return { registro: actualizado };
      });

      if (resultado.error === 'not-found') return sendError(res, 'No se encontró el hallazgo.', 404);
      if (resultado.error === 'forbidden') return sendError(res, 'Solo el creador o un administrador puede editar este hallazgo.', 403);
      if (resultado.error === 'report-required') return sendError(res, 'Selecciona un informe de auditoría válido.', 400);
      if (resultado.error === 'report-not-found') return sendError(res, 'No se encontró el informe de auditoría seleccionado.', 404);
      if (resultado.error === 'report-forbidden') return sendError(res, 'No tienes acceso al proceso y subproceso del informe seleccionado.', 403);

      await notificarSemaforo();
      logger.info('Hallazgo actualizado', { id, usuario: user.email });
      return sendSuccess(res, resultado);
    }

    if (!admin && !permisos.includes('sub_informes')) {
      return sendError(res, 'No tiene permiso para editar informes.', 403);
    }

    const procesosAsignados = obtenerProcesosAsignados(perfil, user);
    const subprocesosAsignados = obtenerSubprocesosAsignados(perfil);
    const cambios = Object.fromEntries(
      CAMPOS_EDITABLES.filter(campo => Object.hasOwn(registro, campo))
        .map(campo => [campo, registro[campo]])
    );
    const nuevoRegistro = { ...registro, ...cambios };
    if (!normalizar(nuevoRegistro.titulo) || !obtenerProceso(nuevoRegistro)) {
      return sendError(res, 'El título y el proceso son obligatorios.', 400);
    }
    if (!admin && !registroDentroDelAlcance(
      procesosAsignados,
      subprocesosAsignados,
      obtenerMacroprocesos(nuevoRegistro),
      subprocesosDe(nuevoRegistro),
      nuevoRegistro.subprocesosPorMacroproceso
    )) {
      return sendError(res, 'El informe debe pertenecer a un proceso y subproceso asignados.', 403);
    }

    const resultado = await adminDb.runTransaction(async transaction => {
      const workspace = await leerWorkspaceGrcLigero(transaction, { origen: 'update-informes-tx' });
      if (!workspace.workspaceExists) return { error: 'not-found' };
      const { data } = workspace;
      const informes = Array.isArray(data.informesAuditoria) ? data.informesAuditoria : [];
      let anterior = informes.find(informe => String(informe.id) === String(id));
      const estaEnLegado = Boolean(anterior);
      if (!anterior) {
        const informeSnapshot = await transaction.get(workspace.coleccionInformesRef.doc(String(id).trim()));
        if (informeSnapshot.exists) anterior = { id: informeSnapshot.id, ...informeSnapshot.data() };
      }
      if (!anterior) return { error: 'not-found' };

      if (!admin && !registroDentroDelAlcance(
        procesosAsignados,
        subprocesosAsignados,
        obtenerMacroprocesos(anterior),
        subprocesosDe(anterior),
        anterior.subprocesosPorMacroproceso
      )) return { error: 'forbidden' };

      const camposCambiados = Object.keys(cambios).filter(campo => (
        JSON.stringify(anterior[campo] ?? null) !== JSON.stringify(cambios[campo] ?? null)
      ));
      const historial = Array.isArray(anterior.historialCambios) ? anterior.historialCambios : [];
      const ahora = new Date();
      const motivoSeguro = String(motivo || '').trim().slice(0, 500);
      const actualizado = {
        ...anterior,
        ...cambios,
        id: anterior.id,
        ref: anterior.ref,
        historialCambios: camposCambiados.length ? [
          ...historial,
          {
            fecha: ahora.toLocaleString('es-CO'),
            timestamp: ahora.toISOString(),
            usuario: user.email,
            accion: motivoSeguro ? `Actualización del informe — ${motivoSeguro}` : 'Actualización del informe',
            motivo: motivoSeguro || 'Actualización del registro',
            version: historial.length + 1,
            detalle: Object.fromEntries(camposCambiados.map(campo => [campo, {
              anterior: anterior[campo] ?? null,
              actual: cambios[campo] ?? null,
            }])),
          },
        ] : historial,
      };

      const cambiaAuditor = camposCambiados.some(campo => [
        'auditorResponsable', 'auditor', 'correoAuditor', 'correoAuditorResponsable',
      ].includes(campo));
      // Los planes del informe solo se leen cuando cambia el auditor (lectura filtrada, no la colección).
      const { planes, hallazgos } = cambiaAuditor
        ? await obtenerPlanesDeInformeTx(transaction, workspace, id)
        : { planes: [], hallazgos: [] };
      const idsHallazgosInforme = new Set(
        hallazgos
          .filter(hallazgo => String(hallazgo.idInforme) === String(id))
          .map(hallazgo => String(hallazgo.id))
      );
      const planesActualizados = cambiaAuditor ? planes.flatMap(plan => {
        const perteneceAlInforme = String(plan.idInforme || '') === String(id) ||
          idsHallazgosInforme.has(String(plan.idHallazgo));
        if (!perteneceAlInforme) return [];

        const cambiosAuditor = {
          auditorAsignado: obtenerAuditor(actualizado),
          correoAuditor: obtenerCorreoAuditor(actualizado),
        };
        if (
          plan.auditorAsignado === cambiosAuditor.auditorAsignado &&
          plan.correoAuditor === cambiosAuditor.correoAuditor
        ) return [];

        const historialPlan = Array.isArray(plan.historialCambios) ? plan.historialCambios : [];
        return [{
          ...plan,
          ...cambiosAuditor,
          historialCambios: [
            ...historialPlan,
            {
              fecha: ahora.toLocaleString('es-CO'),
              timestamp: ahora.toISOString(),
              usuario: user.email,
              accion: 'Auditor de seguimiento sincronizado desde el informe de auditoría',
              detalleCambios: Object.entries(cambiosAuditor)
                .filter(([campo, valor]) => plan[campo] !== valor)
                .map(([campo, valor]) => ({ campo, antes: plan[campo] ?? '', despues: valor })),
            },
          ],
        }];
      }) : [];

      guardarInformesGrc(
        transaction,
        workspace,
        estaEnLegado
          ? informes.map(informe => String(informe.id) === String(id) ? actualizado : informe)
          : [...informes, actualizado]
      );
      // Cada plan se guarda en su documento de planes_accion. Antes se copiaba la lista completa al
      // campo legado `planes` del documento principal, lo que podía revivir planes eliminados y
      // acercar el documento al límite de 1 MiB.
      if (planesActualizados.length > 0) guardarPlanesGrc(transaction, workspace, planesActualizados);
      return { informe: actualizado, planesActualizados };
    });

    if (resultado.error === 'not-found') return sendError(res, 'No se encontró el informe.', 404);
    if (resultado.error === 'forbidden') return sendError(res, 'No tiene permiso para editar este informe.', 403);

    await notificarSemaforo();
    logger.info('Informe actualizado con permiso de módulo', { id, usuario: user.email });
    return sendSuccess(res, { registro: resultado.informe, planesActualizados: resultado.planesActualizados });
  } catch (error) {
    logger.error('Error actualizando informe GRC', error, { endpoint: req.url });
    return sendError(res, 'No se pudo actualizar el informe.', 500);
  }
}