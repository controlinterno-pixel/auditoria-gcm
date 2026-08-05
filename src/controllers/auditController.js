/**
 * @file auditController.js
 * @description Controlador para procesar las consultas enviadas al motor GRC.
 */

import { AuditEngine } from '../grc-engine/core/AuditEngine.js';

// Instanciamos el motor como Singleton para reutilizar memoria y cachés
const engine = new AuditEngine();

export const processQuery = async (req, res) => {
  try {
    const { query, sessionId, conversationId } = req.body;

    // Validación básica de entrada
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'El campo "query" es obligatorio y debe ser un texto válido.'
      });
    }

    // Ejecutamos el pipeline del AuditEngine
    const executionContext = await engine.execute(
      query,
      sessionId || null,
      conversationId || null
    );

    // Si ocurrió un error en la inferencia
    if (executionContext.llm?.status === 'FAILED') {
      return res.status(500).json({
        status: 'error',
        message: 'Error al procesar la inferencia con el modelo de IA.',
        requestId: executionContext.request.requestId,
        errors: executionContext.errors
      });
    }

    // Respuesta exitosa
    return res.status(200).json({
      status: 'success',
      data: executionContext.llm?.parsedResponse || executionContext.llm?.rawResponse,
      telemetry: {
        requestId: executionContext.request.requestId,
        sessionId: executionContext.request.sessionId,
        latencyMs: executionContext.telemetry?.latencyTotalMs,
        modelUsed: executionContext.llm?.modelUsed,
        domain: executionContext.classification?.domain,
        intent: executionContext.classification?.intent
      }
    });

  } catch (error) {
    console.error('[AuditController Error]:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor al procesar la solicitud.',
      details: error.message
    });
  }
};