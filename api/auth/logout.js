import { serialize } from 'cookie';

export default async function handler(req, res) {
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'https://auditoria-gcm.vercel.app',
    ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:5173'] : [])
  ];
  const origin = req.headers.origin;

  if (!origin || allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0]);
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const cookieSerialized = serialize('grc_session', '', {
    maxAge: -1,
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
  });

  res.setHeader('Set-Cookie', cookieSerialized);
  return res.status(200).json({ success: true, message: 'Sesión cerrada' });
}