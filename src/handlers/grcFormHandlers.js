// src/handlers/grcFormHandlers.js
import { buildHistorialDetalle } from '../utils/historialCambios.js';

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
  prepararEnvioGmail,
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
    const subprocesoVal = formData.get('subproceso') || formData.get('Subproceso') || 'General';
    
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
    showNotification("Hallazgo actualizado.");
  };

  const handlePlanSubmit = async (e) => {
    e.preventDefault(); 
    const formData = new FormData(e.target);
    const ts = new Date().toLocaleString();
    const hoy = new Date();
    const mesActual = defaultMeses[hoy.getMonth()];
    const anioActual = hoy.getFullYear();

    let evidenciaUrlOut = formData.get('evidenciaUrlInput') || editPlan?.evidenciaUrl || '';
    const progresoVal = parseInt(formData.get('progreso') || 0);
    const fechaInicioVal = formData.get('fechaInicio') || '';
    const mecanismoVal = formData.get('mecanismo') || '';
    const idHallazgoSelected = formData.get('idHallazgo');

    let updatedList;
    let dispararCorreo = false;
    let auditorNotificar = '';

    if (editPlan && isAdmin) {
      const estadoVal = progresoVal === 100 ? 'Cerrado' : 'En Proceso';
      const workflowVal = progresoVal === 100 ? 'Cerrado' : (editPlan.estadoWorkflow || 'Borrador');
      const modificado = { 
        ...editPlan, 
        idHallazgo: idHallazgoSelected, 
        accion: formData.get('accion'), 
        responsable: formData.get('responsable'), 
        fecha: formData.get('fecha'), 
        progreso: progresoVal, 
        estado: estadoVal, 
        estadoWorkflow: workflowVal, 
        evidenciaUrl: evidenciaUrlOut, 
        fechaInicio: fechaInicioVal, 
        mecanismo: mecanismoVal, 
        historialCambios: [...(editPlan.historialCambios || []), { fecha: ts, usuario: user?.email || 'Usuario', accion: 'Plan actualizado' }] 
      };
      if(progresoVal === 100 && !modificado.fechaCierre) {
          modificado.fechaCierre = hoy.toISOString().split('T')[0];
      }
      updatedList = safePlanes.map(p => String(p.id) === String(editPlan.id) ? modificado : p);
      setEditPlan(null);
    } else if (!isAdmin) {
      const planToUpdate = safePlanes.find(p => String(p.idHallazgo) === String(idHallazgoSelected));
      if (planToUpdate) {
        let workflowVal = planToUpdate.estadoWorkflow || 'Borrador';
        if (progresoVal === 100 && workflowVal !== 'Cerrado') {
            workflowVal = 'En Revisión'; 
            dispararCorreo = true;
            auditorNotificar = planToUpdate.auditorAsignado;
        } else if (progresoVal < 100) {
            workflowVal = 'Borrador';
        }
        const mod = { 
          ...planToUpdate, 
          progreso: progresoVal, 
          estado: 'En Proceso', 
          estadoWorkflow: workflowVal, 
          evidenciaUrl: evidenciaUrlOut, 
          fechaInicio: fechaInicioVal, 
          mecanismo: mecanismoVal, 
          historialCambios: [...(planToUpdate.historialCambios || []), { fecha: ts, usuario: user?.email || 'Usuario', accion: progresoVal === 100 ? 'Reportado al 100% - Pendiente de revisión' : 'Avance reportado' }] 
        };
        updatedList = safePlanes.map(p => String(p.id) === String(planToUpdate.id) ? mod : p);
      } else {
        showNotification("Error: No se encontró el plan asociado.", "error");
        return;
      }
    } else {
      const estadoVal = progresoVal === 100 ? 'Cerrado' : 'En Proceso';
      const nuevo = { 
        id: Date.now(), 
        idHallazgo: idHallazgoSelected, 
        accion: formData.get('accion'), 
        responsable: formData.get('responsable'), 
        fecha: formData.get('fecha'), 
        progreso: progresoVal, 
        estado: estadoVal, 
        estadoWorkflow: 'Borrador', 
        anio: anioActual, 
        mes: mesActual, 
        evidenciaUrl: evidenciaUrlOut, 
        fechaInicio: fechaInicioVal, 
        mecanismo: mecanismoVal, 
        historialCambios: [{ fecha: ts, usuario: user?.email || 'Usuario', accion: 'Plan asignado' }] 
      };
      updatedList = [...safePlanes, nuevo];
    }

    if (dispararCorreo && auditorNotificar && prepararEnvioGmail && !(await prepararEnvioGmail())) return;
    const guardado = await saveToCloud({ planes: updatedList });
    if (!guardado) return;
    setPlanes(updatedList);

    if (dispararCorreo && auditorNotificar) {
        const destinatarioDinamico = user?.email || import.meta.env.VITE_CORREO_ADMIN_DEFAULT || "admin@ejemplo.com";
        const correoEnviado = await ejecutarDespachoGmailApi({
          ref_consecutivo: `APROBACION-100`, 
          titulo_informe: 'Verificar soportes cargados al 100% para proceder con el cierre',
          proceso_auditado: 'Plan de acción pendiente por aprobar', 
          enlace_pdf: evidenciaUrlOut || 'https://auditoria-gcm.vercel.app', 
          destinatarios: destinatarioDinamico 
        });
        showNotification(
          correoEnviado ? "Avance guardado y auditor notificado." : "Avance guardado, pero no se pudo enviar el correo.",
          correoEnviado ? "success" : "error"
        );
    } else {
        showNotification("Progreso del plan guardado correctamente.");
    }
    e.target.reset();
  };

  const handleAprobarCierrePlan = async (plan) => {
    if (!window.confirm("¿Aprobar evidencias y cerrar definitivamente este plan y su hallazgo vinculado?")) return;
    if (prepararEnvioGmail && !(await prepararEnvioGmail())) return;
    const ts = new Date().toLocaleString();
    const fechaCierreStr = new Date().toISOString().split('T')[0];
    const planModificado = { ...plan, estado: 'Cerrado', estadoWorkflow: 'Cerrado', progreso: 100, fechaCierre: fechaCierreStr, historialCambios: [...(plan.historialCambios || []), { fecha: ts, usuario: user?.email || 'Sistema', accion: '✅ Plan aprobado y cerrado por el Auditor' }] };
    const updatedPlanes = safePlanes.map(p => p.id === plan.id ? planModificado : p);
    let updatedHallazgos = safeHallazgos;
    const hallazgoPadre = safeHallazgos.find(h => h.id === plan.idHallazgo);
    if (hallazgoPadre) {
        const hallazgoModificado = { ...hallazgoPadre, estado: 'Cerrado', fechaCierre: fechaCierreStr, historialCambios: [...(hallazgoPadre.historialCambios || []), { fecha: ts, usuario: user?.email || 'Sistema', accion: '✅ Hallazgo cerrado' }] };
        updatedHallazgos = safeHallazgos.map(h => h.id === hallazgoPadre.id ? hallazgoModificado : h);
    }
      const guardado = await saveToCloud({ planes: updatedPlanes, hallazgos: updatedHallazgos });
      if (!guardado) return;
      if (hallazgoPadre) setHallazgos(updatedHallazgos);
      setPlanes(updatedPlanes);
    
const correoCentral = user?.email || import.meta.env.VITE_CORREO_ADMIN_DEFAULT || "controlinterno@empresa.com";
    const correoEnviado = await ejecutarDespachoGmailApi({
      ref_consecutivo: `CIERRE-PLAN-${plan.id}`,
      titulo_informe: '✅ Plan de Acción y Hallazgo Cerrados con Éxito', 
      proceso_auditado: plan.accion.substring(0, 50) + '...', 
      enlace_pdf: plan.evidenciaUrl || 'https://auditoria-gcm.vercel.app', 
      destinatarios: plan.correoResponsable || correoCentral 
    });

    showNotification(
      correoEnviado ? "Ciclo cerrado y responsable notificado." : "Ciclo cerrado, pero no se pudo enviar el correo.",
      correoEnviado ? "success" : "error"
    );
  };

  const handleEvaluacionSubmit = async (e) => {
    e.preventDefault(); 
    const formData = new FormData(e.target);
    const ts = new Date().toLocaleString();
    const hoy = new Date();
    const mesActual = defaultMeses[hoy.getMonth()];
    const anioActual = hoy.getFullYear();

    const idRiesgo = formData.get('idRiesgo');
    const noControl = formData.get('noControl');
    const calificacion = parseInt(formData.get('calificacion') || 0);

    const riesgoAsociado = safeRiesgos.find(r => String(r.id) === String(idRiesgo)) || {};
    const procesoRiesgo = riesgoAsociado.proceso || formData.get('proceso') || 'Auditoría';

    let updated;
    if (editEvaluacion) {
      const mod = { 
        ...editEvaluacion, 
        idRiesgo: idRiesgo,
        proceso: procesoRiesgo, 
        control: noControl, 
        calificacion: calificacion, 
        diseno: formData.get('diseno') || 'No evaluado', 
        ejecucion: formData.get('ejecucion') || 'No evaluado', 
        evidenciaUrl: formData.get('evidenciaUrlInput') || editEvaluacion.evidenciaUrl || '', 
        comentarios: formData.get('comentarios') || '', 
        historialCambios: [...(editEvaluacion.historialCambios || []), { fecha: ts, usuario: user?.email || 'Usuario', accion: 'Evaluación modificada' }] 
      };
      updated = safeEvaluaciones.map(ev => String(ev.id) === String(editEvaluacion.id) ? mod : ev); 
      setEditEvaluacion(null);
    } else {
      const nuevo = { 
        id: Date.now(), 
        idRiesgo: idRiesgo,
        proceso: procesoRiesgo, 
        control: noControl, 
        calificacion: calificacion, 
        diseno: formData.get('diseno') || 'No evaluado', 
        ejecucion: formData.get('ejecucion') || 'No evaluado', 
        evidenciaUrl: formData.get('evidenciaUrlInput') || '', 
        comentarios: formData.get('comentarios') || '', 
        auditor: user?.email || 'Sistema', 
        anio: anioActual, 
        mes: mesActual, 
        historialCambios: [{ fecha: ts, usuario: user?.email || 'Usuario', accion: 'Control evaluado en sitio' }] 
      };
      updated = [nuevo, ...safeEvaluaciones];
    }
    setEvaluaciones(updated); 

    let updatedHallazgos = safeHallazgos;
    let updatedRiesgos = safeRiesgos;
    
    if (calificacion < 100) {
      const generarHallazgo = window.confirm(`⚠️ Alerta de Auditoría: El control evaluado reprobó con una eficacia del ${calificacion}%.\n\n¿Deseas generar automáticamente un HALLAZGO DE AUDITORÍA para este proceso?`);

      if (riesgoAsociado.id) {
        const bitacoraPrevia = riesgoAsociado.seguimientoBitacora ? `\n---\n${riesgoAsociado.seguimientoBitacora}` : '';
        const notaBitacora = `⚠️ [${hoy.toISOString().split('T')[0]}] Auditoría en campo reprobó el control ${noControl} (${calificacion}%). ${generarHallazgo ? 'Se generó hallazgo automático.' : 'No se generó hallazgo.'}`;
        
        const riesgoActualizado = {
          ...riesgoAsociado,
          seguimientoBitacora: notaBitacora + bitacoraPrevia
        };
        updatedRiesgos = safeRiesgos.map(r => String(r.id) === String(riesgoAsociado.id) ? riesgoActualizado : r);
        setRiesgos(updatedRiesgos);
      }

      if (generarHallazgo) {
        const nuevoHallazgo = { 
          id: Date.now() + 1, 
          idInforme: '', 
          sede: riesgoAsociado.sede || (Array.isArray(riesgoAsociado.sede) ? riesgoAsociado.sede[0] : 'Administrativos'), 
          ref: 'AUD-' + Math.floor(Math.random() * 10000 + 1000), 
          proceso: procesoRiesgo,
          subproceso: riesgoAsociado.subproceso || 'General',
          responsable: Array.isArray(riesgoAsociado.responsable) ? riesgoAsociado.responsable[0] : (riesgoAsociado.responsable || 'Por Asignar'), 
          auditor: user?.email || 'Sistema', 
          titulo: `Deficiencia operativa en Control ${noControl}`, 
          severidad: calificacion === 0 ? 'Alta' : 'Media', 
          estado: 'Abierto', 
          fecha: hoy.toISOString().split('T')[0], 
          anio: anioActual, 
          mes: mesActual, 
          evidenciaUrl: formData.get('evidenciaUrlInput') || '', 
          causa: `El control diseñado para mitigar el riesgo RSK-${riesgoAsociado.id} presenta fallas. \nDiseño: ${formData.get('diseno')} | Ejecución: ${formData.get('ejecucion')}. \nComentarios del auditor: ${formData.get('comentarios')}`, 
          claseObservacion: 'Hallazgo', 
          historialCambios: [{ fecha: ts, usuario: user?.email || 'Sistema', accion: 'Autogenerado por defecto en Test de Control' }] 
        };
        updatedHallazgos = [...safeHallazgos, nuevoHallazgo];
        setHallazgos(updatedHallazgos);
        showNotification("Test guardado, Bitácora de riesgo actualizada y Hallazgo derivado con éxito.", "success");
      } else {
        showNotification("Test guardado y Bitácora de riesgo actualizada (Sin hallazgo).");
      }
    } else {
      showNotification("Evaluación guardada exitosamente. Control fuerte y eficaz.");
    }

    await saveToCloud({ evaluaciones: updated, hallazgos: updatedHallazgos, riesgos: updatedRiesgos }); 
    e.target.reset(); 
    setFormResetKey(Date.now()); 
  };

  const handleComiteSubmit = async (e) => {
    e.preventDefault(); const formData = new FormData(e.target);
    const ts = new Date().toLocaleString();
    let updated;
    if (editComite) {
      const mod = { ...editComite, nombre: formData.get('nombre'), tipo: formData.get('tipo'), fecha: formData.get('fecha'), presentacionUrl: formData.get('presentacionUrl'), actaUrl: formData.get('actaUrl'), compromisos: formData.get('compromisos'), historialCambios: [...(editComite.historialCambios || []), { fecha: ts, usuario: user?.email || 'Usuario', accion: 'Modificado' }] };
      updated = safeComites.map(c => c.id === editComite.id ? mod : c); setEditComite(null);
    } else {
      const fechaCorte = new Date(formData.get('fecha') + 'T00:00:00');
      const nuevo = { id: Date.now(), nombre: formData.get('nombre'), tipo: formData.get('tipo'), fecha: formData.get('fecha'), presentacionUrl: formData.get('presentacionUrl'), actaUrl: formData.get('actaUrl'), compromisos: formData.get('compromisos'), anio: fechaCorte.getFullYear(), mes: defaultMeses[fechaCorte.getMonth()], historialCambios: [{ fecha: ts, usuario: user?.email || 'Usuario', accion: 'Radicado sesión' }] };
      updated = [nuevo, ...safeComites];
    }
    setComites(updated); await saveToCloud({ comites: updated }); e.target.reset(); setFormResetKey(Date.now()); showNotification("Sesión de comité guardada.");
  };

  const handleIncidenteSubmit = async (e) => {
    e.preventDefault(); const formData = new FormData(e.target);
    const ts = new Date().toLocaleString();
    const sobranteVal = parseFloat(formData.get('montoSobrante') || 0);
    const faltanteVal = parseFloat(formData.get('montoFaltante') || 0);
    let updated;
    if (editIncidente) {
      const mod = { ...editIncidente, proceso: formData.get('proceso'), idRiesgo: parseInt(formData.get('idRiesgo')), titulo: formData.get('titulo'), descripcion: formData.get('descripcion'), montoSobrante: sobranteVal, montoFaltante: faltanteVal, impacto: formData.get('impacto'), evidenciaUrl: formData.get('evidenciaUrlInput') || editIncidente.evidenciaUrl, historialCambios: [...(editIncidente.historialCambios || []), { fecha: ts, usuario: user?.email || 'Usuario', accion: 'Evento modificado' }] };
      updated = safeIncidentes.map(i => i.id === editIncidente.id ? mod : i); setEditIncidente(null);
    } else {
      const nuevo = { id: Date.now(), proceso: formData.get('proceso'), idRiesgo: parseInt(formData.get('idRiesgo')), fecha: new Date().toISOString().split('T')[0], titulo: formData.get('titulo'), descripcion: formData.get('descripcion'), montoSobrante: sobranteVal, montoFaltante: faltanteVal, impacto: formData.get('impacto'), reportadoPor: user?.email, evidenciaUrl: formData.get('evidenciaUrlInput'), estado: 'Abierto', anio: new Date().getFullYear(), mes: "Junio", historialCambios: [{ fecha: ts, usuario: user?.email || 'Usuario', accion: 'Evento de pérdida registrado' }] };
      updated = [...safeIncidentes, nuevo];
    }
    setIncidentes(updated); await saveToCloud({ incidentes: updated }); e.target.reset(); setFormResetKey(Date.now()); showNotification("Evento registrado.");
  };

  const handleCronogramaSubmit = async (e) => {
    e.preventDefault(); if (!isAdmin) return;
    const formData = new FormData(e.target);
    const mesesSeleccionados = [];
    ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].forEach(mes => {
      if (formData.get(`mes_${mes}`)) mesesSeleccionados.push(mes);
    });
    let updatedList;
    if (editCronograma) {
      const modificado = { ...editCronograma, anio: parseInt(formData.get('anio')), codigo: formData.get('codigo'), proceso: formData.get('proceso'), responsable: formData.get('responsable'), apoyo: formData.get('apoyo'), periodo: formData.get('periodo'), enfoque: formData.get('enfoque'), cumplimiento: parseInt(formData.get('cumplimiento') || 0), meses: mesesSeleccionados };
      updatedList = safeCronograma.map(c => c.id === editCronograma.id ? modificado : c); setEditCronograma(null);
    } else {
      const nuevo = { id: Date.now(), anio: parseInt(formData.get('anio')), codigo: formData.get('codigo'), proceso: formData.get('proceso'), responsable: formData.get('responsable'), apoyo: formData.get('apoyo'), periodo: formData.get('periodo'), enfoque: formData.get('enfoque'), cumplimiento: parseInt(formData.get('cumplimiento') || 0), meses: mesesSeleccionados };
      updatedList = [...safeCronograma, nuevo];
    }
    setCronograma(updatedList); await saveToCloud({ cronograma: updatedList }); e.target.reset(); showNotification("Plan Anual actualizado.");
  };

  const handleApetitoSubmit = async (e) => {
    e.preventDefault(); if (!isAdmin || !editApetito) return;
    const formData = new FormData(e.target);
    const ts = new Date().toLocaleString();
    const apetito = parseFloat(formData.get('apetitoFinanciero') || 0);
    const tolerancia = parseFloat(formData.get('toleranciaFinanciera') || 0);
    const capacidad = parseFloat(formData.get('capacidadRiesgo') || 0);
    if (apetito > tolerancia || tolerancia > capacidad) {
      showNotification("Error: Jerarquía incorrecta (Apetito ≤ Tolerancia ≤ Capacidad).", "error"); return;
    }
    const modificado = { ...editApetito, posturaEstrategica: formData.get('posturaEstrategica'), kriScore: parseInt(formData.get('kriScore')), apetitoFinanciero: apetito, toleranciaFinanciera: tolerancia, capacidadRiesgo: capacidad, impactoOperativo: formData.get('impactoOperativo') || 'No definido', impactoReputacional: formData.get('impactoReputacional') || 'No definido', impactoLegal: formData.get('impactoLegal') || 'No definido', escalamiento: formData.get('escalamiento') || 'Jefe de Área', historialCambios: [...(editApetito.historialCambios || []), { fecha: ts, accion: 'Apetito parametrizado' }] };
    const updatedList = safeRiesgos.map(r => r.id === editApetito.id ? modificado : r);
    setRiesgos(updatedList); setEditApetito(null); await saveToCloud({ riesgos: updatedList }); showNotification("Perfil de Apetito guardado.");
  };

  const handleMonitoreoSubmit = async (e) => {
    e.preventDefault(); if (!isAdmin) return;
    const formData = new FormData(e.target);
    let updatedList;
    if (editMonitoreo && editMonitoreo.id) {
      const modificado = { ...editMonitoreo, anio: parseInt(formData.get('anio')), indicador: formData.get('indicador').toUpperCase(), proceso: formData.get('proceso') || '', valor: parseInt(formData.get('valor') || 0), limite: parseInt(formData.get('limite') || 0), tendencia: formData.get('tendencia') || 'flat' };
      updatedList = safeMonitoreo.map(m => m.id === editMonitoreo.id ? modificado : m); setEditMonitoreo(null);
    } else {
      const nuevo = { id: Date.now(), anio: parseInt(formData.get('anio')), indicador: formData.get('indicador').toUpperCase(), proceso: formData.get('proceso') || '', valor: parseInt(formData.get('valor') || 0), limite: parseInt(formData.get('limite') || 0), tendencia: formData.get('tendencia') || 'flat' };
      updatedList = [...safeMonitoreo, nuevo];
    }
    setMonitoreo(updatedList); await saveToCloud({ monitoreo: updatedList }); e.target.reset(); showNotification("Indicador actualizado.");
  };

  const handleInformeAuditoriaSubmit = async (e) => {
    e.preventDefault(); setIsSubmitting(true);
    const limpiarTildesParaCorreo = (texto) => texto ? texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';
    try {
      const safeInformes = Array.isArray(informesAuditoria) ? informesAuditoria : [];
      const formData = new FormData(e.target);
      const tituloVal = formData.get('titulo') || 'Sin título';
      const procesoVal = formData.get('proceso') || formData.get('Proceso') || 'Sin proceso';
      const subprocesoVal = formData.get('subproceso') || formData.get('Subproceso') || formData.get('subProceso') || 'General';
      
      const evidenciaUrlOut = formData.get('evidenciaUrlInput') || editInformeAuditoria?.evidenciaUrl || '';
      const tipoFuenteOut = String(formData.get('tipoFuente') || editInformeAuditoria?.tipoFuente || '').trim();
      const detalleFuenteOut = String(formData.get('detalleFuente') || editInformeAuditoria?.detalleFuente || '').trim();
      const correosNotificacionOut = String(formData.get('correosNotificacionInput') || editInformeAuditoria?.correoEnviadoA || '').trim();
      const anexosMultiplesRaw = formData.get('anexosMultiples') || '[]';
      let anexosMultiplesOut = [];
      try {
        const parsed = JSON.parse(String(anexosMultiplesRaw));
        anexosMultiplesOut = Array.isArray(parsed) ? parsed : [];
      } catch {
        anexosMultiplesOut = [];
      }
      const actaSocializacionUrlOut = formData.get('actaSocializacionUrlInput') || anexosMultiplesOut[0]?.url || editInformeAuditoria?.actaSocializacionUrl || '';
      const tsActual = new Date().toLocaleString();
      const horaActual = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      let updated; let refConsecutivoFinal = '';
      let idInformeGuardado = editInformeAuditoria?.id || null;

      if (editInformeAuditoria) {
        refConsecutivoFinal = editInformeAuditoria.ref;
        const historialPrevio = Array.isArray(editInformeAuditoria.historialCambios) ? editInformeAuditoria.historialCambios : [];
        const motivo = String(formData.get('motivoCambio') || '').trim();
        const accionCambio = motivo ? `Actualización del informe — ${motivo}` : 'Actualización del informe';
        const versionActual = historialPrevio.length + 1;
        const detalleCambio = buildHistorialDetalle({
          anterior: editInformeAuditoria,
          actual: {
            titulo: tituloVal,
            proceso: procesoVal,
            subproceso: subprocesoVal,
            tipoFuente: tipoFuenteOut,
            detalleFuente: detalleFuenteOut,
            fecha: formData.get('fecha') || editInformeAuditoria.fecha,
            elaboradoPor: formData.get('elaboradoPor') || editInformeAuditoria.elaboradoPor || '',
            revisadoPor: formData.get('revisadoPor') || editInformeAuditoria.revisadoPor || '',
            aprobadoPor: formData.get('aprobadoPor') || formData.get('approvedPor') || editInformeAuditoria.aprobadoPor || '',
            socializado: formData.get('socializado') || editInformeAuditoria.socializado || 'No',
            evidenciaUrl: evidenciaUrlOut,
            anexosMultiples: anexosMultiplesOut,
            correoEnviadoA: correosNotificacionOut || editInformeAuditoria.correoEnviadoA || '',
          },
          motivo,
          correosNotificacionOut,
        });
        const mod = { 
          ...editInformeAuditoria, 
          titulo: tituloVal, 
          proceso: procesoVal, 
          subproceso: subprocesoVal, 
          tipoFuente: tipoFuenteOut || editInformeAuditoria.tipoFuente || '',
          detalleFuente: detalleFuenteOut || editInformeAuditoria.detalleFuente || '',
          fecha: formData.get('fecha') || editInformeAuditoria.fecha, 
          elaboradoPor: formData.get('elaboradoPor') || editInformeAuditoria.elaboradoPor || '', 
          revisadoPor: formData.get('revisadoPor') || editInformeAuditoria.revisadoPor || '', 
          aprobadoPor: formData.get('aprobadoPor') || formData.get('approvedPor') || editInformeAuditoria.aprobadoPor || '', 
          socializado: formData.get('socializado') || editInformeAuditoria.socializado || 'No', 
          socializadoCon: formData.get('socializadoCon') || editInformeAuditoria.socializadoCon || '', 
          evidenciaUrl: evidenciaUrlOut, 
          actaSocializacionUrl: actaSocializacionUrlOut,
          anexos: anexosMultiplesOut,
          anexosMultiples: anexosMultiplesOut,
          objetivo: formData.get('objetivo') || editInformeAuditoria.objetivo || '', 
          alcance: formData.get('alcance') || editInformeAuditoria.alcance || '', 
          conclusion: formData.get('conclusion') || editInformeAuditoria.conclusion || '', 
          fortalezas: formData.get('fortalezas') || editInformeAuditoria.fortalezas || '', 
          img1Url: formData.get('img1Url') || editInformeAuditoria.img1Url || '', 
          img1Desc: formData.get('img1Desc') || editInformeAuditoria.img1Desc || '', 
          img2Url: formData.get('img2Url') || editInformeAuditoria.img2Url || '', 
          img2Desc: formData.get('img2Desc') || editInformeAuditoria.img2Desc || '', 
          img3Url: formData.get('img3Url') || editInformeAuditoria.img3Url || '', 
          img3Desc: formData.get('img3Desc') || editInformeAuditoria.img3Desc || '', 
          img4Url: formData.get('img4Url') || editInformeAuditoria.img4Url || '', 
          img4Desc: formData.get('img4Desc') || editInformeAuditoria.img4Desc || '', 
          correoEnviadoA: correosNotificacionOut || editInformeAuditoria.correoEnviadoA || '',
          fechaCorreoEnviado: editInformeAuditoria.fechaCorreoEnviado || '',
          historialCambios: [
            ...historialPrevio,
            {
              fecha: tsActual,
              usuario: user?.email || 'Sistema',
              accion: accionCambio,
              motivo: motivo || 'Actualización del registro',
              version: versionActual,
              detalle: {
                ...detalleCambio,
                proceso: procesoVal,
                subproceso: subprocesoVal,
                socializado: formData.get('socializado') || editInformeAuditoria.socializado || 'No',
                correoEnviadoA: correosNotificacionOut || editInformeAuditoria.correoEnviadoA || '',
                archivos: detalleCambio.archivos,
                snapshot: {
                  titulo: tituloVal,
                  proceso: procesoVal,
                  subproceso: subprocesoVal,
                  tipoFuente: tipoFuenteOut || editInformeAuditoria.tipoFuente || '',
                  detalleFuente: detalleFuenteOut || editInformeAuditoria.detalleFuente || '',
                  fecha: formData.get('fecha') || editInformeAuditoria.fecha,
                  elaboradoPor: formData.get('elaboradoPor') || editInformeAuditoria.elaboradoPor || '',
                  revisadoPor: formData.get('revisadoPor') || editInformeAuditoria.revisadoPor || '',
                  aprobadoPor: formData.get('aprobadoPor') || formData.get('approvedPor') || editInformeAuditoria.aprobadoPor || '',
                  socializado: formData.get('socializado') || editInformeAuditoria.socializado || 'No',
                  fechaSocializacion: formData.get('fechaSocializacion') || editInformeAuditoria.fechaSocializacion || '',
                  participantes: formData.get('participantes') || editInformeAuditoria.participantes || '',
                  correosNotificacionInput: correosNotificacionOut || editInformeAuditoria.correoEnviadoA || '',
                  evidenciaUrl: evidenciaUrlOut,
                  anexosMultiples: anexosMultiplesOut,
                  anexos: anexosMultiplesOut,
                }
              }
            }
          ]
        };
        updated = safeInformes.map(inf => inf.id === editInformeAuditoria.id ? mod : inf); 
      } else {
        const ultimo = Math.max(...safeInformes.map(i => parseInt(i.ref?.split('-')[2] || 0)), 0);
        refConsecutivoFinal = `INF-2026-${String(ultimo + 1).padStart(3, '0')}`;
        const nuevoId = crypto.randomUUID();
        const nuevo = { 
          id: nuevoId,
          ref: refConsecutivoFinal, 
          titulo: tituloVal, 
          proceso: procesoVal, 
          subproceso: subprocesoVal, 
          tipoFuente: tipoFuenteOut,
          detalleFuente: detalleFuenteOut,
          fecha: formData.get('fecha') || new Date().toISOString().split('T')[0], 
          elaboradoPor: formData.get('elaboradoPor') || '', 
          revisadoPor: formData.get('revisadoPor') || '', 
          aprobadoPor: formData.get('aprobadoPor') || '', 
          socializado: formData.get('socializado') || 'No', 
          socializadoCon: formData.get('socializadoCon') || '', 
          evidenciaUrl: evidenciaUrlOut, 
          actaSocializacionUrl: actaSocializacionUrlOut,
          anexos: anexosMultiplesOut,
          anexosMultiples: anexosMultiplesOut,
          hora: horaActual,
          fechaHora: tsActual,
          objetivo: formData.get('objetivo') || '', 
          alcance: formData.get('alcance') || '', 
          conclusion: formData.get('conclusion') || '', 
          fortalezas: formData.get('fortalezas') || '', 
          img1Url: formData.get('img1Url') || '', 
          img1Desc: formData.get('img1Desc') || '', 
          img2Url: formData.get('img2Url') || '', 
          img2Desc: formData.get('img2Desc') || '', 
          img3Url: formData.get('img3Url') || '', 
          img3Desc: formData.get('img3Desc') || '', 
          img4Url: formData.get('img4Url') || '', 
          img4Desc: formData.get('img4Desc') || '', 
          correoEnviadoA: correosNotificacionOut || '',
          fechaCorreoEnviado: '',
          historialCambios: [],
          hora: horaActual,
          fechaHora: tsActual,
        };
        idInformeGuardado = nuevoId;
        updated = [nuevo, ...safeInformes];
      }

      if (correosNotificacionOut && prepararEnvioGmail && !(await prepararEnvioGmail())) return false;

      const guardado = await saveToCloud({ informesAuditoria: updated });
      if (!guardado) return false;

      setInformesAuditoria(updated);
      if (editInformeAuditoria) setEditInformeAuditoria(null);
      showNotification("Informe guardado.");

      if (correosNotificacionOut !== '') {
        let correoEnviado = false;
        try {
          correoEnviado = await ejecutarDespachoGmailApi({
            ref_consecutivo: refConsecutivoFinal,
            asunto: `[GRC Termales] Radicación de Informe ${refConsecutivoFinal}`,
            titulo: limpiarTildesParaCorreo(tituloVal),
            evidenciaUrl: evidenciaUrlOut || 'https://auditoria-gcm.vercel.app',
            anexosMultiples: formData.get('anexosMultiples') || '[]',
            destinatarios: correosNotificacionOut
          });
        } catch (error) {
          console.error('Error enviando correo del informe ya guardado:', error);
          showNotification("El informe se guardó, pero no se pudo enviar el correo.", "error");
        }

        if (correoEnviado) {
          const informesConCorreo = updated.map(informe => informe.id === idInformeGuardado ? {
            ...informe,
            correoEnviadoA: correosNotificacionOut,
            fechaCorreoEnviado: tsActual
          } : informe);
          const correoRegistrado = await saveToCloud({ informesAuditoria: informesConCorreo });
          if (correoRegistrado) {
            setInformesAuditoria(informesConCorreo);
          } else {
            showNotification("El informe y el correo se enviaron, pero no se pudo registrar el envío.", "error");
          }
        }
      }
      e.target.reset();
      return true;
    } catch {
      showNotification("Error al procesar el informe.", "error");
      return false;
    } finally {
      setIsSubmitting(false);
    }    
  };

  return {
    handleRiesgoSubmit,
    handleHallazgoSubmit,
    handlePlanSubmit,
    handleAprobarCierrePlan,
    handleEvaluacionSubmit,
    handleComiteSubmit,
    handleIncidenteSubmit,
    handleCronogramaSubmit,
    handleApetitoSubmit,
    handleMonitoreoSubmit,
    handleInformeAuditoriaSubmit
  };
};