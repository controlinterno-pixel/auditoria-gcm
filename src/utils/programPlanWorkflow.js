export const ESTADO_EVALUACION_INICIAL = 'Pendiente Evaluación Auditor';
export const ESTADO_AJUSTES_INICIALES = 'Requiere Ajustes Auditor';
export const TIPO_EVALUACION_INICIAL = 'evaluacion-inicial-diseno';

// 👤 Revisor "No aplica": procesos de una sola persona. La acción registrada pasa directo a ejecución y, al 100 %,
// directo al auditor aprobador (sin los dos pasos del revisor). Exige explicar por qué.
export const MOTIVO_MINIMO_REVISOR_NO_APLICA = 10;
export const revisorNoAplica = plan => plan?.revisorNoAplica === true;
export const motivoRevisorNoAplicaValido = plan => !revisorNoAplica(plan) ||
  String(plan?.motivoRevisorNoAplica || '').trim().length >= MOTIVO_MINIMO_REVISOR_NO_APLICA;
/** Estado de una acción recién registrada. Los Programas de Auditoría siempre pasan por la evaluación del auditor. */
export const estadoInicialPlan = (esPrograma, plan) => (esPrograma
  ? ESTADO_EVALUACION_INICIAL
  : revisorNoAplica(plan) ? 'En Ejecución' : 'Pendiente Revisión Jefatura');
/** Estado al reportar el 100 %: validación del revisor o, sin revisor, aprobación del auditor. */
export const estadoAlCien = plan => (revisorNoAplica(plan) ? 'En Revisión (100%)' : 'Pendiente Validación Revisor');

const normalizar = valor => String(valor || '').trim().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function puedeEditarAsignacionPlan(plan, correoUsuario, esAdministrador) {
  if (!plan) return true;
  const correo = String(correoUsuario || '').trim().toLowerCase();
  const ejecutores = String(plan.correoResponsable || '').split(',').map(valor => valor.trim().toLowerCase()).filter(Boolean);
  return Boolean(esAdministrador && correo && !ejecutores.includes(correo));
}

const ESTADOS_EJECUCION_ENVIADA = ['Pendiente Validación Revisor', 'En Revisión (100%)', 'Pendiente Aprobación Auditor'];

// Ejecución reportada al 100%: el ejecutor ya no puede modificarla mientras sigue el flujo de revisión.
export function ejecucionEnviadaARevision(plan) {
  return Boolean(plan && Number(plan.progreso) === 100 && ESTADOS_EJECUCION_ENVIADA.includes(plan.estadoWorkflow));
}

// Cerrada con eficacia aprobada: ya no admite cambios del ejecutor.
export function accionCerrada(plan) {
  // "No aplica": acción cerrada porque el auditor aprobó que su hallazgo no aplica.
  return Boolean(plan && (plan.estadoWorkflow === 'Cerrado' || plan.estadoWorkflow === 'No aplica' || (!plan.estadoWorkflow && plan.estado === 'Cerrado')));
}

// El ejecutor solo trabaja lo que está en ejecución: lo enviado a revisión y lo cerrado queda bloqueado.
// Si el aprobador devuelve una acción, esa vuelve a "En Ejecución" y se desbloquea sin tocar las cerradas.
export function bloqueadaParaEjecutor(plan, correoUsuario) {
  const correo = normalizar(correoUsuario);
  const ejecutores = String(plan?.correoResponsable || '').split(',').map(normalizar).filter(Boolean);
  return Boolean(correo && ejecutores.includes(correo) && (ejecucionEnviadaARevision(plan) || accionCerrada(plan)));
}

const ESTADOS_POSTERIORES_A_APROBACION = ['En Ejecución', ...ESTADOS_EJECUCION_ENVIADA, 'Cerrado'];

// Aprobado el diseño, solo el ejecutor trabaja la acción: revisor y auditor aprobador solo la consultan,
// aunque tengan rol administrador.
export function bloqueadaParaRevisorOAuditor(plan, correoUsuario, correoAuditorInforme = '') {
  const correo = normalizar(correoUsuario);
  if (!correo || !plan || !ESTADOS_POSTERIORES_A_APROBACION.includes(plan.estadoWorkflow)) return false;
  const lista = valor => String(valor || '').split(',').map(normalizar).filter(Boolean);
  if (lista(plan.correoResponsable).includes(correo)) return false;
  return lista(plan.correoRevisor).includes(correo) ||
    lista(plan.correoAuditor || correoAuditorInforme).includes(correo);
}

