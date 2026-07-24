import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("⚠️ Falta la variable de entorno VITE_GEMINI_API_KEY");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || "");

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const model = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash", 
  safetySettings,
  generationConfig: { 
    temperature: 0.1, 
    topP: 0.8, 
    maxOutputTokens: 2500,
    responseMimeType: "application/json"
  }
});

export const analizarRiesgoConIA = async (riesgo) => {
  try {
    const prompt = `
Eres el Motor de Inteligencia de un Software GRC Enterprise.
Analiza el siguiente riesgo y devuelve UNICAMENTE un objeto JSON estructurado. No incluyas texto adicional ni markdown.

DATOS DEL RIESGO EN EVALUACIÓN:
${JSON.stringify(riesgo, null, 2)}

ESTRUCTURA JSON REQUERIDA:
{
  "encabezado": {
    "codigo": "RSK-${riesgo.id ? String(riesgo.id).substring(0, 5) : '001'}",
    "proceso": "${riesgo.macroproceso || riesgo.proceso || 'Gestión Operativa'}",
    "subproceso": "${riesgo.subproceso || 'General'}",
    "riesgoInherenteLabel": "Alto",
    "riesgoResidualLabel": "Bajo",
    "calidadRegistroScore": 65,
    "confianzaIA": "Alta"
  },
  "kpis": {
    "scoreRiesgo": 75,
    "scoreMadurez": 65,
    "totalControles": ${Array.isArray(riesgo.controlesDetallados) ? riesgo.controlesDetallados.length : 1},
    "coberturaControles": 82
  },
  "hallazgos": ["Descripción sintética de vulnerabilidad en el registro."],
  "recomendaciones": ["Recomendación estratégica a implementar."],
  "planAccion": [{ "prioridad": "Alta", "accion": "Actualizar matriz", "responsable": "Líder" }],
  "dictamenDirector": "Dictamen profesional del riesgo.",
  "acordeonesTecnicos": {
    "analisisMetodologico": "Análisis exhaustivo ISO 31000",
    "evaluacionControles": "Evaluación COSO ERM",
    "isoCosoAlignment": "Alineación de taxonomía",
    "krisEvidencias": "KRI Sugerido"
  }
}
`;

    const result = await model.generateContent(prompt);
    let jsonText = await result.response.text();
    
    // Limpieza de bloque Markdown residual
    jsonText = jsonText.replace(/^```(json)?/im, '').replace(/```$/im, '').trim();
    const startIndex = jsonText.indexOf('{');
    const endIndex = jsonText.lastIndexOf('}');
    
    if (startIndex !== -1 && endIndex !== -1) {
      jsonText = jsonText.substring(startIndex, endIndex + 1);
    }

    // Comprobamos que el JSON sea válido
    const parsedObject = JSON.parse(jsonText);

    // 🛡️ EL TRUCO: Devolvemos un STRING (evita el Error #31 en el componente padre)
    return JSON.stringify(parsedObject);

  } catch (error) {
    console.error("Error procesando JSON en aiEngine:", error);
    
    // 🛡️ Devolvemos el fallback también como STRING
    return JSON.stringify({
      encabezado: {
        codigo: `RSK-${riesgo.id ? String(riesgo.id).substring(0, 5) : '001'}`,
        proceso: "Error de Conexión IA",
        subproceso: "Reintento necesario",
        riesgoInherenteLabel: "-",
        riesgoResidualLabel: "-",
        calidadRegistroScore: 0,
        confianzaIA: "Baja"
      },
      kpis: { scoreRiesgo: 0, scoreMadurez: 0, totalControles: 0, coberturaControles: 0 },
      hallazgos: ["La respuesta del servidor fue interrumpida o tuvo un formato inesperado."],
      recomendaciones: ["Vuelve a presionar el botón 'Dictamen IA' para generar un nuevo token."],
      planAccion: [{ prioridad: "Media", accion: "Reintentar análisis", responsable: "Usuario" }],
      dictamenDirector: "Se produjo un fallo de lectura en la API. Esto ocurre ocasionalmente cuando el modelo recorta la respuesta.",
      acordeonesTecnicos: { 
        analisisMetodologico: "Datos no disponibles.", evaluacionControles: "Datos no disponibles.",
        isoCosoAlignment: "Datos no disponibles.", krisEvidencias: "Datos no disponibles."
      }
    });
  }
};