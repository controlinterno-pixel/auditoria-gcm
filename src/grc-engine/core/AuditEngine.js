import { ExecutionContext } from './ExecutionContext.js';
import { IntentClassifier } from './IntentClassifier.js';
import { PromptBuilder } from './PromptBuilder.js';
import { GeminiService } from '../services/GeminiService.js';
import { KnowledgeManager } from './KnowledgeManager.js';
import { ContextBuilder } from './ContextBuilder.js';
import { ResponseValidator } from '../validators/ResponseValidator.js';
import { CoreSchema } from '../schemas/CoreSchema.js';
import { DashboardSchema } from '../schemas/DashboardSchema.js';
import { ExecutiveSchema } from '../schemas/ExecutiveSchema.js';
import { TechnicalSchema } from '../schemas/TechnicalSchema.js';

const SCHEMAS = {
  ExecutiveSchema,
  TechnicalSchema,
  DashboardSchema,
  ReportSchema: ExecutiveSchema
};
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
  
  // 1. Obtenemos los datos desde el KnowledgeManager
  const rawKnowledge = await KnowledgeManager.getContext(context.classification);
  const entities = rawKnowledge.entities || [];

  // 2. Mapeamos dinámicamente según el dominio clasificado
  const domainKeyMap = {
    RISK: 'risks',
    CONTROL: 'controls',
    FINDING: 'findings',
    PLAN: 'plans',
    GOVERNANCE: 'governance'
  };

  const keyName = domainKeyMap[context.classification.domain] || 'risks';

  // 3. Formateamos el contexto para el PromptBuilder
  const formattedContext = ContextBuilder.buildFormattedContext({
    [keyName]: entities
  });

  // 4. Guardamos en el objeto ExecutionContext
  context.knowledge.retrievedContext = formattedContext;
  context.knowledge.cacheHit = false;
  context.knowledge.retrievedEntities = entities;
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

context.llm.rawResponse = llmResult.text;
context.llm.modelUsed = llmResult.modelUsed;
context.llm.status = "SUCCESS";
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
    console.log(" -> Validando JSON de salida con ResponseValidator...");
    
    const schemaName = context.classification.outputSchema;
    const targetSchema = SCHEMAS[schemaName] || CoreSchema;

    const validationResult = ResponseValidator.validate(context.llm.rawResponse, targetSchema);

    context.validation = {
      passed: validationResult.isValid,
      schemaVersion: validationResult.schema,
      issues: validationResult.error ? [validationResult.error] : []
    };

    if (!validationResult.isValid) {
      console.warn(` ⚠️ Fallo en validación de contrato (${schemaName}): ${validationResult.error}`);
    } else {
      console.log(` ✅ Validación de contrato exitosa (${validationResult.schema}).`);
      context.llm.parsedResponse = validationResult.data;
    }
  }

  }