export function esInformePrograma(informe, fuentes = []) {
  const referencia = normalizar(informe?.tipoFuente);
  if (!referencia) return false;
  if (referencia === 'programa de auditoria') return true;
  const fuente = fuentes.find(item => [item.id, item.codigo].some(valor => (
    valor != null && normalizar(valor) === referencia
  )));
  return normalizar(fuente?.tipoFuente || fuente?.tipo) === 'programa de auditoria';
}

export function pendienteEvaluacionInicial(plan) {
  return [
    ESTADO_EVALUACION_INICIAL, 'Pendiente Revisión Jefatura',
    'Pendiente Aprobación Auditor', 'Borrador',
  ].includes(plan?.estadoWorkflow);
}

// 🔁 Acción devuelta al ejecutor (diseño o evidencias rechazados): queda así hasta que el ejecutor la modifique.
const EVENTO_DEVOLUCION = /rechazad|devuelt|correcci[oó]n solicitada/i;
const ultimoEvento = plan => {
  const historial = Array.isArray(plan?.historialCambios) ? plan.historialCambios : [];
  return historial[historial.length - 1];
};
export function planDevueltoAlEjecutor(plan) {
  const estado = plan?.estadoWorkflow;
  const ultimoEsDevolucion = EVENTO_DEVOLUCION.test(String(ultimoEvento(plan)?.accion || ''));
  if (estado === ESTADO_AJUSTES_INICIALES) return true;
  if (estado === 'Borrador') return ultimoEsDevolucion || Boolean(String(plan?.motivoRechazo || '').trim());
  return estado === 'En Ejecución' && ultimoEsDevolucion;
}
export const motivoDevolucion = plan => String(ultimoEvento(plan)?.motivo || plan?.motivoRechazo || '').trim();

export function disenoInicialBloqueado(plan) {
  return pendienteEvaluacionInicial(plan) || plan?.estadoWorkflow === ESTADO_AJUSTES_INICIALES;
}

export function etapaAccionPrograma(plan) {
  if (pendienteEvaluacionInicial(plan)) return {
    clave: 'evaluacion', rol: 'auditor', titulo: 'Evaluación inicial pendiente',
    descripcion: 'El auditor asignado debe evaluar la matriz. La ejecución sigue bloqueada hasta aprobar con 80% o más.',
    boton: 'Evaluar matriz',
  };
  if (plan?.estadoWorkflow === ESTADO_AJUSTES_INICIALES) return {
    clave: 'correccion', rol: 'ejecutor', titulo: 'Corrige el diseño de la acción',
    descripcion: 'La evaluación inicial no fue aprobada. Guarda las correcciones para reenviarlas al auditor; todavía no puedes ejecutar.',
    boton: 'Corregir matriz',
  };
  if (plan?.estadoWorkflow === 'En Ejecución') return {
    clave: 'ejecucion', rol: 'ejecutor', titulo: 'Ejecución habilitada',
    descripcion: 'Registra el avance y las evidencias. Al guardar el 100%, la acción pasa al revisor; todavía no queda cerrada.',
    boton: 'Ejecutar acción',
  };
  if (plan?.estadoWorkflow === 'Pendiente Validación Revisor' && Number(plan.progreso) === 100) return {
    clave: 'revision', rol: 'revisor', titulo: 'Valida la ejecución al 100%',
    descripcion: 'Revisa las evidencias en la matriz. Tu aprobación remite las acciones pendientes de tu revisión al auditor asignado para el cierre final.',
    boton: 'Revisar matriz',
  };
  if (plan?.estadoWorkflow === 'En Revisión (100%)' && Number(plan.progreso) === 100) return {
    clave: 'cierre', rol: 'auditor', titulo: 'Acción lista para tu dictamen final',
    descripcion: 'El revisor aprobó la ejecución. Evalúa la eficacia y cierra esta acción individualmente, o devuélvela al ejecutor al 90% con un motivo.',
    boton: 'Evaluar y cerrar acción',
  };
  return null;
}

export function calcularPuntajeDiseno(criterios) {
  const pesos = { c1: 0.3, c2: 0.2, c3: 0.2, c4: 0.2, c5: 0.1 };
  if (!criterios || Object.keys(pesos).some(clave => (
    typeof criterios[clave] !== 'number' || !Number.isFinite(criterios[clave]) ||
    criterios[clave] < 0 || criterios[clave] > 100
  ))) throw new Error('Los cinco criterios deben ser números entre 0 y 100.');
  return Math.round(Object.entries(pesos).reduce((total, [clave, peso]) => total + criterios[clave] * peso, 0));
}
