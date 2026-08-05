import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. Obtenemos el string gigante con todas las llaves separadas por coma
const rawKeys = import.meta.env.VITE_GEMINI_API_KEY;

if (!rawKeys) {
  console.error("Falta la variable de entorno VITE_GEMINI_API_KEY");
}

// 2. MAGIA: Convertimos ese string en un arreglo (Array) de llaves individuales
const apiKeys = rawKeys ? rawKeys.split(',').map(key => key.trim()) : [];

// 3. Función para el Copiloto IA (Chat) redirigida al Motor GRC (Express Server)
export const consultarCopilotoIA = async (preguntaUsuario, contextoDatos) => {
  try {
    console.log("🚀 Redirigiendo consulta al Motor GRC Backend (http://localhost:3000)...");

    const response = await fetch('http://localhost:3000/api/v1/audit/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: preguntaUsuario,
        context: contextoDatos,
        sessionId: 'sesion-auditor-web'
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Error HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log("✅ Respuesta recibida exitosamente del Motor GRC:", result);

// Si el engine devuelve summary o content, priorizamos el texto legible
if (result.data) {
  if (result.data.summary) return result.data.summary;
  if (result.data.content) {
    return typeof result.data.content === 'object' 
      ? JSON.stringify(result.data.content, null, 2) 
      : result.data.content;
  }
}

return typeof result === 'string' ? result : JSON.stringify(result, null, 2);    

  } catch (error) {
    console.error("❌ Error al conectar con el Motor GRC local:", error);
    throw new Error(`Falló la conexión con el Motor GRC: ${error.message}`);
  }
};