/**
 * @file IntentClassifier.js
 * @description Clasificador de intenciones y dominios GRC de alta precisión para el AuditEngine.
 */

export const DOMAINS = {
  RISK: 'RISK',
  CONTROL: 'CONTROL',
  FINDING: 'FINDING',
  PLAN: 'PLAN',
  GOVERNANCE: 'GOVERNANCE',
  UNKNOWN: 'UNKNOWN'
};

export const INTENTS = {
  ANALYZE: 'ANALYZE',
  COMPARE: 'COMPARE',
  EVALUATE: 'EVALUATE',
  RECOMMEND: 'RECOMMEND',
  TRACK: 'TRACK',
  SUMMARIZE: 'SUMMARIZE',
  UNKNOWN: 'UNKNOWN'
};

export const OUTPUT_FORMATS = {
  EXECUTIVE: 'ExecutiveSchema',
  TECHNICAL: 'TechnicalSchema',
  DASHBOARD: 'DashboardSchema',
  REPORT: 'ReportSchema'
};

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
   * Normaliza un texto quitando tildes y acentos para facilitar búsquedas por palabras clave.
   */
  static _normalizeText(str) {
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

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

    // Texto sin tildes ni mayúsculas (ej: "análisis" -> "analisis")
    const text = this._normalizeText(userInput);

    // 1. Detección de Dominio
    let domain = DOMAINS.UNKNOWN;
    if (text.includes('riesgo') || text.includes('amenaza') || text.includes('vulnerabilidad') || text.includes('exposicion')) {
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
    if (text.includes('analiz') || text.includes('evaluar') || text.includes('diagnostic') || text.includes('examen')) {
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
    if (text.includes('tecnico') || text.includes('detalle tecnico') || text.includes('deep dive')) {
      outputFormat = OUTPUT_FORMATS.TECHNICAL;
    } else if (text.includes('metrica') || text.includes('indicador') || text.includes('dashboard') || text.includes('panel')) {
      outputFormat = OUTPUT_FORMATS.DASHBOARD;
    } else if (text.includes('informe') || text.includes('reporte') || text.includes('oficial')) {
      outputFormat = OUTPUT_FORMATS.REPORT;
    }

    // 4. Cálculo de Puntuación de Confianza
    let confidenceScore = 0.5;
    if (domain !== DOMAINS.UNKNOWN) confidenceScore += 0.25;
    if (intent !== INTENTS.UNKNOWN) confidenceScore += 0.25;

    // 5. Flags de acción
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