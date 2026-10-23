import assert from 'node:assert/strict';
import test from 'node:test';
import { nivelEscala, riesgoEnPorcentaje, zonaPorNiveles, zonaSeveridad, zonasRiesgo } from '../src/utils/nivelRiesgo.js';

test('riesgo en porcentaje: un residual pequeño es nivel 1, no nivel 4', () => {
  const riesgo = { probabilidadInherente: 20, impactoInherente: 60, probabilidadResidual: 4, impactoResidual: 60 };
  assert.equal(riesgoEnPorcentaje(riesgo), true);
  // Probabilidad Muy baja (4 %) con impacto Moderado (60 %): Tabla 4 del manual = Moderado.
  assert.equal(zonasRiesgo(riesgo).residual.label, 'Moderado');
  // Antes se leía P=4 como nivel 4 e I=60 como nivel 3: "Alto".
  assert.equal(zonaSeveridad(4, 60).label, 'Alto');
});

test('riesgo importado en niveles 1–5 conserva su lectura', () => {
  const importado = { probabilidadInherente: 4, impactoInherente: 5, probabilidadResidual: 2, impactoResidual: 3 };
  assert.equal(riesgoEnPorcentaje(importado), false);
  assert.equal(zonasRiesgo(importado).inherente.label, 'Extremo');
  assert.equal(zonasRiesgo(importado).residual.label, 'Moderado');
});

test('niveles por porcentaje y casos límite', () => {
  assert.deepEqual([0, 1, 20, 21, 40, 60, 80, 100, 140].map(valor => nivelEscala(valor, true)), [1, 1, 1, 2, 2, 3, 4, 5, 5]);
  assert.deepEqual([undefined, null, '', 'x', -3].map(valor => nivelEscala(valor, true)), [1, 1, 1, 1, 1]);
  assert.equal(nivelEscala(3, false), 3);
  assert.equal(zonasRiesgo({ probabilidadInherente: 80, impactoInherente: 100, probabilidadResidual: 24, impactoResidual: 60 }).inherente.label, 'Extremo');
  assert.equal(zonasRiesgo({ probabilidadInherente: 80, impactoInherente: 100, probabilidadResidual: 24, impactoResidual: 60 }).residual.label, 'Moderado');
  assert.equal(zonasRiesgo({}).residual.label, 'Bajo');
});

test('Tabla 4 del manual: las 25 celdas de la matriz de calor', () => {
  // Filas: probabilidad Muy alta → Muy baja. Columnas: impacto Leve → Catastrófico.
  const manual = {
    5: ['Alto', 'Alto', 'Alto', 'Alto', 'Extremo'],
    4: ['Moderado', 'Moderado', 'Alto', 'Alto', 'Extremo'],
    3: ['Moderado', 'Moderado', 'Moderado', 'Alto', 'Extremo'],
    2: ['Bajo', 'Moderado', 'Moderado', 'Alto', 'Extremo'],
    1: ['Bajo', 'Bajo', 'Moderado', 'Alto', 'Extremo'],
  };
  for (const [p, fila] of Object.entries(manual)) {
    fila.forEach((zona, columna) => assert.equal(zonaPorNiveles(Number(p), columna + 1), zona, `P${p} I${columna + 1}`));
  }
  // Ejemplo de la Tabla 8 / Figura 10: residual 25,2 % (Baja) con impacto 80 % (Mayor) = Alto.
  assert.equal(zonaSeveridad(25.2, 80, true).label, 'Alto');
});
