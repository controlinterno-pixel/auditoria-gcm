import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. Obtenemos el string gigante con todas las llaves separadas por coma
const rawKeys = import.meta.env.VITE_GEMINI_API_KEY;

if (!rawKeys) {
  console.error("Falta la variable de entorno VITE_GEMINI_API_KEY");
}

// 2. MAGIA: Convertimos ese string en un arreglo (Array) de llaves individuales
const apiKeys = rawKeys ? rawKeys.split(',').map(key => key.trim()) : [];

// src/services/gemini.js

export const consultarCopilotoIA = async (preguntaUsuario, contextoDatos) => {
  try {
    console.log("🚀 Enviando consulta a Vercel Serverless Function (/api/audit)...");

    // 🎯 Ahora la URL es relativa y corre en el mismo dominio HTTPS de Vercel
    const response = await fetch('/api/audit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: preguntaUsuario,
        datosContexto: contextoDatos,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || `Error HTTP ${response.status}`);
    }

    const result = await response.json();
    return result.respuesta || result;

  } catch (error) {
    console.error("❌ Error al conectar con el asistente Serverless:", error);
    throw new Error(`Falló la conexión con el Motor GRC: ${error.message}`);
  }
};