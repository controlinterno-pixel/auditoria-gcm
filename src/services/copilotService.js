// src/services/copilotService.js
import { consultarCopilotoIA } from './gemini';

export const sugerirTextoConIA = async (tipoTarget, setIsThinking, showNotification) => {
  let textoBase = "";
  let inputDestino = null;

  if (tipoTarget === 'control') {
    textoBase = document.querySelector('input[name="descripcion"]')?.value || "";
    inputDestino = document.querySelector('input[name="control"]');
  } else if (tipoTarget === 'plan') {
    const selectElement = document.querySelector('select[name="idHallazgo"]');
    textoBase = selectElement ? selectElement.options[selectElement.selectedIndex]?.text : "";
    inputDestino = document.querySelector('input[name="accion"]');
  } else if (tipoTarget === 'hallazgo') {
    textoBase = document.querySelector('input[name="proceso"]')?.value || "";
    inputDestino = document.querySelector('input[name="titulo"]');
  }

  textoBase = textoBase.replace(/[<>{}[\]\\]/g, '').trim();

  if (!textoBase || textoBase === '' || textoBase.includes('-- Seleccione --')) {
    showNotification("Escribe una descripción o selecciona un hallazgo primero para que la IA lo analice.", "error");
    return;
  }

  setIsThinking(true);
  showNotification("Procesando consulta con el Motor GRC Serverless...", "success");

  try {
    const sugerencia = await consultarCopilotoIA({
      tipoAccion: 'sugerir_grc',
      tipoTarget,
      prompt: textoBase
    });

    if (inputDestino) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      nativeInputValueSetter.call(inputDestino, typeof sugerencia === 'string' ? sugerencia.replace(/(^"|"$)/g, '') : JSON.stringify(sugerencia));
      inputDestino.dispatchEvent(new Event('input', { bubbles: true }));
      inputDestino.dispatchEvent(new Event('change', { bubbles: true }));
      showNotification("¡Sugerencia ejecutiva insertada con éxito!");
    }
  } catch (error) {
    console.error("Error conectando al Asistente IA:", error);
    showNotification("Error conectando con el servidor de auditoría.", "error");
  } finally {
    setIsThinking(false);
  }
};

export const analizarEvidenciaDocumento = async (evidenciaUrl, contextoItem, tipoItem, setIsThinking, showNotification, setAiModal) => {
  setIsThinking(true);
  showNotification("🤖 Enviando documento al Asistente Serverless...", "success");

  try {
    const analisis = await consultarCopilotoIA({
      tipoAccion: 'analizar_evidencia',
      evidenciaUrl,
      contextoItem,
      tipoItem
    });

    setAiModal({ 
      titulo: `📋 Checklist IA de Auditoría`, 
      contenido: typeof analisis === 'string' ? analisis : JSON.stringify(analisis), 
      url: evidenciaUrl 
    });

  } catch (error) {
    console.error(error);
    showNotification("Error al procesar la evidencia en el servidor.", "error");
  } finally {
    setIsThinking(false);
  }
};