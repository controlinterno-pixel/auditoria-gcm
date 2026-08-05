/**
 * @file ContextBuilder.js
 * @description Higieniza y transforma los datos crudos en contexto estructurado
 * para que el LLM entienda perfectamente los códigos y metadatos GRC.
 */

export class ContextBuilder {
  static buildFormattedContext(rawData, limit = 10) {
    if (!rawData || typeof rawData !== 'object' || Object.keys(rawData).length === 0) {
      return "No hay datos o contexto relevante disponible en el sistema para esta consulta.";
    }

    let formattedSections = [];

    // 1. Procesar Riesgos
    if (Array.isArray(rawData.risks) && rawData.risks.length > 0) {
      let section = "## RIESGOS REGISTRADOS EN EL SISTEMA:\n";
      rawData.risks.slice(0, limit).forEach((r, idx) => {
        const code = r.code || r.id || `RSK-${idx + 1}`;
        section += `${idx + 1}. [CÓDIGO: ${code}] ${r.title || r.name}\n`;
        section += `   - Impacto: ${r.impact || 'N/A'} | Probabilidad: ${r.probability || 'N/A'} | Nivel de Riesgo: ${r.level || r.residualScore || 'No evaluado'}\n`;
        if (r.description) section += `   - Descripción del evento: ${r.description}\n`;
      });
      formattedSections.push(section.trim());
    }

    // 2. Procesar Controles
    if (Array.isArray(rawData.controls) && rawData.controls.length > 0) {
      let section = "## CONTROLES INTERNOS EVALUADOS:\n";
      rawData.controls.slice(0, limit).forEach((c, idx) => {
        const code = c.code || c.id || `CTR-${idx + 1}`;
        section += `${idx + 1}. [CÓDIGO: ${code}] ${c.name || c.title}\n`;
        section += `   - Tipo: ${c.type || 'Preventivo'} | Estado: ${c.status || 'Activo'} | Efectividad: ${c.effectiveness || 'Sin medir'}\n`;
        if (c.description) section += `   - Cobertura/Diseño: ${c.description}\n`;
      });
      formattedSections.push(section.trim());
    }

    // 3. Procesar Hallazgos / Deficiencias
    if (Array.isArray(rawData.findings) && rawData.findings.length > 0) {
      let section = "## HALLAZGOS Y DEFICIENCIAS DE AUDITORÍA:\n";
      rawData.findings.slice(0, limit).forEach((f, idx) => {
        const code = f.code || f.id || `HAL-${idx + 1}`;
        section += `${idx + 1}. [CÓDIGO: ${code}] ${f.title || f.name}\n`;
        section += `   - Severidad/Criticidad: ${f.severity || 'Media'} | Estado Actual: ${f.status || 'Abierto'}\n`;
        if (f.description) section += `   - Detalle/Causa Raíz: ${f.description}\n`;
      });
      formattedSections.push(section.trim());
    }

    // 4. Procesar Planes de Acción
    if (Array.isArray(rawData.plans) && rawData.plans.length > 0) {
      let section = "## PLANES DE ACCIÓN Y MITIGACIÓN:\n";
      rawData.plans.slice(0, limit).forEach((p, idx) => {
        const code = p.code || p.id || `PLA-${idx + 1}`;
        section += `${idx + 1}. [CÓDIGO: ${code}] ${p.title || p.name}\n`;
        section += `   - Responsable: ${p.responsible || 'No asignado'} | % Avance: ${p.progress || 0}% | Fecha Límite: ${p.dueDate || 'Pendiente'}\n`;
      });
      formattedSections.push(section.trim());
    }

    // 5. Procesar Gobierno / Normativas
    if (Array.isArray(rawData.governance) && rawData.governance.length > 0) {
      let section = "## MARCOS NORMATIVOS Y DE GOBIERNO:\n";
      rawData.governance.slice(0, limit).forEach((g, idx) => {
        const code = g.code || g.id || `POL-${idx + 1}`;
        section += `${idx + 1}. [CÓDIGO: ${code}] ${g.standard || g.name} (Requisito/Cláusula: ${g.clause || 'N/A'})\n`;
        section += `   - Nivel de Cumplimiento: ${g.complianceLevel || 'N/A'} | Detalle: ${g.requirement || g.description}\n`;
      });
      formattedSections.push(section.trim());
    }

    if (formattedSections.length === 0) {
      return "No se encontraron registros estructurados en el contexto interno.";
    }

    return formattedSections.join("\n\n");
  }
}