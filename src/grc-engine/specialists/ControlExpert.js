/**
 * @file ControlExpert.js
 * @description Especialista enfocado en la evaluación, diseño e implementación de Controles Internos (GRC).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BaseSpecialist } from './BaseSpecialist.js';

// Rutas para Node ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Asumimos que crearás este archivo markdown en la carpeta de prompts
const promptPath = path.resolve(__dirname, '../prompts/specialists/control.md');
const controlPromptRaw = fs.existsSync(promptPath) 
  ? fs.readFileSync(promptPath, 'utf-8') 
  : `
[ROL Y EXPERTOCIA: ESPECIALISTA EN CONTROLES DE AUDITORÍA Y GRC]
Actúas como un Auditor Senior especialista en Evaluación de Controles Internos (marcos COSO, ISO 27001, COBIT).
TUS OBJETIVOS DE ANÁLISIS:
1. Evaluar si los controles identificados son preventivos, detectivos o correctivos.
2. Determinar el diseño y la suficiencia del control respecto al riesgo objetivo.
`; // Fallback en caso de que el archivo md no exista aún

export class ControlExpert extends BaseSpecialist {
  domain = 'CONTROL';
  specialistPrompt = controlPromptRaw;
  defaultSchema = 'TechnicalSchema'; 
}