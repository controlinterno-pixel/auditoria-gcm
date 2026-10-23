// tests/explicacionControles.test.js - Eficacia y residual según el Manual de Riesgos E-GE-MAN-001, y explicaciones.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calcularEficaciaControl, calcularResiduales, desglosarEficaciaControl, explicarCalculoResidual, explicarControl,
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

test('explicación de un control: cálculo, techo, formalización y mejoras', () => {
  const manual = explicarControl(control());
  assert.equal(manual.eficacia, 40);
  assert.equal(manual.estado, 'mejorable');
  assert.equal(manual.formal, true);
  assert.match(manual.resumen, /reduce en un 40% la probabilidad/);
  assert.equal(manual.calculo, '40% = Preventivo 25% + Manual 15% (Tabla 6 del manual).');
  assert.match(manual.techo, /^Tiene 40 de 50 puntos posibles para un control preventivo \(80% del máximo\)\..*si se automatizara subiría a 50%/);
  assert.deepEqual(manual.mejoras.map(mejora => mejora.efecto), ['subiría de 40% a 50%']);

  const informal = explicarControl(control({ documentacion: 'No documentado', evidencia: 'Sin registro' }));
  assert.equal(informal.formal, false);
  assert.match(informal.formalizacion, /no está documentado.*y no deja registro/);
  assert.equal(informal.mejoras.length, 3);

  const correctivo = explicarControl(control({ tipo: 'Correctivo', implementacion: 'Automático' }));
  assert.equal(correctivo.estado, 'maximo');
  assert.match(correctivo.resumen, /reduce en un 35% la gravedad del daño/);
  assert.deepEqual(correctivo.mejoras, []);
});

test('desglose residual del ejemplo del manual: zona Alta y plan de acción', () => {
  const exp = {
    probInh: 60, impInh: 80, probFinal: 25, impFinal: 80,
    pasosP: [{ codigo: 'CTL-21', eficacia: 40, despues: 36 }, { codigo: 'CTL-22', eficacia: 30, despues: 25.2 }],
    pasosI: [],
  };
  const lectura = explicarCalculoResidual(exp, { probabilidadInherente: 60, impactoInherente: 80, probabilidadResidual: 25, impactoResidual: 80 });
  assert.match(lectura.probabilidad[0], /60% \(Media\): la actividad con riesgo se ejecuta de 24 a 500 veces al año/);
  assert.match(lectura.probabilidad[1], /CTL-21 \(40%\) la deja en 36%; CTL-22 \(30%\) la deja en 25.2%/);
  assert.equal(lectura.probabilidad[2], 'Probabilidad residual: 25% (Baja).');
  assert.match(lectura.probabilidad[3], /Si CTL-21 dejara de aplicarse, la probabilidad subiría a 42%/);
  assert.match(lectura.impacto[0], /80% \(Mayor\): entre 100 y 500 SMLMV/);
  assert.match(lectura.impacto[1], /No tiene controles correctivos/);
  assert.equal(lectura.zonaInherente, 'Alto');
  assert.equal(lectura.zonaResidual, 'Alto', 'Figura 10: Baja × Mayor sigue en zona alta');
  assert.match(lectura.conclusion, /sigue en zona Alto.*debe definir un plan de acción/);
  assert.equal(lectura.aviso, '');
});

test('el aviso indica cuando el residual guardado se calculó con la regla anterior', () => {
  const exp = { probInh: 60, impInh: 60, probFinal: 13, impFinal: 45, pasosP: [], pasosI: [] };
  const lectura = explicarCalculoResidual(exp, { probabilidadInherente: 60, impactoInherente: 60, probabilidadResidual: 0, impactoResidual: 24 });
  assert.match(lectura.aviso, /guardado en la matriz \(0% \/ 24%\) se calculó con la regla anterior; según el manual es 13% \/ 45%/);
});
