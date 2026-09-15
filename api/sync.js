import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// 1. Inicialización segura compatible con Node.js ESM en Vercel
if (!getApps().length) {
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';

  // Decodifica si la clave viene en Base64
  if (privateKey && !privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    privateKey = Buffer.from(privateKey, 'base64').toString('utf8');
  }

  // Normaliza saltos de línea por seguridad
  privateKey = privateKey.replace(/\\n/g, '\n');

  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
  });
}

const db = getFirestore();
const auth = getAuth();

export default async function handler(req, res) {
  // Configuración CORS
  const allowedOrigins = ['https://auditoria-gcm.vercel.app', 'http://localhost:5173'];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://auditoria-gcm.vercel.app');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acceso denegado. Faltan credenciales.' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    // Validar token del usuario
    const decodedToken = await auth.verifyIdToken(token);
    
    // Validar dominio corporativo
    if (!decodedToken.email || !decodedToken.email.endsWith('@termales.com.co')) {
      return res.status(403).json({ error: 'Prohibido. Dominio no autorizado.' });
    }

    // Escritura en Firestore como Admin
    const { partialData } = req.body;
    await db.collection('workspace_compartido').doc('base_de_datos_grc').set(partialData, { merge: true });
    
    return res.status(200).json({ success: true, message: 'Guardado seguro exitoso.' });
  } catch (error) {
    console.error('❌ [Server Error /api/sync]:', error);
    return res.status(500).json({ error: 'Token inválido o error interno del servidor.' });
  }
}