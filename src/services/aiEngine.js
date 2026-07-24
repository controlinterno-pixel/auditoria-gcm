import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("⚠️ Falta la variable de entorno VITE_GEMINI_API_KEY");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || "");

// ==========================================
// 🛡️ CONFIGURACIÓN DE SEGURIDAD
// ==========================================
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const model = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash", 
  safetySettings,
  generationConfig: { temperature: 0.15, topP: 0.8, maxOutputTokens: 2500 }
});

// ==========================================
// 🏛️ PROMPT DEL SISTEMA - AUDITORÍA C-SUITE (SIN MARKDOWN)
// ==========================================
const SYSTEM_PROMPT_CORE = `
Eres el Director Copilot de GRC y Consultor Senior de nivel Big Four para Termales de Santa Rosa de Cabal.
Tu rol es auditar la calidad, rigor y madurez metodológica de la información de riesgos y control interno.

DIRECTRICES OBLIGATORIAS DE FORMATO:
1. PROHIBIDO TOTALMENTE USAR MARKDOWN. NO utilices NINGÚN asterisco (**), numerales (##, ###), guiones bajos (_) ni tablas en sintaxis Markdown (| --- |).
2. Si incluyes caracteres de Markdown, romperás la interfaz gráfica de la aplicación.
3. Utiliza MAYÚSCULAS SOSTENIDAS para títulos de sección y separadores simples "---".
4. Para listas o viñetas, utiliza EXCLUSIVAMENTE el símbolo "•" o guiones simples "-".
5. NO inicies con saludos ni frases genéricas ("A continuación...", "Se presenta el siguiente informe...").
6. Comienza directamente con la introducción oficial del Director Copilot.
`;

// ==========================================
// 📐 FORMATO DE SALIDA EJECUTIVO ERIR®
// ==========================================
const OUTPUT_FORMAT_INSTRUCTIONS = `
ESTRUCTURA OBLIGATORIA DE LA RESPUESTA:

Como Director Copilot de GRC y Consultor Senior de nivel Big Four, mi rol es auditar la calidad y madurez de la información de riesgos y control interno proporcionada. Tras revisar el insumo, mi evaluación es la siguiente:

---

👔 RESUMEN EJECUTIVO (C-Level)
• Criticidad Estimada: [Estimación cualitativa/cuantitativa]
• Nivel de Confianza de la Evaluación: [Alto / Medio / Bajo] — Fundamento: [Explicación técnica]
• Impacto Directo en el Negocio: [Análisis detallado de pérdidas potenciales operativas, financieras, reputacionales o legales]
• Apetito de Riesgo: [Alineación con políticas corporativas]

---

⭐ ÍNDICE DE CALIDAD Y MADUREZ DEL REGISTRO
• Score General: [Calificación de 0 a 100] / 100
• Calificación por Campos:
  • Nombre/Título: ⭐[1-5]/5 ([Breve dictamen])
  • Descripción/Causa: ⭐[1-5]/5 ([Breve dictamen])
  • Identificación de Controles: ⭐[1-5]/5 ([Breve dictamen])
  • Valoración/Métrica: ⭐[1-5]/5 ([Breve dictamen])
• Faltantes para un Nivel de Madurez Superior (>90/100):
  - [X] [Brecha o campo faltante 1]
  - [X] [Brecha o campo faltante 2]
  - [X] [Brecha o campo faltante 3]

---

🔍 ANÁLISIS TÉCNICO Y AUDITORÍA DETALLADA
1. Calidad Metodológica del Registro
• Crítica de Redacción: [Análisis basado en ISO 31000 / COSO ERM]
• Nombre del Riesgo: [Evaluación del título]
• Descripción/Causa: [Desglose en Causa Raíz, Evento de Riesgo y Consecuencia]
• Brechas en el Control Interno: [Identificación de controles preventivos o detectivos faltantes]

2. Plan de Acción Priorizado
1. 🔴 Prioridad Alta (Inmediata):
• [Acción correctiva o ajuste metodológico 1]
• [Acción correctiva o ajuste metodológico 2]

2. 🟡 Prioridad Media (Estratégica):
• [Acción a mediano plazo]

3. 🟢 Prioridad Baja (Monitoreo/KRI):
• [Indicador clave de riesgo o control a monitorear]
`;

// ==========================================
// 🧩 CONTEXTUALIZADOR DE DATOS DEL SISTEMA
// ==========================================
function buildRiskContext(riesgo) {
  return `
DATOS EXTRAÍDOS DE LA MATRIZ PARA AUDITORÍA:
- ID/Código: RSK-${riesgo.id ? String(riesgo.id).substring(0, 5) : '001'}
- Fecha de Evaluación: ${new Date().toLocaleDateString()}
- Proceso: ${riesgo.macroproceso || riesgo.proceso || 'No asignado'}
- Subproceso: ${riesgo.subproceso || 'General'}
- Categoría: ${riesgo.categoria || 'No asignada'}
- Clasificación: ${riesgo.clasificacionRiesgo || 'Sin clasificación'}
- Propietario / Owner: ${riesgo.responsable || '⚠️ No asignado en plataforma'}
- Descripción del Riesgo: ${riesgo.descripcion || riesgo.escenarioFinal || 'Sin descripción'}
- Causa Inmediata: ${riesgo.causaInmediata || 'No especificada'}
- Causa Raíz: ${riesgo.causaRaiz || 'No especificada'}
- Probabilidad Inherente: ${riesgo.probabilidadInherente || 0}%
- Impacto Inherente: ${riesgo.impactoInherente || 0}%
- Probabilidad Residual: ${riesgo.probabilidadResidual || 0}%
- Impacto Residual: ${riesgo.impactoResidual || 0}%
- Controles Registrados: ${JSON.stringify(riesgo.controlesDetallados || riesgo.descripcionControl || 'Sin controles')}
`;
}

// ==========================================
// 🚀 FUNCIÓN PRINCIPAL EXPORTADA
// ==========================================
export const analizarRiesgoConIA = async (riesgo) => {
  try {
    const contexto = buildRiskContext(riesgo);
    const fullPrompt = `${SYSTEM_PROMPT_CORE}\n\n--------------------------------------------------\n${contexto}\n--------------------------------------------------\n\n${OUTPUT_FORMAT_INSTRUCTIONS}`;
    
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error en analizarRiesgoConIA:", error);
    throw new Error("No se pudo conectar con el motor de IA.");
  }
};