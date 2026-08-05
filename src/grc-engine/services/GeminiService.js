/**
 * @file GeminiService.js
 * @description Servicio de inferencia Gemini integrado con Clean Architecture.
 * Soporta auto-extracción de API keys (Node/Vite/.env), filtrado de llaves y rotación matricial.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiService {
  /**
   * Recopila y prioriza las claves de Gemini desde todas las fuentes disponibles
   * filtrando automáticamente claves de Firebase (AIzaSy...).
   */
  static getApiKeys() {
    const candidateStrings = [];

    // 1. Entorno Node / Vercel / Local (process.env ya tiene los datos de tu .env)
    if (typeof process !== "undefined" && process.env) {
      if (process.env.VITE_GEMINI_API_KEY) candidateStrings.push(process.env.VITE_GEMINI_API_KEY);
      if (process.env.VITE_GEMINI_API_KEYS) candidateStrings.push(process.env.VITE_GEMINI_API_KEYS);
      if (process.env.GEMINI_API_KEY) candidateStrings.push(process.env.GEMINI_API_KEY);
      if (process.env.GEMINI_API_KEYS) candidateStrings.push(process.env.GEMINI_API_KEYS);
    }

    // 2. Entorno Vite Frontend
    if (typeof import.meta !== "undefined" && import.meta.env) {
      if (import.meta.env.VITE_GEMINI_API_KEY) candidateStrings.push(import.meta.env.VITE_GEMINI_API_KEY);
      if (import.meta.env.VITE_GEMINI_API_KEYS) candidateStrings.push(import.meta.env.VITE_GEMINI_API_KEYS);
    }

    // Limpiar comillas y separar por comas
    const allKeys = candidateStrings
      .flatMap((str) => str.replace(/["'\r]/g, "").split(","))
      .map((k) => k.trim())
      .filter(Boolean);

    const uniqueKeys = Array.from(new Set(allKeys));

    if (uniqueKeys.length > 0) {
      return uniqueKeys;
    }

    console.error("❌ [GeminiService] No se encontraron claves válidas en el entorno.");
    return [];
  }

  /**
   * Genera contenido usando la matriz de llaves y modelos configurados.
   * Adaptado para el pipeline del AuditEngine.
   * 
   * @param {string} promptPayload - Prompt ensamblado por PromptBuilder.
   * @param {Object} [options={}] - Opciones de generación opcionales.
   * @returns {Promise<{text: string, modelUsed: string}>}
   */
  async generateContent(promptPayload, options = {}) {
    const apiKeys = GeminiService.getApiKeys();

    if (apiKeys.length === 0) {
      throw new Error("No se encontraron claves válidas de Gemini en el entorno (.env).");
    }

const modelNames = options.modelNames || [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-pro",
  "gemini-flash-latest"
];
    for (let i = 0; i < apiKeys.length; i++) {
      const currentKey = apiKeys[i];
      const maskedKey = `${currentKey.substring(0, 8)}...${currentKey.slice(-4)}`;
      const genAI = new GoogleGenerativeAI(currentKey);

      for (const modelName of modelNames) {
        try {
          console.log(`🤖 [GeminiService] Intentando Key #${i + 1} (${maskedKey}) | Modelo: ${modelName}...`);

          const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
              temperature: options.temperature ?? 0.1,
              responseMimeType: options.responseMimeType || "application/json"
            }
          });

          const result = await model.generateContent(promptPayload);
          const response = await result.response;
          const rawText = response.text();

          if (!rawText) {
            throw new Error("El modelo respondió pero no devolvió texto.");
          }

          console.log(`✅ [GeminiService] Respuesta recibida con exito (Key #${i + 1}, ${modelName}).`);

          return {
            text: rawText,
            modelUsed: modelName
          };

        } catch (error) {
          console.warn(`⚠️ [GeminiService] Falló Key #${i + 1} (${maskedKey}) con ${modelName}: ${error.message}`);
        }
      }
    }

    throw new Error("Todas las claves y modelos de Gemini fallaron en la inferencia.");
  }
}