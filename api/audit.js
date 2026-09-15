import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  // 1. Lista Blanca de Orígenes Permitidos (CORS restringido)
  const allowedOrigins = ['https://auditoria-gcm.vercel.app', 'http://localhost:5173', 'http://localhost:3000'];
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // Si la petición viene de un dominio no autorizado, rechaza la conexión
    res.setHeader('Access-Control-Allow-Origin', 'https://auditoria-gcm.vercel.app');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Manejo de peticiones preflight (CORS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Solo permitimos método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Solo se acepta POST.' });
  }

  // 2. Clave leída estrictamente desde las variables de entorno privadas de Vercel
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ [Serverless Error]: No se encontró GEMINI_API_KEY en las variables del servidor.');
    return res.status(500).json({ error: 'Error de configuración del servidor de IA.' });
  }

  try {
    const { prompt, datosContexto } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'El campo "prompt" es obligatorio.' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Armamos el prompt final uniendo la instrucción del usuario y los datos de GRC
    const promptCompleto = `${prompt}\n\nContexto de datos cargado:\n${JSON.stringify(datosContexto || {})}`;
    
    const result = await model.generateContent(promptCompleto);
    const response = await result.response;
    const text = response.text();

    return res.status(200).json({ respuesta: text });
  } catch (error) {
    console.error('❌ [Serverless Error /api/audit]:', error.message);
    return res.status(500).json({ error: 'Error interno procesando la consulta de auditoría.' });
  }
}