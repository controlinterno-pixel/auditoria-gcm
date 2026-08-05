/**
 * @file RiskSpecialist.js
 * @description Especialista de Riesgos GRC (MoE Pattern).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BaseSpecialist } from './BaseSpecialist.js';
import { RiskManifest } from './RiskSpecialist.manifest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const promptPath = path.resolve(__dirname, '../prompts/specialists/risk.md');
const riskPromptRaw = fs.existsSync(promptPath) 
  ? fs.readFileSync(promptPath, 'utf-8') 
  : '';

export class RiskSpecialist extends BaseSpecialist {
  constructor() {
    super();
    this.manifest = RiskManifest;
    this.domain = this.manifest.domain;
    this.specialistPrompt = riskPromptRaw;
    this.defaultSchema = this.manifest.defaultSchema;
  }
}