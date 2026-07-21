// src/services/apiService.js

const API_BASE_URL = 'https://repos.termalessantarosa.com.co/api'; // Ajusta según tu backend

export const apiService = {
  // 1. CRUD General (Ejemplo genérico, se adapta si usas Firebase u otro backend)
  obtenerColeccion: async (coleccion) => {
    const response = await fetch(`${API_BASE_URL}/${coleccion}`);
    if (!response.ok) throw new Error(`Error obteniendo ${coleccion}`);
    return await response.json();
  },

  guardarDocumento: async (coleccion, datos) => {
    const response = await fetch(`${API_BASE_URL}/${coleccion}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    if (!response.ok) throw new Error('Error al guardar los datos');
    return await response.json();
  },

  // 2. Motor Complejo: Subida de Evidencias (Archivos)
  subirEvidencia: async (archivo, metadata = {}) => {
    const formData = new FormData();
    formData.append('file', archivo);
    
    // Si necesitas enviar datos extra con el archivo (ej. id del hallazgo)
    Object.keys(metadata).forEach(key => formData.append(key, metadata[key]));

    const response = await fetch(`${API_BASE_URL}/archivos/upload`, {
      method: 'POST',
      body: formData, // No seteamos Content-Type, el navegador lo hace por nosotros con el Boundary
    });

    if (!response.ok) throw new Error('Falló la carga del archivo en el servidor de Termales');
    return await response.json();
  }
};