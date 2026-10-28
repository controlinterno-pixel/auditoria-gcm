import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as workflow from '../src/utils/programPlanWorkflow.js';
import { validarAdjuntoEvaluacion } from '../src/utils/evaluationAttachment.js';
import { sanitizarUrls, validarDatosSync } from '../api/_lib/validation.js';
import { esAdministradorTotal, puedeVerTodo } from '../api/_lib/roles.js';
import { estadoNoAplica } from '../src/utils/noAplicaHallazgo.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const source = path => read(path).replace(/^import [^;]*;\r?\n/gm, '').replace('export default async function handler', 'async function handler');
const criterios = puntaje => Object.fromEntries(['c1', 'c2', 'c3', 'c4', 'c5'].map(key => [key, puntaje]));
const soporte = { nombre: 'Evaluacion.pdf', tamano: 100, url: 'https://repos.termalessantarosa.com.co/api/archivos/auditoria/controlInterno/evaluacion.pdf' };
const plan = (overrides = {}) => ({
  id: 1, idInforme: 'i1', idHallazgo: 'h1', accion: 'Acción de prueba', sede: 'Hotel',
  correoResponsable: 'ejecutor@example.test', correoRevisor: 'revisor@example.test', correoAuditor: 'auditor@example.test',
  progreso: 0, estado: 'En Proceso', estadoWorkflow: workflow.ESTADO_EVALUACION_INICIAL,
  historialCambios: [], ...overrides,
});

function harness({ planes = [plan()], tipoFuente = 'Programa de Auditoría', email = 'auditor@example.test', rol = 'lider', fragmented = false, failWrite = false } = {}) {
  let data = {
    planes: structuredClone(planes),
    hallazgos: [{ id: 'h1', idInforme: 'i1', proceso: 'Operaciones', correoCreador: 'ejecutor@example.test', estado: 'Abierto' }],
    informesAuditoria: [{ id: 'i1', tipoFuente, correoAuditor: 'auditor@example.test' }],
    fuentesMejora: [],
  };
  const report = data.informesAuditoria[0];
  if (fragmented) data.informesAuditoria = [];
  const writes = [];
  const user = { uid: 'u1', email, rol, permisos: ['sub_seguimiento_planes'] };
  const profile = { ...user, procesosAsignados: ['Operaciones'] };
  const bindings = {
    estadoNoAplica,
    esAdministradorTotal, puedeVerTodo,
    ...workflow,
    validarAdjuntoEvaluacion, sanitizarUrls, validarDatosSync,
    applyCors: () => false, requireAuth: async () => user,
    sendSuccess: (res, result) => Object.assign(res, { code: 200, result }),
    sendError: (res, message, code) => Object.assign(res, { code, message }),
    logger: { info() {}, warn() {}, error() {} },
    notificarSemaforo: async () => {},
    leerWorkspaceGrc: async () => ({
      data: structuredClone(data), workspaceExists: true, workspaceRef: 'workspace',
      coleccionInformesRef: { doc: id => ({ reportId: id }) },
      coleccionPlanesRef: { doc: id => ({ planId: id }) },
      coleccionHallazgosRef: { doc: id => ({ findingId: id }) },
    }),
    // Lecturas puntuales sobre los mismos datos en memoria (las reales se prueban en grcClosurePersistence).
    leerWorkspaceGrcLigero: async (...args) => bindings.leerWorkspaceGrc(...args),
    obtenerPlanesTx: async (_tx, ws, ids) => ids.map(id => ws.data.planes.find(item => String(item.id) === String(id)) || null),
    obtenerHallazgosTx: async (_tx, ws, ids) => new Map(ids.map(String).flatMap(id => {
      const hallazgo = ws.data.hallazgos.find(item => String(item.id) === id);
      return hallazgo ? [[id, hallazgo]] : [];
    })),
    obtenerPlanesDeHallazgosTx: async (_tx, ws, ids) => {
      const claves = new Set([...ids].map(String));
      return ws.data.planes.filter(item => claves.has(String(item.idHallazgo)));
    },
    obtenerPlanesDeInformeTx: async (_tx, ws, idInforme) => {
      const hallazgos = ws.data.hallazgos.filter(item => String(item.idInforme) === String(idInforme));
      const ids = new Set(hallazgos.map(item => String(item.id)));
      return {
        hallazgos,
        planes: ws.data.planes.filter(item => String(item.idInforme) === String(idInforme) || ids.has(String(item.idHallazgo))),
      };
    },
    reservarIdsPlanesTx: async (_tx, ws, cantidad) => {
      const maximo = ws.data.planes.reduce((mayor, item) => Math.max(mayor, Number(item.id) || 0), 0);
      return Array.from({ length: cantidad }, (_, indice) => maximo + 1 + indice);
    },
    listarHallazgosTx: async (_tx, ws) => ws.data.hallazgos,
    guardarInformesGrc() {},
    guardarPlanesGrc: (transaction, workspace, planes) => {
      planes.forEach(plan => transaction.set(workspace.coleccionPlanesRef.doc(String(plan.id)), plan));
    },
    leerInformeTx: (transaction, workspace, id) => transaction.get(workspace.coleccionInformesRef.doc(id)),
    guardarRegistrosGrc: (transaction, workspace, coleccion, registros, { claveDe = registro => registro.id } = {}) => {
      const referencia = { planes: 'coleccionPlanesRef', hallazgos: 'coleccionHallazgosRef', informes: 'coleccionInformesRef' }[coleccion];
      registros.forEach(registro => transaction.set(workspace[referencia].doc(String(claveDe(registro))), registro));
    },
    guardarWorkspaceParcial: async partial => { writes.push(partial); data = { ...data, ...partial }; },
    obtenerProcesosAsignados: () => ['operaciones'],
    obtenerSubprocesosAsignados: () => [],
    registroDentroDelAlcance: () => true,
    registroDentroDelAlcanceAsignado: () => true,
    adminDb: {
      collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => profile }) }) }),
      runTransaction: async callback => {
        const pending = [];
        const result = await callback({
          get: async () => ({ exists: true, id: report.id, data: () => report }),
          set: (ref, partial) => { if (failWrite) throw new Error('Simulated write failure'); pending.push({ ref, partial }); },
        });
        for (const { ref, partial } of pending) {
          writes.push(partial);
          if (ref.planId) {
            const existe = data.planes.some(plan => String(plan.id) === ref.planId);
            data.planes = existe ? data.planes.map(plan => String(plan.id) === ref.planId ? partial : plan) : [...data.planes, partial];
          } else if (ref.findingId) {
            data.hallazgos = data.hallazgos.map(item => String(item.id) === ref.findingId ? partial : item);
          } else data = { ...data, ...partial };
        }
        return result;
      },
    },
  };
  const load = file => new Function(...Object.keys(bindings), `${source(file)}\nreturn handler;`)(...Object.values(bindings));
  const review = load('../api/_grc/review-plans.js');
  const update = load('../api/_grc/update.js');
  const create = load('../api/_grc/create.js');
  const call = async (handler, body, method) => {
    const res = {};
    await handler({ body, method, url: '/mock' }, res);
    return res;
  };
  return {
    data: () => data, writes, user,
    review: body => call(review, body, 'POST'),
    update: registro => call(update, { coleccion: 'planes', registro }, 'PUT'),
    create: registro => call(create, { coleccion: 'planes', registro }, 'POST'),
    syncAllowed: async planes => {
      const text = read('../api/_grc/sync.js');
      const start = text.indexOf('function serializarEvaluacion');
      const functions = text.slice(start, text.indexOf('/**', start));
      const check = new Function(...Object.keys(bindings), `${functions}\nreturn usuarioPuedeEvaluarPlanes;`)(...Object.values(bindings));
      // sync.js lee el workspace una sola vez y lo comparte con sus validaciones.
      return check({ planes }, user, (await bindings.leerWorkspaceGrc()).data);
    },
  };
}

