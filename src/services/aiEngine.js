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
    temperature: 0.2, 
    topP: 0.8, 
    maxOutputTokens: 8192,
    responseMimeType: "application/json"
  }
});

export const analizarRiesgoConIA = async (riesgo) => {
  try {
    const prompt = `
Eres el Socio Director de Auditoría de un Software GRC Enterprise.
Tu objetivo es generar un informe narrativo premium, estratégico y extremadamente extenso.

REGLAS ESTRICTAS DE FORMATO (CRÍTICAS PARA EVITAR ERRORES DE LECTURA):
1. Devuelve ÚNICAMENTE un objeto JSON válido.
2. NO utilices saltos de línea (Enters) dentro de los textos. Escribe tus respuestas en un solo bloque.
3. NO utilices comillas dobles dentro de tus textos. Usa comillas simples ('').
4. Los valores de los KPIs deben ser NÚMEROS ENTEROS (sin comillas en el JSON final).

DATOS DEL RIESGO EN EVALUACIÓN:
${JSON.stringify(riesgo, null, 2)}

ESTRUCTURA JSON REQUERIDA (Calcula los valores según la gravedad del riesgo proporcionado):
{
  "encabezado": {
    "codigo": "RSK-${riesgo.id ? String(riesgo.id).substring(0, 5) : '001'}",
    "proceso": "${riesgo.macroproceso || riesgo.proceso || 'Gestión Operativa'}",
    "subproceso": "${riesgo.subproceso || 'General'}",
    "riesgoInherenteLabel": "Evalúa y escribe solo: Alto, Medio o Bajo",
    "riesgoResidualLabel": "Evalúa y escribe solo: Alto, Medio o Bajo",
    "calidadRegistroScore": 90,
    "confianzaIA": "Alta"
  },
  "kpis": {
    "scoreRiesgo": <REEMPLAZA POR UN NÚMERO ENTERO DE 0 A 100 SEGÚN EL IMPACTO DEL RIESGO>,
    "scoreMadurez": <REEMPLAZA POR UN NÚMERO ENTERO DE 0 A 100 SEGÚN LOS CONTROLES>,
    "totalControles": ${Array.isArray(riesgo.controlesDetallados) ? riesgo.controlesDetallados.length : 1},
    "coberturaControles": <REEMPLAZA POR UN NÚMERO ENTERO DE 0 A 100 SEGÚN LA EFECTIVIDAD>
  },
  "hallazgos": [
    "Redacta un hallazgo estratégico extenso en un solo párrafo sin saltos de línea.",
    "Redacta un segundo hallazgo sobre impacto de negocio en un solo párrafo continuo."
  ],
  "recomendaciones": [
    "Recomendación nivel Junta Directiva en un solo párrafo continuo.",
    "Segunda recomendación táctica en un solo párrafo continuo."
  ],
  "planAccion": [{ "prioridad": "Alta", "accion": "Acción detallada", "responsable": "Comité" }],
  "dictamenDirector": "Veredicto Ejecutivo principal en un solo bloque de texto continuo.",
  "acordeonesTecnicos": {
    "analisisMetodologico": "Análisis metodológico ISO 31000 extenso en un solo párrafo.",
    "evaluacionControles": "Evaluación de controles en un solo párrafo continuo.",
    "isoCosoAlignment": "Alineación estratégica redactada en un solo párrafo.",
    "krisEvidencias": "Define 3 KRIs detallados en un solo párrafo."
  }
}
`;
    const result = await model.generateContent(prompt);
    let jsonText = await result.response.text();
    
   // 🛡️ Limpieza de seguridad extrema (A prueba de balas)
    // 1. Borramos cualquier rastro de etiquetas markdown sin importar dónde estén
    jsonText = jsonText.replace(/```json/gi, '').replace(/```/gi, '').trim();
    
    // 2. Extraemos estrictamente desde la primera llave hasta la última
    const startIndex = jsonText.indexOf('{');
    const endIndex = jsonText.lastIndexOf('}');
    
    if (startIndex !== -1 && endIndex !== -1) {
      jsonText = jsonText.substring(startIndex, endIndex + 1);
    }

    // 3. Eliminamos saltos de línea o tabulaciones traicioneras que rompen el JSON.parse
    jsonText = jsonText.replace(/[\n\r\t]/g, " ");

    try {
        const parsedObject = JSON.parse(jsonText);
        return JSON.stringify(parsedObject);
    } catch (parseError) {
        // SI FALLA, IMPRIMIMOS EL TEXTO CRUDO EN CONSOLA PARA VER DÓNDE SE EQUIVOCÓ GEMINI
        console.error("❌ ERROR CRÍTICO: El JSON de Gemini tiene mala sintaxis.");
        console.error("TEXTO CRUDO:", jsonText);
        throw parseError; // Lanza el error al catch principal
    }

  } catch (error) {
    console.error("Fallo general en aiEngine:", error);
    
    return JSON.stringify({
      encabezado: {
        codigo: `RSK-${riesgo.id ? String(riesgo.id).substring(0, 5) : '001'}`,
        proceso: "Error de Formato IA",
        subproceso: "Revisar Consola",
        riesgoInherenteLabel: "-",
        riesgoResidualLabel: "-",
        calidadRegistroScore: 0,
        confianzaIA: "Baja"
      },
      kpis: { scoreRiesgo: 0, scoreMadurez: 0, totalControles: 0, coberturaControles: 0 },
      hallazgos: ["La respuesta del servidor fue interrumpida o tuvo un formato inesperado."],
      recomendaciones: ["Vuelve a presionar el botón 'Dictamen IA' para generar un nuevo token."],
      planAccion: [{ prioridad: "Media", accion: "Revisar consola del navegador", responsable: "Desarrollador" }],
      dictamenDirector: "Se produjo un fallo de lectura. Revisa la consola del navegador (F12) para ver el JSON crudo.",
      acordeonesTecnicos: { 
        analisisMetodologico: "Datos no disponibles.", evaluacionControles: "Datos no disponibles.",
        isoCosoAlignment: "Datos no disponibles.", krisEvidencias: "Datos no disponibles."
      }
    });
  }
};