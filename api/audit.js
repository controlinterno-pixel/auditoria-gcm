import { GoogleGenerativeAI } from '@google/generative-ai';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo se acepta POST.' });

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Falta token de autenticación.' });
    }

    const token = authHeader.split('Bearer ')[1];
    const auth = getAuth(); 
    const decodedToken = await auth.verifyIdToken(token);

    if (!decodedToken.email || !decodedToken.email.endsWith('@termales.com.co')) {
      return res.status(403).json({ error: 'Dominio no autorizado para usar la IA.' });
    }

    const keysString = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY;
    if (!keysString) {
      return res.status(500).json({ error: 'Falta configurar GEMINI_API_KEYS en el servidor.' });
    }

    const apiKeys = keysString.split(',').map(k => k.trim()).filter(Boolean);
    const { prompt, datosContexto } = req.body;
    if (!prompt) return res.status(400).json({ error: 'El prompt es obligatorio.' });

    const promptCompleto = `${prompt}\n\nContexto de datos:\n${JSON.stringify(datosContexto || {})}`;
    
    // 🎯 MODELOS EXACTOS EXTRAÍDOS DE TU CONSOLA
    const modelosDisponibles = ['gemini-3.1-flash-lite', 'gemini-3-flash-preview', 'gemini-2.5-flash'];

    let text = null;
    let lastError = null;

    // Recorremos llaves y modelos en cascada
    for (const key of apiKeys) {
      const genAI = new GoogleGenerativeAI(key);
      
      for (const modelName of modelosDisponibles) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent(promptCompleto);
          text = await result.response.text();
          if (text) break; 
        } catch (error) {
          lastError = error;
        }
      }
      if (text) break;
    }

    if (!text) {
      return res.status(500).json({ 
        error: `Servicio saturado. Detalle técnico: ${lastError?.message || 'Sin respuesta'}` 
      });
    }

    return res.status(200).json({ respuesta: text });
  } catch (error) {
    return res.status(500).json({ error: `Fallo general: ${error.message}` });
  }
}