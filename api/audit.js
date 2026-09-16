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

    // 🔑 1. LEER EL ARREGLO DE LLAVES DESDE VERCEL
    const keysString = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY;
    if (!keysString) {
      return res.status(500).json({ error: 'Falta configurar las llaves de IA en el servidor.' });
    }

    // Convertimos la cadena "llave1,llave2,llave3" en un arreglo real de Javascript
    const apiKeys = keysString.split(',').map(k => k.trim()).filter(Boolean);

    const { prompt, datosContexto } = req.body;
    if (!prompt) return res.status(400).json({ error: 'El prompt es obligatorio.' });

    const promptCompleto = `${prompt}\n\nContexto de datos:\n${JSON.stringify(datosContexto || {})}`;
    
    let text = null;
    let lastError = null;

    // 🔄 2. CARRUSEL DE LLAVES (FALLBACK)
    // El sistema intentará con la Llave 1, si falla, va a la Llave 2, etc.
    for (let i = 0; i < apiKeys.length; i++) {
      try {
        const genAI = new GoogleGenerativeAI(apiKeys[i]);
        // Mantenemos el modelo gemini-1.5-flash por ser el más rápido y estable para este SDK
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });        
        const result = await model.generateContent(promptCompleto);
        text = await result.response.text();
        
        // Si funcionó, rompemos el ciclo y no gastamos las demás llaves
        break; 
      } catch (error) {
        console.warn(`⚠️ Llave de IA #${i + 1} falló. Intentando con la siguiente... Error:`, error.message);
        lastError = error;
      }
    }

    // 3. Evaluar si todas las llaves fracasaron
    if (!text) {
      console.error('❌ Todas las llaves de IA agotadas o fallidas. Último error:', lastError?.message);
      return res.status(500).json({ error: `Servicio saturado tras probar las ${apiKeys.length} llaves de respaldo. Intenta de nuevo en unos minutos.` });
    }

    return res.status(200).json({ respuesta: text });
  } catch (error) {
    console.error('❌ Error general IA:', error.message);
    return res.status(500).json({ error: `Fallo del motor: ${error.message}` });
  }
}