const evaluate = (h, puntaje, extra = {}) => h.review({
  decision: 'evaluar-diseno', idInforme: 'i1', idsPlanes: [1],
  criterios: criterios(puntaje), justificacion: puntaje < 80 ? 'El diseño requiere ajustes' : '', adjuntoEvaluacion: soporte, ...extra,
});

test('evaluación inicial exige soporte válido antes de escribir, aprobada o devuelta', async () => {
  for (const puntaje of [79, 80]) {
    for (const adjuntoEvaluacion of [null, { ...soporte, url: 'https://example.test/a.pdf' }, { ...soporte, tamano: 3 * 1024 * 1024 }]) {
      const h = harness();
      const response = await evaluate(h, puntaje, { adjuntoEvaluacion });
      assert.equal(response.code, 400);
      assert.equal(h.writes.length, 0);
    }
    const h = harness();
    assert.equal((await evaluate(h, puntaje)).code, 200);
    const registro = h.data().planes[0].evaluacionHolistica;
    assert.deepEqual(registro.adjuntoEvaluacion, validarAdjuntoEvaluacion(soporte));
    assert.deepEqual(h.data().planes[0].historialEvaluaciones[0].adjuntoEvaluacion, registro.adjuntoEvaluacion);
    assert.ok(!JSON.stringify(registro).includes('contenidoBase64'));
  }
});

test('asignaciones bloqueadas para ejecutor incluso administrador; creación y otro administrador conservan permisos', () => {
  assert.equal(workflow.puedeEditarAsignacionPlan(plan(), ' EJECUTOR@example.test ', false), false);
  assert.equal(workflow.puedeEditarAsignacionPlan(plan(), 'ejecutor@example.test', true), false);
  assert.equal(workflow.puedeEditarAsignacionPlan(plan(), 'revisor@example.test', false), false);
  assert.equal(workflow.puedeEditarAsignacionPlan(plan(), 'admin@example.test', true), true);
  assert.equal(workflow.puedeEditarAsignacionPlan(null, 'ejecutor@example.test', false), true);
});

test('API rechaza cambios de cargos, correos y confirmaciones por el ejecutor sin escribir', async () => {
  const cambios = [
    { correoResponsable: 'otro@example.test', correoConfirmacion: 'otro@example.test' },
    { correoRevisor: 'otro@example.test', correoRevisorConfirmacion: 'otro@example.test' },
    { correoAuditor: 'otro@example.test' },
    { correoConfirmacion: 'otro@example.test' },
    { correoRevisorConfirmacion: 'otro@example.test' },
    { responsable: 'Otro cargo' },
    { revisor: 'Otra jefatura' },
  ];
  for (const rol of ['lider', 'admin']) {
    for (const cambio of cambios) {
      const h = harness({ email: 'ejecutor@example.test', rol, planes: [plan({ estadoWorkflow: 'En Ejecución' })] });
      const res = await h.update({ idInforme: 'i1', actualizaciones: [{ id: 1, ...cambio }] });
      assert.equal(res.code, 403, JSON.stringify({ rol, cambio }));
      assert.match(res.message, /ejecutor no puede modificar/);
      assert.equal(h.writes.length, 0);
    }
  }
});

test('bloqueo de correos aplica también en ajustes iniciales y en otras fuentes', async () => {
  for (const tipoFuente of ['Programa de Auditoría', 'Auditoría Externa']) {
    const h = harness({ email: 'ejecutor@example.test', tipoFuente, planes: [plan({ estadoWorkflow: workflow.ESTADO_AJUSTES_INICIALES })] });
    const res = await h.update({ idInforme: 'i1', actualizaciones: [{ id: 1, correoAuditor: 'otro@example.test' }] });
    assert.equal(res.code, 403);
    assert.equal(h.writes.length, 0);
  }
});

test('ejecutor puede guardar avance y evidencia con los correos originales intactos', async () => {
  const h = harness({ email: 'ejecutor@example.test', planes: [plan({ estadoWorkflow: 'En Ejecución' })] });
  const res = await h.update({ idInforme: 'i1', actualizaciones: [{
    id: 1, progreso: 50, evidenciaUrl: 'https://example.test/evidencia',
    correoResponsable: 'ejecutor@example.test', correoConfirmacion: 'ejecutor@example.test',
    correoRevisor: 'revisor@example.test', correoRevisorConfirmacion: 'revisor@example.test',
  }] });
  assert.equal(res.code, 200);
  assert.equal(h.data().planes[0].progreso, 50);
  assert.equal(h.data().planes[0].correoRevisor, 'revisor@example.test');
});

test('acción reportada al 100% queda bloqueada para su ejecutor, incluso administrador', async () => {
  for (const estadoWorkflow of ['Pendiente Validación Revisor', 'En Revisión (100%)']) {
    const enviada = plan({ estadoWorkflow, progreso: 100 });
    assert.equal(workflow.bloqueadaParaEjecutor(enviada, ' EJECUTOR@example.test '), true);
    assert.equal(workflow.bloqueadaParaEjecutor(enviada, 'revisor@example.test'), false);
    for (const rol of ['lider', 'admin']) {
      const h = harness({ email: 'ejecutor@example.test', rol, planes: [enviada] });
      const res = await h.update({ idInforme: 'i1', actualizaciones: [{ id: 1, accion: 'Otra acción', progreso: 100 }] });
      assert.equal(res.code, 403, JSON.stringify({ estadoWorkflow, rol }));
      assert.equal(h.writes.length, 0);
    }
  }
  assert.equal(workflow.bloqueadaParaEjecutor(plan({ estadoWorkflow: 'En Ejecución', progreso: 90 }), 'ejecutor@example.test'), false);
  const h = harness({ email: 'admin@example.test', rol: 'admin', planes: [plan({ estadoWorkflow: 'Pendiente Validación Revisor', progreso: 100 })] });
  const res = await h.update({ idInforme: 'i1', actualizaciones: [{ id: 1, accion: 'Corrección del administrador' }] });
  assert.equal(res.code, 200);
});

test('otro administrador puede corregir un correo con su confirmación', async () => {
  const h = harness({ email: 'admin@example.test', rol: 'admin', planes: [plan({ estadoWorkflow: 'En Ejecución' })] });
  const res = await h.update({ idInforme: 'i1', actualizaciones: [{
    id: 1, correoRevisor: 'nuevo@example.test', correoRevisorConfirmacion: 'nuevo@example.test',
  }] });
  assert.equal(res.code, 200);
  assert.equal(h.data().planes[0].correoRevisor, 'nuevo@example.test');
});

test('sincronización general no permite que un ejecutor administrador cambie sus asignaciones', async () => {
  const h = harness({ email: 'ejecutor@example.test', rol: 'admin', planes: [plan({ estadoWorkflow: 'En Ejecución' })] });
  const original = h.data().planes[0];
  for (const cambio of [
    { correoResponsable: 'otro@example.test' }, { correoRevisor: 'otro@example.test' },
    { correoAuditor: 'otro@example.test' }, { responsable: 'Otro cargo' },
    { correoConfirmacion: 'otro@example.test' }, { correoRevisorConfirmacion: 'otro@example.test' },
  ]) assert.equal(await h.syncAllowed([{ ...original, ...cambio }]), false);
  assert.equal(await h.syncAllowed([{ ...original, progreso: 40 }]), true);
});

