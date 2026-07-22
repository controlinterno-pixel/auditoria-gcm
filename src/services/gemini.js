const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Dejamos estas dos funciones vacías temporalmente para el diagnóstico
export const obtenerSugerenciaIA = async () => "Diagnóstico en proceso...";
export const obtenerAnalisisEvidenciaIA = async () => "Diagnóstico en proceso...";

export const consultarCopilotoIA = async (preguntaUsuario, contextoDatos) => {
  if (!GEMINI_API_KEY) throw new Error("La clave de API de Gemini no se ha cargado correctamente.");

  try {
    console.log("🔍 [SUPER DEV MODE] Consultando modelos habilitados para tu API Key...");
    
    // Hacemos una petición GET pura a la lista de modelos de tu cuenta
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
    const data = await response.json();
    
    console.log("✅ MODELOS PERMITIDOS EN TU CUENTA:", data);
    
    throw new Error("DIAGNÓSTICO EXITOSO: Por favor presiona F12, ve a la pestaña 'Console' y dime qué modelos aparecen en la lista impresa.");

  } catch (error) {
    console.error("Detalle del error:", error);
    throw new Error(error.message);
  }
};