// Tarjetas de "Ver matriz": el residual promedio sale de la Tabla 4 y cada explicación usa los riesgos del filtro.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  explicarAltosExtremos, explicarControlesMatriz, explicarResidualPromedio, explicarTotalRiesgos, nivelResidualPromedio,
} from '../src/utils/explicacionKpiMatriz.js';

const control = (tipo, implementacion, extra = {}) => ({ descripcion: 'x', tipo, implementacion, ...extra });
const riesgos = [
  { id: 465, macroprocesos: ['Financiera'], subprocesos: ['Cartera'], clasificacionRiesgo: 'Operativo', probabilidadResidual: 1, impactoResidual: 34,
    probabilidadInherente: 60, impactoInherente: 60, controlesDetallados: [control('Preventivo', 'Manual'), control('Detectivo', 'Automático'), control('Preventivo', 'Automático', { estado: 'Anulado' })] },
  { id: 470, macroprocesos: ['Financiera'], subprocesos: ['Cartera'], clasificacionRiesgo: 'Operativo', probabilidadResidual: 20, impactoResidual: 80,
    probabilidadInherente: 60, impactoInherente: 80, controlesDetallados: [control('Correctivo', 'Manual')] },
  { id: 471, macroprocesos: ['Financiera'], subprocesos: ['Tesorería'], probabilidadResidual: 10, impactoResidual: 20, probabilidadInherente: 40, impactoInherente: 40, controlesDetallados: [] },
  { id: 472, macroprocesos: ['Financiera'], subprocesos: ['Tesorería'], probabilidadResidual: '', impactoResidual: '', descripcionControl: 'Conciliación mensual' },
];
const alcance = 'Financiera';
const planes = [{ id: 'p1', matrizRiesgos: 'Sí aplica', riesgosVinculados: ['470'], estadoWorkflow: 'En ejecución' }];

// 1. El promedio usa la Tabla 4 (no P×I con cortes propios): P 10 % (Muy baja) e I 45 % (Moderado) = Moderado.
const promedio = nivelResidualPromedio(riesgos);
assert.equal(promedio.conDatos.length, 3);
assert.equal(Math.round(promedio.p * 10) / 10, 10.3);
assert.equal(Math.round(promedio.i), 45);
assert.equal(promedio.zona, 'Moderado');
// Con impacto Mayor (80 %) es Alto aunque la probabilidad sea baja; antes daba 16 → "Moderado".
assert.equal(nivelResidualPromedio([riesgos[1]]).zona, 'Alto');
// Importados en niveles 1–5: nivel × 20 %.
assert.equal(nivelResidualPromedio([{ id: 1, probabilidadResidual: 2, impactoResidual: 4, probabilidadInherente: 3, impactoInherente: 4 }]).i, 80);
assert.equal(nivelResidualPromedio([]).zona, null);

// 2. Explicación del promedio: valores reales, reparto y el riesgo alto que el promedio esconde.
const residual = explicarResidualPromedio({ riesgos, alcance });
assert.equal(residual.valor, 'Moderado');
assert.ok(residual.lineas.some(linea => linea.includes('RSK-472')), 'avisa el que no tiene datos');
assert.match(residual.accion, /RSK-470 está en zona Alto/);

// 3. Altos y extremos: cálculo por riesgo y plan de acción (numeral 9).
const altos = explicarAltosExtremos({ riesgos, alcance, planes });
assert.equal(altos.valor, '1');
assert.ok(altos.lineas.some(linea => linea.startsWith('RSK-470: probabilidad 20 % (Muy baja) × impacto 80 % (Mayor) → Alto. Plan de acción: sí')));
assert.match(altos.accion, /Tiene plan de acción/);
assert.match(explicarAltosExtremos({ riesgos, alcance }).accion, /falta en RSK-470/);

// 4. Total: por subproceso, clasificación y zona; anulados aparte.
const total = explicarTotalRiesgos({ riesgos, alcance, totalMatriz: 70, anuladosFiltro: 1, porSubproceso: true });
assert.ok(total.lineas[0].includes('4 de los 70'));
assert.ok(total.lineas.some(linea => linea === 'Por subproceso: Cartera (2), Tesorería (2).'));
assert.ok(total.lineas.some(linea => linea.includes('1 riesgo anulado coincide')));
assert.match(total.accion, /RSK-472 no tiene probabilidad o impacto residual/);

// 5. Controles: mismo conteo de la tarjeta (vigentes + texto anterior), sin anulados.
const controles = explicarControlesMatriz({ riesgos, alcance });
assert.equal(controles.valor, '4');
assert.ok(controles.lineas.some(linea => linea.includes('1 control anulado no se cuenta')));
assert.match(controles.accion, /RSK-471 no tiene controles/);

// 6. La tarjeta usa estas funciones y ya no los cortes 40/25/12.
const vista = readFileSync(new URL('../src/components/Riesgos.jsx', import.meta.url), 'utf8');
assert.ok(vista.includes('nivelResidualPromedio(riesgosKpi)'));
assert.ok(!vista.includes('avgResidualScore'));
['explicarTotalRiesgos', 'explicarAltosExtremos', 'explicarResidualPromedio', 'explicarControlesMatriz']
  .forEach(nombre => assert.ok(vista.includes(`setExplicacionDashboard(${nombre}(`), nombre));

console.log('explicacionKpiMatriz.test.js: OK (Tabla 4 en el promedio y explicaciones con los riesgos del filtro)');
