// api/grc/audit.js - Motor de IA y Criterios de Auditoría Aislando Prompts
import { GoogleGenerativeAI } from '@google/generative-ai';
import { adminAuth } from '../_lib/firebaseAdmin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo se acepta POST.' });

  try {
    const { parse } = await import('cookie');
    const cookies = parse(req.headers.cookie || '');
    const sessionCookie = cookies.grc_session;

    if (!sessionCookie) return res.status(401).json({ error: 'Falta sesión HttpOnly de servidor.' });

    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (!decodedToken.email || !decodedToken.email.endsWith('@termales.com.co')) {
      return res.status(403).json({ error: 'Dominio no autorizado para usar la IA.' });
    }

    const keysString = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY;
    if (!keysString) return res.status(500).json({ error: 'Falta configurar GEMINI_API_KEYS en el servidor.' });

    const apiKeys = keysString.split(',').map(k => k.trim()).filter(Boolean);
    const { prompt, datosContexto, tipoAccion, tipoTarget, evidenciaUrl, contextoItem, tipoItem } = req.body;

    // 🛡️ CONSTRUCCIÓN SEGURA DEL PROMPT DENTRO DEL SERVIDOR
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
      promptConstruido = `Actúa como un Auditor Senior de Control Interno y Cumplimiento Normativo ISO.
      Se acaba de adjuntar un archivo de evidencia (Foto o PDF o Enlace) para el siguiente ${tipoItem}: "${contextoItem}".
      Tu tarea es generar un dictamen de pre-auditoría rápido y estricto. Genera una lista de 4 puntos exactos que el analista DEBE verificar OBLIGATORIAMENTE con sus propios ojos al abrir ese archivo (${evidenciaUrl}) para asegurar que la evidencia es legalmente válida, mitiga el riesgo y no es fraudulenta. Sé muy técnico y directo (sin saludos).`;
    } else {
      promptConstruido = `${prompt}\n\nContexto de datos:\n${JSON.stringify(datosContexto || {})}`;
    }

    const modelosDisponibles = ['gemini-3.1-flash-lite', 'gemini-3-flash-preview', 'gemini-2.5-flash'];
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
      console.error("❌ Error interno en audit.js:", lastError);
      return res.status(500).json({ error: "Servicio de IA no disponible temporalmente." });
    }

    return res.status(200).json({ respuesta: text });
  } catch (error) {
    console.error("❌ Error en audit.js:", error);
    return res.status(500).json({ error: "Error interno al procesar la consulta." });
  }
}