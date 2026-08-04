/**
 * @file IntentClassifier.js
 * @description Clasificador de intenciones y dominios GRC para el Motor IA.
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

// Acciones/Intenciones soportadas
export const INTENTS = {
  ANALYZE: 'ANALYZE',
  COMPARE: 'COMPARE',
  EVALUATE: 'EVALUATE',
  RECOMMEND: 'RECOMMEND',
  TRACK: 'TRACK',
  SUMMARIZE: 'SUMMARIZE',
  UNKNOWN: 'UNKNOWN'
};

// Mapeo por defecto de esquemas para componentes JSX
const SCHEMA_MAP = {
  [DOMAINS.RISK]: 'DashboardSchema',
  [DOMAINS.CONTROL]: 'TechnicalSchema',
  [DOMAINS.FINDING]: 'ReportSchema',
  [DOMAINS.PLAN]: 'ReportSchema',
  [DOMAINS.GOVERNANCE]: 'TechnicalSchema',
  [DOMAINS.UNKNOWN]: 'ExecutiveSchema'
};

export class IntentClassifier {
  /**
   * Clasifica la entrada del usuario en un dominio e intención estructurados.
   * @param {string} userInput - Texto ingresado por el usuario.
   * @param {Object} context - Contexto opcional del estado actual de la app.
   * @returns {Object} Clasificación estructurada.
   */
  static classify(userInput, context = {}) {
    if (!userInput || typeof userInput !== 'string') {
      return this._buildResponse(DOMAINS.UNKNOWN, INTENTS.UNKNOWN, 0, true, "Entrada inválida o vacía.");
    }

    const text = userInput.toLowerCase().trim();

    // 1. Detección de Dominio
    let domain = DOMAINS.UNKNOWN;
    if (text.includes('riesgo') || text.includes('amenaza') || text.includes('vulnerabilidad')) {
      domain = DOMAINS.RISK;
    } else if (text.includes('control') || text.includes('mitigant') || text.includes('mitigar')) {
      domain = DOMAINS.CONTROL;
    } else if (text.includes('hallazgo') || text.includes('deficiencia') || text.includes('observacion')) {
      domain = DOMAINS.FINDING;
    } else if (text.includes('plan') || text.includes('accion') || text.includes('compromiso')) {
      domain = DOMAINS.PLAN;
    } else if (text.includes('norma') || text.includes('politica') || text.includes('cumplimiento') || text.includes('iso')) {
      domain = DOMAINS.GOVERNANCE;
    }

    // 2. Detección de Intención
    let intent = INTENTS.UNKNOWN;
    if (text.includes('analiz') || text.includes('evaluar') || text.includes('diagnostic')) {
      intent = INTENTS.ANALYZE;
    } else if (text.includes('compar') || text.includes('diferencia') || text.includes('frente a')) {
      intent = INTENTS.COMPARE;
    } else if (text.includes('recomiend') || text.includes('suger') || text.includes('que hacer')) {
      intent = INTENTS.RECOMMEND;
    } else if (text.includes('resum') || text.includes('sintesis') || text.includes('estado')) {
      intent = INTENTS.SUMMARIZE;
    } else if (text.includes('seguimiento') || text.includes('rastre') || text.includes('avance')) {
      intent = INTENTS.TRACK;
    }

    // 3. Cálculo de Puntuación de Confianza (Score)
    let score = 0.5;
    if (domain !== DOMAINS.UNKNOWN) score += 0.25;
    if (intent !== INTENTS.UNKNOWN) score += 0.25;

    // 4. Protocolo de Ambigüedad
    const requiresClarification = score < 0.75 || domain === DOMAINS.UNKNOWN;

    return this._buildResponse(
      domain,
      intent,
      score,
      requiresClarification,
      requiresClarification ? "La consulta es ambigua. Se sugiere especificar si se refiere a un Riesgo, Control, Hallazgo o Plan." : null
    );
  }

  /**
   * Helper privado para estandarizar el contrato de respuesta del clasificador.
   */
  static _buildResponse(domain, intent, confidenceScore, requiresClarification, message = null) {
    return {
      domain,
      intent,
      outputSchema: SCHEMA_MAP[domain] || 'ExecutiveSchema',
      confidenceScore,
      requiresClarification,
      clarificationMessage: message,
      timestamp: new Date().toISOString()
    };
  }
}