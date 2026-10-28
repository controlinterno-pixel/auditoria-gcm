// tests/firestoreReads.test.js - Contratos de ahorro de lecturas/escrituras Firestore (sin Firestore real)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { esAdministradorTotal, puedeVerTodo } from '../api/_lib/roles.js';
import { parametrosConsulta } from '../api/_lib/seguridad.js';
import { huellasDeDatos } from '../src/utils/huellaRegistro.js';
import { riesgosVisiblesPara, PERMISO_VER_TODOS_RIESGOS } from '../src/utils/permisosVista.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

// 1. Escrituras sin cambios: solo se omiten cuando cada campo enviado es idéntico al guardado.
const workspaceText = read('../api/_lib/grcWorkspace.js');
// informeEnProcesos sin importar el módulo (que conecta con Firebase al cargar).
const textoAgrupadas = read('../api/_lib/coleccionesAgrupadas.js');
const inicioInforme = textoAgrupadas.indexOf('export const informeEnProcesos');
const finInforme = textoAgrupadas.indexOf('/**', inicioInforme);
const informeEnProcesos = new Function(`${textoAgrupadas.slice(inicioInforme, finInforme).replace('export const', 'const')}; return informeEnProcesos;`)();
const comparadorSource = workspaceText.slice(
  workspaceText.indexOf('const serializarEstable'),
  workspaceText.indexOf('const workspaceRef'),
).replace(/^export /gm, '');
const { escrituraSinCambios, conClavesEliminadas } = new Function(`${comparadorSource}\nreturn { escrituraSinCambios, conClavesEliminadas };`)();

// Un mapa enviado completo (mapaProcesos) reemplaza al guardado: las claves quitadas se borran.
{
  const BORRAR = '__borrar__';
  const guardadoMapa = { mapaProcesos: { 'Gestión comercial': ['Ventas'], 'Prueba- Macroproceso Prueba': ['X'] }, otro: 1 };
  const enviado = { mapaProcesos: { 'Gestión comercial': ['Ventas'] }, sedesEmpresa: ['Hotel'] };
  const listo = conClavesEliminadas(enviado, guardadoMapa, () => BORRAR);
  assert.deepEqual(listo.mapaProcesos, { 'Gestión comercial': ['Ventas'], 'Prueba- Macroproceso Prueba': BORRAR }, 'el macroproceso eliminado se borra');
  assert.deepEqual(listo.sedesEmpresa, ['Hotel'], 'las listas no se tocan');
  assert.deepEqual(conClavesEliminadas({ mapaProcesos: { A: ['1'] } }, {}, () => BORRAR), { mapaProcesos: { A: ['1'] } }, 'sin mapa guardado no se borra nada');
}
const guardado = { id: 'P1', progreso: 50, evidencias: [{ url: 'a', nombre: 'x' }], meta: { b: 2, a: 1 }, actualizadoEn: 'srv' };
assert.equal(escrituraSinCambios({ meta: { a: 1, b: 2 }, progreso: 50, id: 'P1', evidencias: [{ nombre: 'x', url: 'a' }] }, guardado), true,
  'el orden de las llaves no importa y los campos que solo existen en el servidor no fuerzan escritura');
assert.equal(escrituraSinCambios({ id: 'P1', progreso: 60 }, guardado), false);
assert.equal(escrituraSinCambios({ id: 'P1', evidencias: [{ nombre: 'x', url: 'a' }, { url: 'b' }] }, guardado), false);
assert.equal(escrituraSinCambios({ id: 'P1', meta: { a: 1 } }, guardado), false, 'mapas parciales se escriben (conservador)');
assert.equal(escrituraSinCambios({ id: 'P1', nuevo: null }, guardado), false);
assert.equal(escrituraSinCambios({ id: 'P2' }, undefined), false, 'un documento nuevo siempre se escribe');

