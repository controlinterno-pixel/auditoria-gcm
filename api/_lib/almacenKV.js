// api/_lib/almacenKV.js - Acceso a Upstash Redis (el mismo de Vercel KV) por su API REST.
// Variables: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN  o  KV_REST_API_URL + KV_REST_API_TOKEN.
// Si no están configuradas o el servicio no responde, devuelve null: quien lo usa sigue sin el almacén.
import { logger } from './logger.js';

const configuracion = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
};

export const almacenCompartidoConfigurado = () => Boolean(configuracion());

/** Ejecuta comandos Redis en un pipeline: [['GET', clave], ...] → resultados, o null si no hay almacén. */
export async function ejecutarRedis(comandos, { etiqueta = 'KV', esperaMs = 1500 } = {}) {
  const config = configuracion();
  if (!config) return null;
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), esperaMs);
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
    logger.warn(`[${etiqueta}] Almacén compartido no disponible`, { motivo: error?.message || 'error' });
    return null;
  } finally {
    clearTimeout(temporizador);
  }
}
