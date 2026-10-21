export const ESTADO_EVALUACION_INICIAL = 'Pendiente Evaluación Auditor';
export const ESTADO_AJUSTES_INICIALES = 'Requiere Ajustes Auditor';
export const TIPO_EVALUACION_INICIAL = 'evaluacion-inicial-diseno';

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

export function bloqueadaParaEjecutor(plan, correoUsuario) {
  const correo = normalizar(correoUsuario);
  const ejecutores = String(plan?.correoResponsable || '').split(',').map(normalizar).filter(Boolean);
  return Boolean(correo && ejecutores.includes(correo) && ejecucionEnviadaARevision(plan));
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
