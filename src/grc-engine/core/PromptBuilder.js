/**
 * @file PromptBuilder.js
 * @description Enrutador Inteligente (MoE). Conecta la intención del usuario con el Especialista adecuado.
 */

import { RiskSpecialist } from '../specialists/RiskSpecialist.js';
import { ControlExpert } from '../specialists/ControlExpert.js';
import { BaseSpecialist } from '../specialists/BaseSpecialist.js';

export class PromptBuilder {
  static build(context) {
    const domain = context.classification.domain;
    let specialist;

    // 🧠 1. ENRUTADOR (ROUTER MOE)
    switch (domain) {
      case 'RISK':
        specialist = new RiskSpecialist();
        break;
      case 'CONTROL':
        specialist = new ControlExpert();
        break;
      default:
        specialist = new BaseSpecialist();
    }

    const manifest = specialist.getManifest();

    // 2. CONSTRUIR HISTORIAL DE MEMORIA
    let historySection = "";
    const history = context.memory?.chatHistory || [];
    if (history.length > 0) {
      historySection = "HISTORIAL DE CONVERSACIÓN (Contexto Previo):\n";
      history.forEach(msg => {
        const role = msg.role === 'user' ? 'Auditor' : 'Motor GRC';
        historySection += `- ${role}: ${msg.content}\n`;
      });
      historySection += "\n";
    }

    // 3. ENSAMBLAR EL SÚPER PROMPT DINÁMICO
    return `
ROL Y PERSONA:
${manifest.specialistPrompt}

REGLA DE ORO DE PLATAFORMA (CERTEZA Y EVIDENCIA):
Responde ÚNICAMENTE fundamentándote en la información proporcionada en "CONTEXTO INTERNO". 
Si la información no es suficiente para responder la pregunta, responde textualmente: "No cuento con información en la plataforma para responder a esto."
No inventes datos ni asumas situaciones que no estén respaldadas por los códigos de las entidades recibidas.
DEBES incluir explícitamente el arreglo de códigos de las entidades evaluadas en "references". NUNCA devuelvas "S/C" si existe un código.

FORMATO OBLIGATORIO DE RESPUESTA (JSON):
Devuelve EXCLUSIVAMENTE un objeto JSON válido. Asegúrate de estructurarlo mentalmente basándote en el esquema: ${manifest.defaultSchema}.
{
  "title": "Título Diagnóstico Profesional",
  "summary": "Resumen ejecutivo formal...",
  "confidence": 1.0,
  "priority": "HIGH" | "URGENT" | "MEDIUM" | "LOW",
  "findings": [
    "Hallazgo 1 estructurado con código y detalle..."
  ],
  "recommendations": [
    "Recomendación estratégica 1..."
  ],
  "references": ["HAL-04", "RSK-001"],
  "metadata": {
    "timestamp": "${new Date().toISOString()}",
    "model": "gemini-2.5-flash",
    "specialist": "${manifest.domain}",
    "intent": "${context.classification.intent}",
    "domain": "${context.classification.domain}",
    "tokens": 0,
    "executionTimeMs": 0
  },
  "widgets": [
    {"type": "severity", "title": "Criticidad del Evento", "value": "ALTA / MAYOR"},
    {"type": "status", "title": "Estado de Remediación", "value": "ABIERTO - REQUIERE ACCIÓN"}
  ],
  "charts": [],
  "cards": []
}

CONTEXTO INTERNO (RAG EVIDENCIA):
${context.knowledge.retrievedContext || "No se encontró información relevante en la plataforma."}

${historySection}
CONSULTA DEL AUDITOR:
${context.request.userQuery}
`.trim();
  }
}