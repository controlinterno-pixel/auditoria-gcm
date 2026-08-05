/**
 * @file PromptBuilder.js
 * @description Ensambla el prompt final combinando instrucciones, contexto RAG, esquemas JSON y reglas estrictas.
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

    // 2. Ensamblamos el Prompt exigiendo la estructura del CoreSchema
    const assembledPrompt = `
INSTRUCCIONES DEL ESPECIALISTA:
${manifest.specialistPrompt || 'Eres un asistente experto en GRC.'}

REGLA ESTRICTA DE LA PLATAFORMA:
Eres un motor de respuestas cerrado. Responde ÚNICAMENTE utilizando los datos proporcionados en la sección "CONTEXTO INTERNO". 
Si la respuesta a la consulta no se puede deducir del contexto interno, responde exactamente: "No cuento con información en la plataforma para responder a esto."
Bajo ninguna circunstancia debes usar conocimientos externos o inventar datos.

FORMATO OBLIGATORIO DE RESPUESTA (JSON):
Debes responder con un único objeto JSON que contenga exactamente los siguientes campos base:
- "title": (string) Título del análisis.
- "summary": (string) Resumen ejecutivo del resultado.
- "confidence": (number) Puntuación de confianza entre 0.0 y 1.0.
- "priority": (string) Uno de: "LOW", "MEDIUM", "HIGH", "URGENT".
- "findings": (array de strings) Lista de hallazgos clave deducidos del contexto.
- "recommendations": (array de strings) Recomendaciones concretas.
- "references": (array de strings) Identificadores de las entidades usadas (ej: ["RSK-001"]).
- "metadata": (object) Con las llaves: {"timestamp": "${new Date().toISOString()}", "model": "gemini-2.5-flash", "specialist": "${manifest.name || 'GRC'}", "intent": "${context.classification.intent}", "domain": "${context.classification.domain}", "tokens": 0, "executionTimeMs": 0}

CAMPOS ADICIONALES PARA DASHBOARD:
- "widgets": (array de objetos con {"type": string, "title": string, "value": string})
- "charts": (array de objetos)
- "cards": (array de objetos)

CONTEXTO INTERNO (RAG):
${context.knowledge.retrievedContext || "No se encontró información relevante en la plataforma."}

CONSULTA DEL USUARIO:
${context.request.userQuery}
`;

    return assembledPrompt.trim();
  }
}