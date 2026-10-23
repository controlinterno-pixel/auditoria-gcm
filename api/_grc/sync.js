// api/grc/sync.js - Sincronización GRC con Row-Level Security Optimizada
import { applyCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';
import { esAdministradorTotal } from '../_lib/roles.js';
import { leerRevisionSemaforo, notificarSemaforo } from '../_lib/semaforo.js';
import { guardarWorkspaceParcial, leerWorkspaceGrc } from '../_lib/grcWorkspace.js';
import { sanitizarUrls, validarDatosSync } from '../_lib/validation.js';
import { obtenerProcesosAsignados, obtenerSubprocesosAsignados, registroDentroDelAlcanceAsignado } from '../_lib/assignmentScope.js';
import { esInformePrograma, disenoInicialBloqueado, puedeEditarAsignacionPlan, bloqueadaParaRevisorOAuditor, bloqueadaParaEjecutor, ESTADO_EVALUACION_INICIAL } from '../../src/utils/programPlanWorkflow.js';

/**
 * Valida de forma estricta si el usuario posee rol administrativo o de auditoría.
 */
function esRolAdministrador(rol) {
  if (!rol || typeof rol !== 'string') return false;
  const normalizado = rol.toLowerCase().trim();
  return normalizado === 'admin' || normalizado === 'administrador' || normalizado === 'auditor';
}

// eslint-disable-next-line no-unused-vars
function normalizarProceso(valor) {
  return String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function serializarEvaluacion(plan) {
  return JSON.stringify({
    evaluacionHolistica: plan?.evaluacionHolistica ?? null,
    historialEvaluaciones: plan?.historialEvaluaciones ?? null,
  });
}

const normalizarCorreoPlan = correo => String(correo || '').trim().toLowerCase();

// Ambas validaciones reciben la misma lectura del workspace (antes se leía dos veces por guardado).
function hayConflictosDeRolesEnPlanesActualizados(planesActualizados, data) {
  if (!Array.isArray(planesActualizados)) return false;

  const planesGuardados = Array.isArray(data.planes) ? data.planes : [];
  const hallazgos = Array.isArray(data.hallazgos) ? data.hallazgos : [];
  const informes = Array.isArray(data.informesAuditoria) ? data.informesAuditoria : [];
  const planesPorId = new Map(planesGuardados.map(plan => [String(plan.id), plan]));
  const hallazgosPorId = new Map(hallazgos.map(hallazgo => [String(hallazgo.id), hallazgo]));

  return planesActualizados.some(plan => {
    if (!plan || typeof plan !== 'object') return false;
    const planAnterior = planesPorId.get(String(plan.id));
    const hallazgo = hallazgosPorId.get(String(plan.idHallazgo || planAnterior?.idHallazgo));
    const idInforme = hallazgo?.idInforme || plan.idInforme || planAnterior?.idInforme;
    const informe = informes.find(item => String(item.id) === String(idInforme));
    const correoAuditorAnterior = planAnterior?.correoAuditor || informe?.correoAuditor || informe?.correoAuditorResponsable || informe?.correo_auditor || '';
    const correoAuditorActualizado = plan.correoAuditor || correoAuditorAnterior;
    const rolesCambiaron = !planAnterior || [
      [plan.correoResponsable, planAnterior.correoResponsable],
      [plan.correoRevisor, planAnterior.correoRevisor],
      [correoAuditorActualizado, correoAuditorAnterior],
    ].some(([nuevo, anterior]) => normalizarCorreoPlan(nuevo) !== normalizarCorreoPlan(anterior));
    if (!rolesCambiaron) return false;

    const correos = [plan.correoResponsable, plan.correoRevisor, correoAuditorActualizado]
      .map(normalizarCorreoPlan)
      .filter(Boolean);
    return new Set(correos).size !== correos.length;
  });
}

const CAMPOS_CONTENIDO_EJECUTOR = [
  'accion', 'sede', 'fechaInicio', 'fecha', 'evidenciaUrl', 'tipoAccion',
  'matrizRiesgos', 'matrizAspectos', 'matrizPeligros', 'matrizLegal',
];
// El guardado masivo rellena estos valores por defecto; vacío y valor por defecto no cuentan como cambio.
const VALOR_POR_DEFECTO_CONTENIDO = {
  sede: 'No especificada', tipoAccion: 'Acción Correctiva',
  matrizRiesgos: 'No aplica', matrizAspectos: 'No aplica', matrizPeligros: 'No aplica', matrizLegal: 'No aplica',
};
const valorContenido = (campo, valor) => {
  const vacio = valor === undefined || valor === null || valor === '' || (Array.isArray(valor) && valor.length === 0);
  return JSON.stringify(vacio ? (VALOR_POR_DEFECTO_CONTENIDO[campo] ?? '') : valor);
};
const cambiaContenidoEjecutor = (actualizado, guardado) => CAMPOS_CONTENIDO_EJECUTOR.some(campo => (
  valorContenido(campo, actualizado[campo]) !== valorContenido(campo, guardado[campo])
));

function usuarioPuedeEvaluarPlanes(partialData, user, data) {
  if (!Array.isArray(partialData.planes)) return true;

  const planesGuardados = Array.isArray(data.planes) ? data.planes : [];
  const hallazgos = Array.isArray(data.hallazgos) ? data.hallazgos : [];
  const informes = Array.isArray(data.informesAuditoria) ? data.informesAuditoria : [];
  const hallazgosPorId = new Map(hallazgos.map(hallazgo => [String(hallazgo.id), hallazgo]));
  const planesPorId = new Map(planesGuardados.map(plan => [String(plan.id), plan]));

  for (const planActualizado of partialData.planes) {
    const planGuardado = planesPorId.get(String(planActualizado?.id));
    const hallazgoOrigen = hallazgosPorId.get(String(planGuardado?.idHallazgo || planActualizado?.idHallazgo));
    const informeOrigen = informes.find(item => String(item.id) === String(hallazgoOrigen?.idInforme || planGuardado?.idInforme || planActualizado?.idInforme));
    const correoAuditorInforme = informeOrigen?.correoAuditor || informeOrigen?.correoAuditorResponsable || informeOrigen?.correo_auditor || '';
    // Aprobado el diseño, revisor y auditor aprobador no alteran el contenido que trabaja el ejecutor.
    // El ejecutor tampoco altera lo que ya envió a revisión o lo que quedó cerrado.
    if (planGuardado && (bloqueadaParaRevisorOAuditor(planGuardado, user.email, correoAuditorInforme) ||
        bloqueadaParaEjecutor(planGuardado, user.email)) && cambiaContenidoEjecutor(planActualizado, planGuardado)) {
      return false;
    }
    if (planGuardado && !puedeEditarAsignacionPlan(planGuardado, user.email, true)) {
      const correoAuditor = planGuardado.correoAuditor || informeOrigen?.correoAuditor || informeOrigen?.correoAuditorResponsable || informeOrigen?.correo_auditor || '';
      if (['responsable', 'revisor', 'correoResponsable', 'correoRevisor'].some(campo => (
        normalizarCorreoPlan(planActualizado[campo]) !== normalizarCorreoPlan(planGuardado[campo])
      )) || normalizarCorreoPlan(planActualizado.correoAuditor || correoAuditor) !== normalizarCorreoPlan(correoAuditor) ||
          (Object.hasOwn(planActualizado, 'correoConfirmacion') && normalizarCorreoPlan(planActualizado.correoConfirmacion) !== normalizarCorreoPlan(planGuardado.correoResponsable)) ||
          (Object.hasOwn(planActualizado, 'correoRevisorConfirmacion') && normalizarCorreoPlan(planActualizado.correoRevisorConfirmacion) !== normalizarCorreoPlan(planGuardado.correoRevisor))) return false;
    }
    if (esInformePrograma(informeOrigen, data.fuentesMejora)) {
      if (!planGuardado) {
        if (planActualizado.estadoWorkflow !== ESTADO_EVALUACION_INICIAL || Number(planActualizado.progreso) !== 0 ||
            planActualizado.evaluacionHolistica || planActualizado.historialEvaluaciones?.length) return false;
        continue;
      }
      // Las decisiones del auditor se escriben exclusivamente mediante la transacción de review-plans.
      if (serializarEvaluacion(planGuardado) !== serializarEvaluacion(planActualizado)) {
        const invalidaDiseno = planActualizado.estadoWorkflow === ESTADO_EVALUACION_INICIAL &&
          planActualizado.evaluacionHolistica === null &&
          JSON.stringify(planActualizado.historialEvaluaciones ?? null) === JSON.stringify(planGuardado.historialEvaluaciones ?? null);
        if (!invalidaDiseno) return false;
      }
      if (disenoInicialBloqueado(planGuardado) && Number(planActualizado.progreso) !== Number(planGuardado.progreso)) return false;
      const desde = planGuardado.estadoWorkflow;
      const hasta = planActualizado.estadoWorkflow;
      if (desde !== hasta && hasta !== ESTADO_EVALUACION_INICIAL &&
          !(desde === 'En Ejecución' && hasta === 'Pendiente Validación Revisor' && Number(planActualizado.progreso) === 100) &&
          // Sin revisor, el 100 % pasa directo al auditor aprobador.
          !(desde === 'En Ejecución' && hasta === 'En Revisión (100%)' && planActualizado.revisorNoAplica === true && Number(planActualizado.progreso) === 100) &&
          !(['Pendiente Validación Revisor', 'En Revisión (100%)'].includes(desde) && hasta === 'En Ejecución' && Number(planActualizado.progreso) < 100)) return false;
      continue;
    }
    if (serializarEvaluacion(planGuardado) !== serializarEvaluacion(planActualizado)) return false;
  }

  return true;
}

/**
 * Motor ABAC / RLS Avanzado: Filtra colecciones garantizando que el usuario solo vea
 * lo que le corresponde por Correo, Cargo o Proceso.
 */
function aplicarRLS(lista = [], userEmail, userCargo, userProcess) {
  if (!Array.isArray(lista)) return [];

  const emailSafe = String(userEmail || '').toLowerCase().trim();
  const cargoSafe = String(userCargo || '').toLowerCase().trim();
  const processSafe = (Array.isArray(userProcess) ? userProcess : [userProcess])
    .map(valor => String(valor || '').toLowerCase().trim())
    .filter(Boolean);

  return lista.filter(item => {
    if (!item || typeof item !== 'object') return false;

    // =========================================================
    // REGLA 1: Identidad (Correo Electrónico)
    // Si mi correo está en algún campo clave de este registro, lo veo.
    // =========================================================
    if (emailSafe) {
      const correosInvolucrados = [
        item.correoResponsable, item.correo_responsable,
        item.correoAuditor, item.correo_auditor, item.correoAuditorResponsable,
        item.correoRevisor, item.correo_revisor,
        item.correoEnviadoA, item.correoCreador
      ].join(' ').toLowerCase();

      if (correosInvolucrados.includes(emailSafe)) return true;
    }

    // =========================================================
    // REGLA 2: Estructural (Proceso / Subproceso)
    // Si yo pertenezco a este proceso, veo todo lo que sucede aquí.
    // =========================================================
    if (processSafe.length > 0) {
      const procesosRegistro = [
        ...(Array.isArray(item.macroprocesos) ? item.macroprocesos : []),
        item.macroproceso,
        item.proceso,
      ].filter(Boolean).map(valor => String(valor).toLowerCase());
      const subprocesoRegistro = [
        item.subproceso,
        ...(Array.isArray(item.subprocesos) ? item.subprocesos : []),
      ].filter(Boolean).join(' ').toLowerCase();
      
      if (processSafe.some(proceso => (
        procesosRegistro.some(procesoRegistro => (
          procesoRegistro.includes(proceso) || proceso.includes(procesoRegistro)
        )) || subprocesoRegistro.includes(proceso)
      ))) {
        return true;
      }
    }

    // =========================================================
    // REGLA 3: Operativo (Cargo Múltiple)
    // Si mi cargo fue asignado a este registro (como responsable, revisor, etc.), lo veo.
    // =========================================================
    if (cargoSafe) {
      const rolesInvolucrados = [
        item.responsable,
        item.auditor, item.auditorResponsable, item.auditorAsignado,
        item.revisor,
        item.elaboradoPor, item.revisadoPor, item.aprobadoPor,
        item.participantes, item.socializadoCon
      ].join(' ').toLowerCase();

      // Buscamos si el cargo del usuario está contenido en la cadena de roles asignados
      if (rolesInvolucrados.includes(cargoSafe)) return true;
    }

    // Si no cumplió NINGUNA de las reglas de seguridad corporativa, se oculta el registro
    return false;
  });
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendError(res, 'Método no permitido.', 405);
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    // Ver todo (GET) incluye al auditor; guardar la base completa (POST) es solo del administrador.
    const isAdmin = esRolAdministrador(user.rol);
    const esAdministradorPleno = esAdministradorTotal(user.rol);

    // =========================================================================
    // 🛡️ LÓGICA GET: LECTURA CON ROW-LEVEL SECURITY (RLS) SERVER-SIDE
    // =========================================================================
    if (req.method === 'GET') {
      const userProcesses = obtenerProcesosAsignados(user, user);
      const procesosConsulta = !isAdmin && userProcesses.length > 0
        ? (Array.isArray(user.procesosAsignados) && user.procesosAsignados.length > 0
          ? user.procesosAsignados
          : [user.procesoAsignado].filter(Boolean))
        : null;
      let revision = typeof req.query?.revision === 'string' ? req.query.revision.slice(0, 100) : '';
      if (!revision) {
        // Se lee la revisión ANTES que los datos: así los datos nunca son más antiguos que la revisión
        // devuelta y el cliente no repite la descarga cuando su listener del semáforo responde después.
        revision = await leerRevisionSemaforo().catch(() => '');
      }
      const { data: workspaceData } = await leerWorkspaceGrc(null, {
        usarCache: req.query?.fresh !== '1' || Boolean(revision),
        procesosAsignados: procesosConsulta,
        revision,
        origen: 'sync-get',
      });
      // `planesAccion` es una copia idéntica de `planes` (~17 % de la respuesta) que el cliente no usa.
      // Se omite solo en la respuesta; el dato interno se conserva. Se copia: workspaceData es compartido por la caché.
      const { planesAccion: _planesDuplicados, ...datosRespuesta } = workspaceData;
      const data = revision ? { ...datosRespuesta, revision } : datosRespuesta;

      // Administradores y Auditores acceden a la totalidad de la base de datos
      if (isAdmin) {
        return sendSuccess(res, data);
      }

      // Extracción segura del contexto del usuario autenticado
      const userEmail = String(user.email || '').toLowerCase().trim();
      const userCargo = String(user.cargo || user.rol || '').toLowerCase().trim();
      const userSubprocesses = obtenerSubprocesosAsignados(user);
      // Los módulos de Auditorías y Gobernanza solo se entregan con el permiso correspondiente.
      const tienePermiso = permiso => Array.isArray(user.permisos) && user.permisos.includes(permiso);
      const puedeVerCronograma = tienePermiso('sub_cronograma');
      const puedeVerProgramas = tienePermiso('sub_programas');
      const puedeVerComites = tienePermiso('sub_comites');
      // Se libera el catálogo corporativo completo para permitir el autocompletado 
      // de los correos en la asignación de Planes de Acción, sin importar el rol.
      const catalogoCargosSeguro = Array.isArray(data.catalogoCargos) ? data.catalogoCargos : [];

      const informesData = Array.isArray(data.informesAuditoria) ? data.informesAuditoria : [];
      const hallazgosData = Array.isArray(data.hallazgos) ? data.hallazgos : [];
      const planesData = Array.isArray(data.planes) ? data.planes : [];
      let planesPermitidos;
      let hallazgosPermitidos;
      let informesPermitidos;
// ============================================================================
      // NUEVO MOTOR UNIFICADO: VISIBILIDAD POR IDENTIDAD + HERENCIA DE CONTEXTO
      // ============================================================================
      
      // 1. ¿El usuario está involucrado directamente? (Por correo, cargo, proceso o subproceso)
      const tieneAccesoDirecto = (item) => {
        if (aplicarRLS([item], userEmail, userCargo, userProcesses).length > 0) return true;
        if (registroDentroDelAlcanceAsignado(item, userProcesses, userSubprocesses)) return true;
        return false;
      };

      // 2. Evaluamos los PLANES de Acción
      const planesConAccesoDirecto = planesData.filter(tieneAccesoDirecto);
      const idsHallazgosDesdePlanes = new Set(planesConAccesoDirecto.map(plan => String(plan.idHallazgo)));

      // 3. Evaluamos los HALLAZGOS (Visibles porque estoy en el proceso O porque heredo el acceso desde un Plan)
      hallazgosPermitidos = hallazgosData.filter(hallazgo => (
        tieneAccesoDirecto(hallazgo) || idsHallazgosDesdePlanes.has(String(hallazgo.id))
      ));
      const idsHallazgosAprobados = new Set(hallazgosPermitidos.map(h => String(h.id)));
      const idsInformesDesdeHallazgos = new Set(hallazgosPermitidos.map(hallazgo => String(hallazgo.idInforme)));

      // 4. Evaluamos los INFORMES (Visibles directamente O porque heredo el acceso desde un Hallazgo/Plan)
      informesPermitidos = informesData.filter(informe => (
        tieneAccesoDirecto(informe) || idsInformesDesdeHallazgos.has(String(informe.id))
      ));
      const idsInformesAprobados = new Set(informesPermitidos.map(i => String(i.id)));

      // 5. HERENCIA DESCENDENTE: Para dar "Todo el contexto", si el usuario puede ver un Informe, 
      // le mostramos también todos los Hallazgos y Planes que le pertenecen a ese Informe.
      hallazgosPermitidos = hallazgosData.filter(hallazgo => 
        idsInformesAprobados.has(String(hallazgo.idInforme)) || idsHallazgosAprobados.has(String(hallazgo.id))
      );
      const idsHallazgosFinales = new Set(hallazgosPermitidos.map(h => String(h.id)));
      
      planesPermitidos = planesData.filter(plan => 
        idsHallazgosFinales.has(String(plan.idHallazgo)) || planesConAccesoDirecto.includes(plan)
      );

      // ============================================================================
      // EMPAQUETADO FINAL SEGURO
      // ============================================================================
      // 🛡️ H4: lista blanca explícita. Ningún campo nuevo del documento principal llega a un usuario
      // no administrador sin decidirlo aquí (antes se copiaba todo con ...data).
      const filteredData = {
        ...(data.revision ? { revision: data.revision } : {}),
        catalogosInicializados: data.catalogosInicializados === true,
        mapaProcesos: data.mapaProcesos && typeof data.mapaProcesos === 'object' ? data.mapaProcesos : {},
        sedesEmpresa: Array.isArray(data.sedesEmpresa) ? data.sedesEmpresa : [],
        auditoresLista: Array.isArray(data.auditoresLista) ? data.auditoresLista : [],
        catalogoCargos: catalogoCargosSeguro,
        
        // Colecciones con Herencia Relacional
        informesAuditoria: informesPermitidos,
        hallazgos: hallazgosPermitidos,
        planes: planesPermitidos,
        
        // La matriz de riesgos es corporativa y de consulta completa para todo usuario autenticado.
        riesgos: Array.isArray(data.riesgos) ? data.riesgos : [],

        // Colecciones con RLS Estándar
        evaluaciones: aplicarRLS(data.evaluaciones, userEmail, userCargo, userProcesses),
        incidentes: aplicarRLS(data.incidentes, userEmail, userCargo, userProcesses),
        
        // Catálogo de configuración (tipos de fuente), necesario para los formularios.
        fuentesMejora: data.fuentesMejora || [],

        // Módulo Auditorías: solo con permiso y, en programas, solo los de su proceso.
        programas: puedeVerProgramas ? (Array.isArray(data.programas) ? data.programas : []).filter(tieneAccesoDirecto) : [],
        cronograma: puedeVerCronograma ? data.cronograma || [] : [],
        // Indicadores: los de su proceso y los corporativos (sin proceso asignado).
        monitoreo: (Array.isArray(data.monitoreo) ? data.monitoreo : [])
          .filter(indicador => !String(indicador?.proceso || '').trim() || tieneAccesoDirecto(indicador)),

        // Módulo Gobernanza: las sesiones de comité no tienen proceso; se entregan solo con el permiso.
        comites: puedeVerComites ? data.comites || [] : [],
      };

      logger.info('Datos entregados con políticas RLS RELACIONAL aplicadas.', { usuario: userEmail });
      return sendSuccess(res, filteredData);
    }

    // =========================================================================
    // 🛡️ LÓGICA POST: ESCRITURA ESTRICTA
    // =========================================================================
    if (req.method === 'POST') {
      if (!esAdministradorPleno) {
        logger.warn('Intento de escritura RLS denegado', { usuario: user.email, rol: user.rol });
        return sendError(res, 'Permisos insuficientes. Solo administradores pueden modificar la estructura GRC.', 403);
      }

      if (Object.hasOwn(req.body?.partialData || {}, 'planesAccion')) {
        return sendError(res, 'Usa la colección planes para guardar acciones y validar su flujo.', 400);
      }
      // 🛡️ H10: lista blanca de claves y tipos antes de escribir. H13: solo enlaces http/https en campos URL.
      const validacion = validarDatosSync(req.body?.partialData);
      if (!validacion.valido) {
        logger.warn('Guardado rechazado por validación de esquema', { usuario: user.email, motivo: validacion.error });
        return sendError(res, validacion.error, 400);
      }
      const partialData = sanitizarUrls(req.body.partialData);

      const workspaceActual = Array.isArray(partialData.planes)
        ? (await leerWorkspaceGrc(null, { origen: 'sync-post-validacion' })).data
        : null;

      if (hayConflictosDeRolesEnPlanesActualizados(partialData.planes, workspaceActual)) {
        return sendError(res, 'Ejecutor, revisor y auditor deben ser personas distintas. Revisa los correos asignados.', 400);
      }

      if (!usuarioPuedeEvaluarPlanes(partialData, user, workspaceActual)) {
        logger.warn('Intento de evaluación de plan sin asignación autorizada', { usuario: user.email });
        return sendError(res, 'La asignación, transición o evaluación del plan no está autorizada. El ejecutor no puede cambiar los cargos ni correos asignados; las evaluaciones corresponden a la persona asignada.', 403);
      }

      await guardarWorkspaceParcial(partialData);
      await notificarSemaforo();

      logger.info('Estructura GRC actualizada por administrador', { usuario: user.email });
      return sendSuccess(res, { message: 'Guardado exitoso.' });
    }

  } catch (error) {
    // Imprimimos el error como texto plano para que Vercel no lo oculte
    console.error("=== ALERTA DE ERROR EN SYNC.JS ===");
    console.error("MOTIVO EXACTO DEL FALLO: " + error.message);
    console.error("LÍNEA DEL ERROR (STACK): " + error.stack);
    console.error("==================================");

    // Devolvemos la respuesta de error genérica al frontend
    return res.status(500).json({ 
      success: false, 
      message: 'Error interno al procesar la base de datos.'
    });
  }
}