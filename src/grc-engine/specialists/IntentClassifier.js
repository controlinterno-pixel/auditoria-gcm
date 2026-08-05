export class IntentClassifier {
  /**
   * Analiza la consulta del usuario y determina la intención y el dominio.
   * @param {string} query - La consulta original del usuario.
   * @returns {Object} El nodo de clasificación para el ExecutionContext.
   */
  static classify(query) {
    // Normalizamos el texto para facilitar la búsqueda
    const normalizedQuery = query.toLowerCase();
    
    let intent = "UNKNOWN";
    let domain = "GENERAL";

    // 1. Detección de Intención (¿Qué quiere hacer el usuario?)
    if (normalizedQuery.match(/(analiza|evalúa|revisa|matriz|identifica)/)) {
      intent = "ANALYZE";
    } else if (normalizedQuery.match(/(norma|ley|decreto|regulación|iso)/)) {
      intent = "QUERY_REGULATION";
    } else if (normalizedQuery.match(/(reporte|informe|resumen)/)) {
      intent = "GENERATE_REPORT";
    }

    // 2. Detección de Dominio (¿Sobre qué tema trata?)
    if (normalizedQuery.match(/(riesgo|amenaza|vulnerabilidad|mitigación)/)) {
      domain = "RISK";
    } else if (normalizedQuery.match(/(cumplimiento|auditoría|hallazgo)/)) {
      domain = "COMPLIANCE";
    } else if (normalizedQuery.match(/(termales|agua|operación|instalaciones)/)) {
      domain = "OPERATIONS";
    }

    return {
      intent,
      domain,
      requiresClarification: intent === "UNKNOWN"
    };
  }
}