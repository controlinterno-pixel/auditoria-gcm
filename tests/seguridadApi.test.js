// tests/seguridadApi.test.js - Controles comunes de la API: límites, origen, cuerpo JSON, cookie y errores.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.KV_REST_API_URL; delete process.env.KV_REST_API_TOKEN;
const avisoOriginal = console.warn;
console.warn = () => {};

const { contarSolicitud } = await import('../api/_lib/rateLimit.js');
const { validarPeticion, claveSesion, revisarLimites, LIMITE_GENERAL_SESION } = await import('../api/_lib/seguridad.js');
const { applyCors, origenAutorizado } = await import('../api/_lib/cors.js');
const { opcionesCookieSesion, DURACION_SESION_MS } = await import('../api/_lib/sesion.js');
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

// 1. Ventana fija: permite hasta el máximo y bloquea el siguiente; otra clave no se afecta.
const limite = { maximo: 3, ventanaMs: 60_000 };
for (let i = 0; i < 3; i++) assert.equal((await contarSolicitud('prueba-a', limite)).permitido, true);
const cuarto = await contarSolicitud('prueba-a', limite);
assert.equal(cuarto.permitido, false);
assert.ok(cuarto.segundosRestantes > 0 && cuarto.segundosRestantes <= 60);
assert.equal((await contarSolicitud('prueba-b', limite)).permitido, true);

// 2. Límite por sesión y por ruta: la IA admite 30 por minuto por sesión.
const peticion = (cookie, ip = '10.0.0.1') => ({ headers: { cookie: `otra=1; grc_session=${cookie}`, 'x-real-ip': ip } });
assert.equal(claveSesion(peticion('abc')), 'abc');
assert.equal(claveSesion({ headers: {} }), null);
for (let i = 0; i < 30; i++) assert.equal(await revisarLimites(peticion('sesion-ia'), '/api/grc/audit'), null);
const excesoIa = await revisarLimites(peticion('sesion-ia'), '/api/grc/audit');
assert.equal(excesoIa.status, 429);
assert.equal(await revisarLimites(peticion('otra-sesion'), '/api/grc/audit'), null, 'otra sesión no se afecta');
for (let i = 0; i < LIMITE_GENERAL_SESION.maximo; i++) await revisarLimites(peticion('sesion-general', '10.0.0.2'), '/api/grc/sync');
assert.equal((await revisarLimites(peticion('sesion-general', '10.0.0.2'), '/api/grc/sync')).status, 429);
// Registro sin sesión: por IP, 5 cada 10 minutos.
for (let i = 0; i < 5; i++) assert.equal(await revisarLimites({ headers: { 'x-real-ip': '10.0.0.3' } }, '/api/auth/register'), null);
assert.equal((await revisarLimites({ headers: { 'x-real-ip': '10.0.0.3' } }, '/api/auth/register')).status, 429);

