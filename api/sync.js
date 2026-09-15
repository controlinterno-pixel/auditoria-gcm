import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// --- BLOQUE DE AUTODIAGNÓSTICO ---
function initAdmin() {
  if (getApps().length) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(`Faltan variables de entorno: ID=${!!projectId}, Email=${!!clientEmail}, Key=${!!privateKey}`);
  }

  // Si viene en Base64, decodificar
  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    privateKey = Buffer.from(privateKey, 'base64').toString('utf8');
  }

  // Formatear saltos de línea
  privateKey = privateKey.replace(/\\n/g, '\n');

  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey })
  });
}

export default async function handler(req, res) {
  // CORS Setup
  const allowedOrigins = ['https://auditoria-gcm.vercel.app', 'http://localhost:5173'];
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', allowedOrigins.includes(origin) ? origin : 'https://auditoria-gcm.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Intentar inicializar Firebase Admin
    initAdmin();
    
    const db = getFirestore();
    const auth = getAuth();

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Falta el Token de Autorización.' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);

    if (!decodedToken.email || !decodedToken.email.endsWith('@termales.com.co')) {
      return res.status(403).json({ error: 'Dominio de correo no autorizado.' });
    }

    const { partialData } = req.body;
    await db.collection('workspace_compartido').doc('base_de_datos_grc').set(partialData, { merge: true });

    return res.status(200).json({ success: true, message: 'Guardado exitoso' });

  } catch (err) {
    // 🎯 REVELAR EL ERROR REAL EN LA RESPUESTA HTTP
    console.error('CRITICAL SERVER ERROR:', err);
    return res.status(500).json({
      error: 'Error interno de diagnóstico',
      details: err.message,
      stack: err.stack ? err.stack.split('\n')[1] : null
    });
  }
}