// 2. El POST de sync lee el workspace una sola vez para ambas validaciones.
const syncText = read('../api/_grc/sync.js');
assert.equal((syncText.match(/leerWorkspaceGrc\(/g) || []).length, 2, 'una lectura para GET y una para validar el POST');
assert.ok(syncText.includes('leerRevisionSemaforo'), 'el GET devuelve la revisión vigente');
assert.ok(syncText.indexOf('leerRevisionSemaforo()') < syncText.indexOf("origen: 'sync-get'"), 'la revisión se lee antes que los datos');

// 3. Toda lectura completa del workspace queda etiquetada para la instrumentación [FS-READS].
for (const file of ['create', 'register-email', 'review-plans', 'update', 'sync']) {
  const source = read(`../api/_grc/${file}.js`);
  const llamadas = (source.match(/leerWorkspaceGrc(?:Ligero)?\(/g) || []).length;
  const etiquetas = (source.match(/origen: '[a-z-]+'/g) || []).length;
  assert.equal(etiquetas, llamadas, `${file}.js tiene lecturas sin origen`);
}
assert.equal(read('../src/services/apiService.js').includes('/api/grc/stream'), false);

// 4. Cliente: la carga inicial no se repite cuando el semáforo responde después de la descarga.
const hookText = read('../src/hooks/useGrcData.js');
const effectSource = hookText.slice(hookText.indexOf('    if (!userId) return;'), hookText.indexOf('  }, [userId]);'));
const flush = async () => { for (let turn = 0; turn < 12; turn++) await Promise.resolve(); };
function harness(getGrcData) {
  const timers = new Map();
  const listeners = [];
  let timerId = 0;
  const bindings = {
    esAdministradorTotal, puedeVerTodo,
    userId: 'test', db: {}, doc: () => ({}), localStorage: { removeItem() {} }, navigator: { onLine: true },
    window: {
      setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
      clearTimeout: id => timers.delete(id), addEventListener() {}, removeEventListener() {},
    },
    document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} },
    onSnapshot: (_ref, next) => { listeners.push(next); return () => {}; },
    getDocFromServer: async () => ({}),
    apiService: { getGrcData },
    suscribirRevisionPropia: () => () => {},
    registrarDatosServidor: () => {},
    console: { warn() {}, error() {} },
  };
  for (const name of effectSource.matchAll(/\b(set[A-Z]\w*)\(/g)) bindings[name[1]] = () => {};
  for (const name of effectSource.matchAll(/\b(default[A-Z]\w*)\b/g)) bindings[name[1]] = [];
  const cleanup = new Function(...Object.keys(bindings), effectSource)(...Object.values(bindings));
  const runTimer = delay => {
    const entry = [...timers.entries()].find(([, timer]) => timer.delay === delay);
    assert.ok(entry, `falta temporizador de ${delay}ms`);
    timers.delete(entry[0]);
    entry[1].callback();
  };
  const snapshot = revision => ({ exists: () => true, data: () => ({ ultimaModificacion: revision }), metadata: { fromCache: false } });
  return { timers, listeners, cleanup, runTimer, snapshot };
}

// 4a. Semáforo lento: la descarga de respaldo ya trae la revisión 200 → el snapshot 200 no descarga de nuevo.
const lentoCalls = [];
const lento = harness(async options => { lentoCalls.push(options); return { revision: '200' }; });
lento.runTimer(1500);
await flush();
assert.equal(lentoCalls.length, 1);
lento.listeners[0](lento.snapshot('200'));
await flush();
assert.equal(lentoCalls.length, 1, 'sin descarga duplicada en la carga inicial');
lento.listeners[0](lento.snapshot('201'));
lento.runTimer(1500);
await flush();
assert.equal(lentoCalls.length, 2, 'un cambio real sí se descarga');
lento.cleanup();
assert.equal(lento.timers.size, 0);

// 4b. El snapshot llega mientras la descarga de respaldo sigue en curso: no se encola otra igual.
const enCursoCalls = [];
let resolver;
const enCurso = harness(options => { enCursoCalls.push(options); return new Promise(resolve => { resolver = resolve; }); });
enCurso.runTimer(1500);
enCurso.listeners[0](enCurso.snapshot('300'));
resolver({ revision: '300' });
await flush();
assert.equal(enCursoCalls.length, 1, 'la descarga en curso ya correspondía a la revisión 300');
enCurso.cleanup();



// 5. La descarga de sync no envía `planesAccion` (duplicado de `planes`) ni altera los datos en caché.
{
  const workflowModule = await import('../src/utils/programPlanWorkflow.js');
  const alcanceModule = await import('../api/_lib/assignmentScope.js');
  const { visibilidadLider } = await import('../src/utils/visibilidadLider.js');
  const syncSource = syncText.replace(/^import [^;]*;\r?\n/gm, '').replace('export default async function handler', 'async function handler');
  const plan = { id: 1, idHallazgo: 'h1', idInforme: 'i1', correoResponsable: 'lider@example.test', proceso: 'Operaciones' };
  const workspaceCompartido = {
    planes: [plan], planesAccion: [plan],
    hallazgos: [{ id: 'h1', idInforme: 'i1', proceso: 'Operaciones' }],
    informesAuditoria: [{ id: 'i1', proceso: 'Operaciones' }],
    riesgos: [], catalogoCargos: [],
    campoInternoNoPublico: 'no debe llegar a usuarios no administradores',
    programas: [{ id: 'p1', proceso: 'Operaciones' }, { id: 'p2', proceso: 'Finanzas' }],
    comites: [{ id: 'c1', nombre: 'Comité de control interno' }],
    monitoreo: [{ id: 'm1', proceso: 'Operaciones' }, { id: 'm2', proceso: '' }, { id: 'm3', proceso: 'Finanzas' }],
    cronograma: [{ id: 1, proceso: 'Compras' }],
  };
  const congelado = JSON.stringify(workspaceCompartido);
  const ejecutarGet = async user => {
    const bindings = {
    esAdministradorTotal, puedeVerTodo, parametrosConsulta, riesgosVisiblesPara, informeEnProcesos, visibilidadLider,
      ...workflowModule, ...alcanceModule,
      applyCors: () => false,
      requireAuth: async () => user,
      sendSuccess: (res, body) => Object.assign(res, { code: 200, body }),
      sendError: (res, error, code) => Object.assign(res, { code, error }),
      logger: { info() {}, warn() {}, error() {} },
      notificarSemaforo: async () => {},
      leerRevisionSemaforo: async () => '500',
      guardarWorkspaceParcial: async () => {},
      leerWorkspaceGrc: async () => ({ data: workspaceCompartido }),
      huellasDeDatos,
    };
    const handler = new Function(...Object.keys(bindings), `${syncSource}\nreturn handler;`)(...Object.values(bindings));
    const res = {};
    await handler({ method: 'GET', query: {}, url: '/api/grc/sync' }, res);
    return res;
  };
  for (const user of [
    { uid: 'a', email: 'admin@example.test', rol: 'admin' },
    { uid: 'l', email: 'lider@example.test', rol: 'lider', procesosAsignados: ['Operaciones'], permisos: [] },
  ]) {
    const res = await ejecutarGet(user);
    assert.equal(res.code, 200, JSON.stringify(res));
    assert.equal('planesAccion' in res.body, false, `${user.rol}: sin duplicado`);
    assert.equal(res.body.planes.length, 1, `${user.rol}: conserva planes`);
    assert.equal(res.body.revision, '500');
    // H4: la respuesta filtrada es una lista blanca; los campos no previstos no llegan a no administradores.
    assert.equal('campoInternoNoPublico' in res.body, user.rol === 'admin', `${user.rol}: campos no previstos`);
  }
  // Permisos por módulo: Auditorías y Gobernanza solo con permiso; programas e indicadores por proceso.
  const ids = lista => (lista || []).map(item => item.id);
  const admin = (await ejecutarGet({ uid: 'a', email: 'admin@example.test', rol: 'admin' })).body;
  assert.deepEqual([ids(admin.programas), ids(admin.comites), ids(admin.monitoreo)], [['p1', 'p2'], ['c1'], ['m1', 'm2', 'm3']], 'admin ve todo');
  const sinPermisos = (await ejecutarGet({ uid: 'l', email: 'lider@example.test', rol: 'lider', procesosAsignados: ['Operaciones'], permisos: [] })).body;
  assert.deepEqual(ids(sinPermisos.programas), [], 'sin sub_programas no recibe programas');
  assert.deepEqual(ids(sinPermisos.comites), [], 'sin sub_comites no recibe comités');
  assert.deepEqual(ids(sinPermisos.cronograma), [], 'sin sub_cronograma no recibe cronograma');
  assert.deepEqual(ids(sinPermisos.monitoreo), ['m1', 'm2'], 'indicadores de su proceso y corporativos');
  const conPermisos = (await ejecutarGet({
    uid: 'l2', email: 'lider2@example.test', rol: 'lider', procesosAsignados: ['Operaciones'],
    permisos: ['sub_programas', 'sub_comites', 'sub_cronograma'],
  })).body;
  assert.deepEqual(ids(conPermisos.programas), ['p1'], 'con permiso: solo programas de su proceso');
  assert.deepEqual(ids(conPermisos.comites), ['c1'], 'con permiso: comités');
  assert.deepEqual(ids(conPermisos.cronograma), [1], 'con permiso: cronograma completo');
  assert.equal(conPermisos.riesgos.length, 0, 'la matriz de riesgos se entrega completa (aquí vacía)');

  assert.equal(JSON.stringify(workspaceCompartido), congelado, 'no se modifica el objeto compartido de la caché');

  // 6. El líder recibe el informe de cada hallazgo que ve aunque sea de otro proceso (antes salía "huérfano"); los
  // demás hallazgos de ese informe llegan solo como contexto (encabezado), para mostrarlos bloqueados.
  const ajeno = {
    planes: [{ id: 7, idHallazgo: 'h2', idInforme: 'i2', correoResponsable: 'lider@example.test', proceso: 'Finanzas' }],
    hallazgos: [{ id: 'h2', idInforme: 'i2', proceso: 'Finanzas' }, { id: 'h3', idInforme: 'i2', proceso: 'Finanzas' }],
    informesAuditoria: [{ id: 'i2', proceso: 'Finanzas', titulo: 'Informe de Finanzas' }],
    riesgos: [], catalogoCargos: [],
  };
  const bindingsAjeno = {
    esAdministradorTotal, puedeVerTodo, parametrosConsulta, riesgosVisiblesPara, informeEnProcesos, visibilidadLider,
    ...workflowModule, ...alcanceModule,
    applyCors: () => false,
    requireAuth: async () => ({ uid: 'l', email: 'lider@example.test', rol: 'lider', procesosAsignados: ['Operaciones'], permisos: [] }),
    sendSuccess: (res, body) => Object.assign(res, { code: 200, body }),
    sendError: (res, error, code) => Object.assign(res, { code, error }),
    logger: { info() {}, warn() {}, error() {} },
    notificarSemaforo: async () => {}, leerRevisionSemaforo: async () => '500', guardarWorkspaceParcial: async () => {},
    leerWorkspaceGrc: async (_tx, opciones) => {
      assert.equal(opciones.procesosAsignados, null, 'se leen todos los informes para dar contexto');
      return { data: ajeno };
    },
  };
  const handlerAjeno = new Function(...Object.keys(bindingsAjeno), `${syncSource}\nreturn handler;`)(...Object.values(bindingsAjeno));
  const resAjeno = {};
  await handlerAjeno({ method: 'GET', url: '/api/grc/sync' }, resAjeno);
  assert.deepEqual(resAjeno.body.informesAuditoria.map(informe => informe.id), ['i2'], 'llega el informe del hallazgo donde participa');
  assert.deepEqual(resAjeno.body.hallazgos.map(hallazgo => [hallazgo.id, Boolean(hallazgo.soloContexto)]), [['h2', false], ['h3', true]],
    'los demás hallazgos de ese informe llegan solo como contexto');
}
console.log('firestoreReads.test.js: OK (escrituras sin cambios, lectura única del POST, instrumentación, carga inicial sin duplicar, ráfagas, sin duplicado planesAccion)');
