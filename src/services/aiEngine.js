import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("⚠️ Falta la variable de entorno VITE_GEMINI_API_KEY");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || "");

// ==========================================
// ⚡ CONFIGURACIÓN DE ALTA VELOCIDAD Y RENDIMIENTO
// ==========================================
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash",
  generationConfig: {
    temperature: 0.1,       
    topP: 0.8,
    maxOutputTokens: 2048,  
  }
});

// ==========================================
// 🏛️ CAPA 1: SYSTEM PROMPT (Executive Advisory & ERIR Engine)
// ==========================================
const SYSTEM_PROMPT_CORE = `
Eres el Socio Director de Consultoría GRC y Auditoría de Nivel Big Four. Debes generar un Dictamen Ejecutivo de Inteligencia Estratégica del Riesgo (ERIR®) completo, riguroso y exhaustivo en formato Markdown estructurado.

DIRECTRICES CRÍTICAS:
1. Denomina este informe "Informe Ejecutivo de Inteligencia Estratégica del Riesgo (ERIR®)".
2. NO uses marcas comerciales. Refiérete a "Estándares GRC (ISO 31000, COSO ERM, ISO 27005)".
3. NO utilices el carácter '═' bajo ninguna circunstancia. Utiliza únicamente el separador estándar '---'.
4. Etiqueta siempre los valores financieros simulados como: *(Estimación IA)*.
`;

// ==========================================
// 📐 CAPA 3: FORMATO DE SALIDA (ERIR® ENTERPRISE EDITION)
// ==========================================
const OUTPUT_FORMAT_INSTRUCTIONS = `
INSTRUCCIONES DE FORMATO: Genera ÚNICAMENTE la estructura Markdown exacta detallada a continuación:

## 🛡️ INFORME EJECUTIVO DE INTELIGENCIA ESTRATÉGICA DEL RIESGO (ERIR®)
- **Código/ID:** [ID del Riesgo] | **Estado:** Abierto
- **Proceso Impactado:** [Proceso] | **Subproceso:** [Subproceso]
- **Categoría de Riesgo:** [Categoría] | **Clasificación ISO:** [Clasificación]
- **Líder Propietario (Owner):** [Propietario registrado o "⚠️ No Asignado en Plataforma"]
- **Severidad Residual Actual:** [CRÍTICO / ALTO / MODERADO / BAJO]

---

## 🏥 SALUD DE LA GESTIÓN DEL RIESGO
**[Score]%** | [Exposición Alta/Media/Baja]
**ESTADO DE SALUD DEL RIESGO:** [CRÍTICO / DEFICIENTE / ACEPTABLE / OPTIMO]

---

## 📊 COMPARATIVO DE EXPOSICIÓN
- **Inherente (Sin Controles):** [Inh]% 🔴
- **Residual (Actual):** [Res]% 🟠
- **Objetivo (Target Deseado):** 20% 🟢

---

## 🚦 SEMÁFORO Y MAPA DE CONTROL EJECUTIVO
| Indicador | Estado | Diagnóstico Rápido |
| --- | --- | --- |
| **Criticidad Preliminar** | 🔴 Alto | Falla de gobernanza o controles débiles. |
| **Calidad del Registro** | [🔴 Deficiente / 🟢 Excelente] | [Falta asignación / Propietario asignado]. |
| **Nivel de Madurez** | 🔴 Baja (Inicial) | Gestión estructurada del proceso. |
| **Exposición Real** | 🔴 Alta | Requiere atención de la alta gerencia. |
| **Prioridad de Atención** | 🔴 Inmediata | Nivel de urgencia gerencial. |

---

## 👔 RESUMEN EJECUTIVO (Vista 2 Minutos)
> **Opinión Profesional del Socio Director:** [Redacta aquí un análisis exhaustivo y profesional sobre el impacto estratégico de este riesgo en la operación, fallas de control e imprevistos financieros].

- **Pérdida Esperada (ALE):** 💰 $[Monto Estimado] USD ⚡ *(Estimación IA)*
- **Confianza de Análisis IA:** 94% ★★★★★
- **Tiempo Estimado para Recuperación:** ⏱️ ≈ 6-9 Meses

---

## 🎯 ALINEACIÓN CON OBJETIVOS ESTRATÉGICOS
| Objetivo Estratégico | Nivel de Impacto | Diagnóstico de Exposición |
| --- | --- | --- |
| **1. Protección Patrimonial** | 🔴 Alto | Vulnerabilidad directa a pérdidas. |
| **2. Continuidad Operacional** | 🔴 Alto | Riesgo de interrupción en actividades. |
| **3. Cumplimiento Legal** | 🟠 Medio | Exposición a hallazgos de auditoría. |

---

## 🚀 SIMULACIÓN DE EVOLUCIÓN: ¿QUÉ PASARÍA SI MEJORAMOS?
- **Estado Actual:** 15/100 🔴 (Gobernanza Deficiente)
- **+ Asignar Owner:** 30/100 🟡 (Asignación de Responsabilidad)
- **+ Ejecutar Controles:** 70/100 🟢 (Estado Aceptable y Mitigado)

---

## 🔮 IA PREDICTIVA & SCENARIO ANALYSIS
- **Probabilidad de Materialización (12 Meses):** [Probabilidad]%
- **Impacto Potencial Estimado:** $[Valor] USD
🚨 **Escenario ("Si no se hace nada"):** Incremento de vulnerabilidad a fraudes, sanciones en auditorías externas y deterioro del margen financiero.

---

## 🏛️ DICTAMEN PARA EL COMITÉ DE RIESGOS
- **Recomendación Directa:** Intervención prioritaria para establecer gobernanza y control robustos.
- **Nivel de Urgencia:** 🔴 Muy Alta
- **Fecha Sugerida de Revisión:** 15 Días

---

## 📌 VEREDICTO EJECUTIVO
**VEREDICTO:** Este riesgo NO se encuentra bajo un nivel de control aceptable. Se recomienda intervención inmediata para mitigar la exposición de gobernanza.
- **Confianza del Veredicto:** 94% ★★★★★
`;

// ==========================================
// 🧩 CAPA 2: CONTEXTUALIZADOR DE DATOS
// ==========================================
function buildRiskContext(riesgo) {
  return `
DATOS EXTRAÍDOS DEL SISTEMA PARA INFORME ERIR®:
- Código/ID: RSK-${riesgo.id ? String(riesgo.id).substring(0, 5) : '001'}
- Macroproceso: ${riesgo.macroproceso || riesgo.proceso || 'No asignado'}
- Subproceso: ${riesgo.subproceso || 'General'}
- Categoría ISO: ${riesgo.categoria || 'No asignada'}
- Clasificación: ${riesgo.clasificacionRiesgo || 'Sin clasificación'}
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
    const fullPrompt = `${SYSTEM_PROMPT_CORE}\n\n${contexto}\n\n${OUTPUT_FORMAT_INSTRUCTIONS}`;
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
    const fullPrompt = `${SYSTEM_PROMPT_CORE}\n\n${contexto}\n\n${OUTPUT_FORMAT_INSTRUCTIONS}`;
    
    const resultStream = await model.generateContentStream(fullPrompt);

    let textoAcumulado = "";
    for await (const chunk of resultStream.stream) {
      const chunkText = chunk.text();
      textoAcumulado += chunkText;
      if (onChunk) onChunk(textoAcumulado);
    }

    return textoAcumulado;
  } catch (error) {
    console.error("Error en ejecutarDictamenIAStream:", error);
    throw new Error("Error en la transmisión del informe de IA.");
  }
};