import { DOMAINS } from './IntentClassifier.js';

/**
 * @file KnowledgeManager.js
 * @description Capa de abstracción de conocimiento para el Motor GRC.
 * Extrae y consolida información 360° cruzando todos los módulos de la plataforma.
 */
export class KnowledgeManager {
  /**
   * Obtiene y estructura el contexto de datos relacional según la consulta del usuario.
   * @param {Object} classification - Resultado del IntentClassifier.
   * @param {Object} userContext - Información enviada desde el frontend o sesión.
   * @returns {Promise<Object>} Contexto multi-módulo formateado.
   */
  static async getContext(classification, userContext = {}) {
    const { domain, intent } = classification;

    // 1. Extraer todas las tablas enviadas desde la plataforma (Soporte Español e Inglés)
    const risks = userContext.risks || userContext.riesgos || [];
    const controls = userContext.controls || userContext.controles || userContext.evaluaciones || [];
    const findings = userContext.findings || userContext.hallazgos || [];
    const plans = userContext.plans || userContext.planes || [];
    const incidents = userContext.incidents || userContext.incidentes || [];
    const governance = userContext.governance || userContext.gobierno || userContext.normas || [];

    const hasCustomData = 
      risks.length > 0 || 
      controls.length > 0 || 
      findings.length > 0 || 
      plans.length > 0 || 
      incidents.length > 0 ||
      governance.length > 0 || 
      (Array.isArray(userContext.entities) && userContext.entities.length > 0);

    // 2. Si el frontend envió datos, estructuramos una Vista Consolidada Multi-Módulo (360°)
    if (hasCustomData) {
      // Las entidades principales corresponden al dominio, pero MANTENEMOS todas las tablas activas para el cruce
      let entities = [];
      if (domain === DOMAINS.RISK) entities = risks;
      else if (domain === DOMAINS.CONTROL) entities = controls;
      else if (domain === DOMAINS.FINDING) entities = findings;
      else if (domain === DOMAINS.PLAN) entities = plans;
      else if (domain === DOMAINS.GOVERNANCE) entities = governance;
      else entities = userContext.entities || [...risks, ...controls, ...findings, ...plans, ...incidents, ...governance];

      return {
        domain,
        intent,
        organization: "Termales de Santa Rosa de Cabal",
        retrievedAt: new Date().toISOString(),
        entities,
        risks,
        controls,
        findings,
        plans,
        incidents,
        governance,
        ...userContext
      };
    }

    // 3. Respaldo por defecto (Si no hay datos en frontend)
    return {
      domain,
      intent,
      organization: "Termales de Santa Rosa de Cabal",
      retrievedAt: new Date().toISOString(),
      entities: [],
      risks: [],
      controls: [],
      findings: [],
      plans: [],
      incidents: [],
      governance: []
    };
  }
}