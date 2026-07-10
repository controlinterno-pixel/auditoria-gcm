import React, { useState, useEffect, useMemo, useRef } from 'react';

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
  handleAprobarCierrePlan,
ejecutarDespachoGmailApi,
  formResetKey,
  setFormResetKey,
  scrollToForm,
  handleDeleteItem,
  applyFilters,
  FilterInput,
  pFiltrados,
  safeHallazgos,
  setHallazgos, 
  safePlanes,
  setPlanes,
  saveToCloud,
  formatSafeDate,
  searchTerm,
  setSearchTerm,
  columnFilters,
  handleColFilterChange,
  onUpdateItemStatus,
  informesAuditoria = [],
  defaultAnios = [],
  defaultMeses = [],
  selectedAnios = [],
  selectedMeses = [],
  toggleAnio,
  toggleMes,
  setSelectedAnios,
  setSelectedMeses,
  selectAllAnios,
  clearAllAnios,
  selectAllMeses,
  clearAllMeses  
}) {
  const [selectedInformeFilter, setSelectedInformeFilter] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const [formInformeId, setFormInformeId] = useState('');
  const [matrixState, setMatrixState] = useState({});
// ☁️ MOTOR DE SUBIDA DE EVIDENCIAS A LA API DE TERMALES
  const [uploadingCell, setUploadingCell] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileUpload = async (e, hallazgoId, index) => {
    const file = e.target.files[0];
    if (!file) return;

    // Marcamos cuál fila exacta se está subiendo
    setUploadingCell(`${hallazgoId}-${index}`);
    setUploadProgress(20);

    const formData = new FormData();
    formData.append('appName', 'controlInterno'); 
    formData.append('description', 'Evidencia de Plan de Acción'); 
    formData.append('file', file); 

    try {
      setUploadProgress(50);
      const response = await fetch('https://repos.termalessantarosa.com.co/api/archivos/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

      const data = await response.json();
      const urlFinal = `https://repos.termalessantarosa.com.co/api/archivos/auditoria/${data.appName}/${data.fileName}`;

      // Actualizamos automáticamente el campo de la url en esa fila específica
      handleUpdateActivityField(hallazgoId, index, 'evidenciaUrl', urlFinal);

      setUploadingCell(null);
      setUploadProgress(100);
      alert("🎉 ¡Evidencia guardada con éxito en el servidor de Termales!");
    } catch (err) {
      console.error(err);
      alert("Error al conectar con el servidor de archivos.");
      setUploadingCell(null);
    }
  };

  // 🔌 Estados locales para controlar la apertura de los menús desplegables
  const [showAnioDropdown, setShowAnioDropdown] = useState(false);
  const [showMesDropdown, setShowMesDropdown] = useState(false);

  // Referencias para cerrar los dropdowns si haces clic afuera
  const anioRef = useRef(null);
  const mesRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (anioRef.current && !anioRef.current.contains(event.target)) setShowAnioDropdown(false);
      if (mesRef.current && !mesRef.current.contains(event.target)) setShowMesDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const informeSeleccionadoObj = useMemo(() => {
    return informesAuditoria.find(inf => String(inf.id) === String(formInformeId));
  }, [formInformeId, informesAuditoria]);

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
        const asumeAplica = h.estado !== 'Cerrado';
        newState[h.id] = {
          aplica: asumeAplica,
          actividades: [{ 
            id: 'new-' + Math.random(), 
            accion: '', 
            responsable: '', 
            auditorAsignado: '',
            fechaInicio: '', 
            fecha: '', 
            progreso: 0, 
            evidenciaUrl: '', 
            estadoWorkflow: 'Borrador' 
          }]
        };
      }
    });
    setMatrixState(newState);
  };

  useEffect(() => {
    if (editPlan) {
      const hallazgo = safeHallazgos.find(h => h.id === editPlan.idHallazgo);
      if (hallazgo && hallazgo.idInforme) {
        handleInformeChange(hallazgo.idInforme);
      }
    }
  }, [editPlan, safeHallazgos]);

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
          { id: 'new-' + Math.random(), accion: '', responsable: '', auditorAsignado: '', fechaInicio: '', fecha: '', progreso: 0, evidenciaUrl: '', estadoWorkflow: 'Borrador' }
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

