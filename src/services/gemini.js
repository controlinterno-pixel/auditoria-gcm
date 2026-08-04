import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. Obtenemos el string gigante con todas las llaves separadas por coma
const rawKeys = import.meta.env.VITE_GEMINI_API_KEY;

if (!rawKeys) {
  console.error("Falta la variable de entorno VITE_GEMINI_API_KEY");
}

// 2. MAGIA: Convertimos ese string en un arreglo (Array) de llaves individuales
const apiKeys = rawKeys ? rawKeys.split(',').map(key => key.trim()) : [];

// 3. Función para el Copiloto IA (Chat) con sistema de Rotación de Llaves
export const consultarCopilotoIA = async (preguntaUsuario, contextoDatos) => {
  
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

  // 4. CICLO DE FALLBACK: Intentamos con cada llave una por una
  for (let i = 0; i < apiKeys.length; i++) {
    try {
      console.log(`🤖 Intentando conectar con Key #${i + 1}...`);
      
      // Inicializamos el SDK específicamente con la llave de este turno
      const genAI = new GoogleGenerativeAI(apiKeys[i]);
      
      // Usamos el modelo estable actual (gemini-1.5-flash)
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      // Intentamos generar el contenido
      const result = await model.generateContent(prompt);
      const response = await result.response;
      
      console.log(`✅ ¡Éxito en respuesta generada usando la Key #${i + 1}!`);
      
      // Si funciona, retornamos la respuesta y SALIMOS del ciclo
      return response.text(); 
      
    } catch (error) {
      console.error(`❌ Error con la Key #${i + 1}:`, error.message);
      
      // Si es la última llave de la lista y también falló, entonces sí arrojamos el error final
      if (i === apiKeys.length - 1) {
        throw new Error("No se pudo obtener respuesta del modelo. Revisa la consola.");
      }
      // Si no es la última, el ciclo simplemente continuará con la siguiente llave...
    }
  }
};

// Funciones adicionales de tu sistema
export const obtenerSugerenciaIA = async (texto) => {
  return "Función sugerencia conectada"; 
};

export const obtenerAnalisisEvidenciaIA = async (texto) => {
  return "Función análisis conectada";
};