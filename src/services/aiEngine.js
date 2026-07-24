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

// Configuración con respuesta JSON forzada (Native JSON Mode)
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

// Prompt que solicita datos analíticos en estructura JSON exacta
export const analizarRiesgoConIA = async (riesgo) => {
  try {
    const prompt = `
Eres el Motor de Inteligencia de un Software GRC Enterprise (estilo ServiceNow / AuditBoard) para Termales de Santa Rosa de Cabal.
Analiza el siguiente riesgo y devuelve UNICAMENTE un objeto JSON estructurado con el análisis ejecutivo.

DATOS DEL RIESGO EN EVALUACIÓN:
${JSON.stringify(riesgo, null, 2)}

ESTRUCTURA JSON REQUERIDA (Responde EXACTAMENTE con esta estructura):
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
  "hallazgos": [
    "Descripción sintética del primer hallazgo o vulnerabilidad crítica en el registro.",
    "Falta de alineación clara con la causa raíz identificada.",
    "Baja trazabilidad en la periodicidad de revisión del control."
  ],
  "recomendaciones": [
    "Formalizar la asignación del propietario del proceso en la plataforma.",
    "Documentar la evidencia de ejecución mensual del control preventivo."
  ],
  "planAccion": [
    { "prioridad": "Alta", "accion": "Actualizar el manual de funciones y controles del proceso.", "responsable": "Líder del Proceso" },
    { "prioridad": "Media", "accion": "Configurar alertas automáticas de vencimiento para el seguimiento.", "responsable": "Auditoría / Control Interno" }
  ],
  "dictamenDirector": "El riesgo presenta una cobertura adecuada mediante controles preventivos, pero requiere formalización documental inmediata para alcanzar un nivel de madurez óptimo ( >85%).",
  "acordeonesTecnicos": {
    "analisisMetodologico": "Análisis exhaustivo ISO 31000: La redacción cumple con la segregación entre causa inmediata y causa raíz, permitiendo una clara identificación del evento generador.",
    "evaluacionControles": "Evaluación COSO ERM: Los controles registrados actúan principalmente sobre la probabilidad. Se sugiere incluir un control correctivo enfocado en amortiguar el impacto financiero.",
    "isoCosoAlignment": "El riesgo se alinea con la categoría de Cumplimiento / Operativo según la taxonomía corporativa internacional.",
    "krisEvidencias": "KRI Sugerido: Porcentaje de desviaciones detectadas en revisiones mensuales (Umbral de tolerancia: < 5%)."
  }
}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const jsonText = response.text();
    
    // Parseo seguro del JSON
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Error procesando JSON en aiEngine:", error);
    // Fallback de emergencia por si la API falla
    return {
      encabezado: {
        codigo: `RSK-${riesgo.id ? String(riesgo.id).substring(0, 5) : '001'}`,
        proceso: riesgo.proceso || 'Proceso Corporativo',
        subproceso: riesgo.subproceso || 'General',
        riesgoInherenteLabel: "Alto",
        riesgoResidualLabel: "Moderado",
        calidadRegistroScore: 60,
        confianzaIA: "Media"
      },
      kpis: { scoreRiesgo: 70, scoreMadurez: 60, totalControles: 1, coberturaControles: 70 },
      hallazgos: ["No fue posible procesar la respuesta estructurada de la IA."],
      recomendaciones: ["Revisar la conexión con el servidor de inteligencia artificial."],
      planAccion: [{ prioridad: "Alta", accion: "Reintentar análisis", responsable: "Administrador" }],
      dictamenDirector: "Análisis preliminar generado en modo de contingencia.",
      acordeonesTecnicos: { analisisMetodologico: "Datos en revisión." }
    };
  }
};