/**
 * Master Schema Oficial - GRC Analysis Engine
 * Alineado con ModalIA.jsx y la generación del PDF Ejecutivo.
 */
export const CoreSchema = {
  $id: "CoreSchema",
  type: "object",
  required: ["encabezado", "kpis", "dictamen"],
  properties: {
    encabezado: {
      type: "object",
      required: ["codigo", "titulo", "calidad"],
      properties: {
        codigo: { type: "string", description: "Código del reporte, ej: RSK-189 o MATRIZ-GLOBAL" },
        titulo: { type: "string", description: "Título ejecutivo del panel" },
        calidad: { type: "number", description: "Puntaje de calidad del informe (0 a 100)" }
      }
    },
    kpis: {
      type: "object",
      required: ["scoreRiesgo", "scoreMadurez", "totalControles", "coberturaControles", "calidad"],
      properties: {
        scoreRiesgo: { type: "number", description: "Porcentaje de score residual real/calculado" },
        scoreMadurez: { type: "number", description: "Porcentaje de madurez de controles" },
        totalControles: { type: "number", description: "Cantidad total de controles asociados" },
        coberturaControles: { type: "number", description: "Porcentaje de mitigación o cobertura lograda" },
        calidad: { type: "number", description: "Puntaje de calidad de la matriz" }
      }
    },
    dictamen: {
      type: "string",
      description: `Texto en Markdown que DEBE incluir obligatoriamente las siguientes secciones separadas por encabezados:
      - A HALLAZGOS
      - RECOMENDACIONES
      - PLAN DE ACCIÓN INMEDIATO
      - DICTAMEN DEL DIRECTOR
      - ▼Análisis Metodológico ISO 31000
      - ▼ Evaluación de Controles & COSO ERM
      -  KRIs, Monitoreo y Evidencias`
    }
  }
};