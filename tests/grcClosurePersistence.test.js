import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as workflow from '../src/utils/programPlanWorkflow.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const moduleBody = path => read(path).replace(/^import .*;\r?\n/gm, '').replace('export default ', '').replaceAll('export ', '');
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
  const ref = path => ({
    path,
    doc: id => ref(`${path}/${id}`),
    collection: id => ref(`${path}/${id}`),
    get: async () => snapshot(path),
  });
  const snapshot = path => {
    if (path.split('/').length % 2 === 1) return {
      docs: [...documents].filter(([key]) => key.startsWith(`${path}/`) && key.split('/').length === path.split('/').length + 1)
        .map(([key]) => ({ ...snapshot(key), ref: ref(key) })),
    };
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
          return snapshot(reference.path);
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
    return { leerWorkspaceGrc, guardarPlanesGrc, guardarInformesGrc, guardarWorkspaceParcial };`)(
    adminDb, { delete: () => DELETE }, {}, { info() {} },
  );
  const errors = [];
  const bindings = {
    ...workspace, ...workflow, adminDb,
    applyCors: () => false,
    requireAuth: async () => ({ uid: 'u1', email: 'auditor@example.test' }),
    sendSuccess: (res, body) => Object.assign(res, { code: 200, body }),
    sendError: (res, error, code) => Object.assign(res, { code, error }),
    notificarSemaforo: async () => {},
    logger: { info() {}, error: (...args) => errors.push(args) },
  };
  const handler = new Function(...Object.keys(bindings), `${moduleBody('../api/_grc/review-plans.js')}\nreturn handler;`)(...Object.values(bindings));
  return {
    documents, writes, errors, workspace, apply,
    close: async body => {
      const res = {};
      await handler({ method: 'POST', body, url: '/api/grc/review-plans' }, res);
      return res;
    },
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
