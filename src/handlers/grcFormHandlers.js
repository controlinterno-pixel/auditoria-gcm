// src/handlers/grcFormHandlers.js
import { buildHistorialDetalle } from '../utils/historialCambios.js';

const convertirListaSubprocesos = valores => (
  Array.isArray(valores)
    ? valores.map(valor => String(valor || '').trim()).filter(Boolean)
    : String(valores || '').split(',').map(valor => valor.trim()).filter(Boolean)
);
const convertirListaMacroprocesos = valores => [...new Set(
  (Array.isArray(valores) ? valores : String(valores || '').split(','))
    .map(valor => String(valor || '').trim())
    .filter(Boolean)
)];

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
  encolarReintentoNotificacion,
  crearRegistroGrc,
  actualizarInformeGrc,
  actualizarHallazgoGrc,
  registrarCorreoInforme,
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

    let evidenciasOut;
    try {
      const evidenciasRaw = JSON.parse(String(formData.get('evidenciasInput') || '[]'));
      evidenciasOut = Array.isArray(evidenciasRaw) ? evidenciasRaw : [];
    } catch {
      evidenciasOut = [];
    }
    const evidenciaUrlOut = formData.get('evidenciaUrlInput') || editHallazgo?.evidenciaUrl || evidenciasOut[0]?.url || '';
    if (evidenciasOut.length === 0 && evidenciaUrlOut) {
      evidenciasOut = [{ url: evidenciaUrlOut, nombre: 'Evidencia anterior' }];
    }
    const normaReferenciaOut = formData.get('normaReferencia') || editHallazgo?.normaReferencia || '';
    const procesoRecibido = formData.get('proceso') || formData.get('Proceso') || '';
    let macroprocesosVal = [];
    try {
      const macroprocesosRaw = JSON.parse(String(formData.get('macroprocesos') || '[]'));
      if (Array.isArray(macroprocesosRaw)) macroprocesosVal = convertirListaMacroprocesos(macroprocesosRaw);
    } catch {
      macroprocesosVal = [];
    }
    if (macroprocesosVal.length === 0) {
      macroprocesosVal = convertirListaMacroprocesos(
        editHallazgo?.macroprocesos || editHallazgo?.macroproceso || procesoRecibido.split('/')[0]
      );
    }
    const macroprocesoVal = macroprocesosVal[0] || 'Sin proceso';
    let subprocesosGlobales = [];
    try {
      const subprocesosRaw = JSON.parse(String(formData.get('subprocesos') || '[]'));
      if (Array.isArray(subprocesosRaw)) subprocesosGlobales = convertirListaSubprocesos(subprocesosRaw);
    } catch {
      subprocesosGlobales = [];
    }
    let relacionSubprocesosRaw = {};
    try {
      const relacionRaw = JSON.parse(String(formData.get('subprocesosPorMacroproceso') || '{}'));
      if (relacionRaw && typeof relacionRaw === 'object' && !Array.isArray(relacionRaw)) relacionSubprocesosRaw = relacionRaw;
    } catch {
      relacionSubprocesosRaw = {};
    }
    const subprocesosPorMacroprocesoVal = Object.fromEntries(macroprocesosVal.map((macroproceso, indice) => {
      const clave = Object.keys(relacionSubprocesosRaw).find(valor => (
        valor.trim().toLowerCase() === macroproceso.trim().toLowerCase()
      ));
      const valores = clave ? relacionSubprocesosRaw[clave] : indice === 0 ? subprocesosGlobales : [];
      return [macroproceso, convertirListaSubprocesos(valores)];
    }));
    const subprocesosVal = convertirListaSubprocesos(Object.values(subprocesosPorMacroprocesoVal).flat());
    const subprocesoVal = subprocesosVal[0] || formData.get('subproceso') || formData.get('Subproceso') || 'General';
    const subprocesosMacroprocesoPrincipal = subprocesosPorMacroprocesoVal[macroprocesoVal] || [];
    const procesoVal = procesoRecibido || `${macroprocesoVal}${subprocesosMacroprocesoPrincipal.length ? ` / ${subprocesosMacroprocesoPrincipal.join(', ')}` : ''}`;
    const metodologiaCausaVal = formData.get('metodologiaCausa') || editHallazgo?.metodologiaCausa || '5 Porqués';
    const analisisCausaVal = formData.get('analisisCausa') ?? editHallazgo?.analisisCausa ?? '';
    
    // ✨ Capturamos los nuevos campos
    const tipoFuenteVal = formData.get('tipoFuente') || editHallazgo?.tipoFuente || '';
    const detalleFuenteVal = formData.get('detalleFuente') || editHallazgo?.detalleFuente || '';

    let updated;
    let hallazgoModificado = null;
    let nuevoHallazgo = null;
    if (editHallazgo) {
      hallazgoModificado = { 
        ...editHallazgo, 
        idInforme: formData.get('idInforme') || '', 
        sede: formData.get('sede'), 
        ref: formData.get('ref'), 
        proceso: procesoVal,
        macroproceso: macroprocesoVal,
        macroprocesos: macroprocesosVal,
        subproceso: subprocesoVal,
        subprocesos: subprocesosVal,
        subprocesosPorMacroproceso: subprocesosPorMacroprocesoVal,
        responsable: formData.get('responsable'), 
        auditor: formData.get('auditor') || editHallazgo?.auditor || '', 
        normaReferencia: normaReferenciaOut,
        tipoFuente: tipoFuenteVal,        // ✨ Nuevo
        detalleFuente: detalleFuenteVal,  // ✨ Nuevo
        metodologiaCausa: metodologiaCausaVal,
        analisisCausa: analisisCausaVal,
        titulo: formData.get('titulo'), 
        severidad: formData.get('severidad'), 
        evidenciaUrl: evidenciaUrlOut, 
        evidencias: evidenciasOut,
        causa: formData.get('causa') || '', 
        claseObservacion: formData.get('claseObservacion') || 'Oportunidad de Mejora', 
        historialCambios: [...(editHallazgo.historialCambios || []), { fecha: ts, usuario: user?.email || 'Usuario', accion: 'Hallazgo modificado' }] 
      };
      updated = safeHallazgos.map(h => String(h.id) === String(editHallazgo.id) ? hallazgoModificado : h);
    } else {
      nuevoHallazgo = { 
        id: Date.now(), 
        idInforme: formData.get('idInforme') || '', 
        sede: formData.get('sede'), 
        ref: formData.get('ref'), 
        proceso: procesoVal,
        macroproceso: macroprocesoVal,
        macroprocesos: macroprocesosVal,
        subproceso: subprocesoVal,
        subprocesos: subprocesosVal,
        subprocesosPorMacroproceso: subprocesosPorMacroprocesoVal,
        responsable: formData.get('responsable'), 
        auditor: formData.get('auditor') || '', 
        normaReferencia: normaReferenciaOut,
        tipoFuente: tipoFuenteVal,        // ✨ Nuevo
        detalleFuente: detalleFuenteVal,  // ✨ Nuevo
        metodologiaCausa: metodologiaCausaVal,
        analisisCausa: analisisCausaVal,
        titulo: formData.get('titulo'), 
        severidad: formData.get('severidad'), 
        estado: 'Abierto', 
        fecha: hoy.toISOString().split('T')[0], 
        anio: anioActual, 
        mes: mesActual, 
        evidenciaUrl: evidenciaUrlOut, 
        evidencias: evidenciasOut,
        causa: formData.get('causa') || '', 
        claseObservacion: formData.get('claseObservacion') || 'Oportunidad de Mejora', 
        historialCambios: [{ fecha: ts, usuario: user?.email || 'Usuario', accion: 'Desviación documentada' }] 
      };
      updated = [...safeHallazgos, nuevoHallazgo];
    }

    if (editHallazgo && !isAdmin) {
      try {
        const respuesta = await actualizarHallazgoGrc(editHallazgo.id, hallazgoModificado);
        if (!respuesta?.registro) return false;
        setHallazgos(prev => (Array.isArray(prev) ? prev : []).map(hallazgo => (
          String(hallazgo.id) === String(editHallazgo.id) ? respuesta.registro : hallazgo
        )));
      } catch (error) {
        showNotification(error.message || 'No se pudo actualizar el hallazgo.', 'error');
        return false;
      }
    } else if (isAdmin) {
      const guardado = await saveToCloud({ hallazgos: updated });
      if (!guardado) {
        showNotification('No se pudo guardar el hallazgo.', 'error');
        return false;
      }
      setHallazgos(updated);
    } else {
      try {
        const respuesta = await crearRegistroGrc('hallazgos', nuevoHallazgo);
        if (!respuesta?.registro) return false;
        setHallazgos(prev => [respuesta.registro, ...(Array.isArray(prev) ? prev : [])]);
        nuevoHallazgo = respuesta.registro;
      } catch (error) {
        showNotification(error.message || 'No se pudo crear el hallazgo.', 'error');
        return false;
      }
    }

    // Devuelve el hallazgo guardado para que la pantalla lo ubique y lo resalte en el historial.
    const hallazgoGuardado = editHallazgo ? hallazgoModificado : nuevoHallazgo;
    if (editHallazgo) setEditHallazgo(null);
    e.target.reset(); 
    return hallazgoGuardado || true;
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
            auditorNotificar = planToUpdate.correoAuditor || planToUpdate.correoAuditorResponsable || planToUpdate.correo_auditor || '';
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

    let correoPreparado = true;
    if (dispararCorreo && auditorNotificar && prepararEnvioGmail) {
      try {
        correoPreparado = Boolean(await prepararEnvioGmail());
      } catch {
        correoPreparado = false;
      }
    }
    const guardado = await saveToCloud({ planes: updatedList });
    if (!guardado) return;
    setPlanes(updatedList);

    if (dispararCorreo && auditorNotificar) {
        const payloadNotificacionPlan = {
          ref_consecutivo: `APROBACION-100`, 
          titulo_informe: 'Verificar soportes cargados al 100% para proceder con el cierre',
          proceso_auditado: 'Plan de acción pendiente por aprobar', 
          enlace_pdf: evidenciaUrlOut || 'https://auditoria-gcm.vercel.app', 
          destinatarios: auditorNotificar
        };
        let correoEnviado = false;
        if (correoPreparado && ejecutarDespachoGmailApi) {
          try {
            correoEnviado = Boolean(await ejecutarDespachoGmailApi(payloadNotificacionPlan));
          } catch {
            correoEnviado = false;
          }
        }
        if (!correoEnviado) encolarReintentoNotificacion?.(payloadNotificacionPlan, { tipo: 'plan' });
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
    let correoPreparado = true;
    if (prepararEnvioGmail) {
      try {
        correoPreparado = Boolean(await prepararEnvioGmail());
      } catch {
        correoPreparado = false;
      }
    }
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
    
    // N5: sin correos escritos en el código; el destinatario sale de la sesión o de la configuración.
    const correoCentral = user?.email || import.meta.env.VITE_CORREO_ADMIN_DEFAULT || '';
    const payloadNotificacionCierre = {
      ref_consecutivo: `CIERRE-PLAN-${plan.id}`,
      titulo_informe: '✅ Plan de Acción y Hallazgo Cerrados con Éxito', 
      proceso_auditado: plan.accion.substring(0, 50) + '...', 
      enlace_pdf: plan.evidenciaUrl || 'https://auditoria-gcm.vercel.app', 
      destinatarios: plan.correoResponsable || correoCentral 
    };
    let correoEnviado = false;
    if (correoPreparado && ejecutarDespachoGmailApi) {
      try {
        correoEnviado = Boolean(await ejecutarDespachoGmailApi(payloadNotificacionCierre));
      } catch {
        correoEnviado = false;
      }
    }
    if (!correoEnviado) encolarReintentoNotificacion?.(payloadNotificacionCierre, { tipo: 'plan' });

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
        showNotification("Test guardado, Bitácora de riesgo actualizada y Hallazgo derivado con éxito.", "success");
      } else {
        showNotification("Test guardado y Bitácora de riesgo actualizada (Sin hallazgo).");
      }
    } else {
      showNotification("Evaluación guardada exitosamente. Control fuerte y eficaz.");
    }

    const guardado = await saveToCloud({ evaluaciones: updated, hallazgos: updatedHallazgos, riesgos: updatedRiesgos });
    if (!guardado) return false;
    setEvaluaciones(updated);
    if (editEvaluacion) setEditEvaluacion(null);
    if (updatedHallazgos !== safeHallazgos) setHallazgos(updatedHallazgos);
    if (updatedRiesgos !== safeRiesgos) setRiesgos(updatedRiesgos);
    e.target.reset(); 
    setFormResetKey(Date.now()); 
    return true;
  };

  const handleComiteSubmit = async (e) => {
    e.preventDefault(); const formData = new FormData(e.target);
    const ts = new Date().toLocaleString();
    let updated;
    if (editComite) {
      const mod = { ...editComite, nombre: formData.get('nombre'), tipo: formData.get('tipo'), fecha: formData.get('fecha'), presentacionUrl: formData.get('presentacionUrl'), actaUrl: formData.get('actaUrl'), compromisos: formData.get('compromisos'), historialCambios: [...(editComite.historialCambios || []), { fecha: ts, usuario: user?.email || 'Usuario', accion: 'Modificado' }] };
      updated = safeComites.map(c => c.id === editComite.id ? mod : c);
    } else {
      const fechaCorte = new Date(formData.get('fecha') + 'T00:00:00');
      const nuevo = { id: Date.now(), nombre: formData.get('nombre'), tipo: formData.get('tipo'), fecha: formData.get('fecha'), presentacionUrl: formData.get('presentacionUrl'), actaUrl: formData.get('actaUrl'), compromisos: formData.get('compromisos'), anio: fechaCorte.getFullYear(), mes: defaultMeses[fechaCorte.getMonth()], historialCambios: [{ fecha: ts, usuario: user?.email || 'Usuario', accion: 'Radicado sesión' }] };
      updated = [nuevo, ...safeComites];
    }
    const guardado = await saveToCloud({ comites: updated });
    if (!guardado) return false;
    setComites(updated);
    if (editComite) setEditComite(null);
    e.target.reset();
    setFormResetKey(Date.now());
    showNotification("Sesión de comité guardada.");
    return true;
  };

  const handleIncidenteSubmit = async (e) => {
    e.preventDefault(); const formData = new FormData(e.target);
    const ts = new Date().toLocaleString();
    const sobranteVal = parseFloat(formData.get('montoSobrante') || 0);
    const faltanteVal = parseFloat(formData.get('montoFaltante') || 0);
    let updated;
    if (editIncidente) {
      const mod = { ...editIncidente, proceso: formData.get('proceso'), idRiesgo: parseInt(formData.get('idRiesgo')), titulo: formData.get('titulo'), descripcion: formData.get('descripcion'), montoSobrante: sobranteVal, montoFaltante: faltanteVal, impacto: formData.get('impacto'), evidenciaUrl: formData.get('evidenciaUrlInput') || editIncidente.evidenciaUrl, historialCambios: [...(editIncidente.historialCambios || []), { fecha: ts, usuario: user?.email || 'Usuario', accion: 'Evento modificado' }] };
      updated = safeIncidentes.map(i => i.id === editIncidente.id ? mod : i);
    } else {
      const nuevo = { id: Date.now(), proceso: formData.get('proceso'), idRiesgo: parseInt(formData.get('idRiesgo')), fecha: new Date().toISOString().split('T')[0], titulo: formData.get('titulo'), descripcion: formData.get('descripcion'), montoSobrante: sobranteVal, montoFaltante: faltanteVal, impacto: formData.get('impacto'), reportadoPor: user?.email, evidenciaUrl: formData.get('evidenciaUrlInput'), estado: 'Abierto', anio: new Date().getFullYear(), mes: "Junio", historialCambios: [{ fecha: ts, usuario: user?.email || 'Usuario', accion: 'Evento de pérdida registrado' }] };
      updated = [...safeIncidentes, nuevo];
    }
    const guardado = await saveToCloud({ incidentes: updated });
    if (!guardado) return false;
    setIncidentes(updated);
    if (editIncidente) setEditIncidente(null);
    e.target.reset();
    setFormResetKey(Date.now());
    showNotification("Evento registrado.");
    return true;
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
      updatedList = safeCronograma.map(c => c.id === editCronograma.id ? modificado : c);
    } else {
      const nuevo = { id: Date.now(), anio: parseInt(formData.get('anio')), codigo: formData.get('codigo'), proceso: formData.get('proceso'), responsable: formData.get('responsable'), apoyo: formData.get('apoyo'), periodo: formData.get('periodo'), enfoque: formData.get('enfoque'), cumplimiento: parseInt(formData.get('cumplimiento') || 0), meses: mesesSeleccionados };
      updatedList = [...safeCronograma, nuevo];
    }
    const guardado = await saveToCloud({ cronograma: updatedList });
    if (!guardado) return false;
    setCronograma(updatedList);
    if (editCronograma) setEditCronograma(null);
    e.target.reset();
    showNotification("Plan Anual actualizado.");
    return true;
  };

  const handleApetitoSubmit = async (e) => {
    e.preventDefault(); if (!isAdmin || !editApetito) return false;
    const formData = new FormData(e.target);
    const ts = new Date().toLocaleString();
    const apetito = parseFloat(formData.get('apetitoFinanciero') || 0);
    const tolerancia = parseFloat(formData.get('toleranciaFinanciera') || 0);
    const capacidad = parseFloat(formData.get('capacidadRiesgo') || 0);
    if (apetito > tolerancia || tolerancia > capacidad) {
      showNotification("Error: Jerarquía incorrecta (Apetito ≤ Tolerancia ≤ Capacidad).", "error"); return false;
    }
    const modificado = { ...editApetito, posturaEstrategica: formData.get('posturaEstrategica'), kriScore: parseInt(formData.get('kriScore')), apetitoFinanciero: apetito, toleranciaFinanciera: tolerancia, capacidadRiesgo: capacidad, impactoOperativo: formData.get('impactoOperativo') || 'No definido', impactoReputacional: formData.get('impactoReputacional') || 'No definido', impactoLegal: formData.get('impactoLegal') || 'No definido', escalamiento: formData.get('escalamiento') || 'Jefe de Área', historialCambios: [...(editApetito.historialCambios || []), { fecha: ts, accion: 'Apetito parametrizado' }] };
    const updatedList = safeRiesgos.map(r => r.id === editApetito.id ? modificado : r);
    const guardado = await saveToCloud({ riesgos: updatedList });
    if (!guardado) return false;
    setRiesgos(updatedList);
    setEditApetito(null);
    showNotification("Perfil de Apetito guardado.");
    return true;
  };

  const handleMonitoreoSubmit = async (e) => {
    e.preventDefault(); if (!isAdmin) return false;
    const formData = new FormData(e.target);
    let updatedList;
    if (editMonitoreo && editMonitoreo.id) {
      const modificado = { ...editMonitoreo, anio: parseInt(formData.get('anio')), indicador: formData.get('indicador').toUpperCase(), proceso: formData.get('proceso') || '', valor: parseInt(formData.get('valor') || 0), limite: parseInt(formData.get('limite') || 0), tendencia: formData.get('tendencia') || 'flat' };
      updatedList = safeMonitoreo.map(m => m.id === editMonitoreo.id ? modificado : m);
    } else {
      const nuevo = { id: Date.now(), anio: parseInt(formData.get('anio')), indicador: formData.get('indicador').toUpperCase(), proceso: formData.get('proceso') || '', valor: parseInt(formData.get('valor') || 0), limite: parseInt(formData.get('limite') || 0), tendencia: formData.get('tendencia') || 'flat' };
      updatedList = [...safeMonitoreo, nuevo];
    }
    const guardado = await saveToCloud({ monitoreo: updatedList });
    if (!guardado) return false;
    setMonitoreo(updatedList);
    if (editMonitoreo?.id) setEditMonitoreo(null);
    e.target.reset();
    showNotification("Indicador actualizado.");
    return true;
  };

