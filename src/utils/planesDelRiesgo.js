// 🔗 Planes de acción de un riesgo (numeral 9 del Manual E-GE-MAN-001): el texto del campo "Plan de acción"
// del riesgo y las acciones del módulo de Planes que lo vinculan ("Matriz de riesgos: Sí aplica" + riesgo
// elegido). Sin dependencias, para que lo usen el cálculo, los dictámenes y el Excel.

const planNoCuenta = plan => !plan || plan.estadoWorkflow === 'No aplica' || plan.noAplica === true || plan.estado === 'Anulado';
const codigoPlan = plan => `PLA-${String(plan.id).slice(-4)}`;

/** Acciones del módulo de Planes vinculadas al riesgo (sin las declaradas No aplica ni las anuladas). */
export function planesVinculadosAlRiesgo(riesgo, planes = []) {
  const id = String(riesgo?.id ?? '');
  if (!id) return [];
  return (Array.isArray(planes) ? planes : []).filter(plan => !planNoCuenta(plan)
    && plan.matrizRiesgos === 'Sí aplica'
    && Array.isArray(plan.riesgosVinculados) && plan.riesgosVinculados.map(String).includes(id));
}

/** ¿El riesgo tiene plan de acción? (texto en el riesgo o al menos una acción vinculada). */
export function tienePlanDeAccion(riesgo, planes = []) {
  return Boolean(String(riesgo?.planAccionRiesgo || '').trim()) || planesVinculadosAlRiesgo(riesgo, planes).length > 0;
}

/** Texto del plan para mostrar: el del riesgo y, después, las acciones vinculadas con su estado. */
export function textoPlanDeAccion(riesgo, planes = [], { max = 4 } = {}) {
  const texto = String(riesgo?.planAccionRiesgo || '').trim();
  const vinculados = planesVinculadosAlRiesgo(riesgo, planes);
  const acciones = vinculados.slice(0, max).map(plan => `${codigoPlan(plan)}: ${String(plan.accion || '').trim().slice(0, 120)} (${plan.estadoWorkflow || plan.estado || 'Sin estado'})`);
  if (vinculados.length > max) acciones.push(`y ${vinculados.length - max} más`);
  return [texto, acciones.length ? `Acciones vinculadas en Planes: ${acciones.join('; ')}` : ''].filter(Boolean).join(' · ');
}
