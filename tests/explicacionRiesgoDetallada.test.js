// "Explícame este riesgo": la explicación sale de los datos del riesgo (caso real RSK-196 y un caso Moderado).
import assert from 'node:assert/strict';
import { explicarRiesgoDetallado } from '../src/utils/explicacionRiesgoDetallada.js';

let pruebas = 0;
const prueba = (nombre, fn) => { fn(); pruebas += 1; };

const rsk196 = explicarRiesgoDetallado({
  probabilidadInherente: 100, impactoInherente: 100, planAccionRiesgo: '', fechaSeguimiento: '',
  controlesDetallados: [{ tipo: 'Preventivo (Foco Probabilidad)', implementacion: 'Manual', documentacion: 'Documentado', frecuencia: 'Continua / Permanente', evidencia: 'Con registro / Trazable' }],
});

prueba('RSK-196: cálculo de probabilidad paso a paso', () => {
  assert.ok(rsk196.probabilidad.includes('CTL-21 — Preventivo manual (25 + 15 = 40 %): 100 % − 100 % × 40 % = 60 %.'));
  assert.ok(rsk196.probabilidad.some(l => l.startsWith('Toda la reducción depende de CTL-21')));
});

prueba('RSK-196: impacto sin correctivos y zona Extremo por la Tabla 4', () => {
  assert.equal(rsk196.impactoResidual, 100);
  assert.equal(rsk196.zonaResidual, 'Extremo');
  assert.ok(rsk196.zona.some(l => l.includes('Con impacto Catastrófico')));
});

prueba('RSK-196: pendientes del numeral 9', () => {
  assert.ok(rsk196.pendientes.some(l => l.startsWith('Plan de acción')));
  assert.ok(rsk196.pendientes.some(l => l.startsWith('Fecha de seguimiento')));
});

prueba('RSK-196: simulación de mejoras con correctivos', () => {
  assert.equal(rsk196.mejoras[0].accion, 'Si se agregan 2 controles correctivos manuales');
  assert.match(rsk196.mejoras[0].resultado, /zona Moderado$/);
  assert.ok(rsk196.mejoras.every(m => m.bajaZona));
});

prueba('riesgo en Bajo: sin mejoras y con nota de mantener', () => {
  const r = explicarRiesgoDetallado({ probabilidadInherente: 20, impactoInherente: 20, controlesDetallados: [], fechaSeguimiento: '2026-12-01' }, { hoy: new Date('2026-10-24') });
  assert.equal(r.zonaResidual, 'Bajo');
  assert.equal(r.mejoras.length, 0);
  assert.match(r.notaMejoras, /zona más baja/);
});

console.log(`explicacionRiesgoDetallada.test.js: ${pruebas} pruebas OK`);
