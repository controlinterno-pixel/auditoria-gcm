import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { serialize } from 'cookie';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const { idToken } = req.body;
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // Validez de 5 días

    // Genera cookie de sesión cifrada en servidor
    const sessionCookie = await getAuth().createSessionCookie(idToken, { expiresIn });

    // Configura la cookie impenetrable para JS del navegador
    const cookieSerialized = serialize('grc_session', sessionCookie, {
      maxAge: expiresIn / 1000,
      httpOnly: true, // 🔒 Inaccesible desde document.cookie o XSS
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    res.setHeader('Set-Cookie', cookieSerialized);
    return res.status(200).json({ success: true, message: 'Sesión iniciada en servidor' });
  } catch (error) {
    return res.status(401).json({ error: 'Autenticación fallida en servidor' });
  }
}