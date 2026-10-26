// Cliente de Gemini: alias -latest, Pro primero y luego Flash y Flash-Lite, paso al siguiente modelo, límite de tiempo y caché.
import assert from 'node:assert/strict';
import { claveCache, generarConGemini, MODELOS_POR_DEFECTO, normalizarJson, obtenerModelos } from '../api/_lib/geminiCliente.js';

let pruebas = 0;
const prueba = async (nombre, fn) => { await fn(); pruebas += 1; };
const entorno = { GEMINI_API_KEYS: 'clave-1' };
const respuestaOk = texto => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: texto }] } }] }) });
const respuestaError = (status, mensaje) => ({ ok: false, status, json: async () => ({ error: { message: mensaje } }) });
const redisEnMemoria = () => {
  const datos = new Map();
  const redis = async comandos => comandos.map(([comando, clave, valor]) => {
    if (comando === 'GET') return datos.get(clave) ?? null;
    if (comando === 'SET') { datos.set(clave, valor); return 'OK'; }
    return null;
  });
  return { redis, datos };
};
const solicitud = { instruccionSistema: 'Reglas', prompt: 'Analiza RSK-2', json: true };
const solicitudTexto = { instruccionSistema: 'Reglas', prompt: 'Texto libre', json: false };

await prueba('modelos por defecto: Pro primero, Flash después y Flash-Lite al final; GEMINI_MODELOS los reemplaza', () => {
  assert.deepEqual(MODELOS_POR_DEFECTO, ['gemini-pro-latest', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite']);
  assert.ok(MODELOS_POR_DEFECTO.includes('gemini-2.5-flash'), 'respaldo con el modelo que funciona hoy');
  assert.deepEqual(obtenerModelos({}), MODELOS_POR_DEFECTO);
  assert.deepEqual(obtenerModelos({ GEMINI_MODELOS: 'modelo-a, modelo-b' }), ['modelo-a', 'modelo-b']);
});

await prueba('primera llamada genera y guarda; la segunda sale de la caché sin llamar a Gemini', async () => {
  const { redis, datos } = redisEnMemoria();
  const llamadas = [];
  const fetchImpl = async (url, opciones) => { llamadas.push({ url, cuerpo: JSON.parse(opciones.body), clave: opciones.headers['x-goog-api-key'] }); return respuestaOk('{"analisisEjecutivo":"ok"}'); };
  const primera = await generarConGemini(solicitud, { entorno, fetchImpl, redis });
  assert.equal(primera.desdeCache, false);
  assert.equal(primera.modelo, 'gemini-pro-latest');
  assert.match(llamadas[0].url, /gemini-pro-latest:generateContent$/);
  assert.equal(llamadas[0].cuerpo.generationConfig.maxOutputTokens, 32768, 'Pro razona: más tokens de salida');
  assert.equal(llamadas[0].clave, 'clave-1');
  assert.equal(llamadas[0].cuerpo.generationConfig.responseMimeType, 'application/json');
  assert.equal(llamadas[0].cuerpo.systemInstruction.parts[0].text, 'Reglas');
  assert.ok(datos.has(claveCache(solicitud)));
  const segunda = await generarConGemini(solicitud, { entorno, fetchImpl, redis });
  assert.equal(segunda.desdeCache, true);
  assert.equal(segunda.texto, '{"analisisEjecutivo":"ok"}');
  assert.equal(llamadas.length, 1, 'la segunda no debe llamar a Gemini');
});

await prueba('si un modelo no existe (404) pasa al siguiente', async () => {
  const { redis } = redisEnMemoria();
  const modelos = [];
  const fetchImpl = async url => { modelos.push(url); return url.includes('pro') ? respuestaError(404, 'model not found') : respuestaOk('texto'); };
  const r = await generarConGemini({ ...solicitudTexto, prompt: 'otro' }, { entorno, fetchImpl, redis });
  assert.equal(r.modelo, 'gemini-flash-latest');
  assert.equal(modelos.length, 2);
  modelos.length = 0;
  const soloFijos = async url => { modelos.push(url); return url.includes('latest') ? respuestaError(404, 'model not found') : respuestaOk('fijo'); };
  const respaldo = await generarConGemini({ ...solicitudTexto, prompt: 'alias caídos' }, { entorno, fetchImpl: soloFijos, redis });
  assert.equal(respaldo.modelo, 'gemini-2.5-flash');
  modelos.length = 2;
  assert.equal(modelos.length, 2);
});

await prueba('si un modelo tarda más del límite, pasa al siguiente', async () => {
  const { redis } = redisEnMemoria();
  const fetchImpl = (url, { signal }) => (url.includes('pro')
    ? new Promise((_, rechazar) => signal.addEventListener('abort', () => rechazar(Object.assign(new Error('abortado'), { name: 'AbortError' }))))
    : Promise.resolve(respuestaOk('rápido')));
  const r = await generarConGemini({ ...solicitudTexto, prompt: 'lento' }, { entorno, fetchImpl, redis, esperaMs: 30 });
  assert.equal(r.texto, 'rápido');
});

await prueba('sin almacén (redis devuelve null) igual responde', async () => {
  const r = await generarConGemini({ ...solicitudTexto, prompt: 'sin caché' }, { entorno, fetchImpl: async () => respuestaOk('ok'), redis: async () => null });
  assert.equal(r.texto, 'ok');
  assert.equal(r.desdeCache, false);
});

await prueba('si ningún modelo responde, lanza el último error', async () => {
  const { redis } = redisEnMemoria();
  await assert.rejects(generarConGemini({ ...solicitud, prompt: 'falla' }, { entorno, fetchImpl: async () => respuestaError(429, 'cuota agotada'), redis }), /cuota agotada/);
  await assert.rejects(generarConGemini(solicitud, { entorno: {}, fetchImpl: async () => respuestaOk('x'), redis: async () => null }), /GEMINI_API_KEYS/);
});

await prueba('JSON mal formado: se descarta, no se guarda y responde el siguiente modelo', async () => {
  const { redis, datos } = redisEnMemoria();
  const malo = '{ "analisisEjecutivo": "sin plan formal ("Sin plan registrado") en RSK-2" }';
  const fetchImpl = async url => (url.includes('pro') ? respuestaOk(malo) : respuestaOk('```json\n{"analisisEjecutivo":"ok"}\n```'));
  const r = await generarConGemini({ ...solicitud, prompt: 'json malo' }, { entorno, fetchImpl, redis });
  assert.equal(r.modelo, 'gemini-flash-latest');
  assert.equal(r.texto, '{"analisisEjecutivo":"ok"}');
  assert.equal([...datos.values()].some(valor => valor.includes('Sin plan registrado')), false, 'el JSON malo no se guarda');
  assert.equal(normalizarJson('"{\\"a\\":1}"'), '{"a":1}', 'JSON enviado como texto entre comillas');
});

await prueba('cuota agotada (429): agota Pro en todas las claves antes de bajar a Flash; un 503 no insiste con otra clave', async () => {
  const { redis } = redisEnMemoria();
  const llamadas = [];
  const fetchImpl = async (url, opciones) => {
    llamadas.push(`${url.split('/models/')[1].split(':')[0]}@${opciones.headers['x-goog-api-key']}`);
    if (url.includes('pro')) return respuestaError(429, 'cuota agotada');
    if (url.includes('flash-latest')) return respuestaError(503, 'high demand');
    return respuestaOk('flash');
  };
  const r = await generarConGemini({ ...solicitudTexto, prompt: 'cuota' }, { entorno: { GEMINI_API_KEYS: 'clave-1,clave-2' }, fetchImpl, redis });
  assert.equal(r.modelo, 'gemini-2.5-flash');
  // 429 se prueba con cada clave; 503 (Google saturado) no se insiste con otra clave.
  assert.deepEqual(llamadas, ['gemini-pro-latest@clave-1', 'gemini-pro-latest@clave-2', 'gemini-flash-latest@clave-1', 'gemini-2.5-flash@clave-1']);
});

console.log(`geminiCliente.test.js: ${pruebas} pruebas OK`);
