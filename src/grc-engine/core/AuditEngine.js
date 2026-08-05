import { ExecutionContext } from './ExecutionContext.js';
import { IntentClassifier } from './IntentClassifier.js';
import { PromptBuilder } from './PromptBuilder.js';
import { GeminiService } from '../services/GeminiService.js';
import { KnowledgeManager } from './KnowledgeManager.js';
import { ContextBuilder } from './ContextBuilder.js';
import { ResponseValidator } from './ResponseValidator.js';
import { CoreSchema } from '../schemas/CoreSchema.js';
import { DashboardSchema } from '../schemas/DashboardSchema.js';
import { ExecutiveSchema } from '../schemas/ExecutiveSchema.js';
import { TechnicalSchema } from '../schemas/TechnicalSchema.js';
import { ReportSchema } from '../schemas/ReportSchema.js';
import { PromptAssembler } from './PromptAssembler.js';
import { memoryService } from '../services/MemoryService.js';

const SCHEMAS = {
  ExecutiveSchema,
  TechnicalSchema,
  DashboardSchema,
  ReportSchema
};

/**
 * @file AuditEngine.js
 * @description Orquestador principal del motor GRC. Controla el pipeline unidireccional.
 */
export class AuditEngine {
  constructor() {
    console.log("🚀 GRC Audit Engine Inicializado");
  }

  /**
   * Ejecuta el pipeline completo de auditoría.
   * @param {string} userQuery - La consulta del usuario.
   * @param {string} [sessionId] - ID de la sesión.
   * @param {string} [conversationId] - ID de la conversación.
   * @param {Object} [options] - Opciones adicionales (ej: datosContexto enviados desde el frontend).
   * @returns {Promise<ExecutionContext>} El contexto final con la respuesta.
   */
  async execute(userQuery, sessionId = null, conversationId = null, options = {}) {
    const context = new ExecutionContext(userQuery, sessionId, conversationId);
    this.options = options;
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
      context.errors.push({
        step: "PIPELINE_EXECUTION",
        message: error.message,
        timestamp: new Date().toISOString()
      });
      context.llm.status = "FAILED";
      console.error(`[ERROR] Pipeline falló:`, error.message);
    } finally {
      context.finalize();
      console.log(`[END] Latencia total: ${context.telemetry.latencyTotalMs}ms`);
    }

    return context;
  }

  async _runClassification(context) {
    console.log(" -> Ejecutando Clasificación...");
    context.classification = IntentClassifier.classify(context.request.userQuery);
    
    if (context.classification.requiresClarification) {
      console.warn(" [!] Advertencia: Intención desconocida. El motor podría requerir más contexto.");
    }
  }

  async _runKnowledgeRetrieval(context) {
    console.log(" -> Recuperando Conocimiento (RAG)...");
    
    // Obtenemos datos del KnowledgeManager pasando los datos de contexto si existen
    const rawKnowledge = await KnowledgeManager.getContext(
      context.classification, 
      this.options?.datosContexto || {}
    );
    const entities = rawKnowledge.entities || [];

    const domainKeyMap = {
      RISK: 'risks',
      CONTROL: 'controls',
      FINDING: 'findings',
      PLAN: 'plans',
      GOVERNANCE: 'governance'
    };

    const keyName = domainKeyMap[context.classification.domain] || 'risks';

    const formattedContext = ContextBuilder.buildFormattedContext({
      [keyName]: entities,
      ...rawKnowledge
    });

    // 🔍 ESPÍA DE DATOS DE FIREBASE / KNOWLEDGE MANAGER
    console.log("==========================================");
    console.log("🔎 [DEBUG] ENTIDADES RECUPERADAS DE BASE DE DATOS:");
    console.log(JSON.stringify(entities, null, 2));
    console.log("==========================================");

    context.knowledge.retrievedContext = formattedContext;
    context.knowledge.cacheHit = false;
    context.knowledge.retrievedEntities = entities;

    context.memory.chatHistory = memoryService.getHistory(context.request.sessionId);
    if (context.memory.chatHistory.length > 0) {
      console.log(` -> [Memoria] ${context.memory.chatHistory.length} mensajes previos recuperados.`);
    }
  }

  async _runPromptAssembly(context) {
    console.log(" -> Ensamblando Prompt con contrato SSOT y ContextRanker...");
    
    // Identificar el esquema objetivo según la clasificación
    const schemaName = context.classification.outputSchema;
    const targetSchema = SCHEMAS[schemaName] || CoreSchema;

    // Ensamblar invocando directamente el nuevo contrato desacoplado
    context.prompt.assembledPayload = PromptAssembler.assemble({
      targetSchema,
      structuredContext: context.knowledge.retrievedContext,
      userQuery: context.request.userQuery,
      rawFindings: context.knowledge.retrievedEntities
    });
  }

  async _runLlmInference(context) {
    console.log(" -> Llamando a Gemini API...");
    try {
      const geminiService = new GeminiService();
      const llmResult = await geminiService.generateContent(context.prompt.assembledPayload, {
        temperature: 0.0, // Cero alucinación, determinismo absoluto GRC
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
      
      memoryService.addMessage(context.request.sessionId, 'user', context.request.userQuery);
      
      const assistantReply = validationResult.data.summary || "Análisis completado y entregado en el dashboard.";
      memoryService.addMessage(context.request.sessionId, 'assistant', assistantReply);
    }
  }
}