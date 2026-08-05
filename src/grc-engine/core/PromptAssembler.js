/**
 * @file PromptAssembler.js
 * @description Ensamblador de prompts enriquecido con Guardrails, Estructura limpia y Esquemas.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Obtener la ruta del directorio actual en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar prompts síncronamente desde el sistema de archivos
const systemAuditorPath = path.resolve(__dirname, '../prompts/system/auditor.md');
const guardrailsPath = path.resolve(__dirname, '../prompts/system/guardrails.md');

const systemAuditorRaw = fs.existsSync(systemAuditorPath) 
  ? fs.readFileSync(systemAuditorPath, 'utf-8') 
  : '';

const guardrailsRaw = fs.existsSync(guardrailsPath) 
  ? fs.readFileSync(guardrailsPath, 'utf-8') 
  : '';

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