/**
 * 🗄️ dbService.js - Capa Centralizada de Datos para GRC
 * Incluye respaldo (fallback) en LocalStorage si la API falla o da 404.
 */

const BASE_URL = 'https://repos.termalessantarosa.com.co/api/grc';

export const dbService = {
  /**
   * 📥 Obtener todos los elementos de una colección
   */
  async obtenerTodos(coleccion) {
    try {
      const response = await fetch(`${BASE_URL}/${coleccion}`);
      if (!response.ok) {
        throw new Error(`Servidor devolvió status ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.warn(`⚠️ No se pudo conectar a la API para '${coleccion}'. Cargando desde LocalStorage.`, error);
      
      // Respaldo en LocalStorage
      const localData = localStorage.getItem(`grc_${coleccion}`);
      return localData ? JSON.parse(localData) : [];
    }
  },

  /**
   * 💾 Guardar o Actualizar un registro
   */
  async guardarOActualizar(coleccion, registro) {
    const esEdicion = Boolean(registro.id);
    const url = esEdicion 
      ? `${BASE_URL}/${coleccion}/${registro.id}` 
      : `${BASE_URL}/${coleccion}`;
    
    const method = esEdicion ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registro),
      });

      if (!response.ok) throw new Error('Error en backend');
      return await response.json();
    } catch (error) {
      console.warn(`⚠️ Error de red al guardar en API (${coleccion}). Guardando localmente.`, error);

      // Respaldo de guardado en LocalStorage
      const localData = JSON.parse(localStorage.getItem(`grc_${coleccion}`) || '[]');
      let actualizados;

      if (esEdicion) {
        actualizados = localData.map(item => item.id === registro.id ? registro : item);
      } else {
        const nuevoRegistro = { ...registro, id: registro.id || Date.now().toString() };
        actualizados = [...localData, nuevoRegistro];
      }

      localStorage.setItem(`grc_${coleccion}`, JSON.stringify(actualizados));
      return registro;
    }
  },

  /**
   * 🗑️ Eliminar un registro por ID
   */
  async eliminar(coleccion, id) {
    try {
      const response = await fetch(`${BASE_URL}/${coleccion}/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Error al eliminar en backend');
      return await response.json();
    } catch (error) {
      console.warn(`⚠️ Error de red al eliminar. Actualizando LocalStorage.`, error);

      const localData = JSON.parse(localStorage.getItem(`grc_${coleccion}`) || '[]');
      const filtrados = localData.filter(item => item.id !== id);
      localStorage.setItem(`grc_${coleccion}`, JSON.stringify(filtrados));
      return { success: true, id };
    }
  }
};