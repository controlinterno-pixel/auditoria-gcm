/**
 * @file DashboardSchema.js
 * @description Extensión del CoreSchema orientada al renderizado de componentes e hilos visuales en React.
 */

import { CoreSchema } from './CoreSchema.js';
import { TrendDirection } from './constants.js';

export const DashboardSchema = {
  $id: "DashboardSchema",
  type: "object",
  required: [
    ...CoreSchema.required,
    "widgets",
    "charts",
    "cards"
  ],
  properties: {
    ...CoreSchema.properties,
    widgets: {
      type: "array",
      items: {
        type: "object",
        required: ["type", "title", "value"],
        properties: {
          type: { type: "string" },
          title: { type: "string" },
          value: { type: "string" },
          trend: { type: "string", enum: Object.values(TrendDirection) }
        }
      }
    },
    charts: {
      type: "array",
      items: { type: "object" },
      description: "Estructuras de datos compatibles con librerias de graficos (ej. Recharts)."
    },
    cards: {
      type: "array",
      items: { type: "object" },
      description: "Coleccion de elementos visuales secundarios."
    }
  }
};