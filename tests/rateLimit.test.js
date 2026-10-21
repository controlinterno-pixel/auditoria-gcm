// tests/rateLimit.test.js - Límite de intentos de login (H8): memoria, almacén compartido y caída del servicio.
import assert from 'node:assert/strict';

const LIMITE = { maximo: 5, ventanaMs: 60_000 };
const avisoOriginal = console.warn;
console.warn = () => {};
const fetchOriginal = globalThis.fetch;

// 1. Sin variables de Upstash/Vercel KV: contador en memoria (comportamiento anterior).
delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.KV_REST_API_URL; delete process.env.KV_REST_API_TOKEN;
const memoria = await import(`../api/_lib/rateLimit.js?memoria=${Date.now()}`);
assert.equal(memoria.almacenCompartidoConfigurado(), false);
for (let intento = 0; intento < 4; intento++) await memoria.registrarFallo('ip-1', LIMITE);
assert.equal((await memoria.consultarLimite('ip-1', LIMITE)).bloqueado, false, '4 fallos: aún permitido');
await memoria.registrarFallo('ip-1', LIMITE);
const bloqueado = await memoria.consultarLimite('ip-1', LIMITE);
assert.equal(bloqueado.bloqueado, true, '5 fallos: bloqueado');
assert.ok(bloqueado.segundosRestantes > 0 && bloqueado.segundosRestantes <= 60);
assert.equal((await memoria.consultarLimite('ip-2', LIMITE)).bloqueado, false, 'otra IP no se afecta');
await memoria.limpiarIntentos('ip-1');
assert.equal((await memoria.consultarLimite('ip-1', LIMITE)).bloqueado, false, 'acceso correcto limpia el contador');

// 2. Con almacén compartido: los comandos van a la API REST de Upstash (compartida entre instancias).
process.env.KV_REST_API_URL = 'https://kv.example.test/';
process.env.KV_REST_API_TOKEN = 'token-de-prueba';
const servidor = new Map();
const llamadas = [];
globalThis.fetch = async (url, opciones) => {
  llamadas.push({ url, auth: opciones.headers.Authorization });
  const resultados = JSON.parse(opciones.body).map(([comando, clave]) => {
    if (comando === 'INCR') { servidor.set(clave, (servidor.get(clave) || 0) + 1); return { result: servidor.get(clave) }; }
    if (comando === 'GET') return { result: servidor.has(clave) ? String(servidor.get(clave)) : null };
    if (comando === 'PTTL') return { result: servidor.has(clave) ? 45_000 : -2 };
    if (comando === 'DEL') { servidor.delete(clave); return { result: 1 }; }
    return { result: 1 };
  });
  return { ok: true, json: async () => resultados };
};
const compartido = await import(`../api/_lib/rateLimit.js?compartido=${Date.now()}`);
assert.equal(compartido.almacenCompartidoConfigurado(), true);
for (let intento = 0; intento < 5; intento++) await compartido.registrarFallo('ip-3', LIMITE);
const remoto = await compartido.consultarLimite('ip-3', LIMITE);
assert.deepEqual([remoto.intentos, remoto.bloqueado, remoto.segundosRestantes], [5, true, 45]);
assert.ok(llamadas.every(llamada => llamada.url === 'https://kv.example.test/pipeline' && llamada.auth === 'Bearer token-de-prueba'));
await compartido.limpiarIntentos('ip-3');
assert.equal((await compartido.consultarLimite('ip-3', LIMITE)).bloqueado, false);

// 3. Si el servicio compartido falla, se usa la memoria y nunca se bloquea el acceso por la caída.
globalThis.fetch = async () => { throw new Error('servicio caído'); };
assert.equal((await compartido.consultarLimite('ip-4', LIMITE)).bloqueado, false);
for (let intento = 0; intento < 5; intento++) await compartido.registrarFallo('ip-4', LIMITE);
assert.equal((await compartido.consultarLimite('ip-4', LIMITE)).bloqueado, true, 'la memoria sigue protegiendo');

globalThis.fetch = fetchOriginal;
console.warn = avisoOriginal;
delete process.env.KV_REST_API_URL; delete process.env.KV_REST_API_TOKEN;
console.log('rateLimit.test.js: OK (memoria, almacén compartido, caída del servicio)');
