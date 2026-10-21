// src/services/copilotService.js
import { apiService } from './apiService';
import { secureLogger } from './secureLogger.js';

const TIPOS_SUGERENCIA = new Set(['control', 'plan', 'hallazgo']);

/**
 * H14: sugerencia de redacción con IA SIN tocar el DOM. Recibe el texto base (desde el estado del
 * formulario) y devuelve el texto sugerido, o null si no hay sugerencia. El formulario decide cómo
 * mostrarlo (p. ej. `setValor(sugerencia)`), de modo que React mantiene el control de los campos.
 */
export const solicitarSugerenciaIA = async (tipoTarget, textoBase, { setIsThinking = () => {}, showNotification = () => {} } = {}) => {
  if (!TIPOS_SUGERENCIA.has(tipoTarget)) return null;
  const texto = String(textoBase || '').replace(/[<>{}[\]\\]/g, '').trim();
  if (!texto || texto.includes('-- Seleccione --')) {
    showNotification("Escribe una descripción o selecciona un hallazgo primero para que la IA lo analice.", "error");
    return null;
  }

  setIsThinking(true);
  try {
    const res = await apiService.consultarAuditor({ tipoAccion: 'sugerir_grc', tipoTarget, prompt: texto });
    const sugerencia = res?.respuesta ?? res;
    return typeof sugerencia === 'string' ? sugerencia.replace(/(^"|"$)/g, '').trim() : null;
  } catch (error) {
    secureLogger.error('Error conectando al Asistente IA:', { message: error?.message || 'error' });
    showNotification("Error conectando con el servidor de auditoría.", "error");
    return null;
  } finally {
    setIsThinking(false);
  }
};

export const analizarEvidenciaDocumento = async (evidenciaUrl, contextoItem, tipoItem, setIsThinking, showNotification, setAiModal) => {
  setIsThinking(true);
  showNotification("🤖 Enviando documento al Asistente Serverless...", "success");

  try {
    const res = await apiService.consultarAuditor({
      tipoAccion: 'analizar_evidencia',
      evidenciaUrl,
      contextoItem,
      tipoItem
    });
    const analisis = res?.respuesta || res;

    setAiModal({ 
      titulo: `📋 Checklist IA de Auditoría`, 
      contenido: typeof analisis === 'string' ? analisis : JSON.stringify(analisis), 
      url: evidenciaUrl 
    });

  } catch (error) {
    secureLogger.error('Error al procesar la evidencia en el servidor:', { message: error?.message || 'error', evidenceUrlMasked: evidenciaUrl ? evidenciaUrl.replace(/.(?=.{8,}$)/g, '*') : '[sin-url]' });
    showNotification("Error al procesar la evidencia en el servidor.", "error");
  } finally {
    setIsThinking(false);
  }
};