// api/_lib/seguridad.js - Controles comunes que el enrutador (api/index.js) aplica antes de cada ruta:
// límite de solicitudes por IP y por sesión, origen permitido y forma del cuerpo de la petición.
import { contarSolicitud } from './rateLimit.js';

/** IP real del cliente. En Vercel estas cabeceras las fija la plataforma (el cliente no puede falsificarlas). */
export function obtenerIpCliente(req) {
  const ipPlataforma = req.headers?.['x-vercel-forwarded-for'] || req.headers?.['x-real-ip'];
  if (ipPlataforma && typeof ipPlataforma === 'string') return ipPlataforma.split(',')[0].trim();
  const xForwardedFor = req.headers?.['x-forwarded-for'];
  if (xForwardedFor && typeof xForwardedFor === 'string') return xForwardedFor.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown-ip';
}

/**
 * Parámetros de la URL (?clave=valor) con la API estándar WHATWG. No se usa req.query: en Vercel ese
 * atajo se calcula con url.parse(), obsoleto (aviso DEP0169 en los registros).
 */
export function parametrosConsulta(req) {
  return Object.fromEntries(new URL(String(req.url || '/'), 'http://localhost').searchParams);
}

/** Identifica la sesión sin verificarla (eso lo hace requireAuth): basta para contar sus solicitudes. */
export function claveSesion(req) {
  const coincidencia = /(?:^|;\s*)grc_session=([^;]+)/.exec(String(req.headers?.cookie || ''));
  return coincidencia ? coincidencia[1].slice(-48) : null;
}

const MINUTO = 60 * 1000;

// Toda la oficina puede salir a internet con una sola IP: el límite por IP es amplio y el fino es por sesión.
export const LIMITE_GENERAL_IP = { maximo: 600, ventanaMs: MINUTO };
export const LIMITE_GENERAL_SESION = { maximo: 180, ventanaMs: MINUTO };

// Rutas costosas o expuestas sin sesión: límite compartido entre instancias (Upstash).
export const LIMITES_POR_RUTA = {
  '/api/auth/register': { por: 'ip', maximo: 5, ventanaMs: 10 * MINUTO },
  '/api/public/catalogos': { por: 'ip', maximo: 30, ventanaMs: MINUTO },
  '/api/grc/audit': { por: 'sesion', maximo: 30, ventanaMs: MINUTO },
  '/api/grc/upload': { por: 'sesion', maximo: 20, ventanaMs: MINUTO },
  '/api/notifications/email': { por: 'sesion', maximo: 20, ventanaMs: MINUTO },
};

/** Devuelve null si la petición puede seguir, o { status, mensaje, segundos } si se pasó del límite. */
export async function revisarLimites(req, ruta) {
  const ip = obtenerIpCliente(req);
  const sesion = claveSesion(req);
  const exceso = segundos => ({ status: 429, mensaje: `Demasiadas solicitudes. Intenta de nuevo en ${segundos} segundos.`, segundos });

  const porIp = await contarSolicitud(`ip:${ip}`, LIMITE_GENERAL_IP);
  if (!porIp.permitido) return exceso(porIp.segundosRestantes);
  if (sesion) {
    const porSesion = await contarSolicitud(`sesion:${sesion}`, LIMITE_GENERAL_SESION);
    if (!porSesion.permitido) return exceso(porSesion.segundosRestantes);
  }

  const limiteRuta = LIMITES_POR_RUTA[ruta];
  if (limiteRuta) {
    const quien = limiteRuta.por === 'sesion' && sesion ? `sesion:${sesion}` : `ip:${ip}`;
    const resultado = await contarSolicitud(`${ruta}:${quien}`, { ...limiteRuta, compartido: true });
    if (!resultado.permitido) return exceso(resultado.segundosRestantes);
  }
  return null;
}

const CLAVES_PROHIBIDAS = new Set(['__proto__', 'constructor', 'prototype']);
const PROFUNDIDAD_MAXIMA = 40;

function revisarEstructura(valor, profundidad = 0) {
  if (valor === null || typeof valor !== 'object') return null;
  if (profundidad > PROFUNDIDAD_MAXIMA) return 'El cuerpo de la petición tiene demasiados niveles anidados.';
  for (const clave of Object.keys(valor)) {
    if (CLAVES_PROHIBIDAS.has(clave)) return 'El cuerpo de la petición contiene campos no permitidos.';
    const error = revisarEstructura(valor[clave], profundidad + 1);
    if (error) return error;
  }
  return null;
}

/**
 * Las peticiones que modifican datos solo se aceptan en JSON (un formulario de otro sitio no puede
 * enviarlas) y sin claves que alteren prototipos de objetos. Devuelve { status, mensaje } o null.
 */
export function validarPeticion(req) {
  const metodo = String(req.method || 'GET').toUpperCase();
  if (metodo === 'GET' || metodo === 'HEAD' || metodo === 'OPTIONS') return null;

  const longitud = Number(req.headers?.['content-length'] || 0);
  const tipo = String(req.headers?.['content-type'] || '').toLowerCase();
  const tieneCuerpo = longitud > 0 || Boolean(req.headers?.['transfer-encoding']);
  if (tieneCuerpo && !tipo.startsWith('application/json')) {
    return { status: 415, mensaje: 'El cuerpo de la petición debe enviarse en formato JSON.' };
  }
  if (!tieneCuerpo) return null;

  let cuerpo;
  try {
    cuerpo = req.body; // En Vercel leer req.body interpreta el JSON y lanza error si está mal formado.
  } catch {
    return { status: 400, mensaje: 'El cuerpo de la petición no es un JSON válido.' };
  }
  if (typeof cuerpo === 'string' || cuerpo === null || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
    return { status: 400, mensaje: 'El cuerpo de la petición no es un objeto JSON válido.' };
  }
  const error = revisarEstructura(cuerpo);
  return error ? { status: 400, mensaje: error } : null;
}
