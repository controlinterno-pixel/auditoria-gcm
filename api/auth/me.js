import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { parse } from 'cookie';

if (!getApps().length) {
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
  if (privateKey && !privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    privateKey = Buffer.from(privateKey, 'base64').toString('utf8');
  }
  privateKey = privateKey.replace(/\\n/g, '\n');

  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
  });
}

export default async function handler(req, res) {
  const allowedOrigins = ['https://auditoria-gcm.vercel.app', 'http://localhost:5173'];
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', allowedOrigins.includes(origin) ? origin : 'https://auditoria-gcm.vercel.app');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  try {
    const cookies = parse(req.headers.cookie || '');
    const sessionCookie = cookies.grc_session;

    if (!sessionCookie) return res.status(401).json({ authenticated: false });

    const decoded = await getAuth().verifySessionCookie(sessionCookie, true);
    const db = getFirestore();
    const userDoc = await db.collection('usuarios').doc(decoded.uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    return res.status(200).json({
      authenticated: true,
      user: {
        email: decoded.email,
        uid: decoded.uid,
        rol: userData.rol || (decoded.email === 'controlinterno@termales.com.co' ? 'admin' : 'lider'),
        nombreResponsable: userData.nombreResponsable || userData.nombre || 'Usuario GRC'
      }
    });
  } catch (error) {
    return res.status(401).json({ authenticated: false });
  }
}