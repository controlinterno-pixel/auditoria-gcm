// Tablero de cumplimiento del numeral 9: qué riesgos incumplen cada criterio.
import assert from 'node:assert/strict';
import { cumplimientoNumeral9, incumpleCriterio } from '../src/utils/cumplimientoManual.js';

const riesgos = [
  { id: 196, probabilidadResidual: 60, impactoResidual: 100, planAccionRiesgo: '', fechaSeguimiento: '', controlesDetallados: [{ tipo: 'Preventivo' }] },
  { id: 2, probabilidadResidual: 1, impactoResidual: 45, planAccionRiesgo: '', fechaSeguimiento: '', controlesDetallados: [{ tipo: 'Preventivo' }, { tipo: 'Preventivo' }] },
  { id: 9, probabilidadResidual: 4, impactoResidual: 23, fechaSeguimiento: '2026-12-01', controlesDetallados: [{ tipo: 'Preventivo' }] },
  { id: 65, probabilidadResidual: 60, impactoResidual: 80, planAccionRiesgo: 'Plan de capacitación', controlesDetallados: [] },
  { id: 99, estado: 'Anulado', probabilidadResidual: 60, impactoResidual: 100, planAccionRiesgo: '' },
  { id: 40, probabilidadResidual: 20, impactoResidual: 20, fechaSeguimiento: '2026-11-01', controlesDetallados: [{ tipo: 'Preventivo', estado: 'Anulado' }] },
];
const evaluaciones = [
  { id: Date.parse('2026-08-05T15:00:00Z'), idRiesgo: '2', control: 'CTL-2-1', calificacion: 50 },
  { id: Date.parse('2026-08-05T15:00:00Z'), idRiesgo: '9', control: 'CTL-9-1', calificacion: 100 },
  { id: Date.parse('2026-08-05T15:00:00Z'), idRiesgo: '40', control: 'CTL-40-1', calificacion: 0 },
];
const ids = lista => lista.map(r => r.id);
const resultado = cumplimientoNumeral9(riesgos, evaluaciones);

assert.deepEqual(ids(resultado['sin-plan']), [196], 'Extremo/Alto sin plan: RSK-196 (RSK-65 tiene plan; RSK-99 está anulado)');
assert.deepEqual(ids(resultado['sin-seguimiento']), [2], 'Moderado/Bajo sin fecha: RSK-2');
assert.deepEqual(ids(resultado.reprobados), [2], 'Reprobado en campo: RSK-2 (RSK-40 tiene el control reprobado anulado; RSK-9 aprobó)');
assert.equal(incumpleCriterio(riesgos[0], 'criterio-inexistente'), false);

console.log('cumplimientoManual.test.js: 4 comprobaciones OK');