test('tipo de fuente determina la ruta, incluso sin programaId y con fuente vinculada', () => {
  assert.equal(workflow.esInformePrograma({ tipoFuente: 'Programa de Auditoría' }), true);
  assert.equal(workflow.esInformePrograma({ tipoFuente: 'F1' }, [{ codigo: 'F1', tipoFuente: 'Programa de Auditoría' }]), true);
  assert.equal(workflow.esInformePrograma({ tipoFuente: 'Auditoría Interna', programaId: 'p1' }), false);
});

test('alertas y botones siguen cada etapa real; el 100% sin validar no habilita el cierre', () => {
  const stages = [
    [workflow.ESTADO_EVALUACION_INICIAL, 0, 'auditor', 'Evaluar matriz'],
    [workflow.ESTADO_AJUSTES_INICIALES, 0, 'ejecutor', 'Corregir matriz'],
    ['En Ejecución', 50, 'ejecutor', 'Ejecutar acción'],
    ['En Ejecución', 100, 'ejecutor', 'Ejecutar acción'],
    ['Pendiente Validación Revisor', 100, 'revisor', 'Revisar matriz'],
    ['En Revisión (100%)', 100, 'auditor', 'Evaluar y cerrar acción'],
  ];
  for (const [estadoWorkflow, progreso, rol, boton] of stages) {
    const etapa = workflow.etapaAccionPrograma(plan({ estadoWorkflow, progreso }));
    assert.equal(etapa.rol, rol);
    assert.equal(etapa.boton, boton);
  }
  assert.equal(workflow.etapaAccionPrograma(plan({ estadoWorkflow: 'Cerrado', progreso: 100 })), null);
  assert.equal(workflow.etapaAccionPrograma(plan({ estadoWorkflow: 'Pendiente Validación Revisor', progreso: 90 })), null);
  assert.equal(workflow.etapaAccionPrograma(plan({ estadoWorkflow: 'En Revisión (100%)', progreso: 90 })), null);
});

test('cada rol ve únicamente su siguiente tarea y el ejecutor ve el bloqueo inicial', () => {
  const text = read('../src/components/Planes.jsx');
  const fn = text.slice(text.indexOf('  const tareasCicloPrograma ='), text.indexOf('\n  useEffect', text.indexOf('  const tareasCicloPrograma =')));
  const planes = [
    plan(), plan({ id: 2, estadoWorkflow: 'En Ejecución' }),
    plan({ id: 3, estadoWorkflow: 'Pendiente Validación Revisor', progreso: 100 }),
    plan({ id: 4, estadoWorkflow: 'En Revisión (100%)', progreso: 100 }),
    plan({ id: 5, estadoWorkflow: 'Cerrado', progreso: 100 }),
  ];
  const tasks = email => {
    const bindings = {
    esAdministradorTotal, puedeVerTodo,
      planesEnriquecidos: planes, esPlanProgramaAuditoria: () => true,
      etapaAccionPrograma: workflow.etapaAccionPrograma,
      normalizarIdentidad: valor => String(valor || '').trim().toLowerCase(),
      user: { email }, perfilUsuario: {},
      esAuditorAsignado: (p, correo) => p.correoAuditor === correo,
    };
    return new Function(...Object.keys(bindings), `${fn}\nreturn tareasCicloPrograma;`)(...Object.values(bindings));
  };
  assert.deepEqual(tasks('ejecutor@example.test').map(item => [item.plan.id, item.enEspera]), [[1, true], [2, false]]);
  assert.deepEqual(tasks('revisor@example.test').map(item => item.plan.id), [3]);
  assert.deepEqual(tasks('auditor@example.test').map(item => item.plan.id), [4]);
  assert.deepEqual(tasks('otro@example.test'), []);
  assert.deepEqual(tasks(''), []);
});

for (const score of [79, 80, 81, 100]) {
  test(`evaluación inicial real con ${score}%: ${score >= 80 ? 'habilita, no cierra' : 'bloquea y devuelve'}`, async () => {
    const h = harness();
    const response = await evaluate(h, score);
    assert.equal(response.code, 200, response.message);
    const updated = h.data().planes[0];
    assert.equal(updated.evaluacionHolistica.puntaje, score);
    assert.equal(updated.evaluacionHolistica.usuario, 'auditor@example.test');
    assert.equal(updated.estadoWorkflow, score >= 80 ? 'En Ejecución' : workflow.ESTADO_AJUSTES_INICIALES);
    assert.equal(updated.progreso, 0);
    assert.equal(updated.estado, 'En Proceso');
    assert.equal(h.data().hallazgos[0].estado, 'Abierto');
  });
}

test('la ponderación se calcula en servidor y no confía en un puntaje enviado', async () => {
  const h = harness();
  const res = await evaluate(h, 0, { criterios: { c1: 100, c2: 100, c3: 100, c4: 0, c5: 0 }, puntaje: 100 });
  assert.equal(res.code, 200);
  assert.equal(h.data().planes[0].evaluacionHolistica.puntaje, 70);
  assert.equal(h.data().planes[0].estadoWorkflow, workflow.ESTADO_AJUSTES_INICIALES);
});

test('rechazo requiere motivo y criterios válidos, sin escribir', async () => {
  const h = harness();
  assert.equal((await evaluate(h, 79, { justificacion: '' })).code, 400);
  assert.equal((await evaluate(h, 80, { criterios: { ...criterios(80), c1: 101 } })).code, 400);
  assert.equal((await evaluate(h, 80, { criterios: { ...criterios(80), c1: '80' } })).code, 400);
  assert.equal(h.writes.length, 0);
});

test('solo el auditor asignado puede evaluar; no necesita rol administrador', async () => {
  const other = harness({ email: 'otro@example.test', rol: 'admin' });
  assert.equal((await evaluate(other, 100)).code, 403);
  assert.equal(other.writes.length, 0);
  const executor = harness({ email: 'ejecutor@example.test', planes: [plan({ correoAuditor: 'ejecutor@example.test' })] });
  assert.equal((await evaluate(executor, 100)).code, 403);
  assert.equal((await evaluate(harness(), 80)).code, 200);
});

test('selección se restringe al informe y conserva acciones de otro auditor', async () => {
  const h = harness({ planes: [plan(), plan({ id: 2, correoAuditor: 'otro@example.test' }), plan({ id: 3, idInforme: 'i2', idHallazgo: 'h2' })] });
  assert.equal((await evaluate(h, 80, { idsPlanes: [1, 2] })).code, 403);
  assert.equal((await evaluate(h, 80, { idsPlanes: [3] })).code, 400);
  assert.equal((await evaluate(h, 80)).code, 200);
  assert.equal(h.data().planes[1].estadoWorkflow, workflow.ESTADO_EVALUACION_INICIAL);
  assert.equal(h.data().planes[2].estadoWorkflow, workflow.ESTADO_EVALUACION_INICIAL);
});

test('evaluación repetida o desactualizada no duplica el historial', async () => {
  const h = harness();
  assert.equal((await evaluate(h, 80)).code, 200);
  assert.equal((await evaluate(h, 80)).code, 409);
  assert.equal(h.data().planes[0].historialEvaluaciones.length, 1);
});

test('informes fragmentados y pendientes legados conservan avance', async () => {
  const h = harness({ fragmented: true, planes: [plan({ estadoWorkflow: 'Pendiente Revisión Jefatura', progreso: 30 })] });
  assert.equal((await evaluate(h, 80)).code, 200);
  assert.equal(h.data().planes[0].progreso, 30);
});

