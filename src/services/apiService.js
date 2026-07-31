// src/services/apiService.js

const API_BASE_URL = 'https://repos.termalessantarosa.com.co/api';

export const apiService = {
  // ... tus otras funciones (obtenerColeccion, guardarDocumento) ...

  subirEvidencia: async (archivo, metadata = {}) => {
    const formData = new FormData();
    
    // 💡 Permite definir el nombre del campo o usa 'file' / 'archivo' por defecto
    const fileFieldName = metadata.fieldName || 'file'; 
    formData.append(fileFieldName, archivo);
    
    // Adjuntamos la metadata restante (appName, description, etc.)
    Object.keys(metadata).forEach(key => {
      if (key !== 'fieldName') {
        formData.append(key, metadata[key]);
      }
    });

    const response = await fetch(`${API_BASE_URL}/archivos/upload`, {
      method: 'POST',
      body: formData, // El navegador asigna el boundary automáticamente
    });

    if (!response.ok) {
      // 🎯 Capturamos la razón exacta entregada por el servidor
      let detalleError = 'Falló la carga del archivo';
      try {
        const errorJson = await response.json();
        detalleError = errorJson.message || errorJson.error || JSON.stringify(errorJson);
        if (Array.isArray(detalleError)) detalleError = detalleError.join(', ');
      } catch (e) {
        detalleError = `Error HTTP ${response.status}`;
      }
      throw new Error(`Servidor (${response.status}): ${detalleError}`);
    }

    return await response.json();
  }
};