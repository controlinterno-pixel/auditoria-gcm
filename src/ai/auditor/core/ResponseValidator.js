/**
 * @file ResponseValidator.js
 * @description Validador estricto de esquemas JSON para respuestas del Motor GRC.
 * Garantiza la integridad de la estructura de datos para la UI.
 */

export class ResponseValidator {
  /**
   * Valida y sanitiza la respuesta generada por la IA.
   * @param {string|Object} rawResponse - Respuesta sin procesar devuelta por el modelo.
   * @param {string} targetSchema - Nombre del esquema que debe cumplir (ej. 'DashboardSchema').
   * @returns {Object} Respuesta validada y parseada con flag de éxito/error.
   */
  static validate(rawResponse, targetSchema) {
    let parsedData = null;

    // 1. Intentar parsear a JSON si la respuesta viene como string
    try {
      if (typeof rawResponse === 'string') {
        // Limpiar posible formato Markdown de bloque de código ```json ... ```
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

    // 2. Validar estructura genérica mínima obligatoria
    const hasRequiredBaseKeys = parsedData && 
      typeof parsedData.summary === 'string' &&
      Array.isArray(parsedData.keyInsights) &&
      parsedData.metadata !== undefined;

    if (!hasRequiredBaseKeys) {
      console.warn("[ResponseValidator Warning]: Estructura base incompleta.", parsedData);
      return this._buildErrorPayload(`El JSON devuelto no cumple con la estructura base obligatoria (${targetSchema}).`, parsedData);
    }

    // 3. Respuesta exitosa con esquema garantizado
    return {
      isValid: true,
      schema: targetSchema,
      data: parsedData,
      validatedAt: new Date().toISOString()
    };
  }

  /**
   * Helper privado para retornar respuestas de error estandarizadas.
   */
  static _buildErrorPayload(errorMessage, rawContent) {
    return {
      isValid: false,
      schema: 'ErrorFallback',
      error: errorMessage,
      rawContent,
      data: {
        summary: "Se generó una respuesta pero no cumple con los estándares de validación de la plataforma.",
        keyInsights: ["Error de validación de contrato JSON."],
        metadata: { status: "VALIDATION_FAILED" }
      },
      validatedAt: new Date().toISOString()
    };
  }
}