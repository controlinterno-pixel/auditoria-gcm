// api/_lib/rateLimit.js - Límite de intentos compartido entre instancias (H8).
// Usa la API REST de Upstash Redis (la misma de Vercel KV) si sus variables están configuradas:
//   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN   o   KV_REST_API_URL + KV_REST_API_TOKEN
// Sin ellas (o si el servicio no responde) usa un contador en memoria por instancia, como antes.
import { logger } from './logger.js';

const memoria = new Map();

const configuracion = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
};

async function ejecutarRedis(comandos) {
  const config = configuracion();
  if (!config) return null;
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), 1500);
  try {
    const respuesta = await fetch(`${config.url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(comandos),
      signal: controlador.signal,
    });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    const resultados = await respuesta.json();
    if (!Array.isArray(resultados) || resultados.some(item => item?.error)) throw new Error('respuesta inválida');
    return resultados.map(item => item.result);
  } catch (error) {
    // Si el almacén compartido falla se usa la memoria: nunca se bloquea el acceso por una caída externa.
    logger.warn('[RATE-LIMIT] Almacén compartido no disponible; se usa memoria', { motivo: error?.message || 'error' });
    return null;
  } finally {
    clearTimeout(temporizador);
  }
}

const claveRedis = clave => `gcm:intentos:${clave}`;

/** Devuelve { intentos, bloqueado, segundosRestantes } para la clave (p. ej. la IP). */
export async function consultarLimite(clave, { maximo, ventanaMs }) {
  const remoto = await ejecutarRedis([['GET', claveRedis(clave)], ['PTTL', claveRedis(clave)]]);
  if (remoto) {
    const intentos = Number(remoto[0]) || 0;
    const restanteMs = Number(remoto[1]) > 0 ? Number(remoto[1]) : ventanaMs;
    return { intentos, bloqueado: intentos >= maximo, segundosRestantes: Math.ceil(restanteMs / 1000) };
  }
  const ahora = Date.now();
  const registro = memoria.get(clave);
  if (!registro || ahora > registro.reinicio) return { intentos: 0, bloqueado: false, segundosRestantes: 0 };
  return {
    intentos: registro.intentos,
    bloqueado: registro.intentos >= maximo,
    segundosRestantes: Math.ceil((registro.reinicio - ahora) / 1000),
  };
}

/** Suma un intento fallido; la ventana empieza con el primer fallo. */
export async function registrarFallo(clave, { ventanaMs }) {
  const remoto = await ejecutarRedis([
    ['INCR', claveRedis(clave)],
    ['PEXPIRE', claveRedis(clave), String(ventanaMs), 'NX'],
  ]);
  if (remoto) return;
  const ahora = Date.now();
  const registro = memoria.get(clave);
  if (!registro || ahora > registro.reinicio) memoria.set(clave, { intentos: 1, reinicio: ahora + ventanaMs });
  else registro.intentos += 1;
}

/** Borra el contador (acceso correcto). */
export async function limpiarIntentos(clave) {
  memoria.delete(clave);
  await ejecutarRedis([['DEL', claveRedis(clave)]]);
}

export const almacenCompartidoConfigurado = () => Boolean(configuracion());
