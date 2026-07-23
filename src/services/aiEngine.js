import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. Configuración del cliente Gemini
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("⚠️ Falta la variable de entorno VITE_GEMINI_API_KEY");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// 2. Capa de Sistema
const SYSTEM_PROMPT = `
Eres un Director de Auditoría Interna y Riesgos (GRC Copilot) de nivel Executive / Senior Consultant.
Tu objetivo es realizar evaluaciones metodológicas, objetivas y de alto impacto sobre los riesgos de la organización.
Usa terminología técnica alineada a marcos internacionales (ISO 31000, COSO ERM).
Tu tono es analítico, formal, directo y orientado a la toma de decisiones ejecutivas.
`;

// 3. Capa de Módulo
const buildRiskContextPrompt = (riesgo) => {
  return `
Petición de Análisis de Riesgo Individual:
- ID/Código del Riesgo: ${riesgo.id || 'N/A'}
- Nombre del Riesgo: ${riesgo.nombre || riesgo.riesgo || 'Sin nombre'}
- Proceso / Área: ${riesgo.proceso || 'No especificado'}
- Descripción / Causa: ${riesgo.descripcion || 'Sin descripción'}
- Impacto Registrado: ${riesgo.impacto || 'N/A'}
- Probabilidad Registrada: ${riesgo.probabilidad || 'N/A'}
- Nivel de Riesgo Calculado: ${riesgo.nivelRiesgo || riesgo.clasificacion || 'N/A'}
- Controles Actuales: ${riesgo.controles || 'No especificados'}
`;
};

// 4. Capa de Salida
const OUTPUT_FORMAT_INSTRUCTIONS = `
INSTRUCCIONES DE FORMATO OBLIGATORIAS:
Estructura tu dictamen utilizando estrictamente el siguiente formato Markdown:

## 📊 Dictamen Profesional de Riesgo

### 1. Evaluación Técnica
- **Alineación con Metodología:** (Evalúa la coherencia entre causa, impacto y probabilidad)
- **Brechas Identificadas:** (Lista 2 o 3 vacíos clave en los controles o en la redacción)

### 2. Clasificación Sugerida
- **Criticidad Estimada:** (Crítico / Alto / Medio / Bajo)
- **Justificación:** (Breve argumento técnico)

### 3. Plan de Acción Recomendado
1. (Acción preventiva/correctiva inmediata)
2. (Monitoreo o indicador sugerido)
`;

/**
 * Función principal que llama a la API real de Gemini
 */
export const analizarRiesgoConIA = async (datosRiesgo) => {
  try {
    const fullPrompt = `
${SYSTEM_PROMPT}

${buildRiskContextPrompt(datosRiesgo)}

${OUTPUT_FORMAT_INSTRUCTIONS}
`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    
    return response.text();
  } catch (error) {
    console.error("Error al consultar Gemini en aiEngine:", error);
    throw new Error("No se pudo obtener el análisis de Gemini. Verifica tu conexión o API Key.");
  }
};

// 🌟 ESTA LÍNEA ES LA QUE SOLUCIONA EL ERROR DE VERCEL
export const generarPromptDictamenRiesgo = analizarRiesgoConIA;