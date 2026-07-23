import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("⚠️ Falta la variable de entorno VITE_GEMINI_API_KEY");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || "");

// ==========================================
// 🛡️ APAGADO DE FILTROS PARA AUDITORÍA GRC
// ==========================================
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

// ==========================================
// ⚡ CONFIGURACIÓN DE ALTA VELOCIDAD Y RENDIMIENTO
// ==========================================
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash",
  safetySettings,
  generationConfig: {
    temperature: 0.15,      
    topP: 0.8,
    maxOutputTokens: 2500,  
  }
});

// ==========================================
// 🏛️ CAPA 1: SYSTEM PROMPT (Executive Advisory & ERIR Engine)
// ==========================================
const SYSTEM_PROMPT_CORE = `
Eres el Motor de Inteligencia Estratégica del Informe ERIR® (Executive Risk Intelligence Report) basado en metodologías de gestión de riesgos ampliamente utilizadas por firmas internacionales de consultoría.
Tu misión es emitir un Dictamen de Nivel Junta Directiva y C-Suite.

DIRECTRICES CRÍTICAS DE AUDITORÍA Y METODOLOGÍA:
1. Denomina este informe "Informe Ejecutivo de Inteligencia Estratégica del Riesgo (ERIR®)".
2. NO uses marcas comerciales. Refiérete siempre a "Buenas prácticas internacionales de GRC (ISO 31000, COSO ERM, ISO 27005)".
3. Etiqueta siempre los valores financieros simulados como: ⚡ *(Estimación IA Basada en Supuestos de Industria)*.
4. Genera el análisis de Trazabilidad, Ecosistema de Riesgos e Impacto Estratégico de forma exhaustiva.
5. NO utilices el carácter '═' bajo ninguna circunstancia. Utiliza únicamente el separador estándar '---'.
6. Usa el formato de viñeta normal (*) para listas.
`;

