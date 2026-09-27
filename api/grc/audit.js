// api/grc/audit.js - Motor de IA con Autenticación y Límites de Payload
import { GoogleGenerativeAI } from '@google/generative-ai';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { applyCors } from '../_lib/cors.js';
import { logger } from '../_lib/logger.js';

const MAX_PROMPT_LENGTH = 15000; // Límite defensivo para evitar desbordamiento de memoria

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 'Solo se acepta método POST.', 405);
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const keysString = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY;
    if (!keysString) {
      return sendError(res, 'Falta configurar GEMINI_API_KEYS en el servidor.', 500);
    }

    const apiKeys = keysString.split(',').map(k => k.trim()).filter(Boolean);
    const { prompt, datosContexto, tipoAccion, tipoTarget, evidenciaUrl, contextoItem, tipoItem } = req.body || {};

    let promptConstruido = '';

    if (tipoAccion === 'sugerir_grc') {
      const textoBase = String(prompt || '').replace(/[<>{}[\]\\]/g, '').trim();
      if (tipoTarget === 'control') {
        promptConstruido = `Analiza el evento: "${textoBase}". Redacta un CONTROL CLAVE mitigante (máx 20 palabras).`;
      } else if (tipoTarget === 'plan') {
        promptConstruido = `Hallazgo detectado: "${textoBase}". Redacta una ACCIÓN DE CHOQUE correctiva (máx 20 palabras).`;
      } else if (tipoTarget === 'hallazgo') {
        promptConstruido = `Proceso auditado: "${textoBase}". Redacta un HALLAZGO grave y realista (máx 20 palabras).`;
      } else {
        promptConstruido = textoBase;
      }
    } else if (tipoAccion === 'analizar_evidencia') {
      const ctxLimpio = String(contextoItem || '').replace(/[<>{}[\]\\]/g, '').trim();
      const urlLimpia = String(evidenciaUrl || '').trim();
      promptConstruido = `Actúa como un Auditor Senior de Control Interno y Cumplimiento Normativo ISO.
      Se acaba de adjuntar un archivo de evidencia para el siguiente ${tipoItem}: "${ctxLimpio}".
      Tu tarea es generar un dictamen de pre-auditoría rápido y estricto. Genera una lista de 4 puntos exactos que el analista DEBE verificar OBLIGATORIAMENTE al abrir ese archivo (${urlLimpia}) para asegurar que la evidencia es legalmente válida, mitiga el riesgo y no es fraudulenta. Sé muy técnico y directo (sin saludos).`;
    } else {
      const promptLimpio = String(prompt || '').trim();
      const contextoStr = datosContexto ? JSON.stringify(datosContexto) : '{}';
      promptConstruido = `${promptLimpio}\n\nContexto de datos:\n${contextoStr}`;
    }

    if (promptConstruido.length > MAX_PROMPT_LENGTH) {
      promptConstruido = promptConstruido.slice(0, MAX_PROMPT_LENGTH) + '\n[Contexto truncado por límite de tamaño]';
    }

    const modelosDisponibles = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    let text = null;
    let lastError = null;

    for (const key of apiKeys) {
      const genAI = new GoogleGenerativeAI(key);
      for (const modelName of modelosDisponibles) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent(promptConstruido);
          text = await result.response.text();
          if (text) break;
        } catch (error) {
          lastError = error;
        }
      }
      if (text) break;
    }

    if (!text) {
      logger.error('Error en servicio de Gemini', lastError, { endpoint: req.url, usuario: user.email });
      return sendError(res, 'Servicio de IA no disponible temporalmente.', 500);
    }

    return sendSuccess(res, { respuesta: text });
  } catch (error) {
    logger.error('Error interno en audit.js', error, { endpoint: req.url });
    return sendError(res, 'Error interno al procesar la consulta.', 500);
  }
}