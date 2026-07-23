import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. Configuración del cliente Gemini
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("⚠️ Falta la variable de entorno VITE_GEMINI_API_KEY");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// ==========================================
// 🏛️ CAPA 1: SYSTEM PROMPT (Director GRC & Revisor de Calidad)
// ==========================================
const SYSTEM_PROMPT_CORE = `
Eres un Director Copilot de GRC (Governance, Risk, Compliance) y Consultor Senior de nivel Big Four.
Tu objetivo no es solo responder, sino **AUDITAR LA CALIDAD Y MADUREZ DE LA INFORMACIÓN DE RIESGOS/CONTROL INTERNO**.

Principios de evaluación:
1. **Audita la Calidad de la Redacción**: Evalúa si el usuario fusiona causas, eventos y consecuencias o si faltan datos clave.
2. **Impacto en el Negocio**: Explica claramente qué pierde o cómo se afecta la empresa en dinero, continuidad o reputación (no hables solo de normas, conecta con el negocio).
3. **Coherencia y Rigor**: Si no existen datos suficientes (probabilidad, impacto o controles), NO afirmes una criticidad absoluta. Emite una "Criticidad Preliminar" aclarando un "Nivel de Confianza Bajo/Medio" debido a la falta de información cuantificable.
4. **Alineación Normativa**: Aplica ISO 31000, COSO ERM e ISO 19011 sin citar artículos innecesarios.
`;

// ==========================================
// 📐 CAPA 3: SALIDA Y FORMATO (Estructura Dual + Score 0-100)
// ==========================================
const OUTPUT_FORMAT_INSTRUCTIONS = `
FORMATO DE RESPUESTA OBLIGATORIO (Utiliza estrictamente la siguiente sintaxis Markdown):

## 👔 RESUMEN EJECUTIVO (C-Level)
* **Criticidad Estimada:** [Crítico / Alto / Medio / Bajo] (Estimación Cualitativa)
* **Nivel de Confianza de la Evaluación:** [Alto / Medio / Bajo] — *Fundamento:* [Explica brevemente por qué, ej. falta de controles o datos]
* **Impacto Directo en el Negocio:** [Explica en 2 líneas qué pierde la empresa: pérdidas financieras, fallas operativas, impacto en estados financieros, etc.]
* **Apetito de Riesgo:** [Dentro de Apetito / Excede Apetito / No Evaluable]

---

## ⭐ ÍNDICE DE CALIDAD Y MADUREZ DEL REGISTRO
* **Score General:** [0 a 100] / 100
* **Calificación por Campos:**
  - **Nombre/Título:** [⭐1 a 5]
  - **Descripción/Causa:** [⭐1 a 5]
  - **Identificación de Controles:** [⭐1 a 5]
  - **Valoración/Métrica:** [⭐1 a 5]
* **Faltantes para un Nivel de Madurez Superior (>90/100):**
  - [ ] [Faltante 1, ej. Definir KRIs]
  - [ ] [Faltante 2, ej. Documentar evidencia del control]

---

## 🔍 ANÁLISIS TÉCNICO Y AUDITORÍA DETALLADA
### 1. Calidad Metodológica del Registro
- **Crítica de Redacción:** [Analiza si confunden causa, evento o consecuencia]
- **Brechas en el Control Interno:** [Lista las fallas o ausencias de controles clave]

### 2. Plan de Acción Priorizado
1. 🔴 **Prioridad Alta (Inmediata):** [Acción correctiva urgente]
2. 🟡 **Prioridad Media (Estratégica):** [Mejora a mediano plazo o diseño de control]
3. 🟢 **Prioridad Baja (Monitoreo/KRI):** [Indicador sugerido o automatización]
`;

// ==========================================
// 🧩 CAPA 2: GENERADORES DE CONTEXTO POR MÓDULO
// ==========================================

function buildRiskContext(riesgo) {
  return `
MÓDULO EVALUADO: Matriz de Riesgos Individual
- Código/ID: ${riesgo.id || 'N/A'}
- Nombre del Riesgo: ${riesgo.nombre || riesgo.riesgo || 'Sin nombre'}
- Proceso / Área: ${riesgo.proceso || 'No especificado'}
- Causa / Descripción: ${riesgo.descripcion || 'Sin descripción'}
- Probabilidad Registrada: ${riesgo.probabilidad || 'No evaluada'}
- Impacto Registrado: ${riesgo.impacto || 'No evaluado'}
- Nivel/Clasificación Residual: ${riesgo.nivelRiesgo || riesgo.clasificacion || 'Sin nivel'}
- Controles Existentes Registrados: ${riesgo.controles || 'No existen controles registrados'}
`;
}

function buildHallazgoContext(hallazgo) {
  return `
MÓDULO EVALUADO: Hallazgo / Desviación de Auditoría
- Proceso/Sede: ${hallazgo.proceso || 'N/A'} / ${hallazgo.sede || 'N/A'}
- Criterio (Política/Norma): ${hallazgo.criterio || 'No especificado'}
- Condición (Lo encontrado): ${hallazgo.condicion || 'Sin detalle'}
- Causa Raíz: ${hallazgo.causa || 'No identificada'}
- Efecto/Impacto: ${hallazgo.efecto || 'No evaluado'}
`;
}

// ==========================================
// 🚀 EJECUTOR PRINCIPAL DEL MOTOR DE IA
// ==========================================

/**
 * Función genérica para ejecutar dictámenes de IA en cualquier módulo de la app
 */
export const ejecutarDictamenIA = async (tipoModulo = 'RIESGO', datos) => {
  try {
    let contexto = "";

    switch (tipoModulo.toUpperCase()) {
      case 'RIESGO':
        contexto = buildRiskContext(datos);
        break;
      case 'HALLAZGO':
        contexto = buildHallazgoContext(datos);
        break;
      default:
        contexto = `DATOS GENERALES: ${JSON.stringify(datos)}`;
    }

    const fullPrompt = `
${SYSTEM_PROMPT_CORE}

--------------------------------------------------
INSUMO DE ENTRADA PARA ANÁLISIS:
${contexto}
--------------------------------------------------

${OUTPUT_FORMAT_INSTRUCTIONS}
`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    
    return response.text();
  } catch (error) {
    console.error("Error en ejecutarDictamenIA:", error);
    throw new Error("No se pudo obtener el análisis de Gemini. Verifica tu conexión o API Key.");
  }
};

// ==========================================
// 🔄 COMPATIBILIDAD CON VERCEL Y MÓDULOS ANTERIORES
// ==========================================
export const analizarRiesgoConIA = async (datosRiesgo) => {
  return await ejecutarDictamenIA('RIESGO', datosRiesgo);
};

export const generarPromptDictamenRiesgo = analizarRiesgoConIA;