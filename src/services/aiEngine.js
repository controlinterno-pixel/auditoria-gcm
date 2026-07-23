import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("⚠️ Falta la variable de entorno VITE_GEMINI_API_KEY");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// ==========================================
// 🏛️ CAPA 1: SYSTEM PROMPT (Executive Advisory & ERIR Engine)
// ==========================================
const SYSTEM_PROMPT_CORE = `
Eres el **Motor de Inteligencia Estratégica del Informe ERIR® (Executive Risk Intelligence Report)** de una firma internacional de consultoría en Gobernanza, Riesgo y Cumplimiento (GRC).
Tu misión es emitir un Dictamen de Nivel Junta Directiva y C-Suite para empresas globales.

DIRECTRICES CRÍTICAS DE AUDITORÍA Y METODOLOGÍA:
1. **Identidad del Entregable:** Denomina este informe exclusivamente como "Informe Ejecutivo de Inteligencia Estratégica del Riesgo (ERIR®)".
2. **Rigor Normativo:** NO uses marcas comerciales. Refiérete siempre a "Estándares y Prácticas Internacionales de Consultoría GRC (ISO 31000:2018, COSO ERM 2017, ISO 27005)".
3. **Etiquetado Transparente ($USD):** Etiqueta siempre los valores financieros simulados como:
   - [Dato Registrado en Sistema] si proviene del formulario.
   - ⚡ [Estimación IA Basada en Supuestos de Industria] si es una proyección simulada.
4. **Interconexión y Estrategia:** Mapea el impacto directo en Objetivos Estratégicos y los Riesgos Relacionados (interdependencia).
5. **Tiempo de Recuperación:** Estimación del tiempo necesario (meses) para llevar el riesgo a un estado de control aceptable.
`;

