// ✅ Cumplimiento del numeral 9 del Manual E-GE-MAN-001 en la matriz: qué riesgos incumplen y por qué.
//   - Residual Extremo o Alto → debe tener plan de acción.
//   - Residual Moderado o Bajo → debe tener fecha de seguimiento.
//   - Controles reprobados en Trabajo de Campo (última prueba < 100 %) que siguen contando en el residual.
import { riesgoEnPorcentaje, zonaSeveridad } from './nivelRiesgo.js';
import { estaAnulado } from './anulacion.js';
import { pruebasDeCampoDelRiesgo } from './explicacionRiesgoDetallada.js';

export const CRITERIOS_CUMPLIMIENTO = {
  'sin-plan': {
    titulo: 'Extremo o Alto sin plan de acción',
    regla: 'Numeral 9: en zona residual Extremo o Alto el dueño del proceso debe definir un plan de acción.',
  },
  'sin-seguimiento': {
    titulo: 'Moderado o Bajo sin fecha de seguimiento',
    regla: 'Numeral 9: en zona residual Moderado o Bajo el dueño del proceso debe hacer seguimiento.',
  },
  reprobados: {
    titulo: 'Con controles reprobados en campo',
    regla: 'La última prueba de Trabajo de Campo del control fue menor a 100 %, pero el control sigue contando en el residual.',
  },
};

const zonaResidual = riesgo => zonaSeveridad(riesgo.probabilidadResidual, riesgo.impactoResidual, riesgoEnPorcentaje(riesgo)).label;

/** ¿El riesgo incumple el criterio? */
export function incumpleCriterio(riesgo, criterio, evaluaciones = []) {
  if (!riesgo || estaAnulado(riesgo)) return false;
  const zona = zonaResidual(riesgo);
  if (criterio === 'sin-plan') return ['Extremo', 'Alto'].includes(zona) && !String(riesgo.planAccionRiesgo || '').trim();
  if (criterio === 'sin-seguimiento') return ['Moderado', 'Bajo'].includes(zona) && !String(riesgo.fechaSeguimiento || '').trim();
  if (criterio === 'reprobados') {
    const controles = Array.isArray(riesgo.controlesDetallados) ? riesgo.controlesDetallados : [];
    const pruebas = pruebasDeCampoDelRiesgo(evaluaciones, riesgo.id);
    return [...pruebas].some(([indice, prueba]) => prueba.calificacion < 100 && controles[indice] && !estaAnulado(controles[indice]));
  }
  return false;
}

/** Riesgos que incumplen cada criterio. */
export function cumplimientoNumeral9(riesgos = [], evaluaciones = []) {
  return Object.fromEntries(Object.keys(CRITERIOS_CUMPLIMIENTO).map(criterio => [
    criterio,
    riesgos.filter(riesgo => incumpleCriterio(riesgo, criterio, evaluaciones)),
  ]));
}
