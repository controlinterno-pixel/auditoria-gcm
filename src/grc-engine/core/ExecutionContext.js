/**
 * @file ExecutionContext.js
 * @description Contenedor de estado centralizado para el pipeline del motor GRC.
 * Acompaña a la solicitud desde la entrada hasta la salida, almacenando
 * metadatos, telemetría y resultados de cada fase.
 */

// Utilidad simple para generar IDs únicos sin depender de librerías externas en esta prueba
const generateId = () => {
    return Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
};

export class ExecutionContext {
  constructor(userQuery, sessionId = null, conversationId = null) {
    // 1. Identificación y Request Original
    this.request = {
      requestId: generateId(),
      timestamp: new Date().toISOString(),
      userQuery: userQuery,
      sessionId: sessionId || "anonymous",
      conversationId: conversationId || generateId()
    };

    // 2. Fase de Clasificación (IntentClassifier)
    this.classification = {
      intent: null,
      domain: null,
      requiresClarification: false
    };

    // 3. Fase de Conocimiento (KnowledgeManager)
    this.knowledge = {
      cacheHit: false,
      retrievedEntities: [],
      sources: []
    };

    // 4. Fase de Ensamblaje (PromptAssembler)
    this.prompt = {
      assembledPayload: null,
      estimatedTokens: 0
    };

    // 5. Fase de LLM (GeminiService)
    this.llm = {
      status: "PENDING", // PENDING, SUCCESS, FAILED
      rawResponse: null,
      modelUsed: null
    };

    // 6. Fase de Validación (ResponseValidator)
    this.validation = {
      passed: false,
      schemaVersion: "1.0",
      issues: []
    };

    // 7. Registro Centralizado de Errores
    this.errors = [];

    // 8. Observabilidad y Telemetría
    this.telemetry = {
      startTimeMs: Date.now(),
      endTimeMs: null,
      latencyTotalMs: null
    };
  }

  /**
   * Sella el contexto al finalizar el pipeline, calculando latencias finales.
   */
  finalize() {
    this.telemetry.endTimeMs = Date.now();
    this.telemetry.latencyTotalMs = this.telemetry.endTimeMs - this.telemetry.startTimeMs;
  }
}