// tests/excelYRespaldo.test.js - Excel (importar/exportar) y respaldo JSON de Configuración.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cargarXLSX } from '../src/utils/xlsxLoader.js';
import { validarDatosSync } from '../api/_lib/validation.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

// 1. El cargador entrega SheetJS con las funciones que usa la app, y reutiliza la misma carga.
const XLSX = await cargarXLSX();
for (const funcion of ['read', 'writeFile']) assert.equal(typeof XLSX[funcion], 'function', funcion);
for (const funcion of ['sheet_to_json', 'json_to_sheet', 'aoa_to_sheet', 'book_new', 'book_append_sheet']) {
  assert.equal(typeof XLSX.utils[funcion], 'function', `utils.${funcion}`);
}
assert.equal(await cargarXLSX(), XLSX, 'la librería se carga una sola vez');

// 2. Importación de riesgos: un archivo con las columnas de la plantilla se lee correctamente.
const libro = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet([
  { NO: 7, 'PROCESO/SUBPROCESO': 'Operaciones', 'DESCRIPCIÓN DEL RIESGO': 'Riesgo de prueba', 'PROBABILIDAD INHERENTE': 'Nivel 3' },
]), 'Matriz');
const binario = XLSX.write(libro, { type: 'array', bookType: 'xlsx' });
const filas = XLSX.utils.sheet_to_json(XLSX.read(new Uint8Array(binario), { type: 'array' }).Sheets.Matriz);
assert.equal(filas[0]['DESCRIPCIÓN DEL RIESGO'], 'Riesgo de prueba');

// 3. Ningún módulo depende ya de window.XLSX (que nunca se definía).
for (const archivo of ['utils/excelImporter.js', 'services/grcStorageService.js', 'components/AuditoriaAutomatizada/ConceptMapper.jsx']) {
  const fuente = read(`../src/${archivo}`);
  assert.equal(fuente.includes('window.XLSX'), false, `${archivo} sin window.XLSX`);
  assert.ok(fuente.includes('cargarXLSX'), `${archivo} usa el cargador`);
}

// 4. Los botones de exportar a Excel reciben la función (antes no se pasaba y no aparecían).
const app = read('../src/App.jsx');
assert.equal((app.match(/exportToExcel=\{exportarExcel\}/g) || []).length, 2, 'Hallazgos e Informes');

// 5. El respaldo JSON contiene datos reales y pasa la validación del servidor (se puede restaurar).
assert.ok(app.includes('exportToJSON={exportarRespaldoJSON}'), 'Configuración usa el respaldo con datos');
const bloque = app.slice(app.indexOf('const exportarRespaldoJSON'), app.indexOf('});', app.indexOf('const exportarRespaldoJSON')));
const claves = [...bloque.matchAll(/(\w+):\s*\w+|(?<=[{,]\s*)(\w+)(?=\s*[,}])/g)].map(m => m[1] || m[2]).filter(Boolean);
const respaldo = Object.fromEntries(claves.map(clave => [clave,
  clave === 'mapaProcesos' ? {} : clave === 'catalogosInicializados' ? true : clave === 'sedesEmpresa' ? ['Hotel'] : []]));
assert.ok(claves.includes('riesgos') && claves.includes('planes') && claves.includes('mapaProcesos'), claves.join(','));
assert.equal(validarDatosSync(respaldo).valido, true, validarDatosSync(respaldo).error);
assert.equal(validarDatosSync({ ...respaldo, riesgosReemplazoTotal: true }).valido, true, 'importar con reemplazo total');

console.log('excelYRespaldo.test.js: OK (cargador SheetJS, importación, exportación, respaldo restaurable)');
