// src/services/apiService.js

const API_BASE_URL = 'https://repos.termalessantarosa.com.co/api';

export const apiService = {
  // ... tus otras funciones (obtenerColeccion, guardarDocumento) ...

  subirEvidencia: async (archivo, metadata = {}) => {
    const formData = new FormData();
    
    const appName = metadata.appName || 'controlInterno';
    const fileFieldName = metadata.fieldName || 'file';

    // 1. ⚠️ CRÍTICO: Agregar los campos de texto PRIMERO en el FormData
    formData.append('appName', appName);

    Object.keys(metadata).forEach(key => {
      if (key !== 'fieldName' && key !== 'appName') {
        formData.append(key, metadata[key]);
      }
    });

    // 2. Agregar el archivo AL FINAL del FormData
    formData.append(fileFieldName, archivo);

    // 3. Incluir appName en la URL por compatibilidad con NestJS/Query validation
    const urlConQuery = `${API_BASE_URL}/archivos/upload?appName=${encodeURIComponent(appName)}`;

    const response = await fetch(urlConQuery, {
      method: 'POST',
      body: formData, // El navegador establece los headers y boundaries automáticamente
    });

    if (!response.ok) {
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