test('ejecución legada ya al 100% se puede remitir al revisor sin alterar su avance', async () => {
  const h = harness({ email: 'ejecutor@example.test', planes: [plan({ estadoWorkflow: 'En Ejecución', progreso: 100 })] });
  const res = await h.update({ idInforme: 'i1', actualizaciones: [{ id: 1, progreso: 100 }] });
  assert.equal(res.code, 200);
  assert.equal(h.data().planes[0].progreso, 100);
  assert.equal(h.data().planes[0].estadoWorkflow, 'Pendiente Validación Revisor');
});

test('existentes en ejecución/revisión/cerrados no se migran a evaluación inicial', async () => {
  for (const state of ['En Ejecución', 'Pendiente Validación Revisor', 'En Revisión (100%)', 'Cerrado']) {
    const h = harness({ planes: [plan({ estadoWorkflow: state, progreso: 90 })] });
    assert.equal((await evaluate(h, 100)).code, 409);
    assert.equal(h.writes.length, 0);
  }
});

test('otras fuentes conservan diseño por revisor, sin evaluación inicial', async () => {
  const h = harness({ tipoFuente: 'Auditoría Externa', email: 'revisor@example.test', planes: [plan({ estadoWorkflow: 'Pendiente Revisión Jefatura' })] });
  assert.equal((await evaluate(h, 100)).code, 409);
  assert.equal((await h.review({ decision: 'aprobar', idInforme: 'i1' })).code, 200);
  assert.equal(h.data().planes[0].estadoWorkflow, 'En Ejecución');
});

const nueva = {
  idHallazgo: 'h1', accion: 'Nueva acción', responsable: 'Responsable', revisor: 'Revisor',
  correoResponsable: 'ejecutor@example.test', correoConfirmacion: 'ejecutor@example.test',
  correoRevisor: 'revisor@example.test', correoRevisorConfirmacion: 'revisor@example.test',
  correoAuditor: 'auditor@example.test',
};
for (const endpoint of ['update', 'create']) {
  test(`${endpoint}: nueva acción comienza bloqueada y al 0%, aunque cliente envíe otro estado`, async () => {
    const h = harness({ planes: [], email: 'ejecutor@example.test' });
    const item = { ...nueva, estadoWorkflow: 'Cerrado', progreso: 100, evaluacionHolistica: { aprobado: true }, historialEvaluaciones: [{ aprobado: true }] };
    const res = endpoint === 'update'
      ? await h.update({ idInforme: 'i1', nuevas: [item] })
      : await h.create({ idInforme: 'i1', items: [item] });
    assert.equal(res.code, 200, res.message);
    assert.equal(h.data().planes[0].estadoWorkflow, workflow.ESTADO_EVALUACION_INICIAL);
    assert.equal(h.data().planes[0].progreso, 0);
    assert.equal(h.data().planes[0].evaluacionHolistica, null);
    assert.deepEqual(h.data().planes[0].historialEvaluaciones, []);
  });
}

test('ejecutor no puede avanzar antes de aprobar, pero sí corregir y reenviar el diseño rechazado', async () => {
  const h = harness();
  assert.equal((await evaluate(h, 70)).code, 200);
  h.user.email = 'ejecutor@example.test';
  const blocked = await h.update({ idInforme: 'i1', actualizaciones: [{ id: 1, progreso: 10 }] });
  assert.equal(blocked.code, 403);
  const corrected = await h.update({ idInforme: 'i1', actualizaciones: [{ id: 1, accion: 'Diseño corregido', progreso: 0 }] });
  assert.equal(corrected.code, 200, corrected.message);
  assert.equal(h.data().planes[0].estadoWorkflow, workflow.ESTADO_EVALUACION_INICIAL);
  assert.equal(h.data().planes[0].historialEvaluaciones[0].puntaje, 70);
  assert.equal(h.data().planes[0].evaluacionHolistica, null);
  h.user.email = 'auditor@example.test';
  assert.equal((await evaluate(h, 80)).code, 200);
  assert.equal(h.data().planes[0].historialEvaluaciones.length, 2);
});

test('flujo completo: 80% -> ejecutor -> 100% -> revisor -> auditor -> cierre', async () => {
  const h = harness();
  await evaluate(h, 80);
  h.user.email = 'ejecutor@example.test';
  assert.equal((await h.update({ idInforme: 'i1', actualizaciones: [{ id: 1, progreso: 100, evidenciaUrl: 'https://example.test/evidencia' }] })).code, 200);
  assert.equal(h.data().planes[0].estadoWorkflow, 'Pendiente Validación Revisor');
  h.user.email = 'auditor@example.test';
  assert.equal((await h.review({ decision: 'cerrar', idPlan: 1 })).code, 409);
  h.user.email = 'revisor@example.test';
  assert.equal((await h.review({ decision: 'aprobar', idInforme: 'i1' })).code, 200);
  assert.equal(h.data().planes[0].estadoWorkflow, 'En Revisión (100%)');
  h.user.email = 'auditor@example.test';
  assert.equal((await h.review({ decision: 'cerrar', idPlan: 1, evaluacionEficacia: { conclusion: 'Cumple', observaciones: '' } })).code, 200);
  assert.equal(h.data().planes[0].estadoWorkflow, 'Cerrado');
  assert.equal(h.data().hallazgos[0].estado, 'Cerrado');
  assert.equal(h.data().planes[0].evaluacionHolistica.tipo, workflow.TIPO_EVALUACION_INICIAL);
});

test('rechazo final exige motivo y vuelve al 90% con nueva validación del revisor', async () => {
  const h = harness({ planes: [plan({ progreso: 100, estadoWorkflow: 'En Revisión (100%)', validadoPorRevisorCorreo: 'revisor@example.test' })] });
  assert.equal((await h.review({ decision: 'rechazar', idPlan: 1 })).code, 400);
  assert.equal((await h.review({ decision: 'rechazar', idPlan: 1, motivo: 'Soporte incompleto' })).code, 200);
  assert.equal(h.data().planes[0].progreso, 90);
  assert.equal(h.data().planes[0].validadoPorRevisorCorreo, '');
  h.user.email = 'ejecutor@example.test';
  await h.update({ idInforme: 'i1', actualizaciones: [{ id: 1, progreso: 100 }] });
  assert.equal(h.data().planes[0].estadoWorkflow, 'Pendiente Validación Revisor');
});

test('revisor no puede saltarse evaluación inicial de programas, ni otro usuario cerrar', async () => {
  const h = harness({ email: 'revisor@example.test', planes: [plan({ estadoWorkflow: 'Pendiente Revisión Jefatura' })] });
  assert.equal((await h.review({ decision: 'aprobar', idInforme: 'i1' })).code, 409);
  const other = harness({ email: 'otro@example.test', planes: [plan({ progreso: 100, estadoWorkflow: 'En Revisión (100%)' })] });
  assert.equal((await other.review({ decision: 'cerrar', idPlan: 1 })).code, 403);
});

test('cierre individual legado no exige nueva evaluación ni cierra acciones pendientes del hallazgo', async () => {
  const h = harness({ planes: [plan({ progreso: 100, estadoWorkflow: 'En Revisión (100%)' }), plan({ id: 2, estadoWorkflow: 'En Ejecución', progreso: 50 })] });
  assert.equal((await h.review({ decision: 'cerrar', idPlan: 1 })).code, 200);
  assert.equal(h.data().planes[1].progreso, 50);
  assert.equal(h.data().hallazgos[0].estado, 'Abierto');
});

