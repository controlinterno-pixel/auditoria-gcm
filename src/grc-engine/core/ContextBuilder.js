/**
 * @file ContextBuilder.js
 * @description Higieniza y transforma los datos crudos en contexto estructurado
 * mapeando dinámicamente las llaves en español e inglés para los especialistas.
 */

export class ContextBuilder {
  static buildFormattedContext(rawData, limit = 10) {
    if (!rawData || typeof rawData !== 'object' || Object.keys(rawData).length === 0) {
      return "No hay datos o contexto relevante disponible en el sistema para esta consulta.";
    }

    let formattedSections = [];

    // 1. Procesar Riesgos (Alineado con risk.md y la fórmula de criticidad)
    if (Array.isArray(rawData.risks) && rawData.risks.length > 0) {
      let section = "## RIESGOS REGISTRADOS EN EL SISTEMA:\n";
      rawData.risks.slice(0, limit).forEach((r, idx) => {
        const code = r.id || r.code || `RSK-${idx + 1}`;
        const prob = r.probabilidadResidual || r.probability || 'N/A';
        const imp = r.impactoResidual || r.impact || 'N/A';
        const controlId = r.noControl || r.controlId || 'N/A';
        const controlDesc = r.descripcionControl || r.controlDescription || 'N/A';
        const process = r.proceso || r.process || 'N/A';
        
        section += `${idx + 1}. [CÓDIGO: ${code}] ${r.descripcion || r.title || r.name || 'Sin descripción'}\n`;
        section += `   - probabilidadResidual: ${prob} | impactoResidual: ${imp}\n`;
        section += `   - proceso: ${process} | noControl: ${controlId} | descripcionControl: ${controlDesc}\n`;
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
        if (c.description || c.descripcion) section += `   - Cobertura/Diseño: ${c.description || c.descripcion}\n`;
      });
      formattedSections.push(section.trim());
    }

    // 3. Procesar Hallazgos / Deficiencias
    if (Array.isArray(rawData.findings) && rawData.findings.length > 0) {
      let section = "## HALLAZGOS Y DEFICIENCIAS DE AUDITORÍA:\n";
      rawData.findings.slice(0, limit).forEach((f, idx) => {
        const code = f.code || f.id || `HAL-${idx + 1}`;
        section += `${idx + 1}. [CÓDIGO: ${code}] ${f.title || f.name || f.descripcion}\n`;
        section += `   - Severidad/Criticidad: ${f.severity || f.severidad || 'Media'} | Estado Actual: ${f.status || f.estado || 'Abierto'}\n`;
        if (f.description || f.detalle) section += `   - Detalle/Causa Raíz: ${f.description || f.detalle}\n`;
      });
      formattedSections.push(section.trim());
    }

    // 4. Procesar Planes de Acción
    if (Array.isArray(rawData.plans) && rawData.plans.length > 0) {
      let section = "## PLANES DE ACCIÓN Y MITIGACIÓN:\n";
      rawData.plans.slice(0, limit).forEach((p, idx) => {
        const code = p.code || p.id || `PLA-${idx + 1}`;
        section += `${idx + 1}. [CÓDIGO: ${code}] ${p.title || p.name}\n`;
        section += `   - Responsable: ${p.responsible || p.responsable || 'No asignado'} | % Avance: ${p.progress || p.avance || 0}% | Fecha Límite: ${p.dueDate || p.fechaLimite || 'Pendiente'}\n`;
      });
      formattedSections.push(section.trim());
    }

    // 5. Procesar Gobierno / Normativas
    if (Array.isArray(rawData.governance) && rawData.governance.length > 0) {
      let section = "## MARCOS NORMATIVOS Y DE GOBIERNO:\n";
      rawData.governance.slice(0, limit).forEach((g, idx) => {
        const code = g.code || g.id || `POL-${idx + 1}`;
        section += `${idx + 1}. [CÓDIGO: ${code}] ${g.standard || g.norma || g.name} (Requisito/Cláusula: ${g.clause || g.clausula || 'N/A'})\n`;
        section += `   - Nivel de Cumplimiento: ${g.complianceLevel || g.cumplimiento || 'N/A'} | Detalle: ${g.requirement || g.description || g.descripcion}\n`;
      });
      formattedSections.push(section.trim());
    }

    if (formattedSections.length === 0) {
      return "No se encontraron registros estructurados en el contexto interno.";
    }

    return formattedSections.join("\n\n");
  }
}