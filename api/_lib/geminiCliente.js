// api/_lib/geminiCliente.js - Llamada a Gemini por su API REST, sin SDK.
// - Modelos: alias "-latest" de Google, que apuntan siempre al modelo más reciente (se actualizan solos).
//   Se puede fijar otra lista sin desplegar con GEMINI_MODELOS="modelo-1,modelo-2".
// - Flash primero y Flash-Lite como respaldo. Pro no se usa por defecto: el plan gratuito no tiene cuota
//   para Pro (429) y el plan, las prioridades y las metas ya los calcula el sistema. Si se activa
//   facturación, se puede poner primero con GEMINI_MODELOS="gemini-pro-latest,gemini-flash-latest,…".
//   Caché de 7 días en Upstash: si los datos no cambian, la respuesta es inmediata.
import { createHash } from 'node:crypto';
import { ejecutarRedis } from './almacenKV.js';
import { logger } from './logger.js';

const API = 'https://generativelanguage.googleapis.com/v1beta/models';
// Cada alias va seguido del modelo fijo equivalente: si un alias no existe (404), se pasa al siguiente.
export const MODELOS_POR_DEFECTO = [
  'gemini-flash-latest', 'gemini-2.5-flash',
  'gemini-flash-lite-latest', 'gemini-2.5-flash-lite',
];
const ESPERA_POR_INTENTO_MS = 25000;
// Pro razona antes de responder: necesita más tiempo y más tokens (el razonamiento cuenta en el límite).
const esPro = modelo => /pro/i.test(modelo);
const ESPERA_PRO_MS = 60000;
const MAX_TOKENS_SALIDA = 8192;
const MAX_TOKENS_SALIDA_PRO = 32768;
// Gemini 2.5 Flash razona antes de responder (la mayor parte de sus ~15 s). Aquí no hace falta: el plan,
// las prioridades y las metas ya los calcula el sistema y la IA solo redacta. Solo se apaga en los
// modelos 2.5 Flash, que aceptan thinkingBudget: 0 (los alias -latest pueden apuntar a otra familia).
const sinRazonamiento = modelo => /2\.5-flash/i.test(modelo);
// Un modelo saturado en Google (503) se salta durante 10 minutos, compartido entre instancias.
const SATURADO_SEGUNDOS = 10 * 60;
const claveSaturado = modelo => `gcm:ia:saturado:${modelo}`;
const CACHE_SEGUNDOS = 7 * 24 * 60 * 60;
// Si cambian las reglas, la forma del prompt o los modelos, subir la versión invalida la caché anterior.
// v3: Pro pasa a ser el primer modelo; las respuestas guardadas de Flash-Lite se regeneran.
const VERSION_CACHE = 'v3';

// Con respuesta JSON se valida antes de aceptarla: un JSON mal formado (p. ej. comillas sin escapar) se
// descarta y se prueba el siguiente modelo, en lugar de mostrarse como texto crudo o quedar en la caché.
export function normalizarJson(texto) {
  const valor = String(texto || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  let datos;
  try {
    datos = JSON.parse(valor);
  } catch (error) {
    // Texto antes o después del objeto: se toma solo lo que va entre la primera { y la última }.
    const inicio = valor.indexOf('{');
    const fin = valor.lastIndexOf('}');
    if (inicio < 0 || fin <= inicio) throw error;
    datos = JSON.parse(valor.slice(inicio, fin + 1));
  }
  if (typeof datos === 'string') datos = JSON.parse(datos); // JSON enviado como texto dentro de comillas
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) throw new Error('La respuesta no es un objeto JSON');
  return JSON.stringify(datos);
}

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
          maxOutputTokens: esPro(modelo) ? MAX_TOKENS_SALIDA_PRO : MAX_TOKENS_SALIDA,
          ...(json ? { responseMimeType: 'application/json' } : {}),
          ...(sinRazonamiento(modelo) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
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
    if (!json) return texto;
    try {
      return normalizarJson(texto);
    } catch (error) {
      const invalido = new Error(`JSON inválido (${cuerpo?.candidates?.[0]?.finishReason || 'sin motivo'}): ${error.message}`);
      invalido.estado = 'json-invalido';
      throw invalido;
    }
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
 * Genera la respuesta probando los modelos en orden (Pro → Flash → Flash-Lite) y, para cada modelo, cada
 * clave: así se agota la cuota de un modelo en todas las claves antes de bajar. Si un modelo no existe
 * (404), está saturado (503) o no responde a tiempo, no se insiste con las demás claves; si está saturado,
 * además se salta durante 10 minutos. Devuelve { texto, modelo, desdeCache }.
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
      if (guardado?.texto) return { texto: json ? normalizarJson(guardado.texto) : guardado.texto, modelo: guardado.modelo, desdeCache: true };
    } catch { /* caché dañada: se genera de nuevo */ }
  }

  const claves = obtenerClaves(entorno);
  if (!claves.length) throw new Error('Falta configurar GEMINI_API_KEYS en el servidor.');
  const todos = obtenerModelos(entorno);
  const saturados = await redis(todos.map(modelo => ['GET', claveSaturado(modelo)]), { etiqueta: 'IA-SATURADO' }) || [];
  const disponibles = todos.filter((_, indice) => !saturados[indice]);
  // Si todos figuran saturados, se prueban igual: la marca es una ayuda, no un bloqueo.
  const modelos = disponibles.length ? disponibles : todos;
  if (disponibles.length < todos.length) logger.info('[IA] Modelos saturados que se saltan', { modelos: todos.filter(m => !disponibles.includes(m)) });
  const temperatura = obtenerTemperatura(entorno);
  let ultimoError = null;
  for (const modelo of modelos) {
    for (const apiKey of claves) {
      const inicio = Date.now();
      try {
        const espera = esPro(modelo) && esperaMs === ESPERA_POR_INTENTO_MS ? ESPERA_PRO_MS : esperaMs;
        const texto = await llamarModelo({ modelo, clave: apiKey, instruccionSistema, prompt, json, temperatura, fetchImpl, esperaMs: espera });
        logger.info('[IA] Respuesta generada', { modelo, ms: Date.now() - inicio });
        await redis([['SET', clave, JSON.stringify({ texto, modelo }), 'EX', String(CACHE_SEGUNDOS)]], { etiqueta: 'IA-CACHE' });
        return { texto, modelo, desdeCache: false };
      } catch (error) {
        ultimoError = error;
        logger.warn('[IA] Modelo sin respuesta; se prueba el siguiente', { modelo, ms: Date.now() - inicio, estado: error?.estado, motivo: String(error?.message || '').slice(0, 200) });
        // Modelo inexistente (404), saturado en Google (503) o lento: otra clave no lo arregla y solo hace
        // esperar (p. ej. 503 y luego 25 s sin respuesta con la siguiente clave). Cuota agotada (429): sí.
        if (error?.estado === 503) await redis([['SET', claveSaturado(modelo), '1', 'EX', String(SATURADO_SEGUNDOS)]], { etiqueta: 'IA-SATURADO' });
        if ([404, 503, 'timeout'].includes(error?.estado)) break;
      }
    }
  }
  throw ultimoError || new Error('Ningún modelo respondió.');
}
