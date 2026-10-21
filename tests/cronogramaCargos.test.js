// tests/cronogramaCargos.test.js - H11: plan anual asignado por cargo, sin nombres de personas en el código.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { restaurarCronogramaOficial } from '../src/utils/cronogramaOficial.js';
import { defaultCronograma } from '../src/constants/defaultData.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

// 1. La plantilla oficial conserva los 20 procesos y no contiene nombres de personas.
assert.equal(defaultCronograma.length, 20);
assert.ok(defaultCronograma.every(item => item.responsable === '' && item.apoyo === ''), 'plantilla sin responsables');
assert.ok(defaultCronograma.every(item => item.codigo && item.proceso && item.enfoque), 'estructura intacta');
const nombresReales = /Yehison|Rodolfo|Angelica|Angélica|Luz Angela/i;
for (const archivo of ['constants/defaultData.js', 'constants/diccionariosGRC.js', 'App.jsx', 'components/PlanAnual.jsx', 'components/FuentesDeMejora.jsx', 'components/MiEspacio.jsx']) {
  assert.equal(nombresReales.test(read(`../src/${archivo}`)), false, `${archivo} sin nombres de personas`);
}

// 2. Restaurar conserva el cargo responsable y de apoyo de cada proceso existente (por código).
const actual = [
  { id: 1, codigo: '01', proceso: 'Proceso editado', responsable: 'Jefe de Control Interno', apoyo: 'Analista de Auditoría' },
  { id: 2, codigo: '02', proceso: 'Compras', responsable: 'Valor antiguo de texto', apoyo: '' },
];
const restaurado = restaurarCronogramaOficial(defaultCronograma, actual);
assert.equal(restaurado.length, 20);
assert.equal(restaurado[0].proceso, defaultCronograma[0].proceso, 'la estructura vuelve a la oficial');
assert.deepEqual([restaurado[0].responsable, restaurado[0].apoyo], ['Jefe de Control Interno', 'Analista de Auditoría']);
assert.equal(restaurado[1].responsable, 'Valor antiguo de texto', 'un valor anterior no se pierde');
assert.deepEqual([restaurado[2].responsable, restaurado[2].apoyo], ['', ''], 'proceso sin asignación queda vacío');
assert.deepEqual(restaurarCronogramaOficial(defaultCronograma, []).map(item => item.responsable), Array(20).fill(''));

// 3. El formulario usa el catálogo de cargos y conserva el valor actual; App usa la restauración segura.
const planAnual = read('../src/components/PlanAnual.jsx');
assert.ok(planAnual.includes('useCatalogos()') && planAnual.includes('cargosEmpresa'), 'formulario lee el catálogo de cargos');
assert.ok(planAnual.includes('Valor actual:'), 'conserva valores anteriores hasta elegir un cargo');
assert.ok(read('../src/App.jsx').includes('restaurarCronogramaOficial(defaultCronograma, safeCronograma)'));
assert.equal(read('../src/hooks/useGrcData.js').includes('defaultCronograma'), false, 'la plantilla no se muestra como datos');

console.log('cronogramaCargos.test.js: OK (plantilla sin nombres, restauración conserva cargos, formulario por catálogo)');