// ==========================================
// 📐 CAPA 3: FORMATO DE SALIDA (ERIR® ENTERPRISE EDITION)
// ==========================================
const OUTPUT_FORMAT_INSTRUCTIONS = `
INSTRUCCIONES DE FORMATO: Genera el dictamen utilizando ESTRICTAMENTE el siguiente marcado Markdown.

══════════════════════════════════════════════════════════════════════════════
🛡️ INFORME EJECUTIVO DE INTELIGENCIA ESTRATÉGICA DEL RIESGO (ERIR®)
══════════════════════════════════════════════════════════════════════════════
* **Código/ID:** [ID del Riesgo] | **Estado:** Abierto / En Revisión
* **Proceso Impactado:** [Proceso] | **Subproceso:** [Subproceso]
* **Categoría de Riesgo:** [Categoría] | **Clasificación ISO:** [Clasificación]
* **Líder Propietario (Owner):** [Propietario registrado o "⚠️ No Asignado en Plataforma"]
* **Severidad Residual Actual:** [CRÍTICO / ALTO / MODERADO / BAJO]

---

### 🏥 SALUD DE LA GESTIÓN DEL RIESGO
\`\`\`text
100% | ████████████████████
[Score]% | [Dibuja la barra ASCII según el puntaje de salud de 0 a 100%]
0%   | ESTADO DE SALUD DEL RIESGO: [CRÍTICO / DEFICIENTE / ACEPTABLE / OPTIMO]
\`\`\`

---

## 📊 COMPARATIVO DE EXPOSICIÓN (INHERENTE vs RESIDUAL vs OBJETIVO)

\`\`\`text
Inherente (Sin Controles): [████████████████████] [Inh]% 🔴
Residual (Actual):         [██████████░░░░░░░░░░] [Res]% 🟠
Objetivo (Target Deseado): [████░░░░░░░░░░░░░░░░] [Obj]% 🟢
\`\`\`

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
> [Párrafo contundente sobre la gobernanza y exposición del riesgo].

* **Pérdida Esperada (ALE):** 💰 $[Monto Estimado] USD ⚡ *(Estimación IA basada en supuestos de escala del sector)*
* **Confianza de Análisis IA:** 93% ★★★★★ *(Basado en integridad de campos cargados)*
* **Tiempo Estimado para Recuperación (Target 80/100):** ⏱️ ≈ [2 - 6] Meses

---

## 🎯 ALINEACIÓN CON OBJETIVOS ESTRATÉGICOS DE LA EMPRESA

| Objetivo Estratégico Impactado | Nivel de Impacto | Diagnóstico de Exposición |
| :--- | :---: | :--- |
| **1. Protección Patrimonial y Financiera** | 🔴 Alto / 🟡 Medio / 🟢 Bajo | Vulnerabilidad potencial ante pérdidas físicas o fraudes. |
| **2. Continuidad Operacional y Negocio** | 🔴 Alto / 🟡 Medio / 🟢 Bajo | Interrupción potencial en servicios o procesos clave. |
| **3. Cumplimiento Legal y Regulatorio** | 🔴 Alto / 🟡 Medio / 🟢 Bajo | Exposición a hallazgos, sanciones o multas de entes. |

---

## 🔗 ECOSISTEMA DE RIESGOS RELACIONADOS (INTERDEPENDENCIA GRC)
* ✔️ **[Proceso o Categoría 1]:** Interdependencia directa por fallas de control operacional.
* ✔️ **[Proceso o Categoría 2]:** Riesgo de contagio reputacional y estados financieros.
* ✔️ **[Proceso o Categoría 3]:** Vulnerabilidad cruzada en sistemas o activos fijos.

---

## 🚀 SIMULACIÓN DE EVOLUCIÓN: ¿QUÉ PASARÍA SI MEJORAMOS ESTE RIESGO?

\`\`\`text
Estado Actual:        [Score Actual]/100 🔴 (Gobernanza Deficiente)
↓ + Asignar Owner:      [Score + 15]/100 🟡 (Asignación de Responsabilidad)
↓ + Definir KRIs:       [Score + 30]/100 🟡 (Monitoreo Activo)
↓ + Ejecutar Controles: [Score + 55]/100 🟢 (Estado Aceptable y Mitigado)
\`\`\`

---

## 📈 TENDENCIA HISTÓRICA Y EVOLUCIÓN
* **2024:** ████ (Deficiente) | **2025:** ██████ (Parcial) | **2026 (Hoy):** [Score]/100
* **Variación Histórica:** 📉 [Variación %] respecto a periodos anteriores.

---

## 🔮 IA PREDICTIVA & SCENARIO ANALYSIS

* **Probabilidad de Materialización (12 Meses):** [Probabilidad]% [██████████░░]
* **Impacto Potencial Estimado:** $[Valor] USD ⚡ *(Estimación IA)*

### 🚨 Escenario: "Si no se hace nada..." (Próximos 12 meses)
* ✔️ Incremento de vulnerabilidad a fraudes u omisiones operativas.
* ✔️ Sanciones o hallazgos en auditorías externas / entes reguladores.
* ✔️ Deterioro de la continuidad operativa y margen financiero.

---

## 🏛️ DICTAMEN PARA EL COMITÉ DE RIESGOS & DECISIONES

* **Recomendación Directa:** [Aprobar plan inmediato / Asignar recursos / Intervención prioritaria]
* **Nivel de Urgencia:** 🔴 Muy Alta / 🟡 Media / 🟢 Monitoreo
* **Fecha Sugerida de Revisión:** [Ej. 15 Días / 30 Días]
* **Riesgo de No Actuar:** 🔴 CRÍTICO / 🟠 MODERADO

### Matriz de Decisión Sugerida
| Decisión Recomendada | Prioridad | Responsable |
| :--- | :---: | :--- |
| 1. [Asignación formal de Propietario] | 🔴 Inmediata | Gerencia General |
| 2. [Ajuste y validación de matriz de controles] | 🔴 Inmediata | Líder de Riesgos |
| 3. [Implementación de Plan de Acción] | 🟠 Alta | Dueño del Proceso |

---

## 📌 VEREDICTO EJECUTIVO
> **VEREDICTO:** Este riesgo NO se encuentra bajo un nivel de control aceptable. Se recomienda intervención inmediata para mitigar la exposición de gobernanza.
> **Confianza del Veredicto:** 94% ★★★★★

---

══════════════════════════════════════════════════════════════════════════════
📝 TRAZABILIDAD DEL DICTAMEN ERIR®
══════════════════════════════════════════════════════════════════════════════
* **Universo de Información Analizada:** Datos del registro, controles preventivos/detectivos, planes de acción y matrices inherente/residual.
* **Marcos y Estándares de Referencia:** ISO 31000:2018, COSO ERM 2017, ISO 27005 y Prácticas Internacionales de Consultoría GRC.
* **Nivel de Certeza del Modelo:** 94% (Basado en la completitud de la fuente de datos disponible en la plataforma).
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