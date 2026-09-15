// api/sync.js
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../src/services/firebase'; // Conexión a Firebase desde el backend

export default async function handler(req, res) {
  // 1. Políticas de Seguridad CORS (Igual que en api/audit.js)
  const allowedOrigins = ['https://auditoria-gcm.vercel.app', 'http://localhost:5173'];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://auditoria-gcm.vercel.app');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  // 2. Validación del Token de Seguridad
  const token = req.headers.authorization;
  if (!token || !token.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acceso denegado. Token de autenticación requerido.' });
  }

  try {
    const { partialData } = req.body;
    
    // 3. 🔒 El Servidor es quien escribe en Firebase
    await setDoc(doc(db, 'workspace_compartido', 'base_de_datos_grc'), partialData, { merge: true });
    
    return res.status(200).json({ success: true, message: 'Sincronización exitosa.' });
  } catch (error) {
    console.error('❌ [Serverless Error /api/sync]:', error.message);
    return res.status(500).json({ error: 'Error interno en el servidor al intentar guardar.' });
  }
}