// ==========================================
// 📐 CAPA 3: FORMATO DE SALIDA 10/10 (ERIR® C-SUITE EDITION)
// ==========================================
const OUTPUT_FORMAT_INSTRUCTIONS = `
INSTRUCCIONES DE FORMATO: Genera ÚNICAMENTE la estructura Markdown exacta detallada a continuación. Inventa los datos predictivos basándote en el contexto del riesgo, pero mantén EXACTAMENTE esta estructura visual.

## 🛡️ INFORME EJECUTIVO DE INTELIGENCIA ESTRATÉGICA DEL RIESGO (ERIR®)
* **Código/ID:** [ID del Riesgo] | **Estado:** Abierto
* **Proceso Impactado:** [Proceso] | **Subproceso:** [Subproceso]
* **Categoría de Riesgo:** [Categoría] | **Clasificación ISO:** [Clasificación]
* **Líder Propietario (Owner):** [Propietario registrado o "⚠️ No Asignado en Plataforma"]
* **Severidad Residual Actual:** [CRÍTICO / ALTO / MODERADO / BAJO]

---

## 🏥 SALUD DE LA GESTIÓN DEL RIESGO
* **Salud del Riesgo:** [██████░░░░░░░░░░░░░░] [Score]%
* **Estado de Salud:** [CRÍTICA / DEFICIENTE / ACEPTABLE / ÓPTIMA]

---

## 📊 COMPARATIVO DE EXPOSICIÓN
* **Inherente (Sin Controles):** [████████████████████] [Inh]% 🔴
* **Residual (Actual):** [██████████░░░░░░░░░░] [Res]% 🟠
* **Objetivo (Target Deseado):** [████░░░░░░░░░░░░░░░░] 20% 🟢

---

## 🚦 SEMÁFORO Y MAPA DE CONTROL EJECUTIVO
| Indicador | Estado | Diagnóstico Rápido |
| --- | --- | --- |
| **Criticidad Preliminar** | 🔴 Alto / 🟡 Medio / 🟢 Bajo | Estimación cualitativa |
| **Calidad del Registro** | 🔴 Deficiente / 🟢 Aceptable | Basado en completitud metodológica |
| **Nivel de Madurez** | 🔴 Baja (Inicial) | Gestión estructurada del proceso |
| **Exposición Real** | 🔴 Alta | Requiere atención de la alta gerencia |
| **Prioridad de Atención** | 🔴 Inmediata / 🟡 Estratégica | Nivel de urgencia gerencial |

---

## 📌 VEREDICTO EJECUTIVO
**VEREDICTO:** Este riesgo NO se encuentra bajo control. Se recomienda intervención inmediata.
* **Nivel de confianza del análisis IA:** [Ej: 85%] ★★★★☆

---

## 👔 RESUMEN EJECUTIVO (Vista 2 Minutos)
> **Opinión Profesional:** [Redacta aquí un análisis contundente, frío y calculador sobre la gobernanza y exposición del riesgo, ideal para un CEO o Junta Directiva].

* **Pérdida Esperada (ALE):** 💰 $[Monto Estimado] USD ⚡ *(Estimación IA Basada en Supuestos de Industria)*
* **Tiempo Estimado para Recuperación:** ⏱️ Tiempo estimado para llevar este riesgo de [Score]/100 a 80/100 ≈ [2 a 9] meses.

---

## 🎯 IMPACTO ESTRATÉGICO
| Objetivo Estratégico | Impacto | Diagnóstico de Exposición |
| --- | --- | --- |
| **Protección Patrimonial** | 🔴 ALTO / 🟡 MEDIO | Vulnerabilidad directa a pérdidas financieras y operativas. |
| **Rentabilidad y Operación** | 🔴 ALTO / 🟡 MEDIO | Riesgo de interrupción en actividades clave. |
| **Cumplimiento Legal** | 🔴 ALTO / 🟡 MEDIO | Exposición a hallazgos de auditoría y sanciones. |

---

## 🔗 ECOSISTEMA DE RIESGOS RELACIONADOS
Este riesgo tiene relación transversal con:
* ✔️ [Ej: Riesgo de Fraude Interno y Mala Gestión]
* ✔️ [Ej: Riesgo de Obsolescencia de Activos Fijos]
* ✔️ [Ej: Riesgo de Exactitud en Estados Financieros]
* ✔️ [Ej: Riesgo de Continuidad de Negocio]

---

## 🚀 SIMULACIÓN DE EVOLUCIÓN (Plan de Mejora)
* **Estado Actual:** [Score]/100 🔴 (Gobernanza Deficiente)
* **↓ Asignar Owner:** [Score + 15]/100 🟡 (Asignación de Responsabilidad)
* **↓ Definir KRIs:** [Score + 30]/100 🟡 (Monitoreo Activo)
* **↓ Ejecutar Controles:** [Score + 55]/100 🟢 (Estado Aceptable y Mitigado)

---

## 📈 TENDENCIA HISTÓRICA Y EVOLUCIÓN
* **2024:** ████░░░░░░ (40%)
* **2025:** ███████░░░ (70%)
* **2026 (Hoy):** ██░░░░░░░░ ([Score]%)
* **Variación:** 📉 La situación histórica muestra un evidente deterioro de las defensas.

---

## 🔮 IA PREDICTIVA & SCENARIO ANALYSIS
* **Probabilidad de Materialización (12 Meses):** [Probabilidad]% [██████████░░]
* **Impacto Potencial Estimado:** $[Valor] USD ⚡ *(Estimación IA Basada en Supuestos de Industria)*
🚨 **Escenario ("Si no se hace nada"):** Incremento de vulnerabilidad a fraudes u omisiones operativas, sanciones en auditorías externas y deterioro de la rentabilidad.

---

## 🏛️ DICTAMEN PARA EL COMITÉ DE RIESGOS & DECISIONES
* **Recomendación Directa:** Intervención prioritaria para establecer gobernanza y control robustos.
* **Nivel de Urgencia:** 🔴 Muy Alta

| Decisión Recomendada | Prioridad | Responsable |
| --- | --- | --- |
| 1. Asignación formal de Propietario del riesgo. | 🔴 Inmediata | Gerencia General |
| 2. Auditoría interna exhaustiva. | 🔴 Inmediata | Líder de Auditoría Interna |
| 3. Implementación urgente de Plan de Acción. | 🟠 Alta | Dueño del Proceso |

---

## 📝 TRAZABILIDAD DEL DICTAMEN ERIR®
* **Universo de Información Analizada:** Datos del registro evaluado, controles preventivos/detectivos, y variables del riesgo.
* **Marcos y Estándares de Referencia:** Buenas prácticas internacionales de GRC (ISO 31000:2018, COSO ERM 2017, ISO 27005).
`;

