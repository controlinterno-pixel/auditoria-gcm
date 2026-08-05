import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeminiService } from "../services/GeminiService.js";

async function checkAvailableModels() {
  console.log("🔍 Diagnosticando modelos disponibles para tus API Keys...\n");

  const keys = GeminiService.getApiKeys();

  if (keys.length === 0) {
    console.error("❌ No se encontraron claves válidas en el .env");
    return;
  }

  // Probamos la primera clave válida
  const apiKey = keys[0];
  const maskedKey = `${apiKey.substring(0, 8)}...${apiKey.slice(-4)}`;
  console.log(`🔑 Utilizando Key: ${maskedKey}`);

  try {
    // Para listar modelos usamos un fetch directo a la API con tu clave
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const data = await response.json();

    if (data.error) {
      console.error("❌ Error de la API de Google:", data.error.message);
      return;
    }

    console.log("\n📋 **MODELOS DISPONIBLES PARA TU CUENTA:**");
    console.log("--------------------------------------------------");

    const generateModels = data.models
      .filter((m) => m.supportedGenerationMethods.includes("generateContent"))
      .map((m) => m.name.replace("models/", ""));

    generateModels.forEach((modelName) => {
      console.log(`  • ${modelName}`);
    });

    console.log("--------------------------------------------------");
    console.log(`\n✅ Copia cualquiera de los nombres listados arriba en tu GeminiService.`);

  } catch (error) {
    console.error("❌ Error al consultar la lista de modelos:", error.message);
  }
}

checkAvailableModels();