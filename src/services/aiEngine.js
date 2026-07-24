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
    temperature: 0.3, // Un toque más alto para mejor redacción narrativa
    topP: 0.8, 
    maxOutputTokens: 8192, // 🚀 AUMENTADO: Para que el informe extenso no se ampute a la mitad
    responseMimeType: "application/json" // Esto obliga a Gemini a NO usar Markdown externo
  }
});

export const analizarRiesgoConIA = async (riesgo) => {
  try {
    const prompt = `
Eres el Socio Director de Auditoría (Big Four) de un Software GRC Enterprise.
Tu objetivo es generar un informe narrativo premium, estratégico y extremadamente extenso dirigido a la Junta Directiva y C-Suite.
Utiliza lenguaje ejecutivo, diagnóstico metodológico, simulación de evolución y benchmarking.

REGLA ESTRICTA: Devuelve ÚNICAMENTE un objeto JSON. Todo tu informe narrativo debe ir DENTRO de los valores de este JSON. No uses formato Markdown externo.

DATOS DEL RIESGO EN EVALUACIÓN:
${JSON.stringify(riesgo, null, 2)}

ESTRUCTURA JSON REQUERIDA (Llena cada campo de texto con párrafos extensos y profundos):
{
  "encabezado": {
    "codigo": "RSK-${riesgo.id ? String(riesgo.id).substring(0, 5) : '001'}",
    "proceso": "${riesgo.macroproceso || riesgo.proceso || 'Gestión Operativa'}",
    "subproceso": "${riesgo.subproceso || 'General'}",
    "riesgoInherenteLabel": "Alto",
    "riesgoResidualLabel": "Bajo",
    "calidadRegistroScore": 95,
    "confianzaIA": "Alta"
  },
  "kpis": {
    "scoreRiesgo": 85,
    "scoreMadurez": 70,
    "totalControles": ${Array.isArray(riesgo.controlesDetallados) ? riesgo.controlesDetallados.length : 1},
    "coberturaControles": 75
  },
  "hallazgos": [
    "Redacta aquí un hallazgo estratégico extenso y profundo (mínimo 3 líneas).",
    "Redacta un segundo hallazgo sobre el impacto en el negocio."
  ],
  "recomendaciones": [
    "Recomendación nivel Junta Directiva (mínimo 3 líneas).",
    "Segunda recomendación táctica y predictiva."
  ],
  "planAccion": [{ "prioridad": "Alta", "accion": "Acción detallada y ejecutiva", "responsable": "Comité de Riesgos" }],
  "dictamenDirector": "Aquí va tu Veredicto Ejecutivo principal. Escribe un párrafo extenso, contundente y analítico como Socio Director evaluando si el riesgo es aceptable o requiere intervención inmediata.",
  "acordeonesTecnicos": {
    "analisisMetodologico": "Escribe un análisis metodológico ISO 31000 muy extenso. Detalla causas, probabilidades, vulnerabilidades estructurales y escenarios de estrés.",
    "evaluacionControles": "Evalúa los controles existentes usando taxonomía COSO ERM. Detalla por qué son fuertes o débiles y simula la evolución del riesgo.",
    "isoCosoAlignment": "Alineación estratégica y semáforo ejecutivo.",
    "krisEvidencias": "Define 3 KRIs (Key Risk Indicators) predictivos con sus umbrales de tolerancia para monitoreo continuo."
  }
}
`;

    const result = await model.generateContent(prompt);
    const jsonText = await result.response.text();
    
    // Al usar responseMimeType: "application/json", Gemini garantiza que jsonText sea parseable
    const parsedObject = JSON.parse(jsonText);

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