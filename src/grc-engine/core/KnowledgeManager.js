import { DOMAINS } from './IntentClassifier.js';

/**
 * @file KnowledgeManager.js
 * @description Capa de abstracción de conocimiento para el Motor GRC.
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

    // Si el frontend envió información en tiempo real, la usamos directamente
    if (userContext && Object.keys(userContext).length > 0) {
      const domainKey = domain ? domain.toLowerCase() + 's' : 'entities';
      const entities = Array.isArray(userContext[domainKey]) 
        ? userContext[domainKey] 
        : (userContext.entities || userContext.risks || userContext.controls || userContext.findings || userContext.plans || []);

      return {
        domain,
        intent,
        organization: "Termales de Santa Rosa de Cabal",
        retrievedAt: new Date().toISOString(),
        entities: entities,
        ...userContext
      };
    }

    // Estructura de respaldo (fallback) con mocks si no vienen datos externos
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
          break;
        case DOMAINS.CONTROL:
          knowledgeBase.entities = await this._fetchControlData(userContext);
          break;
        case DOMAINS.FINDING:
          knowledgeBase.entities = await this._fetchFindingData(userContext);
          break;
        case DOMAINS.PLAN:
          knowledgeBase.entities = await this._fetchPlanData(userContext);
          break;
        case DOMAINS.GOVERNANCE:
          knowledgeBase.entities = await this._fetchGovernanceData(userContext);
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

  // --- MÉTODOS PRIVADOS DE EXTRACTION ---

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
        status: "ABIERTO"
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