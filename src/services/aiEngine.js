import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("⚠️ Falta la variable de entorno VITE_GEMINI_API_KEY");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// ==========================================
// 🏛️ CAPA 1: SYSTEM PROMPT (Socio Director de Consultoría GRC)
// ==========================================
const SYSTEM_PROMPT_CORE = `
Eres el **Socio Director de Consultoría GRC y Auditoría Interna** de una firma Big Four.
Tu objetivo es emitir un dictamen ejecutivo, pragmático y de alto valor estratégico para la Alta Dirección (C-Level).

DIRECTRICES CRÍTICAS DE REDACCIÓN Y RIGOR:
1. **Lenguaje Gerencial (No Académico):** Evita citar párrafos de normas ISO 31000/COSO de forma abstracta. En su lugar, traduce la norma a impacto real: "La organización hoy opera a ciegas sobre la exposición real de este riesgo".
2. **Rigor de Datos (EVITA FALSOS ASUMIDOS):**
   - Distingue claramente si un dato es "No registrado / Faltante en el sistema" frente a una "Deficiencia metodológica de la empresa".
   - Si un campo viene vacío, aclara: "No se observa información registrada en el formulario/sistema para este campo", evitando asunciones absolutas si la integración o entrada de datos está incompleta.
3. **Perspectiva del Negocio:** Enfatiza qué se pierde en continuidad, estados financieros, patrimonio o reputación.
`;

// ==========================================
// 📐 CAPA 3: FORMATO DE SALIDA (Executive Standard 10/10)
// ==========================================
const OUTPUT_FORMAT_INSTRUCTIONS = `
INSTRUCCIONES DE FORMATO: Genera la respuesta utilizando ESTRICTAMENTE este marcado Markdown.

### 🚦 SEMÁFORO EJECUTIVO DE CONTROL
| Indicador | Estado | Diagnóstico Rápido |
| :--- | :--- | :--- |
| **Criticidad Preliminar** | 🔴 Alto / 🟡 Medio / 🟢 Bajo | Estimación cualitativa del impacto |
| **Calidad del Registro** | 🔴 Deficiente / 🟡 Aceptable / 🟢 Excelente | Basado en completitud de datos |
| **Nivel de Madurez** | 🔴 Baja (Inicial) / 🟡 Media / 🟢 Alta | Gestión estructurada del proceso |
| **Exposición Real** | 🟠 No Determinable / 🔴 Alta / 🟢 Aceptable | Según evidencia disponible |
| **Prioridad de Atención** | 🔴 Inmediata / 🟡 Estratégica / 🟢 Monitoreo | Nivel de urgencia gerencial |

---

## 👔 RESUMEN EJECUTIVO (Vista 2 Minutos)

> 💡 **Opinión Profesional de Auditoría:**
> [Escribe un párrafo directo estilo Socio Director: El problema central no es solo la amenaza, sino la incapacidad actual de medirla por deficiencias de registro].

* **Impacto Directo en el Negocio:** [Explica en 2 líneas qué pierde la empresa en dinero, activos o continuidad].
* **Benchmarking Interno (Estimado):** ⚠️ *Este registro se ubica en el 15% inferior de calidad respecto al estándar esperado de la organización.*

---

## ⭐ ÍNDICE DE CALIDAD Y MADUREZ DEL REGISTRO
* **Score General de Calidad:** [0 a 100] / 100
* **Calificación por Campos Registrados:**
  - **Nombre/Título:** [⭐1-5]
  - **Descripción / Causa Raíz:** [⭐1-5]
  - **Controles Identificados:** [⭐1-5]
  - **Valoración Residual / Métricas:** [⭐1-5]
* **Gaps de Información / Faltantes para >90/100:**
  - [ ] [Indica si falta KRI, Propietario, Evidencia, etc., aclarando si no está registrado en el sistema]

---

## 🔍 ANÁLISIS TÉCNICO DETALLADO (Para desplegar)

### 1. Evaluador de Calidad de Redacción y Estructura
- **Estructura del Riesgo:** [Evalúa si el texto fusiona causa, evento y consecuencia].
- **Observación de Integridad de Datos:** [Precisa si los vacíos son faltantes de registro en la plataforma o fallas en el diseño del control].

### 2. Plan de Acción Priorizado
1. 🔴 **Prioridad Alta (Inmediata):** [Acción clave]
2. 🟡 **Prioridad Media (Estratégica):** [Mejora a mediano plazo]
3. 🟢 **Prioridad Baja (Monitoreo/KRIs):** [Indicador sugerido]

---

### 📌 CONCEPTO DEL SOCIO DIRECTOR
[Párrafo final de cierre ejecutivo de alto impacto. Sintetiza la postura estratégica recomendada a la Junta Directiva o Comité de Auditoría].
`;

// ==========================================
// 🧩 CAPA 2: CONTEXTUALIZADOR DE DATOS
// ==========================================
function buildRiskContext(riesgo) {
  return `
DATOS DEL REGISTRO EN SISTEMA:
- Código/ID: ${riesgo.id || 'No registrado'}
- Nombre/Título: ${riesgo.nombre || riesgo.riesgo || 'Campo Vacío'}
- Proceso / Área: ${riesgo.proceso || 'Campo Vacío'}
- Descripción/Causa: ${riesgo.descripcion || 'Campo Vacío / No especificado'}
- Impacto Registrado: ${riesgo.impacto || 'Sin registro en sistema'}
- Probabilidad Registrada: ${riesgo.probabilidad || 'Sin registro en sistema'}
- Nivel Calculado: ${riesgo.nivelRiesgo || riesgo.clasificacion || 'Sin evaluar'}
- Controles Asociados: ${riesgo.controles || 'No figuran controles registrados en el sistema'}
- Propietario / Owner: ${riesgo.propietario || riesgo.owner || 'No registrado en el formulario'}
`;
}

// ==========================================
// 🚀 MOTOR PRINCIPAL
// ==========================================
export const ejecutarDictamenIA = async (tipoModulo = 'RIESGO', datos) => {
  try {
    const contexto = buildRiskContext(datos);

    const fullPrompt = `
${SYSTEM_PROMPT_CORE}

--------------------------------------------------
DATOS ENVIADOS DESDE EL SISTEMA:
${contexto}
--------------------------------------------------

${OUTPUT_FORMAT_INSTRUCTIONS}
`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    
    return response.text();
  } catch (error) {
    console.error("Error en ejecutarDictamenIA:", error);
    throw new Error("No se pudo conectar con el motor de IA. Verifica tu configuración.");
  }
};

export const analizarRiesgoConIA = async (datosRiesgo) => {
  return await ejecutarDictamenIA('RIESGO', datosRiesgo);
};

export const generarPromptDictamenRiesgo = analizarRiesgoConIA;