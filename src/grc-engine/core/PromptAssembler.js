/**
 * @file PromptAssembler.js
 * @description Ensamblador de prompts enriquecido con Guardrails y estructura limpia sin dependencias síncronas de disco duro.
 */

const DEFAULT_SYSTEM_AUDITOR = `
Eres el Auditor Principal de Control Interno y GRC para Termales de Santa Rosa de Cabal.
Tu objetivo es evaluar de forma objetiva, rigurosa y bajo metodologías COSO ERM e ISO 31000 los riesgos, controles, hallazgos y planes de acción de la organización.
`;

const DEFAULT_GUARDRAILS = `
GUARDRAILS Y REGLAS DE SEGURIDAD:
1. Responde ÚNICAMENTE basándote en los datos recibidos en el CONTEXTO INTERNO.
2. Si no hay evidencia suficiente en el contexto para fundamentar una respuesta, indícalo expresamente.
3. Devuelve siempre un formato JSON válido y estructurado.
`;

export class PromptAssembler {
  /**
   * Ensambla las instrucciones del sistema en bloques modulares.
   */
  static assembleSystemInstruction({ specialistPrompt = '', taskPrompt = '', schemaDefinition = null }) {
    let instruction = `
${DEFAULT_SYSTEM_AUDITOR}

---
${DEFAULT_GUARDRAILS}
    `;

    if (specialistPrompt) {
      instruction += `\n---\n${specialistPrompt}`;
    }

    if (taskPrompt) {
      instruction += `\n---\n${taskPrompt}`;
    }

    if (schemaDefinition) {
      instruction += `\n---\n## ESTRUCTURA DE SALIDA ESPERADA (JSON SCHEMA):\nDebes responder adaptándote strictly a esta estructura:\n${JSON.stringify(schemaDefinition, null, 2)}`;
    }

    return instruction.trim();
  }

  /**
   * Transforma los datos procesados en un formato de texto estructurado y legible para el LLM.
   */
  static assembleUserPrompt(structuredContext, userQuery) {
    return `
### CONTEXTO DE NEGOCIO PROCESADO:
${structuredContext}

### SOLICITUD DE USUARIO:
${userQuery}
    `.trim();
  }
}