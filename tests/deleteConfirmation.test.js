import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readSource = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = readSource('../src/App.jsx');
const deleteSource = app.slice(app.indexOf('  const handleDeleteItem ='), app.indexOf('  const scrollToForm ='));

function createHarness({ confirmed = true, saved = true, admin = true } = {}) {
  const effects = [];
  const bindings = {
    isAdmin: admin,
    confirmarEliminacion: async detail => { effects.push(['confirm', detail]); return confirmed; },
    saveToCloud: async data => { effects.push(['save', data]); return saved; },
    showNotification: (...args) => effects.push(['notification', ...args]),
    informesAuditoria: [{ id: 'i1', titulo: 'Informe de prueba' }],
  };
  for (const name of ['Riesgos', 'Evaluaciones', 'Incidentes', 'Cronograma', 'Monitoreo', 'Comites', 'Programas']) {
    bindings[`safe${name}`] = [];
    bindings[`set${name}`] = data => effects.push([`set${name}`, data]);
  }
  Object.assign(bindings, {
    safeHallazgos: [{ id: 'h1', idInforme: 'i1' }, { id: 'h2', idInforme: 'i2' }],
    safePlanes: [
      { id: 'p1', idHallazgo: 'h1' },
      { id: 'p2', idInforme: 'i1' },
      { id: 'p3', idHallazgo: 'h2', idInforme: 'i2' },
    ],
    setHallazgos: data => effects.push(['setHallazgos', data]),
    setPlanes: data => effects.push(['setPlanes', data]),
    setInformesAuditoria: data => effects.push(['setInformesAuditoria', data]),
  });
  const remove = new Function(...Object.keys(bindings), `${deleteSource}\nreturn handleDeleteItem;`)(...Object.values(bindings));
  return { effects, remove };
}

test('cancelar conserva registros y evita llamadas de escritura', async () => {
  const { effects, remove } = createHarness({ confirmed: false });
  await remove('informesAuditoria', 'i1');
  assert.equal(effects.length, 1);
  assert.equal(effects[0][0], 'confirm');
  assert.match(effects[0][1], /hallazgos y planes/);
});

test('la confirmación no amplía permisos de eliminación', async () => {
  const { effects, remove } = createHarness({ admin: false });
  await remove('hallazgos', 'h1');
  assert.deepEqual(effects, []);
});

test('confirmar elimina una vez el informe y únicamente sus vínculos', async () => {
  const { effects, remove } = createHarness();
  await remove('informesAuditoria', 'i1');
  const writes = effects.filter(([type]) => type === 'save');
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0][1], {
    informesAuditoria: [],
    informesEliminados: ['i1'],
    hallazgos: [{ id: 'h2', idInforme: 'i2' }],
    planes: [{ id: 'p3', idHallazgo: 'h2', idInforme: 'i2' }],
  });
  assert.ok(effects.findIndex(([type]) => type === 'save') < effects.findIndex(([type]) => type === 'setInformesAuditoria'));
});

test('eliminar un hallazgo conserva acciones de otros hallazgos', async () => {
  const { effects, remove } = createHarness();
  await remove('hallazgos', 'h1');
  const data = effects.find(([type]) => type === 'save')[1];
  assert.deepEqual(data.hallazgos, [{ id: 'h2', idInforme: 'i2' }]);
  assert.deepEqual(data.planes.map(item => item.id), ['p2', 'p3']);
});

for (const type of ['planes', 'informesAuditoria']) {
  test(`un error al persistir ${type} no cambia la vista ni anuncia éxito`, async () => {
    const { effects, remove } = createHarness({ saved: false });
    await remove(type, type === 'planes' ? 'p1' : 'i1');
    assert.equal(effects.filter(([name]) => name.startsWith('set')).length, 0);
    assert.equal(effects.filter(([name, , level]) => name === 'notification' && level === 'success').length, 0);
  });
}

for (const confirmed of [false, true]) {
  test(`quitar actividad ${confirmed ? 'confirmada' : 'cancelada'} respeta la decisión`, async () => {
    const source = readSource('../src/components/Planes.jsx');
    const handler = source.slice(source.indexOf('  const handleRemoveActivity ='), source.indexOf('  const handleUpdateActivityField ='));
    let state = { h1: { actividades: ['A', 'B'] } };
    let dirty = false;
    const remove = new Function('confirmarEliminacion', 'setMatrixDirty', 'setMatrixState', `${handler}\nreturn handleRemoveActivity;`)(
      async () => confirmed,
      value => { dirty = value; },
      update => { state = update(state); },
    );
    await remove('h1', 0);
    assert.equal(dirty, confirmed);
    assert.deepEqual(state.h1.actividades, confirmed ? ['B'] : ['A', 'B']);
  });

  test(`quitar fila del programa ${confirmed ? 'confirmada' : 'cancelada'} respeta la decisión`, async () => {
    const source = readSource('../src/components/ProgramasAuditoria.jsx');
    const handler = source.slice(source.indexOf('  const eliminarFilaMatriz ='), source.indexOf('const handleGuardarPrograma ='));
    let rows = [{ id: 'a' }, { id: 'b' }];
    const remove = new Function('confirmarEliminacion', 'setMatrizPruebas', `${handler}\nreturn eliminarFilaMatriz;`)(
      async () => confirmed,
      update => { rows = update(rows); },
    );
    await remove('a');
    assert.deepEqual(rows.map(item => item.id), confirmed ? ['b'] : ['a', 'b']);
  });
}
