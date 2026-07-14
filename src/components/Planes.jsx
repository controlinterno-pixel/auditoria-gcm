import React, { useState } from 'react';

// 📚 LISTA MAESTRA UNIFICADA DE CARGOS CORPORATIVOS (CONEXIÓN IDÉNTICA A HALLAZGOS)
const CARGOS_OFICIALES = [
  "Agente contact Center", "Almacenista", "Ama de Llaves", "Analista Ambiental", "Analista de auditoría", 
  "Analista de Cartera", "Analista de Compras", "Analista de Contabilidad", "Analista de costos e inventarios", 
  "Analista de Mejora continua", "Analista de nómina", "Analista de Sistemas", "Analista de Talento Humano", 
  "Analista de Tesorería", "Asistente de Gerencia", "Auditor Nocturno", "Auditoría Interna", "Auxiliar Administrativa y Contable de Socios", 
  "Auxiliar Administrativa y Labor social", "Auxiliar Administrativo y Logístico", "Auxiliar Comercial SRC", "Auxiliar Comercial Taquilla", 
  "Auxiliar de Almacén", "Auxiliar de barra", "Auxiliar de Cocina", "Auxiliar de despensa", "Auxiliar de enfermería", 
  "Auxiliar de Inventarios", "Auxiliar de lavandería", "Auxiliar de parqueadero - Botones", "Auxiliar de Portería", 
  "Auxiliar de Servicio al Cliente", "Auxiliar de Servicios Generales", "Auxiliar Gestión Documental", "Auxiliar mantenimiento", 
  "Auxiliar mantenimiento carretera", "Auxiliar Porcionador", "Auxiliar PTAP", "Auxiliar PTAR", "Auxiliar supernumerario", 
  "Auxiliares de Tics", "Barista", "Cajero", "Cajero Ay B", "Cajero recreación balneario", "Camareras", "Chef Hotel", 
  "Contador", "Contadora de Socios", "Coordinación Administrativa Family Office", "Coordinación Comercial y Contact Center", 
  "Coordinación de Mercadeo y Comunicaciones", "Coordinación de recepción", "Coordinación Seguridad Y Salud en el trabajo", 
  "Coordinación SPA", "Coordinador de Mantenimiento", "Coordinador de Marketing digital", "Coordinador de Servicio al Cliente", 
  "Coordinador Operaciones", "Creativo Gráfico", "Desarrollador Junior", "Dirección Administrativa y Financiera", "Dirección Comercial", 
  "Dirección de Mercadeo y Comunicaciones", "Dirección Talento Humano", "Director de TICS", "Ejecutivo Comercial", 
  "Gerente Administrativa y Judicial", "Guía Turístico y de experiencia natural", "Jardinero", "Jefe de Cocina", "Líder Administrativa", 
  "Líder de Compras y Almacen", "Líder de Contabilidad", "Líder de Costos y Presupuestos", "Líder de Gestión Ambiental", 
  "Líder de Proceso de alimentos y bebidas", "Líder de Tesorería y Cartera", "Lider Tactico de Infraestructura Tecnológica", 
  "Líder Táctico de mejora Continua", "Líder Táctico desarrollo de Software", "Líder táctico de alimentos y bebidas", 
  "Mensajero", "Mesero", "Porcionador", "Primer Cocinero (a)", "Recepcionista", "Salvavidas", "Steward", "Subdirección de Operaciones Balneario", 
  "Subdirector de Operaciones Hotel", "Supervisor (a) de operaciones", "Supervisor (a) mesa y servicio", "Supervisor Operaciones", 
  "Supervisor Ruta Ecológica", "Técnico de mantenimiento", "Terapeuta SPA"
];

