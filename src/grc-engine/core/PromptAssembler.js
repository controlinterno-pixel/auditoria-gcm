/**
 * @file PromptAssembler.js
 * @description Ensamblador de prompts con simplificación de esquemas para evitar que la IA devuelva el meta-esquema.
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
 * Convierte un JSON Schema con "properties" en un ejemplo de objeto con valores a llenar.
 * Esto evita que la IA devuelva los atributos "type", "description" o "properties".
 */
function serializeSchemaToExample(schema) {
  if (!schema) return "{}";

  if (schema.properties) {
    const example = {};
    for (const [key, prop] of Object.entries(schema.properties)) {
      if (prop.type === "string") example[key] = `<Texto descriptivo para ${key}>`;
      else if (prop.type === "number") example[key] = 0.95;
      else if (prop.type === "array") example[key] = [`<Elemento 1 de ${key}>`];
      else if (prop.type === "object") example[key] = {};
      else example[key] = `<Valor para ${key}>`;
    }
    return JSON.stringify(example, null, 2);
  }

  return typeof schema === 'string' ? schema : JSON.stringify(schema, null, 2);
}

export class PromptAssembler {
  static assemble({ targetSchema, structuredContext, userQuery, rawFindings = [] }) {
    const topFindings = rankHallazgos(rawFindings, 6);
    const serializedContract = serializeSchemaToExample(targetSchema);

    const systemPrompt = `
${DEFAULT_SYSTEM_AUDITOR}

${DEFAULT_GUARDRAILS}

=== CONTRATO ESTRICTO DE SALIDA (ESTRUCURA OBLIGATORIA) ===
No devuelvas metadatos de esquema ni tipos de datos. Llena la siguiente estructura con tu análisis real en formato JSON:
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

  static assembleUserPrompt(structuredContext, userQuery) {
    return `
### CONTEXTO DE NEGOCIO PROCESADO:
${structuredContext}

### SOLICITUD DE USUARIO:
${userQuery}
    `.trim();
  }
}