import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

// 1. Obtenemos el texto de la variable de entorno (puede ser VITE_GEMINI_API_KEYS o la antigua VITE_GEMINI_API_KEY)
const rawKeys = import.meta.env.VITE_GEMINI_API_KEYS || import.meta.env.VITE_GEMINI_API_KEY || "";

// 2. Convertimos el string separado por comas en un Array de claves (limpiando espacios)
const API_KEYS = rawKeys.split(",").map(k => k.trim()).filter(Boolean);

if (API_KEYS.length === 0) {
  console.error("⚠️ Falta la variable de entorno de Gemini en tu archivo .env o Vercel");
}

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// Lista de modelos a probar en orden de preferencia
const MODEL_NAMES = ["gemini-2.5-flash", "gemini-3.1-flash-lite"];

export const analizarRiesgoConIA = async (riesgo) => {
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

  // 🔄 ROTACIÓN DE CLAVES Y MODELOS
  for (let i = 0; i < API_KEYS.length; i++) {
    const currentKey = API_KEYS[i];
    const genAI = new GoogleGenerativeAI(currentKey);

    for (const modelName of MODEL_NAMES) {
      try {
        console.log(`🤖 Intentando con Key #${i + 1} y Modelo: ${modelName}...`);

        const model = genAI.getGenerativeModel({ 
          model: modelName, 
          safetySettings,
          generationConfig: { 
            temperature: 0.2, 
            topP: 0.8, 
            maxOutputTokens: 8192,
            responseMimeType: "application/json"
          }
        });

        const result = await model.generateContent(prompt);
        let jsonText = await result.response.text();
        
        // 🛡️ Limpieza de seguridad extrema
        jsonText = jsonText.replace(/```json/gi, '').replace(/```/gi, '').trim();
        
        const startIndex = jsonText.indexOf('{');
        const endIndex = jsonText.lastIndexOf('}');
        
        if (startIndex !== -1 && endIndex !== -1) {
          jsonText = jsonText.substring(startIndex, endIndex + 1);
        }

        jsonText = jsonText.replace(/[\n\r\t]/g, " ");

        const parsedObject = JSON.parse(jsonText);
        console.log(`✅ ¡Éxito en respuesta generada usando Key #${i + 1}!`);
        return JSON.stringify(parsedObject);

      } catch (err) {
        console.warn(`⚠️ Falló Key #${i + 1} con modelo ${modelName}. Motivo: ${err.message || err}`);
        // Si falla, el bucle for continúa probando con la siguiente combinación
      }
    }
  }

  // Si pasa por TODAS las claves y TODOS los modelos y todo falla, cae al fallback manual
  console.error("❌ Fallaron todas las claves y modelos disponibles.");
  return JSON.stringify({
    encabezado: {
      codigo: `RSK-${riesgo.id ? String(riesgo.id).substring(0, 5) : '001'}`,
      proceso: "Límite Alcanzado",
      subproceso: "Cuota Excedida",
      riesgoInherenteLabel: "-",
      riesgoResidualLabel: "-",
      calidadRegistroScore: 0,
      confianzaIA: "Baja"
    },
    kpis: { scoreRiesgo: 0, scoreMadurez: 0, totalControles: 0, coberturaControles: 0 },
    hallazgos: ["Todas las llaves de acceso a la IA sobrepasaron su límite de peticiones diarias o por minuto."],
    recomendaciones: ["Espera unos minutos o ingresa una nueva API Key en el entorno."],
    planAccion: [{ prioridad: "Alta", accion: "Revisar cuotas en Google AI Studio", responsable: "Administrador" }],
    dictamenDirector: "Se agotaron los intentos con las API Keys disponibles. Intenta nuevamente en breve.",
    acordeonesTecnicos: { 
      analisisMetodologico: "Datos no disponibles.", evaluacionControles: "Datos no disponibles.",
      isoCosoAlignment: "Datos no disponibles.", krisEvidencias: "Datos no disponibles."
    }
  });
};