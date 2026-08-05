/**
 * @file PromptBuilder.js
 * @description Ensambla el prompt final combinando instrucciones, contexto RAG y reglas estrictas.
 */

import { RiskSpecialist } from '../specialists/RiskSpecialist.js';
import { BaseSpecialist } from '../specialists/BaseSpecialist.js';

export class PromptBuilder {
  /**
   * Construye el payload de texto que se enviará al LLM.
   * @param {ExecutionContext} context - El contexto actual de la ejecución.
   * @returns {string} El prompt final ensamblado.
   */
  static build(context) {
    let specialist;
    
    // 1. Seleccionamos el especialista según el dominio detectado
    if (context.classification.domain === 'RISK') {
      specialist = new RiskSpecialist();
    } else {
      specialist = new BaseSpecialist();
    }

    const manifest = specialist.getManifest();

    // 2. Ensamblamos el Prompt con la REGLA ESTRICTA de no usar datos externos
    const assembledPrompt = `
INSTRUCCIONES DEL ESPECIALISTA:
${manifest.specialistPrompt || 'Eres un asistente experto en GRC.'}

REGLA ESTRICTA DE LA PLATAFORMA:
Eres un motor de respuestas cerrado. Responde ÚNICAMENTE utilizando los datos proporcionados en la sección "CONTEXTO INTERNO". 
Si la respuesta a la consulta no se puede deducir del contexto interno, responde exactamente: "No cuento con información en la plataforma para responder a esto."
Bajo ninguna circunstancia debes usar conocimientos externos o inventar datos.

CONTEXTO INTERNO (RAG):
${context.knowledge.retrievedContext}

CONSULTA DEL USUARIO:
${context.request.userQuery}
`;

    return assembledPrompt.trim();
  }
}