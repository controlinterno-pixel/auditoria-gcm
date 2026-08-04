/**
 * @file AuditEngine.js
 * @description Orquestador central del motor GRC IA de Termales de Santa Rosa de Cabal.
 */

import { IntentClassifier } from './IntentClassifier.js';
import { KnowledgeManager } from './KnowledgeManager.js';
import { ContextBuilder } from './ContextBuilder.js';
import { PromptAssembler } from './PromptAssembler.js';
import { ResponseValidator } from './ResponseValidator.js';
import { GeminiService } from '../services/GeminiService.js';

// Especialistas
import { RiskSpecialist } from '../specialists/RiskSpecialist.js';

// Mapa de Especialistas registrados
const SPECIALISTS_REGISTRY = {
  RISK: new RiskSpecialist()
};

export class AuditEngine {
  /**
   * Ejecuta el flujo completo End-to-End de auditoría/consulta IA.
   * 
   * @param {string} userQuery - Pregunta o solicitud del usuario.
   * @param {Object} [userContext={}] - Datos del contexto de sesión de React/Firebase.
   * @returns {Promise<Object>} Respuesta validada según el CoreSchema.
   */
  static async processQuery(userQuery, userContext = {}) {
    const startTime = Date.now();

    try {
      // 1. Clasificar Intención y Dominio
      const classification = IntentClassifier.classify(userQuery, userContext);

      if (classification.requiresClarification) {
        return {
          isValid: true,
          type: "CLARIFICATION_REQUIRED",
          message: classification.clarificationMessage
        };
      }

      // 2. Obtener Especialista adecuado
      const specialist = SPECIALISTS_REGISTRY[classification.domain] || SPECIALISTS_REGISTRY.RISK;
      const manifest = specialist.getManifest();

      // 3. Recuperar y Formatear Contexto
      const rawKnowledge = await KnowledgeManager.getContext(classification, userContext);
      
      // Adaptar entities al formato esperado por ContextBuilder
      const domainKey = `${classification.domain.toLowerCase()}s`;
      const structuredData = { [domainKey]: rawKnowledge.entities };
      
      const formattedContext = ContextBuilder.buildFormattedContext(structuredData);

      // 4. Ensamblar Prompts (System + Specialist + User Context)
      const systemInstruction = PromptAssembler.assembleSystemInstruction({
        specialistPrompt: manifest.specialistPrompt,
        taskPrompt: `Tarea actual: ${classification.intent}`
      });

      const userPrompt = PromptAssembler.assembleUserPrompt(formattedContext, userQuery);

      // 5. Invocar servicio LLM (Gemini)
      const rawResponse = await GeminiService.generateResponse({
        systemInstruction,
        prompt: userPrompt
      });

      // 6. Validar Contrato de Salida
      const validationResult = ResponseValidator.validate(rawResponse);
      
      // Anexar metadatos de rendimiento
      if (validationResult.data && validationResult.data.metadata) {
        validationResult.data.metadata.executionTimeMs = Date.now() - startTime;
        validationResult.data.metadata.domain = classification.domain;
        validationResult.data.metadata.intent = classification.intent;
      }

      return validationResult;

    } catch (error) {
      console.error("[AuditEngine Error]: Fallo crítico en el flujo principal.", error);
      return ResponseValidator._buildErrorPayload(
        "Ocurrió un error inesperado al procesar la solicitud en el motor de auditoría.",
        error.message
      );
    }
  }
}