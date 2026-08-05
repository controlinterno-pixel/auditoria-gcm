/**
 * @file ContextBuilder.js
 * @description Higieniza, filtra y transforma datos crudos del KnowledgeManager 
 * en contexto estructurado en Markdown (optimizando la ventana de tokens).
 */

export class ContextBuilder {
  /**
   * Transforma los datos brutos recibidos en una estructura legible en Markdown.
   * 
   * @param {Object} rawData - Datos devueltos por el KnowledgeManager.
   * @param {number} [limit=10] - Cantidad máxima de registros por entidad.
   * @returns {string} Contexto formateado en texto estructurado.
   */
  static buildFormattedContext(rawData, limit = 10) {
    if (!rawData || typeof rawData !== 'object' || Object.keys(rawData).length === 0) {
      return "No hay datos o contexto relevante disponible en el sistema para esta consulta.";
    }

    let formattedSections = [];

    // 1. Procesar Riesgos
    if (Array.isArray(rawData.risks) && rawData.risks.length > 0) {
      let section = "## RIESGOS REGISTRADOS:\n";
      rawData.risks.slice(0, limit).forEach((r, idx) => {
        section += `${idx + 1}. [${r.code || 'S/C'}] ${r.title || r.name}\n`;
        section += `   - Probabilidad: ${r.probability || 'N/A'} | Impacto: ${r.impact || 'N/A'} | Nivel: ${r.level || 'No evaluado'}\n`;
        if (r.description) section += `   - Detalle: ${r.description}\n`;
      });
      formattedSections.push(section.trim());
    }

    // 2. Procesar Controles
    if (Array.isArray(rawData.controls) && rawData.controls.length > 0) {
      let section = "## CONTROLES INTERNOS:\n";
      rawData.controls.slice(0, limit).forEach((c, idx) => {
        section += `${idx + 1}. [${c.code || 'S/C'}] ${c.name || c.title}\n`;
        section += `   - Tipo: ${c.type || 'Preventivo/Detectivo'} | Estado: ${c.status || 'Activo'} | Efectividad: ${c.effectiveness || 'Sin medir'}\n`;
      });
      formattedSections.push(section.trim());
    }

    // 3. Procesar Hallazgos / Deficiencias
    if (Array.isArray(rawData.findings) && rawData.findings.length > 0) {
      let section = "## HALLAZGOS Y AUDITORÍAS:\n";
      rawData.findings.slice(0, limit).forEach((f, idx) => {
        section += `${idx + 1}. [${f.code || 'S/C'}] ${f.title || f.name}\n`;
        section += `   - Severidad: ${f.severity || 'Media'} | Estado: ${f.status || 'Abierto'}\n`;
        if (f.description) section += `   - Causa raíz: ${f.description}\n`;
      });
      formattedSections.push(section.trim());
    }

    // 4. Procesar Planes de Acción
    if (Array.isArray(rawData.plans) && rawData.plans.length > 0) {
      let section = "## PLANES DE ACCIÓN Y REMEDIACIÓN:\n";
      rawData.plans.slice(0, limit).forEach((p, idx) => {
        section += `${idx + 1}. ${p.title || p.name}\n`;
        section += `   - Responsable: ${p.responsible || 'No asignado'} | Avance: ${p.progress || 0}% | Fecha límite: ${p.dueDate || 'Pendiente'}\n`;
      });
      formattedSections.push(section.trim());
    }

    // 5. Procesar Gobierno / Normativas (ISO, Políticas, Leyes)
    if (Array.isArray(rawData.governance) && rawData.governance.length > 0) {
      let section = "## MARCOS DE GOBIERNO Y NORMATIVA:\n";
      rawData.governance.slice(0, limit).forEach((g, idx) => {
        section += `${idx + 1}. ${g.standard || g.name} (Cláusula/Art: ${g.clause || 'N/A'})\n`;
        section += `   - Requisito: ${g.requirement || g.description}\n`;
      });
      formattedSections.push(section.trim());
    }

    // 6. Métricas / Resumen numérico (si vienen agregados)
    if (rawData.metrics && typeof rawData.metrics === 'object') {
      let section = "## INDICADORES Y MÉTRICAS CLAVE:\n";
      Object.entries(rawData.metrics).forEach(([key, val]) => {
        section += `- **${key}**: ${val}\n`;
      });
      formattedSections.push(section.trim());
    }

    // Fallback limpio si los datos no encajan en listas estándar
    if (formattedSections.length === 0) {
      let section = "## INFORMACIÓN COMPLEMENTARIA DE NEGOCIO:\n";
      Object.entries(rawData).forEach(([key, val]) => {
        if (typeof val !== 'object' && val !== null) {
          section += `- **${key}**: ${val}\n`;
        }
      });
      formattedSections.push(section.trim());
    }

    return formattedSections.join("\n\n");
  }
}