const finalPlan = overrides => plan({ progreso: 100, estadoWorkflow: 'En Revisión (100%)', ...overrides });
const closeAll = (h, overrides = {}) => h.review({
  decision: 'cerrar', alcance: 'todas', idInforme: 'i1', idsPlanes: [1, 2],
  evaluacionEficacia: { conclusion: 'Evidencias verificadas; resultados eficaces.', requiereAccionesAdicionales: false },
  ...overrides,
});

test('eficacia conjunta cierra todas atómicamente, registra evaluador y conserva evaluación inicial', async () => {
  const inicial = { tipo: workflow.TIPO_EVALUACION_INICIAL, puntaje: 80, aprobado: true };
  const h = harness({ fragmented: true, planes: [finalPlan({ evaluacionHolistica: inicial }), finalPlan({ id: 2, evaluacionHolistica: inicial })] });
  const res = await closeAll(h);
  assert.equal(res.code, 200, res.message);
  assert.equal(res.result.planes.length, 2);
  assert.equal(res.result.hallazgos[0].estado, 'Cerrado');
  assert.ok(h.data().planes.every(plan => plan.estadoWorkflow === 'Cerrado'));
  assert.ok(h.data().planes.every(plan => plan.evaluacionEficaciaCierre.usuario === 'auditor@example.test'));
  assert.ok(h.data().planes.every(plan => plan.evaluacionEficaciaCierre.alcance === 'todas'));
  assert.ok(h.data().planes.every(plan => plan.historialEficacia.length === 1));
  assert.ok(h.data().planes.every(plan => plan.evaluacionHolistica.puntaje === 80));
  const repeated = await closeAll(h);
  assert.equal(repeated.code, 409);
  assert.ok(h.data().planes.every(plan => plan.historialEficacia.length === 1));
});

test('todas queda bloqueado si una acción sigue ejecutándose, pero permite cierre individual', async () => {
  const h = harness({ planes: [finalPlan(), plan({ id: 2, estadoWorkflow: 'En Ejecución', progreso: 80 })] });
  assert.equal((await closeAll(h)).code, 409);
  assert.equal(h.writes.length, 0);
  assert.equal((await closeAll(h, { idsPlanes: [1] })).code, 409);
  assert.equal(h.writes.length, 0);
  assert.equal((await h.review({ decision: 'cerrar', idPlan: 1, evaluacionEficacia: { conclusion: 'Acción eficaz' } })).code, 200);
  assert.equal(h.data().planes[1].progreso, 80);
});

test('cierre conjunto no modifica cerradas ni acciones de otros informes; rechaza otro auditor', async () => {
  const h = harness({ planes: [
    finalPlan(), finalPlan({ id: 2 }), finalPlan({ id: 3, estadoWorkflow: 'Cerrado', estado: 'Cerrado' }),
    finalPlan({ id: 4, idInforme: 'i2', idHallazgo: 'h2' }),
  ] });
  const cerrada = structuredClone(h.data().planes[2]);
  assert.equal((await closeAll(h)).code, 200);
  assert.deepEqual(h.data().planes[2], cerrada);
  assert.equal(h.data().planes[3].estadoWorkflow, 'En Revisión (100%)');
  const other = harness({ planes: [finalPlan(), finalPlan({ id: 2, correoAuditor: 'otro@example.test' })] });
  assert.equal((await closeAll(other)).code, 403);
  assert.equal(other.writes.length, 0);
});

test('fallo al escribir no cierra parte del informe ni sus hallazgos', async () => {
  const h = harness({ failWrite: true, planes: [finalPlan(), finalPlan({ id: 2 })] });
  assert.equal((await closeAll(h)).code, 500);
  assert.ok(h.data().planes.every(plan => plan.estadoWorkflow === 'En Revisión (100%)'));
  assert.equal(h.data().hallazgos[0].estado, 'Abierto');
});

test('cierre conjunto exige conclusión, selección exacta, origen común y validación previa', async () => {
  for (const changes of [
    { evaluacionEficacia: null }, { evaluacionEficacia: { conclusion: ' ' } },
    { idsPlanes: [] }, { idsPlanes: [1, 1] }, { idsPlanes: [1, 'x/y'] },
    { idInforme: 'i2' },
  ]) {
    const h = harness({ planes: [finalPlan(), finalPlan({ id: 2 })] });
    assert.equal((await closeAll(h, changes)).code, 400);
    assert.equal(h.writes.length, 0);
  }
  const pending = harness({ planes: [finalPlan(), finalPlan({ id: 2, estadoWorkflow: 'Pendiente Validación Revisor' })] });
  assert.equal((await closeAll(pending)).code, 409);
  assert.equal(pending.writes.length, 0);
});

test('auditor heredado del informe puede guardar eficacia; ejecutor no puede autoaprobarse', async () => {
  const h = harness({ fragmented: true, planes: [finalPlan({ correoAuditor: '' })] });
  assert.equal((await h.review({ decision: 'cerrar', idPlan: 1, evaluacionEficacia: { conclusion: 'Eficaz' } })).code, 200);
  const own = harness({ email: 'ejecutor@example.test', planes: [finalPlan({ correoAuditor: 'ejecutor@example.test' })] });
  assert.equal((await own.review({ decision: 'cerrar', idPlan: 1 })).code, 403);
});

test('otras fuentes conservan eficacia al final sin evaluación inicial ponderada', async () => {
  const h = harness({ tipoFuente: 'Indicador de Gestión', planes: [finalPlan(), finalPlan({ id: 2 })] });
  assert.equal((await closeAll(h)).code, 200);
  assert.ok(h.data().planes.every(plan => !plan.evaluacionHolistica));
  assert.equal(h.data().hallazgos[0].estado, 'Abierto');
});

test('dictamen conjunto no eficaz devuelve todas al 90% sin cerrar hallazgo', async () => {
  const h = harness({ planes: [finalPlan(), finalPlan({ id: 2 })] });
  assert.equal((await closeAll(h, { decision: 'rechazar', motivo: 'Falta demostrar resultado' })).code, 200);
  assert.ok(h.data().planes.every(plan => plan.progreso === 90 && plan.evaluacionEficaciaCierre.fueEficaz === false));
  assert.ok(h.data().planes.every(plan => plan.validadoPorRevisorCorreo === ''));
  assert.equal(h.data().hallazgos[0].estado, 'Abierto');
});

test('fallo de persistencia no anuncia aprobación ni modifica datos', async () => {
  const h = harness({ failWrite: true });
  assert.equal((await evaluate(h, 80)).code, 500);
  assert.equal(h.data().planes[0].estadoWorkflow, workflow.ESTADO_EVALUACION_INICIAL);
  assert.equal(h.writes.length, 0);
});

test('sync genérico no permite saltar aprobación ni falsificar evaluaciones', async () => {
  const h = harness();
  assert.equal(await h.syncAllowed([plan({ progreso: 100, estadoWorkflow: 'Cerrado' })]), false);
  assert.equal(await h.syncAllowed([plan({ estadoWorkflow: 'En Ejecución' })]), false);
  assert.equal(await h.syncAllowed([plan({ evaluacionHolistica: { tipo: workflow.TIPO_EVALUACION_INICIAL, puntaje: 100, aprobado: true } })]), false);
  assert.equal(await h.syncAllowed([plan()]), true);
  assert.equal(await h.syncAllowed([plan(), plan({ id: 2 })]), true);
});

