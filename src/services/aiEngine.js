import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const rawKeys = import.meta.env.VITE_GEMINI_API_KEYS || import.meta.env.VITE_GEMINI_API_KEY || "";
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

// Modelos ordenados por prioridad y estabilidad
const MODEL_NAMES = ["gemini-2.5-flash", "gemini-3.1-flash-lite", "gemini-1.5-flash"];

const calcularMetricasMatematicas = (riesgo) => {
  const totalControles = Array.isArray(riesgo.controlesDetallados) 
    ? riesgo.controlesDetallados.length 
    : (riesgo.controles ? riesgo.controles.length : 1);

  const impact = Number(riesgo.impacto) || 3;
  const probabilidad = Number(riesgo.probabilidad) || 3;

  const scoreRiesgo = Math.min(Math.max(Math.round(((impact * probabilidad) / 25) * 100), 15), 95);
  const scoreMadurez = Math.min(Math.max(totalControles * 15, 20), 90);
  const coberturaControles = Math.min(Math.round((scoreMadurez * 0.9) + 5), 100);

  let riesgoResidualLabel = "Bajo";
  if (scoreRiesgo > 60) riesgoResidualLabel = "Alto";
  else if (scoreRiesgo > 35) riesgoResidualLabel = "Medio";

  let riesgoInherenteLabel = "Alto";
  if (impact * probabilidad < 8) riesgoInherenteLabel = "Bajo";
  else if (impact * probabilidad < 16) riesgoInherenteLabel = "Medio";

  return { scoreRiesgo, scoreMadurez, totalControles, coberturaControles, riesgoInherenteLabel, riesgoResidualLabel };
};

export const analizarRiesgoConIA = async (riesgo) => {
  const metricasFijas = calcularMetricasMatematicas(riesgo);

  const prompt = `
Eres el Socio Director de Auditoría de un Software GRC Enterprise.
Tu objetivo es generar un informe narrativo premium y estratégico adaptado a las siguientes métricas exactas.

REGLAS ESTRICTAS DE FORMATO:
1. Devuelve ÚNICAMENTE un objeto JSON válido.
2. NO utilices saltos de línea dentro de los textos.
3. NO utilices comillas dobles dentro de tus textos. Usa comillas simples ('').
4. NO alteres las métricas calculadas que se te proporcionan.

DATOS DEL RIESGO EN EVALUACIÓN:
${JSON.stringify(riesgo, null, 2)}

MÉTRICAS EXACTAS CALCULADAS POR EL SISTEMA (USALAS TAL CUAL EN TU RESPUESTA):
- Score Riesgo: ${metricasFijas.scoreRiesgo}%
- Score Madurez: ${metricasFijas.scoreMadurez}%
- Cobertura: ${metricasFijas.coberturaControles}%
- Riesgo Inherente: ${metricasFijas.riesgoInherenteLabel}
- Riesgo Residual: ${metricasFijas.riesgoResidualLabel}

ESTRUCTURA JSON REQUERIDA:
{
  "encabezado": {
    "codigo": "RSK-${riesgo.id ? String(riesgo.id).substring(0, 5) : '001'}",
    "proceso": "${riesgo.macroproceso || riesgo.proceso || 'Gestión Operativa'}",
    "subproceso": "${riesgo.subproceso || 'General'}",
    "riesgoInherenteLabel": "${metricasFijas.riesgoInherenteLabel}",
    "riesgoResidualLabel": "${metricasFijas.riesgoResidualLabel}",
    "calidadRegistroScore": 90,
    "confianzaIA": "Alta"
  },
  "kpis": {
    "scoreRiesgo": ${metricasFijas.scoreRiesgo},
    "scoreMadurez": ${metricasFijas.scoreMadurez},
    "totalControles": ${metricasFijas.totalControles},
    "coberturaControles": ${metricasFijas.coberturaControles}
  },
  "hallazgos": [
    "Redacta un hallazgo estratégico extenso coherente con el score de riesgo del ${metricasFijas.scoreRiesgo}%.",
    "Redacta un segundo hallazgo sobre impacto de negocio en un solo párrafo continuo."
  ],
  "recomendaciones": [
    "Recomendación para elevar la madurez actual del ${metricasFijas.scoreMadurez}%.",
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
            temperature: 0.0, // 🎯 Fijado en 0.0 para cero variabilidad y máxima precisión
            topP: 0.8, 
            maxOutputTokens: 8192,
            responseMimeType: "application/json"
          }
        });

        const result = await model.generateContent(prompt);
        let jsonText = await result.response.text();
        
        // 🛡️ Limpieza estricta del JSON
        jsonText = jsonText.replace(/```json/gi, '').replace(/```/gi, '').trim();
        
        const startIndex = jsonText.indexOf('{');
        const endIndex = jsonText.lastIndexOf('}');
        
        if (startIndex !== -1 && endIndex !== -1) {
          jsonText = jsonText.substring(startIndex, endIndex + 1);
        }

        jsonText = jsonText.replace(/[\r\n\t]/g, " ");

        const parsedObject = JSON.parse(jsonText);

        // 🛡️ Garantizamos la inmutabilidad de las métricas
        parsedObject.kpis = {
          scoreRiesgo: metricasFijas.scoreRiesgo,
          scoreMadurez: metricasFijas.scoreMadurez,
          totalControles: metricasFijas.totalControles,
          coberturaControles: metricasFijas.coberturaControles
        };

        console.log(`✅ ¡Éxito en respuesta generada usando Key #${i + 1}!`);
        return JSON.stringify(parsedObject);
      } catch (err) {
        console.warn(`⚠️ Falló Key #${i + 1} con modelo ${modelName}. Motivo: ${err.message || err}`);
      }
    }
  }

  // Fallback si se agotan cuotas o fallan todas las claves
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
    kpis: { 
      scoreRiesgo: metricasFijas.scoreRiesgo, 
      scoreMadurez: metricasFijas.scoreMadurez, 
      totalControles: metricasFijas.totalControles, 
      coberturaControles: metricasFijas.coberturaControles 
    },
    hallazgos: ["Todas las llaves de acceso a la IA sobrepasaron su límite de peticiones."],
    recomendaciones: ["Espera unos minutos o ingresa una nueva API Key en el entorno."],
    planAccion: [{ prioridad: "Alta", accion: "Revisar cuotas en Google AI Studio", responsable: "Administrador" }],
    dictamenDirector: "Se agotaron los intentos con las API Keys disponibles.",
    acordeonesTecnicos: { 
      analisisMetodologico: "Datos no disponibles.", 
      evaluacionControles: "Datos no disponibles.",
      isoCosoAlignment: "Datos no disponibles.", 
      krisEvidencias: "Datos no disponibles."
    }
  });
};

