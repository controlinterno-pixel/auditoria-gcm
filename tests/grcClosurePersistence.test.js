import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as workflow from '../src/utils/programPlanWorkflow.js';
import * as alcance from '../api/_lib/assignmentScope.js';
import * as validacion from '../api/_lib/validation.js';
import { validarAdjuntoEvaluacion } from '../src/utils/evaluationAttachment.js';
import { randomUUID } from 'node:crypto';
import { calcularResiduales } from '../src/utils/explicacionControles.js';
import { zonaSeveridad } from '../src/utils/nivelRiesgo.js';
import { revisarControlesEliminados } from '../src/utils/anulacion.js';
import { compararRiesgos, entradaDeCambios } from '../src/utils/historialRiesgo.js';

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
  const directReads = [];
  const workspaceErrors = [];
  const ref = path => ({
    path,
    doc: id => ref(`${path}/${id}`),
    collection: id => ref(`${path}/${id}`),
    // Igual que Firestore, la comparación de `in` es estricta por tipo ('5' !== 5).
    where: (field, operator, values) => ({ path, filtro: { field, values: operator === 'in' ? values : [values] } }),
    get: async () => { directReads.push(path); return snapshot(path); },
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
        delete: reference => {
          pending.push({ reference, remove: true });
        },
      });
      const next = pending.map(write => (write.remove ? null : apply(write.reference.path, write.data, write.options)));
      pending.forEach((write, index) => {
        writes.push(write.reference.path);
        if (write.remove) documents.delete(write.reference.path);
        else documents.set(write.reference.path, next[index]);
      });
      return result;
    },
  };
  const workspace = new Function('adminDb', 'FieldValue', 'Filter', 'logger', `${moduleBody('../api/_lib/coleccionesAgrupadas.js')}
${moduleBody('../api/_lib/grcWorkspace.js')}
    return {
      leerWorkspaceGrc, guardarPlanesGrc, guardarInformesGrc, guardarWorkspaceParcial, guardarRegistrosGrc, leerInformeTx,
      leerWorkspaceGrcLigero, obtenerHallazgoTx, obtenerPlanesDeInformeTx,
      obtenerPlanesTx, obtenerHallazgosTx, obtenerPlanesDeHallazgosTx, reservarIdsPlanesTx, listarHallazgosTx,
      riesgosMigrados, leerRiesgosVigentes, guardarRiesgoFragmentado, eliminarRiesgoFragmentado,
      guardarListaRiesgosFragmentada, migrarRiesgos, limpiarRiesgosLegados,
    };`)(
    adminDb, { delete: () => DELETE }, {}, { info() {}, error: (...args) => workspaceErrors.push(args) },
  );
  const errors = [];
  const sesion = { usuario: { uid: 'u1', email: 'auditor@example.test' } };
  const bindings = {
    ...workspace, ...workflow, ...alcance, ...validacion, validarAdjuntoEvaluacion, randomUUID, adminDb, calcularResiduales, zonaSeveridad, revisarControlesEliminados, compararRiesgos, entradaDeCambios,
    applyCors: () => false,
    requireAuth: async () => sesion.usuario,
    sendSuccess: (res, body) => Object.assign(res, { code: 200, body }),
    sendError: (res, error, code) => Object.assign(res, { code, error }),
    notificarSemaforo: async () => {},
    logger: { info() {}, warn() {}, error: (...args) => errors.push(args.map(arg => (arg instanceof Error ? arg.stack : arg))) },
  };
  const load = file => new Function(...Object.keys(bindings), `${moduleBody(file)}\nreturn handler;`)(...Object.values(bindings));
  const handler = load('../api/_grc/review-plans.js');
  const updateHandler = load('../api/_grc/update.js');
  const registerEmailHandler = load('../api/_grc/register-email.js');
  const createHandler = load('../api/_grc/create.js');
  const riesgosHandler = load('../api/_grc/riesgos.js');
  const migrarHandler = load('../api/_grc/migrar-riesgos.js');
  const limpiarHandler = load('../api/_grc/limpiar-riesgos.js');
  const call = async (target, method, body, url, query = {}) => {
    const res = {};
    await target({ method, body, url, query }, res);
    return res;
  };
  return {
    documents, writes, errors, workspace, apply, reads, directReads, workspaceErrors,
    close: body => call(handler, 'POST', body, '/api/grc/review-plans'),
    update: body => call(updateHandler, 'PUT', body, '/api/grc/update'),
    registerEmail: body => call(registerEmailHandler, 'POST', body, '/api/grc/register-email'),
    create: body => call(createHandler, 'POST', body, '/api/grc/create'),
    sesion,
    riesgos: (method, body, query) => call(riesgosHandler, method, body, '/api/grc/riesgos', query),
    migrar: body => call(migrarHandler, 'POST', body, '/api/grc/migrar-riesgos'),
    limpiar: body => call(limpiarHandler, 'POST', body, '/api/grc/limpiar-riesgos'),
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

// ============================================================================
// Etapa 2B: review-plans con lecturas puntuales
// ============================================================================
const sinListados = fixture => assert.deepEqual(listaColeccion(fixture.reads), [], fixture.reads.join(', '));

test('cierre conjunto detecta acciones abiertas del informe vinculadas solo por hallazgo (ID numérico)', async () => {
  const fixture = storeFixture({ fragmented: true });
  fixture.documents.set(`${ROOT}/hallazgos/1784`, { id: 1784, idInforme: 'i1', estado: 'Abierto' });
  fixture.documents.set(`${ROOT}/planes_accion/3`, action(3, { idInforme: undefined, idHallazgo: 1784, estadoWorkflow: 'En Ejecución', progreso: 40 }));
  const response = await fixture.close({
    decision: 'cerrar', alcance: 'todas', idInforme: 'i1', idsPlanes: [1, 2],
    evaluacionEficacia: { conclusion: 'Resultado verificado' },
  });
  assert.equal(response.code, 409, 'la acción 3 sigue abierta en el mismo informe');
  assert.equal(fixture.writes.length, 0);
  sinListados(fixture);
});

test('cierre conjunto ignora acciones de otros informes y no lista colecciones', async () => {
  const fixture = storeFixture({ fragmented: true });
  fixture.documents.set(`${ROOT}/planes_accion/9`, action(9, { idInforme: 'otro', idHallazgo: 'h-otro', estadoWorkflow: 'En Ejecución' }));
  const response = await fixture.close({
    decision: 'cerrar', alcance: 'todas', idInforme: 'i1', idsPlanes: [1, 2],
    evaluacionEficacia: { conclusion: 'Resultado verificado' },
  });
  assert.equal(response.code, 200, JSON.stringify(fixture.errors));
  assert.equal(fixture.documents.get(`${ROOT}/planes_accion/9`).estadoWorkflow, 'En Ejecución');
  assert.equal(fixture.documents.get(`${ROOT}/hallazgos/h1`).estado, 'Cerrado');
  sinListados(fixture);
});

test('cerrar una acción no cierra el hallazgo si tiene otra acción abierta', async () => {
  const fixture = storeFixture({ fragmented: true });
  const response = await fixture.close({ decision: 'cerrar', idPlan: 1, evaluacionEficacia: { conclusion: 'Eficaz' } });
  assert.equal(response.code, 200, JSON.stringify(fixture.errors));
  assert.equal(fixture.documents.get(`${ROOT}/planes_accion/1`).estadoWorkflow, 'Cerrado');
  assert.equal(fixture.documents.get(`${ROOT}/hallazgos/h1`).estado, 'Abierto', 'la acción 2 sigue en revisión');
  assert.ok(fixture.reads.some(path => path.endsWith('planes_accion?idHallazgo')));
  sinListados(fixture);
});

test('rechazar evidencia lee solo la acción y su hallazgo', async () => {
  const fixture = storeFixture({ fragmented: true });
  const response = await fixture.close({ decision: 'rechazar', idPlan: 1, motivo: 'Falta soporte', evaluacionEficacia: null });
  assert.equal(response.code, 200, JSON.stringify(fixture.errors));
  assert.equal(fixture.documents.get(`${ROOT}/planes_accion/1`).estadoWorkflow, 'En Ejecución');
  assert.ok(!fixture.reads.some(path => path.includes('?')), 'sin consultas de informe ni de hallazgo');
  sinListados(fixture);
});

test('revisor aprueba solo sus acciones pendientes del informe, incluidas las vinculadas por hallazgo', async () => {
  const fixture = storeFixture({ fragmented: true });
  const pendiente = { estadoWorkflow: 'Pendiente Validación Revisor', correoRevisor: 'auditor@example.test', correoAuditor: 'otro.auditor@example.test' };
  fixture.documents.set(`${ROOT}/planes_accion/1`, action(1, pendiente));
  fixture.documents.set(`${ROOT}/planes_accion/2`, action(2, { ...pendiente, idInforme: undefined }));
  fixture.documents.set(`${ROOT}/planes_accion/8`, action(8, { ...pendiente, idInforme: 'otro', idHallazgo: 'h-otro' }));
  const response = await fixture.close({ decision: 'aprobar', idInforme: 'i1' });
  assert.equal(response.code, 200, JSON.stringify(fixture.errors));
  assert.equal(fixture.documents.get(`${ROOT}/planes_accion/1`).estadoWorkflow, 'En Revisión (100%)');
  assert.equal(fixture.documents.get(`${ROOT}/planes_accion/2`).estadoWorkflow, 'En Revisión (100%)');
  assert.equal(fixture.documents.get(`${ROOT}/planes_accion/8`).estadoWorkflow, 'Pendiente Validación Revisor');
  sinListados(fixture);
});

test('evaluación de diseño lee solo las acciones seleccionadas', async () => {
  const fixture = storeFixture({ fragmented: true });
  fixture.documents.set(`${ROOT}/planes_accion/1`, action(1, {
    estadoWorkflow: workflow.ESTADO_EVALUACION_INICIAL, progreso: 0, evaluacionHolistica: null,
  }));
  const response = await fixture.close({
    decision: 'evaluar-diseno', idInforme: 'i1', idsPlanes: [1],
    criterios: Object.fromEntries(['c1', 'c2', 'c3', 'c4', 'c5'].map(key => [key, 100])), justificacion: '',
    adjuntoEvaluacion: { nombre: 'Evaluacion.pdf', tamano: 100, url: 'https://repos.termalessantarosa.com.co/api/archivos/auditoria/controlInterno/evaluacion.pdf' },
  });
  assert.equal(response.code, 200, JSON.stringify(fixture.errors) + JSON.stringify(response));
  assert.equal(fixture.documents.get(`${ROOT}/planes_accion/1`).estadoWorkflow, 'En Ejecución');
  assert.ok(!fixture.reads.some(path => path.includes('?')), fixture.reads.join(', '));
  sinListados(fixture);
});

// ============================================================================
// Etapa 2C: creación de planes y hallazgos sin listar planes_accion
// ============================================================================
const correosPlan = {
  correoResponsable: 'ejecutor@example.test', correoConfirmacion: 'ejecutor@example.test',
  correoRevisor: 'revisor@example.test', correoRevisorConfirmacion: 'revisor@example.test',
};
const conHoraFija = async (instante, prueba) => {
  const original = Date.now;
  Date.now = () => instante;
  try { return await prueba(); } finally { Date.now = original; }
};

test('matriz de planes: edita y crea acciones leyendo solo lo necesario, con ID libre verificado', async () => {
  const T = 1792000000000;
  const fixture = storeFixture({ fragmented: true });
  comoAdmin(fixture);
  // El administrador no es el auditor de esta acción: revisor y auditor aprobador solo la consultan.
  fixture.documents.set(`${ROOT}/planes_accion/1`, { ...fixture.documents.get(`${ROOT}/planes_accion/1`), correoAuditor: 'otro.auditor@example.test' });
  fixture.documents.set(`${ROOT}/planes_accion/${T}`, action(T, { accion: 'Ocupa el ID de la hora actual' }));
  fixture.documents.set(ROOT, { planes: [action(T + 1, { accion: 'Legado con el siguiente ID' })] });
  const response = await conHoraFija(T, () => fixture.update({
    coleccion: 'planes',
    registro: {
      idInforme: 'i1',
      actualizaciones: [{ id: 1, accion: 'Acción 1 corregida' }],
      nuevas: [{ idHallazgo: 'h1', accion: 'Acción nueva', ...correosPlan }],
    },
  }));
  assert.equal(response.code, 200, JSON.stringify(fixture.errors) + JSON.stringify(response));
  assert.equal(fixture.documents.get(`${ROOT}/planes_accion/1`).accion, 'Acción 1 corregida');
  assert.equal(response.body.planesNuevos[0].id, T + 2, 'salta el documento existente y el legado');
  assert.equal(fixture.documents.get(`${ROOT}/planes_accion/${T}`).accion, 'Ocupa el ID de la hora actual');
  assert.equal(fixture.documents.get(`${ROOT}/planes_accion/${T + 2}`).accion, 'Acción nueva');
  assert.equal(fixture.documents.get(`${ROOT}/planes_accion/2`).accion, 'Acción 2', 'las demás acciones no se tocan');
  sinListados(fixture);
});

test('matriz de planes rechaza editar una acción de otro informe', async () => {
  const fixture = storeFixture({ fragmented: true });
  comoAdmin(fixture);
  fixture.documents.set(`${ROOT}/planes_accion/9`, action(9, { idInforme: 'otro', idHallazgo: 'h-otro' }));
  const response = await fixture.update({
    coleccion: 'planes', registro: { idInforme: 'i1', actualizaciones: [{ id: 9, accion: 'Intento' }], nuevas: [] },
  });
  assert.equal(response.code, 404);
  assert.equal(fixture.documents.get(`${ROOT}/planes_accion/9`).accion, 'Acción 9');
  sinListados(fixture);
});

test('crear planes desde create.js reserva IDs consecutivos libres sin listar planes', async () => {
  const T = 1793000000000;
  const fixture = storeFixture({ fragmented: true });
  comoAdmin(fixture);
  fixture.documents.set(`${ROOT}/planes_accion/${T + 1}`, action(T + 1));
  const response = await conHoraFija(T, () => fixture.create({
    coleccion: 'planes',
    registro: { idInforme: 'i1', items: [
      { idHallazgo: 'h1', accion: 'Primera', ...correosPlan },
      { idHallazgo: 'h1', accion: 'Segunda', ...correosPlan },
    ] },
  }));
  assert.equal(response.code, 200, JSON.stringify(fixture.errors) + JSON.stringify(response));
  assert.deepEqual(response.body.registros.map(plan => plan.id), [T, T + 2]);
  assert.equal(fixture.documents.get(`${ROOT}/planes_accion/${T + 1}`).accion, `Acción ${T + 1}`, 'no sobrescribe');
  sinListados(fixture);
});

test('crear un hallazgo calcula el consecutivo leyendo hallazgos, no planes', async () => {
  const anio = new Date().getFullYear();
  const fixture = storeFixture({ fragmented: true });
  comoAdmin(fixture);
  fixture.documents.set(`${ROOT}/hallazgos/h4`, { id: 'h4', idInforme: 'i1', ref: `HAL-${anio}-004` });
  const response = await fixture.create({
    coleccion: 'hallazgos', registro: { titulo: 'Nuevo hallazgo', idInforme: 'i1', proceso: 'Operaciones' },
  });
  assert.equal(response.code, 200, JSON.stringify(fixture.errors) + JSON.stringify(response));
  const creado = [...fixture.documents.entries()].find(([key, value]) => key.startsWith(`${ROOT}/hallazgos/`) && value.titulo === 'Nuevo hallazgo');
  assert.equal(creado[1].ref, `HAL-${anio}-005`);
  assert.ok(!fixture.reads.some(path => path.includes('planes_accion')), fixture.reads.join(', '));
});

// ============================================================================
// Migración de riesgos — fase 2: lectura doble (sin índice todo queda igual)
// ============================================================================
const PARTE = indice => `workspace_compartido/base_de_datos_grc_riesgos_${indice}`;
const riesgo = (id, extra = {}) => ({ id, proceso: 'Operaciones', descripcion: `Riesgo ${id}`, ...extra });

test('riesgos sin índice de migración: se leen del documento principal sin lecturas adicionales', async () => {
  const fixture = storeFixture({ fragmented: true });
  fixture.documents.set(ROOT, { riesgos: [riesgo(1), riesgo(2)], comites: [] });
  const { data } = await fixture.workspace.leerWorkspaceGrc();
  assert.deepEqual(data.riesgos.map(item => item.id), [1, 2]);
  assert.ok(!fixture.directReads.some(path => path.includes('base_de_datos_grc_riesgos_')), fixture.directReads.join(', '));
});

test('riesgos con índice: se leen de las partes en el orden de la matriz y el índice no viaja al cliente', async () => {
  const fixture = storeFixture({ fragmented: true });
  fixture.documents.set(ROOT, {
    riesgos: [riesgo(99, { descripcion: 'Copia original, ya no vigente' })],
    riesgosFragmentados: { version: 1, partes: 2, orden: ['3', '1', '2'] },
  });
  fixture.documents.set(PARTE(0), { riesgos: [riesgo(1), riesgo(2)] });
  fixture.documents.set(PARTE(1), { riesgos: [riesgo(3), riesgo(4)] });
  const { data } = await fixture.workspace.leerWorkspaceGrc();
  assert.deepEqual(data.riesgos.map(item => item.id), [3, 1, 2, 4], 'orden del índice; los no listados al final');
  assert.equal('riesgosFragmentados' in data, false);
});

test('riesgos con índice pero una parte faltante: se usa el campo original y se registra el error', async () => {
  const fixture = storeFixture({ fragmented: true });
  fixture.documents.set(ROOT, { riesgos: [riesgo(1)], riesgosFragmentados: { version: 1, partes: 2, orden: [] } });
  fixture.documents.set(PARTE(0), { riesgos: [riesgo(5)] });
  const { data } = await fixture.workspace.leerWorkspaceGrc();
  assert.deepEqual(data.riesgos.map(item => item.id), [1]);
  assert.equal(fixture.workspaceErrors.length, 1);
});

test('índice inválido se ignora (comportamiento original)', async () => {
  const fixture = storeFixture({ fragmented: true });
  fixture.documents.set(ROOT, { riesgos: [riesgo(1)], riesgosFragmentados: { partes: 0 } });
  const { data } = await fixture.workspace.leerWorkspaceGrc();
  assert.deepEqual(data.riesgos.map(item => item.id), [1]);
  assert.ok(!fixture.directReads.some(path => path.includes('base_de_datos_grc_riesgos_')));
});

test('con índice activo, guardar la lista de riesgos escribe en las partes y no en el campo original', async () => {
  const fixture = storeFixture({ fragmented: true });
  const indice = { version: 1, partes: 1, orden: ['1'] };
  fixture.documents.set(ROOT, { riesgos: [riesgo(1)], riesgosFragmentados: indice, comites: [] });
  fixture.documents.set(PARTE(0), { riesgos: [riesgo(1)] });
  await fixture.workspace.guardarWorkspaceParcial({ riesgos: [riesgo(1, { descripcion: 'Editado' })] });
  assert.equal(fixture.documents.get(PARTE(0)).riesgos[0].descripcion, 'Editado');
  assert.equal(fixture.documents.get(ROOT).riesgos[0].descripcion, 'Riesgo 1', 'el campo original queda como respaldo');
  // Otros guardados siguen funcionando y conservan el índice.
  await fixture.workspace.guardarWorkspaceParcial({ comites: [{ id: 'c1' }] });
  assert.equal(fixture.documents.get(ROOT).riesgosFragmentados.partes, 1);
  assert.deepEqual(fixture.documents.get(ROOT).comites, [{ id: 'c1' }]);
});

test('sin índice, guardar riesgos funciona igual que antes; el cliente no puede escribir el índice', async () => {
  const fixture = storeFixture({ fragmented: true });
  fixture.documents.set(ROOT, { riesgos: [riesgo(1)] });
  await fixture.workspace.guardarWorkspaceParcial({ riesgos: [riesgo(2), riesgo(1)] });
  assert.deepEqual(fixture.documents.get(ROOT).riesgos.map(item => item.id), [2, 1]);
  await assert.rejects(fixture.workspace.guardarWorkspaceParcial({ riesgosFragmentados: { partes: 1 } }), /índice/);
  assert.equal(fixture.documents.get(ROOT).riesgosFragmentados, undefined);
});

// ============================================================================
// Migración de riesgos — fases 3 y 4: copia y escrituras unificadas
// ============================================================================
const ADMIN = { uid: 'u1', email: 'controlinterno@example.test', rol: 'admin' };
const escenarioMigracion = () => {
  const fixture = storeFixture({ fragmented: true });
  fixture.sesion.usuario = ADMIN;
  fixture.documents.set(ROOT, {
    comites: [{ id: 'c1' }],
    riesgos: [
      riesgo(1),
      riesgo(539, { historialCambios: [{ accion: 'a' }, { accion: 'b' }, { accion: 'c' }] }),
      riesgo(2),
    ],
  });
  // Versión más reciente del riesgo 539, guardada por el módulo Riesgos en la colección raíz.
  fixture.documents.set('riesgos/539', riesgo(539, {
    descripcion: 'Edición del 16/10', ultimaActualizacion: '2026-10-16T22:28:31.554Z',
    historialCambios: [{ accion: 'a' }, { accion: 'b' }, { accion: 'c' }, { accion: 'd' }],
  }));
  return fixture;
};
const idsMatriz = async fixture => (await fixture.workspace.leerWorkspaceGrc()).data.riesgos.map(item => item.id);

test('migración: simular no escribe nada y reporta la decisión del riesgo 539', async () => {
  const fixture = escenarioMigracion();
  const antes = JSON.stringify([...fixture.documents]);
  const response = await fixture.migrar({});
  assert.equal(response.code, 200, JSON.stringify(response));
  assert.equal(response.body.estado, 'simulacion');
  assert.equal(response.body.riesgosMigrados, 3);
  assert.deepEqual(response.body.decisiones.map(d => [d.id, d.conservada]), [['539', 'coleccion-riesgos']]);
  assert.equal(JSON.stringify([...fixture.documents]), antes, 'la simulación no modifica ningún documento');
});

test('migración: solo administradores y ejecutar exige confirmación escrita', async () => {
  const fixture = escenarioMigracion();
  fixture.sesion.usuario = { uid: 'u2', email: 'auditor@example.test', rol: 'auditor' };
  assert.equal((await fixture.migrar({ ejecutar: true, confirmacion: 'MIGRAR-RIESGOS' })).code, 403);
  fixture.sesion.usuario = ADMIN;
  assert.equal((await fixture.migrar({ ejecutar: true })).code, 400);
  assert.ok(!fixture.documents.has(PARTE(0)));
});

test('migración: ejecutar copia a las partes, conserva el orden y no borra el original; es idempotente', async () => {
  const fixture = escenarioMigracion();
  const response = await fixture.migrar({ ejecutar: true, confirmacion: 'MIGRAR-RIESGOS' });
  assert.equal(response.code, 200, JSON.stringify(response));
  assert.equal(response.body.estado, 'migrado');
  const { data } = await fixture.workspace.leerWorkspaceGrc();
  assert.deepEqual(data.riesgos.map(item => item.id), [1, 539, 2], 'mismo orden que antes');
  assert.equal(data.riesgos.find(item => item.id === 539).descripcion, 'Edición del 16/10', 'recupera la edición');
  assert.equal(fixture.documents.get(ROOT).riesgos.length, 3, 'el campo original queda intacto');
  assert.ok(fixture.documents.has('riesgos/539'), 'la colección raíz queda intacta');
  assert.deepEqual(fixture.documents.get(ROOT).comites, [{ id: 'c1' }], 'no toca otros datos');
  const escriturasPrevias = fixture.writes.length;
  const segunda = await fixture.migrar({ ejecutar: true, confirmacion: 'MIGRAR-RIESGOS' });
  assert.equal(segunda.body.estado, 'ya-migrado');
  assert.equal(fixture.writes.length, escriturasPrevias, 'repetir no escribe nada');
});

test('tras migrar: guardar una lista parcial no borra riesgos; la importación de Excel sí reemplaza', async () => {
  const fixture = escenarioMigracion();
  await fixture.migrar({ ejecutar: true, confirmacion: 'MIGRAR-RIESGOS' });
  await fixture.workspace.guardarWorkspaceParcial({ riesgos: [riesgo(2, { descripcion: 'Editado' })] });
  assert.deepEqual(await idsMatriz(fixture), [2, 1, 539], 'los ausentes se conservan');
  assert.equal(fixture.documents.get(ROOT).riesgos.length, 3, 'el campo original no se reescribe');
  await fixture.workspace.guardarWorkspaceParcial({ riesgos: [riesgo(7)], riesgosReemplazoTotal: true });
  assert.deepEqual(await idsMatriz(fixture), [7]);
  assert.equal('riesgosReemplazoTotal' in fixture.documents.get(ROOT), false, 'la marca no se persiste');
});

test('tras migrar: el módulo Riesgos guarda, crea y elimina sobre la misma matriz que ve la app', async () => {
  const fixture = escenarioMigracion();
  await fixture.migrar({ ejecutar: true, confirmacion: 'MIGRAR-RIESGOS' });
  const base = { proceso: 'Operaciones', probabilidadInherente: 60, impactoInherente: 60, controlesDetallados: [] };
  let response = await fixture.riesgos('POST', { ...riesgo(1), ...base, descripcion: 'Editado en el módulo' });
  assert.equal(response.code, 200, JSON.stringify(response));
  response = await fixture.riesgos('POST', { ...riesgo(900), ...base });
  assert.equal(response.code, 200, JSON.stringify(response));
  const { data } = await fixture.workspace.leerWorkspaceGrc();
  assert.equal(data.riesgos.find(item => item.id === 1).descripcion, 'Editado en el módulo', 'la edición persiste');
  assert.equal(data.riesgos.find(item => item.id === 1).nivelResidual !== undefined, true, 'recalculado en servidor');
  assert.deepEqual(data.riesgos.map(item => item.id), [1, 539, 2, 900], 'el nuevo va al final');
  assert.equal((await fixture.riesgos('DELETE', null, { id: '2' })).code, 200);
  assert.deepEqual(await idsMatriz(fixture), [1, 539, 900]);
  assert.equal((await fixture.riesgos('DELETE', null, { id: '2' })).code, 404);
  const lectura = await fixture.riesgos('GET');
  assert.deepEqual(lectura.body.riesgos.map(item => item.id), [1, 539, 900], 'GET devuelve la matriz vigente');
});

test('tras migrar: un líder no puede editar ni eliminar riesgos de otro proceso', async () => {
  const fixture = escenarioMigracion();
  await fixture.migrar({ ejecutar: true, confirmacion: 'MIGRAR-RIESGOS' });
  fixture.sesion.usuario = { uid: 'u3', email: 'lider@example.test', rol: 'auditor', procesosAsignados: ['Finanzas'] };
  const base = { proceso: 'Finanzas', probabilidadInherente: 60, impactoInherente: 60, controlesDetallados: [] };
  const response = await fixture.riesgos('POST', { ...riesgo(1), ...base });
  assert.equal(response.code, 403, 'el riesgo guardado pertenece a Operaciones');
  assert.equal((await fixture.riesgos('DELETE', null, { id: '1' })).code, 403);
  assert.deepEqual(await idsMatriz(fixture), [1, 539, 2]);
});

test('tras migrar: el dueño anula controles (queda el historial) pero no puede borrarlos; el administrador sí', async () => {
  const fixture = escenarioMigracion();
  await fixture.migrar({ ejecutar: true, confirmacion: 'MIGRAR-RIESGOS' });
  const preventivo = { descripcion: 'Conciliación', tipo: 'Preventivo', implementacion: 'Manual' };
  const base = { ...riesgo(1), proceso: 'Operaciones', probabilidadInherente: 60, impactoInherente: 60 };
  assert.equal((await fixture.riesgos('POST', { ...base, controlesDetallados: [preventivo, preventivo] })).code, 200);

  fixture.sesion.usuario = { uid: 'u4', email: 'duenio@example.test', rol: 'lider', procesosAsignados: ['Operaciones'] };
  const borrar = await fixture.riesgos('POST', { ...base, controlesDetallados: [preventivo] });
  assert.equal(borrar.code, 409);
  assert.match(borrar.error, /anúlalos/);

  const anulado = { ...preventivo, estado: 'Anulado', anulacion: { usuario: 'duenio@example.test', tipoMotivo: 'Ya no aplica', motivo: 'Se eliminó la actividad' } };
  const anular = await fixture.riesgos('POST', { ...base, controlesDetallados: [preventivo, anulado] });
  assert.equal(anular.code, 200, JSON.stringify(anular));
  const { data } = await fixture.workspace.leerWorkspaceGrc();
  const guardado = data.riesgos.find(item => item.id === 1);
  assert.equal(guardado.controlesDetallados.length, 2, 'el control anulado se conserva');
  assert.equal(guardado.probabilidadResidual, 36, 'solo el control vigente reduce: 60 % × (1 − 40 %)');

  fixture.sesion.usuario = { uid: 'u1', email: 'auditor@example.test', rol: 'admin' };
  assert.equal((await fixture.riesgos('POST', { ...base, controlesDetallados: [preventivo] })).code, 200, 'el administrador puede borrar');
});

test('tras migrar: cada edición deja en el historial qué cambió, antes y después, con el usuario', async () => {
  const fixture = escenarioMigracion();
  await fixture.migrar({ ejecutar: true, confirmacion: 'MIGRAR-RIESGOS' });
  const control = { descripcion: 'Conciliación', tipo: 'Preventivo', implementacion: 'Manual', frecuencia: 'Continua' };
  const base = { ...riesgo(1), proceso: 'Operaciones', probabilidadInherente: 60, impactoInherente: 60, planAccionRiesgo: '' };
  assert.equal((await fixture.riesgos('POST', { ...base, controlesDetallados: [control] })).code, 200);
  const editar = await fixture.riesgos('POST', {
    ...base, planAccionRiesgo: 'Conciliación mensual en Zeus', controlesDetallados: [{ ...control, frecuencia: 'Aleatoria' }, { descripcion: 'Revisión del jefe', tipo: 'Detectivo' }],
  });
  assert.equal(editar.code, 200, JSON.stringify(editar));
  const { data } = await fixture.workspace.leerWorkspaceGrc();
  const ultima = data.riesgos.find(item => item.id === 1).historialCambios.at(-1);
  assert.equal(ultima.usuario, 'controlinterno@example.test');
  assert.deepEqual(ultima.cambios.map(cambio => cambio.campo), ['Probabilidad residual', 'Plan de acción', 'CTL-21 · Frecuencia', 'CTL-22 agregado']);
  assert.deepEqual(ultima.cambios.find(cambio => cambio.campo === 'Probabilidad residual'), { campo: 'Probabilidad residual', antes: '36%', despues: '25%' });

  const sinCambios = await fixture.riesgos('POST', { ...base, planAccionRiesgo: 'Conciliación mensual en Zeus', controlesDetallados: [{ ...control, frecuencia: 'Aleatoria' }, { descripcion: 'Revisión del jefe', tipo: 'Detectivo' }] });
  assert.equal(sinCambios.code, 200);
  const despues = (await fixture.workspace.leerWorkspaceGrc()).data.riesgos.find(item => item.id === 1).historialCambios;
  assert.equal(despues.length, data.riesgos.find(item => item.id === 1).historialCambios.length, 'guardar sin cambios no agrega entradas');
});

test('sin migrar: el módulo Riesgos mantiene su comportamiento actual', async () => {
  const fixture = escenarioMigracion();
  const base = { proceso: 'Operaciones', probabilidadInherente: 60, impactoInherente: 60, controlesDetallados: [] };
  const response = await fixture.riesgos('POST', { ...riesgo(1), ...base });
  assert.equal(response.code, 200, JSON.stringify(response));
  assert.ok(fixture.documents.has('riesgos/1'), 'escribe en la colección raíz como hoy');
  assert.ok(!fixture.documents.has(PARTE(0)));
});

// ============================================================================
// Migración de riesgos — fase 6: limpieza de copias antiguas
// ============================================================================
const CONFIRMAR_LIMPIEZA = { ejecutar: true, confirmacion: 'LIMPIAR-RIESGOS' };

test('limpieza: sin migrar no hace nada', async () => {
  const fixture = escenarioMigracion();
  const response = await fixture.limpiar(CONFIRMAR_LIMPIEZA);
  assert.equal(response.body.estado, 'no-migrado');
  assert.equal(fixture.documents.get(ROOT).riesgos.length, 3);
  assert.ok(fixture.documents.has('riesgos/539'));
});

test('limpieza: simular no borra nada; solo admin y con confirmación', async () => {
  const fixture = escenarioMigracion();
  await fixture.migrar({ ejecutar: true, confirmacion: 'MIGRAR-RIESGOS' });
  const antes = JSON.stringify([...fixture.documents]);
  const simulacion = await fixture.limpiar({});
  assert.equal(simulacion.body.estado, 'simulacion');
  assert.deepEqual(simulacion.body.faltantesEnMatrizVigente, []);
  assert.equal(simulacion.body.riesgosEnCampoAntiguo, 3);
  assert.equal(simulacion.body.documentosColeccionAparte, 1);
  assert.equal((await fixture.limpiar({ ejecutar: true })).code, 400);
  fixture.sesion.usuario = { uid: 'u2', email: 'auditor@example.test', rol: 'auditor' };
  assert.equal((await fixture.limpiar(CONFIRMAR_LIMPIEZA)).code, 403);
  assert.equal(JSON.stringify([...fixture.documents]), antes, 'nada cambió');
});

test('limpieza: borra solo las copias antiguas; la matriz vigente y los demás datos quedan intactos', async () => {
  const fixture = escenarioMigracion();
  await fixture.migrar({ ejecutar: true, confirmacion: 'MIGRAR-RIESGOS' });
  await fixture.riesgos('POST', { ...riesgo(900), proceso: 'Operaciones', probabilidadInherente: 60, impactoInherente: 60, controlesDetallados: [] });
  const antes = (await fixture.workspace.leerWorkspaceGrc()).data.riesgos;
  const response = await fixture.limpiar(CONFIRMAR_LIMPIEZA);
  assert.equal(response.code, 200, JSON.stringify(response));
  assert.equal(response.body.estado, 'limpiado');
  assert.equal(fixture.documents.get(ROOT).riesgos, undefined, 'campo antiguo eliminado');
  assert.ok(!fixture.documents.has('riesgos/539'), 'colección aparte vaciada');
  assert.deepEqual(fixture.documents.get(ROOT).comites, [{ id: 'c1' }], 'otros datos intactos');
  const despues = (await fixture.workspace.leerWorkspaceGrc()).data.riesgos;
  assert.deepEqual(despues, antes, 'la app ve exactamente la misma matriz');
  assert.equal(despues.find(item => item.id === 539).descripcion, 'Edición del 16/10');
  assert.equal((await fixture.limpiar(CONFIRMAR_LIMPIEZA)).body.estado, 'ya-limpio');
  // Después de limpiar, guardar sigue funcionando.
  await fixture.workspace.guardarWorkspaceParcial({ riesgos: [riesgo(1, { descripcion: 'Tras limpiar' })] });
  assert.equal((await fixture.workspace.leerWorkspaceGrc()).data.riesgos.find(item => item.id === 1).descripcion, 'Tras limpiar');
});

test('limpieza: se bloquea si un riesgo antiguo no está en la matriz vigente, salvo confirmación explícita', async () => {
  const fixture = escenarioMigracion();
  await fixture.migrar({ ejecutar: true, confirmacion: 'MIGRAR-RIESGOS' });
  await fixture.riesgos('DELETE', null, { id: '2' }); // eliminado a propósito después de migrar
  const bloqueado = await fixture.limpiar(CONFIRMAR_LIMPIEZA);
  assert.equal(bloqueado.body.estado, 'bloqueado');
  assert.deepEqual(bloqueado.body.faltantesEnMatrizVigente, ['2']);
  assert.equal(fixture.documents.get(ROOT).riesgos.length, 3, 'no borró nada');
  const confirmado = await fixture.limpiar({ ...CONFIRMAR_LIMPIEZA, faltantesConfirmados: ['2'] });
  assert.equal(confirmado.body.estado, 'limpiado');
});
