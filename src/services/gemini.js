import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("Falta la variable de entorno VITE_GEMINI_API_KEY");
}

// Inicializamos el SDK de Google
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// ¡AQUÍ ESTABA LA MAGIA! Usamos el modelo exacto que tienes habilitado
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// 1. Función para el Copiloto IA (Chat)
export const consultarCopilotoIA = async (preguntaUsuario, contextoDatos) => {
  try {
    // LA MAGIA ESTÁ AQUÍ: Convertimos el objeto de datos a texto legible para la IA
    const contextoLegible = typeof contextoDatos === 'object' 
      ? JSON.stringify(contextoDatos, null, 2) 
      : contextoDatos;

    const prompt = `
    Eres 'Auditor IA', un asistente experto en auditoría, GRC y control interno.
    Tu objetivo es ayudar al usuario analizando los datos del sistema y respondiendo sus dudas.
    
    DATOS DE CONTEXTO DEL SISTEMA ACTUAL:
    ${contextoLegible}
    
    PREGUNTA DEL USUARIO:
    ${preguntaUsuario}
    
    Responde de forma clara, analítica y profesional basándote en el contexto proporcionado. Usa viñetas si es necesario para facilitar la lectura.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error en consultarCopilotoIA:", error);
    throw new Error("No se pudo obtener respuesta del modelo. Revisa la consola.");
  }
};
// 2. Dejo aquí la estructura de tus otras funciones por si las usas en otros componentes
export const obtenerSugerenciaIA = async (texto) => {
  // Lógica de sugerencia (puedes implementarla igual que arriba)
  return "Función sugerencia conectada"; 
};

export const obtenerAnalisisEvidenciaIA = async (texto) => {
  // Lógica de análisis (puedes implementarla igual que arriba)
  return "Función análisis conectada";
};