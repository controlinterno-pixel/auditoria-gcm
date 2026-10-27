import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workspaceText = readFileSync(new URL('../api/_lib/grcWorkspace.js', import.meta.url), 'utf8');
const cacheSource = workspaceText.slice(
  workspaceText.indexOf('export function invalidarCacheWorkspaceGrc'),
  workspaceText.indexOf('export function guardarInformesGrc'),
).replaceAll('export ', '');
let reads = 0;
const pending = [];
const cache = new Function('leerWorkspaceGrcDesdeFirestore', `
  const workspaceReadCache = new Map();
  const workspaceReadInFlight = new Map();
  let workspaceCacheGeneration = 0;
  const WORKSPACE_READ_CACHE_TTL_MS = 30000;
  const WORKSPACE_READ_CACHE_TTL_REVISION_MS = 600000;
  const WORKSPACE_READ_CACHE_MAX = 30;
  ${cacheSource}
  return { leerWorkspaceGrc, invalidarCacheWorkspaceGrc };
`)(() => {
  reads++;
  return new Promise(resolve => pending.push(resolve));
});
const options = { usarCache: true, revision: '100', procesosAsignados: ['A'] };
const users = Array.from({ length: 30 }, () => cache.leerWorkspaceGrc(null, options));
assert.equal(reads, 1);
pending.shift()({ data: { version: 1 } });
await Promise.all(users);
await cache.leerWorkspaceGrc(null, options);
assert.equal(reads, 1);
const changed = cache.leerWorkspaceGrc(null, { ...options, revision: '101' });
assert.equal(reads, 2);
pending.shift()({ data: { version: 2 } });
await changed;
const otherScope = cache.leerWorkspaceGrc(null, { ...options, procesosAsignados: ['B'] });
assert.equal(reads, 3);
pending.shift()({ data: { version: 3 } });
await otherScope;
const old = cache.leerWorkspaceGrc(null, { ...options, revision: '102' });
cache.invalidarCacheWorkspaceGrc();
const fresh = cache.leerWorkspaceGrc(null, { ...options, revision: '102' });
assert.equal(reads, 5);
pending.shift()({ data: { version: 2 } });
await old;
pending.shift()({ data: { version: 4 } });
await fresh;
assert.equal((await cache.leerWorkspaceGrc(null, { ...options, revision: '102' })).data.version, 4);

