// Explicaciones del Dashboard de riesgos: salen de los datos del filtro, no de texto fijo.
import assert from 'node:assert/strict';
import {
  calificarEficacia, explicarControlesRegistrados, explicarEficaciaPromedio, explicarMayorExposicion,
  explicarMitigacionPromedio, explicarSeguimientos,
} from '../src/utils/explicacionDashboardRiesgos.js';
import { zonaPorNiveles } from '../src/utils/nivelRiesgo.js';

const control = (tipo, implementacion, extra = {}) => ({ descripcion: 'x', tipo, implementacion, ...extra });
const riesgos = [
  { id: 613, macroprocesos: ['SIGCAS'], probabilidadInherente: 80, impactoInherente: 100, probabilidadResidual: 29, impactoResidual: 75, fechaSeguimiento: '2026-10-01',
    controlesDetallados: [control('Preventivo', 'Manual'), control('Detectivo', 'Automático'), control('Correctivo', 'Manual')] },
  { id: 65, macroprocesos: ['SIGCAS'], probabilidadInherente: 60, impactoInherente: 80, probabilidadResidual: 36, impactoResidual: 80,
    controlesDetallados: [control('Preventivo', 'Manual'), control('Preventivo', 'Automático', { estado: 'Anulado' })] },
  { id: 433, macroprocesos: ['SIGCAS'], probabilidadInherente: 60, impactoInherente: 60, probabilidadResidual: 60, impactoResidual: 60, fechaSeguimiento: '2026-12-01', controlesDetallados: [] },
];
const alcance = 'SIGCAS';
let pruebas = 0;
const prueba = (nombre, fn) => { fn(); pruebas += 1; };

prueba('calificación con la escala del Excel', () => {
  assert.equal(calificarEficacia(45).calificacion, 'Excelente');
  assert.equal(calificarEficacia(40).calificacion, 'Bueno');
  assert.equal(calificarEficacia(37).calificacion, 'Moderado');
  assert.equal(calificarEficacia(29).calificacion, 'Malo');
});

prueba('controles: cuenta tipos, anulados y riesgos sin controles', () => {
  const r = explicarControlesRegistrados({ riesgos, alcance });
  assert.equal(r.valor, '5');
  assert.ok(r.lineas.some(l => l.includes('3 preventivos, 1 detectivo, 1 correctivo')));
  assert.ok(r.lineas.some(l => l.includes('1 control está anulado')));
  assert.match(r.accion, /1 riesgo no tiene/);
});

prueba('eficacia: excluye anulados, usa la Tabla 6 y dice cuánto falta', () => {
  const r = explicarEficaciaPromedio({ riesgos, alcance });
  // Valor mostrado: cada control frente al máximo real de su tipo: (40/50 + 40/50 + 40/40 + 25/35) / 4 = 83 %.
  assert.equal(r.valor, '83%');
  assert.ok(r.lineas.some(l => l.includes('En la Tabla 6 el promedio es 36,3 %')), 'el valor de la Tabla 6 sigue explicado');
  assert.ok(r.lineas.some(l => l.includes('2 preventivos manuales (40 %), 1 detectivo automático (40 %), 1 correctivo manual (25 %)')));
  assert.ok(r.lineas.some(l => l.startsWith('Calificación interna de la app: Moderado')));
  assert.match(r.accion, /Bueno \(40 %\) faltan 3,8 puntos/);
});

prueba('mitigación: mayor y menor con sus valores reales', () => {
  const calcularMitigacion = r => Math.max(0, Math.round(((r.probabilidadInherente * r.impactoInherente) - (r.probabilidadResidual * r.impactoResidual)) / (r.probabilidadInherente * r.impactoInherente) * 100));
  const r = explicarMitigacionPromedio({ riesgos, alcance, calcularMitigacion });
  assert.ok(r.lineas.some(l => l.startsWith('Mayor: RSK-613') && l.includes('quitan el 73 %')));
  assert.ok(r.lineas.some(l => l.startsWith('Menor: RSK-433') && l.includes('quitan el 0 %')));
});

prueba('seguimientos: vencidos según la fecha de hoy', () => {
  const r = explicarSeguimientos({ riesgos, alcance, hoy: new Date('2026-10-24T12:00:00') });
  assert.equal(r.valor, '1');
  assert.ok(r.lineas.some(l => l.includes('RSK-613 (2026-10-01)')));
});

prueba('mayor exposición: S = nivel de probabilidad × nivel de impacto', () => {
  const coordenada = (r, eje) => Math.ceil((eje === 'probabilidad' ? r.probabilidadInherente : r.impactoInherente) / 20);
  const nivel = r => zonaPorNiveles(coordenada(r, 'probabilidad'), coordenada(r, 'impacto'));
  const r = explicarMayorExposicion({ riesgos, obtenerCoordenada: coordenada, nivelRiesgo: nivel, nivelActivo: 'Inherente' });
  assert.ok(r.lineas.includes('RSK-613: S 20 = probabilidad 4 (Alta) × impacto 5 (Catastrófico) → Extremo.'));
});

console.log(`explicacionDashboardRiesgos.test.js: ${pruebas} pruebas OK`);