// ==========================================
// 🧩 CAPA 2: CONTEXTUALIZADOR DE DATOS
// ==========================================
function buildRiskContext(riesgo) {
  return `
DATOS EXTRAÍDOS DEL SISTEMA PARA INFORME ERIR®:
- Código/ID: RSK-${riesgo.id ? String(riesgo.id).substring(0, 5) : '001'}
- Fecha Actual de Evaluación: ${new Date().toLocaleDateString()}
- Título/Riesgo: ${riesgo.nombre || riesgo.riesgo || 'Sin especificación'}
- Macroproceso: ${riesgo.macroproceso || riesgo.proceso || 'No asignado'}
- Subproceso: ${riesgo.subproceso || 'General'}
- Categoría ISO: ${riesgo.categoria || 'No asignada'}
- Clasificación: ${riesgo.clasificacionRiesgo || 'Sin clasificación'}
- Normativa: ${riesgo.normativa || 'No registrada'}
- Sedes: ${Array.isArray(riesgo.sede) ? riesgo.sede.join(', ') : (riesgo.sede || 'Sin sede')}
- Propietario / Owner: ${riesgo.responsable || '⚠️ No asignado en plataforma'}
- Causa / Descripción: ${riesgo.descripcion || 'Sin detalle de causa raíz'}
- Impacto Inherente: ${riesgo.impactoInherente || 0}%
- Probabilidad Inherente: ${riesgo.probabilidadInherente || 0}%
- Impacto Residual: ${riesgo.impactoResidual || 0}%
- Probabilidad Residual: ${riesgo.probabilidadResidual || 0}%
- Tratamiento: ${riesgo.tratamiento || 'No especificado'}
`;
}

// ==========================================
// 🚀 FUNCIONES DE EJECUCIÓN (Estándar y Streaming)
// ==========================================

export const ejecutarDictamenIA = async (tipoModulo = 'RIESGO', datos) => {
  try {
    const contexto = buildRiskContext(datos);
    const fullPrompt = `${SYSTEM_PROMPT_CORE}\n\n--------------------------------------------------\nREGISTRO EVALUADO EN SISTEMA:\n${contexto}\n--------------------------------------------------\n\n${OUTPUT_FORMAT_INSTRUCTIONS}`;
    
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error en ejecutarDictamenIA:", error);
    throw new Error("No se pudo conectar con el motor de IA.");
  }
};

export const ejecutarDictamenIAStream = async (datos, onChunk) => {
  try {
    const contexto = buildRiskContext(datos);
    const fullPrompt = `${SYSTEM_PROMPT_CORE}\n\n--------------------------------------------------\nREGISTRO EVALUADO EN SISTEMA:\n${contexto}\n--------------------------------------------------\n\n${OUTPUT_FORMAT_INSTRUCTIONS}`;
    
    const resultStream = await model.generateContentStream(fullPrompt);

    let textoAcumulado = "";
    for await (const chunk of resultStream.stream) {
      try {
        const chunkText = chunk.text();
        if (chunkText) {
          textoAcumulado += chunkText;
          // Solo se envía el fragmento nuevo para no duplicar en el renderizado de React
          if (onChunk) onChunk(chunkText); 
        }
      } catch (err) {
        console.warn("Fragmento ignorado o bloqueado durante el stream:", err);
      }
    }

    return textoAcumulado;
  } catch (error) {
    console.error("Error en ejecutarDictamenIAStream:", error);
    if (onChunk) {
      onChunk("\n\n⚠️ **Aviso:** El análisis se interrumpió tempranamente.");
    }
    throw new Error("Error en la transmisión del informe de IA.");
  }
};

export const analizarRiesgoConIA = async (datosRiesgo) => {
  return await ejecutarDictamenIA('RIESGO', datosRiesgo);
};

export const generarPromptDictamenRiesgo = analizarRiesgoConIA;