const authSource = readFileSync(new URL('../api/_lib/authMiddleware.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
for (const [code, expected, failProfile] of [
  ['auth/session-cookie-expired', 401, false],
  ['auth/internal-error', 503, false],
  ['unavailable', 503, true],
]) {
  const failure = Object.assign(new Error('Simulated failure'), { code });
  const handler = new Function('parse', 'adminAuth', 'adminDb', 'logger', `${authSource}\nreturn requireAuth;`)(
    () => ({ grc_session: 'test' }),
    { verifySessionCookie: async () => {
      if (!failProfile) throw failure;
      return { uid: 'test', email: 'test@termales.com.co' };
    } },
    { collection: () => ({ doc: () => ({ get: async () => { throw failure; } }) }) },
    { warn() {} },
  );
  const response = { status(value) { this.code = value; return this; }, json() {} };
  assert.equal(await handler({ url: '/api/grc/sync', headers: {} }, response), null);
  assert.equal(response.code, expected);
}

const clientText = readFileSync(new URL('../src/services/apiService.js', import.meta.url), 'utf8');
const clientSource = clientText.slice(0, clientText.indexOf('const comprimirImagen'))
  .replace(/^import .*;\r?\n/gm, '')
  .replaceAll('import.meta.env.VITE_API_URL', "''");
for (const [renewalStatus, expectedSignOuts] of [[401, 0], [500, 0], [403, 1]]) {
  let signOuts = 0;
  const reasons = [];
  const request = new Function('fetch', 'auth', 'signOut', 'secureLogger', 'markSignOutReason', 'recordAuthEvent', `${clientSource}\nreturn request;`)(
    async endpoint => ({
      ok: false, status: endpoint === '/api/auth/login' ? renewalStatus : 401,
      json: async () => ({ error: 'Simulated renewal rejection' }),
    }),
    { currentUser: { getIdToken: async () => 'simulated-token' } },
    async () => { signOuts++; },
    { error() {} },
    reason => reasons.push(reason),
    () => {},
  );
  await assert.rejects(request('/api/grc/sync'));
  assert.equal(signOuts, expectedSignOuts);
  // Todo cierre automático deja un motivo trazable antes de ejecutar signOut().
  assert.deepEqual(reasons, expectedSignOuts ? ['renewal-403'] : []);
}

const hookText = readFileSync(new URL('../src/hooks/useGrcData.js', import.meta.url), 'utf8');
const effectSource = hookText.slice(hookText.indexOf('    if (!userId) return;'), hookText.indexOf('  }, [userId]);'));
const flush = async () => {
  for (let turn = 0; turn < 12; turn++) await Promise.resolve();
};
function createSyncHarness() {
  const timers = new Map();
  const windowEvents = new Map();
  const documentEvents = new Map();
  const calls = [];
  const listeners = [];
  let timerId = 0;
  let serverReads = 0;
  let currentRevision = '100';
  let fail = false;
  const snapshot = (revision, fromCache = false) => ({
    exists: () => true, data: () => ({ ultimaModificacion: revision }), metadata: { fromCache },
  });
  const bindings = {
    userId: 'test', db: {}, doc: () => ({}),
    localStorage: { removeItem() {} },
    navigator: { onLine: true },
    window: {
      setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
      clearTimeout: id => timers.delete(id),
      addEventListener: (name, callback) => windowEvents.set(name, callback),
      removeEventListener: name => windowEvents.delete(name),
    },
    document: {
      visibilityState: 'visible',
      addEventListener: (name, callback) => documentEvents.set(name, callback),
      removeEventListener: name => documentEvents.delete(name),
    },
    onSnapshot: (_reference, next, error) => {
      const listener = { next, error, stopped: false };
      listeners.push(listener);
      return () => { listener.stopped = true; };
    },
    getDocFromServer: async () => { serverReads++; return snapshot(currentRevision); },
    suscribirRevisionPropia: () => () => {},
    registrarDatosServidor: () => {},
    apiService: { getGrcData: async options => {
      calls.push(options);
      if (fail) throw new Error('Simulated network failure');
      return {};
    } },
    console: { warn() {}, error() {} },
  };
  for (const name of effectSource.matchAll(/\b(set[A-Z]\w*)\(/g)) bindings[name[1]] = () => {};
  for (const name of effectSource.matchAll(/\b(default[A-Z]\w*)\b/g)) bindings[name[1]] = [];
  const cleanup = new Function(...Object.keys(bindings), effectSource)(...Object.values(bindings));
  return {
    bindings, timers, windowEvents, documentEvents, calls, listeners, cleanup, snapshot,
    setRevision: value => { currentRevision = value; },
    setFail: value => { fail = value; },
    serverReads: () => serverReads,
  };
}
const sync = createSyncHarness();
assert.equal(sync.calls.length, 0);
sync.listeners[0].next(sync.snapshot('99', true));
assert.equal(sync.calls.length, 0);
sync.listeners[0].next(sync.snapshot('100'));
await flush();
assert.deepEqual(sync.calls, [{ forceFresh: true, revision: '100' }]);
sync.listeners[0].next(sync.snapshot('100'));
await flush();
assert.equal(sync.calls.length, 1);
// Con datos ya cargados, los cambios posteriores esperan una ventana corta para agrupar ráfagas.
const timersPrevios = new Set(sync.timers.keys());
sync.listeners[0].next(sync.snapshot('101'));
sync.listeners[0].next(sync.snapshot('102'));
sync.listeners[0].next(sync.snapshot('103'));
await flush();
assert.equal(sync.calls.length, 1);
const rafaga = [...sync.timers.entries()].filter(([id, timer]) => timer.delay === 1500 && !timersPrevios.has(id));
assert.equal(rafaga.length, 1, 'tres cambios seguidos programan una sola descarga');
sync.timers.delete(rafaga[0][0]);
rafaga[0][1].callback();
await flush();
assert.equal(sync.calls.length, 2);
assert.deepEqual(sync.calls.at(-1), { forceFresh: true, revision: '103' });
sync.setRevision('103');
await sync.documentEvents.get('visibilitychange')();
assert.equal(sync.serverReads(), 1);
assert.equal(sync.calls.length, 2);
await sync.windowEvents.get('online')();
assert.equal(sync.serverReads(), 1);
assert.ok(![...sync.timers.values()].some(timer => timer.delay >= 60_000));
sync.cleanup();
assert.equal(sync.timers.size, 0);
assert.equal(sync.windowEvents.size, 0);
assert.equal(sync.documentEvents.size, 0);
assert.ok(sync.listeners.every(listener => listener.stopped));

const recovery = createSyncHarness();
recovery.listeners[0].next(recovery.snapshot('100'));
await flush();
recovery.listeners[0].error({ code: 'unavailable' });
recovery.setRevision('102');
await recovery.windowEvents.get('online')();
await flush();
assert.equal(recovery.listeners.length, 2);
assert.equal(recovery.calls.at(-1).revision, '102');
recovery.cleanup();

const retry = createSyncHarness();
retry.setFail(true);
retry.listeners[0].next(retry.snapshot('100'));
await flush();
for (const delay of [2000, 5000, 15000]) {
  const entry = [...retry.timers.entries()].find(([, timer]) => timer.delay === delay);
  assert.ok(entry, `Missing bounded retry after ${delay}ms`);
  retry.timers.delete(entry[0]);
  entry[1].callback();
  await flush();
}
assert.equal(retry.calls.length, 4);
assert.ok(![...retry.timers.values()].some(timer => [2000, 5000, 15000].includes(timer.delay)));
retry.cleanup();

console.log('syncSession.test.js: OK (30 clients, cache revisions/scopes/races, temporary auth failures, unchanged snapshots, recovery throttling, bounded retries, cleanup)');
