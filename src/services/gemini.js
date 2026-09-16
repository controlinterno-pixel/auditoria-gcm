import { auth } from './firebase'; // Importamos auth

export const consultarCopilotoIA = async (preguntaUsuario, contextoDatos) => {
  try {
    // 1. Obtener el token del usuario activo
    const token = await auth.currentUser?.getIdToken();

    const response = await fetch('/api/audit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` // 🔒 Candado puesto
      },
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