const handleInformeAuditoriaSubmit = async (e) => {
    e.preventDefault(); setIsSubmitting(true);
    const limpiarTildesParaCorreo = (texto) => texto ? texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';
    try {
      const safeInformes = Array.isArray(informesAuditoria) ? informesAuditoria : [];
      const formData = new FormData(e.target);
      
      const tituloVal = formData.get('titulo') || editInformeAuditoria?.titulo || 'Sin título';
      const procesoLegacy = String(formData.get('proceso') || formData.get('Proceso') || editInformeAuditoria?.proceso || editInformeAuditoria?.macroproceso || 'Sin proceso');
      let macroprocesosVal = [];
      try {
        const macroprocesosRaw = JSON.parse(String(formData.get('macroprocesos') || '[]'));
        if (Array.isArray(macroprocesosRaw)) macroprocesosVal = macroprocesosRaw.map(valor => String(valor || '').trim()).filter(Boolean);
      } catch {
        macroprocesosVal = [];
      }
      if (macroprocesosVal.length === 0) {
        macroprocesosVal = [String(editInformeAuditoria?.macroproceso || procesoLegacy.split('/')[0]).trim()].filter(Boolean);
      }
      const macroprocesoVal = macroprocesosVal[0] || 'Sin proceso';
      const procesoVal = macroprocesoVal;
      let subprocesosVal = [];
      try {
        const subprocesosRaw = JSON.parse(String(formData.get('subprocesos') || '[]'));
        if (Array.isArray(subprocesosRaw)) subprocesosVal = subprocesosRaw.map(valor => String(valor || '').trim()).filter(Boolean);
      } catch {
        subprocesosVal = [];
      }
      if (subprocesosVal.length === 0) {
        const legado = String(formData.get('subproceso') || formData.get('Subproceso') || formData.get('subProceso') || editInformeAuditoria?.subproceso || 'General');
        subprocesosVal = legado.split(',').map(valor => valor.trim()).filter(Boolean);
      }
      let subprocesosPorMacroprocesoVal = {};
      try {
        const relacionRaw = JSON.parse(String(formData.get('subprocesosPorMacroproceso') || '{}'));
        if (relacionRaw && typeof relacionRaw === 'object' && !Array.isArray(relacionRaw)) {
          subprocesosPorMacroprocesoVal = relacionRaw;
        }
      } catch {
        subprocesosPorMacroprocesoVal = {};
      }
      subprocesosPorMacroprocesoVal = Object.fromEntries(macroprocesosVal.map((macro, indice) => [
        macro,
        Array.isArray(subprocesosPorMacroprocesoVal[macro])
          ? subprocesosPorMacroprocesoVal[macro].map(valor => String(valor || '').trim()).filter(Boolean)
          : indice === 0 ? subprocesosVal : [],
      ]));
      const subprocesoVal = subprocesosVal[0] || 'General';
      const programaIdVal = String(formData.get('programaId') || editInformeAuditoria?.programaId || '').trim();
      const fechaVal = formData.get('fecha') || editInformeAuditoria?.fecha || new Date().toISOString().split('T')[0];
      
      const tipoFuenteOut = String(formData.get('tipoFuente') || editInformeAuditoria?.tipoFuente || '').trim();
      const detalleFuenteOut = String(formData.get('detalleFuente') || editInformeAuditoria?.detalleFuente || '').trim();
      
      const elaboradoPorVal = formData.get('elaboradoPor') || editInformeAuditoria?.elaboradoPor || '';
      const revisadoPorVal = formData.get('revisadoPor') || editInformeAuditoria?.revisadoPor || '';
      const aprobadoPorVal = formData.get('aprobadoPor') || formData.get('approvedPor') || editInformeAuditoria?.aprobadoPor || '';
      
      const auditorResponsableOut = String(formData.get('auditorResponsable') || formData.get('auditor') || editInformeAuditoria?.auditorResponsable || '').trim();
      const correoAuditorOut = String(formData.get('correoAuditor') || formData.get('correoAuditorResponsable') || editInformeAuditoria?.correoAuditor || '').trim();
      
      const socializadoVal = formData.get('socializado') || editInformeAuditoria?.socializado || 'No';
      const fechaSocializacionOut = String(formData.get('fechaSocializacion') || formData.get('fecha_socializacion') || editInformeAuditoria?.fechaSocializacion || '').trim();
      const participantesVal = formData.get('participantes') || formData.get('socializadoCon') || editInformeAuditoria?.participantes || editInformeAuditoria?.socializadoCon || '';

      const evidenciaUrlOut = formData.get('evidenciaUrlInput') || editInformeAuditoria?.evidenciaUrl || '';
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
      let registroNuevo = null;
      let registroEditado = null;

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
            macroproceso: macroprocesoVal,
            macroprocesos: macroprocesosVal,
            subproceso: subprocesoVal,
            subprocesos: subprocesosVal,
            subprocesosPorMacroproceso: subprocesosPorMacroprocesoVal,
            programaId: programaIdVal,
            tipoFuente: tipoFuenteOut,
            detalleFuente: detalleFuenteOut,
            fecha: fechaVal,
            elaboradoPor: elaboradoPorVal,
            revisadoPor: revisadoPorVal,
            aprobadoPor: aprobadoPorVal,
            socializado: socializadoVal,
            evidenciaUrl: evidenciaUrlOut,
            anexosMultiples: anexosMultiplesOut,
            correoEnviadoA: correosNotificacionOut,
          },
          motivo,
          correosNotificacionOut,
        });

       const mod = { 
          ...editInformeAuditoria, 
          titulo: tituloVal, 
          proceso: procesoVal, 
          macroproceso: macroprocesoVal,
          macroprocesos: macroprocesosVal,
          subproceso: subprocesoVal, 
          subprocesos: subprocesosVal,
          subprocesosPorMacroproceso: subprocesosPorMacroprocesoVal,
          programaId: programaIdVal,
          tipoFuente: tipoFuenteOut,
          detalleFuente: detalleFuenteOut,
          fecha: fechaVal, 
          elaboradoPor: elaboradoPorVal, 
          revisadoPor: revisadoPorVal, 
          aprobadoPor: aprobadoPorVal, 
          auditorResponsable: auditorResponsableOut,
          auditor: auditorResponsableOut,
          correoAuditor: correoAuditorOut,
          correoAuditorResponsable: correoAuditorOut,
          socializado: socializadoVal, 
          fechaSocializacion: fechaSocializacionOut,
          fecha_socializacion: fechaSocializacionOut,
          socializadoCon: participantesVal, 
          participantes: participantesVal,
          evidenciaUrl: evidenciaUrlOut,
          actaSocializacionUrl: actaSocializacionUrlOut,
          anexos: anexosMultiplesOut,
          anexosMultiples: anexosMultiplesOut,
          correoEnviadoA: correosNotificacionOut,
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
                macroproceso: macroprocesoVal,
                macroprocesos: macroprocesosVal,
                subproceso: subprocesoVal,
                subprocesos: subprocesosVal,
                subprocesosPorMacroproceso: subprocesosPorMacroprocesoVal,
                socializado: socializadoVal,
                correoEnviadoA: correosNotificacionOut,
                archivos: detalleCambio.archivos,
                snapshot: {
                  titulo: tituloVal,
                  proceso: procesoVal,
                  macroproceso: macroprocesoVal,
                  macroprocesos: macroprocesosVal,
                  subproceso: subprocesoVal,
                  subprocesos: subprocesosVal,
                  subprocesosPorMacroproceso: subprocesosPorMacroprocesoVal,
                  programaId: programaIdVal,
                  tipoFuente: tipoFuenteOut,
                  detalleFuente: detalleFuenteOut,
                  fecha: fechaVal,
                  elaboradoPor: elaboradoPorVal,
                  revisadoPor: revisadoPorVal,
                  aprobadoPor: aprobadoPorVal,
                  socializado: socializadoVal,
                  fechaSocializacion: fechaSocializacionOut,
                  participantes: participantesVal,
                  correosNotificacionInput: correosNotificacionOut,
                  evidenciaUrl: evidenciaUrlOut,
                  anexosMultiples: anexosMultiplesOut,
                  anexos: anexosMultiplesOut,
                }
              }
            }
          ]
        };
        registroEditado = mod;
        
        updated = safeInformes.map(inf => String(inf.id) === String(editInformeAuditoria.id) ? mod : inf); 
      } else {
        const ultimo = Math.max(...safeInformes.map(i => parseInt(i.ref?.split('-')[2] || 0)), 0);
        refConsecutivoFinal = `INF-2026-${String(ultimo + 1).padStart(3, '0')}`;
        const nuevoId = crypto.randomUUID();
        registroNuevo = { 
          id: nuevoId,
          ref: refConsecutivoFinal, 
          titulo: tituloVal, 
          proceso: procesoVal, 
          macroproceso: macroprocesoVal,
          macroprocesos: macroprocesosVal,
          subproceso: subprocesoVal, 
          subprocesos: subprocesosVal,
          subprocesosPorMacroproceso: subprocesosPorMacroprocesoVal,
          programaId: programaIdVal,
          tipoFuente: tipoFuenteOut,
          detalleFuente: detalleFuenteOut,
          fecha: fechaVal, 
          elaboradoPor: elaboradoPorVal, 
          revisadoPor: revisadoPorVal, 
          aprobadoPor: aprobadoPorVal, 
          auditorResponsable: auditorResponsableOut,
          auditor: auditorResponsableOut,
          correoAuditor: correoAuditorOut,
          correoAuditorResponsable: correoAuditorOut,
          socializado: socializadoVal, 
          fechaSocializacion: fechaSocializacionOut,
          fecha_socializacion: fechaSocializacionOut,
          socializadoCon: participantesVal,
          participantes: participantesVal,
          evidenciaUrl: evidenciaUrlOut, 
          actaSocializacionUrl: actaSocializacionUrlOut,
          anexos: anexosMultiplesOut,
          anexosMultiples: anexosMultiplesOut,
          hora: horaActual,
          fechaHora: tsActual,
          correoEnviadoA: correosNotificacionOut,
          fechaCorreoEnviado: '',
          historialCambios: [],
        };
        idInformeGuardado = nuevoId;
        updated = [registroNuevo, ...safeInformes];
      }

      let gmailAutorizado = true;
      if (correosNotificacionOut && prepararEnvioGmail) {
        gmailAutorizado = await prepararEnvioGmail();
      }

      let guardado;
      if (editInformeAuditoria) {
        if (!registroEditado || typeof actualizarInformeGrc !== 'function') return false;
        const respuesta = await actualizarInformeGrc(editInformeAuditoria.id, registroEditado, String(formData.get('motivoCambio') || '').trim());
        if (!respuesta?.registro) return false;
        updated = safeInformes.map(informe => String(informe.id) === String(editInformeAuditoria.id) ? respuesta.registro : informe);
        const planesActualizados = Array.isArray(respuesta.planesActualizados) ? respuesta.planesActualizados : [];
        if (planesActualizados.length > 0) {
          const planesPorId = new Map(planesActualizados.map(plan => [String(plan.id), plan]));
          setPlanes(prev => (Array.isArray(prev) ? prev : []).map(plan => planesPorId.get(String(plan.id)) || plan));
        }
        guardado = true;
      } else if (!isAdmin) {
        if (!registroNuevo || typeof crearRegistroGrc !== 'function') return false;
        const respuesta = await crearRegistroGrc('informesAuditoria', registroNuevo);
        if (!respuesta?.registro) return false;
        registroNuevo = respuesta.registro;
        refConsecutivoFinal = registroNuevo.ref;
        idInformeGuardado = registroNuevo.id;
        updated = [registroNuevo, ...safeInformes];
        guardado = true;
      } else {
        guardado = await saveToCloud({ informesAuditoria: updated });
      }
      if (!guardado) return false;

      setInformesAuditoria(updated);
      if (editInformeAuditoria) setEditInformeAuditoria(null);
      showNotification("Informe guardado con éxito.", "success");

      if (correosNotificacionOut !== '') {
        const payloadNotificacionInforme = {
          ref_consecutivo: refConsecutivoFinal,
          asunto: `[GRC Termales] Radicación de Informe ${refConsecutivoFinal}`,
          titulo: limpiarTildesParaCorreo(tituloVal),
          evidenciaUrl: evidenciaUrlOut || 'https://auditoria-gcm.vercel.app',
          anexosMultiples: anexosMultiplesRaw,
          destinatarios: correosNotificacionOut,
        };
        const contextoReintentoInforme = {
          tipo: 'informe',
          informeId: idInformeGuardado,
          destinatarios: correosNotificacionOut,
        };
        let correoEnviado = false;
        if (gmailAutorizado) {
          try {
            correoEnviado = await ejecutarDespachoGmailApi(payloadNotificacionInforme);
          } catch (error) {
            console.error('Error enviando correo del informe ya guardado:', error);
            showNotification("El informe se guardó, pero no se pudo enviar el correo.", "error");
          }
        } else {
          showNotification('Informe guardado, pero el correo no se envió porque Gmail no autorizó el permiso de envío. Guarda de nuevo y acepta el acceso para reintentar.', 'error');
        }

        if (!correoEnviado) encolarReintentoNotificacion?.(payloadNotificacionInforme, contextoReintentoInforme);

        if (correoEnviado) {
          const informesConCorreo = updated.map(informe => String(informe.id) === String(idInformeGuardado) ? {
            ...informe,
            correoEnviadoA: correosNotificacionOut,
            fechaCorreoEnviado: tsActual
          } : informe);
          try {
            if (isAdmin) {
              const correoRegistrado = await saveToCloud({ informesAuditoria: informesConCorreo });
              if (correoRegistrado) setInformesAuditoria(informesConCorreo);
              else {
                encolarReintentoNotificacion?.(payloadNotificacionInforme, { ...contextoReintentoInforme, correoEnviado: true });
                showNotification("El correo se envió, pero falta registrar el envío. Reintenta desde la bandeja.", "error");
              }
            } else if (typeof registrarCorreoInforme === 'function') {
              const respuesta = await registrarCorreoInforme(idInformeGuardado, correosNotificacionOut, tsActual);
              if (respuesta?.informe) {
                setInformesAuditoria(prev => prev.map(informe => String(informe.id) === String(idInformeGuardado) ? respuesta.informe : informe));
              } else {
                encolarReintentoNotificacion?.(payloadNotificacionInforme, { ...contextoReintentoInforme, correoEnviado: true });
                showNotification("El correo se envió, pero falta registrar el envío. Reintenta desde la bandeja.", "error");
              }
            }
          } catch {
            encolarReintentoNotificacion?.(payloadNotificacionInforme, { ...contextoReintentoInforme, correoEnviado: true });
            showNotification("El correo se envió, pero falta registrar el envío. Reintenta desde la bandeja.", "error");
          }
        }
      }
      e.target.reset();
      // Devuelve el informe guardado para que la pantalla lo ubique y lo resalte en el historial.
      return updated.find(informe => String(informe.id) === String(idInformeGuardado)) || true;
    } catch (err) {
      console.error(err);
      showNotification(err.message || "Error al procesar el informe.", "error");
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