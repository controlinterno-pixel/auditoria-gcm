/**
 * @file KnowledgeManager.js
 * @description Capa de abstraccion de conocimiento para el Motor GRC.
 * Encargado de consultar, filtrar y formatear datos de contexto para la IA.
 */

import { DOMAINS } from './IntentClassifier.js';

export class KnowledgeManager {
  /**
   * Obtiene y estructura el contexto de datos relevante segun la intencion del usuario.
   * @param {Object} classification - Resultado del IntentClassifier.
   * @param {Object} userContext - Informacion de contexto de la sesion (usuario, rol, ID entidad).
   * @returns {Promise<Object>} Contexto formateado para ser inyectado en el Prompt.
   */
  static async getContext(classification, userContext = {}) {
    const { domain, intent } = classification;

    // Estructura base del contexto que recibira el especialista
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
        error: "No se pudo recuperar la informacion del sistema de auditoria."
      };
    }
  }

  // --- METODOS PRIVADOS DE EXTRACCION DE DATOS ---
  // (Aqui se integraran las llamadas a Firebase / API REST de Termales)

  static async _fetchRiskData(context) {
    // Mock / Conector temporal simulado estructurado
    return [
      {
        id: "RSK-001",
        name: "Contaminacion de fuentes hidrotermales por sobreaforo",
        impact: "ALTO",
        probability: "MEDIO",
        residualScore: 16,
        status: "ACTIVO"
      }
    ];
  }

  // En KnowledgeManager.js
static async _fetchControlData(context) {
  return [
    {
      id: "CTR-102",
      name: "Monitoreo automatizado de caudal y temperatura",
      effectiveness: "EFECTIVO",
      type: "DETECTIVO",
      coverage: 0.85,
      description: "Aplica para mitigar el riesgo RSK-001 de sobreaforo en fuentes termales." // <-- Añadir relación
    }
  ];
}

  static async _fetchFindingData(context) {
    return [
      {
        id: "HAL-04",
        title: "Retraso en la calibracion de sensores de presion",
        severity: "MAYOR",
        status: "ABIERTO"
      }
    ];
  }

  static async _fetchPlanData(context) {
    return [
      {
        id: "PLA-09",
        title: "Mantenimiento preventivo e inspeccion del circuito hidraulico",
        progress: 0.60,
        dueDate: "2026-09-30",
        responsible: "Direccion de Operaciones"
      }
    ];
  }

  static async _fetchGovernanceData(context) {
    return [
      {
        id: "POL-01",
        title: "Politica de Gestion de Riesgos Ambientales y Turisticos",
        complianceLevel: "92%",
        standard: "ISO 31000 / ISO 14001"
      }
    ];
  }
}