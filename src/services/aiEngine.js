import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("⚠️ Falta la variable de entorno VITE_GEMINI_API_KEY");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// ==========================================
// 🏛️ CAPA 1: SYSTEM PROMPT (Socio Director Big Four & C-Suite Advisory)
// ==========================================
const SYSTEM_PROMPT_CORE = `
Eres el **Socio Director de Consultoría GRC, Risk Analytics & Advisory** de una firma Big Four.
Tu misión es emitir un Dictamen Ejecutivo de Inteligencia Estratégica de Riesgos para la Alta Dirección y Junta Directiva.

DIRECTRICES CRÍTICAS:
1. **Lenguaje C-Level y Cuantitativo:** Expresa el impacto en términos financieros, continuidad operacional, valor patrimonial y gobernanza.
2. **Rigor y Distinción de Datos:** Si un dato no está en el sistema, indícalo como "No registrado en sistema" para no crear falsas asunciones de integración, pero evalúa la deficiencia que eso implica.
3. **Estructura Exacta:** Debes seguir de forma rigurosa la plantilla Markdown con indicadores, gauges ASCII, matrices y benchmarks.
`;

// ==========================================
// 📐 CAPA 3: INSTRUCCIONES DE FORMATO DE SALIDA (10/10 ENTERPRISE)
// ==========================================
const OUTPUT_FORMAT_INSTRUCTIONS = `
INSTRUCCIONES DE FORMATO: Genera el dictamen utilizando ESTRICTAMENTE el siguiente marcado Markdown.

══════════════════════════════════════════════════════════════════════════════
📋 FICHA TÉCNICA DEL RIESGO
══════════════════════════════════════════════════════════════════════════════
* **Código/ID:** [ID del Riesgo] | **Estado:** Abierto / En Revisión
* **Proceso:** [Proceso] | **Subproceso:** [Subproceso]
* **Categoría ISO:** [Categoría] | **Clasificación:** [Clasificación]
* **Líder Propietario (Owner):** [Propietario registrado o "⚠️ No asignado"]
* **Nivel de Severidad:** [CRÍTICO / ALTO / MODERADO / BAJO]

---

### 🚦 SEMÁFORO Y MAPA DE CONTROL EJECUTIVO
| Indicador | Estado | Diagnóstico Rápido |
| :--- | :--- | :--- |
| **Criticidad Preliminar** | 🔴 Alto / 🟡 Medio / 🟢 Bajo | Estimación cualitativa |
| **Calidad del Registro** | 🔴 Deficiente / 🟡 Aceptable / 🟢 Excelente | Basado en completitud metodológica |
| **Nivel de Madurez** | 🔴 Baja (Inicial) / 🟡 Media / 🟢 Alta | Gestión estructurada del proceso |
| **Exposición Real** | 🟠 No Determinable / 🔴 Alta / 🟢 Aceptable | Según evidencia disponible |
| **Prioridad de Atención** | 🔴 Inmediata / 🟡 Estratégica / 🟢 Monitoreo | Nivel de urgencia gerencial |

---

## 👔 RESUMEN EJECUTIVO (Vista 2 Minutos)

> 💡 **Opinión Profesional del Socio Director:**
> [Escribe un párrafo directo y contundente: El mayor problema no es solo la amenaza, sino la incapacidad actual de medirla y gestionarla por deficiencias estructurales en el registro].

* **Pérdida Esperada / Exposición Financiera (Estimada):** 💰 [Calcula o estima un impacto financiero/patrimonial directo basado en la escala del proceso o indica el riesgo si no se valora].
* **Nivel de Confianza de IA Assistant:** 95% ★★★★★ [Ajusta según completitud de datos]

---

## 📊 CALIDAD DEL REGISTRO Y BENCHMARKING

### 1. Índice de Calidad
\`\`\`text
100 | ████████████████████
[Score] | [Dibuja la barra ASCII según el puntaje de 0 a 100]
0   | CALIDAD DEL REGISTRO: [DEFICIENTE / ACEPTABLE / EXCELENTE]
\`\`\`

### 2. Comparativo / Benchmarking de Calidad
* **Este Registro:** [Score]/100
* **Promedio Organización:** 68/100
* **Promedio Industria:** 75/100
* **Organización Líder:** 92/100
* *Posicionamiento:* ⚠️ [Indica en qué percentil o rango se ubica respecto a la industria].

### 3. Tendencia Histórica de Calidad
* **Hace 3 meses:** [Score estimado o anterior] ➔ **Hoy:** [Score Actual] | **Variación:** [Calcula % de variación]

---

## 🔮 IA PREDICTIVA & FINANCIAL RISK EXPOSURE

* **Probabilidad de Materialización Estimada (Próximos 12 Meses):** [80-95]% [██████████░░] (Muy Alta)
* **Impacto Potencial Estimado:** $[Valor en USD / Local]
* **Pérdida Esperada Estimada (ALE):** $[Impacto * Probabilidad]

### 🚨 Escenario: "Si no se hace nada..." (Próximos 12 meses)
* ✔️ Incremento de riesgo de fraude o pérdida operativa.
* ✔️ Incumplimiento o hallazgos regulatorios / observaciones de auditoría externa.
* ✔️ Ineficiencia en la asignación de capital y controles redundantes.
* ✔️ Deterioro patrimonial y reputacional directo.

---

## 📐 DIAGNÓSTICO METODOLÓGICO ISO 31000

| Fase del Ciclo ISO 31000 | Estado | Evaluación Metodológica |
| :--- | :---: | :--- |
| **1. Identificación** | [❌ / ⚠️ / ✅] | Redacción, causas y vinculación a procesos. |
| **2. Análisis** | [❌ / ⚠️ / ✅] | Estimación de probabilidad e impacto inherente. |
| **3. Evaluación** | [❌ / ⚠️ / ✅] | Solidez, tipo y efectividad de controles. |
| **4. Tratamiento** | [❌ / ⚠️ / ✅] | Planes de acción y responsables definidos. |
| **5. Monitoreo & KRI** | [❌ / ⚠️ / ✅] | Indicadores claves de riesgo y fecha de seguimiento. |

---

## 🎯 DECISIONES SUGERIDAS PARA LA ALTA DIRECCIÓN

| Decisión Recomendada | Prioridad | Responsable Sugerido |
| :--- | :---: | :--- |
| 1. [Acción clave de gobierno o asignación de dueño] | 🔴 Inmediata | Junta / Gerencia |
| 2. [Ajuste metodológico o cuantificación financiera] | 🔴 Inmediata | Líder de Riesgos |
| 3. [Diseño/Fortalecimiento de controles preventivos] | 🟠 Alta | Dueño del Proceso |
| 4. [Monitoreo e implementación de KRIs] | 🟡 Media | Auditoría Interna |

---

## 🔍 ANÁLISIS TÉCNICO DETALLADO (Desplegable)

### 1. Crítica Metodológica de Redacción
* **Estructura (Causa-Evento-Consecuencia):** [Análisis de la redacción actual]
* **Observación de Integridad:** [Distingue si los vacíos corresponden a datos no digitados en la plataforma o fallas en el diseño corporativo].

### 2. Evaluador de Solidez de Controles
* **Gaps Identificados:** [Detalle de la efectividad de los controles registrados]

---

══════════════════════════════════════════════════════════════════════════════
🌐 ÍNDICE EJECUTIVO GLOBAL DEL RIESGO
══════════════════════════════════════════════════════════════════════════════
* Calidad del Registro: [Score 1]/100
* Madurez del Riesgo:   [Score 2]/100
* Exposición / Control: [Score 3]/100
* Gobernanza / Owner:   [Score 4]/100
* Seguimiento & KRIs:   [Score 5]/100

### 🏆 ÍNDICE GLOBAL
# [Puntaje Promedio] / 100 ➔ 🔴 ESTADO CRÍTICO / 🟡 ACEPTABLE / 🟢 ROBUSTO

📌 **CONCEPTO DEL SOCIO DIRECTOR:**
[Párrafo de cierre ejecutivo de alto nivel, conectando la gobernanza del riesgo con la estrategia de negocio y la toma de decisiones del Comité de Auditoría/Junta Directiva].
`;

