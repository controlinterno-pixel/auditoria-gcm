import { serialize } from 'cookie';

export default async function handler(req, res) {
  const allowedOrigins = ['https://auditoria-gcm.vercel.app', 'http://localhost:5173'];
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', allowedOrigins.includes(origin) ? origin : 'https://auditoria-gcm.vercel.app');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

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