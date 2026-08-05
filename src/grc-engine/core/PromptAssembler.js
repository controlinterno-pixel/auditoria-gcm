import { SchemaSerializer } from '../serializers/SchemaSerializer.js';
import { ContextRanker } from '../rankers/ContextRanker.js';

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
   * Ensambla el prompt con contrato SSOT estricto y compresión inteligente de contexto.
   */
  static assemble({ targetSchema, structuredContext, userQuery, rawFindings = [] }) {
    // 1. Priorizar hallazgos con ContextRanker (Top 6 críticos)
    const topFindings = ContextRanker.rankHallazgos(rawFindings, 6);

    // 2. Serializar el contrato dinámicamente desde la Única Fuente de Verdad (SSOT)
    const serializedContract = SchemaSerializer.serialize(targetSchema);

    const systemPrompt = `
${DEFAULT_SYSTEM_AUDITOR}

${DEFAULT_GUARDRAILS}

=== CONTRATO ESTRICTO DE SALIDA (SSOT) ===
Debes responder ÚNICAMENTE con un objeto JSON válido que cumpla exactamente la siguiente estructura:
${serializedContract}
`.trim();

    const userPrompt = `
=== CONTEXTO TÉCNICO EVALUADO ===
${structuredContext}

=== TOP HALLAZGOS CRÍTICOS PRIORIZADOS ===
${JSON.stringify(topFindings, null, 2)}

=== SOLICITUD DEL USUARIO ===
${userQuery}
`.trim();

    return `${systemPrompt}\n\n---\n\n${userPrompt}`;
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