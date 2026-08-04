/**
 * @file index.js
 * @description Punto de entrada principal (Orquestador) del Motor de Inteligencia GRC.
 * Abstrae la complejidad interna del core para la interfaz de usuario en React.
 */

import { IntentClassifier } from './core/IntentClassifier.js';
import { KnowledgeManager } from './core/KnowledgeManager.js';
import { ResponseValidator } from './core/ResponseValidator.js';

export class AuditEngine {
  /**
   * Procesador principal de consultas GRC.
   * @param {string} promptText - Consulta ingresada por el usuario en la UI.
   * @param {Object} sessionContext - Contexto de usuario, rol y estado de la app.
   * @returns {Promise<Object>} Resultado procesado y validado listo para renderizar.
   */
  static async processQuery(promptText, sessionContext = {}) {
    console.log("[AuditEngine]: Iniciando procesamiento de consulta...");

    // 1. Clasificacion de Intencion y Dominio
    const classification = IntentClassifier.classify(promptText, sessionContext);

    // Si la consulta es ambigua, pausamos y solicitamos aclaracion al usuario
    if (classification.requiresClarification) {
      return {
        status: 'NEEDS_CLARIFICATION',
        classification,
        payload: {
          summary: classification.clarificationMessage,
          keyInsights: ["Especifique el modulo GRC al que hace referencia para obtener una respuesta precisa."],
          metadata: { confidence: classification.confidenceScore }
        }
      };
    }

    // 2. Extraccion de Contexto de Datos (Aislamiento vía KnowledgeManager)
    const contextData = await KnowledgeManager.getContext(classification, sessionContext);

    // 3. TODO: Invocacion al Especialista IA (Inyeccion de Prompts)
    // Por ahora simulamos la respuesta del LLM estructurada en JSON
    const simulatedLLMResponse = {
      summary: `Analisis completado para el dominio ${classification.domain} con intencion ${classification.intent}.`,
      keyInsights: [
        `Entidades analizadas: ${contextData.entities.length}`,
        `Estado del sistema evaluado bajo parametros normativos de Termales.`
      ],
      details: contextData.entities,
      metadata: {
        domain: classification.domain,
        intent: classification.intent,
        timestamp: new Date().toISOString()
      }
    };

    // 4. Validacion estricta de Contrato JSON
    const validationResult = ResponseValidator.validate(
      simulatedLLMResponse,
      classification.outputSchema
    );

    return {
      status: validationResult.isValid ? 'SUCCESS' : 'VALIDATION_ERROR',
      classification,
      payload: validationResult.data
    };
  }
}