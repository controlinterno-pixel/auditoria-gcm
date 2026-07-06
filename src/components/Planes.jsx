import React, { useState } from 'react';

const ProgressBar = ({ progress }) => {
  const safeProgress = Math.min(Math.max(Math.round(Number(progress) || 0), 0), 100);
  let color = "bg-red-500";
  if (safeProgress >= 40) color = "bg-amber-500";
  if (safeProgress >= 80) color = "bg-emerald-500";
  
  return (
    <div className="w-full">
      <div className="flex justify-between text-[10px] font-bold mb-1">
        <span className="text-slate-500">PROGRESO</span>
        <span className="text-slate-800 notranslate" translate="no">{safeProgress}%</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all duration-1000`} style={{ width: `${safeProgress}%` }}></div>
      </div>
    </div>
  );
};

export default function Planes({
  isAdmin,
  editPlan,
  setEditPlan,
  handlePlanSubmit,
  formResetKey,
  setFormResetKey,
  scrollToForm,
  handleDeleteItem,
  applyFilters,
  FilterInput,
  pFiltrados,
  safeHallazgos,
  safePlanes,
  setPlanes,
  saveToCloud,
  formatSafeDate,
  searchTerm,
  setSearchTerm,
  columnFilters,
  handleColFilterChange,
  onUpdateItemStatus,
  informesAuditoria = []
}) {
  const [selectedInformeFilter, setSelectedInformeFilter] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // 🟢 ENRIQUECIMIENTO DE INDEXACIÓN: Cruzamos los datos de los padres para que los filtros de títulos y búsqueda general funcionen al 100%
  let planesData = pFiltrados.map(p => {
    const hallazgo = safeHallazgos.find(h => h.id === p.idHallazgo) || {};
    const informe = informesAuditoria.find(inf => String(inf.id) === String(hallazgo.idInforme)) || {};
    
    return { 
      ...p, 
      fechaVal: formatSafeDate(p.fecha),
      estadoWorkflow: p.estadoWorkflow || 'Borrador',
      
      // Mapeo de términos con y sin '#' para coincidir exactamente con el input del auditor
      planRefTexto: `#PLAN-${p.id} PLAN-${p.id}`,
      hallazgoRefTexto: `#HAL-${p.idHallazgo} HAL-${p.idHallazgo} ${hallazgo.proceso || ''} ${hallazgo.sede || ''}`,
      accionTexto: `${p.accion} ${p.responsable || ''} ${p.mecanismo || ''}`,
      
      // Inyección de textos adicionales de soporte para la Búsqueda General libre
      textoHallazgoTitulo: hallazgo.titulo || '',
      textoInformeRef: informe.ref || '',
      textoInformeTitulo: informe.titulo || ''
    };
  });

  // 🔗 FILTRADO DE COMPORTAMIENTO: Vinculación interactiva Plan -> Hallazgo -> Informe Origen
  if (selectedInformeFilter) {
    planesData = planesData.filter(plan => {
      const hallazgo = safeHallazgos.find(h => h.id === plan.idHallazgo) || {};
      return String(hallazgo.idInforme) === String(selectedInformeFilter);
    });
  }

  const getWorkflowBadgeClass = (status) => {
    switch (status) {
      case 'Borrador': return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'En Revisión': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Aprobado': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Cerrado': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  // =====================================================================
  // 🖨️ MOTOR DE EXPORTACIÓN PDF: CARGA ASÍNCRONA INTEGRAL (12 COLUMNAS)
  // =====================================================================
  const exportarPlanMejoramientoPDF = async () => {
    setIsGeneratingPdf(true);
    try {
      if (!window.jspdf || !window.jspdf.jsPDF) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
          script.onload = () => {
            if (window.jspdf && !window.jsPDF) window.jsPDF = window.jspdf.jsPDF;
            resolve();
          };
          script.onerror = () => reject(new Error('Fallo al descargar jsPDF desde el CDN central.'));
          document.head.appendChild(script);
        });
      } else if (window.jspdf && !window.jsPDF) {
        window.jsPDF = window.jspdf.jsPDF;
      }

      if (!window.autoTable && !(window.jsPDF && window.jsPDF.API && window.jsPDF.API.autoTable)) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Fallo al descargar la extensión autotable.'));
          document.head.appendChild(script);
        });
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('landscape', 'pt', 'legal');
      
      let fechaSuscripcion = new Date().toLocaleDateString();
      let fuentePlan = 'Auditoría Interna';
      let objetivoGeneral = 'Fortalecer los procesos de control mediante la alineación estratégica de planes correctivos.';
      let descripcionPlan = 'Plan de mejoramiento estructurado para dar cierre oportuno a los hallazgos y desviaciones.';
      let informeRef = 'Consolidado General';

      if (selectedInformeFilter) {
        const informeSeleccionado = informesAuditoria.find(inf => String(inf.id) === String(selectedInformeFilter));
        if (informeSeleccionado) {
          fechaSuscripcion = formatSafeDate(informeSeleccionado.fecha) || fechaSuscripcion;
          fuentePlan = `Auditoría Interna - Ref: ${informeSeleccionado.ref}`;
          objetivoGeneral = `Fortalecer el proceso de [${informeSeleccionado.proceso}] mediante la mitigación de fallas y mejora operativa.`;
          descripcionPlan = informeSeleccionado.titulo;
          informeRef = informeSeleccionado.ref;
        }
      }

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("TERMALES SANTA ROSA DE CABAL", doc.internal.pageSize.getWidth() / 2, 40, { align: "center" });
      doc.text("PLAN DE MEJORAMIENTO", doc.internal.pageSize.getWidth() / 2, 60, { align: "center" });

      const callAutoTable = (docInst, config) => {
        if (typeof docInst.autoTable === 'function') {
          docInst.autoTable(config);
        } else if (typeof window.autoTable === 'function') {
          window.autoTable(docInst, config);
        }
      };

      callAutoTable(doc, {
        startY: 80,
        theme: 'grid',
        headStyles: { fillColor: [41, 122, 56], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 8, textColor: 50 },
        body: [
          ['Fecha De Suscripción:', fechaSuscripcion, 'Fuente Del Plan De Mejora:', fuentePlan],
          ['Objetivo General:', objetivoGeneral, 'Periodo Evaluado / Informe:', `Año 2026 • ${informeRef}`],
          ['Tipo De Plan:', 'De proceso', 'Descripción del Informe:', descripcionPlan]
        ]
      });

      const tableData = planesData.map((plan, index) => {
        const hallazgo = safeHallazgos.find(h => h.id === plan.idHallazgo) || {};
        return [
          index + 1, 
          hallazgo.titulo || 'Sin descripción', 
          hallazgo.causa || 'N/A', 
          hallazgo.claseObservacion || 'Oportunidad de Mejora', 
          hallazgo.proceso || 'General', 
          plan.accion, 
          plan.mecanismo || 'Revisión Documental', 
          plan.responsable, 
          `${plan.progreso || plan.avance || 0}%`, 
          plan.fechaInicio ? formatSafeDate(plan.fechaInicio) : 'N/A', 
          plan.fechaVal || 'No definida', 
          plan.estadoWorkflow === 'Cerrado' ? 'Cumplido' : 'Pendiente' 
        ];
      });

      const firstTableY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 180;

      callAutoTable(doc, {
        startY: firstTableY + 20,
        theme: 'grid',
        headStyles: { fillColor: [11, 42, 54], textColor: 255, fontSize: 7, halign: 'center', valign: 'middle' },
        bodyStyles: { fontSize: 6.5, valign: 'middle' },
        columnStyles: {
          0: { cellWidth: 25 },   
          1: { cellWidth: 110 },  
          2: { cellWidth: 100 },  
          3: { cellWidth: 65 },   
          4: { cellWidth: 70 },   
          5: { cellWidth: 115 },  
          6: { cellWidth: 95 },   
          7: { cellWidth: 75 },   
          8: { cellWidth: 40 },   
          9: { cellWidth: 50 },   
          10: { cellWidth: 50 },  
          11: { cellWidth: 50 }   
        },
        head: [[
          'NO', 
          'DESCRIPCIÓN HALLAZGO Y/O OBSERVACIÓN', 
          'CAUSAS RAÍZ', 
          'CLASE DE OBS.', 
          'PROCESOS VINCULADOS', 
          'ACCIONES DE MEJORAMIENTO', 
          'MECANISMO DE SEGUIMIENTO', 
          'RESPONSABLE', 
          'AVANCE', 
          'FECHA INICIO', 
          'FECHA LÍMITE', 
          'ESTADO'
        ]],
        body: tableData,
      });

      const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 50 : 450;

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("__________________________________________", 100, finalY);
      doc.text("Elaborado por: LÍDER DE PROCESO", 100, finalY + 15);
      
      doc.text("__________________________________________", 600, finalY);
      doc.text("Aprobado por: CONTROL INTERNO", 600, finalY + 15);

      doc.save(`Plan_de_Mejoramiento_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("Error crítico en renderizador de PDF:", error);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b pb-4 flex justify-between items-center">
        <h2 className="text-2xl font-black text-slate-800">✅ Planes de Acción Remediales</h2>
        <button 
          onClick={exportarPlanMejoramientoPDF} 
          disabled={isGeneratingPdf}
          className="bg-[#297A38] hover:bg-[#1f5c2a] disabled:bg-slate-400 text-white px-5 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-md transition-all flex items-center space-x-2 border border-[#1f5c2a]"
        >
          <span className="text-sm">{isGeneratingPdf ? '⏳' : '📄'}</span>
          <span>{isGeneratingPdf ? 'Generando...' : 'Generar PDF Oficial'}</span>
        </button>
      </div>  
      
      <div id="edit-form" className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
        <div className="flex justify-between items-center border-b pb-2">
          <h3 className="text-xs font-bold text-slate-700 uppercase">
            {editPlan ? `✏️ Panel de Gestión del Plan #PLAN-${editPlan.id}` : '➕ Asignar Nuevo Plan de Acción'}
          </h3>
          {editPlan && (
            <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase border ${getWorkflowBadgeClass(editPlan.estadoWorkflow || 'Borrador')}`}>
              Fase: {editPlan.estadoWorkflow || 'Borrador'}
            </span>
          )}
        </div>
        
        <form onSubmit={handlePlanSubmit} key={editPlan?.id || 'nuevo-plan'} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs shadow-sm">
          
          <div className="md:col-span-4">
            <label className="font-bold text-gray-600">Hallazgo Vinculado</label>
            <select 
              name="idHallazgo" 
              defaultValue={editPlan?.idHallazgo||''} 
              required 
              disabled={editPlan && editPlan.estadoWorkflow !== 'Borrador'}
              className="w-full border rounded-lg p-2 mt-1 bg-white disabled:bg-slate-100 disabled:text-slate-500 font-medium"
            >
              <option value="">-- Seleccione el hallazgo raíz --</option>
              {safeHallazgos.map((h, index) => (
                <option key={`opt-hallz-${h.id}-${index}`} value={h.id}>[#HAL-{h.id}] {h.titulo}</option>
              ))}
            </select>
          </div>
          
          <div className="md:col-span-2">
            <label className="font-bold text-gray-600 block mb-1">Acción de Choque / Mitigación</label>
            <input 
              name="accion" 
              defaultValue={editPlan?.accion||''} 
              required 
              placeholder="Describa la acción correctiva..." 
              disabled={editPlan && editPlan.estadoWorkflow !== 'Borrador'}
              className="w-full border p-2 rounded disabled:bg-slate-100 disabled:text-slate-500 font-medium" 
            />
          </div>

          <div>
            <label className="font-bold text-gray-600">Responsable de Ejecución</label>
            <input 
              name="responsable" 
              defaultValue={editPlan?.responsable||''} 
              required 
              disabled={editPlan && editPlan.estadoWorkflow !== 'Borrador'}
              className="w-full border p-2 rounded disabled:bg-slate-100 disabled:text-slate-500 font-medium" 
            />
          </div>

          <div>
            <label className="font-bold text-gray-600">Fecha de Inicio</label>
            <input 
              name="fechaInicio" 
              type="date" 
              defaultValue={editPlan?.fechaInicio||''} 
              disabled={editPlan && editPlan.estadoWorkflow !== 'Borrador'}
              className="w-full border p-2 rounded disabled:bg-slate-100 disabled:text-slate-500 font-bold mt-1" 
            />
          </div>

          <div className="md:col-span-3">
            <label className="font-bold text-gray-600">Mecanismo de Seguimiento</label>
            <input 
              name="mecanismo" 
              placeholder="Ej: Inclusión en informe mensual, Pareto trimestral..."
              defaultValue={editPlan?.mecanismo||''} 
              disabled={editPlan && editPlan.estadoWorkflow !== 'Borrador'}
              className="w-full border p-2 rounded disabled:bg-slate-100 disabled:text-slate-500 font-medium mt-1" 
            />
          </div>

          <div>
            <label className="font-bold text-gray-600">Fecha Límite / Compromiso</label>
            <input 
              name="fecha" 
              type="date" 
              defaultValue={formatSafeDate(editPlan?.fecha)||''} 
              required 
              disabled={editPlan && editPlan.estadoWorkflow !== 'Borrador'}
              className="w-full border p-2 rounded disabled:bg-slate-100 disabled:text-slate-500 font-bold mt-1" 
            />
          </div>

          <div className="bg-blue-50/30 p-4 rounded-xl border border-blue-100 md:col-span-4 grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
            <div className="md:col-span-4 border-b pb-1 mb-1">
              <span className="text-[10px] font-black text-blue-800 uppercase tracking-wider">🗂️ Registro de Avances y Entregables (Abierto en fase Ejecución)</span>
            </div>
            
            <div>
              <label className="font-bold text-blue-700 block mb-1">% Avance Real</label>
              <input 
                type="number" 
                name="progreso" 
                min="0" 
                max="100" 
                defaultValue={editPlan?.progreso || editPlan?.avance || 0} 
                disabled={editPlan && editPlan.estadoWorkflow === 'Cerrado'}
                placeholder="Ej: 45" 
                className="w-full border p-2 bg-blue-50 border-blue-200 rounded font-black text-blue-700 disabled:bg-slate-100" 
              />
            </div>

            <div className="md:col-span-3">
              <label className="font-black text-blue-700 block mb-1">Pega el enlace del soporte / acta / foto aquí</label>
              <input 
                type="url" 
                name="evidenciaUrlInput" 
                defaultValue={editPlan?.evidenciaUrl||''} 
                disabled={editPlan && editPlan.estadoWorkflow === 'Cerrado'}
                placeholder="Ej: https://drive.google.com/file/d/..." 
                className="w-full border border-blue-200 bg-white rounded-lg p-2 text-xs shadow-inner focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100" 
              />
            </div>
          </div>
          
          <div className="md:col-span-4 flex justify-between items-center pt-4 border-t border-slate-100 mt-2">
            <div>
              {editPlan && onUpdateItemStatus && (
                <div className="flex space-x-2">
                  {editPlan.estadoWorkflow === 'Borrador' && (
                    <button type="button" onClick={() => onUpdateItemStatus('planes', editPlan.id, 'En Revisión')} className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded font-bold text-[11px] uppercase tracking-wider shadow-sm">🚀 Enviar a Revisión</button>
                  )}
                  {isAdmin && editPlan.estadoWorkflow === 'En Revisión' && (
                    <>
                      <button type="button" onClick={() => onUpdateItemStatus('planes', editPlan.id, 'Aprobado')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded font-bold text-[11px] uppercase tracking-wider shadow-sm">✅ Aprobar y Publicar</button>
                      <button type="button" onClick={() => onUpdateItemStatus('planes', editPlan.id, 'Borrador')} className="bg-rose-100 text-rose-700 hover:bg-rose-200 px-3 py-2 rounded font-bold text-[11px] uppercase tracking-wider">❌ Rechazar (Devolver)</button>
                    </>
                  )}
                  {isAdmin && editPlan.estadoWorkflow === 'Aprobado' && (Number(editPlan.progreso) === 100 || Number(editPlan.avance) === 100) && (
                    <button type="button" onClick={() => onUpdateItemStatus('planes', editPlan.id, 'Cerrado')} className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded font-black text-[11px] uppercase tracking-wider shadow-md border border-slate-700">🔒 Cerrar Plan Definitivo</button>
                  )}
                </div>
              )}
            </div>

            <div className="flex space-x-2">
              <button type="submit" disabled={editPlan && editPlan.estadoWorkflow === 'Cerrado'} className="bg-[#004d40] text-white px-6 py-2 rounded font-black uppercase tracking-widest hover:bg-[#003d33] shadow-md disabled:bg-slate-300 disabled:cursor-not-allowed">
                {editPlan ? '💾 Actualizar Datos' : '➕ Publicar como Borrador'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* TABLA DE SEGUIMIENTO CON FILTROS INTEGRADOS POR TÍTULO */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b flex flex-col md:flex-row justify-between items-center bg-slate-50 gap-3">
           <h3 className="font-bold text-slate-700 uppercase text-xs tracking-widest">Seguimiento de Planes de Acción</h3>
           
           <div className="flex flex-col md:flex-row gap-3">
              <select
                value={selectedInformeFilter}
                onChange={(e) => setSelectedInformeFilter(e.target.value)}
                className="border border-slate-300 rounded-lg text-xs py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-slate-800 bg-white font-bold text-slate-700 shadow-sm w-64"
              >
                <option value="">📂 Todos los Informes de Origen</option>
                {informesAuditoria.map(inf => (
                  <option key={inf.id} value={inf.id}>[{inf.ref}] {inf.titulo}</option>
                ))}
              </select>

              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
                <input type="text" placeholder="Búsqueda General..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 pr-4 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-slate-800 w-64 shadow-sm" />
              </div>
           </div>
        </div>
        <table className="w-full text-xs text-left divide-y">
          <thead className="bg-slate-900 text-white font-bold text-[10px] uppercase">
            <tr>
              <th className="p-3">
                <div>ID Plan</div>
                <FilterInput colKey="planRefTexto" placeholder="Filtrar por ID..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
              </th>
              <th className="p-3">
                <div>Gobernanza (Fase)</div>
                <FilterInput colKey="estadoWorkflow" placeholder="Fase..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
              </th>
              <th className="p-3">
                <div>Hallazgo / Proceso</div>
                <FilterInput colKey="hallazgoRefTexto" placeholder="Filtrar Hallazgo/Proceso..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
              </th>
              <th className="p-3">
                <div>Acción Remedial Programada</div>
                <FilterInput colKey="accionTexto" placeholder="Filtrar por Acción/Resp..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
              </th>
              <th className="p-3 w-40">
                <div>% Avance</div>
                <FilterInput colKey="progreso" placeholder="Progreso..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
              </th>
              <th className="p-3 text-center">
                <div className="mb-8">Gestión</div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y text-slate-700">
            {applyFilters(planesData, searchTerm, columnFilters).map((p, index) => {
              const hallazgoAsociado = safeHallazgos.find(h => h.id === p.idHallazgo);
              return (
                <tr key={`plan-row-${p.id}-${index}`} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-bold">#PLAN-{p.id}</td>
                  
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded font-black text-[9px] uppercase border tracking-wider ${getWorkflowBadgeClass(p.estadoWorkflow)}`}>
                      {p.estadoWorkflow}
                    </span>
                  </td>

                  <td className="p-3 text-red-600 font-bold">
                    #HAL-{p.idHallazgo}
                    <span className="text-[9px] uppercase tracking-widest text-slate-600 font-black block mt-0.5">
                      💼 {hallazgoAsociado?.proceso || 'General'}
                    </span>
                    <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold block mt-0.5">
                      📍 {hallazgoAsociado?.sede || 'Hotel'}
                    </span>
                  </td>
                  <td className="p-3 text-slate-800 font-medium">
                    <div className="font-black text-slate-900">{p.accion}</div>
                    
                    {/* Bloque Informativo de Trazabilidad */}
                    <div className="text-[10px] text-slate-500 font-medium space-y-0.5 mt-1.5 bg-slate-50 p-2 rounded border border-slate-100">
                      <div>👤 Resp: <b className="text-slate-700">{p.responsable}</b></div>
                      {p.fechaInicio && <div>📅 Inicio: <b className="text-slate-700">{formatSafeDate(p.fechaInicio)}</b></div>}
                      {p.mecanismo && <div className="truncate max-w-[280px]">⚙️ Mecanismo: <b className="text-slate-700">{p.mecanismo}</b></div>}
                      <div>🕒 Límite: <b className="text-slate-600">{p.fechaVal}</b></div>
                    </div>

                    {p.evidenciaUrl ? (
                      <div className="flex items-center space-x-2 mt-2">
                        <a href={p.evidenciaUrl} target="_blank" rel="noreferrer" className="bg-blue-50 text-blue-700 font-bold px-3 py-1.5 rounded-lg text-[10px] hover:bg-blue-100 flex items-center space-x-1 transition-colors shadow-sm">
                          <span>🔗</span><span>Ver Soporte</span>
                        </a>
                      </div>
                    ) : (
                      <div className="mt-2 text-[9px] text-slate-400 font-medium italic border border-dashed border-slate-200 inline-block px-2 py-1 rounded bg-slate-50">🚫 Sin evidencia adjunta</div>
                    )}
                  </td>
                  <td className="p-3"><ProgressBar progress={p.progreso || p.avance || 0} /></td>
                  <td className="p-3 text-center whitespace-nowrap space-x-1">
                    <button 
                      onClick={() => {setEditPlan(p); setFormResetKey(Date.now()); scrollToForm();}} 
                      className="bg-amber-100 text-amber-800 font-bold px-2 py-1 rounded text-[10px] hover:bg-amber-200 transition-colors"
                    >
                      {p.estadoWorkflow === 'Borrador' ? '✏️ Formular' : '⚙️ Gestionar'}
                    </button>
                    
                    {isAdmin && (
                      <button 
                        onClick={() => handleDeleteItem('planes', p.id)} 
                        disabled={p.estadoWorkflow !== 'Borrador'}
                        className="bg-red-50 text-red-700 font-bold px-2 py-1 rounded text-[10px] disabled:opacity-20 disabled:cursor-not-allowed hover:bg-red-100 transition-colors"
                        title={p.estadoWorkflow !== 'Borrador' ? "No se puede eliminar un plan en revisión o publicado" : "Eliminar borrador"}
                      >
                        🗑️
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}