// api/_lib/geminiCliente.js - Llamada a Gemini por su API REST, sin SDK.
// - Modelos: alias "-latest" de Google, que apuntan siempre al modelo más reciente (se actualizan solos).
//   Se puede fijar otra lista sin desplegar con GEMINI_MODELOS="modelo-1,modelo-2".
// - Rapidez: primero Flash-Lite (el más rápido; los datos ya vienen calculados, la IA solo los interpreta),
//   límite de tiempo por intento y caché de 7 días en Upstash: si los datos no cambian, la respuesta es inmediata.
import { createHash } from 'node:crypto';
import { ejecutarRedis } from './almacenKV.js';
import { logger } from './logger.js';

const API = 'https://generativelanguage.googleapis.com/v1beta/models';
// Al final, los modelos fijos que funcionan hoy: si un alias no respondiera, la IA no queda peor que antes.
export const MODELOS_POR_DEFECTO = ['gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'];
const ESPERA_POR_INTENTO_MS = 25000;
const MAX_TOKENS_SALIDA = 8192;
const CACHE_SEGUNDOS = 7 * 24 * 60 * 60;
// Si cambian las reglas o la forma del prompt, subir la versión invalida la caché anterior.
const VERSION_CACHE = 'v1';

export const obtenerModelos = (entorno = process.env) => {
  const configurados = String(entorno.GEMINI_MODELOS || entorno.GEMINI_MODEL || '')
    .split(',').map(modelo => modelo.trim()).filter(Boolean);
  return configurados.length ? configurados : MODELOS_POR_DEFECTO;
};

export const obtenerClaves = (entorno = process.env) => String(entorno.GEMINI_API_KEYS || entorno.GEMINI_API_KEY || '')
  .split(',').map(clave => clave.trim()).filter(Boolean);

const obtenerTemperatura = (entorno = process.env) => {
  const valor = Number(entorno.GEMINI_TEMPERATURE);
  return Number.isFinite(valor) && valor >= 0 && valor <= 2 ? valor : 0.3;
};

export const claveCache = ({ instruccionSistema, prompt, json }) => `gcm:ia:${VERSION_CACHE}:${createHash('sha256')
  .update(JSON.stringify([instruccionSistema, prompt, Boolean(json)])).digest('hex')}`;

async function llamarModelo({ modelo, clave, instruccionSistema, prompt, json, temperatura, fetchImpl, esperaMs }) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), esperaMs);
  try {
    const respuesta = await fetchImpl(`${API}/${encodeURIComponent(modelo)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instruccionSistema }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: temperatura,
          maxOutputTokens: MAX_TOKENS_SALIDA,
          ...(json ? { responseMimeType: 'application/json' } : {}),
        },
      }),
      signal: controlador.signal,
    });
    const cuerpo = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
      const error = new Error(cuerpo?.error?.message || `HTTP ${respuesta.status}`);
      error.estado = respuesta.status;
      throw error;
    }
    const texto = (cuerpo?.candidates?.[0]?.content?.parts || []).map(parte => parte?.text || '').join('').trim();
    if (!texto) throw new Error(`Respuesta vacía (${cuerpo?.candidates?.[0]?.finishReason || 'sin candidatos'})`);
    return texto;
  } catch (error) {
    if (error?.name === 'AbortError') {
      const tiempo = new Error(`Sin respuesta en ${Math.round(esperaMs / 1000)} s`);
      tiempo.estado = 'timeout';
      throw tiempo;
    }
    throw error;
  } finally {
    clearTimeout(temporizador);
  }
}

/**
 * Genera la respuesta probando cada clave y cada modelo en orden. Devuelve { texto, modelo, desdeCache }.
 * Lanza el último error si ningún modelo respondió.
 */
export async function generarConGemini({ instruccionSistema, prompt, json = false }, {
  entorno = process.env, fetchImpl = fetch, redis = ejecutarRedis, esperaMs = ESPERA_POR_INTENTO_MS,
} = {}) {
  const clave = claveCache({ instruccionSistema, prompt, json });
  const enCache = await redis([['GET', clave]], { etiqueta: 'IA-CACHE' });
  if (enCache?.[0]) {
    try {
      const guardado = JSON.parse(enCache[0]);
      if (guardado?.texto) return { texto: guardado.texto, modelo: guardado.modelo, desdeCache: true };
    } catch { /* caché dañada: se genera de nuevo */ }
  }

  const claves = obtenerClaves(entorno);
  if (!claves.length) throw new Error('Falta configurar GEMINI_API_KEYS en el servidor.');
  const modelos = obtenerModelos(entorno);
  const temperatura = obtenerTemperatura(entorno);
  let ultimoError = null;
  for (const apiKey of claves) {
    for (const modelo of modelos) {
      const inicio = Date.now();
      try {
        const texto = await llamarModelo({ modelo, clave: apiKey, instruccionSistema, prompt, json, temperatura, fetchImpl, esperaMs });
        logger.info('[IA] Respuesta generada', { modelo, ms: Date.now() - inicio });
        await redis([['SET', clave, JSON.stringify({ texto, modelo }), 'EX', String(CACHE_SEGUNDOS)]], { etiqueta: 'IA-CACHE' });
        return { texto, modelo, desdeCache: false };
      } catch (error) {
        ultimoError = error;
        logger.warn('[IA] Modelo sin respuesta; se prueba el siguiente', { modelo, ms: Date.now() - inicio, estado: error?.estado, motivo: String(error?.message || '').slice(0, 200) });
      }
    }
  }
  throw ultimoError || new Error('Ningún modelo respondió.');
}
