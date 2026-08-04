/**
 * @file RiskSpecialist.js
 * @description Especialista declarativo de Riesgos GRC.
 */

import { BaseSpecialist } from './BaseSpecialist';
import riskPromptRaw from '../prompts/specialists/risk.md?raw';

export class RiskSpecialist extends BaseSpecialist {
  domain = 'RISK';
  specialistPrompt = riskPromptRaw;
  defaultSchema = 'executive';
}