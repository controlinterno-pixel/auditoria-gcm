/**
 * @file PromptAssembler.js
 * @description Ensamblador de prompts enriquecido con Guardrails, Estructura limpia y Esquemas.
 */

import systemAuditorRaw from '../prompts/system/auditor.md?raw';
import guardrailsRaw from '../prompts/system/guardrails.md?raw';

export class PromptAssembler {
  /**
   * Ensambla las instrucciones del sistema en bloques modulares y desacoplados.
   */
  static assembleSystemInstruction({ specialistPrompt = '', taskPrompt = '', schemaDefinition = null }) {
    let instruction = `
${systemAuditorRaw}

---
${guardrailsRaw}
    `;

    if (specialistPrompt) {
      instruction += `\n---\n${specialistPrompt}`;
    }

    if (taskPrompt) {
      instruction += `\n---\n${taskPrompt}`;
    }

    if (schemaDefinition) {
      instruction += `\n---\n## ESTRUCTURA DE SALIDA ESPERADA (JSON SCHEMA):\nDebes responder adaptándote estrictamente a esta estructura:\n${JSON.stringify(schemaDefinition, null, 2)}`;
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