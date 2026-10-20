import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as workflow from '../src/utils/programPlanWorkflow.js';
import * as alcance from '../api/_lib/assignmentScope.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const moduleBody = path => read(path).replace(/^import [^;]*;\r?\n/gm, '').replace('export default ', '').replaceAll('export ', '');
const ROOT = 'workspace_compartido/base_de_datos_grc';
const DELETE = { __delete: true };
const size = value => Buffer.byteLength(JSON.stringify(value));
const action = (id, overrides = {}) => ({
  id, idInforme: 'i1', idHallazgo: 'h1', accion: `Acción ${id}`,
  correoAuditor: 'auditor@example.test', correoResponsable: 'ejecutor@example.test',
  correoRevisor: 'revisor@example.test', progreso: 100, estadoWorkflow: 'En Revisión (100%)',
  estado: 'En Proceso', ...overrides,
});

function storeFixture({ fragmented = false, nearLimit = false } = {}) {
  const documents = new Map();
  const base = fragmented ? {} : { planes: [action(1), action(2)], hallazgos: [{ id: 'h1', idInforme: 'i1', estado: 'Abierto' }] };
  if (nearLimit) base.padding = 'x'.repeat(1048576 - size(base) - 350);
  documents.set(ROOT, base);
  documents.set(`${ROOT}/informes/i1`, { id: 'i1', tipoFuente: 'Programa de Auditoría', correoAuditor: 'auditor@example.test' });
  documents.set(`${ROOT}/hallazgos/h1`, { id: 'h1', idInforme: 'i1', estado: 'Abierto', titulo: 'Hallazgo migrado' });
  if (fragmented) {
    documents.set(`${ROOT}/planes_accion/1`, action(1));
    documents.set(`${ROOT}/planes_accion/2`, action(2));
  }
  documents.set('usuarios/u1', { rol: 'lider', permisos: ['sub_seguimiento_planes'] });
  const reads = [];
  const ref = path => ({
    path,
    doc: id => ref(`${path}/${id}`),
    collection: id => ref(`${path}/${id}`),
    // Igual que Firestore, la comparación de `in` es estricta por tipo ('5' !== 5).
    where: (field, operator, values) => ({ path, filtro: { field, values: operator === 'in' ? values : [values] } }),
    get: async () => snapshot(path),
  });
  const snapshot = (path, filtro = null) => {
    if (path.split('/').length % 2 === 1) {
      const docs = [...documents].filter(([key, value]) => key.startsWith(`${path}/`) &&
        key.split('/').length === path.split('/').length + 1 &&
        (!filtro || filtro.values.includes(value?.[filtro.field])))
        .map(([key]) => ({ ...snapshot(key), ref: ref(key) }));
      return { docs, size: docs.length };
    }
    return {
      id: path.split('/').at(-1), exists: documents.has(path),
      data: () => structuredClone(documents.get(path)),
      get: field => structuredClone(documents.get(path)?.[field]),
    };
  };
  const writes = [];
  const apply = (path, partial, options) => {
    const next = options?.merge ? { ...(documents.get(path) || {}), ...partial } : structuredClone(partial);
    Object.keys(next).forEach(key => { if (next[key]?.__delete) delete next[key]; });
    if (size(next) > 1048576) throw new Error('Firestore document exceeds 1 MiB');
    return next;
  };
  const adminDb = {
    collection: id => ref(id),
    batch: () => {
      const pending = [];
      return {
        set: (reference, data, options) => pending.push({ reference, data, options }),
        delete: reference => pending.push({ reference, remove: true }),
        commit: async () => {
          const next = pending.map(write => write.remove ? null : apply(write.reference.path, write.data, write.options));
          pending.forEach((write, index) => write.remove
            ? documents.delete(write.reference.path) : documents.set(write.reference.path, next[index]));
        },
      };
    },
    runTransaction: async callback => {
      const pending = [];
      const result = await callback({
        get: async reference => {
          assert.equal(pending.length, 0, 'Firestore no permite lecturas después de escrituras');
          reads.push(reference.filtro ? `${reference.path}?${reference.filtro.field}` : reference.path);
          return snapshot(reference.path, reference.filtro);
        },
        set: (reference, data, options) => {
          pending.push({ reference, data, options });
        },
      });
      const next = pending.map(write => apply(write.reference.path, write.data, write.options));
      pending.forEach((write, index) => {
        writes.push(write.reference.path);
        documents.set(write.reference.path, next[index]);
      });
      return result;
    },
  };
  const workspace = new Function('adminDb', 'FieldValue', 'Filter', 'logger', `${moduleBody('../api/_lib/grcWorkspace.js')}
    return {
      leerWorkspaceGrc, guardarPlanesGrc, guardarInformesGrc, guardarWorkspaceParcial,
      leerWorkspaceGrcLigero, obtenerHallazgoTx, obtenerPlanesDeInformeTx,
    };`)(
    adminDb, { delete: () => DELETE }, {}, { info() {} },
  );
  const errors = [];
  const bindings = {
    ...workspace, ...workflow, ...alcance, adminDb,
    applyCors: () => false,
    requireAuth: async () => ({ uid: 'u1', email: 'auditor@example.test' }),
    sendSuccess: (res, body) => Object.assign(res, { code: 200, body }),
    sendError: (res, error, code) => Object.assign(res, { code, error }),
    notificarSemaforo: async () => {},
    logger: { info() {}, error: (...args) => errors.push(args) },
  };
  const load = file => new Function(...Object.keys(bindings), `${moduleBody(file)}\nreturn handler;`)(...Object.values(bindings));
  const handler = load('../api/_grc/review-plans.js');
  const updateHandler = load('../api/_grc/update.js');
  const registerEmailHandler = load('../api/_grc/register-email.js');
  const call = async (target, method, body, url) => {
    const res = {};
    await target({ method, body, url }, res);
    return res;
  };
  return {
    documents, writes, errors, workspace, apply, reads,
    close: body => call(handler, 'POST', body, '/api/grc/review-plans'),
    update: body => call(updateHandler, 'PUT', body, '/api/grc/update'),
    registerEmail: body => call(registerEmailHandler, 'POST', body, '/api/grc/register-email'),
  };
}

