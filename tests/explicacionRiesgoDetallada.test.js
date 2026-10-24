// "Explícame este riesgo": la explicación sale de los datos del riesgo (caso real RSK-196 y un caso Moderado).
import assert from 'node:assert/strict';
import { explicarRiesgoDetallado, pruebasDeCampoDelRiesgo } from '../src/utils/explicacionRiesgoDetallada.js';

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

prueba('RSK-2: probabilidad ya en nivel mínimo y redondeo explicado', () => {
  const P = (documentacion = 'Documentado', evidencia = 'Con registro / Trazable') => ({ tipo: 'Preventivo (Foco Probabilidad)', implementacion: 'Manual', documentacion, frecuencia: 'Continua / Permanente', evidencia });
  const r = explicarRiesgoDetallado({ probabilidadInherente: 20, impactoInherente: 60, fechaSeguimiento: '',
    controlesDetallados: [P(), P(), P(), P(), P(), P('No documentado', 'Sin registro'), { tipo: 'Correctivo (Foco Impacto)', implementacion: 'Manual', documentacion: 'Documentado', frecuencia: 'Continua / Permanente', evidencia: 'Con registro / Trazable' }] });
  assert.equal(r.zonaResidual, 'Moderado');
  assert.ok(r.probabilidad.includes('Resultado: 1 % (Muy baja); el cálculo da 0,9 % y la matriz lo guarda redondeado.'));
  assert.ok(r.probabilidad.some(l => l.includes('que ya era el más bajo de la escala')));
  assert.ok(r.zona.some(l => l.includes('hay que reducir el impacto con controles correctivos')));
  assert.ok(r.mejoras[0].accion.startsWith('Si se agrega 1 control correctivo manual') && r.mejoras[0].resultado.endsWith('zona Bajo'));
});

prueba('control reprobado en Trabajo de Campo: usa la última prueba y muestra el residual sin él', () => {
  const evaluaciones = [
    { id: Date.parse('2026-08-05T15:00:00Z'), idRiesgo: '2', control: 'CTL-2-1', calificacion: 50, diseno: 'Adecuado', ejecucion: 'Inefectiva' },
    { id: Date.parse('2026-06-01T15:00:00Z'), idRiesgo: '2', control: 'CTL-2-1', calificacion: 100 },
    { id: Date.parse('2026-08-05T15:00:00Z'), idRiesgo: '9', control: 'CTL-9-1', calificacion: 0 },
  ];
  const pruebasCampo = pruebasDeCampoDelRiesgo(evaluaciones, 2);
  assert.equal(pruebasCampo.size, 1);
  assert.equal(pruebasCampo.get(0).calificacion, 50);
  const P = () => ({ tipo: 'Preventivo', implementacion: 'Manual' });
  const r = explicarRiesgoDetallado({ probabilidadInherente: 20, impactoInherente: 60, fechaSeguimiento: '2026-12-01',
    controlesDetallados: [P(), P(), P(), P(), P(), P(), { tipo: 'Correctivo', implementacion: 'Manual' }] }, { pruebasCampo, hoy: new Date('2026-10-24') });
  const aviso = r.pendientes.find(l => l.startsWith('CTL-21 fue reprobado en Trabajo de Campo el 2026-08-05'));
  assert.ok(aviso, 'debe avisar el control reprobado');
  assert.match(aviso, /la probabilidad quedaría en 2 % en lugar de 1 %/);
});

console.log(`explicacionRiesgoDetallada.test.js: ${pruebas} pruebas OK`);
