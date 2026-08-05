// src/grc-engine/schemas/ReportSchema.js
export const ReportSchema = {
  type: "OBJECT",
  properties: {
    encabezado: {
      type: "OBJECT",
      properties: {
        codigo: { type: "STRING" },
        proceso: { type: "STRING" },
        riesgoInherenteLabel: { type: "STRING" },
        riesgoResidualLabel: { type: "STRING" },
        calidadRegistroScore: { type: "NUMBER" }
      },
      required: ["codigo", "proceso", "riesgoInherenteLabel", "riesgoResidualLabel"]
    },
    kpis: {
      type: "OBJECT",
      properties: {
        scoreRiesgo: { type: "NUMBER" },
        scoreMadurez: { type: "NUMBER" },
        totalControles: { type: "NUMBER" },
        coberturaControles: { type: "NUMBER" }
      },
      required: ["scoreRiesgo", "scoreMadurez", "totalControles", "coberturaControles"]
    },
    hallazgos: {
      type: "ARRAY",
      items: { type: "STRING" }
    },
    recomendaciones: {
      type: "ARRAY",
      items: { type: "STRING" }
    },
    planAccion: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          prioridad: { type: "STRING" },
          accion: { type: "STRING" },
          responsable: { type: "STRING" }
        },
        required: ["prioridad", "accion", "responsable"]
      }
    },
    dictamenDirector: { type: "STRING" },
    acordeonesTecnicos: {
      type: "OBJECT",
      properties: {
        analisisMetodologico: { type: "STRING" },
        evaluacionControles: { type: "STRING" },
        krisEvidencias: { type: "STRING" }
      },
      required: ["analisisMetodologico", "evaluacionControles", "krisEvidencias"]
    }
  },
  required: [
    "encabezado", 
    "kpis", 
    "hallazgos", 
    "recomendaciones", 
    "planAccion", 
    "dictamenDirector", 
    "acordeonesTecnicos"
  ]
};