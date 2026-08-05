/**
 * @file PromptBuilder.js
 * @description Conector entre el AuditEngine y el PromptAssembler.
 */
import { PromptAssembler } from './PromptAssembler.js';

export class PromptBuilder {
  /**
   * Construye el prompt final unificando instrucciones y contexto.
   * @param {Object} context - ExecutionContext del pipeline
   * @returns {string} Prompt final ensamblado para Gemini
   */
  static build(context) {
    const systemInstruction = PromptAssembler.assembleSystemInstruction({
      specialistPrompt: context.classification?.domainPrompt || '',
      taskPrompt: context.classification?.intentPrompt || '',
      schemaDefinition: context.classification?.outputSchema || null
    });

    const userPrompt = PromptAssembler.assembleUserPrompt(
      context.knowledge?.retrievedContext || '',
      context.request?.userQuery || ''
    );

    return `${systemInstruction}\n\n${userPrompt}`;
  }
}