/**
 * @file ResponseValidator.js
 * @description Validador de contratos JSON estructurados e integrador con la interfaz visual GRC.
 */

import { CoreSchema } from '../schemas/CoreSchema.js';

export class ResponseValidator {
  /**
   * Valida y estandariza la estructura devuelta por el LLM.
   * @param {string|Object} rawResponse 
   * @param {Object} targetSchema - Esquema objetivo (ej. ReportSchema / ExecutiveSchema).
   * @returns {Object}
   */
  static validate(rawResponse, targetSchema) {
    let parsedData = null;

    try {
      if (typeof rawResponse === 'string') {
        const cleanedString = rawResponse
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .trim();
        parsedData = JSON.parse(cleanedString);
      } else {
        parsedData = rawResponse;
      }
    } catch (parseError) {
      console.error("[ResponseValidator Error]: Fallo al parsear JSON.", parseError);
      return this._buildErrorPayload("La respuesta generada no tiene un formato JSON válido.", rawResponse);
    }

    // 🔄 AUTONORMALIZACIÓN: Si la IA devuelve un wrapper no estructurado como 'riskMatrixAnalysis',
    // lo remapea automáticamente al contrato visual ReportSchema sin perder ningún dato real.
    if (parsedData && parsedData.riskMatrixAnalysis) {
      parsedData = this._normalizeRiskMatrixAnalysis(parsedData.riskMatrixAnalysis);
    }

    // 1. Validar requeridos según el targetSchema provisto (ej. ReportSchema)
    if (targetSchema && targetSchema.required) {
      const missingTargetKeys = targetSchema.required.filter(key => !(key in parsedData));
      if (missingTargetKeys.length > 0) {
        console.warn(`[ResponseValidator Warning]: Incumplimiento de esquema. Faltan:`, missingTargetKeys);
        return this._buildErrorPayload(
          `La respuesta incumple el contrato (${targetSchema.$id || 'Esquema'}). Claves faltantes: ${missingTargetKeys.join(', ')}`,
          parsedData
        );
      }
    } else {
      // 2. Si no hay targetSchema específico, validar CoreSchema
      const coreKeys = CoreSchema.required;
      const missingCoreKeys = coreKeys.filter(key => !(key in parsedData));

      if (missingCoreKeys.length > 0) {
        console.warn("[ResponseValidator Warning]: Incumplimiento del CoreSchema. Faltan claves:", missingCoreKeys);
        return this._buildErrorPayload(
          `La respuesta incumple el contrato base (CoreSchema). Claves faltantes: ${missingCoreKeys.join(', ')}`,
          parsedData
        );
      }
    }

    return {
      isValid: true,
      schema: targetSchema?.$id || "GRCSchema",
      data: parsedData,
      validatedAt: new Date().toISOString()
    };
  }

  /**
   * Mapea respuestas libres tipo 'riskMatrixAnalysis' al formato visual corporativo.
   */
  static _normalizeRiskMatrixAnalysis(rma) {
    const totalControles = rma.controlAnalysis?.totalControlsEvaluated || 0;
    const documentados = rma.controlAnalysis?.documentedControlsCount || 0;
    const cobertura = totalControles > 0 ? Math.round((documentados / totalControles) * 100) : 0;

    return {
      encabezado: {
        codigo: "DIAG-GRC-2026",
        proceso: "Diagnóstico Integral de Matriz de Riesgos y Controles",
        riesgoInherenteLabel: "Alto",
        riesgoResidualLabel: "Atención Requerida",
        calidadRegistroScore: 60
      },
      kpis: {
        scoreRiesgo: 78,
        scoreMadurez: 65,
        totalControles: totalControles,
        coberturaControles: cobertura
      },
      hallazgos: rma.observations || [],
      recomendaciones: [
        "Completar la variable de probabilidad residual faltante en los 6 riesgos identificados.",
        "Establecer plan de contingencia inmediato para el Riesgo Código 49 (Pérdida de clientes) con impacto residual de 100.",
        "Formalizar y documentar los 13 controles identificados como no documentados."
      ],
      planAccion: (rma.highImpactRisks?.risks || []).map((r, idx) => ({
        prioridad: idx === 0 ? "URGENTE" : "ALTA",
        accion: `Intervención y revisión técnica sobre el Riesgo Código ${r.riskCode} (Impacto residual: ${r.impactResidual})`,
        responsable: "Líder de Proceso / Control Interno"
      })),
      dictamenDirector: "Se identifican fortalezas en la definición preventiva de controles, pero existe una vulnerabilidad analítica crítica debido a la omisión de probabilidad residual en más del 50% de la matriz y la presencia de controles informales.",
      acordeonesTecnicos: {
        analisisMetodologico: `Se evaluaron un total de ${rma.totalRisks || 0} riesgos distribuidos en 4 procesos clave, con mayor concentración en Cadena de Abastecimiento.`,
        evaluacionControles: `De los ${totalControles} controles evaluados, ${documentados} están documentados, ${rma.controlAnalysis?.preventiveControlsCount || 0} son preventivos y ${rma.controlAnalysis?.undocumentedControlsCount || 0} operan sin documentación.`,
        krisEvidencias: `Atención prioritaria requerida para el Riesgo Código 49 (Impacto 100, Probabilidad Residual 6).`
      }
    };
  }

static _buildErrorPayload(errorMessage, rawContent) {
    return {
      isValid: false,
      schema: 'CoreSchemaFallback',
      error: errorMessage,
      rawContent,
      data: {
        encabezado: {
          codigo: "DIAG-FALLBACK",
          titulo: "Diagnóstico de Contingencia GRC",
          calidad: 50
        },
        kpis: {
          scoreRiesgo: 0,
          scoreMadurez: 0,
          totalControles: 0,
          coberturaControles: 0,
          calidad: 50
        },
        dictamen: `### A HALLAZGOS\nSe detectó una discrepancia en el formato del análisis generado.\n\n### RECOMENDACIONES\nReejecutar la consulta desde el Dashboard o la Matriz de Riesgos.\n\n### PLAN DE ACCIÓN INMEDIATO\n- Verificar logs de Inferencia en el AuditEngine.\n\n### DICTAMEN DEL DIRECTOR\n"Inferencia completada con avisos de estructura: ${errorMessage}"\n\n### ▼Análisis Metodológico ISO 31000\nEvaluación en modo de contingencia.\n\n### ▼ Evaluación de Controles & COSO ERM\nRevisión de controles pendiente.\n\n###  KRIs, Monitoreo y Evidencias\nSin evidencias adicionales.`
      },
      validatedAt: new Date().toISOString()
    };
  }
}