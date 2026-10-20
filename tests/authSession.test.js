// tests/authSession.test.js - Motivos de cierre de sesión, avisos y recarga por versión nueva (sin Firebase real)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const createStorage = () => {
  const data = new Map();
  return {
    getItem: key => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key),
  };
};
const windowEvents = new Map();
let reloads = 0;
globalThis.window = {
  localStorage: createStorage(),
  sessionStorage: createStorage(),
  location: { reload: () => { reloads++; } },
  addEventListener: (name, fn) => windowEvents.set(name, fn),
  removeEventListener: name => windowEvents.delete(name),
  dispatchEvent: event => { windowEvents.get(event.type)?.(event); return true; },
};
globalThis.CustomEvent ??= class CustomEvent { constructor(type) { this.type = type; } };
const originalInfo = console.info;
console.info = () => {};

const diag = await import('../src/services/authDiagnostics.js');
const update = await import('../src/services/appUpdate.js');

// 1. Cierre solicitado en esta pestaña: origen local, con aviso visible para el usuario.
let noticeEvents = 0;
window.addEventListener(diag.AUTH_NOTICE_EVENT, () => { noticeEvents++; });
diag.markSignOutReason('renewal-403', 'El acceso está pendiente de aprobación.');
assert.deepEqual(diag.consumeSignOutReason(), { reason: 'renewal-403', origin: 'local' });
assert.equal(noticeEvents, 1);
assert.equal(diag.consumeAuthNotice(), 'El acceso está pendiente de aprobación.');
assert.equal(diag.consumeAuthNotice(), '', 'el aviso se muestra una sola vez');

// 2. Sin motivo registrado: el cierre lo originó Firebase (revocación, cuenta deshabilitada, etc.).
assert.deepEqual(diag.consumeSignOutReason(), { reason: 'firebase-session-ended', origin: 'external' });
assert.ok(diag.SIGN_OUT_NOTICES['firebase-session-ended']);

// 3. Un motivo vencido no se atribuye a un cierre posterior.
const realNow = Date.now;
diag.markSignOutReason('manual');
Date.now = () => realNow() + 60_000;
assert.equal(diag.consumeSignOutReason().origin, 'external');
Date.now = realNow;

// 4. El diagnóstico descarta datos no primitivos y respeta el tamaño máximo del historial.
diag.recordAuthEvent('test', { code: 'auth/network-request-failed', token: { secret: 'x' }, uid: undefined });
const last = diag.readAuthEvents().at(-1);
assert.equal(last.code, 'auth/network-request-failed');
assert.equal('token' in last, false);
for (let i = 0; i < 30; i++) diag.recordAuthEvent('bulk');
assert.equal(diag.readAuthEvents().length, 20);
assert.ok(!JSON.stringify(diag.readAuthEvents()).includes('secret'));

// 5. El listener de token solo registra renovaciones del mismo usuario y se limpia correctamente.
let tokenListener = null;
let unsubscribed = false;
const stop = diag.installAuthDiagnostics({}, (_auth, fn) => { tokenListener = fn; return () => { unsubscribed = true; }; });
tokenListener({ uid: 'a' });
tokenListener({ uid: 'a' });
assert.equal(diag.readAuthEvents().at(-1).type, 'token-refreshed');
assert.ok(windowEvents.has('offline'));
stop();
assert.equal(unsubscribed, true);
assert.equal(windowEvents.has('offline'), false);

// 6. Versión nueva con cambios sin guardar: no recarga, avisa.
let updateEvents = 0;
window.addEventListener(update.UPDATE_AVAILABLE_EVENT, () => { updateEvents++; });
update.setPendingChangesProbe(() => true);
assert.equal(update.reloadForFreshAssets(), false);
assert.equal(reloads, 0);
assert.equal(updateEvents, 1);

// 7. Sin cambios pendientes: recarga una vez, conserva el módulo y omite la bienvenida.
update.setPendingChangesProbe(() => false);
update.rememberActiveTab('planes_tab');
assert.equal(update.reloadForFreshAssets(), true);
assert.equal(reloads, 1);
assert.equal(update.reloadForFreshAssets(), false, 'cooldown evita bucles de recarga');
assert.equal(update.consumeSkipWelcome(), true);
assert.equal(update.consumeSkipWelcome(), false);
assert.equal(update.consumeResumeTab(), 'planes_tab');
assert.equal(update.isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/x.js')), true);
assert.equal(update.isChunkLoadError(new Error('Cannot read properties of undefined')), false);

// 8. Contratos de código: un único listener de auth, protección de carreras y sin tokens en storage.
const hook = readFileSync(new URL('../src/hooks/useGrcData.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
assert.equal((hook.match(/onAuthStateChanged\(auth/g) || []).length, 1);
assert.equal(app.includes('onAuthStateChanged'), false, 'App no debe duplicar el listener de autenticación');
assert.ok(hook.includes('if (!isCurrent()) return;'), 'las respuestas de eventos anteriores se descartan');
assert.equal(hook.includes('getIdToken(true)'), false, 'no se fuerza la renovación al restaurar la sesión');
const sources = [hook, app, readFileSync(new URL('../src/services/authDiagnostics.js', import.meta.url), 'utf8')];
for (const source of sources) {
  assert.equal(/setItem\([^)]*(idToken|refreshToken|password)/i.test(source), false);
}

console.info = originalInfo;
console.log('authSession.test.js: OK (motivos de cierre, avisos, TTL, diagnóstico seguro, recarga por versión, listener único)');
