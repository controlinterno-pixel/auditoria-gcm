/**
 * @file ExecutiveSchema.js
 * @description Extensión del CoreSchema orientada a Alta Gerencia y Junta Directiva.
 */

import { CoreSchema } from './CoreSchema.js';
import { ImpactLevel } from './constants.js';

export const ExecutiveSchema = {
  $id: "ExecutiveSchema",
  type: "object",
  required: [
    ...CoreSchema.required,
    "strategicImpact",
    "executiveConclusion",
    "kpis"
  ],
  properties: {
    ...CoreSchema.properties,
    strategicImpact: {
      type: "string",
      enum: Object.values(ImpactLevel)
    },
    executiveConclusion: {
      type: "string",
      description: "Sintesis estrategica final para toma de decisiones."
    },
    kpis: {
      type: "array",
      items: {
        type: "object",
        required: ["label", "value"],
        properties: {
          label: { type: "string" },
          value: { type: "string" }
        }
      }
    }
  }
};