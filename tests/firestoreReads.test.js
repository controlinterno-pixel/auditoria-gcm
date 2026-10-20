// tests/firestoreReads.test.js - Contratos de ahorro de lecturas/escrituras Firestore (sin Firestore real)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

// 1. Escrituras sin cambios: solo se omiten cuando cada campo enviado es idéntico al guardado.
const workspaceText = read('../api/_lib/grcWorkspace.js');
const comparadorSource = workspaceText.slice(
  workspaceText.indexOf('const serializarEstable'),
  workspaceText.indexOf('const workspaceRef'),
).replace('export const escrituraSinCambios', 'const escrituraSinCambios');
const escrituraSinCambios = new Function(`${comparadorSource}\nreturn escrituraSinCambios;`)();
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
    userId: 'test', db: {}, doc: () => ({}), localStorage: { removeItem() {} }, navigator: { onLine: true },
    window: {
      setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
      clearTimeout: id => timers.delete(id), addEventListener() {}, removeEventListener() {},
    },
    document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} },
    onSnapshot: (_ref, next) => { listeners.push(next); return () => {}; },
    getDocFromServer: async () => ({}),
    apiService: { getGrcData },
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

console.log('firestoreReads.test.js: OK (escrituras sin cambios, lectura única del POST, instrumentación, carga inicial sin duplicar, ráfagas)');
