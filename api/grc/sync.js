import { adminAuth, adminDb } from '../_lib/firebaseAdmin';

export default async function handler(req, res) {
  const allowedOrigins = ['https://auditoria-gcm.vercel.app', 'http://localhost:5173'];
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', allowedOrigins.includes(origin) ? origin : 'https://auditoria-gcm.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

  try {
    const { parse } = await import('cookie');
    const cookies = parse(req.headers.cookie || '');
    const sessionCookie = cookies.grc_session;

    if (!sessionCookie) {
      return res.status(401).json({ error: 'Falta sesión HttpOnly de servidor.' });
    }

const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (!decodedToken.email || !decodedToken.email.endsWith('@termales.com.co')) {
      return res.status(403).json({ error: 'Dominio no autorizado.' });
    }

    // 🔒 NUEVO: Validación estricta de Rol en Base de Datos (Cierra Hallazgo #6)
const userDoc = await adminDb.collection('usuarios').doc(decodedToken.uid).get();    
    if (!userDoc.exists || userDoc.data().rol !== 'admin') {
      return res.status(403).json({ error: 'Permisos insuficientes. Solo administradores pueden modificar la estructura GRC.' });
    }

    const { partialData } = req.body;
await adminDb.collection('workspace_compartido').doc('base_de_datos_grc').set(partialData, { merge: true });
    return res.status(200).json({ success: true, message: 'Guardado exitoso.' });
  } catch (error) {
  console.error("❌ Detalle interno en sync.js:", error);
  return res.status(500).json({ error: "Error interno al sincronizar la base de datos." });
}
}