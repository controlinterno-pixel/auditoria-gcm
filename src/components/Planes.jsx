import React, { useState, useEffect } from 'react';

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

  // 🛠️ ESTADOS EXCLUSIVOS PARA LA NUEVA MATRIZ COMPUESTA DE TRABAJO
  const [formInformeId, setFormInformeId] = useState('');
  const [matrixState, setMatrixState] = useState({});

  // Sincroniza y carga los hallazgos y actividades existentes al cambiar de informe
  const handleInformeChange = (informeId) => {
    setFormInformeId(informeId);
    if (!informeId) {
      setMatrixState({});
      return;
    }

    const reportFindings = safeHallazgos.filter(h => String(h.idInforme) === String(informeId));
    const newState = {};

    reportFindings.forEach(h => {
      const existingActivities = safePlanes.filter(p => p.idHallazgo === h.id);
      if (existingActivities.length > 0) {
        newState[h.id] = {
          aplica: true,
          actividades: existingActivities.map(p => ({ ...p }))
        };
      } else {
        newState[h.id] = {
          aplica: true,
          actividades: [{ id: 'new-' + Math.random(), accion: '', responsable: '', fechaInicio: '', fecha: '', progreso: 0, evidenciaUrl: '', estadoWorkflow: 'Borrador' }]
        };
      }
    });
    setMatrixState(newState);
  };

  // Si se presiona el botón "Gestionar" de la tabla, abre la matriz del informe correspondiente automáticamente
  useEffect(() => {
    if (editPlan) {
      const hallazgo = safeHallazgos.find(h => h.id === editPlan.idHallazgo);
      if (hallazgo && hallazgo.idInforme) {
        handleInformeChange(hallazgo.idInforme);
      }
    }
  }, [editPlan, safeHallazgos]);

  // Funciones de gestión interna de la matriz dinámica
  const handleToggleAplica = (hallazgoId, value) => {
    setMatrixState(prev => ({
      ...prev,
      [hallazgoId]: { ...prev[hallazgoId], aplica: value }
    }));
  };

  const handleAddActivity = (hallazgoId) => {
    setMatrixState(prev => ({
      ...prev,
      [hallazgoId]: {
        ...prev[hallazgoId],
        actividades: [
          ...prev[hallazgoId].actividades,
          { id: 'new-' + Math.random(), accion: '', responsable: '', fechaInicio: '', fecha: '', progreso: 0, evidenciaUrl: '', estadoWorkflow: 'Borrador' }
        ]
      }
    }));
  };

  const handleRemoveActivity = (hallazgoId, index) => {
    setMatrixState(prev => {
      const currentActividades = [...prev[hallazgoId].actividades];
      currentActividades.splice(index, 1);
      return {
        ...prev,
        [hallazgoId]: { ...prev[hallazgoId], actividades: currentActividades }
      };
    });
  };

  const handleUpdateActivityField = (hallazgoId, index, field, value) => {
    setMatrixState(prev => {
      const currentActividades = prev[hallazgoId].actividades.map((act, idx) => {
        if (idx === index) {
          return { ...act, [field]: value };
        }
        return act;
      });
      return {
        ...prev,
        [hallazgoId]: { ...prev[hallazgoId], actividades: currentActividades }
      };
    });
  };

  // Guardado masivo y estructurado en la Base de Datos
  const handleMasterMatrixSubmit = async (e) => {
    e.preventDefault();
    if (!formInformeId) return;

    let compiledPlanes = [];
    const reportFindingsIds = safeHallazgos.filter(h => String(h.idInforme) === String(formInformeId)).map(h => h.id);

    // PEGA ESTO EN SU LUGAR:
Object.keys(matrixState).forEach(hallazgoId => {
  const stateNode = matrixState[hallazgoId];
  if (stateNode.aplica) {
    stateNode.actividades.forEach(act => {
      if (act.accion && act.accion.trim() !== '') {
        // 🧠 Extrayemos el año y mes real de la fecha elegida para sincronizar con el filtro superior
        const fechaDiligenciada = act.fecha || new Date().toISOString().split('T')[0];
        const partes = fechaDiligenciada.split('-'); 
        const anioVal = Number(partes[0]) || 2026;
        
        const mesesArray = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const mesIdx = parseInt(partes[1], 10) - 1;
        const mesVal = mesesArray[mesIdx] || "Julio";

        compiledPlanes.push({
          id: String(act.id).startsWith('new-') ? Date.now() + Math.floor(Math.random() * 10000) : Number(act.id),
          idHallazgo: Number(hallazgoId),
          accion: act.accion,
          responsable: act.responsable || 'Por asignar',
          fechaInicio: act.fechaInicio || '',
          fecha: act.fecha || '',
          progreso: Math.min(Math.max(parseInt(act.progreso || 0), 0), 100),
          estado: parseInt(act.progreso || 0) === 100 ? 'Cerrado' : 'En Proceso',
          evidenciaUrl: act.evidenciaUrl || '',
          estadoWorkflow: act.estadoWorkflow || 'Borrador',
          anio: anioVal, // 🟢 Propiedad forzada para alineación de filtros
          mes: mesVal,   // 🟢 Propiedad forzada para alineación de filtros
          historialCambios: act.historialCambios || [{ fill: new Date().toLocaleString(), accion: 'Actividad registrada en matriz masiva' }]
        });
      }
    });
  }
});
    // Filtramos los planes de otros informes para no borrarlos, y unimos los nuevos actualizados
    const cleanOtherPlanes = safePlanes.filter(p => !reportFindingsIds.includes(p.idHallazgo));
    const finalGlobalPlanes = [...cleanOtherPlanes, ...compiledPlanes];

    setPlanes(finalGlobalPlanes);
    await saveToCloud({ planes: finalGlobalPlanes });
    
    // Resetear formulario
    setFormInformeId('');
    setMatrixState({});
    setEditPlan(null);
    setFormResetKey(Date.now());
    alert("¡Matriz de planes de acción procesada y guardada en Firebase exitosamente!");
  };

  // Indexación y cruce de datos para filtros de tablas y motor de búsqueda
  let planesData = pFiltrados.map(p => {
    const hallazgo = safeHallazgos.find(h => h.id === p.idHallazgo) || {};
    const informe = informesAuditoria.find(inf => String(inf.id) === String(hallazgo.idInforme)) || {};
    
    return { 
      ...p, 
      fechaVal: formatSafeDate(p.fecha),
      estadoWorkflow: p.estadoWorkflow || 'Borrador',
      planRefTexto: `#PLAN-${p.id} PLAN-${p.id}`,
      hallazgoRefTexto: `#HAL-${p.idHallazgo} HAL-${p.idHallazgo} ${hallazgo.proceso || ''} ${hallazgo.sede || ''}`,
      accionTexto: `${p.accion} ${p.responsable || ''}`,
      textoHallazgoTitulo: hallazgo.titulo || '',
      textoInformeRef: informe.ref || '',
      textoInformeTitulo: informe.titulo || ''
    };
  });

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
          script.onerror = () => reject(new Error('Fallo al descargar jsPDF.'));
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
          script.onerror = () => reject(new Error('Fallo al descargar autotable.'));
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
        <h2 className="text-2xl font-black text-slate-800">✅ Matriz de Planes de Acción Gerenciales</h2>
        <button 
          onClick={exportarPlanMejoramientoPDF} 
          disabled={isGeneratingPdf}
          className="bg-[#297A38] hover:bg-[#1f5c2a] disabled:bg-slate-400 text-white px-5 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-md transition-all flex items-center space-x-2 border border-[#1f5c2a]"
        >
          <span className="text-sm">{isGeneratingPdf ? '⏳' : '📄'}</span>
          <span>{isGeneratingPdf ? 'Generando...' : 'Generar PDF Oficial'}</span>
        </button>
      </div>  
      
      {/* 🚀 NUEVA INTERFAZ PREMIUM: GESTOR DE MATRICES MASIVAS POR INFORME */}
      <div id="edit-form" className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-6">
        <div className="border-b pb-3 flex justify-between items-center">
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
            ➕ Formular Acciones por Informe Emitido
          </h3>
          {formInformeId && (
            <button onClick={() => handleInformeChange('')} className="text-[10px] text-red-500 font-bold uppercase hover:underline">
              ✖️ Limpiar Matriz
            </button>
          )}
        </div>

        <div className="w-full">
          <label className="font-black text-gray-700 block mb-1.5 text-xs">1. Seleccione el Informe Emitido Evaluado</label>
          <select 
            value={formInformeId} 
            onChange={(e) => handleInformeChange(e.target.value)}
            className="w-full border-2 border-slate-300 rounded-xl p-3 bg-white font-black text-slate-800 focus:ring-2 focus:ring-blue-600 outline-none text-xs shadow-sm"
          >
            <option value="">-- Seleccione el Informe de Auditoría Radicado --</option>
            {informesAuditoria.map((inf) => (
              <option key={inf.id} value={inf.id}>[{inf.ref}] {inf.titulo} — ({inf.proceso})</option>
            ))}
          </select>
        </div>

        {formInformeId && (
          <form onSubmit={handleMasterMatrixSubmit} className="space-y-6">
            <div className="text-xs font-black text-blue-800 uppercase tracking-widest bg-blue-50/50 border border-blue-100 p-3 rounded-xl">
              📝 Desglose de hallazgos encontrados para este informe:
            </div>

            {safeHallazgos.filter(h => String(h.idInforme) === String(formInformeId)).length === 0 ? (
              <div className="text-center p-6 text-slate-400 font-bold italic border rounded-xl bg-slate-50">
                No se registran hallazgos vinculados a este informe en el sistema. Vaya al módulo de Hallazgos primero.
              </div>
            ) : (
              safeHallazgos.filter(h => String(h.idInforme) === String(formInformeId)).map((h) => {
                const node = matrixState[h.id] || { aplica: true, actividades: [] };
                return (
                  <div key={`matrix-card-${h.id}`} className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50 space-y-4 shadow-sm">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-3 gap-2">
                      <div>
                        <span className="px-2 py-0.5 bg-red-100 text-red-800 font-black rounded text-[9px] uppercase tracking-wider">
                          {h.ref}
                        </span>
                        <h4 className="text-xs font-black text-slate-900 mt-1">{h.titulo}</h4>
                        <p className="text-[10px] text-slate-500 font-medium">Proceso: <b>{h.proceso}</b> | Causa Raíz: <i>{h.causa || 'No descrita'}</i></p>
                      </div>
                      
                      {/* Botonera de Aplicabilidad */}
                      <div className="flex items-center space-x-1 shrink-0 bg-white p-1 rounded-lg border shadow-sm">
                        <button 
                          type="button" 
                          onClick={() => handleToggleAplica(h.id, true)}
                          className={`px-3 py-1.5 rounded-md font-bold text-[10px] uppercase tracking-wider transition-all ${node.aplica ? 'bg-blue-600 text-white shadow-sm':'text-slate-500 hover:bg-slate-100'}`}
                        >
                          Sí Aplica
                        </button>
                        <button 
                          type="button" 
                          onClick={() => handleToggleAplica(h.id, false)}
                          className={`px-3 py-1.5 rounded-md font-bold text-[10px] uppercase tracking-wider transition-all ${!node.aplica ? 'bg-slate-400 text-white shadow-sm':'text-slate-500 hover:bg-slate-100'}`}
                        >
                          No Aplica
                        </button>
                      </div>
                    </div>

                    {node.aplica && (
                      <div className="space-y-4">
                        {node.actividades.map((act, index) => (
                          <div key={`act-row-${index}`} className="bg-white border rounded-xl p-4 shadow-sm space-y-3 relative">
                            <div className="flex justify-between items-center border-b pb-1">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Actividad #{index + 1}</span>
                              {node.actividades.length > 1 && (
                                <button 
                                  type="button" 
                                  onClick={() => handleRemoveActivity(h.id, index)}
                                  className="text-red-500 font-bold hover:text-red-700 text-[10px] uppercase"
                                >
                                  🗑️ Quitar
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                              <div className="md:col-span-2">
                                <label className="font-bold text-gray-500 block mb-0.5">Acción o Actividad Correctiva</label>
                                <input 
                                  type="text"
                                  value={act.accion}
                                  onChange={(e) => handleUpdateActivityField(h.id, index, 'accion', e.target.value)}
                                  placeholder="Describa la tarea mitigante..."
                                  className="w-full border p-2 rounded-lg font-medium bg-slate-50 focus:bg-white"
                                  required
                                />
                              </div>
                              <div>
                                <label className="font-bold text-gray-500 block mb-0.5">Responsable Ejecución</label>
                                <input 
                                  type="text"
                                  value={act.responsable}
                                  onChange={(e) => handleUpdateActivityField(h.id, index, 'responsable', e.target.value)}
                                  placeholder="Cargo o nombre..."
                                  className="w-full border p-2 rounded-lg font-medium bg-slate-50 focus:bg-white"
                                  required
                                />
                              </div>
                              <div>
                                <label className="font-bold text-gray-500 block mb-0.5">Avance Real ({act.progreso}%)</label>
                                <input 
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={act.progreso}
                                  onChange={(e) => handleUpdateActivityField(h.id, index, 'progreso', e.target.value)}
                                  className="w-full border p-2 rounded-lg font-black text-blue-700 bg-blue-50/50"
                                />
                              </div>
                              <div>
                                <label className="font-bold text-gray-500 block mb-0.5">Fecha de Inicio</label>
                                <input 
                                  type="date"
                                  value={act.fechaInicio}
                                  onChange={(e) => handleUpdateActivityField(h.id, index, 'fechaInicio', e.target.value)}
                                  className="w-full border p-1.5 rounded-lg font-bold"
                                />
                              </div>
                              <div>
                                <label className="font-bold text-gray-500 block mb-0.5">Fecha de Compromiso</label>
                                <input 
                                  type="date"
                                  value={formatSafeDate(act.fecha)}
                                  onChange={(e) => handleUpdateActivityField(h.id, index, 'fecha', e.target.value)}
                                  className="w-full border p-1.5 rounded-lg font-bold"
                                />
                              </div>
                              <div className="md:col-span-2">
                                <label className="font-bold text-gray-500 block mb-0.5">Link de la Evidencia / Soporte Digital</label>
                                <input 
                                  type="url"
                                  value={act.evidenciaUrl}
                                  onChange={(e) => handleUpdateActivityField(h.id, index, 'evidenciaUrl', e.target.value)}
                                  placeholder="https://drive.google.com/..."
                                  className="w-full border p-2 rounded-lg text-xs"
                                />
                              </div>
                            </div>
                            <div className="pt-1">
                              <ProgressBar progress={act.progreso} />
                            </div>
                          </div>
                        ))}

                        <button 
                          type="button"
                          onClick={() => handleAddActivity(h.id)}
                          className="bg-white border-2 border-dashed border-slate-300 hover:border-blue-500 text-blue-600 font-bold py-2 px-4 rounded-xl text-[10px] uppercase tracking-wider shadow-sm transition-all"
                        >
                          ➕ Agregar Otra Actividad para este Hallazgo
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            <div className="pt-4 border-t flex justify-end">
              <button 
                type="submit"
                className="bg-[#004d40] hover:bg-[#003d33] text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest shadow-md transition-all text-xs"
              >
                💾 Guardar Matriz de Mejoramiento Completa
              </button>
            </div>
          </form>
        )}
      </div>

      {/* TABLA DE SEGUIMIENTO CON FILTROS INTEGRADOS POR TÍTULO */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b flex flex-col md:flex-row justify-between items-center bg-slate-50 gap-3">
           <h3 className="font-bold text-slate-700 uppercase text-xs tracking-widest">Seguimiento de Actividades / Planes</h3>
           
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
                    
                    <div className="text-[10px] text-slate-500 font-medium space-y-0.5 mt-1.5 bg-slate-50 p-2 rounded border border-slate-100">
                      <div>👤 Resp: <b className="text-slate-700">{p.responsable}</b></div>
                      {p.fechaInicio && <div>📅 Inicio: <b className="text-slate-700">{formatSafeDate(p.fechaInicio)}</b></div>}
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
                      Gestionar
                    </button>
                    
                    {isAdmin && (
                      <button 
                        onClick={() => handleDeleteItem('planes', p.id)} 
                        disabled={p.estadoWorkflow !== 'Borrador'}
                        className="bg-red-50 text-red-700 font-bold px-2 py-1 rounded text-[10px] disabled:opacity-20 disabled:cursor-not-allowed hover:bg-red-100 transition-colors"
                        title={p.estadoWorkflow !== 'Borrador' ? "No se puede eliminar un plan publicado" : "Eliminar borrador"}
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