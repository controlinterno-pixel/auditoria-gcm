import { AuditEngine } from '../src/grc-engine/core/AuditEngine.js';

export default async function handler(req, res) {
  // Cabeceras de seguridad y CORS para Vercel
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
    const { prompt, datosContexto, sessionId, conversationId } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "La consulta 'prompt' es requerida." });
    }

    // 1. Instanciar el Orquestador principal
    const engine = new AuditEngine();

    // 2. Ejecutar el pipeline completo (Clasificación, RAG, Prompt, Inferencia y Validación)
    const executionContext = await engine.execute(prompt, sessionId, conversationId, { datosContexto });

    // 3. Responder al frontend con la estructura requerida
    return res.status(200).json({
      status: "success",
      respuesta: executionContext.llm.parsedResponse || executionContext.llm.rawResponse,
      telemetry: executionContext.telemetry,
      classification: executionContext.classification,
      validation: executionContext.validation
    });

  } catch (error) {
    console.error("❌ Error en Vercel Serverless Function:", error);
    return res.status(500).json({ 
      status: "error", 
      message: error.message || "Error procesando el pipeline de auditoría." 
    });
  }
}