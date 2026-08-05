import { DOMAINS } from './IntentClassifier.js';

/**
 * @file KnowledgeManager.js
 * @description Capa de abstracción de conocimiento para el Motor GRC.
 * Soporta llaves en español (hallazgos, riesgos, controles) e inglés.
 */
export class KnowledgeManager {
  /**
   * Obtiene y estructura el contexto de datos relevante según la intención del usuario.
   * @param {Object} classification - Resultado del IntentClassifier.
   * @param {Object} userContext - Información enviada desde el frontend o sesión.
   * @returns {Promise<Object>} Contexto formateado para ser inyectado en el Prompt.
   */
  static async getContext(classification, userContext = {}) {
    const { domain, intent } = classification;

    // 1. Mapeo flexible de llaves en Español e Inglés enviadas desde el Frontend
    const risks = userContext.risks || userContext.riesgos || [];
    const controls = userContext.controls || userContext.controles || [];
    const findings = userContext.findings || userContext.hallazgos || [];
    const plans = userContext.plans || userContext.planes || [];
    const governance = userContext.governance || userContext.gobierno || userContext.normas || [];

    const hasCustomData = 
      risks.length > 0 || 
      controls.length > 0 || 
      findings.length > 0 || 
      plans.length > 0 || 
      governance.length > 0 || 
      (Array.isArray(userContext.entities) && userContext.entities.length > 0);

    // 2. Si el frontend envió datos explícitos (en español o inglés), los estructuramos
    if (hasCustomData) {
      let entities = [];
      if (domain === DOMAINS.RISK) entities = risks;
      else if (domain === DOMAINS.CONTROL) entities = controls;
      else if (domain === DOMAINS.FINDING) entities = findings;
      else if (domain === DOMAINS.PLAN) entities = plans;
      else if (domain === DOMAINS.GOVERNANCE) entities = governance;
      else entities = userContext.entities || [...risks, ...controls, ...findings, ...plans, ...governance];

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
        governance,
        ...userContext
      };
    }

    // 3. Si no llegaron datos del frontend, activamos los Mocks de respaldo por dominio
    const knowledgeBase = {
      domain,
      intent,
      organization: "Termales de Santa Rosa de Cabal",
      retrievedAt: new Date().toISOString(),
      entities: []
    };

    try {
      switch (domain) {
        case DOMAINS.RISK:
          knowledgeBase.entities = await this._fetchRiskData(userContext);
          knowledgeBase.risks = knowledgeBase.entities;
          break;
        case DOMAINS.CONTROL:
          knowledgeBase.entities = await this._fetchControlData(userContext);
          knowledgeBase.controls = knowledgeBase.entities;
          break;
        case DOMAINS.FINDING:
          knowledgeBase.entities = await this._fetchFindingData(userContext);
          knowledgeBase.findings = knowledgeBase.entities;
          break;
        case DOMAINS.PLAN:
          knowledgeBase.entities = await this._fetchPlanData(userContext);
          knowledgeBase.plans = knowledgeBase.entities;
          break;
        case DOMAINS.GOVERNANCE:
          knowledgeBase.entities = await this._fetchGovernanceData(userContext);
          knowledgeBase.governance = knowledgeBase.entities;
          break;
        default:
          knowledgeBase.entities = [];
      }

      return knowledgeBase;
    } catch (error) {
      console.error("[KnowledgeManager Error]: Fallo al recuperar contexto de datos.", error);
      return {
        ...knowledgeBase,
        error: "No se pudo recuperar la información del sistema de auditoría."
      };
    }
  }

  // --- MÉTODOS PRIVADOS DE EXTRACCIÓN ---

  static async _fetchRiskData(context) {
    return [
      {
        id: "RSK-001",
        name: "Contaminación de fuentes hidrotermales por sobreaforo",
        impact: "ALTO",
        probability: "MEDIO",
        residualScore: 16,
        status: "ACTIVO"
      }
    ];
  }

  static async _fetchControlData(context) {
    return [
      {
        id: "CTR-102",
        name: "Monitoreo automatizado de caudal y temperatura",
        effectiveness: "EFECTIVO",
        type: "DETECTIVO",
        coverage: 0.85,
        description: "Aplica para mitigar el riesgo RSK-001 de sobreaforo en fuentes termales."
      }
    ];
  }

  static async _fetchFindingData(context) {
    return [
      {
        id: "HAL-04",
        title: "Retraso en la calibración de sensores de presión",
        severity: "MAYOR",
        status: "ABIERTO",
        description: "Los sensores de presión no han recibido calibración preventiva en los últimos 6 meses."
      }
    ];
  }

  static async _fetchPlanData(context) {
    return [
      {
        id: "PLA-09",
        title: "Mantenimiento preventivo e inspección del circuito hidráulico",
        progress: 0.60,
        dueDate: "2026-09-30",
        responsible: "Dirección de Operaciones"
      }
    ];
  }

  static async _fetchGovernanceData(context) {
    return [
      {
        id: "POL-01",
        title: "Política de Gestión de Riesgos Ambientales y Turísticos",
        complianceLevel: "92%",
        standard: "ISO 31000 / ISO 14001"
      }
    ];
  }
}