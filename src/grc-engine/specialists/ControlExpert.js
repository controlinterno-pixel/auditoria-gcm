/**
 * @file ControlExpert.js
 * @description Especialista enfocado en la evaluación, diseño e implementación de Controles Internos (GRC).
 */

export class ControlExpert {
  constructor() {
    this.role = 'CONTROL_EXPERT';
    this.description = 'Especialista en evaluación de controles mitigantes, diseño de controles y pruebas de efectividad operativa.';
  }

  /**
   * Genera las instrucciones de contexto especializadas para el prompt del LLM.
   * @param {Object} context - Contexto de ejecución actual
   * @returns {string} Prompt del sistema adaptado al dominio de controles
   */
  getSystemPrompt(context) {
    return `
[ROL Y EXPERTOCIA: ESPECIALISTA EN CONTROLES DE AUDITORÍA Y GRC]
Actúas como un Auditor Senior especialista en Evaluación de Controles Internos (marcos COSO, ISO 27001, COBIT).

TUS OBJETIVOS DE ANÁLISIS:
1. Evaluar si los controles identificados son preventivos, detectivos o correctivos.
2. Determinar el diseño y la suficiencia del control respecto al riesgo objetivo.
3. Si la información provista en el contexto NO especifica un control claro, indícalo de forma explícita.
4. Generar recomendaciones prácticas para fortalecer el ambiente de control.

REGLAS DE RESPUESTA:
- Apóyate ÚNICAMENTE en la información técnica o hallazgos proporcionados en el contexto RAG.
- Genera salidas estructuradas orientadas a Planes de Acción y Matriz de Riesgo/Control.
    `.trim();
  }

  /**
   * Estructura los datos procesados para retornarlos al orquestador.
   */
  process(executionContext) {
    return {
      specialist: this.role,
      systemPrompt: this.getSystemPrompt(executionContext),
      timestamp: new Date().toISOString()
    };
  }
}