/**
 * @file RiskSpecialist.manifest.js
 * @description Contrato de datos y metadatos para el Especialista de Riesgos.
 */
export const RiskManifest = {
  domain: "RISK",
  supportedIntents: ["ANALYZE", "COMPARE", "SUMMARIZE", "EVALUATE"],
  supportedSchemas: ["ExecutiveSchema", "TechnicalSchema", "DashboardSchema"],
  requiredContext: ["riesgos", "controles", "hallazgos"],
  requiredFields: [
    "id",
    "descripcion",
    "probabilidadResidual",
    "impactoResidual",
    "proceso",
    "noControl",
    "descripcionControl"
  ],
  defaultSchema: "DashboardSchema"
};