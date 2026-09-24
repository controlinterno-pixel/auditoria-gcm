import { adminAuth, adminDb } from '../_lib/firebaseAdmin';
import { parse } from 'cookie';

export default async function handler(req, res) {
  const allowedOrigins = ['https://auditoria-gcm.vercel.app', 'http://localhost:5173'];
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', allowedOrigins.includes(origin) ? origin : 'https://auditoria-gcm.vercel.app');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  try {
    const cookies = parse(req.headers.cookie || '');
    const sessionCookie = cookies.grc_session;

    if (!sessionCookie) return res.status(401).json({ authenticated: false });

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const userDoc = await adminDb.collection('usuarios').doc(decoded.uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    return res.status(200).json({
      authenticated: true,
      user: {
        email: decoded.email,
        uid: decoded.uid,
rol: userData.rol || 'lider',
        nombreResponsable: userData.nombreResponsable || userData.nombre || 'Usuario GRC'
      }
    });
  } catch (error) {
    return res.status(401).json({ authenticated: false });
  }
}