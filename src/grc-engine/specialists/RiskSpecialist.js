/**
 * @file RiskSpecialist.js
 * @description Especialista declarativo de Riesgos GRC.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BaseSpecialist } from './BaseSpecialist.js';

// Rutas para Node ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const promptPath = path.resolve(__dirname, '../prompts/specialists/risk.md');
const riskPromptRaw = fs.existsSync(promptPath) 
  ? fs.readFileSync(promptPath, 'utf-8') 
  : '';

export class RiskSpecialist extends BaseSpecialist {
  domain = 'RISK';
  specialistPrompt = riskPromptRaw;
defaultSchema = 'DashboardSchema';
}