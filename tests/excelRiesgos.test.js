// tests/excelRiesgos.test.js - El Excel de la matriz de riesgos abre sin el aviso "Hemos encontrado un problema".
// Excel rechaza el libro si una fórmula trae un texto de más de 255 caracteres o pasa de 8.192 caracteres.
import assert from 'node:assert/strict';
import { crearLibroMatrizRiesgosExcel } from '../src/utils/riesgosExcelExport.js';
import { calcularEficaciaControl } from '../src/utils/explicacionControles.js';
import { zonaSeveridad } from '../src/utils/nivelRiesgo.js';

const control = (tipo, implementacion) => ({ descripcion: 'Control de prueba', tipo, implementacion, documentacion: 'Documentado', frecuencia: 'Continua', evidencia: 'Con registro' });
const riesgos = [
  { id: 49, proceso: 'Gestión comercial', probabilidadInherente: 80, impactoInherente: 100, probabilidadResidual: 29, impactoResidual: 100,
    controlesDetallados: [control('Preventivo', 'Manual'), control('Preventivo', 'Manual')] },
  { id: 62, proceso: 'Talento Humano', probabilidadInherente: 40, impactoInherente: 40, probabilidadResidual: 4, impactoResidual: 23,
    controlesDetallados: [control('Preventivo', 'Automático'), control('Detectivo', 'Manual'), control('Correctivo', 'Manual'), control('Correctivo', 'Automático')] },
  { id: 9, proceso: 'Talento Humano', probabilidadInherente: 20, impactoInherente: 40, probabilidadResidual: 20, impactoResidual: 40, controlesDetallados: [] },
];
const libro = await crearLibroMatrizRiesgosExcel(riesgos, {
  calcularEficaciaControl,
  getSeverityZone: (p, i, porcentaje) => zonaSeveridad(p, i, porcentaje),
  calcularMitigacionRiesgo: () => 50,
  alcance: 'Prueba',
  planes: [],
});

let formulas = 0;
libro.worksheets.forEach(hoja => hoja.eachRow(fila => fila.eachCell(celda => {
  const formula = celda.value?.formula;
  if (!formula) return;
  formulas += 1;
  assert.ok(formula.length <= 8192, `${hoja.name}!${celda.address}: fórmula de ${formula.length} caracteres`);
  (formula.match(/"(?:[^"]|"")*"/g) || []).forEach(texto => {
    assert.ok(texto.length - 2 <= 255, `${hoja.name}!${celda.address}: texto de ${texto.length - 2} caracteres en la fórmula`);
  });
})));
assert.ok(formulas > 20, 'el dashboard del Excel trae sus fórmulas');

const dashboard = libro.getWorksheet('Dashboard');
assert.equal(dashboard.getCell('H27').value, 'EFICACIA PROMEDIO (DEL MÁXIMO POSIBLE)');
assert.match(String(dashboard.getCell('A28').value?.result), /^Se muestra \d+ %/);

console.log(`excelRiesgos.test.js: OK (${formulas} fórmulas dentro de los límites de Excel)`);
