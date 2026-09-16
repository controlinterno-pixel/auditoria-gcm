import { GoogleGenerativeAI } from '@google/generative-ai';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// 1. Inicialización segura de Firebase Admin
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

const auth = getAuth();

export default async function handler(req, res) {
  // CORS
  const allowedOrigins = ['https://auditoria-gcm.vercel.app', 'http://localhost:5173'];
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', allowedOrigins.includes(origin) ? origin : 'https://auditoria-gcm.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo se acepta POST.' });

  try {
    // 🔒 2. VERIFICAR IDENTIDAD DEL USUARIO (Cierra Hallazgo #4)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Falta token de autenticación.' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);

    if (!decodedToken.email || !decodedToken.email.endsWith('@termales.com.co')) {
      return res.status(403).json({ error: 'Dominio no autorizado para usar la IA.' });
    }

    // 🧠 3. EJECUTAR IA
    const apiKey = process.env.GEMINI_API_KEY;
    const { prompt, datosContexto } = req.body;
    
    if (!prompt) return res.status(400).json({ error: 'El prompt es obligatorio.' });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const promptCompleto = `${prompt}\n\nContexto de datos:\n${JSON.stringify(datosContexto || {})}`;
    
    const result = await model.generateContent(promptCompleto);
    const text = await result.response.text();

    return res.status(200).json({ respuesta: text });
  } catch (error) {
    console.error('❌ Error IA:', error.message);
    return res.status(500).json({ error: 'Error interno procesando la consulta.' });
  }
}