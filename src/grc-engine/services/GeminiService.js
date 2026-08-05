/**
 * @file GeminiService.js
 * @description Servicio de inferencia Gemini integrado con Clean Architecture.
 * Soporta auto-extracción de API keys (Node/Vite/.env), filtrado de llaves y rotación matricial.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

export class GeminiService {
  /**
   * Recopila y prioriza las claves de Gemini desde todas las fuentes disponibles
   * filtrando automáticamente claves de Firebase (AIzaSy...).
   */
  static getApiKeys() {
    const candidateStrings = [];

    // 1. Lectura directa del archivo .env en disco (Máxima prioridad para CLI/Node)
    try {
      const envPath = path.resolve(process.cwd(), ".env");
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, "utf-8");
        for (const line of envContent.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (
            trimmed.startsWith("VITE_GEMINI_API_KEY=") ||
            trimmed.startsWith("VITE_GEMINI_API_KEYS=") ||
            trimmed.startsWith("GEMINI_API_KEY=") ||
            trimmed.startsWith("GEMINI_API_KEYS=")
          ) {
            candidateStrings.push(trimmed.substring(trimmed.indexOf("=") + 1).trim());
          }
        }
      }
    } catch (err) {
      // Continuar si falla la lectura directa
    }

    // 2. Entorno Node (process.env)
    if (typeof process !== "undefined" && process.env) {
      if (process.env.VITE_GEMINI_API_KEY) candidateStrings.push(process.env.VITE_GEMINI_API_KEY);
      if (process.env.VITE_GEMINI_API_KEYS) candidateStrings.push(process.env.VITE_GEMINI_API_KEYS);
      if (process.env.GEMINI_API_KEY) candidateStrings.push(process.env.GEMINI_API_KEY);
      if (process.env.GEMINI_API_KEYS) candidateStrings.push(process.env.GEMINI_API_KEYS);
    }

    // 3. Entorno Vite Frontend (import.meta.env)
    if (typeof import.meta !== "undefined" && import.meta.env) {
      if (import.meta.env.VITE_GEMINI_API_KEY) candidateStrings.push(import.meta.env.VITE_GEMINI_API_KEY);
      if (import.meta.env.VITE_GEMINI_API_KEYS) candidateStrings.push(import.meta.env.VITE_GEMINI_API_KEYS);
    }

    // Aplanar, limpiar comillas y separar por comas
    const allKeys = candidateStrings
      .flatMap((str) => str.replace(/["'\r]/g, "").split(","))
      .map((k) => k.trim())
      .filter(Boolean);

    // 🛡️ Filtro estricto: Priorizar únicamente llaves válidas que inicien por AQ.
    const aqKeys = Array.from(new Set(allKeys.filter((key) => key.startsWith("AQ."))));

    if (aqKeys.length > 0) {
      console.log(`🔑 [GeminiService] Se detectaron ${aqKeys.length} clave(s) válidas de Gemini (AQ...).`);
      return aqKeys;
    }

    // Respaldo si no hay prefijo AQ. pero existen claves que no sean AIzaSy
    const validNonFirebaseKeys = Array.from(new Set(allKeys.filter((key) => !key.startsWith("AIzaSy"))));

    if (validNonFirebaseKeys.length > 0) {
      return validNonFirebaseKeys;
    }

    console.error("❌ [GeminiService] No se encontraron claves válidas de Gemini en el entorno.");
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

    const modelNames = options.modelNames || ["gemini-1.5-flash", "gemini-2.0-flash-exp"];

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