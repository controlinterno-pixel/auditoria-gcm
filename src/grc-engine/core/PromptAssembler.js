/**
 * @file PromptAssembler.js
 * @description Ensamblador de prompts enriquecido con Guardrails.
 * Desacoplado de archivos externos inexistentes para evitar fallos de resolución ESM en Vercel.
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

/**
 * Ordena y filtra los hallazgos más críticos sin requerir ContextRanker externo.
 */
function rankHallazgos(findings = [], limit = 6) {
  if (!Array.isArray(findings)) return [];
  const severityWeight = {
    CRITICAL: 4, CRITICO: 4,
    HIGH: 3, ALTO: 3,
    MEDIUM: 2, MEDIO: 2,
    LOW: 1, BAJO: 1
  };

  return [...findings]
    .sort((a, b) => {
      const weightA = severityWeight[String(a.severity || a.severidad || '').toUpperCase()] || 0;
      const weightB = severityWeight[String(b.severity || b.severidad || '').toUpperCase()] || 0;
      return weightB - weightA;
    })
    .slice(0, limit);
}

/**
 * Convierte el esquema objetivo a JSON legible sin requerir SchemaSerializer externo.
 */
function serializeSchema(schema) {
  if (!schema) return "{}";
  return typeof schema === 'string' ? schema : JSON.stringify(schema, null, 2);
}

export class PromptAssembler {
  /**
   * Ensambla el prompt con contrato SSOT estricto y compresión inteligente de contexto.
   */
  static assemble({ targetSchema, structuredContext, userQuery, rawFindings = [] }) {
    // 1. Priorizar hallazgos más críticos
    const topFindings = rankHallazgos(rawFindings, 6);

    // 2. Serializar el contrato de salida
    const serializedContract = serializeSchema(targetSchema);

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