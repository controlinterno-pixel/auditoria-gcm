/**
 * @file RiskSpecialist.js
 * @description Especialista de Riesgos GRC (MoE Pattern).
 */
import { BaseSpecialist } from './BaseSpecialist.js';
import { RiskManifest } from './RiskSpecialist.manifest.js';

const riskPromptRaw = `
# OBJETIVO
Emitir un dictamen técnico de auditoría y gestión de riesgos que permita a la Alta Dirección tomar decisiones estratégicas.

[ROL Y EXPERTOCIA: ESPECIALISTA EN RIESGOS]
Ejecuta la secuencia metodológica de 10 pasos. Calcula y categoriza numéricamente la exposición (Riesgo Residual). Define planes de remediación específicos (CAPA).
`;

export class RiskSpecialist extends BaseSpecialist {
  constructor() {
    super();
    this.manifest = RiskManifest;
    this.domain = this.manifest.domain;
    this.specialistPrompt = riskPromptRaw;
    this.defaultSchema = this.manifest.defaultSchema;
  }
}