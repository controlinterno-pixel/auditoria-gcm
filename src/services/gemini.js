/**
 * @file gemini.js
 * @description Cliente para conectar la interfaz de React con el Motor GRC Serverless (/api/audit)
 */

export const consultarCopilotoIA = async (preguntaUsuario, contextoDatos) => {
  try {
    console.log("🚀 Enviando consulta al Motor GRC (/api/audit)...");

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
    console.error("❌ Error al conectar con el Asistente GRC:", error);
    throw new Error(`Falló la conexión con el Motor GRC: ${error.message}`);
  }
};