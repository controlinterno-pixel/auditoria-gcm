/**
 * @file ContextBuilder.js
 * @description Construye el mapa de contexto relacional 360° para el LLM,
 * unificando Riesgos, Evaluaciones de Controles, Hallazgos, CAPA e Eventos de Pérdida.
 */

export class ContextBuilder {
  static buildFormattedContext(rawData, limit = 15) {
    if (!rawData || typeof rawData !== 'object' || Object.keys(rawData).length === 0) {
      return "No hay datos o contexto relevante disponible en el sistema para esta consulta.";
    }

    let formattedSections = [];

    // 1. Procesar Riesgos
    if (Array.isArray(rawData.risks) && rawData.risks.length > 0) {
      let section = "## 1. MATRIZ DE RIESGOS:\n";
      rawData.risks.slice(0, limit).forEach((r, idx) => {
        const code = r.id || r.code || `RSK-${idx + 1}`;
        const prob = r.probabilidadResidual || r.probability || 'N/A';
        const imp = r.impactoResidual || r.impact || 'N/A';
        const controlId = r.noControl || r.controlId || 'N/A';
        const controlDesc = r.descripcionControl || r.controlDescription || 'N/A';
        const process = r.proceso || r.process || 'N/A';
        
        section += `${idx + 1}. [CÓDIGO: ${code}] ${r.descripcion || r.title || r.name || 'Sin descripción'}\n`;
        section += `   - Proceso: ${process} | Probabilidad Residual: ${prob} | Impacto Residual: ${imp}\n`;
        section += `   - Control Asociado: [${controlId}] ${controlDesc}\n`;
      });
      formattedSections.push(section.trim());
    }

    // 2. Procesar Pruebas / Evaluaciones de Controles (Trabajo de Campo)
    if (Array.isArray(rawData.controls) && rawData.controls.length > 0) {
      let section = "## 2. EVALUACIÓN Y PRUEBAS DE CONTROLES EN SITIO:\n";
      rawData.controls.slice(0, limit).forEach((c, idx) => {
        const code = c.control || c.id || `CTR-${idx + 1}`;
        const score = c.calificacion !== undefined ? `${c.calificacion}%` : (c.effectiveness || 'No evaluado');
        section += `${idx + 1}. [CONTROL: ${code}] Proceso: ${c.proceso || 'General'}\n`;
        section += `   - Eficacia Medida: ${score} | Diseño: ${c.diseno || 'N/A'} | Ejecución: ${c.ejecucion || 'N/A'}\n`;
        if (c.comentarios) section += `   - Observación Auditoría: ${c.comentarios}\n`;
      });
      formattedSections.push(section.trim());
    }

    // 3. Procesar Hallazgos y Deficiencias
    if (Array.isArray(rawData.findings) && rawData.findings.length > 0) {
      let section = "## 3. HALLAZGOS Y DEFICIENCIAS ABIERTAS:\n";
      rawData.findings.slice(0, limit).forEach((f, idx) => {
        const code = f.ref || f.id || `HAL-${idx + 1}`;
        section += `${idx + 1}. [CÓDIGO: ${code}] ${f.titulo || f.title || f.descripcion}\n`;
        section += `   - Proceso: ${f.proceso || 'N/A'} | Severidad: ${f.severidad || f.severity || 'Media'} | Estado: ${f.estado || f.status || 'Abierto'}\n`;
        if (f.causa || f.description) section += `   - Causa Raíz / Detalle: ${f.causa || f.description}\n`;
      });
      formattedSections.push(section.trim());
    }

    // 4. Procesar Planes de Acción (CAPA)
    if (Array.isArray(rawData.plans) && rawData.plans.length > 0) {
      let section = "## 4. PLANES DE ACCIÓN Y REMEDIACIÓN (CAPA):\n";
      rawData.plans.slice(0, limit).forEach((p, idx) => {
        const code = p.id || `PLA-${idx + 1}`;
        const refHallazgo = p.idHallazgo ? ` (Vinculado a Hallazgo ID: ${p.idHallazgo})` : '';
        section += `${idx + 1}. [PLAN ID: ${code}] ${p.accion || p.title || p.name}${refHallazgo}\n`;
        section += `   - Responsable: ${p.responsable || p.responsible || 'No asignado'} | Avance: ${p.progreso || p.progress || 0}% | Estado Workflow: ${p.estadoWorkflow || p.estado || 'En Proceso'}\n`;
        if (p.fecha) section += `   - Fecha Compromiso: ${p.fecha}\n`;
      });
      formattedSections.push(section.trim());
    }

    // 5. Procesar Eventos de Pérdida e Incidentes Operativos
    if (Array.isArray(rawData.incidents) && rawData.incidents.length > 0) {
      let section = "## 5. EVENTOS DE PÉRDIDA E INCIDENTES MATERIALIZADOS:\n";
      rawData.incidents.slice(0, limit).forEach((i, idx) => {
        const code = i.id || `INC-${idx + 1}`;
        section += `${idx + 1}. [INCIDENTE ID: ${code}] ${i.titulo || i.title} (Proceso: ${i.proceso || 'N/A'})\n`;
        section += `   - Impacto Financiero -> Faltante: $${i.montoFaltante || 0} | Sobrante: $${i.montoSobrante || 0}\n`;
        if (i.descripcion) section += `   - Detalle del Evento: ${i.descripcion}\n`;
      });
      formattedSections.push(section.trim());
    }

    // 6. Procesar Gobierno y Marcos Normativos
    if (Array.isArray(rawData.governance) && rawData.governance.length > 0) {
      let section = "## 6. MARCOS NORMATIVOS Y POLÍTICAS DE GOBIERNO:\n";
      rawData.governance.slice(0, limit).forEach((g, idx) => {
        const code = g.code || g.id || `POL-${idx + 1}`;
        section += `${idx + 1}. [CÓDIGO: ${code}] ${g.standard || g.norma || g.name}\n`;
        section += `   - Cumplimiento: ${g.complianceLevel || g.cumplimiento || 'N/A'} | Requisito: ${g.requirement || g.description || 'N/A'}\n`;
      });
      formattedSections.push(section.trim());
    }

    if (formattedSections.length === 0) {
      return "No se encontraron registros estructurados en el contexto interno.";
    }

    return formattedSections.join("\n\n");
  }
}