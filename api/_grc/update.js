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
const CAMPOS_EDITABLES_PLAN = [
  'accion', 'sede', 'fechaInicio', 'fecha', 'evidenciaUrl', 'tipoAccion', 'progreso',
  'matrizRiesgos', 'matrizAspectos', 'matrizPeligros', 'matrizLegal',
  'correoResponsable', 'correoRevisor', 'correoAuditor',
];
const ROLES_ADMIN = ['admin', 'administrador', 'auditor'];
const normalizar = valor => String(valor || '').trim().toLowerCase();
const correoValido = valor => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(valor || '').trim());
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
    if (coleccion === 'planes') {
      if (!registro || typeof registro !== 'object' || Array.isArray(registro)) {
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

      const workspaceRef = adminDb.collection('workspace_compartido').doc('base_de_datos_grc');
      const resultado = await adminDb.runTransaction(async transaction => {
        const snapshot = await transaction.get(workspaceRef);
        if (!snapshot.exists) return { error: 'not-found' };
        const data = snapshot.data() || {};
        const planes = Array.isArray(data.planes) ? data.planes : [];
        const hallazgos = Array.isArray(data.hallazgos) ? data.hallazgos : [];
        const informes = Array.isArray(data.informesAuditoria) ? data.informesAuditoria : [];
        if (!informes.some(informe => String(informe.id) === idInforme)) return { error: 'report-not-found' };

        const planesPorId = new Map(planes.map(plan => [String(plan.id), plan]));
        const idsActualizados = new Set();
        const ahora = new Date();
        const usuarioEmail = normalizar(user.email);
        const planesActualizados = [];

        for (const peticion of actualizaciones) {
          const clave = String(peticion.id);
          const anterior = planesPorId.get(clave);
          const hallazgoAnterior = anterior
            ? hallazgos.find(hallazgo => String(hallazgo.id) === String(anterior.idHallazgo))
            : null;
          const idInformeAnterior = anterior?.idInforme || hallazgoAnterior?.idInforme;
          if (!anterior || idsActualizados.has(clave) || String(idInformeAnterior) !== String(idInforme)) {
            return { error: 'plan-not-found' };
          }
          idsActualizados.add(clave);
          if (!admin && normalizar(anterior.correoResponsable) !== usuarioEmail) return { error: 'not-owner' };

          const actualizaCorreoResponsable = Object.hasOwn(peticion, 'correoResponsable') || Object.hasOwn(peticion, 'correoConfirmacion');
          const actualizaCorreoRevisor = Object.hasOwn(peticion, 'correoRevisor') || Object.hasOwn(peticion, 'correoRevisorConfirmacion');
          const actualizaCorreoAuditor = Object.hasOwn(peticion, 'correoAuditor') || Object.hasOwn(peticion, 'correoAuditorConfirmacion');
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
            const correoAuditorConfirmacion = String(peticion.correoAuditorConfirmacion || '').trim();
            if (!Object.hasOwn(peticion, 'correoAuditor') || !Object.hasOwn(peticion, 'correoAuditorConfirmacion') || !correoValido(correoAuditor) || normalizar(correoAuditor) !== normalizar(correoAuditorConfirmacion)) {
              return { error: 'invalid-auditor-email' };
            }
          }

          const cambios = Object.fromEntries(
            CAMPOS_EDITABLES_PLAN.filter(campo => Object.hasOwn(peticion, campo))
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
          if (camposCambiados.length === 0) continue;
          const cambioProgreso = camposCambiados.includes('progreso');
          const cambioDiseno = camposCambiados.some(campo => campo !== 'progreso');
          if (!admin && cambioProgreso && !['En Ejecución', 'En Revisión (100%)'].includes(anterior.estadoWorkflow)) {
            return { error: 'progress-forbidden' };
          }
          const reenviaRevision = !admin && cambioDiseno;
          let estadoWorkflow = anterior.estadoWorkflow;
          if (!admin && !reenviaRevision && cambioProgreso) {
            if (cambios.progreso === 100) estadoWorkflow = 'En Revisión (100%)';
            else if (anterior.estadoWorkflow === 'En Revisión (100%)') estadoWorkflow = 'En Ejecución';
          }
          const historial = Array.isArray(anterior.historialCambios) ? anterior.historialCambios : [];
          planesActualizados.push({
            ...anterior,
            ...cambios,
            id: anterior.id,
            idHallazgo: anterior.idHallazgo,
            idInforme: idInformeAnterior,
            ...(!admin && cambioProgreso && !reenviaRevision ? { estadoWorkflow, estado: 'En Proceso' } : {}),
            ...(reenviaRevision ? {
              estadoWorkflow: 'Pendiente Revisión Jefatura',
              estado: 'En Proceso',
            } : {}),
            historialCambios: camposCambiados.length ? [
              ...historial,
              {
                fecha: ahora.toLocaleString('es-CO'),
                usuario: user.email,
                accion: reenviaRevision
                  ? 'Diseño corregido y reenviado a revisión por su responsable'
                  : cambioProgreso
                    ? estadoWorkflow === 'En Revisión (100%)'
                      ? 'Ejecución al 100% enviada a revisión del auditor'
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

        const procesoPerfil = normalizar(perfil.procesoAsignado || user.procesoAsignado);
        const subprocesoPerfil = normalizar(perfil.subprocesoAsignado);
        const planesNuevos = [];
        let siguienteId = planes.reduce((maximo, plan) => Math.max(maximo, Number(plan?.id) || 0), 0) + 1;

        for (const item of nuevas) {
          const hallazgo = hallazgos.find(candidate => String(candidate.id) === String(item.idHallazgo));
          if (!hallazgo || String(hallazgo.idInforme) !== idInforme) return { error: 'hallazgo-not-found' };
          const procesoHallazgo = normalizar(hallazgo.macroproceso || String(hallazgo.proceso || '').split('/')[0]);
          const subprocesoHallazgo = normalizar(hallazgo.subproceso);
          const esCreadorHallazgo = normalizar(hallazgo.correoCreador || hallazgo.creadoPor) === usuarioEmail;
          const perteneceProcesoAsignado = Boolean(
            procesoPerfil && procesoHallazgo === procesoPerfil &&
            (!subprocesoPerfil || subprocesoHallazgo === subprocesoPerfil)
          );
          if (!admin && !esCreadorHallazgo && !perteneceProcesoAsignado) return { error: 'hallazgo-forbidden' };

          const correoResponsable = String(item.correoResponsable || '').trim();
          const correoRevisor = String(item.correoRevisor || '').trim();
          if (
            !normalizar(item.accion) ||
            !correoValido(correoResponsable) ||
            !correoValido(correoRevisor) ||
            normalizar(correoResponsable) !== normalizar(item.correoConfirmacion) ||
            normalizar(correoRevisor) !== normalizar(item.correoRevisorConfirmacion)
          ) return { error: 'invalid-email-confirmation' };

          const { correoConfirmacion: _correoConfirmacion, correoRevisorConfirmacion: _correoRevisorConfirmacion, ...datosPlan } = item;
          planesNuevos.push({
            ...datosPlan,
            id: siguienteId++,
            idInforme,
            idHallazgo: hallazgo.id,
            progreso: 0,
            estadoWorkflow: 'Pendiente Revisión Jefatura',
            estado: 'En Proceso',
            creadoPor: user.email,
            historialCambios: [{
              fecha: ahora.toLocaleString('es-CO'),
              usuario: user.email,
              accion: 'Actividad registrada en matriz',
            }],
          });
        }

        const actualizadosPorId = new Map(planesActualizados.map(plan => [String(plan.id), plan]));
        const listaActualizada = [
          ...planesNuevos,
          ...planes.map(plan => actualizadosPorId.get(String(plan.id)) || plan),
        ];
        transaction.set(workspaceRef, { planes: listaActualizada }, { merge: true });
        return { planesActualizados, planesNuevos };
      });

      const errores = {
        'not-found': ['No se encontró la matriz de planes.', 404],
        'report-not-found': ['No se encontró el informe seleccionado.', 404],
        'plan-not-found': ['No se encontró una acción que se intentó editar.', 404],
        'not-owner': ['Solo puede editar acciones asignadas a su correo.', 403],
        'invalid-action': ['La descripción de la acción no puede quedar vacía.', 400],
        'invalid-progress': ['El avance debe ser un número entero entre 0 y 100.', 400],
        'progress-forbidden': ['El avance solo se puede actualizar cuando el plan está en ejecución o en revisión de cierre.', 403],
        'invalid-executor-email': ['El correo del ejecutor debe ser válido y coincidir con su confirmación.', 400],
        'invalid-reviewer-email': ['El correo del revisor debe ser válido y coincidir con su confirmación.', 400],
        'invalid-auditor-email': ['El correo del auditor debe ser válido y coincidir con su confirmación.', 400],
        'hallazgo-not-found': ['El informe tiene un hallazgo que no está disponible.', 404],
        'hallazgo-forbidden': ['No tiene permiso para crear planes para este hallazgo.', 403],
        'invalid-email-confirmation': ['Los correos del ejecutor y revisor deben ser válidos y coincidir con sus confirmaciones.', 400],
      };
      if (resultado.error && errores[resultado.error]) {
        const [mensaje, estado] = errores[resultado.error];
        return sendError(res, mensaje, estado);
      }

      logger.info('Matriz de planes guardada', { informe: idInforme, usuario: user.email });
      return sendSuccess(res, resultado);
    }

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
    const admin = ROLES_ADMIN.includes(normalizar(perfil.rol));
    const permisos = Array.isArray(perfil.permisos) ? perfil.permisos : [];
    if (!admin && !permisos.includes('sub_informes')) {
      return sendError(res, 'No tiene permiso para editar informes.', 403);
    }

    const procesoAsignado = normalizar(perfil.procesoAsignado || user.procesoAsignado);
    const subprocesoAsignado = normalizar(perfil.subprocesoAsignado);
    const cambios = Object.fromEntries(
      CAMPOS_EDITABLES.filter(campo => Object.hasOwn(registro, campo))
        .map(campo => [campo, registro[campo]])
    );
    const nuevoRegistro = { ...registro, ...cambios };
    if (!normalizar(nuevoRegistro.titulo) || !obtenerProceso(nuevoRegistro)) {
      return sendError(res, 'El título y el proceso son obligatorios.', 400);
    }
    if (!admin && procesoAsignado && obtenerProceso(nuevoRegistro) !== procesoAsignado) {
      return sendError(res, 'Solo puede editar informes de su proceso asignado.', 403);
    }
    if (!admin && subprocesoAsignado && normalizar(nuevoRegistro.subproceso) !== subprocesoAsignado) {
      return sendError(res, 'Solo puede editar informes de su subproceso asignado.', 403);
    }

    const workspaceRef = adminDb.collection('workspace_compartido').doc('base_de_datos_grc');
    const resultado = await adminDb.runTransaction(async transaction => {
      const snapshot = await transaction.get(workspaceRef);
      if (!snapshot.exists) return { error: 'not-found' };

      const data = snapshot.data() || {};
      const informes = Array.isArray(data.informesAuditoria) ? data.informesAuditoria : [];
      const anterior = informes.find(informe => String(informe.id) === String(id));
      if (!anterior) return { error: 'not-found' };

      if (!admin && (
        (procesoAsignado && obtenerProceso(anterior) !== procesoAsignado) ||
        (subprocesoAsignado && normalizar(anterior.subproceso) !== subprocesoAsignado)
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

      transaction.set(workspaceRef, {
        informesAuditoria: informes.map(informe => String(informe.id) === String(id) ? actualizado : informe),
      }, { merge: true });
      return { informe: actualizado };
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