// src/services/gemini.js - Conector ligero hacia /api/grc/audit
export const consultarCopilotoIA = async (params = {}) => {
  try {
    const payload = typeof params === 'string' 
      ? { prompt: params } 
      : params;

    const response = await fetch('/api/grc/audit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // 🔒 Envía cookie HttpOnly
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Error HTTP ${response.status}`);
    }

    const result = await response.json();
    return result.respuesta || result;

  } catch (error) {
    console.error("❌ Error en conector Gemini:", error);
    throw new Error(`Falló la comunicación con el Motor GRC: ${error.message}`);
  }
};