test('notificación de creación: ejecutor informado y auditor asignado recibe tarea, no revisor', async () => {
  const text = read('../src/components/Planes.jsx');
  const fn = text.slice(text.indexOf('  const notificarRegistroPlan ='), text.indexOf('  // Un plan al 100%'));
  const payloads = [];
  const notify = new Function('asuntoTareaPlan', 'esPlanProgramaAuditoria', 'enviarNotificacionPlanConReintento', 'window', `${fn}\nreturn notificarRegistroPlan;`)(
    workflow.asuntoTareaPlan, () => true, async payload => { payloads.push(payload); return true; }, { location: { origin: 'https://example.test' } },
  );
  assert.equal(await notify(plan(), true), true);
  assert.deepEqual(payloads.map(item => item.destinatarios), ['ejecutor@example.test', 'auditor@example.test']);
  assert.match(payloads[1].proceso_auditado, /80%/);
  assert.match(payloads[1].enlace_pdf, /reviewReportId=i1/);
  assert.match(payloads[1].proceso_auditado, /Evaluar matriz/);
});

for (const puntaje of [79, 80, 100]) {
  test(`resultado inicial ${puntaje}% notifica a cada ejecutor su acción, sin pedir tareas al revisor`, async () => {
    const text = read('../src/components/Planes.jsx');
    const fn = text.slice(text.indexOf('  const notificarResultadoEvaluacionInicial ='), text.indexOf('  const notificarEjecucionCompleta ='));
    const payloads = [];
    const notify = new Function('enviarNotificacionPlanConReintento', 'window', `${fn}\nreturn notificarResultadoEvaluacionInicial;`)(
      async payload => { payloads.push(payload); return true; }, { location: { origin: 'https://example.test' } },
    );
    const planes = [plan(), plan({ id: 2, accion: 'Segunda acción', correoResponsable: 'otroejecutor@example.test' })];
    assert.equal(await notify({ id: 'i1' }, planes, puntaje, 'Dictamen técnico', true, soporte), true);
    assert.ok(payloads.every(item => item.adjuntosCorreo.length === 1 && item.adjuntosCorreo[0] === soporte));
    assert.deepEqual(payloads.map(item => item.destinatarios), ['ejecutor@example.test', 'otroejecutor@example.test']);
    assert.match(payloads[0].proceso_auditado, puntaje >= 80 ? /Ejecutar acción/ : /Corregir matriz/);
    assert.match(payloads[0].proceso_auditado, new RegExp(`${puntaje}%`));
    assert.ok(!payloads[0].proceso_auditado.includes('Segunda acción'));
    assert.match(payloads[1].proceso_auditado, /Segunda acción/);
    assert.ok(payloads.every(item => item.enlace_pdf === 'https://example.test/?reviewReportId=i1'));
  });
}

