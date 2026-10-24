// tests/explicacionControles.test.js - Eficacia y residual según el Manual de Riesgos E-GE-MAN-001, y explicaciones.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calcularEficaciaControl, calcularResiduales, desglosarEficaciaControl, explicarCalculoResidual, explicarControl, tonoDiseno,
} from '../src/utils/explicacionControles.js';

const control = extra => ({ tipo: 'Preventivo', implementacion: 'Manual', documentacion: 'Documentado', frecuencia: 'Continua', evidencia: 'Con registro', ...extra });

test('Tabla 6 / Tabla 7: solo pesan tipo e implementación', () => {
  assert.equal(calcularEficaciaControl(control()), 40, 'Control 1 del manual: preventivo manual = 40 %');
  assert.equal(calcularEficaciaControl(control({ tipo: 'Detectivo' })), 30, 'Control 2 del manual: detectivo manual = 30 %');
  assert.equal(calcularEficaciaControl(control({ tipo: 'Correctivo' })), 25);
  assert.equal(calcularEficaciaControl(control({ implementacion: 'Automático' })), 50);
  assert.equal(calcularEficaciaControl(control({ documentacion: 'No documentado', frecuencia: 'Aleatoria', evidencia: 'Sin registro' })), 40,
    'documentación, frecuencia y evidencia son informativos: no cambian el porcentaje');
  assert.equal(calcularEficaciaControl({}), 40);
  assert.equal(desglosarEficaciaControl(control({ tipo: 'Detectivo' })).maximoPosible, 40);
});

test('Tabla 8: mitigación acumulativa del ejemplo del manual', () => {
  const resultado = calcularResiduales(60, 80, [control(), control({ tipo: 'Detectivo' })]);
  assert.deepEqual(resultado, { probabilidadResidual: 25, impactoResidual: 80 }, '60 % → 36 % → 25,2 %; sin correctivos el impacto queda en 80 %');
  assert.deepEqual(calcularResiduales(60, 60, [control({ tipo: 'Correctivo' })]), { probabilidadResidual: 60, impactoResidual: 45 });
});

test('lectura de un control: solo sus datos, sus fallas y cómo mejorarlo', () => {
  const manual = explicarControl(control());
  assert.equal(manual.resumen, 'Reduce 40% la probabilidad.');
  assert.equal(manual.calculo, 'Preventivo 25% + Manual 15% = 40% (40 de 50 puntos · 80% del máximo).');
  assert.equal(manual.formalizacion, '', 'si cumple todo, no agrega texto');
  assert.deepEqual(manual.mejoras, [{ texto: 'Automatizarlo', efecto: 'subiría de 40% a 50%' }]);

  const informal = explicarControl(control({ frecuencia: 'Aleatoria', evidencia: 'Sin registro' }));
  assert.match(informal.formalizacion, /^Se aplica de forma aleatoria: las veces que no se aplica, el riesgo queda sin cubrir\. No deja registro/);
  assert.deepEqual(informal.mejoras.map(mejora => mejora.texto), ['Automatizarlo', 'Aplicarlo cada vez que se realiza la actividad con riesgo.', 'Dejar registro de cada ejecución.']);

  const correctivo = explicarControl(control({ tipo: 'Correctivo', implementacion: 'Automático' }));
  assert.equal(correctivo.resumen, 'Reduce 35% el impacto.');
  assert.deepEqual(correctivo.mejoras, []);
});

const hoy = new Date('2026-10-23T12:00:00');
const pasos = (lista) => lista.map(([codigo, eficacia, despues]) => ({ codigo, eficacia, despues }));

