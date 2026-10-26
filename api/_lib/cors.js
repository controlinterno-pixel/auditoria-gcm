// api/_lib/cors.js
// La app y la API se sirven desde el mismo dominio, así que el navegador no necesita CORS para funcionar.
// Solo los orígenes de la lista blanca (FRONTEND_URL, separados por comas, y localhost fuera de producción)
// reciben cabeceras CORS; cualquier otro sitio queda bloqueado por el navegador.
const ORIGEN_PRODUCCION = 'https://auditoria-gcm.vercel.app';

export function origenesPermitidos() {
  const configurados = String(process.env.FRONTEND_URL || ORIGEN_PRODUCCION)
    .split(',')
    .map(origen => origen.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return [
    ...configurados,
    ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:5173', 'http://127.0.0.1:5173'] : []),
  ];
}

/** El origen es el propio dominio que atiende la petición (la app) o uno de la lista blanca. */
export function origenAutorizado(req) {
  const origin = req.headers?.origin;
  if (!origin) return true; // Peticiones del mismo origen sin cabecera Origin, o que no vienen de un navegador.
  const host = req.headers?.['x-forwarded-host'] || req.headers?.host;
  if (host && (origin === `https://${host}` || origin === `http://${host}`)) return true;
  return origenesPermitidos().includes(origin);
}

export function applyCors(req, res) {
  const origin = req.headers.origin;

  // 🛡️ N3: las cabeceras CORS con credenciales solo se emiten para orígenes de la lista blanca.
  // Nunca se responde '*' junto con credenciales.
  res.setHeader('Vary', 'Origin');
  if (origin && origenesPermitidos().includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    res.setHeader('Access-Control-Max-Age', '600');
  }

  // Preflight (OPTIONS): se responde sin ejecutar nada; un origen no autorizado recibe 403.
  if (req.method === 'OPTIONS') {
    res.status(origenAutorizado(req) ? 204 : 403).end();
    return true;
  }

  return false;
}