for (const fragmented of [false, true]) {
  test(`persistencia real híbrida: cierre ${fragmented ? 'fragmentado' : 'legado'} sobrevive recarga y no resucita hallazgo`, async () => {
    const fixture = storeFixture({ fragmented });
    const response = await fixture.close({
      decision: 'cerrar', alcance: 'todas', idInforme: 'i1', idsPlanes: [1, 2],
      evaluacionEficacia: { conclusion: 'Resultado verificado' },
    });
    assert.equal(response.code, 200, JSON.stringify(fixture.errors));
    const reloaded = await fixture.workspace.leerWorkspaceGrc();
    assert.equal(reloaded.data.planes.length, 2);
    assert.ok(reloaded.data.planes.every(plan => plan.estadoWorkflow === 'Cerrado'));
    assert.equal(reloaded.data.hallazgos[0].estado, 'Cerrado');
    assert.equal(reloaded.data.hallazgos[0].titulo, 'Hallazgo migrado');
    assert.deepEqual(fixture.writes.sort(), [`${ROOT}/hallazgos/h1`, `${ROOT}/planes_accion/1`, `${ROOT}/planes_accion/2`].sort());
    assert.equal(fixture.errors.length, 0);
  });
}

test('workspace cerca de 1 MiB reproduce error de escritura monolítica y permite cierre por documento', async () => {
  const fixture = storeFixture({ nearLimit: true });
  const conclusion = 'Evidencia verificada. '.repeat(95);
  assert.throws(() => fixture.apply(ROOT, { planes: [
    action(1, { evaluacionEficaciaCierre: { conclusion } }), action(2),
  ] }, { merge: true }), /exceeds 1 MiB/);
  const response = await fixture.close({ decision: 'cerrar', idPlan: 1, evaluacionEficacia: { conclusion } });
  assert.equal(response.code, 200, JSON.stringify(fixture.errors));
  const reloaded = await fixture.workspace.leerWorkspaceGrc();
  assert.equal(reloaded.data.planes[0].estadoWorkflow, 'Cerrado');
  assert.equal(reloaded.data.planes[1].estadoWorkflow, 'En Revisión (100%)');
  assert.ok(!fixture.writes.includes(ROOT));
});

test('sync conserva cierres fragmentados en cambios ajenos y elimina planes sin reaparición del legado', async () => {
  const fixture = storeFixture();
  await fixture.close({ decision: 'cerrar', idPlan: 1, evaluacionEficacia: { conclusion: 'Eficaz' } });
  await fixture.workspace.guardarWorkspaceParcial({ configuracion: { ejemplo: true } });
  assert.equal((await fixture.workspace.leerWorkspaceGrc()).data.planes[0].estadoWorkflow, 'Cerrado');
  const planes = (await fixture.workspace.leerWorkspaceGrc()).data.planes.filter(plan => plan.id !== 1);
  await fixture.workspace.guardarWorkspaceParcial({ planes });
  const final = (await fixture.workspace.leerWorkspaceGrc()).data;
  assert.deepEqual(final.planes.map(plan => plan.id), [2]);
  assert.ok(!fixture.documents.get(ROOT).planes);
  assert.ok(!fixture.documents.has(`${ROOT}/planes_accion/1`));
});

// ============================================================================
// Etapa 2A: transacciones con lecturas puntuales (sin listar planes_accion ni hallazgos)
// ============================================================================
const listaColeccion = reads => reads.filter(path => /\/(planes_accion|hallazgos)$/.test(path));
const comoAdmin = fixture => fixture.documents.set('usuarios/u1', { rol: 'admin', permisos: [] });