test('aviso al 100% lleva al revisor a la matriz, no a la evidencia ni al cierre anticipado', async () => {
  const text = read('../src/components/Planes.jsx');
  const fn = text.slice(text.indexOf('  const notificarEjecucionCompleta ='), text.indexOf('  // Un plan al 100%'));
  const payloads = [];
  const notify = new Function('asuntoTareaPlan', 'enviarNotificacionPlanConReintento', 'window', 'revisorNoAplica', 'ESTADO_PENDIENTE_VALIDACION_REVISOR', `${fn}\nreturn notificarEjecucionCompleta;`)(
    workflow.asuntoTareaPlan,
    async payload => { payloads.push(payload); return true; }, { location: { origin: 'https://example.test' } },
    item => item?.revisorNoAplica === true, 'Pendiente Validación Revisor',
  );
  await notify(plan({ evidenciaUrl: 'https://soportes.example.test/archivo.pdf', progreso: 100 }), true);
  assert.equal(payloads[0].destinatarios, 'revisor@example.test');
  // Sin revisor, el aviso del 100 % va al auditor aprobador.
  await notify(plan({ progreso: 100, revisorNoAplica: true, correoAuditor: 'auditor.final@example.test' }), true);
  assert.equal(payloads[1].destinatarios, 'auditor.final@example.test');
  assert.match(payloads[1].titulo_informe, /sin revisor/);
  assert.equal(payloads[0].enlace_pdf, 'https://example.test/?reviewReportId=i1');
  assert.match(payloads[0].proceso_auditado, /Revisar matriz/);
  assert.match(payloads[0].proceso_auditado, /100% no cierra/);
  assert.equal((text.match(/await notificarEjecucionCompleta\(/g) || []).length, 3);
});

test('rechazo del revisor devuelve al 90% y conserva la evaluación inicial', async () => {
  const initial = { tipo: workflow.TIPO_EVALUACION_INICIAL, puntaje: 80, aprobado: true };
  const h = harness({ email: 'revisor@example.test', planes: [plan({ progreso: 100, estadoWorkflow: 'Pendiente Validación Revisor', evaluacionHolistica: initial })] });
  assert.equal((await h.review({ decision: 'corregir', idInforme: 'i1', motivo: 'Falta soporte' })).code, 200);
  assert.equal(h.data().planes[0].progreso, 90);
  assert.equal(h.data().planes[0].estadoWorkflow, 'En Ejecución');
  assert.deepEqual(h.data().planes[0].evaluacionHolistica, initial);
});

test('diseño aprobado: el ejecutor no lo cambia ni reabre la evaluación (el administrador sí, ver prueba de acción al 100 %)', async () => {
  const h = harness();
  await evaluate(h, 80);
  const accionAprobada = h.data().planes[0].accion;
  h.user.email = 'ejecutor@example.test';
  await h.update({ idInforme: 'i1', actualizaciones: [{ id: 1, progreso: 35 }] });
  // Corrigiendo la ejecución escribe "Corregido" en la descripción: se ignora y sigue en ejecución.
  await h.update({ idInforme: 'i1', actualizaciones: [{ id: 1, accion: `${accionAprobada}. Corregido`, progreso: 60 }] });
  assert.equal(h.data().planes[0].estadoWorkflow, 'En Ejecución');
  assert.equal(h.data().planes[0].accion, accionAprobada, 'el diseño aprobado no cambia');
  assert.equal(h.data().planes[0].progreso, 60, 'el avance sí se guarda');
  assert.equal(h.data().planes[0].historialEvaluaciones.length, 1);
});

test('error de Gmail conserva el guardado y encola exactamente el mensaje pendiente', async () => {
  const text = read('../src/components/Planes.jsx');
  const fn = text.slice(text.indexOf('  const enviarNotificacionPlanConReintento ='), text.indexOf('  const notificarRegistroPlan ='));
  const queued = [];
  const logs = [];
  const notify = new Function('showNotification', 'ejecutarDespachoGmailApi', 'encolarReintentoNotificacion', 'console', `${fn}\nreturn enviarNotificacionPlanConReintento;`)(
    () => {}, async () => { throw new Error('Simulated Gmail error'); }, payload => queued.push(payload),
    { error: (...args) => logs.push(args) },
  );
  const payload = { destinatarios: 'ejecutor@example.test', titulo_informe: 'Resultado de evaluación', adjuntosCorreo: [soporte] };
  assert.equal(await notify(payload), false);
  assert.deepEqual(queued, [payload]);
  assert.deepEqual(JSON.parse(JSON.stringify(queued[0])).adjuntosCorreo, [soporte]);
  assert.equal(logs.length, 1);
});

const flush = async () => {
  for (let index = 0; index < 30; index++) await Promise.resolve();
};

for (const decision of ['aprobar', 'corregir']) {
  test(`notificación tras ${decision} ejecución por el revisor llega a la siguiente persona`, async () => {
    const text = read('../src/components/Planes.jsx');
    const fn = text.slice(text.indexOf('  const resolverDecisionRevision ='), text.indexOf('\n  return (', text.indexOf('  const resolverDecisionRevision =')));
    const payloads = [];
    const before = plan({ progreso: 100, estadoWorkflow: 'Pendiente Validación Revisor' });
    const after = { ...before, estadoWorkflow: decision === 'aprobar' ? 'En Revisión (100%)' : 'En Ejecución', progreso: decision === 'aprobar' ? 100 : 90 };
    const bindings = {
    esAdministradorTotal, puedeVerTodo, asuntoTareaPlan: workflow.asuntoTareaPlan,
      revisionInformeId: 'i1', guardandoDecisionRevision: false, motivoCorreccion: 'Soporte incompleto',
      user: { email: 'revisor@example.test' }, planesEnriquecidos: [before],
      ESTADO_PENDIENTE_VALIDACION_REVISOR: 'Pendiente Validación Revisor', esPlanProgramaAuditoria: () => true,
      prepararEnvioGmail: async () => true,
      apiService: { decidirRevisionPlanes: async () => ({ planes: [after] }) },
      setPlanes() {}, setRevisionInformeId() {}, setMostrarMotivoCorreccion() {}, setMotivoCorreccion() {},
      setModoRevisionMatriz() {}, setModoConsultaPlan() {}, setEditPlan() {}, setFormInformeId() {}, setMatrixState() {}, setVistaActiva() {},
      setGuardandoDecisionRevision() {}, showNotification() {},
      obtenerPendientesRevision: () => [before], setDevolucionAccion() {}, setDecidiendoRevisionId() {},
      informesAuditoria: [{ id: 'i1', tipoFuente: 'Programa de Auditoría' }],
      enviarNotificacionPlanConReintento: async payload => { payloads.push(payload); return true; },
      window: { location: { origin: 'https://example.test' } }, alert: message => assert.fail(message),
    };
    const handler = new Function(...Object.keys(bindings), `${fn}\nreturn resolverDecisionRevision;`)(...Object.values(bindings));
    await handler(decision);
    await flush();
    assert.equal(payloads.length, 1);
    assert.equal(payloads[0].destinatarios, decision === 'aprobar' ? 'auditor@example.test' : 'ejecutor@example.test');
    assert.match(payloads[0].proceso_auditado, decision === 'aprobar' ? /aprobación final/ : /90%/);
    assert.equal(payloads[0].enlace_pdf, 'https://example.test/?reviewReportId=i1');
    if (decision === 'aprobar') assert.match(payloads[0].proceso_auditado, /Evaluar y cerrar acción/);
  });
}

test('aprobado el diseño, revisor y auditor aprobador solo consultan, aunque sean administradores', async () => {
  const enEjecucion = plan({ estadoWorkflow: 'En Ejecución', progreso: 40 });
  assert.equal(workflow.bloqueadaParaRevisorOAuditor(enEjecucion, 'revisor@example.test'), true);
  assert.equal(workflow.bloqueadaParaRevisorOAuditor(enEjecucion, 'AUDITOR@example.test'), true);
  assert.equal(workflow.bloqueadaParaRevisorOAuditor(enEjecucion, 'ejecutor@example.test'), false);
  assert.equal(workflow.bloqueadaParaRevisorOAuditor(enEjecucion, 'admin@example.test'), false);
  assert.equal(workflow.bloqueadaParaRevisorOAuditor(plan({ correoAuditor: '', estadoWorkflow: 'En Ejecución' }), 'auditor@example.test', 'auditor@example.test'), true);
  assert.equal(workflow.bloqueadaParaRevisorOAuditor(plan(), 'auditor@example.test'), false);
  for (const email of ['revisor@example.test', 'auditor@example.test']) {
    const h = harness({ email, rol: 'admin', planes: [enEjecucion] });
    const res = await h.update({ idInforme: 'i1', actualizaciones: [{ id: 1, progreso: 80, accion: 'Cambio indebido' }] });
    assert.equal(res.code, 403, email);
    assert.match(res.message, /solo el ejecutor/);
    assert.equal(h.writes.length, 0);
  }
  const ejecutor = harness({ email: 'ejecutor@example.test', planes: [enEjecucion] });
  assert.equal((await ejecutor.update({ idInforme: 'i1', actualizaciones: [{ id: 1, progreso: 60 }] })).code, 200);
  const revisorSync = harness({ email: 'revisor@example.test', rol: 'admin', planes: [enEjecucion] });
  assert.equal(await revisorSync.syncAllowed([{ ...enEjecucion, accion: 'Cambio indebido' }]), false);
});

test('revisor decide todas, una a una o aprueba unas y devuelve otras', async () => {
  const listas = () => [1, 2, 3].map(id => plan({ id, progreso: 100, estadoWorkflow: 'Pendiente Validación Revisor' }));
  const h = harness({ email: 'revisor@example.test', planes: listas() });
  assert.equal((await h.review({ decision: 'aprobar', idInforme: 'i1', idsPlanes: [1] })).code, 200);
  assert.deepEqual(h.data().planes.map(p => p.estadoWorkflow), ['En Revisión (100%)', 'Pendiente Validación Revisor', 'Pendiente Validación Revisor']);
  assert.equal((await h.review({ decision: 'corregir', idInforme: 'i1', idsPlanes: [2], motivo: 'Falta evidencia' })).code, 200);
  assert.equal(h.data().planes[1].estadoWorkflow, 'En Ejecución');
  assert.equal(h.data().planes[1].progreso, 90);
  assert.equal(h.data().planes[2].estadoWorkflow, 'Pendiente Validación Revisor');
  // Ya decidida o inexistente: rechazada sin escribir.
  const escrituras = h.writes.length;
  assert.equal((await h.review({ decision: 'aprobar', idInforme: 'i1', idsPlanes: [1] })).code, 409);
  assert.equal((await h.review({ decision: 'aprobar', idInforme: 'i1', idsPlanes: [3, 99] })).code, 409);
  assert.equal((await h.review({ decision: 'aprobar', idInforme: 'i1', idsPlanes: [] })).code, 409);
  assert.equal(h.writes.length, escrituras);
  // Sin selección decide todas las pendientes (comportamiento anterior).
  const todas = harness({ email: 'revisor@example.test', planes: listas() });
  assert.equal((await todas.review({ decision: 'aprobar', idInforme: 'i1' })).code, 200);
  assert.ok(todas.data().planes.every(p => p.estadoWorkflow === 'En Revisión (100%)'));
});

test('auditor evalúa el diseño de acciones individuales; las demás siguen pendientes', async () => {
  const h = harness({ planes: [plan({ id: 1 }), plan({ id: 2 })] });
  assert.equal((await evaluate(h, 90, { idsPlanes: [1] })).code, 200);
  assert.equal(h.data().planes[0].estadoWorkflow, 'En Ejecución');
  assert.equal(h.data().planes[1].estadoWorkflow, workflow.ESTADO_EVALUACION_INICIAL);
  assert.equal((await evaluate(h, 60, { idsPlanes: [2] })).code, 200);
  assert.equal(h.data().planes[1].estadoWorkflow, workflow.ESTADO_AJUSTES_INICIALES);
  assert.equal(h.data().planes[0].estadoWorkflow, 'En Ejecución');
});

test('devuelta por el aprobador: el ejecutor edita solo esa; las cerradas quedan bloqueadas', async () => {
  const cerrada = plan({ id: 1, progreso: 100, estadoWorkflow: 'Cerrado', estado: 'Cerrado' });
  const devuelta = plan({ id: 2, progreso: 90, estadoWorkflow: 'En Ejecución' });
  assert.equal(workflow.accionCerrada(cerrada), true);
  assert.equal(workflow.bloqueadaParaEjecutor(cerrada, 'ejecutor@example.test'), true);
  assert.equal(workflow.bloqueadaParaEjecutor(devuelta, 'ejecutor@example.test'), false);
  for (const rol of ['lider', 'admin']) {
    const h = harness({ email: 'ejecutor@example.test', rol, planes: [cerrada, devuelta] });
    const rechazo = await h.update({ idInforme: 'i1', actualizaciones: [{ id: 1, accion: 'Cambio sobre cerrada' }] });
    assert.equal(rechazo.code, 403, rol);
    assert.equal(h.writes.length, 0);
    const ok = await h.update({ idInforme: 'i1', actualizaciones: [{ id: 2, progreso: 100, evidenciaUrl: 'https://example.test/nueva' }] });
    assert.equal(ok.code, 200, rol);
    assert.equal(h.data().planes[1].estadoWorkflow, 'Pendiente Validación Revisor');
    assert.equal(h.data().planes[0].accion, 'Acción de prueba');
  }
  const s = harness({ email: 'ejecutor@example.test', rol: 'admin', planes: [cerrada] });
  assert.equal(await s.syncAllowed([{ ...cerrada, accion: 'Cambio sobre cerrada' }]), false);
  // Los valores por defecto del guardado masivo no cuentan como cambio.
  assert.equal(await s.syncAllowed([{ ...cerrada, sede: cerrada.sede, evidenciaUrl: '', matrizLegal: 'No aplica', tipoAccion: 'Acción Correctiva' }]), true);
});

test('eficacia rechazada: ejecutor -> revisor -> nueva evaluación del aprobador -> cierre', async () => {
  const h = harness({ planes: [plan({ progreso: 100, estadoWorkflow: 'En Revisión (100%)', validadoPorRevisorCorreo: 'revisor@example.test' })] });
  const eficacia = { conclusion: 'No demuestra eficacia', observaciones: 'Faltan soportes' };
  assert.equal((await h.review({ decision: 'rechazar', idPlan: 1, motivo: 'Faltan soportes', evaluacionEficacia: eficacia })).code, 200);
  assert.equal(h.data().planes[0].estadoWorkflow, 'En Ejecución');
  assert.equal(h.data().planes[0].progreso, 90);
  // El aprobador no puede cerrarla sin que vuelva a pasar por ejecutor y revisor.
  assert.equal((await h.review({ decision: 'cerrar', idPlan: 1, evaluacionEficacia: { conclusion: 'Cumple', observaciones: '' } })).code, 409);
  h.user.email = 'ejecutor@example.test';
  assert.equal((await h.update({ idInforme: 'i1', actualizaciones: [{ id: 1, progreso: 100 }] })).code, 200);
  assert.equal(h.data().planes[0].estadoWorkflow, 'Pendiente Validación Revisor');
  // El revisor vuelve a tener la tarea, aunque ya la hubiera validado en la ronda anterior.
  assert.equal(workflow.etapaAccionPrograma(h.data().planes[0])?.rol, 'revisor');
  assert.equal(workflow.etapaAccionPrograma(h.data().planes[0])?.boton, 'Revisar matriz');
  const textoPlanes = read('../src/components/Planes.jsx');
  assert.match(textoPlanes, /p\.estadoWorkflow === ESTADO_PENDIENTE_VALIDACION_REVISOR && esRevisor &&/);
  // La campana del revisor usa la misma regla: la acción vuelve a ser suya.
  assert.equal(workflow.tareaPendientePlan(h.data().planes[0], { esPrograma: true })?.rol, 'revisor');
  assert.match(read('../src/App.jsx'), /correoEn\(p\.correoRevisor\) && tareaDePlan\(p\)\?\.rol === 'revisor'/);
  h.user.email = 'auditor@example.test';
  assert.equal((await h.review({ decision: 'cerrar', idPlan: 1, evaluacionEficacia: { conclusion: 'Cumple', observaciones: '' } })).code, 409);
  h.user.email = 'revisor@example.test';
  assert.equal((await h.review({ decision: 'aprobar', idInforme: 'i1', idsPlanes: [1] })).code, 200);
  assert.equal(h.data().planes[0].estadoWorkflow, 'En Revisión (100%)');
  h.user.email = 'auditor@example.test';
  assert.equal((await h.review({ decision: 'cerrar', idPlan: 1, evaluacionEficacia: { conclusion: 'Cumple', observaciones: '' } })).code, 200);
  assert.equal(h.data().planes[0].estadoWorkflow, 'Cerrado');
  assert.equal(h.data().planes[0].historialEficacia.length, 2, 'conserva la evaluación rechazada y la nueva');
});

test('evaluación inicial: un solo correo por ejecutor con todas sus acciones', async () => {
  const text = read('../src/components/Planes.jsx');
  const fn = text.slice(text.indexOf('  const notificarResultadoEvaluacionInicial ='), text.indexOf('  const notificarEjecucionCompleta ='));
  const payloads = [];
  const notificar = new Function('enviarNotificacionPlanConReintento', 'window', `${fn}\nreturn notificarResultadoEvaluacionInicial;`)(
    async payload => { payloads.push(payload); return true; }, { location: { origin: 'https://example.test' } },
  );
  const planes = [
    plan({ id: 1001, accion: 'Uno' }), plan({ id: 1002, accion: 'Dos' }),
    plan({ id: 1003, accion: 'Tres', correoResponsable: 'otro.ejecutor@example.test' }),
  ];
  assert.equal(await notificar({ id: 'i1' }, planes, 90, '', true, soporte), true);
  assert.equal(payloads.length, 2, 'uno por ejecutor, no uno por acción');
  assert.equal(payloads[0].destinatarios, 'ejecutor@example.test');
  assert.equal(payloads[0].ref_consecutivo, 'PLA-1001, PLA-1002');
  assert.match(payloads[0].proceso_auditado, /tus 2 acciones/);
  assert.match(payloads[0].proceso_auditado, /"Uno".*"Dos"/);
  assert.deepEqual(payloads[0].adjuntosCorreo, [soporte]);
  assert.equal(payloads[1].destinatarios, 'otro.ejecutor@example.test');
});

test('vincular riesgos a una acción ("Matriz de riesgos: Sí aplica") no la reenvía a revisión ni cambia su estado', async () => {
  for (const estadoWorkflow of [workflow.ESTADO_EVALUACION_INICIAL, 'En Ejecución', 'Pendiente Revisión Jefatura']) {
    const h = harness({ email: 'ejecutor@example.test', planes: [plan({ estadoWorkflow, matrizRiesgos: 'Sí aplica' })] });
    const res = await h.update({ idInforme: 'i1', actualizaciones: [{ id: 1, matrizRiesgos: 'Sí aplica', riesgosVinculados: ['49', 62, '49'] }] });
    assert.equal(res.code, 200, JSON.stringify({ estadoWorkflow, res }));
    const guardado = h.data().planes[0];
    assert.deepEqual(guardado.riesgosVinculados, ['49', '62'], 'ids como texto y sin duplicados');
    assert.equal(guardado.estadoWorkflow, estadoWorkflow, 'el vínculo es informativo: no cambia el flujo');
    assert.equal(guardado.historialCambios.at(-1).accion, 'Riesgos vinculados actualizados');
  }
  const invalido = harness({ email: 'ejecutor@example.test', planes: [plan({ estadoWorkflow: 'En Ejecución', matrizRiesgos: 'Sí aplica' })] });
  const res = await invalido.update({ idInforme: 'i1', actualizaciones: [{ id: 1, riesgosVinculados: ['<script>'] }] });
  assert.equal(res.code, 400);
  assert.equal(invalido.writes.length, 0);
});
