/**
 * @file GeminiService.js
 * @description Servicio enterprise para comunicación con Google Gemini.
 * Soporta rotación multillave (fallback) y formato de respuesta estructurado (CoreSchema).
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// 1. Cargar y procesar el listado de API Keys (soporta una sola key o varias separadas por coma)
const rawKeys = process.env.REACT_APP_GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
const apiKeys = rawKeys ? rawKeys.split(',').map(key => key.trim()).filter(Boolean) : [];

if (apiKeys.length === 0) {
  console.error("[GeminiService Error]: No se encontraron API Keys configuradas en las variables de entorno.");
}

export class GeminiService {
  /**
   * Ejecuta una consulta al modelo Gemini solicitando una respuesta en formato JSON estructurado.
   * Cuenta con un ciclo de Fallback automático para rotar llaves en caso de error/cuota agotada.
   * 
   * @param {Object} params
   * @param {string} params.systemInstruction - Instrucciones de rol/especialista (Prompts .md).
   * @param {string} params.userPrompt - Consulta y datos de contexto inyectados.
   * @param {Object} [params.schema] - Esquema objetivo (ej. ExecutiveSchema) para guiar la salida.
   * @param {string} [params.modelName='gemini-1.5-flash'] - Modelo a utilizar.
   * @returns {Promise<Object>} Objeto con la respuesta raw del LLM y métricas de consumo.
   */
  static async executeQuery({
    systemInstruction,
    userPrompt,
    schema = null,
    modelName = 'gemini-1.5-flash'
  }) {
    const startTime = Date.now();

    if (apiKeys.length === 0) {
      return {
        success: false,
        error: "Sin API Key configurada",
        metrics: { executionTimeMs: 0, tokens: 0, model: modelName }
      };
    }

    // 2. CICLO DE FALLBACK: Intentamos con cada API Key registrada
    for (let i = 0; i < apiKeys.length; i++) {
      try {
        const genAI = new GoogleGenerativeAI(apiKeys[i]);

        const modelConfig = {
          model: modelName,
          systemInstruction: systemInstruction,
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2
          }
        };

        if (schema) {
          modelConfig.generationConfig.responseSchema = schema;
        }

        const model = genAI.getGenerativeModel(modelConfig);
        const result = await model.generateContent(userPrompt);
        const response = await result.response;
        const textResponse = response.text();
        const executionTimeMs = Date.now() - startTime;

        const usageMetadata = response.usageMetadata || {};
        const tokens = usageMetadata.totalTokenCount || 0;

        // Éxito: retornamos la respuesta inmediatamente
        return {
          success: true,
          rawText: textResponse,
          metrics: {
            executionTimeMs,
            tokens,
            model: modelName,
            keyIndexUsed: i + 1
          }
        };

      } catch (error) {
        console.warn(`[GeminiService Warning]: Error al usar Key #${i + 1}: ${error.message}`);

        // Si es la última llave y falló, retornamos el fallo consolidado
        if (i === apiKeys.length - 1) {
          console.error("[GeminiService Error]: Se agotaron todas las API Keys disponibles sin éxito.");
          return {
            success: false,
            error: error.message || "Error general en la API de Gemini",
            metrics: {
              executionTimeMs: Date.now() - startTime,
              tokens: 0,
              model: modelName
            }
          };
        }
      }
    }
  }
}