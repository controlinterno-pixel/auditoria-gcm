import { AuditEngine } from '../src/grc-engine/core/AuditEngine.js';

export default async function handler(req, res) {
  // 1. Configuración de cabeceras CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Responder de inmediato a las peticiones Preflight (OPTIONS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Validar método HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Usa POST.' });
  }

  try {
    // 2. Parseo seguro del cuerpo de la petición
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { prompt, datosContexto, sessionId, conversationId } = body;

    // Validación de entrada principal
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return res.status(400).json({ error: "El parámetro 'prompt' es requerido y debe ser una cadena válida." });
    }

    // 🔍 Log de depuración para inspección en los logs de Vercel
    console.log("📥 Petición recibida en /api/audit:");
    console.log(" - Prompt:", prompt);
    console.log(" - Session ID:", sessionId || "N/A");
    console.log(" - Datos Contexto recibidos:", datosContexto ? JSON.stringify(datosContexto).substring(0, 150) + "..." : "VACÍO / UNDEFINED");

    // 3. Instanciar e invocar el Orquestador principal
    const engine = new AuditEngine();

    // Transmite los datos de contexto hacia el pipeline del engine
    const executionContext = await engine.execute(prompt, sessionId, conversationId, { 
      datosContexto: datosContexto || {} 
    });

    // 4. Retornar la respuesta estructurada al frontend
    return res.status(200).json({
      status: "success",
      respuesta: executionContext.llm?.parsedResponse || executionContext.llm?.rawResponse || executionContext,
      telemetry: executionContext.telemetry || {},
      classification: executionContext.classification || {},
      validation: executionContext.validation || {}
    });

  } catch (error) {
    console.error("❌ Error en Vercel Serverless Function (/api/audit):", error);
    
    return res.status(500).json({ 
      status: "error", 
      message: error.message || "Error procesando el pipeline de auditoría.",
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}