// ==========================================
// FUNCIÓN EXCLUSIVA PARA EL DASHBOARD EJECUTIVO
// ==========================================
export const generarDictamenEjecutivo = async (datosContexto) => {
  const prompt = `
Actúa como un Socio Director Global de Consultoría GRC, Enterprise Risk Management (ERM), Auditoría Interna y Gobierno Corporativo con más de 25 años de experiencia asesorando Juntas Directivas, Comités de Auditoría y CEOs de compañías Fortune 500.

Tu función NO es describir indicadores. Tu función es interpretar lo que significan para el negocio.

Analiza los datos utilizando pensamiento ejecutivo, juicio profesional y estándares internacionales (ISO 31000, COSO ERM, IIA, COBIT, ISO 37301).
- No inventes información.
- Nunca afirmes algo que los datos no soporten.
- Si existen supuestos debes indicarlo claramente.
- Tu respuesta debe parecer escrita por un consultor senior de una Big Four.
- No escribas listas ni definiciones; escribe un análisis ejecutivo continuo.

Evalúa: nivel de exposición real, tendencia, madurez, eficacia del control interno, impacto operativo, financiero, regulatorio y reputacional, capacidad de respuesta y nivel de gobernanza.

DATOS A EVALUAR:
${typeof datosContexto === 'object' ? JSON.stringify(datosContexto, null, 2) : datosContexto}

Redacta un único dictamen ejecutivo de aproximadamente 180 a 250 palabras.
El texto debe: sonar profesional, estratégico, objetivo y técnico. No exagerar, no utilizar lenguaje comercial, ni frases vacías, ni repetir números innecesariamente. Si el indicador es bueno explica por qué. Si es malo explica sus consecuencias.

Finaliza el texto con un nuevo párrafo que comience con el icono 💡 incluyendo la recomendación ejecutiva orientada a la Alta Dirección.

FORMATO DE SALIDA (OBLIGATORIO JSON STRICTO):
Responde ÚNICAMENTE en formato JSON con la siguiente estructura exacta:
{
  "titulo": "TÍTULO CORTO Y EJECUTIVO (Máx 5 palabras)",
  "dictamen": "Aquí va el análisis ejecutivo continuo de 180-250 palabras...\n\n💡 Recomendación: [Acción prioritaria orientada a la Alta Dirección con metas concretas]."
}
`;

  for (let i = 0; i < API_KEYS.length; i++) {
    const currentKey = API_KEYS[i];
    const genAI = new GoogleGenerativeAI(currentKey);

    for (const modelName of MODEL_NAMES) {
      try {
        console.log(`🤖 [Dashboard] Intentando con Key #${i + 1} y Modelo: ${modelName}...`);

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
        
        jsonText = jsonText.replace(/```json/gi, '').replace(/```/gi, '').trim();
        
        const startIndex = jsonText.indexOf('{');
        const endIndex = jsonText.lastIndexOf('}');
        
        if (startIndex !== -1 && endIndex !== -1) {
          jsonText = jsonText.substring(startIndex, endIndex + 1);
        }

        console.log(`✅ [Dashboard] ¡Éxito en respuesta generada!`);
        return jsonText;
      } catch (err) {
        console.warn(`⚠️ [Dashboard] Falló Key #${i + 1} con modelo ${modelName}. Motivo: ${err.message || err}`);
      }
    }
  }

  console.error("❌ Fallaron todas las claves para el Dashboard.");
  return JSON.stringify({
    titulo: "Límite Alcanzado",
    dictamen: "Todas las llaves de acceso a la IA sobrepasaron su límite de peticiones. Por favor, intenta de nuevo más tarde.\n\n💡 Recomendación: Revisar cuotas en Google AI Studio o cambiar la API Key."
  });
};