test('lectura del residual: cuánto bajó, de qué control depende y qué falta (plan y seguimiento)', () => {
  // Caso de la captura: 4 preventivos manuales y 1 correctivo; zona Moderado.
  const exp = {
    probInh: 60, impInh: 60, probFinal: 8, impFinal: 45,
    pasosP: pasos([['CTL-5-1', 40, 36], ['CTL-5-2', 40, 21.6], ['CTL-5-3', 40, 12.96], ['CTL-5-4', 40, 7.78]]),
    pasosI: pasos([['CTL-5-5', 25, 45]]),
  };
  const controles = [control(), control({ frecuencia: 'Aleatoria' }), control(), control(), control({ tipo: 'Correctivo' })];
  const lectura = explicarCalculoResidual(exp, { id: 5, controlesDetallados: controles }, { hoy });
  assert.deepEqual(lectura.probabilidad, [
    'Baja de 60% a 8% (Muy baja) con 4 controles: CTL-5-1, CTL-5-2, CTL-5-3, CTL-5-4.',
    'Si CTL-5-1 deja de aplicarse, la probabilidad sube a 13%.',
  ]);
  assert.deepEqual(lectura.impacto, [
    'Baja de 60% a 45% (Moderado) con CTL-5-5.',
    'Depende solo de CTL-5-5: si falla, el impacto vuelve a 60%.',
  ]);
  assert.equal(lectura.conclusion,
    'Sigue en zona Moderado. No tiene fecha de seguimiento programada y en zona Moderado el manual exige seguimiento. Controles con fallas de formalización: CTL-5-2 (frecuencia aleatoria).');
});

test('zona Alta: exige plan de acción y avisa si el seguimiento venció', () => {
  const exp = { probInh: 60, impInh: 80, probFinal: 25, impFinal: 80, pasosP: pasos([['CTL-5-1', 40, 36], ['CTL-5-2', 30, 25.2]]), pasosI: [] };
  const sinPlan = explicarCalculoResidual(exp, { fechaSeguimiento: '2026-09-30' }, { hoy });
  assert.equal(sinPlan.impacto[0], 'Ningún control correctivo: si el riesgo ocurre, el impacto sigue en 80% (Mayor).');
  assert.equal(sinPlan.conclusion,
    'Sigue en zona Alto. No tiene plan de acción registrado y en zona Alto es obligatorio (numeral 9 del manual). El seguimiento programado venció el 2026-09-30.');
  assert.equal(sinPlan.requierePlan, true);
  assert.equal(sinPlan.seguimientoVencido, true);

  const conPlan = explicarCalculoResidual(exp, { planAccionRiesgo: 'Implementar lista de chequeo en Zeus', fechaSeguimiento: '2026-11-15' }, { hoy });
  assert.match(conPlan.conclusion, /Plan de acción registrado: "Implementar lista de chequeo en Zeus"\. Próximo seguimiento: 2026-11-15\./);
});

test('sin controles: lo dice sin texto genérico', () => {
  const lectura = explicarCalculoResidual({ probInh: 40, impInh: 40, probFinal: 40, impFinal: 40, pasosP: [], pasosI: [] }, { fechaSeguimiento: '2026-12-01' }, { hoy });
  assert.deepEqual(lectura.probabilidad, ['Ningún control preventivo o detectivo: la probabilidad sigue en 40%.']);
  assert.equal(lectura.conclusion, 'Sigue en zona Moderado. Próximo seguimiento: 2026-12-01.');
});

test('el aviso indica cuando el residual guardado no coincide con el cálculo', () => {
  const exp = { probInh: 60, impInh: 60, probFinal: 13, impFinal: 45, pasosP: [], pasosI: [] };
  const lectura = explicarCalculoResidual(exp, { probabilidadInherente: 60, impactoInherente: 60, probabilidadResidual: 0, impactoResidual: 24 }, { hoy });
  assert.match(lectura.aviso, /guardado en la matriz \(0% \/ 24%\) no coincide con este cálculo \(13% \/ 45%\)/);
});

test('color del diseño: verde ≥ 80 %, ámbar 60–79 %, rojo < 60 %', () => {
  assert.deepEqual([100, 80, 79, 60, 59].map(tonoDiseno), ['verde', 'verde', 'ambar', 'ambar', 'rojo']);
  assert.equal(explicarControl(control()).porcentajeDelMaximo, 80, 'preventivo manual: 40 de 50');
  assert.equal(explicarControl(control({ tipo: 'Detectivo' })).porcentajeDelMaximo, 75, 'detectivo manual: 30 de 40');
  assert.equal(explicarControl(control({ tipo: 'Correctivo' })).porcentajeDelMaximo, 71, 'correctivo manual: 25 de 35');
  assert.deepEqual(explicarControl(control({ frecuencia: 'Aleatoria', evidencia: 'Sin registro' })).faltantes, ['Frecuencia aleatoria', 'Sin registro']);
});
