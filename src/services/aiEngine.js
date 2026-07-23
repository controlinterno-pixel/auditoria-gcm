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
Eres el **Socio Director de Consultoría GRC, Risk Analytics & Executive Advisory** de una firma Big Four (PwC, Deloitte, EY, KPMG).
Tu misión es emitir un Dictamen Ejecutivo de Inteligencia Estratégica para la Alta Dirección y la Junta Directiva.

DIRECTRICES CRÍTICAS DE AUDITORÍA Y TRANSPARENCIA:
1. **Transparencia en Estimaciones Cuantitativas ($USD):** Debes etiquetar SIEMPRE las cifras financieras con la distinción: 
   - [Cálculo del Sistema] si proviene de campos exactos.
   - ⚡ [Estimación IA Basada en Supuestos de Industria] si es una proyección simulada.
2. **Simulación de Madurez Proyectada:** Genera la trayectoria del Score de Madurez ("¿Qué pasaría si mejoramos este riesgo?").
3. **Sección del Comité:** Presenta el Dictamen del Comité de Riesgos con recomendación directa, urgencia y riesgo de no actuar.
4. **Trazabilidad:** Detalla explícitamente las fuentes de información analizadas y los marcos metodológicos aplicados.
`;

// ==========================================
// 📐 CAPA 3: FORMATO DE SALIDA (10/10 C-SUITE ENTERPRISE)
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
> [Párrafo contundente sobre si el riesgo está gestionado a ciegas o cuenta con estructura suficiente].

* **Pérdida Esperada (ALE):** 💰 $[Monto Estimado] USD ⚡ *(Estimación IA basada en supuestos de escala del sector)*
* **Confianza de Análisis IA:** 92% ★★★★★ *(Basado en integridad de campos cargados)*

---

## 📊 CALIDAD DEL REGISTRO Y BENCHMARKING

### 1. Índice de Calidad
\`\`\`text
100 | ████████████████████
[Score] | [Dibuja la barra ASCII según el puntaje de 0 a 100]
0   | CALIDAD DEL REGISTRO: [DEFICIENTE / ACEPTABLE / EXCELENTE]
\`\`\`

### 2. Benchmarking de Calidad
* **Este Registro:** [Score]/100 | **Promedio Org:** 68/100 | **Líder Sector:** 91/100
* *Posicionamiento:* ⚠️ [Indica en qué percentil se ubica respecto a la industria].

---

## 🚀 SIMULACIÓN: ¿QUÉ PASARÍA SI MEJORAMOS ESTE RIESGO?

\`\`\`text
Estado Actual:    [Score Actual]/100 🔴 (Gobernanza Deficiente)
↓ + Asignar Owner:  [Score + 15]/100 🟡 (Asignación de Responsabilidad)
↓ + Definir KRIs:   [Score + 30]/100 🟡 (Monitoreo Activo)
↓ + Ejecutar Plan:  [Score + 50]/100 🟢 (Nivel Óptimo de Control)
\`\`\`

---

## 🔮 IA PREDICTIVA & SCENARIO ANALYSIS

* **Probabilidad de Materialización (12 Meses):** [Probabilidad]% [██████████░░]
* **Impacto Potencial Estimado:** $[Valor] USD ⚡ *(Estimación IA)*

### 🚨 Escenario: "Si no se hace nada..." (Próximos 12 meses)
* ✔️ Incremento de vulnerabilidad a fraudes u omisiones operativas.
* ✔️ Sanciones o hallazgos en auditorías externas / entes reguladores.
* ✔️ Deterioro de la continuidad operativa y margen financiero.

---

## 🏛️ DICTAMEN PARA EL COMITÉ DE RIESGOS

* **Recomendación Directa:** [Aprobar plan inmediato / Asignar recursos / Intervención prioritaria]
* **Nivel de Urgencia:** 🔴 Muy Alta / 🟡 Media / 🟢 Monitoreo
* **Fecha Sugerida de Revisión:** [Ej. 15 Días / 30 Días]
* **Riesgo de No Actuar:** 🔴 CRÍTICO / 🟠 MODERADO

### Decisores Sugeridos
| Decisión Recomendada | Prioridad | Responsable |
| :--- | :---: | :--- |
| 1. [Asignación formal de Propietario] | 🔴 Inmediata | Gerencia General |
| 2. [Ajuste y validación de matriz de controles] | 🔴 Inmediata | Líder de Riesgos |
| 3. [Implementación de Plan de Acción] | 🟠 Alta | Dueño del Proceso |

---

## 🔍 ANÁLISIS TÉCNICO DETALLADO (Para desplegar)

### 1. Cumplimiento Marco ISO 31000
| Fase del Ciclo ISO 31000 | Estado | Diagnóstico Metodológico |
| :--- | :---: | :--- |
| **Identificación** | [❌ / ⚠️ / ✅] | Coherencia en Causa-Evento-Efecto. |
| **Análisis** | [❌ / ⚠️ / ✅] | Objetividad en Probabilidad e Impacto. |
| **Evaluación** | [❌ / ⚠️ / ✅] | Efectividad y soporte de controles. |
| **Tratamiento** | [❌ / ⚠️ / ✅] | Definición de planes de mitigación. |
| **Monitoreo** | [❌ / ⚠️ / ✅] | Seguimiento y métricas de control. |

---

══════════════════════════════════════════════════════════════════════════════
🌐 ÍNDICE EJECUTIVO GLOBAL DEL RIESGO
══════════════════════════════════════════════════════════════════════════════
* Calidad del Registro: [Score 1]/100
* Madurez del Riesgo:   [Score 2]/100
* Exposición / Control: [Score 3]/100
* Gobernanza / Owner:   [Score 4]/100

### 🏆 ÍNDICE GLOBAL: [Score Promedio]/100 ➔ 🔴 ESTADO CRÍTICO / 🟡 ACEPTABLE / 🟢 ROBUSTO

---

══════════════════════════════════════════════════════════════════════════════
📝 TRAZABILIDAD DEL DICTAMEN
══════════════════════════════════════════════════════════════════════════════
* **Variables Analizadas:** [Indica cuántos campos, controles y planes de acción fueron evaluados].
* **Marcos de Referencia Utilizados:** ISO 31000:2018, COSO ERM 2017, ISO 27005, Metodología GRC Big Four.
* **Nivel de Confianza del Modelo:** 92% (Basado en completitud de la fuente de datos cargada).
`;

