import { ExecutionContext } from './ExecutionContext.js';
import { IntentClassifier } from '../specialists/IntentClassifier.js';
import { PromptBuilder } from './PromptBuilder.js';
import { GeminiService } from '../services/GeminiService.js';
/**
 * @file AuditEngine.js
 * @description Orquestador principal del motor GRC. Controla el pipeline unidireccional.
 */

export class AuditEngine {
  constructor() {
    // Aquí luego inyectaremos dependencias reales (IntentClassifier, etc.)
    console.log("🚀 GRC Audit Engine Inicializado");
  }

  /**
   * Ejecuta el pipeline completo de auditoría.
   * @param {string} userQuery - La consulta del usuario.
   * @param {string} [sessionId] - ID de la sesión.
   * @param {string} [conversationId] - ID de la conversación.
   * @returns {Promise<ExecutionContext>} El contexto final con la respuesta.
   */
  async execute(userQuery, sessionId = null, conversationId = null) {
    // 1. Inicializar el Corazón del Motor
    const context = new ExecutionContext(userQuery, sessionId, conversationId);
    console.log(`[START] Pipeline iniciado - RequestID: ${context.request.requestId}`);

    try {
      // 2. Fase de Clasificación (Intent & Domain)
      await this._runClassification(context);

      // 3. Fase de Memoria y Conocimiento (RAG / History)
      await this._runKnowledgeRetrieval(context);

      // 4. Ensamblaje de Prompt (Token Budgeting)
      await this._runPromptAssembly(context);

      // 5. Inferencia LLM (Gemini API)
      await this._runLlmInference(context);

      // 6. Validación de Contrato (Schemas)
      await this._runValidation(context);

    } catch (error) {
      // Manejo centralizado de errores
      context.errors.push({
        step: "PIPELINE_EXECUTION",
        message: error.message,
        timestamp: new Date().toISOString()
      });
      context.llm.status = "FAILED";
      console.error(`[ERROR] Pipeline falló:`, error.message);
    } finally {
      // 7. Observabilidad y Cierre
      context.finalize();
      console.log(`[END] Latencia total: ${context.telemetry.latencyTotalMs}ms`);
    }

    return context; // Retornamos el objeto mutado en su forma final
  }

  // --- MÉTODOS PRIVADOS DEL PIPELINE (Simulados para la primera prueba) ---

  async _runClassification(context) {
    console.log(" -> Ejecutando Clasificación...");
    
    // Invocamos al especialista heurístico pasándole la consulta original del usuario
    context.classification = IntentClassifier.classify(context.request.userQuery);
    
    // Si la intención es desconocida, lanzamos un log de advertencia
    if (context.classification.requiresClarification) {
        console.warn(" [!] Advertencia: Intención desconocida. El motor podría requerir más contexto.");
    }
  }

  async _runKnowledgeRetrieval(context) {
    console.log(" -> Recuperando Conocimiento (RAG)...");
    context.knowledge.cacheHit = false;
  }

  async _runPromptAssembly(context) {
    console.log(" -> Ensamblando Prompt con reglas estrictas de plataforma...");
    
    // Ensamblamos el texto final que se enviará a la IA
    context.prompt.assembledPayload = PromptBuilder.build(context);
    
    // (Opcional) Aquí en el futuro mediremos la cantidad de tokens para asegurar el presupuesto
  }

 async _runLlmInference(context) {
    console.log(" -> Llamando a Gemini API...");
    try {
      const geminiService = new GeminiService();
      const llmResult = await geminiService.generateContent(context.prompt.assembledPayload, {
        temperature: 0.1,
        responseMimeType: "application/json"
      });

      context.updateLLMResponse(llmResult.text, llmResult.modelUsed);
    } catch (llmError) {
      console.error(` ❌ Error en inferencia: ${llmError.message}`);
      context.errors.push({
        step: "LLM_INFERENCE",
        message: llmError.message,
        timestamp: new Date().toISOString()
      });
      context.llm.status = "FAILED";
      context.llm.rawResponse = JSON.stringify({ 
        error: "No fue posible procesar la inferencia en este momento.", 
        details: llmError.message 
      });
      context.llm.modelUsed = "none";
    }
  }

  async _runValidation(context) {
    console.log(" -> Validando JSON de salida...");
    context.validation.passed = true; 
  }
}