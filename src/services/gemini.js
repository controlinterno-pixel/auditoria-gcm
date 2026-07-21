const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export const obtenerSugerenciaIA = async (tipoTarget, textoBase) => {
  if (!GEMINI_API_KEY) throw new Error("La clave de API de Gemini no se ha cargado correctamente.");

  let prompt = "";
  if (tipoTarget === 'control') {
    prompt = `Actúa como un experto en auditoría GRC y ciberseguridad (ISO 31000). El siguiente es un evento de riesgo en una empresa: "${textoBase}". Redacta la descripción de un CONTROL CLAVE mitigante o preventivo, de forma muy ejecutiva, técnica y directa (máximo 20 palabras). Solo responde con el texto del control, sin comillas ni saludos.`;
  } else if (tipoTarget === 'plan') {
    prompt = `Actúa como un gerente de auditoría interno corporativo. Se ha detectado el siguiente hallazgo o desviación: "${textoBase}". Redacta una ACCIÓN DE CHOQUE o plan correctivo, de forma muy ejecutiva, técnica y directa (máximo 20 palabras). Solo responde con el texto de la acción, sin comillas ni saludos.`;
  } else if (tipoTarget === 'hallazgo') {
    prompt = `Actúa como un Auditor Senior de Control Interno. Estás auditando el siguiente proceso: "${textoBase}". Redacta la descripción de un HALLAZGO O DESVIACIÓN grave y realista (máximo 20 palabras) que se podría encontrar en este proceso. Sé muy ejecutivo, técnico y directo. Solo responde con el texto del hallazgo, sin comillas ni saludos.`;
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 }
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates[0].content.parts[0].text.trim();
};

export const obtenerAnalisisEvidenciaIA = async (contextoItem, tipoItem) => {
  if (!GEMINI_API_KEY) throw new Error("La clave de API de Gemini no se ha cargado correctamente.");

  const prompt = `Actúa como un Auditor Senior de Control Interno y Cumplimiento Normativo ISO. Se acaba de adjuntar un archivo de evidencia (Foto o PDF o Enlace) para el siguiente ${tipoItem}: "${contextoItem}". Tu tarea es generar un dictamen de pre-auditoría rápido y estricto. Genera una lista de 4 puntos exactos que el analista DEBE verificar OBLIGATORIAMENTE con sus propios ojos al abrir ese archivo para asegurar que la evidencia es legalmente válida, mitiga el riesgo y no es fraudulenta. Sé muy técnico y directo (sin saludos).`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates[0].content.parts[0].text.trim();
}; // <--- AQUÍ TERMINA TU CÓDIGO ACTUAL


// 👇 PEGA LA NUEVA FUNCIÓN JUSTO AQUÍ ABAJO 👇

export const consultarCopilotoIA = async (preguntaUsuario, contextoDatos) => {
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  if (!GEMINI_API_KEY) throw new Error("La clave de API de Gemini no se ha cargado correctamente.");

  const prompt = `
  Eres el "Auditor IA", un asistente experto en Gobierno, Riesgo y Cumplimiento (GRC) de Termales Santa Rosa.
  
  Aquí tienes los datos actuales de la plataforma del usuario en formato JSON:
  ${JSON.stringify(contextoDatos)}

  El usuario te ha preguntado lo siguiente: "${preguntaUsuario}"

  Responde de manera profesional, técnica, concisa y basada ÚNICAMENTE en los datos proporcionados. Si el usuario pide tendencias, calcula porcentajes o destaca lo más grave. No uses saludos largos.
  `;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3 }
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates[0].content.parts[0].text.trim();
};