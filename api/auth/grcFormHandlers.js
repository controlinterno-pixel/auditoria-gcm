// src/handlers/grcFormHandlers.js

export const createFormHandlers = ({
  user,
  isAdmin,
  safeRiesgos,
  safeHallazgos,
  safePlanes,
  safeEvaluaciones,
  safeComites,
  safeIncidentes,
  safeCronograma,
  safeMonitoreo,
  informesAuditoria,
  editRiesgo,
  editHallazgo,
  editPlan,
  editEvaluacion,
  editComite,
  editIncidente,
  editCronograma,
  editApetito,
  editMonitoreo,
  editInformeAuditoria,
  setRiesgos,
  setHallazgos,
  setPlanes,
  setEvaluaciones,
  setComites,
  setIncidentes,
  setCronograma,
  setMonitoreo,
  setInformesAuditoria,
  setEditRiesgo,
  setEditHallazgo,
  setEditPlan,
  setEditEvaluacion,
  setEditComite,
  setEditIncidente,
  setEditCronograma,
  setEditApetito,
  setEditMonitoreo,
  setEditInformeAuditoria,
  saveToCloud,
  showNotification,
  setIsSubmitting,
  setFormResetKey,
  ejecutarDespachoGmailApi,
  defaultMeses
}) => {

  const handleRiesgoSubmit = async (e) => {
    e.preventDefault(); 
    const formData = new FormData(e.target);
    const ts = new Date().toLocaleString();
    const hoy = new Date();
    const mesActual = defaultMeses[hoy.getMonth()];
    const anioActual = hoy.getFullYear();

    let updated;
    if (editRiesgo) {
      const mod = { 
        ...editRiesgo, 
        sede: formData.get('sede'), 
        proceso: formData.get('proceso'), 
        subproceso: formData.get('subproceso') || 'General', 
        categoria: formData.get('categoria'), 
        normativa: formData.get('normativa'), 
        responsable: formData.get('responsable'), 
        descripcionControl: formData.get('control'), 
        descripcion: formData.get('descripcion'), 
        probabilidadInherente: formData.get('probInh'), 
        impactoInherente: formData.get('impInh'), 
        probabilidadResidual: formData.get('probRes'), 
        impactoResidual: formData.get('impRes'), 
        capacidadRiesgo: editRiesgo.capacidadRiesgo||null, 
        toleranciaFinanciera: editRiesgo.toleranciaFinanciera||null, 
        apetitoFinanciero: editRiesgo.apetitoFinanciero||null, 
        posturaEstrategica: editRiesgo.posturaEstrategica||null, 
        kriScore: editRiesgo.kriScore||null, 
        historialCambios: [...(editRiesgo.historialCambios || []), { fecha: ts, usuario: user?.email || 'Usuario', accion: 'Modificado en matriz' }] 
      };
      updated = safeRiesgos.map(r => String(r.id) === String(editRiesgo.id) ? mod : r); 
      setEditRiesgo(null);
    } else {
      const nuevo = { 
        id: Date.now(), 
        sede: formData.get('sede'), 
        proceso: formData.get('proceso'), 
        subproceso: formData.get('subproceso') || 'General', 
        categoria: formData.get('categoria'), 
        normativa: formData.get('normativa'), 
        responsable: formData.get('responsable'), 
        noControl: 'C-' + Math.floor(Math.random() * 100 + 100), 
        descripcionControl: formData.get('control'), 
        descripcion: formData.get('descripcion'), 
        probabilidadInherente: formData.get('probInh'), 
        impactoInherente: formData.get('impInh'), 
        probabilidadResidual: formData.get('probRes'), 
        impactoResidual: formData.get('impRes'), 
        anio: anioActual, 
        mes: mesActual, 
        historialCambios: [{ fecha: ts, usuario: user?.email || 'Usuario', accion: 'Creado' }] 
      };
      updated = [nuevo, ...safeRiesgos];
    }
    setRiesgos(updated); 
    await saveToCloud({ riesgos: updated }); 
    e.target.reset(); 
    showNotification("Riesgo estructurado.");
  };

  const handleHallazgoSubmit = async (e) => {
    e.preventDefault(); 
    const formData = new FormData(e.target);
    const ts = new Date().toLocaleString();
    const hoy = new Date();
    const mesActual = defaultMeses[hoy.getMonth()];
    const anioActual = hoy.getFullYear();

    let evidenciaUrlOut = formData.get('evidenciaUrlInput') || editHallazgo?.evidenciaUrl || '';
    const procesoVal = formData.get('proceso') || formData.get('Proceso') || 'Sin proceso';
    const subprocesoVal = formData.get('subproceso') || formData.get('Subproceso') || formData.get('subProceso') || 'General';
    
    let updated;
    if (editHallazgo) {
      const mod = { 
        ...editHallazgo, 
        idInforme: formData.get('idInforme') || '', 
        sede: formData.get('sede'), 
        ref: formData.get('ref'), 
        proceso: procesoVal,
        subproceso: subprocesoVal,
        responsable: formData.get('responsable'), 
        auditor: formData.get('auditor'), 
        titulo: formData.get('titulo'), 
        severidad: formData.get('severidad'), 
        evidenciaUrl: evidenciaUrlOut, 
        causa: formData.get('causa') || '', 
        claseObservacion: formData.get('claseObservacion') || 'Oportunidad de Mejora', 
        historialCambios: [...(editHallazgo.historialCambios || []), { fecha: ts, usuario: user?.email || 'Usuario', accion: 'Hallazgo modificado' }] 
      };
      updated = safeHallazgos.map(h => String(h.id) === String(editHallazgo.id) ? mod : h);
      setEditHallazgo(null);
    } else {
      const nuevo = { 
        id: Date.now(), 
        idInforme: formData.get('idInforme') || '', 
        sede: formData.get('sede'), 
        ref: formData.get('ref'), 
        proceso: procesoVal,
        subproceso: subprocesoVal,
        responsable: formData.get('responsable'), 
        auditor: formData.get('auditor'), 
        titulo: formData.get('titulo'), 
        severidad: formData.get('severidad'), 
        estado: 'Abierto', 
        fecha: hoy.toISOString().split('T')[0], 
        anio: anioActual, 
        mes: mesActual, 
        evidenciaUrl: evidenciaUrlOut, 
        causa: formData.get('causa') || '', 
        claseObservacion: formData.get('claseObservacion') || 'Oportunidad de Mejora', 
        historialCambios: [{ fecha: ts, usuario: user?.email || 'Usuario', accion: 'Desviación documentada' }] 
      };
      updated = [...safeHallazgos, nuevo];
    }
    setHallazgos(updated); 
    await saveToCloud({ hallazgos: updated }); 
    e.target.reset(); 
    showNotification("Hallazgo actualizado con fecha y subproceso correctos.");
  };

  return {
    handleRiesgoSubmit,
    handleHallazgoSubmit
  };
};