test('register-email actualiza el informe leyendo solo documentos puntuales', async () => {
  const fixture = storeFixture({ fragmented: true });
  comoAdmin(fixture);
  const response = await fixture.registerEmail({ id: 'i1', destinatarios: 'lider@example.test', fechaCorreoEnviado: '2026-10-20' });
  assert.equal(response.code, 200, JSON.stringify(fixture.errors));
  assert.equal(fixture.documents.get(`${ROOT}/informes/i1`).correoEnviadoA, 'lider@example.test');
  assert.deepEqual(listaColeccion(fixture.reads), []);
  assert.ok(fixture.reads.length <= 3, fixture.reads.join(', '));
});

for (const fragmented of [false, true]) {
  test(`update de hallazgo ${fragmented ? 'fragmentado' : 'legado'} lee un solo hallazgo`, async () => {
    const fixture = storeFixture({ fragmented });
    comoAdmin(fixture);
    const response = await fixture.update({
      coleccion: 'hallazgos', id: 'h1',
      registro: { titulo: 'Título corregido', proceso: 'Operaciones', subprocesos: ['General'] },
    });
    assert.equal(response.code, 200, JSON.stringify(fixture.errors));
    const guardado = fixture.documents.get(`${ROOT}/hallazgos/h1`);
    assert.equal(guardado.titulo, 'Título corregido');
    assert.equal(guardado.idInforme, 'i1', 'conserva los campos no editados del documento');
    assert.deepEqual(listaColeccion(fixture.reads), []);
    assert.ok(fixture.reads.length <= 3, fixture.reads.join(', '));
  });
}

test('update de hallazgo inexistente o con ruta inválida responde 404 sin leer colecciones', async () => {
  const fixture = storeFixture({ fragmented: true });
  comoAdmin(fixture);
  for (const id of ['no-existe', 'h1/planes_accion/1']) {
    const response = await fixture.update({ coleccion: 'hallazgos', id, registro: { titulo: 'X', proceso: 'Operaciones', subprocesos: ['General'] } });
    assert.equal(response.code, 404);
  }
  assert.deepEqual(listaColeccion(fixture.reads), []);
});

test('cambio de auditor del informe sincroniza solo sus planes, en planes_accion y sin copia legada', async () => {
  const fixture = storeFixture({ fragmented: true });
  comoAdmin(fixture);
  // Plan antiguo sin idInforme, vinculado por un hallazgo con ID numérico guardado como número.
  fixture.documents.set(`${ROOT}/hallazgos/1784`, { id: 1784, idInforme: 'i1', estado: 'Abierto' });
  fixture.documents.set(`${ROOT}/planes_accion/3`, action(3, { idInforme: undefined, idHallazgo: 1784 }));
  // Plan de otro informe: no debe tocarse.
  fixture.documents.set(`${ROOT}/planes_accion/4`, action(4, { idInforme: 'otro', idHallazgo: 'h-otro' }));
  const response = await fixture.update({
    coleccion: 'informesAuditoria', id: 'i1',
    registro: { titulo: 'Informe', proceso: 'Operaciones', subprocesos: ['General'], correoAuditor: 'nuevo.auditor@example.test' },
  });
  assert.equal(response.code, 200, JSON.stringify(fixture.errors));
  for (const id of [1, 2, 3]) {
    assert.equal(fixture.documents.get(`${ROOT}/planes_accion/${id}`).correoAuditor, 'nuevo.auditor@example.test', `plan ${id}`);
  }
  assert.equal(fixture.documents.get(`${ROOT}/planes_accion/4`).correoAuditor, 'auditor@example.test');
  assert.equal(fixture.documents.get(ROOT).planes, undefined, 'no se reescribe la lista legada de planes');
  assert.deepEqual(listaColeccion(fixture.reads), [], 'solo consultas filtradas');
  assert.ok(fixture.reads.some(path => path.endsWith('planes_accion?idHallazgo')));
});

test('cambio de auditor con planes legados los migra a planes_accion sin duplicar', async () => {
  const fixture = storeFixture({ fragmented: false });
  comoAdmin(fixture);
  const response = await fixture.update({
    coleccion: 'informesAuditoria', id: 'i1',
    registro: { titulo: 'Informe', proceso: 'Operaciones', subprocesos: ['General'], correoAuditor: 'nuevo.auditor@example.test' },
  });
  assert.equal(response.code, 200, JSON.stringify(fixture.errors));
  const recargado = (await fixture.workspace.leerWorkspaceGrc()).data.planes;
  assert.deepEqual(recargado.map(plan => plan.id).sort(), [1, 2]);
  assert.ok(recargado.every(plan => plan.correoAuditor === 'nuevo.auditor@example.test'));
});

test('editar un informe sin cambiar el auditor no consulta planes', async () => {
  const fixture = storeFixture({ fragmented: true });
  comoAdmin(fixture);
  const response = await fixture.update({
    coleccion: 'informesAuditoria', id: 'i1',
    registro: { titulo: 'Nuevo título', proceso: 'Operaciones', subprocesos: ['General'] },
  });
  assert.equal(response.code, 200, JSON.stringify(fixture.errors));
  assert.ok(!fixture.reads.some(path => path.includes('planes_accion')), fixture.reads.join(', '));
});
