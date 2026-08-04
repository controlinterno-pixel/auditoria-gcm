/**
 * @file CoreSchema.js
 * @description Lenguaje interno universal del Motor GRC.
 * Todos los esquemas especializados heredan de esta estructura base.
 */

import { ImpactLevel, PriorityLevel } from './constants.js';

export const CoreSchema = {
  $id: "CoreSchema",
  type: "object",
  required: [
    "title",
    "summary",
    "confidence",
    "priority",
    "findings",
    "recommendations",
    "references",
    "metadata"
  ],
  properties: {
    title: {
      type: "string",
      description: "Titulo descriptivo del analisis realizado por la IA."
    },
    summary: {
      type: "string",
      description: "Resumen ejecutivo o respuesta principal simplificada."
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description: "Grado de certeza del modelo sobre la respuesta (0.0 a 1.0)."
    },
    priority: {
      type: "string",
      enum: Object.values(PriorityLevel),
      description: "Prioridad asignada al resultado."
    },
    findings: {
      type: "array",
      items: { type: "string" },
      description: "Puntos clave o hallazgos especificos identificados."
    },
    recommendations: {
      type: "array",
      items: { type: "string" },
      description: "Acciones recomendadas derivadas del analisis."
    },
    references: {
      type: "array",
      items: { type: "string" },
      description: "Trazabilidad de entidades GRC o normas consultadas (ej. RSK-001, ISO 31000:2018)."
    },
    metadata: {
      type: "object",
      required: [
        "timestamp",
        "model",
        "specialist",
        "intent",
        "domain",
        "tokens",
        "executionTimeMs"
      ],
      properties: {
        timestamp: { type: "string" },
        model: { type: "string" },
        specialist: { type: "string" },
        intent: { type: "string" },
        domain: { type: "string" },
        tokens: { type: "number" },
        executionTimeMs: { type: "number" }
      }
    }
  }
};