const handleMasterMatrixSubmit = async (e) => {
    e.preventDefault();
    if (!formInformeId) return;

    // 🛑 1. VALIDACIÓN DE CORREOS
    let errorCorreos = false;
    Object.keys(matrixState).forEach(hallazgoId => {
      const stateNode = matrixState[hallazgoId];
      if (stateNode.aplica) {
        stateNode.actividades.forEach(act => {
          if (act.accion && act.accion.trim() !== '') {
            if (!act.correoResponsable || act.correoResponsable.trim() === '') errorCorreos = true;
            if (act.correoResponsable !== act.correoConfirmacion) errorCorreos = true;
          }
        });
      }
    });

    if (errorCorreos) {
      alert("❌ ALERTA: Hay correos de responsables vacíos o que no coinciden en la confirmación. Por favor revíselos antes de guardar.");
      return;
    }

    let compiledPlanes = [];
    let notificacionesPendientes = []; 
    let correosLideresARadicar = new Set(); // 📧 Para agrupar los correos de los líderes únicos
    const reportFindingsIds = safeHallazgos.filter(h => String(h.idInforme) === String(formInformeId)).map(h => h.id);

    Object.keys(matrixState).forEach(hallazgoId => {
      const stateNode = matrixState[hallazgoId];
      if (stateNode.aplica) {
        stateNode.actividades.forEach(act => {
          if (act.accion && act.accion.trim() !== '') {
            const fechaDiligenciada = act.fecha || new Date().toISOString().split('T')[0];
            const partes = fechaDiligenciada.split('-'); 
            const anioVal = Number(partes[0]) || new Date().getFullYear();
            const mesesArray = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
            const mesIdx = parseInt(partes[1], 10) - 1;
            const mesVal = mesesArray[mesIdx] || "Julio";

            const progresoEntero = Math.min(Math.max(parseInt(act.progreso || 0), 0), 100);
            
            let estadoCalculado = 'En Proceso'; 
            let workflowCalculado = act.estadoWorkflow || 'Borrador';

            if (progresoEntero === 100 && workflowCalculado !== 'Cerrado' && workflowCalculado !== 'En Revisión') {
                workflowCalculado = 'En Revisión'; 
                notificacionesPendientes.push(act); 
            } else if (progresoEntero < 100) {
                workflowCalculado = 'Borrador';
            }

            // Guardamos el correo válido del líder para enviarle su comprobante
            if (act.correoResponsable && act.correoResponsable.includes('@')) {
              correosLideresARadicar.add(act.correoResponsable.trim());
            }

            compiledPlanes.push({
              id: String(act.id).startsWith('new-') ? Date.now() + Math.floor(Math.random() * 10000) : Number(act.id),
              idHallazgo: Number(hallazgoId),
              accion: act.accion,
              responsable: act.responsable || 'Por asignar',
              correoResponsable: act.correoResponsable, 
              auditorAsignado: act.auditorAsignado || 'No Asignado', 
              fechaInicio: act.fechaInicio || '',
              fecha: act.fecha || '',
              progreso: progresoEntero,
              estado: estadoCalculado, 
              evidenciaUrl: act.evidenciaUrl || '',
              estadoWorkflow: workflowCalculado,
              anio: anioVal || 2026, // 🟢 ¡Corregido con éxito! 
              mes: mesVal,   
              historialCambios: act.historialCambios || [{ fecha: new Date().toLocaleString(), accion: 'Actividad registrada en matriz masiva' }]
            });
          }
        });
      }
    });

    const cleanOtherPlanes = safePlanes.filter(p => !reportFindingsIds.includes(p.idHallazgo));
    const finalGlobalPlanes = [...cleanOtherPlanes, ...compiledPlanes];

    let updatedHallazgos = [...safeHallazgos];
    let hallazgosModificados = false;

    Object.keys(matrixState).forEach(hallazgoId => {
      const stateNode = matrixState[hallazgoId];
      const hIndex = updatedHallazgos.findIndex(h => String(h.id) === String(hallazgoId));

      if (hIndex !== -1) {
        let nuevoEstado = 'Abierto';

        if (!stateNode.aplica) {
          nuevoEstado = 'Cerrado';
        } else {
          const actividadesDeEsteHallazgo = compiledPlanes.filter(p => String(p.idHallazgo) === String(hallazgoId));
          if (actividadesDeEsteHallazgo.length > 0) {
            const todasAprobadas = actividadesDeEsteHallazgo.every(act => act.estadoWorkflow === 'Cerrado');
            if (todasAprobadas) nuevoEstado = 'Cerrado'; 
          }
        }

        if (updatedHallazgos[hIndex].estado !== nuevoEstado) {
          updatedHallazgos[hIndex] = {
            ...updatedHallazgos[hIndex],
            estado: nuevoEstado,
            historialCambios: [
              ...(updatedHallazgos[hIndex].historialCambios || []),
              { fecha: new Date().toLocaleString(), accion: `Estado automatizado a ${nuevoEstado} (Validación de Planes)` }
            ]
          };
          hallazgosModificados = true;
        }
      }
    });

    setPlanes(finalGlobalPlanes);
    if (hallazgosModificados && setHallazgos) {
      setHallazgos(updatedHallazgos);
      await saveToCloud({ planes: finalGlobalPlanes, hallazgos: updatedHallazgos });
    } else {
      await saveToCloud({ planes: finalGlobalPlanes });
    }

// 📧 1. ENVIAR COMPROBANTE DE RADICACIÓN AL LÍDER (PROPUESTA ELEGANTE)
    if (correosLideresARadicar.size > 0 && ejecutarDespachoGmailApi) {
      const urlInformeBase = informeSeleccionadoObj?.evidenciaUrl || 'https://auditoria-gcm.vercel.app';
      const tituloInformeBase = informeSeleccionadoObj?.titulo || 'Plan de Acción';

      for (const correoLider of correosLideresARadicar) {
        await ejecutarDespachoGmailApi({
          ref_consecutivo: `RADICACION EXITOSA`, // 🟢 Corregido sin tildes para evitar errores de codificación en Gmail
          titulo_informe: `Tu Plan de Acción ha sido Radicado: ${tituloInformeBase}`,
          proceso_auditado: `Se han indexado tus compromisos y actividades mitigantes en el repositorio digital corporativo.`,
          enlace_pdf: urlInformeBase, 
          destinatarios: correoLider
        });
      }
    }
    // 📧 2. ENVIAR NOTIFICACIONES DE REVISIÓN AL AUDITOR (SÓLO SI LLEGÓ AL 100%)
    if (notificacionesPendientes.length > 0 && ejecutarDespachoGmailApi) {
        const diccionarioCorreos = {
            "Rodolfo González": "auditoria@termales.com.co",
            "Yehison Pineda": "controlinterno@termales.com.co",
            "Angelica Hernandez": "analista.auditoria@termales.com.co",
            "Luz Angela Chico": "analista.controlinterno@termales.com.co"
        };

for (const act of notificacionesPendientes) {
            const correoDestino = diccionarioCorreos[act.auditorAsignado] || "controlinterno@termales.com.co";
            await ejecutarDespachoGmailApi({
              ref_consecutivo: `PLAN-REVISION`, // 🟢 Corregido sin tilde
              titulo_informe: 'Plan Listo para Aprobación y Cierre',
              proceso_auditado: act.accion.substring(0, 50) + '...',
              enlace_pdf: act.evidenciaUrl || 'https://auditoria-gcm.vercel.app',
              destinatarios: correoDestino
            });
        }
        alert(`¡Guardado exitoso! Se envió el comprobante de radicación al líder y ${notificacionesPendientes.length} alertas de revisión a los auditores.`);
    } else {
        alert("¡Matriz de planes guardada y comprobante enviado al correo del responsable con éxito!");
    }
    
    setFormInformeId('');
    setMatrixState({});
    setEditPlan(null);
    setFormResetKey(Date.now());
  };


  let tableFilteredData = pFiltrados;
  if (selectedInformeFilter) {
    tableFilteredData = tableFilteredData.filter(plan => {
      const hallazgo = safeHallazgos.find(h => h.id === plan.idHallazgo) || {};
      return String(hallazgo.idInforme) === String(selectedInformeFilter);
    });
  }

  const mapaConsecutivos = useMemo(() => {
    const mapa = {};
    let contadorGeneral = 1;
    [...safePlanes].sort((a, b) => a.id - b.id).forEach((p) => {
      const anioP = p.anio || new Date().getFullYear();
      mapa[p.id] = `PLA-${anioP}-${String(contadorGeneral).padStart(3, '0')}`;
      contadorGeneral++; 
    });
    return mapa;
  }, [safePlanes]);
  
  const planesDataConConsecutivo = [...tableFilteredData].sort((a, b) => a.id - b.id).map(p => {
    const codigoPlanOficial = mapaConsecutivos[p.id] || `PLA-000`;
    const hallazgo = safeHallazgos.find(h => h.id === p.idHallazgo) || {};
    const informe = informesAuditoria.find(inf => String(inf.id) === String(hallazgo.idInforme)) || {};
    
    return { 
      ...p,
      codigoPlanOficial,
      fechaVal: formatSafeDate(p.fecha),
      estadoWorkflow: p.estadoWorkflow || 'Borrador',
      planRefTexto: `${codigoPlanOficial} PLAN-${p.id}`,
      hallazgoRefTexto: `#HAL-${p.idHallazgo} HAL-${p.idHallazgo} ${hallazgo.proceso || ''} ${hallazgo.sede || ''}`,
      accionTexto: `${p.accion} ${p.responsable || ''} ${p.auditorAsignado || ''}`,
      textoHallazgoTitulo: hallazgo.titulo || '',
      textoInformeRef: informe.ref || '',
      textoInformeTitulo: informe.titulo || ''
    };
  });

  const getWorkflowBadgeClass = (status) => {
    switch (status) {
      case 'Borrador': return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'En Revisión': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Aprobado': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Cerrado': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const exportarPlanMejoramientoPDF = async () => {
    const targetInformeId = selectedInformeFilter || formInformeId;

    if (!targetInformeId) {
      alert("📋 Por favor, seleccione un informe para saber exactamente qué actividades procesar en el PDF.");
      return;
    }

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

      const informeSeleccionado = informesAuditoria.find(inf => String(inf.id) === String(targetInformeId));
      if (informeSeleccionado) {
        fechaSuscripcion = formatSafeDate(informeSeleccionado.fecha) || fechaSuscripcion;
        fuentePlan = `Auditoría Interna - Ref: ${informeSeleccionado.ref}`;
        objetivoGeneral = `Fortalecer el proceso de [${informeSeleccionado.proceso}] mediante la mitigación de fallas y mejora operativa.`;
        descripcionPlan = informeSeleccionado.titulo;
        informeRef = informeSeleccionado.ref;
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
          ['Objetivo General:', objetivoGeneral, 'Periodo Evaluado / Informe:', `Año ${new Date().getFullYear()} • ${informeRef}`],
          ['Tipo De Plan:', 'De proceso', 'Descripción del Informe:', descripcionPlan]
        ]
      });

      const reportFindingsIds = safeHallazgos.filter(h => String(h.idInforme) === String(targetInformeId)).map(h => h.id);
      const pdfPlanesFiltrados = pFiltrados.filter(plan => reportFindingsIds.includes(plan.idHallazgo));

      const sortedPdfPlanes = [...pdfPlanesFiltrados].sort((a, b) => a.id - b.id);
      const tableData = sortedPdfPlanes.map((plan) => {
        const codigoPdf = mapaConsecutivos[plan.id] || `PLA-000`;
        const hallazgo = safeHallazgos.find(h => h.id === plan.idHallazgo) || {};
        const progresoReal = Number(plan.progreso || plan.avance || 0);
        let estadoMostrar = plan.estadoWorkflow === 'Cerrado' ? 'Cumplido' : 'Pendiente';
        if (progresoReal >= 100) estadoMostrar = 'Cerrado';

        return [
          codigoPdf, 
          hallazgo.titulo || 'Sin descripción', 
          hallazgo.causa || 'N/A', 
          hallazgo.claseObservacion || 'Oportunidad de Mejora', 
          hallazgo.proceso || 'General', 
          plan.accion, 
          plan.auditorAsignado || 'Sin Asignar',
          plan.responsable, 
          `${progresoReal}%`, 
          plan.fechaInicio ? formatSafeDate(plan.fechaInicio) : 'N/A', 
          formatSafeDate(plan.fecha) || 'No definida', 
          estadoMostrar
        ];
      });

      const firstTableY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 180;

      callAutoTable(doc, {
        startY: firstTableY + 20,
        theme: 'grid',
        headStyles: { fillColor: [11, 42, 54], textColor: 255, fontSize: 7, halign: 'center', valign: 'middle' },
        bodyStyles: { fontSize: 6.5, valign: 'middle' },
        columnStyles: {
          0: { cellWidth: 50 },   
          1: { cellWidth: 95 },  
          2: { cellWidth: 100 },  
          3: { cellWidth: 65 },   
          4: { cellWidth: 70 },   
          5: { cellWidth: 115 },  
          6: { cellWidth: 75 },   
          7: { cellWidth: 75 },   
          8: { cellWidth: 40 },   
          9: { cellWidth: 50 },   
          10: { cellWidth: 50 },  
          11: { cellWidth: 50 }   
        },
        head: [[
          'CÓDIGO', 
          'DESCRIPCIÓN HALLAZGO Y/O OBSERVACIÓN', 
          'CAUSAS RAÍZ', 
          'CLASE DE OBS.', 
          'PROCESOS VINCULADOS', 
          'ACCIONES DE MEJORAMIENTO', 
          'AUDITOR ASIGNADO', 
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

      doc.save(`Plan_de_Mejoramiento_${informeRef}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("Error crítico en renderizador de PDF:", error);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // 📝 Textos dinámicos resumidos para mostrar en el botón principal
  const textoBotonAnio = selectedAnios.length === 0 
    ? "Todos los Años" 
    : `Años: ${selectedAnios.join(', ')}`;

  const textoBotonMes = selectedMeses.length === 0 
    ? "Todos los Meses" 
    : `Meses: ${selectedMeses.map(m => m.substring(0,3)).join(', ')}`;

  return (
    <div className="space-y-6">
      
      {/* PANEL OSCURO CON BOTONES DROPDOWN INDEPENDIENTES CORREGIDO */}
      <div className="bg-[#0a1122] border border-slate-800 p-6 rounded-3xl shadow-xl flex flex-col gap-5 mb-6 relative overflow-visible z-30">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center relative z-10">
           <div>
             <h2 className="text-2xl font-black text-white tracking-wide">✅ Matriz de Planes de Acción Gerenciales</h2>
             <p className="text-xs text-slate-400 font-bold mt-1">Gestión, seguimiento y trazabilidad operativa por periodos.</p>
           </div>
           
           <button 
              onClick={exportarPlanMejoramientoPDF} 
              disabled={isGeneratingPdf}
              className="mt-4 md:mt-0 bg-[#297A38] hover:bg-[#1f5c2a] disabled:bg-slate-600 text-white px-5 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-[0_0_15px_rgba(41,122,56,0.4)] transition-all flex items-center space-x-2 border border-[#308f42] active:scale-95"
            >
              <span className="text-sm">{isGeneratingPdf ? '⏳' : '📄'}</span>
              <span>{isGeneratingPdf ? 'Generando...' : 'Generar PDF Oficial'}</span>
           </button>
        </div>
        
        {/* 📊 FILTROS COMPACTADOS EN BOTONES DESPLEGABLES */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center border-t border-slate-800/80 pt-5 relative z-10">
          
          {/* 🔵 DROPDOWN DE AÑOS CORREGIDO REAL */}
          <div className="relative w-full sm:w-56" ref={anioRef}>
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Filtrar por Año</label>
            <button
              type="button"
              onClick={() => { setShowAnioDropdown(!showAnioDropdown); setShowMesDropdown(false); }}
              className="w-full bg-slate-800 text-slate-200 font-black text-xs px-4 py-2.5 rounded-xl border border-slate-700 flex justify-between items-center transition-all hover:bg-slate-700/80"
            >
              <span className="truncate">{textoBotonAnio}</span>
              <span className="text-[10px] ml-2 text-slate-400">{showAnioDropdown ? '▲' : '▼'}</span>
            </button>
            
            {showAnioDropdown && (
              <div className="absolute top-[105%] left-0 w-full bg-[#0f172a] border border-slate-700 rounded-xl p-2 shadow-2xl z-[200] space-y-1 animate-in fade-in zoom-in-95 duration-150">
                {/* ⚡ BOTONES MASIVOS DE AÑO */}
                <div className="flex justify-between items-center border-b border-slate-800 pb-1.5 mb-1 px-1">
                  <button type="button" onClick={selectAllAnios} className="text-[10px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-wider">Marcar Todos</button>
                  <button type="button" onClick={clearAllAnios} className="text-[10px] font-black text-slate-400 hover:text-slate-300 uppercase tracking-wider">Limpiar</button>
                </div>
                
                {defaultAnios.map(anio => {
                  const activo = selectedAnios.includes(anio);
                  return (
                    <button
                      key={`drop-anio-${anio}`}
                      type="button"
                      onClick={() => toggleAnio(anio)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-between ${activo ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800'}`}
                    >
                      <span>{anio}</span>
                      {activo && <span className="text-[10px]">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 🟢 DROPDOWN DE MESES CORREGIDO REAL */}
          <div className="relative w-full sm:w-64" ref={mesRef}>
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Filtrar por Mes</label>
            <button
              type="button"
              onClick={() => { setShowMesDropdown(!showMesDropdown); setShowAnioDropdown(false); }}
              className="w-full bg-slate-800 text-slate-200 font-black text-xs px-4 py-2.5 rounded-xl border border-slate-700 flex justify-between items-center transition-all hover:bg-slate-700/80"
            >
              <span className="truncate">{textoBotonMes}</span>
              <span className="text-[10px] ml-2 text-slate-400">{showMesDropdown ? '▲' : '▼'}</span>
            </button>
            
            {showMesDropdown && (
              <div className="absolute top-[105%] left-0 w-full sm:w-72 bg-[#0f172a] border border-slate-700 rounded-xl p-2 shadow-2xl z-[200] animate-in fade-in zoom-in-95 duration-150">
                {/* ⚡ BOTONES MASIVOS DE MES */}
                <div className="flex justify-between items-center border-b border-slate-800 pb-1.5 mb-2 px-1 w-full">
                  <button type="button" onClick={selectAllMeses} className="text-[10px] font-black text-emerald-400 hover:text-emerald-300 uppercase tracking-wider">Marcar Todos</button>
                  <button type="button" onClick={clearAllMeses} className="text-[10px] font-black text-slate-400 hover:text-slate-300 uppercase tracking-wider">Limpiar</button>
                </div>

                <div className="grid grid-cols-2 gap-1">
                  {defaultMeses.map(mes => {
                    const activo = selectedMeses.includes(mes);
                    return (
                      <button
                        key={`drop-mes-${mes}`}
                        type="button"
                        onClick={() => toggleMes(mes)}
                        className={`text-left px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-between ${activo ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800'}`}
                      >
                        <span className="truncate">{mes}</span>
                        {activo && <span className="text-[9px]">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* BOTÓN REINICIAR */}
          {(selectedAnios.length > 0 || selectedMeses.length > 0) && (
            <button 
              type="button"
              onClick={() => { setSelectedAnios([]); setSelectedMeses([]); }} 
              className="sm:mt-5 h-[38px] px-4 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 rounded-xl text-[10px] font-black transition-colors uppercase tracking-wider w-full sm:w-auto"
            >
              Limpiar Filtros
            </button>
          )}
        </div>
      </div>
      
      {/* FORMULARIO DE ACCIONES */}
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

        {informeSeleccionadoObj && (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in duration-200">
            <div>
              <span className="text-[10px] font-black uppercase text-emerald-800 tracking-widest block mb-1">Informe Base de Auditoría</span>
              <p className="text-sm font-bold text-slate-900">{informeSeleccionadoObj.titulo}</p>
            </div>
            {informeSeleccionadoObj.evidenciaUrl ? (
              <a href={informeSeleccionadoObj.evidenciaUrl} target="_blank" rel="noreferrer" className="bg-emerald-600 text-white font-black px-4 py-2 rounded-lg text-xs hover:bg-emerald-700 transition-colors shadow-md flex items-center space-x-1">
                <span>📄</span> <span>Ver / Descargar Informe PDF</span>
              </a>
            ) : (
              <span className="text-xs text-slate-400 font-bold italic bg-white px-3 py-1.5 rounded-lg border border-dashed">Sin Documento Cargado</span>
            )}
          </div>
        )}

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
                  <div key={`matrix-card-${h.id}`} className={`border rounded-2xl p-5 shadow-sm space-y-4 transition-all ${node.aplica ? 'border-blue-200 bg-slate-50/50' : 'border-slate-200 bg-slate-100 opacity-60'}`}>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-3 gap-2">
                      <div className={!node.aplica ? 'line-through decoration-slate-400' : ''}>
                        <span className="px-2 py-0.5 bg-red-100 text-red-800 font-black rounded text-[9px] uppercase tracking-wider">
                          {h.ref}
                        </span>
                        <h4 className="text-xs font-black text-slate-900 mt-1">{h.titulo}</h4>
                        <p className="text-[10px] text-slate-500 font-medium">Proceso: <b>{h.proceso}</b> | Causa Raíz: <i>{h.causa || 'No descrita'}</i></p>
                      </div>
                      
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

                                                            <label className="font-bold text-gray-500 block mb-0.5">Fecha de Inicio</label>
                                <div className="grid grid-cols-1 md:grid-cols-6 gap-3 text-xs">
                              {/* FILA 1 */}
                              <div className="md:col-span-2">
                                <label className="font-bold text-gray-500 block mb-0.5">Acción o Actividad Correctiva</label>
                                <input type="text" value={act.accion} onChange={(e) => handleUpdateActivityField(h.id, index, 'accion', e.target.value)} placeholder="Describa la tarea mitigante..." className="w-full border p-2 rounded-lg font-medium bg-slate-50 focus:bg-white" required />
                              </div>
                              <div className="md:col-span-2">
                                <label className="font-bold text-gray-500 block mb-0.5">Responsable Ejecución</label>
                                <input type="text" value={act.responsable} onChange={(e) => handleUpdateActivityField(h.id, index, 'responsable', e.target.value)} placeholder="Cargo o nombre..." className="w-full border p-2 rounded-lg font-medium bg-slate-50 focus:bg-white" required />
                              </div>
                              <div className="md:col-span-2">
                                <label className="font-bold text-blue-600 block mb-0.5">Auditor de Enlace Asignado</label>
                                <select value={act.auditorAsignado} onChange={(e) => handleUpdateActivityField(h.id, index, 'auditorAsignado', e.target.value)} className="w-full border border-blue-200 p-2 rounded-lg font-black text-slate-700 bg-blue-50 focus:bg-white">
                                  <option value="">-- Asignar Auditor --</option>
                                  <option value="Rodolfo González">Rodolfo González</option>
                                  <option value="Yehison Pineda">Yehison Pineda</option>
                                  <option value="Angelica Hernandez">Angelica Hernandez</option>
                                  <option value="Luz Angela Chico">Luz Angela Chico</option>
                                </select>
                              </div>

                              {/* FILA 2: NUEVOS CORREOS */}
                              <div className="md:col-span-3">
                                <label className="font-bold text-purple-700 block mb-0.5">📧 Correo Electrónico del Responsable</label>
                                <input type="email" value={act.correoResponsable || ''} onChange={(e) => handleUpdateActivityField(h.id, index, 'correoResponsable', e.target.value)} placeholder="Ej: lider@termales.com.co" className="w-full border border-purple-200 p-2 rounded-lg font-medium bg-purple-50 focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none" required />
                              </div>
                              <div className="md:col-span-3">
                                <label className="font-bold text-purple-700 block mb-0.5">✓ Confirmar Correo Electrónico</label>
                                <input type="email" value={act.correoConfirmacion || ''} onChange={(e) => handleUpdateActivityField(h.id, index, 'correoConfirmacion', e.target.value)} placeholder="Escriba el correo nuevamente..." className={`w-full border p-2 rounded-lg font-medium focus:bg-white focus:ring-2 outline-none ${act.correoConfirmacion && act.correoResponsable !== act.correoConfirmacion ? 'border-red-400 bg-red-50 text-red-700 focus:ring-red-500' : 'border-purple-200 bg-purple-50 focus:ring-purple-500'}`} required />
                              </div>

                              {/* FILA 3 */}
                              <div className="md:col-span-1">
                                <label className="font-bold text-gray-500 block mb-0.5">Avance ({act.progreso}%)</label>
                                <input type="number" min="0" max="100" value={act.progreso} onChange={(e) => handleUpdateActivityField(h.id, index, 'progreso', e.target.value)} className="w-full border p-2 rounded-lg font-black text-blue-700 bg-blue-50/50" />
                              </div>
                              <div className="md:col-span-1">
                                <label className="font-bold text-gray-500 block mb-0.5">Fecha Inicio</label>
                                <input type="date" value={act.fechaInicio} onChange={(e) => handleUpdateActivityField(h.id, index, 'fechaInicio', e.target.value)} className="w-full border p-1.5 rounded-lg font-bold" />
                              </div>
                              <div className="md:col-span-1">
                                <label className="font-bold text-gray-500 block mb-0.5">Fecha Límite</label>
                                <input type="date" value={formatSafeDate(act.fecha)} onChange={(e) => handleUpdateActivityField(h.id, index, 'fecha', e.target.value)} className="w-full border p-1.5 rounded-lg font-bold" />
                              </div>
<div className="md:col-span-3 bg-slate-50 border border-slate-200 p-2 rounded-xl">
                                <label className="font-black text-slate-700 block mb-1 text-[10px] uppercase tracking-widest">☁️ Evidencia / Soporte Digital</label>
                                
                                {uploadingCell === `${h.id}-${index}` ? (
                                  <div className="space-y-1">
                                    <div className="w-full bg-slate-200 rounded-full h-2">
                                      <div className="bg-emerald-500 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                                    </div>
                                    <p className="text-[9px] font-bold text-slate-500">{uploadProgress}% Subiendo al servidor...</p>
                                  </div>
                                ) : act.evidenciaUrl ? (
                                  <div className="flex items-center justify-between mt-1">
                                    <a href={act.evidenciaUrl} target="_blank" rel="noreferrer" className="text-[10px] text-emerald-700 font-black hover:underline bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center space-x-1 shadow-sm">
                                      <span>✅</span><span>Ver Soporte Subido</span>
                                    </a>
                                    <label className="cursor-pointer text-[9px] font-bold text-slate-400 hover:text-blue-600 underline">
                                      Reemplazar
                                      <input type="file" className="hidden" accept=".pdf, .jpg, .png, .docx" onChange={(e) => handleFileUpload(e, h.id, index)} />
                                    </label>
                                  </div>
                                ) : (
                                  <label className="cursor-pointer flex items-center justify-center w-full border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 bg-white py-2 rounded-lg transition-colors group shadow-sm">
                                    <span className="text-lg mr-2 group-hover:scale-110 transition-transform">📂</span>
                                    <span className="text-[10px] font-bold text-slate-500 group-hover:text-emerald-700">Haz clic para subir PDF o Imagen</span>
                                    <input type="file" className="hidden" accept=".pdf, .jpg, .png, .docx" onChange={(e) => handleFileUpload(e, h.id, index)} />
                                  </label>
                                )}
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
                💾 Guardar Matriz y Sincronizar Estados
              </button>
            </div>
          </form>
        )}
      </div>

      {/* TABLA DE SEGUIMIENTO GENERAL */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b flex flex-col md:flex-row justify-between items-center bg-slate-50 gap-3">
           <h3 className="font-bold text-slate-700 uppercase text-xs tracking-widest">Seguimiento de Actividades / Planes</h3>
           
           <div className="flex flex-wrap gap-2 justify-end">
              
              {/* 🛡️ NUEVO: Filtro por Auditor Asignado */}
              <select
                value={columnFilters['auditorAsignado'] || ''}
                onChange={(e) => handleColFilterChange('auditorAsignado', e.target.value)}
                className="border border-slate-300 rounded-lg text-[10px] py-1.5 px-2 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-blue-50 font-black text-blue-800 shadow-sm"
              >
                <option value="">🛡️ Todos los Auditores</option>
                <option value="Rodolfo González">Rodolfo González</option>
                <option value="Yehison Pineda">Yehison Pineda</option>
                <option value="Angelica Hernandez">Angelica Hernandez</option>
                <option value="Luz Angela Chico">Luz Angela Chico</option>
              </select>

              {/* ⏳ NUEVO: Filtro por Estado (Pendientes de aprobar) */}
              <select
                value={columnFilters['estadoWorkflow'] || ''}
                onChange={(e) => handleColFilterChange('estadoWorkflow', e.target.value)}
                className="border border-slate-300 rounded-lg text-[10px] py-1.5 px-2 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-amber-50 font-black text-amber-800 shadow-sm"
              >
                <option value="">📋 Todas las Fases</option>
                <option value="Borrador">✏️ Borrador (En Proceso)</option>
                <option value="En Revisión">⏳ En Revisión (Por Aprobar)</option>
                <option value="Cerrado">✅ Cerradas (Aprobadas)</option>
              </select>

              {/* 📂 Filtro de Informe Original Compactado */}
              <select
                value={selectedInformeFilter}
                onChange={(e) => setSelectedInformeFilter(e.target.value)}
                className="border border-slate-300 rounded-lg text-[10px] py-1.5 px-2 focus:outline-none focus:ring-2 focus:ring-slate-800 bg-white font-bold text-slate-700 shadow-sm w-36 truncate"
              >
                <option value="">📂 Todos los Informes</option>
                {informesAuditoria.map(inf => (
                  <option key={inf.id} value={inf.id}>[{inf.ref}] {inf.titulo}</option>
                ))}
              </select>

              {/* 🔍 Buscador General Compactado */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-slate-400 text-[10px]">🔍</span>
                <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-6 pr-2 py-1.5 border border-slate-300 rounded-lg text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-slate-800 w-32 shadow-sm" />
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
            {applyFilters(planesDataConConsecutivo, searchTerm, columnFilters).map((p, index) => {
              const hallazgoAsociado = safeHallazgos.find(h => h.id === p.idHallazgo);
              return (
                <tr key={`plan-row-${p.id}-${index}`} className="hover:bg-slate-50 transition-colors">
                  
                  <td className="p-3">
                    <div className="font-black text-slate-900 text-sm bg-slate-100 px-2 py-1.5 rounded-lg border border-slate-200 inline-block text-center shadow-xs">
                      {p.codigoPlanOficial}
                    </div>
                    <div className="text-[8px] text-slate-400 font-mono mt-1 pl-1">INT: #{p.id}</div>
                  </td>
                  
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded font-black text-[9px] uppercase border tracking-wider ${getWorkflowBadgeClass(p.estadoWorkflow)}`}>
                      {p.workflowFase || p.estadoWorkflow || 'Borrador'}
                    </span>
                  </td>

                  <td className="p-3 text-red-600 font-bold">
                    {hallazgoAsociado?.ref || `#HAL-${p.idHallazgo}`}
                    <span className="text-[9px] uppercase tracking-widest text-slate-600 font-black block mt-0.5">
                      💼 {hallazgoAsociado?.proceso || 'General'}
                    </span>
                    <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold block mt-0.5">
                      📍 {hallazgoAsociado?.sede || 'Hotel'}
                    </span>
                  </td>
                  <td className="p-3 text-slate-800 font-medium">
                    <div className="font-black text-slate-900 leading-tight">{p.accion}</div>
                    
                    <div className="text-[10px] text-slate-500 font-medium space-y-0.5 mt-1.5 bg-slate-50 p-2 rounded border border-slate-100 grid grid-cols-2 gap-1">
                      <div>👤 Ejecutor: <b className="text-slate-700">{p.responsable}</b></div>
                      <div>🛡️ Auditor: <b className="text-blue-600">{p.auditorAsignado || 'N/A'}</b></div>
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
                  <td className="p-3">
                    <ProgressBar progress={p.progreso || p.avance || 0} />
                    {Number(p.progreso || 0) === 100 && (
                      <div className="text-center mt-1.5">
                        <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest">
                          ✓ Cerrado
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-center align-middle flex flex-col space-y-1.5">
                    <button 
                      onClick={() => {setEditPlan(p); setFormResetKey(Date.now()); scrollToForm();}} 
                      className="bg-amber-100 text-amber-800 font-bold px-2 py-1.5 rounded-lg text-[10px] hover:bg-amber-200 transition-colors w-full"
                    >
                      Gestionar
                    </button>
                    
                    {isAdmin && p.estadoWorkflow === 'En Revisión' && Number(p.progreso || p.avance || 0) === 100 && (
                      <button 
                        onClick={() => handleAprobarCierrePlan(p)} 
                        className="bg-emerald-600 text-white font-black px-2 py-1.5 rounded-lg text-[10px] hover:bg-emerald-700 transition-colors w-full flex justify-center items-center shadow-md animate-pulse"
                      >
                        ✅ Aprobar y Cerrar
                      </button>
                    )}

                    {isAdmin && (
                      <button 
                        onClick={() => handleDeleteItem('planes', p.id)} 
                        disabled={p.estadoWorkflow !== 'Borrador'}
                        className="bg-red-50 text-red-700 font-bold px-2 py-1.5 rounded-lg text-[10px] disabled:opacity-20 disabled:cursor-not-allowed hover:bg-red-100 transition-colors w-full"
                        title={p.estadoWorkflow !== 'Borrador' ? "No se puede eliminar un plan publicado" : "Eliminar borrador"}
                      >
                        🗑️ Eliminar
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