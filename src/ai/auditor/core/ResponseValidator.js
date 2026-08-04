/**
 * @file ResponseValidator.js
 * @description Validador de contratos JSON estructurados basados en CoreSchema y sus extensiones.
 */

import { CoreSchema } from '../schemas/CoreSchema.js';

export class ResponseValidator {
  /**
   * Valida la estructura devuelta por el LLM.
   * @param {string|Object} rawResponse 
   * @param {Object} targetSchema - Esquema objetivo (ej. ExecutiveSchema).
   * @returns {Object}
   */
  static validate(rawResponse, targetSchema) {
    let parsedData = null;

    try {
      if (typeof rawResponse === 'string') {
        const cleanedString = rawResponse
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .trim();
        parsedData = JSON.parse(cleanedString);
      } else {
        parsedData = rawResponse;
      }
    } catch (parseError) {
      console.error("[ResponseValidator Error]: Fallo al parsear JSON.", parseError);
      return this._buildErrorPayload("La respuesta generada no tiene un formato JSON válido.", rawResponse);
    }

    // 1. Validar el contrato Core obligatoriamente
    const coreKeys = CoreSchema.required;
    const missingCoreKeys = coreKeys.filter(key => !(key in parsedData));

    if (missingCoreKeys.length > 0) {
      console.warn("[ResponseValidator Warning]: Incumplimiento del CoreSchema. Faltan claves:", missingCoreKeys);
      return this._buildErrorPayload(
        `La respuesta incumple el contrato base (CoreSchema). Claves faltantes: ${missingCoreKeys.join(', ')}`,
        parsedData
      );
    }

    // 2. Validar extensiones específicas del esquema objetivo si aplica
    if (targetSchema && targetSchema.required) {
      const missingTargetKeys = targetSchema.required.filter(key => !(key in parsedData));
      if (missingTargetKeys.length > 0) {
        console.warn(`[ResponseValidator Warning]: Incumplimiento de ${targetSchema.$id}. Faltan:`, missingTargetKeys);
        return this._buildErrorPayload(
          `La respuesta incumple el contrato especializado (${targetSchema.$id}). Claves faltantes: ${missingTargetKeys.join(', ')}`,
          parsedData
        );
      }
    }

    return {
      isValid: true,
      schema: targetSchema?.$id || "CoreSchema",
      data: parsedData,
      validatedAt: new Date().toISOString()
    };
  }

  static _buildErrorPayload(errorMessage, rawContent) {
    return {
      isValid: false,
      schema: 'ErrorFallback',
      error: errorMessage,
      rawContent,
      data: {
        title: "Error de Validación de Contrato",
        summary: "Se generó una respuesta pero no cumple con los estándares de integridad GRC de la plataforma.",
        confidence: 0.0,
        priority: "URGENT",
        findings: ["Error en la validación del protocolo JSON."],
        recommendations: ["Revisar el prompt del especialista o reintentar la consulta."],
        references: [],
        metadata: {
          timestamp: new Date().toISOString(),
          model: "N/A",
          specialist: "N/A",
          intent: "N/A",
          domain: "N/A",
          tokens: 0,
          executionTimeMs: 0
        }
      },
      validatedAt: new Date().toISOString()
    };
  }
}