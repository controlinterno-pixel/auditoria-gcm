import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as workflow from '../src/utils/programPlanWorkflow.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const source = path => read(path).replace(/^import .*;\r?\n/gm, '').replace('export default async function handler', 'async function handler');
const criterios = puntaje => Object.fromEntries(['c1', 'c2', 'c3', 'c4', 'c5'].map(key => [key, puntaje]));
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
    ...workflow,
    applyCors: () => false, requireAuth: async () => user,
    sendSuccess: (res, result) => Object.assign(res, { code: 200, result }),
    sendError: (res, message, code) => Object.assign(res, { code, message }),
    logger: { info() {}, warn() {}, error() {} },
    notificarSemaforo: async () => {},
    leerWorkspaceGrc: async () => ({
      data: structuredClone(data), workspaceExists: true, workspaceRef: 'workspace',
      coleccionInformesRef: { doc: id => ({ reportId: id }) },
    }),
    guardarInformesGrc() {},
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
          set: (ref, partial) => { if (failWrite) throw new Error('Simulated write failure'); pending.push(partial); },
        });
        for (const partial of pending) {
          writes.push(partial);
          data = { ...data, ...partial };
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
      return check({ planes }, user);
    },
  };
}

const evaluate = (h, puntaje, extra = {}) => h.review({
  decision: 'evaluar-diseno', idInforme: 'i1', idsPlanes: [1],
  criterios: criterios(puntaje), justificacion: puntaje < 80 ? 'El diseño requiere ajustes' : '', ...extra,
});

test('tipo de fuente determina la ruta, incluso sin programaId y con fuente vinculada', () => {
  assert.equal(workflow.esInformePrograma({ tipoFuente: 'Programa de Auditoría' }), true);
  assert.equal(workflow.esInformePrograma({ tipoFuente: 'F1' }, [{ codigo: 'F1', tipoFuente: 'Programa de Auditoría' }]), true);
  assert.equal(workflow.esInformePrograma({ tipoFuente: 'Auditoría Interna', programaId: 'p1' }), false);
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
  const notify = new Function('esPlanProgramaAuditoria', 'enviarNotificacionPlanConReintento', 'window', `${fn}\nreturn notificarRegistroPlan;`)(
    () => true, async payload => { payloads.push(payload); return true; }, { location: { origin: 'https://example.test' } },
  );
  assert.equal(await notify(plan(), true), true);
  assert.deepEqual(payloads.map(item => item.destinatarios), ['ejecutor@example.test', 'auditor@example.test']);
  assert.match(payloads[1].proceso_auditado, /80%/);
  assert.match(payloads[1].enlace_pdf, /reviewReportId=i1/);
});

test('rechazo del revisor devuelve al 90% y conserva la evaluación inicial', async () => {
  const initial = { tipo: workflow.TIPO_EVALUACION_INICIAL, puntaje: 80, aprobado: true };
  const h = harness({ email: 'revisor@example.test', planes: [plan({ progreso: 100, estadoWorkflow: 'Pendiente Validación Revisor', evaluacionHolistica: initial })] });
  assert.equal((await h.review({ decision: 'corregir', idInforme: 'i1', motivo: 'Falta soporte' })).code, 200);
  assert.equal(h.data().planes[0].progreso, 90);
  assert.equal(h.data().planes[0].estadoWorkflow, 'En Ejecución');
  assert.deepEqual(h.data().planes[0].evaluacionHolistica, initial);
});

test('modificar diseño aprobado exige reevaluación, sin perder avance e historial', async () => {
  const h = harness();
  await evaluate(h, 80);
  h.user.email = 'ejecutor@example.test';
  await h.update({ idInforme: 'i1', actualizaciones: [{ id: 1, progreso: 35 }] });
  await h.update({ idInforme: 'i1', actualizaciones: [{ id: 1, accion: 'Nuevo diseño' }] });
  assert.equal(h.data().planes[0].estadoWorkflow, workflow.ESTADO_EVALUACION_INICIAL);
  assert.equal(h.data().planes[0].progreso, 35);
  assert.equal(h.data().planes[0].historialEvaluaciones.length, 1);
  assert.equal(h.data().planes[0].evaluacionHolistica, null);
});

test('error de Gmail conserva el guardado y encola exactamente el mensaje pendiente', async () => {
  const text = read('../src/components/Planes.jsx');
  const fn = text.slice(text.indexOf('  const enviarNotificacionPlanConReintento ='), text.indexOf('  const notificarRegistroPlan ='));
  const queued = [];
  const notify = new Function('showNotification', 'ejecutarDespachoGmailApi', 'encolarReintentoNotificacion', `${fn}\nreturn enviarNotificacionPlanConReintento;`)(
    () => {}, async () => { throw new Error('Simulated Gmail error'); }, payload => queued.push(payload),
  );
  const payload = { destinatarios: 'auditor@example.test', titulo_informe: 'Evaluar diseño' };
  assert.equal(await notify(payload), false);
  assert.deepEqual(queued, [payload]);
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
      revisionInformeId: 'i1', guardandoDecisionRevision: false, motivoCorreccion: 'Soporte incompleto',
      user: { email: 'revisor@example.test' }, planesEnriquecidos: [before],
      ESTADO_PENDIENTE_VALIDACION_REVISOR: 'Pendiente Validación Revisor', esPlanProgramaAuditoria: () => true,
      prepararEnvioGmail: async () => true,
      apiService: { decidirRevisionPlanes: async () => ({ planes: [after] }) },
      setPlanes() {}, setRevisionInformeId() {}, setMostrarMotivoCorreccion() {}, setMotivoCorreccion() {},
      setModoRevisionMatriz() {}, setEditPlan() {}, setFormInformeId() {}, setMatrixState() {}, setVistaActiva() {},
      setGuardandoDecisionRevision() {}, showNotification() {},
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
  });
}