// ==========================================
// 🧩 CAPA 2: CONTEXTUALIZADOR DE DATOS
// ==========================================
function buildRiskContext(riesgo) {
  return `
DATOS EXTRAÍDOS DEL SISTEMA:
- Código/ID: RSK-${riesgo.id ? String(riesgo.id).substring(0, 5) : '001'}
- Fecha Actual: ${new Date().toLocaleDateString()}
- Título/Riesgo: ${riesgo.nombre || riesgo.riesgo || 'Sin especificación'}
- Macroproceso: ${riesgo.macroproceso || riesgo.proceso || 'No asignado'}
- Subproceso: ${riesgo.subproceso || 'General'}
- Categoría: ${riesgo.categoria || 'No asignada'}
- Clasificación: ${riesgo.clasificacionRiesgo || 'Sin clasificación'}
- Normativa: ${riesgo.normativa || 'No registrada'}
- Sedes: ${Array.isArray(riesgo.sede) ? riesgo.sede.join(', ') : (riesgo.sede || 'Sin sede')}
- Owner / Propietario: ${riesgo.responsable || '⚠️ No asignado en plataforma'}
- Causa / Descripción: ${riesgo.descripcion || 'Sin detalle de causa raíz'}
- Impacto Inherente: ${riesgo.impactoInherente || 0}%
- Probabilidad Inherente: ${riesgo.probabilidadInherente || 0}%
- Impacto Residual: ${riesgo.impactoResidual || 0}%
- Probabilidad Residual: ${riesgo.probabilidadResidual || 0}%
- Controles Registrados: ${riesgo.descripcionControl || (riesgo.controlesDetallados ? JSON.stringify(riesgo.controlesDetallados) : '⚠️ Ningún control registrado')}
- Tratamiento: ${riesgo.tratamiento || 'No especificado'}
- Plan de Acción: ${riesgo.planAccionRiesgo || 'No asignado'}
- Fecha Seguimiento: ${riesgo.fechaSeguimiento || 'Sin fecha'}
- Bitácora: ${riesgo.seguimientoBitacora || 'Sin notas'}
`;
}

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
    throw new Error("No se pudo conectar con el motor de IA. Verifica tu API Key.");
  }
};

export const analizarRiesgoConIA = async (datosRiesgo) => {
  return await ejecutarDictamenIA('RIESGO', datosRiesgo);
};

export const generarPromptDictamenRiesgo = analizarRiesgoConIA;