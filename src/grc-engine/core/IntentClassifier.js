/**
 * @file IntentClassifier.js
 * @description Clasificador de intenciones y dominios GRC de alta precisión para el AuditEngine.
 */

// Dominios soportados por la plataforma GRC
export const DOMAINS = {
  RISK: 'RISK',
  CONTROL: 'CONTROL',
  FINDING: 'FINDING',
  PLAN: 'PLAN',
  GOVERNANCE: 'GOVERNANCE',
  UNKNOWN: 'UNKNOWN'
};

// Acciones e Intenciones del usuario
export const INTENTS = {
  ANALYZE: 'ANALYZE',
  COMPARE: 'COMPARE',
  EVALUATE: 'EVALUATE',
  RECOMMEND: 'RECOMMEND',
  TRACK: 'TRACK',
  SUMMARIZE: 'SUMMARIZE',
  UNKNOWN: 'UNKNOWN'
};

// Formatos/Esquemas de salida deseados
export const OUTPUT_FORMATS = {
  EXECUTIVE: 'ExecutiveSchema',
  TECHNICAL: 'TechnicalSchema',
  DASHBOARD: 'DashboardSchema',
  REPORT: 'ReportSchema'
};

// Mapeo por defecto de esquemas según el Dominio y la Intención
const SCHEMA_MAP = {
  [DOMAINS.RISK]: OUTPUT_FORMATS.DASHBOARD,
  [DOMAINS.CONTROL]: OUTPUT_FORMATS.TECHNICAL,
  [DOMAINS.FINDING]: OUTPUT_FORMATS.REPORT,
  [DOMAINS.PLAN]: OUTPUT_FORMATS.REPORT,
  [DOMAINS.GOVERNANCE]: OUTPUT_FORMATS.TECHNICAL,
  [DOMAINS.UNKNOWN]: OUTPUT_FORMATS.EXECUTIVE
};

export class IntentClassifier {
  /**
   * Clasifica la consulta ingresada retornando una estructura rica en metadatos
   * para guiar al AuditEngine en la selección del especialista, prompt de tarea y esquema.
   * 
   * @param {string} userInput - Pregunta o instrucción ingresada por el auditor.
   * @param {Object} [context={}] - Estado o contexto actual de la aplicación React.
   * @returns {Object} Clasificación enriquecida con nivel de confianza y flags de acción.
   */
  static classify(userInput, context = {}) {
    if (!userInput || typeof userInput !== 'string' || !userInput.trim()) {
      return this._buildResponse({
        domain: DOMAINS.UNKNOWN,
        intent: INTENTS.UNKNOWN,
        outputFormat: OUTPUT_FORMATS.EXECUTIVE,
        confidenceScore: 0,
        requiresClarification: true,
        clarificationMessage: "Entrada inválida o vacía. Por favor proporciona una consulta sobre GRC.",
        rawQuery: userInput || ""
      });
    }

    const text = userInput.toLowerCase().trim();

    // 1. Detección de Dominio
    let domain = DOMAINS.UNKNOWN;
    if (text.includes('riesgo') || text.includes('amenaza') || text.includes('vulnerabilidad') || text.includes('exposición')) {
      domain = DOMAINS.RISK;
    } else if (text.includes('control') || text.includes('mitigant') || text.includes('mitigar') || text.includes('salvaguarda')) {
      domain = DOMAINS.CONTROL;
    } else if (text.includes('hallazgo') || text.includes('deficiencia') || text.includes('observacion') || text.includes('brecha')) {
      domain = DOMAINS.FINDING;
    } else if (text.includes('plan') || text.includes('accion') || text.includes('compromiso') || text.includes('remediacion')) {
      domain = DOMAINS.PLAN;
    } else if (text.includes('norma') || text.includes('politica') || text.includes('cumplimiento') || text.includes('iso') || text.includes('gobierno')) {
      domain = DOMAINS.GOVERNANCE;
    }

    // 2. Detección de Intención/Tarea
    let intent = INTENTS.UNKNOWN;
    if (text.includes('analiz') || text.includes('análisis') || text.includes('analisis') || text.includes('evaluar') || text.includes('diagnostic') || text.includes('examen')) {
      intent = INTENTS.ANALYZE;
    } else if (text.includes('compar') || text.includes('diferencia') || text.includes('frente a') || text.includes('vs')) {
      intent = INTENTS.COMPARE;
    } else if (text.includes('recomiend') || text.includes('suger') || text.includes('que hacer') || text.includes('propuesta')) {
      intent = INTENTS.RECOMMEND;
    } else if (text.includes('resum') || text.includes('sintesis') || text.includes('estado general')) {
      intent = INTENTS.SUMMARIZE;
    } else if (text.includes('seguimiento') || text.includes('rastre') || text.includes('avance') || text.includes('kpi')) {
      intent = INTENTS.TRACK;
    }

    // 3. Detección explícita del Formato de Salida
    let outputFormat = SCHEMA_MAP[domain] || OUTPUT_FORMATS.EXECUTIVE;
    if (text.includes('técnico') || text.includes('detalle técnico') || text.includes('deep dive')) {
      outputFormat = OUTPUT_FORMATS.TECHNICAL;
    } else if (text.includes('métrica') || text.includes('indicador') || text.includes('dashboard') || text.includes('panel')) {
      outputFormat = OUTPUT_FORMATS.DASHBOARD;
    } else if (text.includes('informe') || text.includes('reporte') || text.includes('oficial')) {
      outputFormat = OUTPUT_FORMATS.REPORT;
    }

    // 4. Cálculo de Puntuación de Confianza (Confidence Score)
    let confidenceScore = 0.5;
    if (domain !== DOMAINS.UNKNOWN) confidenceScore += 0.25;
    if (intent !== INTENTS.UNKNOWN) confidenceScore += 0.25;

    // 5. Flags de acción para orquestación inteligente
    const requiresClarification = confidenceScore < 0.75 || domain === DOMAINS.UNKNOWN;
    const requiresComparison = intent === INTENTS.COMPARE;

    return this._buildResponse({
      domain,
      intent,
      outputFormat,
      confidenceScore,
      requiresClarification,
      requiresComparison,
      clarificationMessage: requiresClarification 
        ? "La consulta es ambigua o muy amplia. Para darte un diagnóstico preciso, especifica si deseas analizar un Riesgo, Control, Hallazgo o Norma de Gobierno." 
        : null,
      rawQuery: userInput
    });
  }

  /**
   * Helper privado para estructurar la respuesta estandarizada.
   */
  static _buildResponse({
    domain,
    intent,
    outputFormat,
    confidenceScore,
    requiresClarification,
    requiresComparison = false,
    clarificationMessage = null,
    rawQuery = ""
  }) {
    return {
      domain,
      intent,
      outputSchema: outputFormat,
      confidenceScore,
      requiresClarification,
      requiresComparison,
      clarificationMessage,
      rawQuery,
      timestamp: new Date().toISOString()
    };
  }
}