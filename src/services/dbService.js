/**
 * 🗄️ dbService.js - Capa Centralizada de Datos para GRC
 * Encargada de comunicarse con la base de datos o backend central.
 */

// URL base del backend o servicio de persistencia
const BASE_URL = 'https://repos.termalessantarosa.com.co/api/grc';

export const dbService = {
  /**
   * 📥 Obtener todos los elementos de una colección (Ej: "riesgos", "incidentes")
   */
  async obtenerTodos(coleccion) {
    const response = await fetch(`${BASE_URL}/${coleccion}`);
    if (!response.ok) {
      throw new Error(`Error al consultar la colección: ${coleccion}`);
    }
    return await response.json();
  },

  /**
   * 💾 Guardar o Actualizar un registro (Reemplaza la lógica dispersa de saveToCloud)
   * Detecta automáticamente si es CREAR (POST) o ACTUALIZAR (PUT) si trae ID.
   */
  async guardarOActualizar(coleccion, registro) {
    const esEdicion = Boolean(registro.id);
    const url = esEdicion 
      ? `${BASE_URL}/${coleccion}/${registro.id}` 
      : `${BASE_URL}/${coleccion}`;
    
    const method = esEdicion ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(registro),
    });

    if (!response.ok) {
      throw new Error(`No se pudo ${esEdicion ? 'actualizar' : 'crear'} el registro en ${coleccion}.`);
    }

    return await response.json();
  },

  /**
   * 🗑️ Eliminar un registro por ID
   */
  async eliminar(coleccion, id) {
    const response = await fetch(`${BASE_URL}/${coleccion}/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Error al eliminar el registro #${id} de ${coleccion}.`);
    }

    return await response.json();
  }
};