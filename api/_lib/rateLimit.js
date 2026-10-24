// api/_lib/rateLimit.js - Límite de intentos compartido entre instancias (H8).
// Usa la API REST de Upstash Redis (la misma de Vercel KV) si sus variables están configuradas:
//   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN   o   KV_REST_API_URL + KV_REST_API_TOKEN
// Sin ellas (o si el servicio no responde) usa un contador en memoria por instancia, como antes.
import { almacenCompartidoConfigurado, ejecutarRedis as ejecutarRedisCompartido } from './almacenKV.js';

const memoria = new Map();

// El acceso a Upstash está en almacenKV.js (también lo usa la caché de la IA).
const ejecutarRedis = comandos => ejecutarRedisCompartido(comandos, { etiqueta: 'RATE-LIMIT' });

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

export { almacenCompartidoConfigurado };
