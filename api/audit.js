import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // Manejo de cabeceras de seguridad y CORS en Vercel
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Usa POST.' });
  }

  try {
    const { prompt, datosContexto } = req.body;

    // Obtener la API Key desde las variables de entorno de Vercel
    const rawKeys = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEYS;
    const apiKey = rawKeys ? rawKeys.split(',')[0].trim() : null;

    if (!apiKey) {
      return res.status(500).json({ error: "Falta configurar la variable GEMINI_API_KEY en los ajustes de Vercel." });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        maxOutputTokens: 8192,
      }
    });

    const systemPrompt = `
    Eres el Socio Director de Auditoría Interna, Riesgos y Control Interno (GRC) de Termales Santa Rosa de Cabal.
    Responde con autoridad técnica, enfoque en COSO ERM, ISO 31000 y máxima síntesis estratégica.
    
    DATOS DEL SISTEMA EN TIEMPO REAL:
    ${JSON.stringify(datosContexto || {}, null, 2)}
    
    CONSULTA DEL USUARIO:
    ${prompt}
    `;

    const result = await model.generateContent(systemPrompt);
    const responseText = await result.response.text();

    return res.status(200).json({
      status: "success",
      respuesta: responseText
    });

  } catch (error) {
    console.error("❌ Error en Vercel Serverless Function:", error);
    return res.status(500).json({ 
      status: "error", 
      message: error.message || "Error procesando el dictamen de auditoría." 
    });
  }
}