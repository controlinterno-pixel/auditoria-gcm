export const ESTADO_EVALUACION_INICIAL = 'Pendiente Evaluación Auditor';
export const ESTADO_AJUSTES_INICIALES = 'Requiere Ajustes Auditor';
export const TIPO_EVALUACION_INICIAL = 'evaluacion-inicial-diseno';

const normalizar = valor => String(valor || '').trim().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

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

export function calcularPuntajeDiseno(criterios) {
  const pesos = { c1: 0.3, c2: 0.2, c3: 0.2, c4: 0.2, c5: 0.1 };
  if (!criterios || Object.keys(pesos).some(clave => (
    typeof criterios[clave] !== 'number' || !Number.isFinite(criterios[clave]) ||
    criterios[clave] < 0 || criterios[clave] > 100
  ))) throw new Error('Los cinco criterios deben ser números entre 0 y 100.');
  return Math.round(Object.entries(pesos).reduce((total, [clave, peso]) => total + criterios[clave] * peso, 0));
}
