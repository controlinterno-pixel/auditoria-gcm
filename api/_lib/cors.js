// api/cors.js
export function applyCors(req, res) {
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'https://auditoria-gcm.vercel.app',
    ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:5173'] : [])
  ];

  const origin = req.headers.origin;

  // 🛡️ N3: las cabeceras CORS con credenciales solo se emiten para orígenes de la lista blanca.
  // Nunca se responde '*' junto con credenciales. Las peticiones del mismo origen (la app) y las que
  // no vienen de un navegador no necesitan cabeceras CORS.
  res.setHeader('Vary', 'Origin');
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Manejo de la petición Preflight (OPTIONS)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true; // Indica que era petición OPTIONS y ya respondió
  }

  return false;
}