// api/sync.js
import admin from 'firebase-admin';

// 1. Inicialización segura del Admin SDK (Patrón Singleton para Vercel)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Truco vital: Vercel a veces escapa los saltos de línea, esto lo corrige
      privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
    }),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  // CORS (Lista blanca)
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
    // 2. VERIFICACIÓN CRIPTOGRÁFICA: Comprueba que el usuario existe y está logueado
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // 3. Validación extra: Solo correos de la empresa
    if (!decodedToken.email || !decodedToken.email.endsWith('@termales.com.co')) {
      return res.status(403).json({ error: 'Prohibido. Dominio no autorizado.' });
    }

    // 4. ESCRITURA VIP: El servidor guarda en la base de datos saltándose la restricción del navegador
    const { partialData } = req.body;
    await db.collection('workspace_compartido').doc('base_de_datos_grc').set(partialData, { merge: true });
    
    return res.status(200).json({ success: true, message: 'Guardado seguro exitoso.' });
  } catch (error) {
    console.error('❌ [Server Error /api/sync]:', error);
    return res.status(500).json({ error: 'Token inválido o error interno del servidor.' });
  }
}