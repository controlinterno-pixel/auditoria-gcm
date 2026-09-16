export const consultarCopilotoIA = async (preguntaUsuario, contextoDatos) => {
  try {
    const response = await fetch('/api/audit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // 🔒 Envía automáticamente la cookie HttpOnly
      body: JSON.stringify({
        prompt: preguntaUsuario,
        datosContexto: contextoDatos,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Error HTTP ${response.status}`);
    }

    const result = await response.json();
    return result.respuesta || result;

  } catch (error) {
    console.error("❌ Error al conectar con el Asistente GRC:", error);
    throw new Error(`Falló la conexión con el Motor GRC: ${error.message}`);
  }
};