// 3. Cuerpo: solo JSON en escrituras, sin claves que alteren prototipos.
const escritura = (body, tipo = 'application/json') => ({ method: 'POST', headers: { 'content-type': tipo, 'content-length': '10' }, body });
assert.equal(validarPeticion({ method: 'GET', headers: {} }), null);
assert.equal(validarPeticion(escritura({ partialData: { riesgos: [] } })), null);
assert.equal(validarPeticion({ method: 'POST', headers: {} }), null, 'POST sin cuerpo (logout)');
assert.equal(validarPeticion(escritura({ a: 1 }, 'application/x-www-form-urlencoded')).status, 415, 'formulario de otro sitio');
assert.equal(validarPeticion(escritura('texto', 'text/plain')).status, 415);
assert.equal(validarPeticion(escritura([1, 2])).status, 400);
assert.equal(validarPeticion(escritura(JSON.parse('{"registro":{"__proto__":{"rol":"admin"}}}'))).status, 400);
assert.equal(validarPeticion(escritura({ registro: { constructor: { prototype: {} } } })).status, 400);
const malFormado = { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': '5' } };
Object.defineProperty(malFormado, 'body', { get() { throw new Error('Invalid JSON'); } });
assert.equal(validarPeticion(malFormado).status, 400);

// 4. Origen: la propia app y la lista blanca; cualquier otro sitio queda fuera (también en preflight).
assert.equal(origenAutorizado({ headers: {} }), true);
assert.equal(origenAutorizado({ headers: { origin: 'https://app.test', host: 'app.test' } }), true);
assert.equal(origenAutorizado({ headers: { origin: 'https://auditoria-gcm.vercel.app', host: 'otro.test' } }), true);
assert.equal(origenAutorizado({ headers: { origin: 'https://atacante.example', host: 'app.test' } }), false);
const respuesta = () => ({ headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, end() {} });
const preflight = respuesta();
assert.equal(applyCors({ method: 'OPTIONS', headers: { origin: 'https://atacante.example', host: 'app.test' } }, preflight), true);
assert.equal(preflight.code, 403);
assert.equal(preflight.headers['Access-Control-Allow-Origin'], undefined);
const preflightOk = respuesta();
applyCors({ method: 'OPTIONS', headers: { origin: 'https://auditoria-gcm.vercel.app' } }, preflightOk);
assert.equal(preflightOk.code, 204);
assert.equal(preflightOk.headers['Access-Control-Allow-Headers'], 'Content-Type, Accept');

// 5. Cookie de sesión: Strict, HttpOnly, Secure fuera de localhost y de 8 horas.
const cookie = opcionesCookieSesion({ headers: { host: 'auditoria-gcm.vercel.app' } }, 60);
assert.deepEqual([cookie.sameSite, cookie.httpOnly, cookie.secure], ['strict', true, true]);
assert.equal(opcionesCookieSesion({ headers: { host: 'localhost:3000' } }, 60).secure, false);
assert.equal(DURACION_SESION_MS, 8 * 60 * 60 * 1000);

// 6. Contratos de código: revocación, errores sin detalles internos y SMTP retirado.
const auth = read('../api/_lib/authMiddleware.js');
assert.ok(auth.includes('verifySessionCookie(sessionCookie, true)'), 'se comprueba la revocación');
assert.ok(auth.includes('authCache.get(sessionCookie)'), 'caché por cookie, no por usuario');
const logout = read('../api/_auth/logout.js');
assert.ok(logout.includes('revokeRefreshTokens(uid)'), 'el cierre de sesión revoca');
assert.ok(logout.includes("req.method !== 'POST'"));
const router = read('../api/index.js');
assert.equal(/error\.message/.test(router), false, 'el enrutador no devuelve error.message');
assert.ok(router.includes('revisarLimites(req, path)') && router.includes('validarPeticion(req)') && router.includes('origenAutorizado(req)'));
for (const archivo of ['_grc/upload.js', '_notifications/email.js']) {
  // Los mensajes de validación (400) son para el usuario; un error interno (500/502) nunca lleva su detalle.
  assert.equal(/sendError\(.*error\.message.*50\d\)/.test(read(`../api/${archivo}`)), false, `${archivo} sin error.message en 5xx`);
  assert.equal(read(`../api/${archivo}`).includes('errorText}'), false, `${archivo} no reenvía respuestas de terceros`);
}
assert.equal(read('../api/_notifications/email.js').includes('nodemailer'), false, 'SMTP retirado');

console.warn = avisoOriginal;
console.log('seguridadApi.test.js: OK (límites por IP/sesión/ruta, cuerpo JSON, origen, cookie, revocación y errores)');

// 7. Parámetros de la URL sin req.query (Vercel lo calcula con url.parse, obsoleto: DEP0169).
const { parametrosConsulta } = await import('../api/_lib/seguridad.js');
assert.deepEqual(parametrosConsulta({ url: '/api/grc/sync?fresh=1&revision=179' }), { fresh: '1', revision: '179' });
assert.deepEqual(parametrosConsulta({ url: '/api/grc/sync' }), {});
for (const archivo of ['_grc/sync.js', '_grc/riesgos.js', '_grc/historico.js']) {
  assert.equal(read(`../api/${archivo}`).includes('req.query'), false, `${archivo} sin req.query`);
}