// 🏢 DICCIONARIO INTELIGENTE EN CASCADA (SEDE -> CARGOS)
const CARGOS_POR_SEDE = {
  "Hotel": [
    "Líderes Hotel", "Subdirector de Operaciones Hotel", "Líder de Proceso de alimentos y bebidas",
    "Chef Hotel", "Supervisor (a) mesa y servicio", "Coordinación de recepción",
    "Supervisor (a) de operaciones", "Coordinación SPA", "Coordinador de Mantenimiento"
  ],
  "Ecoparque": [
    "Líderes Ecoparque", "Subdirección de Operaciones Balneario", "Líder táctico de alimentos y bebidas",
    "Jefe de Cocina", "Supervisor (a) mesa y servicio", "Coordinador Operaciones",
    "Supervisor Operaciones", "Coordinación SPA", "Terapeuta SPA", "Coordinador de mantenimiento",
    "Supervisor Ruta Ecológica"
  ],
  "Administrativos": [
    "Administrativos", "Gerente Administrativa y Judicial", "Auditoría Interna",
    "Líder Táctico de mejora Continua", "Coordinador de Servicio al Cliente", "Dirección Administrativa y Financiera",
    "Líder de de Compras y Almacen", "Líder de Costos y Presupuestos", "Líder de Tesorería y Cartera",
    "Contadora de Socios", "Coordinación Administrativa Family Office", "Jefe de control interno",
    "Líder de Contabilidad", "Contador", "Líder Administrativa", "Dirección de Mercadeo y Comunicaciones",
    "Coordinación de Mercadeo y Comunicaciones", "Dirección Comercial", "Coordinación Comercial y Contact Center",
    "Dirección Talento Humano", "Coordinación Seguridad Y Salud en el trabajo", "Líder de Gestión Ambiental",
    "Lider Tactico de Infraestructura Tecnológica", "Director de TICS", "Desarrollador Junior",
    "Líder Táctico desarrollo de Software", "Coordinador de Marketing digital"
  ]
};

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
  informesAuditoria = []
}) {
  // 🧭 PESTAÑAS DE CONTROL SUPERIOR
  const [vistaActiva, setVistaActiva] = useState('dashboard');
  const [grupoExpandido, setGrupoExpandido] = useState(new Date().getFullYear().toString());

  // 🎛️ ESTADOS FILTROS AVANZADOS DASHBOARD
  const [agruparPor, setAgruparPor] = useState('Año');
  const [dashFiltroAnio, setDashFiltroAnio] = useState('Todos');
  const [dashFiltroProceso, setDashFiltroProceso] = useState('Todos');
  const [dashFiltroEstado, setDashFiltroEstado] = useState('Todos');
  const [dashFiltroPrioridad, setDashFiltroPrioridad] = useState('Todos');
  const [dashFiltroResponsable, setDashFiltroResponsable] = useState('Todos');

  // 🔌 MOTOR DE FORMULARIO MATRICIAL ORIGINAL
  const [formInformeId, setFormInformeId] = useState('');
  const [matrixState, setMatrixState] = useState({});
  const [uploadingCell, setUploadingCell] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
// ⚡ MEJORA UX: Carga automáticamente la matriz del informe al dar clic en "Gestionar" desde el historial
  React.useEffect(() => {
    if (editPlan) {
      const hallazgoBase = safeHallazgos.find(h => h.id === editPlan.idHallazgo);
      if (hallazgoBase && hallazgoBase.idInforme) {
        handleInformeChange(String(hallazgoBase.idInforme));
      }
    }
  }, [editPlan, safeHallazgos]);
  // =========================================================
  // 📊 MOTOR DE CÁLCULO ANALÍTICO (FIEL A TU DISEÑO)
  // =========================================================
  const planesEnriquecidos = safePlanes.map(p => {
    const hallazgo = safeHallazgos.find(h => h.id === p.idHallazgo) || {};
    const hoy = new Date();
    const limite = p.fecha ? new Date(p.fecha) : null;
    const esVencido = p.progreso < 100 && limite && limite < hoy;
    
    return {
      ...p,
      proceso: hallazgo.proceso || 'General',
      sede: hallazgo.sede || 'Hotel',
      severidad: hallazgo.severidad || 'Medio',
      esVencido,
      anioTexto: p.fecha ? p.fecha.split('-')[0] : 'Sin Fecha'
    };
  });

  // Filtrado reactivo del Dashboard lateral
  const planesDashboard = planesEnriquecidos.filter(p => {
    if (dashFiltroAnio !== 'Todos' && p.anioTexto !== dashFiltroAnio) return false;
    if (dashFiltroProceso !== 'Todos' && p.proceso !== dashFiltroProceso) return false;
    if (dashFiltroPrioridad !== 'Todos' && p.severidad !== dashFiltroPrioridad) return false;
    if (dashFiltroResponsable !== 'Todos' && p.responsable !== dashFiltroResponsable) return false;
    if (dashFiltroEstado !== 'Todos') {
      if (dashFiltroEstado === 'Cerrado' && p.progreso < 100) return false;
      if (dashFiltroEstado === 'Vencido' && !p.esVencido) return false;
      if (dashFiltroEstado === 'En Proceso' && (p.progreso === 100 || p.esVencido)) return false;
    }
    return true;
  });

  const totalPlanes = planesDashboard.length;
  const cerrados = planesDashboard.filter(p => p.progreso === 100).length;
  const enProceso = planesDashboard.filter(p => p.progreso > 0 && p.progreso < 100 && !p.esVencido).length;
  const pendientes = planesDashboard.filter(p => (p.progreso === 0 || !p.progreso) && !p.esVencido).length;
  const vencidos = planesDashboard.filter(p => p.esVencido).length;
  const cumplimientoGlobal = totalPlanes > 0 ? Math.round((cerrados / totalPlanes) * 100) : 0;

  const criticos = planesDashboard.filter(p => p.severidad === 'Crítico').length;
  const altos = planesDashboard.filter(p => p.severidad === 'Alto').length;
  const medios = planesDashboard.filter(p => p.severidad === 'Medio').length;
  const bajos = planesDashboard.filter(p => p.severidad === 'Bajo').length;
  const pct = (val) => totalPlanes > 0 ? Math.round((val / totalPlanes) * 100) : 0;

  // Agrupador Dinámico
  const planesAgrupados = planesDashboard.reduce((acc, p) => {
    let key = 'Sin clasificar';
    if (agruparPor === 'Año') key = p.anioTexto;
    if (agruparPor === 'Proceso') key = p.proceso;
    if (agruparPor === 'Estado') key = p.progreso === 100 ? 'Cerrados' : p.esVencido ? 'Vencidos' : 'En Proceso';
    if (agruparPor === 'Responsable') key = p.responsable;
    if (agruparPor === 'Prioridad') key = p.severidad;

    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});
  const gruposOrdenados = Object.keys(planesAgrupados).sort((a, b) => b.localeCompare(a));

  const conteoProcesos = planesDashboard.reduce((acc, p) => {
    acc[p.proceso] = (acc[p.proceso] || 0) + 1;
    return acc;
  }, {});
  const topProcesos = Object.entries(conteoProcesos).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const limpiarFiltrosDashboard = () => {
    setDashFiltroAnio('Todos'); setDashFiltroProceso('Todos'); setDashFiltroEstado('Todos');
    setDashFiltroPrioridad('Todos'); setDashFiltroResponsable('Todos');
  };

// 💾 PROCESOR DE ENVÍO MATRICIAL UNIFICADO CON VALIDACIÓN Y CORREOS AUTOMÁTICOS
  const handleMasterMatrixSubmit = async (e) => {
    e.preventDefault();
    if (!formInformeId) return;

    let errorCorreos = false;
    Object.keys(matrixState).forEach(hallazgoId => {
      const node = matrixState[hallazgoId];
      if (node.aplica) {
        node.actividades.forEach(act => {
          if (act.accion && act.accion.trim() !== '') {
            if (!act.correoResponsable || act.correoResponsable.trim() === '') errorCorreos = true;
            if (!act.correoConfirmacion || act.correoConfirmacion.trim() === '') errorCorreos = true;
            if (act.correoResponsable.trim().toLowerCase() !== act.correoConfirmacion.trim().toLowerCase()) errorCorreos = true;
          }
        });
      }
    });

    if (errorCorreos) {
      alert("❌ ALERTA: Los correos electrónicos del responsable no coinciden o están vacíos. Por favor verifique ambas casillas antes de guardar.");
      return;
    }

    const ts = new Date().toLocaleString();
    let updatedPlanesList = [...safePlanes];
    let notificacionesRadicadas = [];
    let notificacionesRevision100 = [];

    const diccionarioCorreos = {
      "Rodolfo González": "auditoria@termales.com.co",
      "Yehison Pineda": "controlinterno@termales.com.co",
      "Angelica Hernandez": "analista.auditoria@termales.com.co",
      "Luz Angela Chico": "analista.controlinterno@termales.com.co"
    };

    Object.keys(matrixState).forEach(hallazgoId => {
      const node = matrixState[hallazgoId];
      if (!node.aplica) return;

      node.actividades.forEach(act => {
        if (!act.accion || act.accion.trim() === '') return;

        const isNew = String(act.id).startsWith('new-');
        const progresoEntero = Math.min(Math.max(parseInt(act.progreso || 0), 0), 100);
        
        let workflowCalculado = act.estadoWorkflow || 'Borrador';

        if (progresoEntero === 100 && workflowCalculado !== 'Cerrado' && workflowCalculado !== 'En Revisión') {
          workflowCalculado = 'En Revisión';
          notificacionesRevision100.push(act);
        } else if (progresoEntero < 100 && workflowCalculado === 'En Revisión') {
          workflowCalculado = 'Borrador';
        }

        const planData = {
          id: isNew ? Date.now() + Math.floor(Math.random() * 10000) : Number(act.id),
          idHallazgo: parseInt(hallazgoId),
          accion: act.accion,
          responsable: act.responsable,
          correoResponsable: act.correoResponsable.trim(),
          auditorAsignado: act.auditorAsignado,
          progreso: progresoEntero,
          fechaInicio: act.fechaInicio || '',
          fecha: act.fecha || '',
          evidenciaUrl: act.evidenciaUrl || '',
          estadoWorkflow: workflowCalculado,
          estado: workflowCalculado === 'Cerrado' ? 'Cerrado' : 'En Proceso',
          anio: act.fecha ? Number(act.fecha.split('-')[0]) : 2026,
          mes: act.fecha ? act.fecha.split('-')[1] : "Junio"
        };

        if (isNew) {
          planData.historialCambios = [{ fecha: ts, usuario: 'Auditor', accion: 'Actividad registrada en matriz masiva' }];
          updatedPlanesList.push(planData);
          notificacionesRadicadas.push(planData);
        } else {
          const idx = updatedPlanesList.findIndex(p => p.id === Number(act.id));
          if (idx !== -1) {
            planData.historialCambios = [...(updatedPlanesList[idx].historialCambios || []), { fecha: ts, usuario: 'Auditor', accion: 'Actividad modificada en matriz' }];
            if (progresoEntero === 100 && updatedPlanesList[idx].progreso < 100) {
              notificacionesRevision100.push(planData);
            }
            updatedPlanesList[idx] = planData;
            notificacionesRadicadas.push(planData); // ✨ Corregido: Se añade a notificaciones para que siempre avise al guardar
          }
        }
      });
    });

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
          const actividadesDeEsteHallazgo = updatedPlanesList.filter(p => String(p.idHallazgo) === String(hallazgoId));
          if (actividadesDeEsteHallazgo.length > 0) {
            const todasAprobadas = actividadesDeEsteHallazgo.every(act => act.estadoWorkflow === 'Cerrado');
            if (todasAprobadas) nuevoEstado = 'Cerrado';
          }
        }

        if (updatedHallazgos[hIndex].estado !== nuevoEstado) {
          updatedHallazgos[hIndex] = {
            ...updatedHallazgos[hIndex],
            estado: nuevoEstado,
            historialCambios: [...(updatedHallazgos[hIndex].historialCambios || []), { fecha: ts, accion: `Estado automatizado a ${nuevoEstado} (Validación de Planes)` }]
          };
          hallazgosModificados = true;
        }
      }
    });

    setPlanes(updatedPlanesList);
    if (hallazgosModificados && setHallazgos) {
      setHallazgos(updatedHallazgos);
      await saveToCloud({ planes: updatedPlanesList, hallazgos: updatedHallazgos });
    } else {
      await saveToCloud({ planes: updatedPlanesList });
    }

    // 📧 NOTIFICACIÓN 1: RADICACIÓN EXITOSA (Para el Jefe y el Auditor)
    if (notificacionesRadicadas.length > 0 && ejecutarDespachoGmailApi) {
      for (const plan of notificacionesRadicadas) {
        await ejecutarDespachoGmailApi({
          ref_consecutivo: `PLAN-${plan.id}`,
          titulo_informe: `Plan de Accion Radicado Exitosamente`,
          proceso_auditado: `Su plan de accion correctivo ha sido registrado exitosamente en el sistema de auditoria GCM.`,
          enlace_pdf: plan.evidenciaUrl || 'https://auditoria-gcm.vercel.app',
          destinatarios: plan.correoResponsable
        });

        const correoAuditor = diccionarioCorreos[plan.auditorAsignado] || "controlinterno@termales.com.co";
        await ejecutarDespachoGmailApi({
          ref_consecutivo: `PLAN-${plan.id}`,
          titulo_informe: `Nuevo Plan de Accion Asignado`,
          proceso_auditado: `Un lider de area ha radicado o actualizado un plan de accion bajo su cargo.`,
          enlace_pdf: 'https://auditoria-gcm.vercel.app',
          destinatarios: correoAuditor
        });
      }
    }

    // 📧 NOTIFICACIÓN 2: ALERTA DE TRABAJO AL 100% PARA EL AUDITOR
    if (notificacionesRevision100.length > 0 && ejecutarDespachoGmailApi) {
      for (const act of notificacionesRevision100) {
        const correoAuditor = diccionarioCorreos[act.auditorAsignado] || "controlinterno@termales.com.co";
        await ejecutarDespachoGmailApi({
          ref_consecutivo: `REVISION-100`,
          titulo_informe: `Verificar soportes cargados al 100 por ciento para proceder con el cierre`,
          proceso_auditado: `Plan de accion completado por el auditado y listo para evaluar.`,
          enlace_pdf: act.evidenciaUrl || 'https://auditoria-gcm.vercel.app',
          destinatarios: correoAuditor
        });
      }
    }

    alert("🎉 ¡Matriz guardada con éxito! Se despacharon las notificaciones de radicación y las alertas correspondientes.");
    handleInformeChange(formInformeId);
  };

  // 🛡️ NUEVA FUNCIÓN: GOBERNANZA DE EVALUACIÓN DIRECTA PARA EL AUDITOR (APROBAR / RECHAZAR)
  const handleEvaluacionAuditor = async (plan, aprobado) => {
    const ts = new Date().toLocaleString();
    let updatedPlanesList = [...safePlanes];
    const idx = updatedPlanesList.findIndex(p => p.id === plan.id);
    if (idx === -1) return;

    if (aprobado) {
      // CASO A: APROBAR PLAN DE ACCIÓN
      updatedPlanesList[idx] = {
        ...updatedPlanesList[idx],
        estadoWorkflow: 'Cerrado',
        estado: 'Cerrado',
        progreso: 100,
        historialCambios: [
          ...(updatedPlanesList[idx].historialCambios || []),
          { fecha: ts, usuario: 'Auditor', accion: 'Plan de acción aprobado y CERRADO formalmente.' }
        ]
      };

      setPlanes(updatedPlanesList);
      await saveToCloud({ planes: updatedPlanesList });

      if (ejecutarDespachoGmailApi) {
        await ejecutarDespachoGmailApi({
          ref_consecutivo: `CIERRE-PLAN-${plan.id}`,
          titulo_informe: `Plan de Acción CERRADO Exitosamente`,
          proceso_auditado: `Felicitaciones, el auditor aprobo las evidencias suministradas. El estado cambio a CERRADO.`,
          enlace_pdf: plan.evidenciaUrl || 'https://auditoria-gcm.vercel.app',
          destinatarios: plan.correoResponsable
        });
      }
      alert("✅ ¡Plan de acción aprobado y cerrado con éxito!");
    } else {
      // CASO B: RECHAZAR PLAN DE ACCIÓN
      const explicacion = prompt("Por favor, escriba la explicación o motivo del rechazo para el jefe de área:");
      if (explicacion === null) return;
      if (explicacion.trim() === '') return alert("❌ Debe digitar una explicación para poder rechazar el plan.");

      updatedPlanesList[idx] = {
        ...updatedPlanesList[idx],
        estadoWorkflow: 'Borrador',
        estado: 'En Proceso',
        progreso: 90, // Bajamos el avance del 100% para habilitar la re-edición del Jefe
        historialCambios: [
          ...(updatedPlanesList[idx].historialCambios || []),
          { fecha: ts, usuario: 'Auditor', accion: `Plan RECHAZADO por el auditor. Motivo: ${explicacion}` }
        ]
      };

      setPlanes(updatedPlanesList);
      await saveToCloud({ planes: updatedPlanesList });

      if (ejecutarDespachoGmailApi) {
        await ejecutarDespachoGmailApi({
          ref_consecutivo: `RECHAZO-PLAN-${plan.id}`,
          titulo_informe: `Plan de Acción RECHAZADO por el Auditor`,
          proceso_auditado: `Su plan requiere revisiones adicionales. Motivo: "${explicacion}". Debe continuar gestionando y subiendo nuevas evidencias.`,
          enlace_pdf: 'https://auditoria-gcm.vercel.app',
          destinatarios: plan.correoResponsable
        });
      }
      alert("❌ Plan rechazado. Se envió la notificación con el motivo detallado al jefe de área.");
    }

    if (formInformeId) handleInformeChange(formInformeId);
  };

  // =========================================================
  // 📂 LOGICA FORMULARIO Y API ORIGINAL (CUSTODIADA)
  // =========================================================
  const handleFileUpload = async (e, hallazgoId, index) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingCell(`${hallazgoId}-${index}`); setUploadProgress(20);
    const formData = new FormData();
    formData.append('appName', 'controlInterno');
    formData.append('description', 'Evidencia de Plan de Acción');
    formData.append('file', file);
    try {
      setUploadProgress(50);
      const response = await fetch('https://repos.termalessantarosa.com.co/api/archivos/upload', { method: 'POST', body: formData });
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      const data = await response.json();
      const urlFinal = `https://repos.termalessantarosa.com.co/api/archivos/auditoria/${data.appName}/${data.fileName}`;
      handleUpdateActivityField(hallazgoId, index, 'evidenciaUrl', urlFinal);
      setUploadingCell(null); setUploadProgress(100);
      alert("🎉 ¡Evidencia guardada con éxito en el servidor de Termales!");
    } catch (err) {
      console.error(err); alert("Error al conectar con el servidor de archivos."); setUploadingCell(null);
    }
  };

  // 🧠 MODIFICADO: JALA AUTOMÁTICAMENTE CARGO Y AUDITOR DESDE EL HALLAZGO
  const handleInformeChange = (informeId) => {
    setFormInformeId(informeId);
    if (!informeId) { setMatrixState({}); return; }
    const reportFindings = safeHallazgos.filter(h => String(h.idInforme) === String(informeId));
    const newState = {};
    reportFindings.forEach(h => {
      const existingActivities = safePlanes.filter(p => p.idHallazgo === h.id);
      if (existingActivities.length > 0) {
        newState[h.id] = { 
          aplica: true, 
          actividades: existingActivities.map(p => ({ 
            ...p, 
            correoConfirmacion: p.correoResponsable,
responsable: p.responsable || (h.responsable ? h.responsable.split(',')[0].trim() : ''),
            auditorAsignado: p.auditorAsignado || h.auditor || ''
          })) 
        };
      } else {
        newState[h.id] = {
          aplica: h.estado !== 'Cerrado',
          actividades: [{ 
            id: 'new-' + Math.random(), 
            accion: '', 
responsable: h.responsable ? h.responsable.split(',')[0].trim() : '',
            auditorAsignado: h.auditor || '', // 👈 HERENCIA AUTOMÁTICA DEL AUDITOR RESPONSABLE
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

  const handleToggleAplica = (hallazgoId, value) => {
    setMatrixState(prev => ({ ...prev, [hallazgoId]: { ...prev[hallazgoId], aplica: value } }));
  };

  // 🧠 MODIFICADO: MANTIENE LA CONSISTENCIA DE HERENCIA SI AGREGAN MÁS ACTIVIDADES
  const handleAddActivity = (hallazgoId) => {
    const hallazgoBase = safeHallazgos.find(h => String(h.id) === String(hallazgoId));
    setMatrixState(prev => ({
      ...prev,
      [hallazgoId]: {
        ...prev[hallazgoId],
        actividades: [...prev[hallazgoId].actividades, { 
          id: 'new-' + Math.random(), 
          accion: '', 
          responsable: hallazgoBase?.responsable || '', // 👈 HERENCIA AUTOMÁTICA
          auditorAsignado: hallazgoBase?.auditor || '', // 👈 HERENCIA AUTOMÁTICA
          fechaInicio: '', 
          fecha: '', 
          progreso: 0, 
          evidenciaUrl: '', 
          estadoWorkflow: 'Borrador' 
        }]
      }
    }));
  };

  const handleRemoveActivity = (hallazgoId, index) => {
    setMatrixState(prev => {
      const currentActividades = [...prev[hallazgoId].actividades];
      currentActividades.splice(index, 1);
      return { ...prev, [hallazgoId]: { ...prev[hallazgoId], actividades: currentActividades } };
    });
  };

  const handleUpdateActivityField = (hallazgoId, index, field, value) => {
    setMatrixState(prev => {
      const currentActividades = prev[hallazgoId].actividades.map((act, idx) => idx === index ? { ...act, [field]: value } : act);
      return { ...prev, [hallazgoId]: { ...prev[hallazgoId], actividades: currentActividades } };
    });
  };

  const aniosDisponibles = [...new Set(planesEnriquecidos.map(p => p.anioTexto).filter(a => a !== 'Sin Fecha'))].sort().reverse();
  const responsablesDisponibles = [...new Set(planesEnriquecidos.map(p => p.responsable).filter(Boolean))].sort();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* 📋 CABECERA PRINCIPAL ESTILO ERP */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sticky top-0 z-40">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Planes de Acción</h2>
          <p className="text-xs text-slate-500 font-bold mt-1">Gestión, seguimiento y cierre de planes derivados de hallazgos</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setVistaActiva('dashboard')} className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${vistaActiva === 'dashboard' ? 'bg-slate-100 text-slate-800 border-2 border-slate-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>📊 Resumen Visual</button>
          <button onClick={() => setVistaActiva('historial')} className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${vistaActiva === 'historial' ? 'bg-slate-100 text-slate-800 border-2 border-slate-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>📜 Historial Matriz</button>
          {isAdmin && (
            <button onClick={() => { setEditPlan(null); setVistaActiva('nuevo'); }} className="px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center shadow-md bg-[#0A3B32] text-white hover:bg-[#062620]">
              <span className="mr-2">➕</span> Nuevo Plan
            </button>
          )}
        </div>
      </div>

      {/* 🚀 VISTA 1: DASHBOARD FIEL A TU MAQUETA */}
      {vistaActiva === 'dashboard' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          
          {/* Fila de 6 Tarjetas Superiores */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center relative overflow-hidden">
               <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Planes</p>
               <div className="flex items-center space-x-2">
                 <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-black shadow-sm">∑</div>
                 <p className="text-2xl font-black text-slate-800">{totalPlanes}</p>
               </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm flex flex-col justify-center relative overflow-hidden">
               <p className="text-[9px] font-black text-emerald-700 uppercase tracking-widest mb-1">Cerrados</p>
               <div className="flex items-center space-x-2">
                 <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-black shadow-sm">✓</div>
                 <div>
                   <p className="text-2xl font-black text-slate-800 leading-none">{cerrados}</p>
                   <p className="text-[9px] font-bold text-emerald-500 mt-0.5">{pct(cerrados)}% del total</p>
                 </div>
               </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm flex flex-col justify-center relative overflow-hidden">
               <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest mb-1">En Proceso</p>
               <div className="flex items-center space-x-2">
                 <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-black shadow-sm">🕒</div>
                 <div>
                   <p className="text-2xl font-black text-slate-800 leading-none">{enProceso}</p>
                   <p className="text-[9px] font-bold text-amber-500 mt-0.5">{pct(enProceso)}% del total</p>
                 </div>
               </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-orange-200 shadow-sm flex flex-col justify-center relative overflow-hidden">
               <p className="text-[9px] font-black text-orange-700 uppercase tracking-widest mb-1">Pendientes</p>
               <div className="flex items-center space-x-2">
                 <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-black shadow-sm">?</div>
                 <p className="text-2xl font-black text-slate-800">{pendientes}</p>
               </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-red-200 shadow-sm flex flex-col justify-center relative overflow-hidden">
               <p className="text-[9px] font-black text-red-700 uppercase tracking-widest mb-1">Vencidos</p>
               <div className="flex items-center space-x-2">
                 <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-black shadow-sm animate-pulse">!</div>
                 <div>
                   <p className="text-2xl font-black text-slate-800 leading-none">{vencidos}</p>
                   <p className="text-[9px] font-bold text-red-500 mt-0.5">{pct(vencidos)}% del total</p>
                 </div>
               </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-sm flex flex-col justify-center relative overflow-hidden">
               <p className="text-[9px] font-black text-blue-700 uppercase tracking-widest mb-1">Cumplimiento</p>
               <div className="flex items-center space-x-2">
                 <div className="w-9 h-9 rounded-full border-4 border-emerald-500 flex items-center justify-center text-[10px] font-black text-slate-800 shadow-sm">{cumplimientoGlobal}%</div>
                 <p className="text-[9px] font-bold text-slate-400">Meta: 90%+</p>
               </div>
            </div>
          </div>

          {/* Bloque Central de 3 Columnas */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* 1. Menú de Filtros Avanzados (Izquierda) */}
            <div className="lg:col-span-1 space-y-4">
               <div className="bg-white rounded-2xl border border-[#1A4B42]/20 shadow-sm overflow-hidden">
                  <div className="bg-[#f8fafa] p-4 border-b border-[#1A4B42]/10 flex items-center justify-between">
                    <h3 className="text-[10px] font-black text-[#1A4B42] uppercase tracking-widest">ORGANIZAR POR</h3>
                    <div className="w-6 h-6 rounded-full bg-[#1A4B42] text-white flex items-center justify-center text-[10px] font-bold">1</div>
                  </div>
                  <div className="p-2 space-y-1">
                    {[
                      { id: 'Año', label: 'Vista por Año', icon: '📅' },
                      { id: 'Proceso', label: 'Vista por Proceso', icon: '🏛️' },
                      { id: 'Estado', label: 'Vista por Estado', icon: '🚩' },
                      { id: 'Prioridad', label: 'Vista por Prioridad', icon: '⚠️' },
                      { id: 'Responsable', label: 'Vista Responsable', icon: '👤' }
                    ].map(btn => (
                      <button 
                        key={btn.id}
                        onClick={() => { setAgruparPor(btn.id); setGrupoExpandido(null); }}
                        className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-3 ${agruparPor === btn.id ? 'bg-[#f0fdf4] text-[#0A3B32] shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                      >
                        <span className="text-sm grayscale opacity-70">{btn.icon}</span><span>{btn.label}</span>
                      </button>
                    ))}
                  </div>
               </div>

               <div className="bg-white rounded-2xl border border-[#1A4B42]/20 shadow-sm p-4 space-y-4">
                  <h3 className="text-[10px] font-black text-[#1A4B42] uppercase tracking-widest border-b border-slate-100 pb-2">FILTROS AVANZADOS</h3>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Año</label>
                    <select value={dashFiltroAnio} onChange={e=>setDashFiltroAnio(e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg p-2 font-bold text-slate-700 outline-none focus:border-[#0A3B32]">
                      <option value="Todos">Todos</option>
                      {aniosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
  <label className="text-[10px] font-bold text-slate-500 mb-1 block">Proceso</label>
  <select value={dashFiltroProceso} onChange={e=>setDashFiltroProceso(e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg p-2 font-bold text-slate-700 outline-none focus:border-[#0A3B32]">
    <option value="Todos">Todos</option>
    {[...new Set(planesEnriquecidos.map(p => p.proceso).filter(Boolean))].sort().map(p => (
      <option key={p} value={p}>{p}</option>
    ))}
  </select>
</div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Estado</label>
                    <select value={dashFiltroEstado} onChange={e=>setDashFiltroEstado(e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg p-2 font-bold text-slate-700 outline-none focus:border-[#0A3B32]">
                      <option value="Todos">Todos</option>
                      <option value="Cerrado">Cerrado (100%)</option>
                      <option value="En Proceso">En Proceso</option>
                      <option value="Vencido">Vencido</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Prioridad</label>
                    <select value={dashFiltroPrioridad} onChange={e=>setDashFiltroPrioridad(e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg p-2 font-bold text-slate-700 outline-none focus:border-[#0A3B32]">
                      <option value="Todos">Todos</option>
                      <option value="Crítico">Crítico</option>
                      <option value="Alto">Alto</option>
                      <option value="Medio">Medio</option>
                      <option value="Bajo">Bajo</option>
                    </select>
                  </div>
                  <button onClick={limpiarFiltrosDashboard} className="w-full bg-[#f8fafa] hover:bg-slate-100 text-[#0A3B32] border border-[#1A4B42]/10 font-bold text-[10px] uppercase tracking-widest py-2.5 rounded-lg flex items-center justify-center space-x-2 transition-all">
                    <span>Limpiar Filtros</span> <span>⚗️</span>
                  </button>
               </div>
            </div>

            {/* 2. Acordeones Dinámicos Centrales */}
            <div className="lg:col-span-2 space-y-4">
               {gruposOrdenados.length === 0 ? (
                 <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center text-slate-400 font-bold italic">No hay planes que coincidan con los filtros.</div>
               ) : (
                 gruposOrdenados.map(grupo => {
                   const items = planesAgrupados[grupo];
                   const gCerrados = items.filter(p => p.progreso === 100).length;
                   const gProceso = items.filter(p => p.progreso < 100 && !p.esVencido).length;
                   const gVencidos = items.filter(p => p.esVencido).length;
                   const gCumplimiento = items.length > 0 ? Math.round((gCerrados / items.length) * 100) : 0;
                   const isExpanded = grupoExpandido === grupo;

                   return (
                     <div key={grupo} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
                       <div onClick={() => setGrupoExpandido(isExpanded ? null : grupo)} className={`p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors ${isExpanded ? 'border-b border-slate-100 bg-slate-50/50' : ''}`}>
                         <div className="flex items-center space-x-3">
                           <span className="text-xl">📅</span>
                           <h4 className="text-sm sm:text-base font-black text-slate-800">{grupo} <span className="text-slate-400 font-medium text-xs">({items.length} planes)</span></h4>
                         </div>
                         {!isExpanded && (
                           <div className="hidden md:flex items-center space-x-4 text-[10px] font-bold bg-white px-3 py-1 rounded-xl border border-slate-100 shadow-sm">
                             <span className="text-emerald-600 flex items-center"><span className="text-emerald-500 mr-1 text-xs">✓</span> {gCerrados}</span>
                             <span className="text-amber-500 flex items-center"><span className="text-amber-500 mr-1 text-xs">🕒</span> {gProceso}</span>
                             <span className="text-red-600 flex items-center"><span className="text-red-500 mr-1 text-xs">!</span> {gVencidos}</span>
                             <span className="text-slate-700 border-l pl-3 font-black text-xs text-emerald-600">{gCumplimiento}%</span>
                           </div>
                         )}
                       </div>

                       {isExpanded && (
                         <div className="p-4 sm:p-5 bg-white animate-in slide-in-from-top-2 duration-300">
                           <div className="grid grid-cols-5 gap-2 mb-4 border-b pb-4 text-center text-[10px] font-black text-slate-400 uppercase">
                             <div><p>Cerrados</p><p className="text-base text-emerald-600 font-black mt-0.5">{gCerrados}</p></div>
                             <div className="border-l"><p>En Proceso</p><p className="text-base text-amber-500 font-black mt-0.5">{gProceso}</p></div>
                             <div className="border-l"><p>Vencidos</p><p className="text-base text-red-500 font-black mt-0.5">{gVencidos}</p></div>
                             <div className="border-l col-span-2 bg-slate-50 rounded-xl p-1"><p>Cumplimiento</p><p className="text-base text-emerald-700 font-black mt-0.5">{gCumplimiento}%</p></div>
                           </div>

                           <div className="overflow-x-auto">
                             <table className="w-full text-[10px] text-left">
                               <thead className="text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                 <tr>
                                   <th className="pb-2 font-bold">Plan</th>
                                   <th className="pb-2 font-bold">Actividad Remedial</th>
                                   <th className="pb-2 font-bold">Proceso</th>
                                   <th className="pb-2 font-bold text-center">Prioridad</th>
                                   <th className="pb-2 font-bold text-center">Vencimiento</th>
                                   <th className="pb-2 font-bold text-right">Avance</th>
                                 </tr>
                               </thead>
                               <tbody className="divide-y divide-slate-50">
                                 {items.map(p => (
                                   <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                     <td className="py-2.5 font-mono font-black text-slate-700">PLA-{p.id.toString().substring(0,3)}</td>
                                     <td className="py-2.5 font-bold text-slate-600 max-w-[140px] truncate" title={p.accion}>{p.accion}</td>
                                     <td className="py-2.5 font-medium text-slate-500 truncate max-w-[80px]">{p.proceso}</td>
                                     <td className="py-2.5 text-center">
                                       <span className={`px-1.5 py-0.5 rounded-md font-black text-[8px] border ${p.severidad === 'Crítico' ? 'bg-red-50 text-red-600 border-red-200' : p.severidad === 'Alto' ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>{p.severidad}</span>
                                     </td>
                                     <td className={`py-2.5 text-center font-bold ${p.esVencido ? 'text-red-500' : 'text-slate-400'}`}>{p.fecha || 'N/A'}</td>
                                     <td className="py-2.5 text-right font-black text-emerald-600">{p.progreso}%</td>
                                   </tr>
                                 ))}
                               </tbody>
                             </table>
                           </div>
                         </div>
                       )}
                     </div>
                   );
                 })
               )}
            </div>

            {/* 3. Columna Derecha (Gráfico de Dona y Rankings) */}
            <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 h-fit sticky top-24">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 border-b pb-2">Distribución por prioridad</h3>
                <div className="flex items-center justify-center mb-6">
                   <div className="relative w-36 h-36 rounded-full border-[14px] border-emerald-500 border-l-red-500 border-t-red-500 border-r-orange-500 border-b-amber-500 flex items-center justify-center transform -rotate-45 shadow-inner">
                      <div className="transform rotate-45 text-center">
                         <span className="block text-3xl font-black text-slate-800 leading-none">{totalPlanes}</span>
                         <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">Total</span>
                      </div>
                   </div>
                </div>

                <div className="space-y-2 mb-6 text-[10px] font-bold">
                   <div className="flex justify-between items-center"><span className="flex items-center text-slate-600"><span className="w-2.5 h-2.5 rounded-full bg-red-500 mr-2"></span> Críticas</span><span className="text-slate-800">{criticos}</span></div>
                   <div className="flex justify-between items-center"><span className="flex items-center text-slate-600"><span className="w-2.5 h-2.5 rounded-full bg-orange-500 mr-2"></span> Altas</span><span className="text-slate-800">{altos}</span></div>
                   <div className="flex justify-between items-center"><span className="flex items-center text-slate-600"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 mr-2"></span> Medias</span><span className="text-slate-800">{medios}</span></div>
                </div>

                {topProcesos.length > 0 && (
                  <div className="border-t pt-4">
                    <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Top 5 procesos con más planes</h3>
                    <div className="space-y-2.5">
                      {topProcesos.map(([proc, count], idx) => (
                        <div key={idx} className="flex items-center text-[10px]">
                          <span className="w-16 truncate text-slate-600 font-bold pr-2">{proc}</span>
                          <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-[#0A3B32] h-full rounded-full" style={{width: `${(count/totalPlanes).toFixed(1)*100}%`}}></div>
                          </div>
                          <span className="w-6 text-right font-black text-slate-800">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>

          </div>
        </div>
      )}

      {/* 🚀 VISTA 2: FORMULARIO MATRICIAL ORIGINAL COMPLETO (PRESERVADO Y RE-POTENCIADO) */}
      {vistaActiva === 'nuevo' && (
        <div id="edit-form" className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-6 animate-in slide-in-from-right-8 duration-500">
          <div className="border-b pb-3 flex justify-between items-center">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">➕ Formular Acciones por Informe Emitido</h3>
            {formInformeId && <button onClick={() => handleInformeChange('')} className="text-[10px] text-red-500 font-bold uppercase hover:underline">✖️ Limpiar Matriz</button>}
          </div>

          <div className="w-full">
            <label className="font-black text-gray-700 block mb-1.5 text-xs">1. Seleccione el Informe Emitido Evaluado</label>
            <select value={formInformeId} onChange={(e) => handleInformeChange(e.target.value)} className="w-full border-2 border-slate-300 rounded-xl p-3 bg-white font-black text-slate-800 focus:ring-2 focus:ring-blue-600 outline-none text-xs shadow-sm">
              <option value="">-- Seleccione el Informe de Auditoría Radicado --</option>
              {informesAuditoria.map((inf) => <option key={inf.id} value={inf.id}>[{inf.ref}] {inf.titulo} — ({inf.proceso})</option>)}
            </select>
          </div>

          {formInformeId && (
            <form onSubmit={handleMasterMatrixSubmit} className="space-y-6">
              {safeHallazgos.filter(h => String(h.idInforme) === String(formInformeId)).map((h) => {
                const node = matrixState[h.id] || { aplica: true, actividades: [] };
                return (
                  <div key={`matrix-card-${h.id}`} className={`border rounded-2xl p-5 shadow-sm space-y-4 transition-all ${node.aplica ? 'border-blue-200 bg-slate-50/50' : 'border-slate-200 bg-slate-100 opacity-60'}`}>
                    
                    {/* ENCABEZADO DE CADA CARD ENRIQUECIDO CON DATOS MAESTROS DEL HALLAZGO */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-3 gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 bg-red-100 text-red-800 font-black rounded text-[9px] uppercase tracking-wider">{h.ref}</span>
                          <span className="px-2 py-0.5 bg-[#f0fdf4] text-[#0A3B32] font-black rounded text-[9px] uppercase tracking-wider">📋 Proceso: {h.proceso || 'No asignado'}</span>
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 font-black rounded text-[9px] uppercase tracking-wider">⚖️ Clase: {h.claseObservacion || 'Hallazgo'}</span>
                        </div>
                        <h4 className="text-xs font-black text-slate-900 mt-2">{h.titulo}</h4>
                      </div>
                      <div className="flex items-center space-x-1 shrink-0 bg-white p-1 rounded-lg border shadow-sm">
                        <button type="button" onClick={() => handleToggleAplica(h.id, true)} className={`px-3 py-1.5 rounded-md font-bold text-[10px] uppercase ${node.aplica ? 'bg-blue-600 text-white shadow-sm':'text-slate-500 hover:bg-slate-100'}`}>Sí Aplica</button>
                        <button type="button" onClick={() => handleToggleAplica(h.id, false)} className={`px-3 py-1.5 rounded-md font-bold text-[10px] uppercase ${!node.aplica ? 'bg-slate-400 text-white shadow-sm':'text-slate-500 hover:bg-slate-100'}`}>No Aplica</button>
                      </div>
                    </div>

                    {node.aplica && (
                      <div className="space-y-4">
{Array.isArray(node?.actividades) && node.actividades.map((act, index) => (
                          <div key={`act-row-${index}`} className="bg-white border rounded-xl p-4 shadow-sm space-y-3 relative">
                            <div className="flex justify-between items-center border-b pb-1">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Actividad #{index + 1}</span>
                              {node.actividades.length > 1 && <button type="button" onClick={() => handleRemoveActivity(h.id, index)} className="text-red-500 font-bold text-[10px] uppercase">🗑️ Quitar</button>}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-6 gap-3 text-xs">
                              
                              {/* CAMPO A: ACCION CORRECTIVA */}
                              <div className="md:col-span-2">
                                <label className="font-bold text-gray-500 block mb-0.5">Acción Correctiva / Remedial</label>
                                <input type="text" value={act.accion} onChange={(e) => handleUpdateActivityField(h.id, index, 'accion', e.target.value)} className="w-full border p-2 rounded-lg font-medium bg-slate-50 focus:bg-white text-slate-800" required />
                              </div>
                              
                              {/* CAMPO S1: SEDE DEL PROCESO */}
                <div className="md:col-span-1">
                  <label className="font-bold text-slate-700 block mb-0.5">🏢 Sede</label>
                  <select 
                    value={act.sede || 'Administrativos'} 
                    onChange={(e) => { 
                      handleUpdateActivityField(h.id, index, 'sede', e.target.value);
                      handleUpdateActivityField(h.id, index, 'responsable', ''); // Limpia el cargo si cambian de sede
                    }} 
                    className="w-full border p-2 rounded-lg font-black bg-slate-50 focus:bg-white text-slate-700 cursor-pointer shadow-sm border-slate-300"
                  >
                    {Object.keys(CARGOS_POR_SEDE).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {/* CAMPO B: DUEÑO DEL PROCESO CARGO */}
                <div className="md:col-span-1">
                  <label className="font-bold text-slate-700 block mb-0.5">👔 Cargo (Dueño)</label>
                  <select 
                    value={act.responsable || ''} 
                    onChange={(e) => handleUpdateActivityField(h.id, index, 'responsable', e.target.value)} 
                    className="w-full border p-2 rounded-lg font-black bg-white focus:bg-white text-slate-800 cursor-pointer shadow-sm border-slate-300" 
                    required
                  >
                    <option value="">-- Seleccionar --</option>
{(CARGOS_POR_SEDE[act.sede] || CARGOS_POR_SEDE['Administrativos'] || []).map(cargo => <option key={cargo} value={cargo}>{cargo}</option>)}
                  </select>
                </div>
                              
                              {/* CAMPO C: AUDITOR RESPONSABLE - COMPLETAMENTE BLOQUEADO EN MODO LECTURA */}
                              <div className="md:col-span-2">
                                <label className="font-bold text-blue-600 block mb-0.5">🛡️ Auditor Responsable (Bloqueado)</label>
                                <input 
                                  type="text" 
                                  value={act.auditorAsignado || ''} 
                                  disabled 
                                  className="w-full border border-blue-200 p-2 rounded-lg font-black text-blue-900 bg-blue-50/50 cursor-not-allowed shadow-inner" 
                                />
                              </div>

                              <div className="md:col-span-3">
                                <label className="font-bold text-purple-700 block mb-0.5">📧 Correo Responsable</label>
                                <input type="email" value={act.correoResponsable || ''} onChange={(e) => handleUpdateActivityField(h.id, index, 'correoResponsable', e.target.value)} className="w-full border border-purple-200 p-2 rounded-lg bg-purple-50 focus:bg-white" required />
                              </div>
                              <div className="md:col-span-3">
                                <label className="font-bold text-purple-700 block mb-0.5">✓ Confirmar Correo</label>
                                <input type="email" value={act.correoConfirmacion || ''} onChange={(e) => handleUpdateActivityField(h.id, index, 'correoConfirmacion', e.target.value)} className="w-full border p-2 rounded-lg bg-purple-50 focus:bg-white" required />
                              </div>
                              <div className="md:col-span-1">
                                <label className="font-bold text-gray-500 block mb-0.5">Avance ({act.progreso}%)</label>
                                <input type="number" min="0" max="100" value={act.progreso} onChange={(e) => handleUpdateActivityField(h.id, index, 'progreso', e.target.value)} className="w-full border p-2 rounded-lg font-black text-blue-700 bg-blue-50" />
                              </div>
                              <div className="md:col-span-1">
                                <label className="font-bold text-gray-500 block mb-0.5">Fecha Inicio</label>
                                <input type="date" value={act.fechaInicio} onChange={(e) => handleUpdateActivityField(h.id, index, 'fechaInicio', e.target.value)} className="w-full border p-1.5 rounded-lg" />
                              </div>
                              <div className="md:col-span-1">
                                <label className="font-bold text-gray-500 block mb-0.5">Fecha Límite</label>
                                <input type="date" value={act.fecha} onChange={(e) => handleUpdateActivityField(h.id, index, 'fecha', e.target.value)} className="w-full border p-1.5 rounded-lg" />
                              </div>
                              <div className="md:col-span-3 bg-slate-50 border border-slate-200 p-2 rounded-xl">
                                <label className="font-black text-slate-700 block mb-1 text-[10px] uppercase">☁️ Evidencia / Soporte Digital</label>
                                {uploadingCell === `${h.id}-${index}` ? (
                                  <p className="text-[9px] font-bold text-slate-500">Subiendo...</p>
                                ) : act.evidenciaUrl ? (
                                  <a href={act.evidenciaUrl} target="_blank" rel="noreferrer" className="text-[10px] text-emerald-700 font-black bg-emerald-100 border p-1.5 rounded-lg inline-block">✅ Ver Soporte Subido</a>
                                ) : (
                                  <label className="cursor-pointer flex items-center justify-center w-full border-2 border-dashed border-slate-300 py-2 rounded-lg bg-white">
                                    <span className="text-[10px] font-bold text-slate-500">Subir Soporte</span>
                                    <input type="file" className="hidden" accept=".pdf, .jpg, .png, .docx" onChange={(e) => handleFileUpload(e, h.id, index)} />
                                  </label>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        <button type="button" onClick={() => handleAddActivity(h.id)} className="bg-white border-2 border-dashed border-slate-300 text-blue-600 font-bold py-2 px-4 rounded-xl text-[10px] uppercase">➕ Agregar Otra Actividad</button>
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="pt-4 border-t flex justify-end">
                <button type="submit" className="bg-[#004d40] hover:bg-[#003d33] text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs">💾 Guardar Matriz y Sincronizar Estados</button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* 🚀 VISTA 3: TABLA DE HISTORIAL ORIGINAL COMPLETA (PRESERVADA) */}
      {vistaActiva === 'historial' && (
        <div className="space-y-6 animate-in slide-in-from-left-8 duration-500">
          <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b flex flex-col md:flex-row justify-between items-center bg-slate-50 gap-3">
               <h3 className="font-bold text-slate-700 uppercase text-xs tracking-widest">Seguimiento de Actividades / Planes</h3>
               <div className="flex flex-wrap gap-2 justify-end">
                  <select value={columnFilters['auditorAsignado'] || ''} onChange={(e) => handleColFilterChange('auditorAsignado', e.target.value)} className="border border-slate-300 rounded-lg text-[10px] py-1.5 px-2 bg-blue-50 font-black text-blue-800 shadow-sm">
                    <option value="">🛡️ Todos los Auditores</option>
                    <option value="Rodolfo González">Rodolfo González</option><option value="Yehison Pineda">Yehison Pineda</option><option value="Angelica Hernandez">Angelica Hernandez</option><option value="Luz Angela Chico">Luz Angela Chico</option>
                  </select>
                  <select value={columnFilters['estadoWorkflow'] || ''} onChange={(e) => handleColFilterChange('estadoWorkflow', e.target.value)} className="border border-slate-300 rounded-lg text-[10px] py-1.5 px-2 bg-amber-50 font-black text-amber-800 shadow-sm">
                    <option value="">📋 Todas las Fases</option><option value="Borrador">✏️ Borrador</option><option value="En Revisión">⏳ En Revisión</option><option value="Cerrado">✅ Cerradas</option>
                  </select>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-slate-400 text-[10px]">🔍</span>
                    <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-6 pr-2 py-1.5 border border-slate-300 rounded-lg text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-slate-800 w-32 shadow-sm" />
                  </div>
               </div>
            </div>
            <table className="w-full text-xs text-left divide-y">
              <thead className="bg-slate-900 text-white font-bold text-[10px] uppercase">
                <tr>
                  <th className="p-3">ID Plan</th>
                  <th className="p-3">Gobernanza (Fase)</th>
                  <th className="p-3">Hallazgo / Proceso</th>
                  <th className="p-3">Acción Remedial Programada</th>
                  <th className="p-3 w-40">% Avance</th>
                  <th className="p-3 text-center">Gestión</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-700">
                {planesEnriquecidos.map((p, index) => (
                  <tr key={index} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-mono font-black text-slate-900">PLA-{p.id.toString().substring(0,3)}</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded font-black text-[9px] uppercase border bg-slate-100 text-slate-700">{p.estadoWorkflow}</span></td>
                    <td className="p-3 text-red-600 font-bold">{p.proceso}<span className="block text-[9px] text-slate-400 font-black">{p.sede}</span></td>
                    <td className="p-3 font-medium text-slate-800">
                      <div className="font-black text-slate-900">{p.accion}</div>
                      <div className="text-[9px] text-slate-500 mt-1 bg-slate-50 p-2 rounded">👤 Ejecutor: {p.responsable} | 🛡️ Auditor: {p.auditorAsignado}</div>
                    </td>
                    <td className="p-3"><ProgressBar progress={p.progreso} /></td>
                    <td className="p-3 text-center flex flex-col space-y-1 items-center justify-center">
                      <button onClick={() => { setEditPlan(p); setVistaActiva('nuevo'); scrollToForm(); }} className="bg-amber-100 text-amber-800 font-bold px-3 py-1.5 rounded-lg text-[10px] w-full">Gestionar</button>
                      
                      {/* 🛡️ ACCIONES DIRECTAS DE GOBERNANZA PARA PLANES AL 100% */}
                      {p.estadoWorkflow === 'En Revisión' && (
                        <div className="flex flex-col gap-1 w-full mt-1 pt-1 border-t border-slate-200">
                          <button type="button" onClick={() => handleEvaluacionAuditor(p, true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-2 py-1 rounded text-[9px] uppercase tracking-wider transition-all shadow-sm">✓ Aprobar</button>
                          <button type="button" onClick={() => handleEvaluacionAuditor(p, false)} className="bg-rose-600 hover:bg-rose-700 text-white font-black px-2 py-1 rounded text-[9px] uppercase tracking-wider transition-all shadow-sm">✕ Rechazar</button>
                        </div>
                      )}

                      {isAdmin && <button onClick={() => handleDeleteItem('planes', p.id)} className="bg-red-50 text-red-700 font-bold px-2 py-1 rounded text-[10px] w-full mt-1">Eliminar</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}