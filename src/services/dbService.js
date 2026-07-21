/**
 * 🗄️ dbService.js - Capa Centralizada de Datos para GRC
 * Soporta API Backend + LocalStorage Fallback + Datos Semilla Iniciales
 */

const BASE_URL = 'https://repos.termalessantarosa.com.co/api/grc';

// 🌿 Datos Semilla por defecto (Para cuando la API falle y LocalStorage esté vacío)
const DATOS_SEMILLA = {
  riesgos: [
    { id: '1', codigo: 'RIE-001', titulo: 'Falla de Servidores Principales', nivel: 'Alto', estado: 'Mitigado' },
    { id: '2', codigo: 'RIE-002', titulo: 'Incumplimiento Normativo GRC', nivel: 'Medio', estado: 'En Revisión' }
  ],
  hallazgos: [
    { id: '1', codigo: 'HAL-001', titulo: 'Ausencia de políticas de respaldo', severidad: 'Alta' }
  ],
  planes: [
    { id: '1', codigo: 'PLA-001', titulo: 'Implementación de backup en nube', avance: 60, estado: 'En Proceso' }
  ],
  incidentes: [
    { id: '1', codigo: 'INC-001', titulo: 'Caída de red local', fecha: '2025-01-15' }
  ],
  auditoresLista: [],
  comites: [],
  cronograma: [],
  evaluaciones: [],
  monitoreo: [],
  informesAuditoria: []
};

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
      console.warn(`⚠️ API no disponible para '${coleccion}'. Usando almacenamiento local.`);
      
      const localKey = `grc_${coleccion}`;
      const localData = localStorage.getItem(localKey);

      // Convertimos los datos locales (si existen) o creamos un arreglo vacío
      const parsedData = localData ? JSON.parse(localData) : [];

      // 💡 SOLUCIÓN: Verificamos si realmente hay información (length > 0)
      if (parsedData.length > 0) {
        return parsedData;
      }

      // Si está vacío (o no existía), inyectamos los datos semilla
      const datosIniciales = DATOS_SEMILLA[coleccion] || [];
      localStorage.setItem(localKey, JSON.stringify(datosIniciales));
      return datosIniciales;
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
      console.warn(`⚠️ Guardando localmente en '${coleccion}'.`);

      const localKey = `grc_${coleccion}`;
      const localData = JSON.parse(localStorage.getItem(localKey) || '[]');
      let actualizados;

      if (esEdicion) {
        actualizados = localData.map(item => item.id === registro.id ? registro : item);
      } else {
        const nuevoRegistro = { ...registro, id: registro.id || Date.now().toString() };
        actualizados = [...localData, nuevoRegistro];
      }

      localStorage.setItem(localKey, JSON.stringify(actualizados));
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
      console.warn(`⚠️ Eliminando localmente de '${coleccion}'.`);

      const localKey = `grc_${coleccion}`;
      const localData = JSON.parse(localStorage.getItem(localKey) || '[]');
      const filtrados = localData.filter(item => item.id !== id);
      localStorage.setItem(localKey, JSON.stringify(filtrados));
      return { success: true, id };
    }
  }
};