// ==========================================
// 🧩 CAPA 2: CONTEXTUALIZADOR DE DATOS AVANZADO
// ==========================================
function buildRiskContext(riesgo) {
  return `
DATOS EXTRAÍDOS DEL SISTEMA:
- Código/ID: RSK-${riesgo.id ? String(riesgo.id).substring(0, 5) : '001'}
- Fecha Actual de Evaluación: ${new Date().toLocaleDateString()}
- Nombre / Título del Riesgo: ${riesgo.nombre || riesgo.riesgo || 'No especificado'}
- Macroproceso: ${riesgo.macroproceso || riesgo.proceso || 'No asignado'}
- Subproceso: ${riesgo.subproceso || 'General'}
- Categoría ISO: ${riesgo.categoria || 'No asignada'}
- Clasificación: ${riesgo.clasificacionRiesgo || 'No clasificado'}
- Normativa: ${riesgo.normativa || 'No registrada en sistema'}
- Sede(s): ${Array.isArray(riesgo.sede) ? riesgo.sede.join(', ') : (riesgo.sede || 'No registrada')}
- Propietario / Owner: ${riesgo.responsable || '⚠️ No registrado en el formulario'}
- Descripción / Causa Raíz: ${riesgo.descripcion || 'Sin descripción detallada'}
- Impacto Inherente Registrado: ${riesgo.impactoInherente || 0}%
- Probabilidad Inherente Registrada: ${riesgo.probabilidadInherente || 0}%
- Impacto Residual Calculado: ${riesgo.impactoResidual || 0}%
- Probabilidad Residual Calculada: ${riesgo.probabilidadResidual || 0}%
- Controles Documentados: ${riesgo.descripcionControl || (riesgo.controlesDetallados && riesgo.controlesDetallados.length > 0 ? JSON.stringify(riesgo.controlesDetallados) : '⚠️ No figuran controles registrados en el sistema')}
- Estrategia de Tratamiento: ${riesgo.tratamiento || 'No definida'}
- Plan de Acción: ${riesgo.planAccionRiesgo || 'No registrado'}
- Fecha de Seguimiento: ${riesgo.fechaSeguimiento || 'Sin fecha asignada'}
- Bitacora / Observaciones: ${riesgo.seguimientoBitacora || 'Sin notas activas'}
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
REGISTRO EVALUADO EN SISTEMA:
${contexto}
--------------------------------------------------

${OUTPUT_FORMAT_INSTRUCTIONS}
`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    
    return response.text();
  } catch (error) {
    console.error("Error en ejecutarDictamenIA:", error);
    throw new Error("No se pudo conectar con el motor de IA. Verifica tu API Key o conexión.");
  }
};

export const analizarRiesgoConIA = async (datosRiesgo) => {
  return await ejecutarDictamenIA('RIESGO', datosRiesgo);
};

export const generarPromptDictamenRiesgo = analizarRiesgoConIA;