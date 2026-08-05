/**
 * MemoryService.js
 * Gestiona el historial conversacional para permitir auditorías con contexto.
 * Implementación inicial en memoria (Map), escalable a Redis.
 */

export class MemoryService {
  constructor() {
    // Usamos un Map para almacenar el historial por sessionId
    this.storage = new Map();
    // Límite de mensajes para no saturar la ventana de contexto del LLM
    this.maxHistoryLength = 10; 
  }

  /**
   * Recupera el historial de una sesión específica.
   * @param {string} sessionId - ID único de la sesión del usuario.
   * @returns {Array} Arreglo de mensajes [{ role: 'user'|'assistant', content: string }]
   */
  getHistory(sessionId) {
    if (!this.storage.has(sessionId)) {
      return [];
    }
    return this.storage.get(sessionId);
  }

  /**
   * Agrega un nuevo mensaje al historial de la sesión.
   * @param {string} sessionId - ID único de la sesión.
   * @param {string} role - 'user' o 'assistant'.
   * @param {string} content - Contenido del mensaje.
   */
  addMessage(sessionId, role, content) {
    if (!this.storage.has(sessionId)) {
      this.storage.set(sessionId, []);
    }

    const history = this.storage.get(sessionId);
    history.push({ role, content });

    // Mantenemos el historial dentro del límite para optimizar tokens
    if (history.length > this.maxHistoryLength) {
      // Eliminamos los mensajes más antiguos (FIFO)
      history.shift();
    }

    this.storage.set(sessionId, history);
  }

  /**
   * Limpia el historial de una sesión (útil para reiniciar auditorías).
   * @param {string} sessionId - ID único de la sesión.
   */
  clearSession(sessionId) {
    this.storage.delete(sessionId);
  }
}

// Exportamos una instancia única (Singleton) para compartir el estado en toda la app
export const memoryService = new MemoryService();