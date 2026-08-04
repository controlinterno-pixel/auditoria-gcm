/**
 * @file TechnicalSchema.js
 * @description Extensión del CoreSchema orientada a Auditores y Líderes Normativos.
 */

import { CoreSchema } from './CoreSchema.js';

export const TechnicalSchema = {
  $id: "TechnicalSchema",
  type: "object",
  required: [
    ...CoreSchema.required,
    "gapAnalysis",
    "evidence",
    "isoReferences"
  ],
  properties: {
    ...CoreSchema.properties,
    gapAnalysis: {
      type: "array",
      items: {
        type: "object",
        required: ["currentStatus", "expectedStatus", "remediation"],
        properties: {
          currentStatus: { type: "string" },
          expectedStatus: { type: "string" },
          remediation: { type: "string" }
        }
      }
    },
    evidence: {
      type: "array",
      items: { type: "string" },
      description: "Evidencias documentales o registros revisados."
    },
    isoReferences: {
      type: "array",
      items: {
        type: "object",
        required: ["standard", "clause"],
        properties: {
          standard: { type: "string" },
          clause: { type: "string" }
        }
      }
    }
  }
};