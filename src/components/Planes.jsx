import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useDeleteConfirmation } from '../hooks/useDeleteConfirmation.js';
import { createPortal } from 'react-dom';
import { BadgeCheck, CheckCircle2, ClipboardCheck, Play, Search, X } from 'lucide-react';

import { useCatalogos } from '../context/useCatalogos';
import { exportarA_PDF } from '../utils/pdfUtils';
import { apiService } from '../services/apiService';
import { TIPOS_FUENTE_HISTORIAL, resolverCategoriaFuente } from '../constants/diccionariosGRC';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard.js';
import { esInformePrograma, pendienteEvaluacionInicial, disenoInicialBloqueado, calcularPuntajeDiseno, ESTADO_EVALUACION_INICIAL, ESTADO_AJUSTES_INICIALES } from '../utils/programPlanWorkflow.js';

const normalizarIdentidad = valor => String(valor || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const obtenerConflictoRolesPlan = ({ correoResponsable, correoRevisor, correoAuditor }) => {
  const roles = [
    ['ejecutor', correoResponsable],
    ['revisor', correoRevisor],
    ['auditor', correoAuditor],
  ].map(([nombre, correo]) => [nombre, String(correo || '').trim().toLowerCase()])
    .filter(([, correo]) => correo);
  for (let primero = 0; primero < roles.length; primero += 1) {
    for (let segundo = primero + 1; segundo < roles.length; segundo += 1) {
      if (roles[primero][1] === roles[segundo][1]) {
        return `${roles[primero][0]} y ${roles[segundo][0]}`;
      }
    }
  }
  return '';
};

const obtenerTiempoInforme = fecha => {
  const valor = String(fecha || '').trim();
  if (!valor) return null;
  const fechaIso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (fechaIso) return Date.UTC(Number(fechaIso[1]), Number(fechaIso[2]) - 1, Number(fechaIso[3]));
  const fechaLocal = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(valor);
  if (fechaLocal) return Date.UTC(Number(fechaLocal[3]), Number(fechaLocal[2]) - 1, Number(fechaLocal[1]));
  const tiempo = Date.parse(valor);
  return Number.isFinite(tiempo) ? tiempo : null;
};

const obtenerTiempoActividad = valorFecha => {
  const valor = String(valorFecha || '').trim();
  if (!valor) return null;
  const fechaLocal = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?)?$/i.exec(valor);
  if (fechaLocal) {
    const [, dia, mes, anio, hora = '0', minuto = '0', segundo = '0', periodo = ''] = fechaLocal;
    let hora24 = Number(hora);
    const periodoNormalizado = periodo.replace(/[\s.]/g, '').toLowerCase();
    if (periodoNormalizado === 'pm' && hora24 < 12) hora24 += 12;
    if (periodoNormalizado === 'am' && hora24 === 12) hora24 = 0;
    return new Date(Number(anio), Number(mes) - 1, Number(dia), hora24, Number(minuto), Number(segundo)).getTime();
  }
  const tiempo = Date.parse(valor);
  return Number.isFinite(tiempo) ? tiempo : null;
};

const obtenerUltimoCambio = registro => {
  const tiempos = (Array.isArray(registro?.historialCambios) ? registro.historialCambios : [])
    .map(cambio => obtenerTiempoActividad(cambio?.timestamp || cambio?.fecha || cambio?.fechaHora))
    .filter(tiempo => tiempo !== null);
  return tiempos.length > 0 ? Math.max(...tiempos) : null;
};

const compararInformesPorFecha = (a, b) => {
  const fechaA = obtenerTiempoInforme(a.fecha);
  const fechaB = obtenerTiempoInforme(b.fecha);
  if (fechaA !== fechaB) {
    if (fechaA === null) return 1;
    if (fechaB === null) return -1;
    return fechaB - fechaA;
  }
  return String(b.ref || b.id || '').localeCompare(String(a.ref || a.id || ''), 'es', { numeric: true, sensitivity: 'base' });
};
const ESTADO_PENDIENTE_VALIDACION_REVISOR = 'Pendiente Validación Revisor';

const esAuditorAsignado = (plan, correo, perfil) => {
  const correosAsignados = [plan?.correoAuditor, plan?.correoAuditorResponsable, plan?.correo_auditor]
    .map(normalizarIdentidad)
    .filter(Boolean);
  if (correosAsignados.length > 0) return correosAsignados.includes(normalizarIdentidad(correo));

  const auditorAsignado = normalizarIdentidad(
    plan?.auditorAsignado || plan?.auditorResponsable || plan?.auditor
  );
  const identidadesUsuario = [perfil?.nombreResponsable, perfil?.nombre, perfil?.cargo]
    .map(normalizarIdentidad)
    .filter(Boolean);
  return Boolean(auditorAsignado && identidadesUsuario.includes(auditorAsignado));
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
  puedeCrearPlanes = false,
  reviewReportId = null,
  detallePanelPlanes = null,
  setDetallePanelPlanes = () => {},
  misPlanesEjecucion = [],
  misPlanesRevision = [],
  misPlanesAprobacion = [],
  encolarReintentoNotificacion = () => {},
  user = null,
  perfilUsuario = null,
  editPlan,
  setEditPlan,
  ejecutarDespachoGmailApi,
  prepararEnvioGmail,
  showNotification = () => {},
  scrollToForm,
  handleDeleteItem,
  applyFilters,
  safeHallazgos = [],
  setHallazgos, 
  safePlanes = [],
  setPlanes,
  saveToCloud,
  searchTerm = '',
  setSearchTerm = () => {},
  columnFilters = {},
  handleColFilterChange = () => {},
  informesAuditoria = [],
  fuentesMejora = []
}) {
  const confirmarEliminacion = useDeleteConfirmation();
  const { catalogoCargos = [], cargosEmpresa: CARGOS_EMPRESA, sedesEmpresa } = useCatalogos();

  const [enviarNotificaciones, setEnviarNotificaciones] = useState(true);
  const [busquedaRapida, setBusquedaRapida] = useState('');
  const [generandoPdfId, setGenerandoPdfId] = useState(null);
  const [pdfProgress, setPdfProgress] = useState('Preparando el informe…');
  const [evalDetalleModal, setEvalDetalleModal] = useState(null);
  const [historialModal, setHistorialModal] = useState({ activo: false, plan: null });
  const [modalEficaciaCierre, setModalEficaciaCierre] = useState({
    activo: false,
    plan: null,
    conclusion: '',
    fueEficaz: '',
    requiereAcciones: 'no',
    observaciones: '',
  });
  const [confirmacionCierreEficaz, setConfirmacionCierreEficaz] = useState(null);
  const [guardandoEficaciaCierre, setGuardandoEficaciaCierre] = useState(false);
  const [revisionInformeId, setRevisionInformeId] = useState(reviewReportId);
  const [mostrarMotivoCorreccion, setMostrarMotivoCorreccion] = useState(false);
  const [motivoCorreccion, setMotivoCorreccion] = useState('');
  const [guardandoDecisionRevision, setGuardandoDecisionRevision] = useState(false);
  const [guardandoAccionKey, setGuardandoAccionKey] = useState(null);
  const [confirmacionAccionGuardada, setConfirmacionAccionGuardada] = useState('');

  useEffect(() => {
    if (!confirmacionAccionGuardada) return undefined;
    const mainArea = document.getElementById('main-scroll-area');
    if (mainArea) mainArea.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    const temporizador = window.setTimeout(() => setConfirmacionAccionGuardada(''), 7000);
    return () => window.clearTimeout(temporizador);
  }, [confirmacionAccionGuardada]);
  const handleDescargarPdfConLoader = async (idInf, refInforme) => {
    if (generandoPdfId) return;
    try {
      setGenerandoPdfId(idInf);
      setPdfProgress('Preparando el informe…');
      await new Promise(resolve => setTimeout(resolve, 100));
      const element = document.getElementById(`pdf-export-plan-${idInf}`);
      const generado = await exportarA_PDF(
        element,
        `Plan_Mejoramiento_${refInforme}.pdf`,
        '#ffffff',
        {
          format: 'JPEG',
          quality: 0.88,
          pixelRatio: 2,
          onProgress: ({ stage }) => setPdfProgress(stage),
        }
      );
      if (!generado) throw new Error('No se pudo generar el archivo.');
    } catch (error) {
      console.error('Error al generar PDF:', error);
      alert('No se pudo generar el PDF. Verifique e intente nuevamente.');
    } finally {
      setGenerandoPdfId(null);
    }
  };

  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const textoBuscado = busquedaRapida.trim().toUpperCase();
  const digitosBuscados = busquedaRapida.replace(/\D/g, '');
  const numBuscado = digitosBuscados ? parseInt(digitosBuscados, 10) : null;
  const hallazgosPorId = useMemo(
    () => new Map(safeHallazgos.map(hallazgo => [String(hallazgo.id), hallazgo])),
    [safeHallazgos]
  );

  const informesMatch = useMemo(() => {
    if (textoBuscado.length === 0) return [];
    return informesAuditoria.filter(inf => {
      if (inf.ref && inf.ref.toUpperCase().includes(textoBuscado)) return true;
      if (inf.proceso && inf.proceso.toUpperCase().includes(textoBuscado)) return true;
      if (inf.titulo && inf.titulo.toUpperCase().includes(textoBuscado)) return true;
      if (numBuscado !== null && inf.ref) {
        const numInf = parseInt(inf.ref.split('-').pop(), 10);
        if (numInf === numBuscado) return true;
      }
      return false;
    });
  }, [textoBuscado, numBuscado, informesAuditoria]);

  const planesMatch = useMemo(() => {
    if (textoBuscado.length === 0) return [];
    return safePlanes.filter(p => {
      const procesoPlan = hallazgosPorId.get(String(p.idHallazgo))?.proceso || '';
      const strId = p.id.toString();
      if (digitosBuscados && strId.endsWith(digitosBuscados)) return true;
      if (numBuscado !== null && strId.length >= 4) {
        const ultimasCifras = parseInt(strId.slice(-4), 10);
        if (ultimasCifras === numBuscado) return true;
      }
      if (numBuscado !== null && p.id === numBuscado) return true;
      if (p.accion && p.accion.toUpperCase().includes(textoBuscado)) return true;
      if (procesoPlan.toUpperCase().includes(textoBuscado)) return true;
      return false;
    }).slice(0, 10);
  }, [textoBuscado, digitosBuscados, numBuscado, safePlanes, hallazgosPorId]);

  const seleccionarInforme = (informe) => {
    setEditPlan(null);
    setVistaActiva('nuevo');
    handleInformeChange(String(informe.id));
    scrollToForm();
    setBusquedaRapida('');
    setShowSearchDropdown(false);
  };

  const seleccionarPlan = (plan) => {
    setEditPlan(plan);
    setVistaActiva('nuevo');
    scrollToForm();
    setBusquedaRapida('');
    setShowSearchDropdown(false);
  };
  
  const buscarPlanPorId = (e) => {
    e.preventDefault();
    if (informesMatch.length > 0) seleccionarInforme(informesMatch[0]);
    else if (planesMatch.length > 0) seleccionarPlan(planesMatch[0]);
    else alert(`❌ No se encontraron coincidencias para: ${busquedaRapida}`);
  };

  // 🧭 PESTAÑAS DE CONTROL SUPERIOR
  const [vistaActiva, setVistaActiva] = useState('dashboard');
  const [grupoExpandido, setGrupoExpandido] = useState(new Date().getFullYear().toString());
  const [paginaGrupoDashboard, setPaginaGrupoDashboard] = useState(1);
const [accionesPorPaginaDashboard, setAccionesPorPaginaDashboard] = useState(20);
  const [informePlanesExpandido, setInformePlanesExpandido] = useState(null);
  const [paginaHistorialMatriz, setPaginaHistorialMatriz] = useState(1);
  const [informesPorPaginaMatriz, setInformesPorPaginaMatriz] = useState(10);
  const [filtroFuenteMatriz, setFiltroFuenteMatriz] = useState('');

 // ✨ NUEVA FUNCIÓN: Protege contra salidas accidentales al cambiar de pestaña
  const cambiarVistaSegura = (nuevaVista) => {
    if (nuevaVista === vistaActiva) return; // Si ya está ahí, no hace nada

    if (vistaActiva === 'nuevo' && formInformeId && !modoRevisionMatriz) {
      guardNavigationPlanes(() => {
        setMatrixDirty(false);
        setEditPlan(null);
        setFormInformeId(''); // Limpiamos la matriz
        setMatrixState({});
        setModoRevisionMatriz(false);
        setVistaActiva(nuevaVista); // Permitimos la salida
      });
    } else {
      // Si no está en el formulario, o está en modo lectura, cambia de vista libremente
      setEditPlan(null);
      setFormInformeId('');
      setMatrixState({});
      setModoRevisionMatriz(false);
      setMatrixDirty(false);
      setVistaActiva(nuevaVista);
    }
  };

  // 🎛️ ESTADOS FILTROS AVANZADOS DASHBOARD
  const [agruparPor, setAgruparPor] = useState('Año');
  const [dashFiltroAnio, setDashFiltroAnio] = useState('Todos');
  const [dashFiltroProceso, setDashFiltroProceso] = useState('Todos');
  const [dashFiltroSubproceso, setDashFiltroSubproceso] = useState('Todos'); 
  const [dashFiltroEstado, setDashFiltroEstado] = useState('Todos');
  const [dashFiltroPrioridad, setDashFiltroPrioridad] = useState('Todos');
  const [dashFiltroResponsable, setDashFiltroResponsable] = useState('Todos');
  const [dashFiltroFuente, setDashFiltroFuente] = useState('Todos');

 // 🔌 MOTOR DE FORMULARIO MATRICIAL ORIGINAL
  const [formInformeId, setFormInformeId] = useState('');
  const [matrixState, setMatrixState] = useState({});
  const [matrixDirty, setMatrixDirty] = useState(false);
  const [uploadingCell, setUploadingCell] = useState(null);
  const [, setUploadProgress] = useState(0);
  const [modoRevisionMatriz, setModoRevisionMatriz] = useState(false); // ✨ NUEVO ESTADO
  const guardNavigationPlanes = useUnsavedChangesGuard(
    matrixDirty && vistaActiva === 'nuevo' && Boolean(formInformeId) && !modoRevisionMatriz,
    'la matriz de planes'
  );
  
  // ⚖️ ESTADOS PARA EVALUACIÓN HOLÍSTICA DEL PLAN (METODOLOGÍA EXCEL)
  const [modalEval, setModalEval] = useState({ activo: false, idInforme: null, planes: [], totalActividades: 0, isReadOnly: false });
  const dictamenRef = useRef(null);
  const [criterios, setCriterios] = useState({ c1: 100, c2: 100, c3: 100, c4: 100, c5: 100 });
  const [justificacion, setJustificacion] = useState('');
  const [guardandoEvaluacionInicial, setGuardandoEvaluacionInicial] = useState(false);
  const guardEvaluacionIntegral = useUnsavedChangesGuard(
    modalEval.activo && !modalEval.isReadOnly && (Object.values(criterios).some(valor => Number(valor) !== 100) || Boolean(justificacion.trim())),
    'la evaluación integral'
  );
  const guardMotivoCorreccion = useUnsavedChangesGuard(
    modoRevisionMatriz && mostrarMotivoCorreccion && Boolean(motivoCorreccion),
    'el motivo de corrección'
  );
  const guardEficaciaCierre = useUnsavedChangesGuard(
    modalEficaciaCierre.activo && Boolean(modalEficaciaCierre.conclusion.trim() || modalEficaciaCierre.fueEficaz || modalEficaciaCierre.requiereAcciones === 'si' || modalEficaciaCierre.observaciones.trim()),
    'la evaluación de eficacia'
  );
  const cerrarModalEvaluacionIntegral = () => !guardandoEvaluacionInicial && guardEvaluacionIntegral(() => {
    setModalEval({ activo: false, idInforme: null, planes: [], totalActividades: 0, isReadOnly: false });
    setJustificacion('');
    setCriterios({ c1: 100, c2: 100, c3: 100, c4: 100, c5: 100 });
  });
  const cerrarModalEficacia = () => guardEficaciaCierre(() => setModalEficaciaCierre({
    activo: false,
    plan: null,
    conclusion: '',
    fueEficaz: '',
    requiereAcciones: 'no',
    observaciones: '',
  }));

  const obtenerCorreoAuditorEvaluador = (informe, planes = []) => {
    const correoInforme = String(informe?.correoAuditor || informe?.correoAuditorResponsable || '').trim().toLowerCase();
    const correosPlanes = [...new Set(planes
      .map(plan => String(plan?.correoAuditor || '').trim().toLowerCase())
      .filter(Boolean))];
    return correosPlanes.length === 1 ? correosPlanes[0] : correoInforme;
  };

  const esFuenteProgramaAuditoria = informe => esInformePrograma(informe, fuentesMejora);

  const esPlanProgramaAuditoria = plan => {
    const hallazgo = hallazgosPorId.get(String(plan?.idHallazgo));
    const idInforme = hallazgo?.idInforme || plan?.idInforme;
    const informe = informesAuditoria.find(item => String(item.id) === String(idInforme));
    return esFuenteProgramaAuditoria(informe);
  };

  const enviarNotificacionPlanConReintento = async (payload, autorizacionLista = true) => {
    if (!payload?.destinatarios) {
      showNotification('No se pudo notificar: falta el correo de la persona asignada. Revisa la asignación del plan.', 'error');
      return false;
    }
    let enviado = false;
    if (autorizacionLista && typeof ejecutarDespachoGmailApi === 'function') {
      try {
        enviado = Boolean(await ejecutarDespachoGmailApi(payload));
      } catch {
        enviado = false;
      }
    }
    if (!enviado && payload?.destinatarios) {
      encolarReintentoNotificacion(payload, { tipo: 'plan' });
    }
    return enviado;
  };

  const notificarRegistroPlan = async (plan, correoPreparado) => {
    const programa = esPlanProgramaAuditoria(plan);
    const enlace = `${window.location.origin}/?reviewReportId=${encodeURIComponent(plan.idInforme)}`;
    const resultados = await Promise.all([
      enviarNotificacionPlanConReintento({
        ref_consecutivo: `PLA-${String(plan.id).slice(-4)}`,
        titulo_informe: programa ? 'Acción guardada: pendiente de evaluación del auditor' : 'Acción creada: pendiente de revisión',
        proceso_auditado: programa
          ? `La acción "${plan.accion}" quedó guardada. El auditor asignado debe evaluar su diseño; la ejecución se habilitará con un resultado mayor o igual al 80%.`
          : `La acción "${plan.accion}" quedó guardada y está pendiente de revisión por ${plan.revisor}.`,
        enlace_pdf: enlace,
        destinatarios: plan.correoResponsable,
      }, correoPreparado),
      enviarNotificacionPlanConReintento({
        ref_consecutivo: `PLA-${String(plan.id).slice(-4)}`,
        titulo_informe: programa ? 'Acción requerida: evaluar diseño de acciones' : 'Acción requerida: revisar plan de acción',
        proceso_auditado: programa
          ? `Se registró la acción "${plan.accion}". Como auditor asignado, evalúe el diseño antes de su ejecución. Mayor o igual al 80% aprueba; menos del 80% requiere correcciones.`
          : `Se registró la acción "${plan.accion}"; ingrese para revisar el diseño.`,
        enlace_pdf: enlace,
        destinatarios: programa ? plan.correoAuditor : plan.correoRevisor,
      }, correoPreparado),
    ]);
    return resultados.every(Boolean);
  };

  // Un plan al 100% sigue pendiente del auditor aunque su fase guardada sea antigua.
  const enRevisionAuditor = plan => (
    plan?.estadoWorkflow === 'En Revisión (100%)' ||
    (!esPlanProgramaAuditoria(plan) && plan?.estadoWorkflow === 'En Ejecución' && Number(plan?.progreso) >= 100)
  );
  const planCerrado = plan => plan.estadoWorkflow === 'Cerrado' || (!plan.estadoWorkflow && plan.estado === 'Cerrado');

  const paqueteListoParaEvaluacion = (informe, planes = []) => (
    esFuenteProgramaAuditoria(informe) && planes.length > 0 && planes.every(pendienteEvaluacionInicial)
  );

  const esAuditorAsignadoEvaluador = (informe, planes = []) => {
    const correoActual = normalizarIdentidad(user?.email);
    const correoAsignado = obtenerCorreoAuditorEvaluador(informe, planes);
    const esEjecutorDelPaquete = planes.some(plan => (
      String(plan?.correoResponsable || '')
        .split(',')
        .map(normalizarIdentidad)
        .includes(correoActual)
    ));
    const auditorInforme = normalizarIdentidad(
      informe?.auditorResponsable || informe?.auditor || informe?.auditorLider || ''
    );
    const nombresAuditoresPlanes = [...new Set(planes
      .map(plan => normalizarIdentidad(plan?.auditorAsignado || plan?.auditorResponsable || plan?.auditor))
      .filter(Boolean))];
    const nombreAsignado = auditorInforme || (nombresAuditoresPlanes.length === 1 ? nombresAuditoresPlanes[0] : '');
    const identidadesUsuario = [perfilUsuario?.nombreResponsable, perfilUsuario?.nombre, perfilUsuario?.cargo]
      .map(normalizarIdentidad)
      .filter(Boolean);
    const asignadoPorCorreo = Boolean(correoActual && correoAsignado && correoActual === normalizarIdentidad(correoAsignado));
    const asignadoPorIdentidad = Boolean(nombreAsignado && identidadesUsuario.includes(nombreAsignado));
    return Boolean((correoAsignado ? asignadoPorCorreo : asignadoPorIdentidad) && !esEjecutorDelPaquete);
  };

  const iniciarEvaluacionIntegral = (informe, planes) => {
    const pendientes = planes.filter(plan => pendienteEvaluacionInicial(plan) && esAuditorAsignado(plan, user?.email, perfilUsuario));
    if (!paqueteListoParaEvaluacion(informe, pendientes) || !esAuditorAsignadoEvaluador(informe, pendientes)) return;
    setCriterios({ c1: 100, c2: 100, c3: 100, c4: 100, c5: 100 });
    setJustificacion('');
    setModalEval({
      activo: true,
      idInforme: informe.id,
      planes: pendientes,
      totalActividades: pendientes.length,
      isReadOnly: false,
    });
  };

  const abrirEvaluacionAccion = async plan => {
    const autorizado = esAuditorAsignado(plan, user?.email, perfilUsuario);
    if (!enRevisionAuditor(plan) || !autorizado) {
      showNotification('Esta acción no está pendiente de aprobación para tu usuario.', 'error');
      return;
    }
    setModalEficaciaCierre({
      activo: true, plan, conclusion: '', fueEficaz: '', requiereAcciones: 'no', observaciones: '',
    });
  };
  
  // 🛡️ Salvaguarda: Si el registro es viejo y no tiene criterios, usa 100 por defecto para no romper React
  const safeCriterios = criterios || { c1: 100, c2: 100, c3: 100, c4: 100, c5: 100 };
  const puntajeHolistico = calcularPuntajeDiseno(Object.fromEntries(
    Object.entries(safeCriterios).map(([clave, valor]) => [clave, Number(valor)])
  ));
  const evaluacionAprobadaVisible = modalEval.isReadOnly
    ? modalEval.planes.find(plan => plan.evaluacionHolistica)?.evaluacionHolistica?.aprobado === true
    : puntajeHolistico >= 80;


// =========================================================
  // 📊 MOTOR DE CÁLCULO ANALÍTICO (100% REACTIVO A FILTROS)
  // =========================================================
  const fechaActualInicioDia = new Date();
  fechaActualInicioDia.setHours(0, 0, 0, 0);
  const timestampInicioDia = fechaActualInicioDia.getTime();
  const planesEnriquecidos = useMemo(() => safePlanes.flatMap(p => {
    const hallazgo = hallazgosPorId.get(String(p.idHallazgo));
    const idInforme = hallazgo?.idInforme || p.idInforme;
    const informe = informesAuditoria.find(item => String(item.id) === String(idInforme));
    if (!hallazgo || !informe) return [];
    const limite = p.fecha ? new Date(`${p.fecha}T00:00:00`) : null;
    const esVencido = p.progreso < 100 && limite && limite.getTime() < timestampInicioDia;

    return [{
      ...p,
      idInforme,
      proceso: hallazgo.proceso || 'General',
      subproceso: hallazgo.subproceso || 'General',
      subprocesos: Array.isArray(hallazgo.subprocesos) ? hallazgo.subprocesos : [hallazgo.subproceso || 'General'],
      sede: hallazgo.sede || 'Hotel',
      severidad: hallazgo.severidad || 'Medio',
      tipoFuente: resolverCategoriaFuente(informe.tipoFuente, fuentesMejora),
      esVencido,
      anioTexto: p.fecha ? p.fecha.split('-')[0] : 'Sin Fecha'
    }];
  }), [safePlanes, hallazgosPorId, informesAuditoria, fuentesMejora, timestampInicioDia]);
  const informesOrdenadosPorFecha = [...informesAuditoria].sort(compararInformesPorFecha);

  const tareasPendientesPorInforme = useMemo(() => {
    const planPorId = new Map(planesEnriquecidos.map(plan => [String(plan.id), plan]));
    const pendientesPorInforme = new Map();
    const gruposPendientes = [
      ['revision', misPlanesRevision],
      ['aprobacion', misPlanesAprobacion],
      ['ejecucion', misPlanesEjecucion],
    ];

    gruposPendientes.forEach(([tipo, planes]) => {
      planes.forEach(plan => {
        const planEnriquecido = planPorId.get(String(plan.id));
        const idInforme = planEnriquecido?.idInforme || plan.idInforme;
        if (!idInforme) return;

        const claveInforme = String(idInforme);
        const pendientes = pendientesPorInforme.get(claveInforme) || { revision: 0, aprobacion: 0, ejecucion: 0 };
        pendientes[tipo] += 1;
        pendientesPorInforme.set(claveInforme, pendientes);
      });
    });

    return pendientesPorInforme;
  }, [planesEnriquecidos, misPlanesRevision, misPlanesAprobacion, misPlanesEjecucion]);

  const evaluacionesIntegralesPendientes = informesAuditoria.flatMap(informe => {
    if (!esFuenteProgramaAuditoria(informe)) return [];
    const planes = planesEnriquecidos.filter(plan => String(plan.idInforme) === String(informe.id) &&
      pendienteEvaluacionInicial(plan) && esAuditorAsignado(plan, user?.email, perfilUsuario));
    if (
      !paqueteListoParaEvaluacion(informe, planes) ||
      !esAuditorAsignadoEvaluador(informe, planes)
    ) return [];
    return [{ informe, planes, actividadesPendientes: planes.length }];
  });

  useEffect(() => {
    if (String(revisionInformeId) !== String(reviewReportId)) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has('reviewReportId')) return;
    params.delete('reviewReportId');
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  }, [revisionInformeId, reviewReportId]);
  const correoUsuarioActual = String(user?.email || '').trim().toLowerCase();
  const puedeReclamarPlan = useCallback(plan => isAdmin || Boolean(
    correoUsuarioActual && [plan?.correoRevisor, plan?.correoAuditor]
      .some(correo => String(correo || '').trim().toLowerCase() === correoUsuarioActual)
  ), [correoUsuarioActual, isAdmin]);

// 🚨 Filtros para Banners de Alerta (Preventivos y Vencidos)
  const planesEnAlerta = useMemo(() => planesEnriquecidos.filter(p => {
    if (!puedeReclamarPlan(p)) return false;
    if (p.progreso === 100 || !p.fecha) return false;
    if (p.esVencido) return false; 
    const hoy = new Date(timestampInicioDia);
    const limite = new Date(`${p.fecha}T00:00:00`);
    let diasFaltantes = 0;
    let tempDate = new Date(hoy);
    while (tempDate < limite) {
      tempDate.setDate(tempDate.getDate() + 1);
      if (tempDate.getDay() !== 0 && tempDate.getDay() !== 6) diasFaltantes++;
    }
    return diasFaltantes >= 0 && diasFaltantes <= 2;
  }), [planesEnriquecidos, timestampInicioDia, puedeReclamarPlan]);

  const planesVencidosNotificables = useMemo(
    () => planesEnriquecidos.filter(p => p.esVencido && puedeReclamarPlan(p)),
    [planesEnriquecidos, puedeReclamarPlan]
  );

  useEffect(() => {
    if (!['ejecucion', 'revision', 'aprobacion'].includes(detallePanelPlanes)) return undefined;
    const temporizador = window.setTimeout(() => {
      const areaPrincipal = document.getElementById('main-scroll-area');
      const panelDetalle = document.getElementById('planes-task-detail');
      if (areaPrincipal && panelDetalle && areaPrincipal.contains(panelDetalle)) {
        panelDetalle.scrollIntoView({ behavior: 'smooth', block: 'center' });
        panelDetalle.focus({ preventScroll: true });
      }
    }, 60);
    return () => window.clearTimeout(temporizador);
  }, [detallePanelPlanes]);

// 🕒 Registrar envío de recordatorio en la trazabilidad del plan
const handleNotificarPlan = async (planId) => {
  const planNotificable = safePlanes.find(plan => String(plan.id) === String(planId));
  if (!puedeReclamarPlan(planNotificable)) return;
  const ts = new Date().toLocaleString();
  const updated = safePlanes.map(p => {
    if (p.id === planId) {
      return {
        ...p,
        ultimoRecordatorio: ts,
        historialCambios: [
          ...(p.historialCambios || []), 
          { fecha: ts, usuario: user?.email || 'Usuario', accion: 'Recordatorio de vencimiento enviado por correo' }
        ]
      };
    }
    return p;
  });
  const guardado = await saveToCloud({ planes: updated });
  if (!guardado) return;
  setPlanes(updated);
  showNotification('Recordatorio registrado en el historial.', 'success');
};
  // 1. Filtrado Base (Desde el menú lateral)
  const planesFiltradosBase = useMemo(() => planesEnriquecidos.filter(p => {
    if (dashFiltroAnio !== 'Todos' && p.anioTexto !== dashFiltroAnio) return false;
    if (dashFiltroProceso !== 'Todos' && p.proceso !== dashFiltroProceso) return false;
    if (dashFiltroSubproceso !== 'Todos' && !(p.subprocesos || [p.subproceso]).includes(dashFiltroSubproceso)) return false;
    if (dashFiltroPrioridad !== 'Todos' && p.severidad !== dashFiltroPrioridad) return false;
    if (dashFiltroResponsable !== 'Todos' && p.responsable !== dashFiltroResponsable) return false;
    if (dashFiltroFuente !== 'Todos' && p.tipoFuente !== dashFiltroFuente) return false;
    return true;
  }), [planesEnriquecidos, dashFiltroAnio, dashFiltroProceso, dashFiltroSubproceso, dashFiltroPrioridad, dashFiltroResponsable, dashFiltroFuente]);

  // 2. Filtrado Final (Incluye el clic en las tarjetas de estado)
  const planesDashboard = useMemo(() => planesFiltradosBase.filter(p => {
    if (dashFiltroEstado !== 'Todos') {
      if (dashFiltroEstado === 'Cerrado' && !planCerrado(p)) return false;
      if (dashFiltroEstado === 'Vencido' && !p.esVencido) return false;
      if (dashFiltroEstado === 'En Proceso' && (planCerrado(p) || p.progreso === 0 || p.esVencido)) return false;
      if (dashFiltroEstado === 'Pendiente' && (p.progreso > 0 || p.esVencido)) return false;
    }
    return true;
  }), [planesFiltradosBase, dashFiltroEstado]);

  // 3. Cálculos Dinámicos de las Tarjetas (Basados en planesFiltradosBase para no desaparecer al hacer clic)
  const totalPlanesBase = planesFiltradosBase.length;
  const cerrados = planesFiltradosBase.filter(planCerrado).length;
  const enProceso = planesFiltradosBase.filter(p => p.progreso > 0 && !planCerrado(p) && !p.esVencido).length;
  const pendientes = planesFiltradosBase.filter(p => (p.progreso === 0 || !p.progreso) && !p.esVencido).length;
  const vencidos = planesFiltradosBase.filter(p => p.esVencido).length;
  const cumplimientoGlobal = totalPlanesBase > 0 ? Math.round((cerrados / totalPlanesBase) * 100) : 0;
  const pct = (val) => totalPlanesBase > 0 ? Math.round((val / totalPlanesBase) * 100) : 0;

  // 4. Cálculos para la Gráfica de Dona y Rankings (Estos cambian con cada clic en la pantalla)
  const totalPlanesReactivo = planesDashboard.length;
  const criticos = planesDashboard.filter(p => p.severidad === 'Crítico').length;
  const altos = planesDashboard.filter(p => p.severidad === 'Alto').length;
  const medios = planesDashboard.filter(p => p.severidad === 'Medio').length;
  // Agrupador Dinámico
 // Agrupador Dinámico
  const { planesAgrupados, gruposOrdenados } = useMemo(() => {
    const agrupados = planesDashboard.reduce((acc, p) => {
      let key = 'Sin clasificar';
      if (agruparPor === 'Año') key = p.anioTexto;
      if (agruparPor === 'Proceso') key = p.proceso;
      if (agruparPor === 'Subproceso') key = (p.subprocesos || [p.subproceso]).join(', ');
      if (agruparPor === 'Estado') key = planCerrado(p) ? 'Cerrados' : p.esVencido ? 'Vencidos' : 'En Proceso';
      if (agruparPor === 'Responsable') key = p.responsable;
      if (agruparPor === 'Prioridad') key = p.severidad;
      if (agruparPor === 'Tipo de Fuente') key = p.tipoFuente || 'Sin fuente';

      if (!acc[key]) acc[key] = [];
      acc[key].push(p);
      return acc;
    }, {});

    return {
      planesAgrupados: agrupados,
      gruposOrdenados: Object.keys(agrupados).sort((a, b) => b.localeCompare(a)),
    };
  }, [planesDashboard, agruparPor]);

  const topProcesos = useMemo(() => {
    const conteoProcesos = planesDashboard.reduce((acc, p) => {
      acc[p.proceso] = (acc[p.proceso] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(conteoProcesos).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [planesDashboard]);

  const limpiarFiltrosDashboard = () => {
    setDashFiltroAnio('Todos'); setDashFiltroProceso('Todos'); setDashFiltroSubproceso('Todos'); setDashFiltroEstado('Todos');
    setDashFiltroPrioridad('Todos'); setDashFiltroResponsable('Todos'); setDashFiltroFuente('Todos');
  };

// 💾 PROCESOR DE ENVÍO MATRICIAL UNIFICADO CON VALIDACIÓN Y CORREOS AUTOMÁTICOS
  const handleMasterMatrixSubmit = async (e) => {
    e.preventDefault();
    if (!formInformeId) return;

    // 🛡️ RESOLUCIÓN ROBUSTA DEL ID REAL DEL INFORME
    // Busca el informe coincidente tanto por ID directo como por la referencia consecutivo (INF-XXXX-XXX)
    const informeEncontrado = informesAuditoria.find(inf => 
      String(inf.id) === String(formInformeId) || 
      (inf.ref && String(inf.ref).trim().toLowerCase() === String(formInformeId).trim().toLowerCase())
    );

    const idInformeReal = informeEncontrado ? String(informeEncontrado.id) : String(formInformeId);
    const esProgramaInforme = esFuenteProgramaAuditoria(informeEncontrado);
    const notificarNuevas = enviarNotificaciones || esProgramaInforme;

    let errorCorreosEjecutor = false;
    let errorCorreosRevisor = false;
    let errorCorreoAuditor = false;
    let errorRolesDuplicados = false;
    const normalizarCorreo = valor => String(valor || '').trim().toLowerCase();

    Object.keys(matrixState).forEach(hallazgoId => {
      const node = matrixState[hallazgoId];
      if (node.aplica) {
        node.actividades.forEach(act => {
          const actividadNueva = String(act.id).startsWith('new-');
          const planOriginal = actividadNueva ? null : safePlanes.find(plan => String(plan.id) === String(act.id));
          const esPropietario = planOriginal && normalizarCorreo(planOriginal.correoResponsable) === normalizarCorreo(user?.email);
          if (act.accion && act.accion.trim() !== '' && (isAdmin || actividadNueva || esPropietario)) {
            const validaCorreosCompletos = isAdmin || actividadNueva;
            const informeBase = informesAuditoria.find(informe => String(informe.id) === String(formInformeId));
            const correoAuditorOriginal = planOriginal?.correoAuditor || informeBase?.correoAuditor || informeBase?.correoAuditorResponsable || '';
            const conflictoRoles = obtenerConflictoRolesPlan({
              correoResponsable: act.correoResponsable,
              correoRevisor: act.correoRevisor,
              correoAuditor: act.correoAuditor || correoAuditorOriginal,
            });
            const cambiaAsignacionRoles = actividadNueva ||
              normalizarCorreo(act.correoResponsable) !== normalizarCorreo(planOriginal?.correoResponsable) ||
              normalizarCorreo(act.correoRevisor) !== normalizarCorreo(planOriginal?.correoRevisor) ||
              normalizarCorreo(act.correoAuditor || correoAuditorOriginal) !== normalizarCorreo(correoAuditorOriginal);
            if (conflictoRoles && cambiaAsignacionRoles) errorRolesDuplicados = true;
            const cambioCorreoEjecutor = planOriginal && (
              normalizarCorreo(act.correoResponsable) !== normalizarCorreo(planOriginal.correoResponsable) ||
              normalizarCorreo(act.correoConfirmacion) !== normalizarCorreo(planOriginal.correoResponsable)
            );
            const cambioCorreoRevisor = planOriginal && (
              normalizarCorreo(act.correoRevisor) !== normalizarCorreo(planOriginal.correoRevisor) ||
              normalizarCorreo(act.correoRevisorConfirmacion) !== normalizarCorreo(planOriginal.correoRevisor)
            );
            const cambioCorreoAuditor = planOriginal && (
              normalizarCorreo(act.correoAuditor) !== normalizarCorreo(correoAuditorOriginal)
            );

            // Validar el correo del ejecutor cuando se crea o modifica.
            const corrResp1 = normalizarCorreo(act.correoResponsable);
            const corrResp2 = normalizarCorreo(act.correoConfirmacion);
            if ((validaCorreosCompletos || cambioCorreoEjecutor) && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(corrResp1) || !corrResp2 || corrResp1 !== corrResp2)) errorCorreosEjecutor = true;

            // Validar el correo del revisor cuando se crea o modifica.
            const corrRev1 = normalizarCorreo(act.correoRevisor);
            const corrRev2 = normalizarCorreo(act.correoRevisorConfirmacion);
            if ((validaCorreosCompletos || cambioCorreoRevisor) && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(corrRev1) || !corrRev2 || corrRev1 !== corrRev2)) errorCorreosRevisor = true;

            const corrAuditor1 = normalizarCorreo(act.correoAuditor);
            if (cambioCorreoAuditor && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(corrAuditor1)) errorCorreoAuditor = true;
          }
        });
      }
    });

    if (errorCorreosEjecutor) {
      alert("❌ ALERTA: Los correos electrónicos del EJECUTOR (Responsable) no coinciden o están vacíos. Por favor, verifique las casillas marcadas en rojo antes de guardar.");
      return;
    }

    if (errorCorreosRevisor) {
      alert("❌ ALERTA: Los correos electrónicos del REVISOR (Jefatura) no coinciden o están vacíos. Por favor, verifique las casillas marcadas en rojo antes de guardar.");
      return;
    }

    if (errorCorreoAuditor) {
      alert("❌ ALERTA: Ingrese un correo válido para el auditor antes de guardar.");
      return;
    }

    if (errorRolesDuplicados) {
      showNotification('No se puede guardar: el mismo correo está asignado como ejecutor, revisor y/o auditor. Asigna personas distintas; el auditor se hereda del informe.', 'error');
      return;
    }

    if (!isAdmin) {
      const actividadesNuevas = Object.entries(matrixState).flatMap(([hallazgoId, node]) => (
        node.aplica
          ? node.actividades
            .filter(act => String(act.id).startsWith('new-') && act.accion?.trim())
            .map(act => ({
              idHallazgo: hallazgoId,
              accion: act.accion.trim(),
              sede: act.sede || 'No especificada',
              responsable: act.responsable || 'Sin Asignar',
              correoResponsable: (act.correoResponsable || '').trim(),
              correoConfirmacion: (act.correoConfirmacion || '').trim(),
              revisor: act.revisor || 'Sin Asignar',
              correoRevisor: (act.correoRevisor || '').trim(),
              correoRevisorConfirmacion: (act.correoRevisorConfirmacion || '').trim(),
              auditorAsignado: act.auditorAsignado || '',
              correoAuditor: (act.correoAuditor || '').trim(),
              fechaInicio: act.fechaInicio || null,
              fecha: act.fecha || null,
              evidenciaUrl: act.evidenciaUrl || '',
              tipoAccion: act.tipoAccion || 'Acción Correctiva',
              matrizRiesgos: act.matrizRiesgos || 'No aplica',
              matrizAspectos: act.matrizAspectos || 'No aplica',
              matrizPeligros: act.matrizPeligros || 'No aplica',
              matrizLegal: act.matrizLegal || 'No aplica',
            }))
          : []
      ));
      const correoSesion = String(user?.email || '').trim().toLowerCase();
      const actividadesEditadas = Object.entries(matrixState).flatMap(([, node]) => (
        node.aplica
          ? node.actividades
            .filter(act => (
              !String(act.id).startsWith('new-') &&
              correoSesion &&
              normalizarCorreo(safePlanes.find(plan => String(plan.id) === String(act.id))?.correoResponsable) === correoSesion &&
              act.accion?.trim()
            ))
            .map(act => {
              const planOriginal = safePlanes.find(plan => String(plan.id) === String(act.id));
              const cambiosCorreo = {};
              if (normalizarCorreo(act.correoResponsable) !== normalizarCorreo(planOriginal?.correoResponsable)) {
                cambiosCorreo.correoResponsable = act.correoResponsable.trim();
                cambiosCorreo.correoConfirmacion = (act.correoConfirmacion || '').trim();
              }
              if (normalizarCorreo(act.correoRevisor) !== normalizarCorreo(planOriginal?.correoRevisor)) {
                cambiosCorreo.correoRevisor = act.correoRevisor.trim();
                cambiosCorreo.correoRevisorConfirmacion = (act.correoRevisorConfirmacion || '').trim();
              }
              const informeBase = informesAuditoria.find(informe => String(informe.id) === String(formInformeId));
              const correoAuditorOriginal = planOriginal?.correoAuditor || informeBase?.correoAuditor || '';
              if (normalizarCorreo(act.correoAuditor) !== normalizarCorreo(correoAuditorOriginal)) {
                cambiosCorreo.correoAuditor = (act.correoAuditor || '').trim();
              }
              return {
                id: act.id,
                accion: act.accion.trim(),
                sede: act.sede || 'No especificada',
                fechaInicio: act.fechaInicio || null,
                fecha: act.fecha || null,
                evidenciaUrl: act.evidenciaUrl || '',
                tipoAccion: act.tipoAccion || 'Acción Correctiva',
                matrizRiesgos: act.matrizRiesgos || 'No aplica',
                matrizAspectos: act.matrizAspectos || 'No aplica',
                matrizPeligros: act.matrizPeligros || 'No aplica',
                matrizLegal: act.matrizLegal || 'No aplica',
                progreso: Math.min(Math.max(Number(act.progreso) || 0, 0), 100),
                ...cambiosCorreo,
              };
            })
          : []
      ));

      const camposDisenoNotificables = [
        'accion', 'sede', 'fechaInicio', 'fecha', 'tipoAccion',
        'matrizRiesgos', 'matrizAspectos', 'matrizPeligros', 'matrizLegal',
        'correoResponsable', 'correoRevisor', 'correoAuditor',
      ];
      const requiereNotificacionEdicion = actividadesEditadas.some(actualizacion => {
        const original = safePlanes.find(plan => String(plan.id) === String(actualizacion.id));
        if (!original) return false;
        const cambioDiseno = camposDisenoNotificables.some(campo => (
          JSON.stringify(original[campo] ?? null) !== JSON.stringify(actualizacion[campo] ?? null)
        ));
        const llegaAlCien = Number(actualizacion.progreso) === 100 &&
          (Number(original.progreso) < 100 || original.estadoWorkflow === 'En Ejecución');
        return cambioDiseno || llegaAlCien;
      });

      if (actividadesNuevas.length === 0 && actividadesEditadas.length === 0) {
        alert('No hay actividades nuevas ni cambios en tus propias acciones para guardar.');
        return;
      }

      const requiereCorreoNuevo = actividadesNuevas.length > 0 && notificarNuevas;
      const requierePrepararGmail = requiereCorreoNuevo || requiereNotificacionEdicion;
      let promesaPreparacionGmail = null;
      if (requierePrepararGmail && prepararEnvioGmail) {
        try {
          promesaPreparacionGmail = Promise.resolve(prepararEnvioGmail());
        } catch {
          promesaPreparacionGmail = Promise.resolve(false);
        }
      }
      try {
        const respuesta = await apiService.guardarMatrizPlanes({
  idInforme: idInformeReal,
  nuevas: actividadesNuevas,
  actualizaciones: actividadesEditadas,
});
        const planesCreados = Array.isArray(respuesta?.planesNuevos) ? respuesta.planesNuevos : [];
        const planesActualizados = Array.isArray(respuesta?.planesActualizados) ? respuesta.planesActualizados : [];
        if (planesCreados.length + planesActualizados.length === 0) {
          alert('No se pudieron crear los planes de acción.');
          return;
        }

        const actualizacionesPorId = new Map(planesActualizados.map(plan => [String(plan.id), plan]));
        const planesFinales = [
          ...planesCreados,
          ...safePlanes.map(plan => actualizacionesPorId.get(String(plan.id)) || plan),
        ];
        setPlanes(planesFinales);
        handleInformeChange(formInformeId, planesFinales, safeHallazgos);
        const enlaceRevision = `${window.location.origin}/?reviewReportId=${encodeURIComponent(formInformeId)}`;
        const hayReenvioDiseno = planesActualizados.some(plan => ['Pendiente Revisión Jefatura', ESTADO_EVALUACION_INICIAL].includes(plan.estadoWorkflow));
        const hayAvanceAlCien = planesActualizados.some(plan => plan.estadoWorkflow === ESTADO_PENDIENTE_VALIDACION_REVISOR);
        const mensajeGuardado = actividadesNuevas.length > 0
          ? `${planesCreados.length} plan(es) guardado(s) correctamente.`
          : hayReenvioDiseno
            ? 'Diseño guardado y enviado a la persona encargada de aprobarlo.'
            : hayAvanceAlCien
              ? 'Avance guardado y enviado a validación del revisor.'
              : 'Avance guardado correctamente.';
        setEditPlan(null);
        setFormInformeId('');
        setMatrixState({});
        setMatrixDirty(false);
        setVistaActiva('historial');
        showNotification(mensajeGuardado, 'success');

        let todasNotificacionesEnviadas = true;
        let correoPreparado = !requierePrepararGmail;
        if (promesaPreparacionGmail) {
          try {
            correoPreparado = await promesaPreparacionGmail;
          } catch {
            correoPreparado = false;
          }
        }
        if ((requiereNotificacionEdicion || requiereCorreoNuevo) && !correoPreparado) todasNotificacionesEnviadas = false;
        if (actividadesNuevas.length > 0 && notificarNuevas) {
          for (const plan of planesCreados) {
            if (!(await notificarRegistroPlan(plan, correoPreparado))) todasNotificacionesEnviadas = false;
          }
        }
        if (actividadesEditadas.length > 0 && requiereNotificacionEdicion) {
          const planesReenviadosARevision = planesActualizados.filter(plan => ['Pendiente Revisión Jefatura', ESTADO_EVALUACION_INICIAL].includes(plan.estadoWorkflow));
          for (const plan of planesReenviadosARevision) {
            const destinatario = esProgramaInforme ? plan.correoAuditor : plan.correoRevisor;
            if (!destinatario) {
              todasNotificacionesEnviadas = false;
              continue;
            }
            const correoRevisorEnviado = await enviarNotificacionPlanConReintento({
              ref_consecutivo: `PLA-${String(plan.id).slice(-4)}`,
              titulo_informe: 'Diseño corregido: pendiente de nueva revisión',
              proceso_auditado: `El responsable ${plan.responsable} corrigió el plan "${plan.accion}". Ingrese para ${esProgramaInforme ? 'evaluar nuevamente el diseño; la ejecución sigue bloqueada hasta aprobar con al menos el 80%' : 'aprobarlo o solicitar otra corrección'}.`,
              enlace_pdf: enlaceRevision,
              destinatarios: destinatario,
            }, correoPreparado);
            if (!correoRevisorEnviado) todasNotificacionesEnviadas = false;
          }

          const planesAlCien = planesActualizados.filter(plan => plan.estadoWorkflow === ESTADO_PENDIENTE_VALIDACION_REVISOR);
          for (const plan of planesAlCien) {
            if (!plan.correoRevisor) {
              todasNotificacionesEnviadas = false;
              continue;
            }
            const correoAuditorEnviado = await enviarNotificacionPlanConReintento({
              ref_consecutivo: `PLA-${String(plan.id).slice(-4)}`,
              titulo_informe: 'Plan al 100%: validación del revisor requerida',
              proceso_auditado: `El ejecutor completó al 100% la acción "${plan.accion}". Valide las evidencias y, si están conformes, envíe la acción al aprobador final.`,
              enlace_pdf: plan.evidenciaUrl || window.location.origin,
              destinatarios: plan.correoRevisor,
            }, correoPreparado);
            if (!correoAuditorEnviado) todasNotificacionesEnviadas = false;
          }
        }

        if (!todasNotificacionesEnviadas) {
          showNotification('La matriz quedó guardada, pero algunas notificaciones están pendientes de reintento.', 'error');
        }
      } catch (error) {
        alert(error.message || 'No se pudieron crear los planes de acción.');
      }
      return;
    }

    const ts = new Date().toLocaleString();
    let updatedPlanesList = [...safePlanes];
    let notificacionesRadicadas = [];
    let notificacionesRevision100 = [];

// 1. Recolectar los IDs de las actividades que AÚN existen (sobrevivieron) en el formulario
    const idsSobrevivientes = [];
    Object.keys(matrixState).forEach(hallazgoId => {
      const node = matrixState[hallazgoId];
      if (node.aplica) {
        node.actividades.forEach(act => {
          if (!String(act.id).startsWith('new-')) {
            idsSobrevivientes.push(String(act.id));
          }
        });
      }
    });

    // 2. Identificar los hallazgos que pertenecen al informe que estamos editando actualmente
    const hallazgosActuales = safeHallazgos
      .filter(h => String(h.idInforme) === String(formInformeId))
      .map(h => h.id);

    // 3. Filtrar de la lista principal las actividades que fueron "quitadas"
    const idsHallazgosActuales = new Set(hallazgosActuales.map(String));
    updatedPlanesList = updatedPlanesList.filter(plan => {
      if (idsHallazgosActuales.has(String(plan.idHallazgo))) {
        // Si el plan pertenece a este informe, SOLO se queda si está en los sobrevivientes
        return idsSobrevivientes.includes(String(plan.id));
      }
      return true; // Conservamos intactos los planes de otros informes
    });

    Object.keys(matrixState).forEach(hallazgoId => {
      const node = matrixState[hallazgoId];
      if (!node.aplica) return;

      node.actividades.forEach(act => {
        if (!act.accion || act.accion.trim() === '') return;

        const isNew = String(act.id).startsWith('new-');
        const planOriginal = safePlanes.find(plan => String(plan.id) === String(act.id));
        const progresoEntero = Math.min(Math.max(parseInt(act.progreso || 0), 0), 100);
        const camposDiseno = ['accion', 'sede', 'responsable', 'correoResponsable', 'revisor', 'correoRevisor', 'auditorAsignado', 'correoAuditor', 'fechaInicio', 'fecha', 'tipoAccion', 'matrizRiesgos', 'matrizAspectos', 'matrizPeligros', 'matrizLegal'];
        const cambiaDisenoPrograma = esProgramaInforme && !isNew && camposDiseno.some(campo => (
          JSON.stringify(planOriginal?.[campo] ?? '') !== JSON.stringify(act[campo] ?? '')
        ));
        
       let workflowCalculado = act.estadoWorkflow || 'Pendiente Revisión Jefatura';

        // LÓGICA DE MÁQUINA DE ESTADOS 3 NIVELES
        if (isNew) {
          workflowCalculado = esProgramaInforme ? ESTADO_EVALUACION_INICIAL : 'Pendiente Revisión Jefatura';
        } else if (cambiaDisenoPrograma) {
          workflowCalculado = ESTADO_EVALUACION_INICIAL;
        } else if (progresoEntero === 100 && workflowCalculado === 'En Ejecución') {
          workflowCalculado = ESTADO_PENDIENTE_VALIDACION_REVISOR;
        } else if (progresoEntero < 100 && [ESTADO_PENDIENTE_VALIDACION_REVISOR, 'En Revisión (100%)'].includes(workflowCalculado)) {
          workflowCalculado = 'En Ejecución';
        }

        // 🛡️ Salvaguardas para extraer datos correctamente, asegurando que no queden valores en blanco que rompan el sistema.
        const hallazgoReal = safeHallazgos.find(h => String(h.id) === String(hallazgoId));
        const planData = {
          ...planOriginal,
          id: isNew ? Date.now() + Math.floor(Math.random() * 10000) : planOriginal.id,
          idHallazgo: hallazgoReal ? hallazgoReal.id : hallazgoId,
          idInforme: idInformeReal,
          accion: act.accion,
          sede: act.sede || 'No especificada', 
          responsable: act.responsable || 'Sin Asignar',
          correoResponsable: (act.correoResponsable || '').trim(),
          revisor: act.revisor || 'Sin Asignar',
          correoRevisor: (act.correoRevisor || '').trim(),
          auditorAsignado: act.auditorAsignado || 'Sin Asignar',
          correoAuditor: (act.correoAuditor || '').trim(),
          progreso: isNew && esProgramaInforme ? 0 : progresoEntero,
          ...(cambiaDisenoPrograma ? { evaluacionHolistica: null, aprobadoPorCorreo: '', aprobadoEn: '', validadoPorRevisorCorreo: '', validadoPorRevisorEn: '' } : {}),
          fechaInicio: act.fechaInicio || null, // Mejor null que string vacío para fechas
          fecha: act.fecha || null,
          evidenciaUrl: act.evidenciaUrl || '',
          estadoWorkflow: workflowCalculado,
          estado: workflowCalculado === 'Cerrado' ? 'Cerrado' : 'En Proceso',
          anio: act.fecha ? Number(act.fecha.split('-')[0]) : new Date().getFullYear(),
          mes: act.fecha ? act.fecha.split('-')[1] : String(new Date().getMonth() + 1).padStart(2, '0'),
          tipoAccion: act.tipoAccion || 'Acción Correctiva',
          matrizRiesgos: act.matrizRiesgos || 'No aplica',
          matrizAspectos: act.matrizAspectos || 'No aplica',
          matrizPeligros: act.matrizPeligros || 'No aplica',
          matrizLegal: act.matrizLegal || 'No aplica'
        };
        if (isNew) {
          planData.historialCambios = [{ fecha: ts, usuario: 'Auditor', accion: 'Actividad registrada en matriz masiva' }];
          updatedPlanesList.push(planData);
          notificacionesRadicadas.push(planData);
} else {
          const idx = updatedPlanesList.findIndex(p => String(p.id) === String(act.id));
          if (idx !== -1) {
            planData.historialCambios = [...(updatedPlanesList[idx].historialCambios || []), { fecha: ts, usuario: 'Auditor', accion: 'Actividad modificada en matriz' }];
            if (workflowCalculado === ESTADO_PENDIENTE_VALIDACION_REVISOR && planOriginal.estadoWorkflow !== ESTADO_PENDIENTE_VALIDACION_REVISOR) {
              notificacionesRevision100.push(planData);
            }
            updatedPlanesList[idx] = planData;
            if (cambiaDisenoPrograma) notificacionesRadicadas.push(planData);
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
        let accionHistorial = `Estado automatizado a ${nuevoEstado} (Validación de Planes)`;
        let forzarGuardadoHistorial = false;
        
        if (!stateNode.aplica) {
          nuevoEstado = 'Cerrado';
          accionHistorial = `❌ Hallazgo marcado como NO APLICA. Justificación: ${stateNode.justificacionNoAplica}`;
          forzarGuardadoHistorial = true; // Para que siempre guarde la observación aunque ya estuviera cerrado
        } else {
          const actividadesDeEsteHallazgo = updatedPlanesList.filter(p => String(p.idHallazgo) === String(hallazgoId));
          if (actividadesDeEsteHallazgo.length > 0) {
            const todasAprobadas = actividadesDeEsteHallazgo.every(act => act.estadoWorkflow === 'Cerrado');
            if (todasAprobadas) {
              nuevoEstado = 'Cerrado';
              accionHistorial = `✅ Estado automatizado a Cerrado (Todas las actividades fueron aprobadas).`;
            }
          }
        }

        if (updatedHallazgos[hIndex].estado !== nuevoEstado || forzarGuardadoHistorial) {
          updatedHallazgos[hIndex] = {
            ...updatedHallazgos[hIndex],
            estado: nuevoEstado,
            historialCambios: [...(updatedHallazgos[hIndex].historialCambios || []), { fecha: ts, accion: accionHistorial }]
          };
          hallazgosModificados = true;
        }
      }
    });

    const requiereCorreoAdmin = (notificarNuevas && notificacionesRadicadas.length > 0) || notificacionesRevision100.length > 0;
    let correoPreparadoAdmin = true;
    let promesaPreparacionCorreoAdmin = null;
    if (requiereCorreoAdmin && prepararEnvioGmail) {
      try {
        promesaPreparacionCorreoAdmin = Promise.resolve(prepararEnvioGmail()).catch(() => false);
      } catch {
        promesaPreparacionCorreoAdmin = Promise.resolve(false);
      }
    }

    let guardado;
    if (hallazgosModificados && setHallazgos) {
      guardado = await saveToCloud({ planes: updatedPlanesList, hallazgos: updatedHallazgos });
    } else {
      guardado = await saveToCloud({ planes: updatedPlanesList });
    }
    if (!guardado) return;
    setPlanes(updatedPlanesList);
    if (hallazgosModificados && setHallazgos) setHallazgos(updatedHallazgos);
    handleInformeChange(formInformeId, updatedPlanesList, updatedHallazgos);
    setEditPlan(null);
    setFormInformeId('');
    setMatrixState({});
    setModoRevisionMatriz(false);
    setVistaActiva('historial');
    showNotification('Matriz guardada correctamente. Las notificaciones se están procesando.', 'success');

    if (promesaPreparacionCorreoAdmin) {
      correoPreparadoAdmin = Boolean(await promesaPreparacionCorreoAdmin);
    }

  // ... código anterior (saveToCloud) ...

   // 📧 NOTIFICACIÓN 1: CREACIÓN - CASCADA AL REVISOR
    let todasNotificacionesEnviadas = correoPreparadoAdmin;
    if (notificarNuevas && notificacionesRadicadas.length > 0) {
      for (const plan of notificacionesRadicadas) {
        if (!(await notificarRegistroPlan(plan, correoPreparadoAdmin))) todasNotificacionesEnviadas = false;
      }
    }

    // 📧 NOTIFICACIÓN 2: ALERTA DE TRABAJO AL 100% PARA EL AUDITOR
    if (notificacionesRevision100.length > 0) {
      for (const act of notificacionesRevision100) {
        const correoRevisionEnviado = await enviarNotificacionPlanConReintento({
          ref_consecutivo: `PLA-${String(act.id).slice(-4)}`,
          titulo_informe: 'Plan al 100%: validación del revisor requerida',
          proceso_auditado: `La acción "${act.accion}" completó su ejecución al 100%. Valide las evidencias para remitirla al auditor asignado para el cierre final.`,
          enlace_pdf: `${window.location.origin}/?reviewReportId=${encodeURIComponent(idInformeReal)}`,
          destinatarios: act.correoRevisor
        }, correoPreparadoAdmin);
        if (!correoRevisionEnviado) todasNotificacionesEnviadas = false;
      }
    }

    if (!todasNotificacionesEnviadas) {
      showNotification('La matriz quedó guardada, pero algunas notificaciones están pendientes de reintento.', 'error');
    }
  };

 // 🛡️ NUEVA FUNCIÓN: EVALUACIÓN HOLÍSTICA Y PONDERADA DEL PLAN DE ACCIÓN
  const confirmarEvaluacionHolistica = async () => {
    if (guardandoEvaluacionInicial) return;
    const informeEvaluado = informesAuditoria.find(informe => String(informe.id) === String(modalEval.idInforme));
    if (
      modalEval.isReadOnly ||
      !paqueteListoParaEvaluacion(informeEvaluado, modalEval.planes) ||
      !esAuditorAsignadoEvaluador(informeEvaluado, modalEval.planes)
    ) {
      alert('La evaluación inicial solo está disponible para el auditor asignado antes de habilitar la ejecución.');
      return;
    }

    const esAprobado = puntajeHolistico >= 80;
    if (!esAprobado && justificacion.trim() === '') {
      return alert('Debes justificar técnicamente la evaluación cuando el puntaje sea inferior al 80%.');
    }
    if (!window.confirm(`¿Confirmar evaluación de este paquete de acciones con un score de ${puntajeHolistico}%?`)) return;

    setGuardandoEvaluacionInicial(true);
    let promesaCorreo = Promise.resolve(true);
    try {
      if (prepararEnvioGmail) promesaCorreo = Promise.resolve(prepararEnvioGmail()).catch(() => false);
      const respuesta = await apiService.evaluarDisenoPlanes(
        modalEval.idInforme, modalEval.planes.map(plan => plan.id), criterios, justificacion.trim()
      );
      if (respuesta?.planes?.length !== modalEval.planes.length) throw new Error('El servidor no confirmó todas las acciones evaluadas.');
      const porId = new Map(respuesta.planes.map(plan => [String(plan.id), plan]));
      setPlanes(prev => prev.map(plan => porId.get(String(plan.id)) || plan));
    } catch (error) {
      showNotification(error.message || 'No se pudo guardar la evaluación inicial.', 'error');
      setGuardandoEvaluacionInicial(false);
      return;
    }
    setGuardandoEvaluacionInicial(false);
    const evaluacionesAplicadas = modalEval.planes.length;

    const destinatarios = [...new Set(modalEval.planes.flatMap(plan => [
      plan.correoResponsable, plan.correoRevisor, plan.correoAuditor,
    ]).concat([informeEvaluado?.correoAuditor || informeEvaluado?.correoAuditorResponsable])
      .flatMap(correos => String(correos || '').split(','))
      .map(correo => correo.trim().toLowerCase()).filter(Boolean))];
    const dictamen = justificacion.trim();
    volverAlHistorialTrasGuardarAccion(
      esAprobado
        ? `Diseño aprobado (${puntajeHolistico}%). Ejecución habilitada para ${evaluacionesAplicadas} acciones.`
        : `Diseño no aprobado (${puntajeHolistico}%). Se requieren correcciones antes de ejecutar.`,
      modalEval.idInforme
    );
    setModalEval({ activo: false, idInforme: null, planes: [], totalActividades: 0 });
    setJustificacion('');
    setCriterios({ c1: 100, c2: 100, c3: 100, c4: 100, c5: 100 });
    void (async () => {
      try {
        const autorizado = Boolean(await promesaCorreo);
        const enviado = await enviarNotificacionPlanConReintento({
          ref_consecutivo: informeEvaluado.ref || String(informeEvaluado.id),
          asunto: esAprobado ? 'Diseño aprobado: ejecución habilitada' : 'Diseño no aprobado: corregir acciones',
          titulo_informe: esAprobado ? 'Ya puedes ejecutar tus acciones' : 'Corrige el diseño y reenvíalo al auditor',
          proceso_auditado: esAprobado
            ? `El auditor asignado aprobó el diseño con ${puntajeHolistico}%. Las ${evaluacionesAplicadas} acciones están habilitadas para ejecución. Al llegar al 100%, pasarán al revisor y después al auditor para el cierre final. Dictamen: ${dictamen || 'Sin observaciones adicionales.'}`
            : `La evaluación inicial obtuvo ${puntajeHolistico}%. La ejecución sigue bloqueada. Corrige las acciones y guárdalas para reenviarlas al auditor asignado. Justificación: ${dictamen}`,
          enlace_pdf: `${window.location.origin}/?reviewReportId=${encodeURIComponent(informeEvaluado.id)}`,
          destinatarios: destinatarios.join(', '),
        }, autorizado);
        if (!enviado) showNotification('La evaluación quedó guardada. La notificación a los responsables está pendiente de reintento.', 'error');
      } catch {
        showNotification('La evaluación quedó guardada, pero no se pudo completar la notificación a los responsables.', 'error');
      }
    })();
  };

  // 🗑️ NUEVA FUNCIÓN: ELIMINAR UNA EVALUACIÓN DEL HISTORIAL (SOLO ADMIN)
  const handleEliminarEvaluacion = async (indexEliminar) => {
// Permite que admins o líderes autorizados guarden directamente con saveToCloud
if (!isAdmin && !puedeCrearPlanes) {
    return alert("❌ Permiso denegado. Solo un Administrador puede eliminar evaluaciones.");
    }
    
    if (!(await confirmarEliminacion('Se eliminará esta evaluación del historial y se recalculará el estado del plan.'))) return;

    const ts = new Date().toLocaleString();
    let updatedPlanesList = [...safePlanes];
    let updatedModalPlanes = [];

    // Iteramos sobre las actividades que se están viendo en el modal
    modalEval.planes.forEach(planEval => {
      const idx = updatedPlanesList.findIndex(p => p.id === planEval.id);
      
      if (idx !== -1) {
        const planAnterior = updatedPlanesList[idx];
        const historialPrevio = planAnterior.historialEvaluaciones || 
          (planAnterior.evaluacionHolistica ? [planAnterior.evaluacionHolistica] : []);
        
        // Filtramos para quitar la evaluación en el índice seleccionado
        const nuevoHistorial = historialPrevio.filter((_, i) => i !== indexEliminar);
        
        // La nueva evaluación "vigente" será la primera de la lista restante, o null si ya no quedan
        const nuevaEvaluacionVigente = nuevoHistorial.length > 0 ? nuevoHistorial[0] : null;
        
        // Recalculamos el estado del Workflow
        let nuevoEstadoWorkflow = planAnterior.estadoWorkflow;
        if (nuevoHistorial.length === 0) {
           // Si nos quedamos sin evaluaciones, regresamos el plan a En Revisión (ya que su progreso debe ser 100)
           nuevoEstadoWorkflow = planAnterior.progreso === 100 ? 'En Revisión' : 'Borrador';
        } else if (nuevaEvaluacionVigente) {
           nuevoEstadoWorkflow = nuevaEvaluacionVigente.aprobado ? 'En Ejecución' : 'Borrador';
        }

        const planActualizado = {
          ...planAnterior,
          estadoWorkflow: nuevoEstadoWorkflow,
          evaluacionHolistica: nuevaEvaluacionVigente,
          historialEvaluaciones: nuevoHistorial,
          historialCambios: [
            ...(planAnterior.historialCambios || []),
            { fecha: ts, usuario: 'Administrador', accion: `🗑️ Evaluación del historial eliminada por el administrador.` }
          ]
        };

        updatedPlanesList[idx] = planActualizado;
        updatedModalPlanes.push(planActualizado);
      }
    });

    const guardado = await saveToCloud({ planes: updatedPlanesList });
    if (!guardado) return;
    setPlanes(updatedPlanesList);
    setModalEval(prev => ({ ...prev, planes: updatedModalPlanes }));
    showNotification('Evaluación eliminada y guardada correctamente.', 'success');
  };
  
  // =========================================================
  // 📂 LOGICA FORMULARIO Y API ORIGINAL (CUSTODIADA)
  // =========================================================
 // 🧹 Utilidad para limpiar nombres de archivos
  const sanitizarNombreArchivo = (nombreOriginal) => {
    return nombreOriginal
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9.\-_]/g, "")
      .toLowerCase();
  };

const handleFileUpload = async (e, hallazgoId, index, evidenciasActuales = []) => {
    const originalFile = e.target.files[0];
    if (!originalFile) return;

    // 🛑 VALIDACIÓN DE PESO (MÁXIMO 7MB) PARA EVITAR ERROR 413
    const MAX_MB = 7;
    if (originalFile.size > MAX_MB * 1024 * 1024) {
      alert(`🛑 ERROR DE TAMAÑO\n\nEl archivo supera el límite máximo permitido por el servidor (${MAX_MB} MB).\nTu archivo pesa: ${(originalFile.size / (1024 * 1024)).toFixed(2)} MB.\n\nPor favor, comprime el PDF antes de subirlo.`);
      e.target.value = '';
      return;
    }

    // 🌟 Limpiar el nombre
    const nombreLimpio = sanitizarNombreArchivo(originalFile.name);
    const file = new File([originalFile], nombreLimpio, {
      type: originalFile.type,
      lastModified: originalFile.lastModified,
    });

    setUploadingCell(`${hallazgoId}-${index}`); setUploadProgress(20);
    
    try {
      setUploadProgress(50);
      const data = await apiService.subirEvidencia(file, { appName: 'controlInterno' });
      const urlFinal = apiService.resolveArchivoUrl({
        appName: data?.appName || 'controlInterno',
        fileName: data?.fileName || data?.filename || '',
        url: data?.url,
        file: data?.file,
      }) || `https://repos.termalessantarosa.com.co/api/archivos/auditoria/${(data?.appName || 'controlInterno').toLowerCase()}/${encodeURIComponent(data?.fileName || 'archivo')}`;
      
      const arrayEvidencias = Array.isArray(evidenciasActuales) ? evidenciasActuales : (evidenciasActuales ? [evidenciasActuales] : []);
      handleUpdateActivityField(hallazgoId, index, 'evidenciaUrl', [...arrayEvidencias, urlFinal]);
      
      setUploadingCell(null); setUploadProgress(100);
      alert("🎉 ¡Evidencia guardada con éxito en el servidor de Termales!");
    } catch (err) {
      console.error(err); alert("Error al conectar con el servidor de archivos."); setUploadingCell(null);
    }
  };
// 🧠 MODIFICADO: JALA AUTOMÁTICAMENTE CARGO Y AUDITOR DESDE EL HALLAZGO (Y ACEPTA DATOS FRESCOS)
const handleInformeChange = useCallback((informeId, customPlanes = null, customHallazgos = null) => {
    setFormInformeId(informeId);
    if (!informeId) { setMatrixState({}); return; }

    const currentPlanes = customPlanes || safePlanes;
    const currentHallazgos = customHallazgos || safeHallazgos;

    // ✨ ARQUITECTURA: Extraemos los datos del auditor directamente del Informe Padre
    const informeBase = informesAuditoria.find(inf => String(inf.id) === String(informeId));
    const auditorHeredado = informeBase?.auditorResponsable || informeBase?.auditor || informeBase?.auditorLider || '';
    const correoAuditorHeredado = informeBase?.correoAuditor || informeBase?.correoAuditorResponsable || informeBase?.correo_auditor || '';

    const reportFindings = currentHallazgos.filter(h => String(h.idInforme) === String(informeId));
    const newState = {};
    reportFindings.forEach(h => {
      const existingActivities = currentPlanes.filter(p => p.idHallazgo === h.id);
if (existingActivities.length > 0) {
        newState[h.id] = { 
          aplica: true, 
          actividades: existingActivities.map(p => ({ 
            ...p, 
            correoConfirmacion: p.correoResponsable,
            responsable: p.responsable || h.responsable || '',
            revisor: p.revisor || '',
            correoRevisor: p.correoRevisor || '',
            correoRevisorConfirmacion: p.correoRevisor || '',
            auditorAsignado: p.auditorAsignado || auditorHeredado || h.auditor || '',
            correoAuditor: p.correoAuditor || correoAuditorHeredado,
          })) 
        };
      } else {
        newState[h.id] = {
          aplica: h.estado !== 'Cerrado',
          actividades: [{ 
            id: 'new-' + Math.random(), 
            accion: '', 
            sede: h.sede || '', 
            responsable: '',
            revisor: '',
            correoRevisor: '',
            auditorAsignado: auditorHeredado || h.auditor || '', 
            correoAuditor: correoAuditorHeredado,
            fechaInicio: '', 
            fecha: '', 
            progreso: 0, 
            evidenciaUrl: '', 
            estadoWorkflow: esInformePrograma(informeBase, fuentesMejora) ? ESTADO_EVALUACION_INICIAL : 'Pendiente Revisión Jefatura',
            tipoAccion: 'Acción Correctiva',
            matrizRiesgos: 'No aplica',
            matrizAspectos: 'No aplica',
            matrizPeligros: 'No aplica',
            matrizLegal: 'No aplica'
          }]
        };
      }
    });
    setMatrixState(newState);
  }, [safePlanes, safeHallazgos, informesAuditoria, fuentesMejora]);
  // ⚡ Auto-abrir la vista de formulario cuando se selecciona un plan desde el menú lateral
  useEffect(() => {
    if (editPlan && vistaActiva !== 'nuevo') {
      setVistaActiva('nuevo');
      if (typeof scrollToForm === 'function') scrollToForm();
    }
  }, [editPlan, vistaActiva, scrollToForm]);

  // ⚡ MEJORA UX: Carga automáticamente la matriz del informe al dar clic en "Gestionar" desde el historial
  useEffect(() => {
    if (!editPlan || vistaActiva !== 'nuevo') return;
    const hallazgoBase = safeHallazgos.find(h => String(h.id) === String(editPlan.idHallazgo));
    if (!hallazgoBase?.idInforme || String(formInformeId) === String(hallazgoBase.idInforme)) return;

    const timer = setTimeout(() => {
      handleInformeChange(String(hallazgoBase.idInforme));
    }, 0);
    return () => clearTimeout(timer);
  }, [editPlan, safeHallazgos, handleInformeChange, formInformeId, vistaActiva]);

  const [modalNoAplica, setModalNoAplica] = useState({ activo: false, hallazgoId: null, justificacionTemporal: '' });
  const guardNoAplica = useUnsavedChangesGuard(
    modalNoAplica.activo && Boolean(modalNoAplica.justificacionTemporal.trim()),
    'la justificación de inaplicabilidad'
  );
  const cerrarModalNoAplica = () => guardNoAplica(() => setModalNoAplica({ activo: false, hallazgoId: null, justificacionTemporal: '' }));

  const handleToggleAplica = (hallazgoId, value) => {
    if (value === false) {
      // Abre la ventana sutil en lugar de cambiar directamente a falso
      setModalNoAplica({
        activo: true,
        hallazgoId: hallazgoId,
        justificacionTemporal: matrixState[hallazgoId]?.justificacionNoAplica || ''
      });
    } else {
      setMatrixDirty(true);
      setMatrixState(prev => ({ ...prev, [hallazgoId]: { ...prev[hallazgoId], aplica: true } }));
    }
  };

  const confirmarNoAplica = () => {
    if (modalNoAplica.justificacionTemporal.trim() === '') {
      return alert("❌ Debe ingresar una justificación válida para marcar el hallazgo como No Aplica.");
    }
    setMatrixDirty(true);
    setMatrixState(prev => ({
      ...prev,
      [modalNoAplica.hallazgoId]: {
        ...prev[modalNoAplica.hallazgoId],
        aplica: false,
        justificacionNoAplica: modalNoAplica.justificacionTemporal
      }
    }));
    setModalNoAplica({ activo: false, hallazgoId: null, justificacionTemporal: '' });
  };

  // 🧠 MODIFICADO: MANTIENE LA CONSISTENCIA DE HERENCIA SI AGREGAN MÁS ACTIVIDADES
 const handleAddActivity = (hallazgoId) => {
  setMatrixDirty(true);
    const hallazgoBase = safeHallazgos.find(h => String(h.id) === String(hallazgoId));
    const informeBase = informesAuditoria.find(inf => String(inf.id) === String(formInformeId));
    
    setMatrixState(prev => ({
      ...prev,
      [hallazgoId]: {
        ...prev[hallazgoId],
       actividades: [...prev[hallazgoId].actividades, { 
          id: 'new-' + Math.random(), 
          accion: '', 
          sede: hallazgoBase?.sede || '', 
          responsable: '',
          revisor: '',
          correoRevisor: '',
          auditorAsignado: informeBase?.auditorResponsable || hallazgoBase?.auditor || '',
          correoAuditor: informeBase?.correoAuditor || '',
          fechaInicio: '', 
          fecha: '', 
          progreso: 0, 
          evidenciaUrl: '', 
          estadoWorkflow: esFuenteProgramaAuditoria(informeBase) ? ESTADO_EVALUACION_INICIAL : 'Pendiente Revisión Jefatura',
          tipoAccion: 'Acción Correctiva',
          matrizRiesgos: 'No aplica',
          matrizAspectos: 'No aplica',
          matrizPeligros: 'No aplica',
          matrizLegal: 'No aplica'
        }]
      }
    }));
  };

  const handleRemoveActivity = async (hallazgoId, index) => {
    if (!(await confirmarEliminacion('Se quitará esta actividad de la matriz de planes de acción.'))) return;
    setMatrixDirty(true);
    setMatrixState(prev => {
      const currentActividades = [...prev[hallazgoId].actividades];
      currentActividades.splice(index, 1);
      return { ...prev, [hallazgoId]: { ...prev[hallazgoId], actividades: currentActividades } };
    });
  };

  const handleUpdateActivityField = (hallazgoId, index, field, value) => {
    setMatrixDirty(true);
    setMatrixState(prev => {
      const currentActividades = prev[hallazgoId].actividades.map((act, idx) => {
        if (idx !== index) return act;
        const actualizado = { ...act, [field]: value };
        if (field !== 'responsable' && field !== 'revisor') return actualizado;

        const hallazgo = safeHallazgos.find(item => String(item.id) === String(hallazgoId));
        const macroHallazgo = String(hallazgo?.macroproceso || hallazgo?.proceso || '').split('/')[0].trim().toLowerCase();
        const subprocesosHallazgo = (
          Array.isArray(hallazgo?.subprocesos)
            ? hallazgo.subprocesos
            : [hallazgo?.subproceso || String(hallazgo?.proceso || '').split('/')[1] || '']
        ).map(subproceso => String(subproceso || '').trim().toLowerCase());
        const candidatos = catalogoCargos.filter(registro => (
          registro?.activo !== false && String(registro?.cargo || '').trim().toLowerCase() === String(value || '').trim().toLowerCase()
        ));
        const asignacion = candidatos.find(registro => (
          String(registro.macroproceso || '').trim().toLowerCase() === macroHallazgo &&
          (Array.isArray(registro.subprocesos) ? registro.subprocesos : [registro.subproceso])
            .some(subproceso => subprocesosHallazgo.includes(String(subproceso || '').trim().toLowerCase()))
        )) || candidatos.find(registro => (
          String(registro.macroproceso || '').trim().toLowerCase() === macroHallazgo
        )) || candidatos[0];
        const correo = asignacion?.correoCorporativo || '';

        if (field === 'responsable') {
          actualizado.correoResponsable = correo;
          actualizado.correoConfirmacion = correo;
        } else {
          actualizado.correoRevisor = correo;
          actualizado.correoRevisorConfirmacion = correo;
        }
        return actualizado;
      });
      return { ...prev, [hallazgoId]: { ...prev[hallazgoId], actividades: currentActividades } };
    });
  };

  const volverAlHistorialTrasGuardarAccion = (mensaje, idInforme) => {
    setConfirmacionAccionGuardada(mensaje);
    setEditPlan(null);
    setFormInformeId('');
    setMatrixState({});
    setMatrixDirty(false);
    setModoRevisionMatriz(false);
    setInformePlanesExpandido(String(idInforme));
    setVistaActiva('historial');
  };

  const guardarAccionIndividual = async (hallazgoId, index) => {
    const key = `${hallazgoId}-${index}`;
    if (guardandoAccionKey) return;
    if (uploadingCell === key) {
      showNotification('Espera a que termine la carga de la evidencia antes de guardar.', 'error');
      return;
    }

    const actividad = matrixState[hallazgoId]?.actividades?.[index];
    const hallazgo = safeHallazgos.find(item => String(item.id) === String(hallazgoId));
    if (!actividad || !hallazgo) return;
    if (!actividad.accion?.trim()) {
      showNotification('Escribe la descripción de la acción antes de guardarla.', 'error');
      return;
    }

    const esNueva = String(actividad.id).startsWith('new-');
    const planOriginal = esNueva
      ? null
      : safePlanes.find(plan => String(plan.id) === String(actividad.id));
    const progreso = Number(actividad.progreso);
    if (!Number.isInteger(progreso) || progreso < 0 || progreso > 100) {
      showNotification('El avance debe ser un número entero entre 0 y 100.', 'error');
      return;
    }

    const correoNormalizado = value => String(value || '').trim().toLowerCase();
    const correoResponsable = String(actividad.correoResponsable || '').trim();
    const correoRevisor = String(actividad.correoRevisor || '').trim();
    if (esNueva && (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoResponsable) ||
      correoNormalizado(correoResponsable) !== correoNormalizado(actividad.correoConfirmacion) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoRevisor) ||
      correoNormalizado(correoRevisor) !== correoNormalizado(actividad.correoRevisorConfirmacion)
    )) {
      showNotification('Verifica que los correos del ejecutor y del revisor sean válidos y coincidan.', 'error');
      return;
    }

    const informeActual = informesAuditoria.find(informe => (
      String(informe.id) === String(formInformeId) ||
      String(informe.ref || '').trim().toLowerCase() === String(formInformeId).trim().toLowerCase()
    ));
    const correoAuditorAsignado = actividad.correoAuditor || planOriginal?.correoAuditor || informeActual?.correoAuditor || informeActual?.correoAuditorResponsable || '';
    const conflictoRoles = obtenerConflictoRolesPlan({
      correoResponsable,
      correoRevisor,
      correoAuditor: correoAuditorAsignado,
    });
    const cambiaAsignacionRoles = esNueva ||
      correoNormalizado(correoResponsable) !== correoNormalizado(planOriginal?.correoResponsable) ||
      correoNormalizado(correoRevisor) !== correoNormalizado(planOriginal?.correoRevisor) ||
      correoNormalizado(correoAuditorAsignado) !== correoNormalizado(planOriginal?.correoAuditor || informeActual?.correoAuditor || informeActual?.correoAuditorResponsable);
    if (conflictoRoles && cambiaAsignacionRoles) {
      showNotification(`No se puede guardar: el correo se repite entre ${conflictoRoles}. Asigna personas distintas; el auditor se hereda del informe.`, 'error');
      return;
    }

    const camposGuardables = [
      'accion', 'sede', 'fechaInicio', 'fecha', 'evidenciaUrl', 'tipoAccion', 'progreso',
      'matrizRiesgos', 'matrizAspectos', 'matrizPeligros', 'matrizLegal',
    ];
    const cambios = {
      id: actividad.id,
      accion: actividad.accion.trim(),
      sede: actividad.sede || 'No especificada',
      fechaInicio: actividad.fechaInicio || null,
      fecha: actividad.fecha || null,
      evidenciaUrl: actividad.evidenciaUrl || '',
      tipoAccion: actividad.tipoAccion || 'Acción Correctiva',
      progreso,
      matrizRiesgos: actividad.matrizRiesgos || 'No aplica',
      matrizAspectos: actividad.matrizAspectos || 'No aplica',
      matrizPeligros: actividad.matrizPeligros || 'No aplica',
      matrizLegal: actividad.matrizLegal || 'No aplica',
    };
    const camposDiseno = camposGuardables.filter(campo => !['progreso', 'evidenciaUrl'].includes(campo));
    const cambioDiseno = Boolean(planOriginal && camposDiseno.some(campo => (
      JSON.stringify(planOriginal[campo] ?? null) !== JSON.stringify(cambios[campo] ?? null)
    ))) || Boolean(planOriginal && (
      correoNormalizado(actividad.correoResponsable) !== correoNormalizado(planOriginal.correoResponsable) ||
      correoNormalizado(actividad.correoRevisor) !== correoNormalizado(planOriginal.correoRevisor) ||
      correoNormalizado(actividad.correoAuditor) !== correoNormalizado(planOriginal.correoAuditor || informeActual?.correoAuditor)
    ));
    const llegaAlCien = progreso === 100 && (
      Number(planOriginal?.progreso || 0) < 100 || planOriginal?.estadoWorkflow === 'En Ejecución'
    );
    const idInformeReal = String(
      informesAuditoria.find(informe => (
        String(informe.id) === String(formInformeId) ||
        String(informe.ref || '').trim().toLowerCase() === String(formInformeId).trim().toLowerCase()
      ))?.id || formInformeId
    );

    setGuardandoAccionKey(key);
    try {
      const notificarNueva = enviarNotificaciones || esFuenteProgramaAuditoria(informeActual);
      const requiereNotificacion = (esNueva && notificarNueva) || llegaAlCien || cambioDiseno;
      let correoPreparado = !requiereNotificacion;
      let promesaPreparacionGmail = null;
      if (requiereNotificacion && prepararEnvioGmail) {
        try {
          promesaPreparacionGmail = Promise.resolve(prepararEnvioGmail()).catch(() => false);
        } catch {
          promesaPreparacionGmail = Promise.resolve(false);
        }
      }

      let planGuardado;
      if (esNueva) {
        const respuesta = await apiService.guardarMatrizPlanes({
          idInforme: idInformeReal,
          actualizaciones: [],
          nuevas: [{
            idHallazgo: hallazgo.id,
            accion: cambios.accion,
            sede: cambios.sede,
            responsable: actividad.responsable || 'Sin Asignar',
            correoResponsable,
            correoConfirmacion: actividad.correoConfirmacion,
            revisor: actividad.revisor || 'Sin Asignar',
            correoRevisor,
            correoRevisorConfirmacion: actividad.correoRevisorConfirmacion,
            auditorAsignado: actividad.auditorAsignado || '',
            correoAuditor: actividad.correoAuditor || '',
            fechaInicio: cambios.fechaInicio,
            fecha: cambios.fecha,
            evidenciaUrl: cambios.evidenciaUrl,
            tipoAccion: cambios.tipoAccion,
            matrizRiesgos: cambios.matrizRiesgos,
            matrizAspectos: cambios.matrizAspectos,
            matrizPeligros: cambios.matrizPeligros,
            matrizLegal: cambios.matrizLegal,
          }],
        });
        planGuardado = respuesta?.planesNuevos?.[0];
      } else {
        const correoAuditorOriginal = planOriginal?.correoAuditor || informeActual?.correoAuditor || '';
        const cambiosCorreo = {};
        if (correoNormalizado(actividad.correoResponsable) !== correoNormalizado(planOriginal?.correoResponsable)) {
          cambiosCorreo.correoResponsable = correoResponsable;
          cambiosCorreo.correoConfirmacion = actividad.correoConfirmacion || '';
        }
        if (correoNormalizado(actividad.correoRevisor) !== correoNormalizado(planOriginal?.correoRevisor)) {
          cambiosCorreo.correoRevisor = correoRevisor;
          cambiosCorreo.correoRevisorConfirmacion = actividad.correoRevisorConfirmacion || '';
        }
        if (correoNormalizado(actividad.correoAuditor) !== correoNormalizado(correoAuditorOriginal)) {
          cambiosCorreo.correoAuditor = String(actividad.correoAuditor || '').trim();
        }
        const cambiosFinales = {
          ...cambios,
          ...(isAdmin ? {
            responsable: actividad.responsable || 'Sin Asignar',
            revisor: actividad.revisor || 'Sin Asignar',
          } : {}),
          ...cambiosCorreo,
        };
        const camposComparados = [
          ...camposGuardables,
          ...(isAdmin ? ['responsable', 'revisor'] : []),
          ...Object.keys(cambiosCorreo),
        ];
        const sinCambios = camposComparados.every(campo => (
          JSON.stringify(planOriginal[campo] ?? null) === JSON.stringify(cambiosFinales[campo] ?? null)
        ));
        if (sinCambios && !(progreso === 100 && planOriginal.estadoWorkflow === 'En Ejecución')) {
          volverAlHistorialTrasGuardarAccion('Esta acción ya estaba guardada. Puedes retomar las demás desde este historial.', idInformeReal);
          return;
        }
        const respuesta = await apiService.guardarMatrizPlanes({
          idInforme: idInformeReal,
          nuevas: [],
          actualizaciones: [cambiosFinales],
        });
        planGuardado = respuesta?.planesActualizados?.[0];
      }

      if (!planGuardado) throw new Error('El servidor no confirmó el guardado de la acción.');
      const planesActualizados = esNueva
        ? [...safePlanes, planGuardado]
        : safePlanes.map(plan => String(plan.id) === String(planGuardado.id) ? planGuardado : plan);
      setPlanes(planesActualizados);
      setGuardandoAccionKey(null);
      volverAlHistorialTrasGuardarAccion(
        requiereNotificacion
          ? 'La acción quedó registrada. Las demás siguen pendientes para retomarlas desde el historial.'
          : 'La acción quedó registrada. Puedes retomar las demás desde el historial.',
        idInformeReal
      );

      if (promesaPreparacionGmail) {
        correoPreparado = Boolean(await promesaPreparacionGmail);
      }

      let notificacionEnviada = true;
      try {
        if (esNueva && notificarNueva) {
          notificacionEnviada = await notificarRegistroPlan(planGuardado, correoPreparado);
        } else if (planGuardado.estadoWorkflow === ESTADO_PENDIENTE_VALIDACION_REVISOR && llegaAlCien) {
          const enlaceEvidencia = Array.isArray(planGuardado.evidenciaUrl)
            ? planGuardado.evidenciaUrl.at(-1)
            : planGuardado.evidenciaUrl;
          notificacionEnviada = await enviarNotificacionPlanConReintento({
            ref_consecutivo: `PLA-${String(planGuardado.id).slice(-4)}`,
            titulo_informe: 'Plan al 100%: validación del revisor requerida',
            proceso_auditado: `La acción "${planGuardado.accion}" llegó al 100%. Valide las evidencias para enviarla al aprobador final.`,
            enlace_pdf: enlaceEvidencia || window.location.origin,
            destinatarios: planGuardado.correoRevisor,
          }, correoPreparado);
        } else if (cambioDiseno && ['Pendiente Revisión Jefatura', ESTADO_EVALUACION_INICIAL].includes(planGuardado.estadoWorkflow)) {
          notificacionEnviada = await enviarNotificacionPlanConReintento({
            ref_consecutivo: `PLA-${String(planGuardado.id).slice(-4)}`,
            titulo_informe: 'Diseño corregido: pendiente de nueva revisión',
            proceso_auditado: `La acción "${planGuardado.accion}" fue actualizada y requiere ${esFuenteProgramaAuditoria(informeActual) ? 'una nueva evaluación inicial del auditor asignado, con aprobación desde el 80%, antes de ejecutar' : 'una nueva revisión'}.`,
            enlace_pdf: `${window.location.origin}/?reviewReportId=${encodeURIComponent(idInformeReal)}`,
            destinatarios: esFuenteProgramaAuditoria(informeActual) ? planGuardado.correoAuditor : planGuardado.correoRevisor,
          }, correoPreparado);
        }
      } catch (error) {
        console.error('No se pudo completar la notificación de la acción guardada:', error);
        notificacionEnviada = false;
      }

      if (!notificacionEnviada) {
        showNotification('La acción quedó guardada, pero la notificación no pudo confirmarse y quedó pendiente de reintento.', 'error');
      }
    } catch (error) {
      showNotification(error.message || 'No se pudo guardar esta acción.', 'error');
    } finally {
      setGuardandoAccionKey(null);
    }
  };
const aniosDisponibles = [...new Set(planesEnriquecidos.map(p => p.anioTexto).filter(a => a !== 'Sin Fecha'))].sort().reverse();

  const guardarEvaluacionEficaciaCierre = async () => {
    const { plan, conclusion, fueEficaz, requiereAcciones, observaciones } = modalEficaciaCierre;
    if (!plan || !conclusion.trim() || !fueEficaz) {
      showNotification('Completa la conclusión y selecciona si la acción fue eficaz.', 'error');
      return;
    }
    if (fueEficaz === 'no' && !observaciones.trim()) {
      showNotification('Describe la observación para devolver la acción al ejecutor.', 'error');
      return;
    }

    setGuardandoEficaciaCierre(true);
    const eficaz = fueEficaz === 'si';

    try {
      let promesaCorreo = Promise.resolve(true);
      if (prepararEnvioGmail) promesaCorreo = Promise.resolve(prepararEnvioGmail()).catch(() => false);
      let planActualizado;
      try {
        const respuesta = await apiService.decidirPlanComoAuditor(
          plan.id,
          eficaz ? 'cerrar' : 'rechazar',
          observaciones.trim(),
          {
            conclusion: conclusion.trim(),
            requiereAccionesAdicionales: requiereAcciones === 'si',
            observaciones: observaciones.trim(),
          }
        );
        planActualizado = respuesta?.plan;
        if (respuesta?.hallazgo && setHallazgos) setHallazgos(prev => prev.map(item => String(item.id) === String(respuesta.hallazgo.id) ? respuesta.hallazgo : item));
      } catch (error) {
        showNotification(error.message || 'No se pudo guardar la evaluación de eficacia. Intenta de nuevo.', 'error');
        return;
      }
      if (!planActualizado) {
        showNotification('No se pudo guardar la evaluación de eficacia. Intenta de nuevo.', 'error');
        return;
      }

      setPlanes(prev => (Array.isArray(prev) ? prev : []).map(item => (
        String(item.id) === String(plan.id) ? planActualizado : item
      )));
      setModalEficaciaCierre({ activo: false, plan: null, conclusion: '', fueEficaz: '', requiereAcciones: 'no', observaciones: '' });
      if (eficaz) {
        setConfirmacionCierreEficaz({ id: planActualizado.id, accion: planActualizado.accion });
      }
      showNotification(
        eficaz ? 'Eficacia registrada. La acción quedó cerrada.' : 'Evaluación guardada. La acción volvió a ejecución para su ajuste.',
        'success'
      );

      {
        const notificado = await enviarNotificacionPlanConReintento({
          ref_consecutivo: `PLA-${String(planActualizado.id).slice(-4)}`,
          titulo_informe: eficaz ? 'Plan de acción cerrado' : 'Evidencia rechazada: requiere ajustes',
          proceso_auditado: eficaz
            ? `La eficacia de la acción "${planActualizado.accion}" fue confirmada. Conclusión: ${conclusion.trim()}`
            : `La eficacia de la acción "${planActualizado.accion}" no fue demostrada. La acción vuelve a ejecución (90%). Observación: ${observaciones.trim()}`,
          enlace_pdf: window.location.origin,
          destinatarios: [planActualizado.correoResponsable, planActualizado.correoRevisor].filter(Boolean).join(', '),
        }, Boolean(await promesaCorreo));
        if (!notificado) showNotification('La evaluación se guardó, pero no se pudo notificar a los responsables.', 'error');
      }
    } catch (error) {
      showNotification(error.message || 'No se pudo guardar la evaluación de eficacia.', 'error');
    } finally {
      setGuardandoEficaciaCierre(false);
    }
  };

  const puedeDecidirRevision = modoRevisionMatriz && planesEnriquecidos.some(plan => (
    String(plan.idInforme) === String(revisionInformeId) &&
    ['Pendiente Revisión Jefatura', ESTADO_PENDIENTE_VALIDACION_REVISOR].includes(plan.estadoWorkflow) &&
    !(esPlanProgramaAuditoria(plan) && plan.estadoWorkflow === 'Pendiente Revisión Jefatura') &&
    Boolean(correoUsuarioActual) &&
    String(plan.correoRevisor || '').trim().toLowerCase() === correoUsuarioActual
  ));

  const modoValidacionFinalRevisor = modoRevisionMatriz && planesEnriquecidos.some(plan => (
    String(plan.idInforme) === String(revisionInformeId)
    && plan.estadoWorkflow === ESTADO_PENDIENTE_VALIDACION_REVISOR
  ));

  const abrirRevisionPlan = plan => {
    setEditPlan(null);
    setModoRevisionMatriz(true);
    setRevisionInformeId(plan.idInforme);
    setMostrarMotivoCorreccion(false);
    setMotivoCorreccion('');
    handleInformeChange(String(plan.idInforme));
    setVistaActiva('nuevo');
    requestAnimationFrame(() => {
      if (typeof scrollToForm === 'function') scrollToForm();
    });
  };

  const resolverDecisionRevision = async (decision) => {
    if (!revisionInformeId || guardandoDecisionRevision) return;
    if (decision === 'corregir' && !motivoCorreccion.trim()) {
      alert('Escribe el motivo de la corrección solicitada.');
      return;
    }

    const correoSesion = String(user?.email || '').trim().toLowerCase();
    const planesPendientes = planesEnriquecidos.filter(plan => (
      String(plan.idInforme) === String(revisionInformeId) &&
      ['Pendiente Revisión Jefatura', ESTADO_PENDIENTE_VALIDACION_REVISOR].includes(plan.estadoWorkflow) &&
      !(esPlanProgramaAuditoria(plan) && plan.estadoWorkflow === 'Pendiente Revisión Jefatura') &&
      String(plan.correoRevisor || '').trim().toLowerCase() === correoSesion
    ));
    if (planesPendientes.length === 0) {
      alert('No hay planes pendientes asignados a este revisor para el informe.');
      setRevisionInformeId(null);
      return;
    }
    const estadoAnteriorPorId = new Map(planesPendientes.map(plan => [String(plan.id), plan.estadoWorkflow]));

    setGuardandoDecisionRevision(true);
    try {
      let promesaPreparacionCorreo = null;
      if (prepararEnvioGmail) {
        try {
          promesaPreparacionCorreo = prepararEnvioGmail();
        } catch {
          promesaPreparacionCorreo = Promise.resolve(false);
        }
      }
      const respuesta = await apiService.decidirRevisionPlanes(
        revisionInformeId,
        decision,
        motivoCorreccion.trim()
      );
      const planesActualizados = Array.isArray(respuesta?.planes) ? respuesta.planes : [];
      if (planesActualizados.length === 0) {
        alert('El servidor no devolvió planes actualizados.');
        return;
      }

      const actualizadosPorId = new Map(planesActualizados.map(plan => [String(plan.id), plan]));
      setPlanes(prev => (Array.isArray(prev) ? prev : []).map(plan => actualizadosPorId.get(String(plan.id)) || plan));

      setRevisionInformeId(null);
      setMostrarMotivoCorreccion(false);
      setMotivoCorreccion('');
      setModoRevisionMatriz(false);
      setEditPlan(null);
      setFormInformeId('');
      setMatrixState({});
      setVistaActiva('historial');
      setGuardandoDecisionRevision(false);
      showNotification('Decisión guardada. Preparando notificación para la siguiente etapa…', 'success');
      void (async () => {
        let todasNotificacionesEnviadas = true;
        let correoPreparado = !prepararEnvioGmail;
        if (promesaPreparacionCorreo) {
          try {
            correoPreparado = await promesaPreparacionCorreo;
          } catch {
            correoPreparado = false;
          }
        }
        for (const plan of planesActualizados) {
          const estadoAnterior = estadoAnteriorPorId.get(String(plan.id));
          const esValidacionFinal = estadoAnterior === ESTADO_PENDIENTE_VALIDACION_REVISOR;
          const validacionPendienteRevisor = plan.estadoWorkflow === ESTADO_PENDIENTE_VALIDACION_REVISOR;
          const pasaAlAprobador = esValidacionFinal && decision === 'aprobar' && plan.estadoWorkflow === 'En Revisión (100%)';
          const informe = informesAuditoria.find(item => String(item.id) === String(plan.idInforme));
          const destinatario = pasaAlAprobador
            ? plan.correoAuditor || informe?.correoAuditor || informe?.correoAuditorResponsable
            : validacionPendienteRevisor ? plan.correoRevisor : plan.correoResponsable;
          if (!destinatario) {
            todasNotificacionesEnviadas = false;
            continue;
          }
          try {
            const enviado = await enviarNotificacionPlanConReintento({
              ref_consecutivo: `PLA-${String(plan.id).slice(-4)}`,
              asunto: pasaAlAprobador
                ? 'Ejecución validada: aprobación final requerida'
                : validacionPendienteRevisor
                  ? 'Diseño aprobado: validación final del revisor requerida'
                  : decision === 'aprobar' ? 'Diseño del plan aprobado' : 'Corrección solicitada para el plan de acción',
              titulo_informe: pasaAlAprobador
                ? 'Ejecución al 100% validada por el revisor'
                : validacionPendienteRevisor
                  ? 'Validación final pendiente del revisor'
                  : decision === 'aprobar' ? 'Diseño del plan aprobado' : 'El plan requiere correcciones',
              proceso_auditado: pasaAlAprobador
                ? `El revisor validó las evidencias de la acción "${plan.accion}" al 100%. Realice la aprobación final y cierre del plan.`
                : validacionPendienteRevisor
                  ? `El diseño de la acción "${plan.accion}" quedó aprobado con ejecución al 100%. Valide sus evidencias antes de enviarla al aprobador final.`
                  : esValidacionFinal
                  ? `La acción "${plan.accion}" fue devuelta al ejecutor al 90% para corregir las evidencias. Motivo: ${motivoCorreccion.trim()}`
                  : decision === 'aprobar'
                    ? `El diseño de la acción "${plan.accion}" fue aprobado. Ya puede iniciar su ejecución.`
                    : `El diseño de la acción "${plan.accion}" requiere correcciones. Motivo del revisor: ${motivoCorreccion.trim()}`,
              enlace_pdf: window.location.origin,
              destinatarios: destinatario,
            }, correoPreparado);
            if (!enviado) todasNotificacionesEnviadas = false;
          } catch {
            todasNotificacionesEnviadas = false;
          }
        }
        if (todasNotificacionesEnviadas) {
          showNotification('Notificación enviada a la siguiente persona responsable.', 'success');
        } else {
          showNotification('La decisión se guardó, pero no se pudieron enviar todas las notificaciones.', 'error');
        }
      })();
    } catch (error) {
      alert(error.message || 'No se pudo guardar la decisión de revisión.');
    } finally {
      setGuardandoDecisionRevision(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {confirmacionAccionGuardada && (
        <div role="status" aria-live="polite" aria-atomic="true" className="success-notice-glow flex items-center justify-between gap-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-950 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 size={19} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold">Guardado exitoso</p>
              <p className="text-xs text-emerald-800">{confirmacionAccionGuardada}</p>
            </div>
          </div>
          <button type="button" onClick={() => setConfirmacionAccionGuardada('')} aria-label="Cerrar confirmación de guardado" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-emerald-700 transition-colors hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
            <X size={17} aria-hidden="true" />
          </button>
        </div>
      )}
      
{/* 📋 CABECERA PRINCIPAL CON BANNER DE IMAGEN ESTILO PREMIUM */}
      <div 
        className="relative rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center p-6 gap-6 mb-6 z-40"
      >
        {/* IMAGEN DE FONDO CON OVERLAY */}
        <div 
          className="absolute inset-0 bg-cover bg-center z-0 rounded-2xl overflow-hidden"
          style={{ backgroundImage: "url('/plan_de_accion.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#070f1e] via-[#070f1e]/90 to-transparent z-10 rounded-2xl overflow-hidden" />

       {/* CONTENIDO IZQUIERDA */}
        <div className="relative z-20 w-full md:w-3/5 flex flex-col gap-6">
          
          {/* Bloque 1: Título y descripción */}
          <div className="flex items-start gap-4">
            {/* Ícono Circular */}
            <div className="w-12 h-12 rounded-full border-[3px] border-blue-500/80 bg-blue-900/40 flex items-center justify-center shrink-0 mt-0.5 shadow-[0_0_15px_rgba(0,102,255,0.3)] backdrop-blur-sm">
              <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <div className="pt-1">
              <h2 className="text-3xl font-black text-white drop-shadow-md tracking-tight">
                Planes de Acción
              </h2>
              <p className="text-[13px] text-slate-300 font-medium mt-1.5 leading-relaxed max-w-md">
                Transforma los hallazgos en acciones concretas y da seguimiento a su cumplimiento.
              </p>
            </div>
          </div>

          {/* Bloque 2: Frase destacada */}
          <div className="ml-[64px]">
            <h3 className="text-lg md:text-xl font-bold text-white drop-shadow-md leading-tight">
              La ejecución también es <br className="hidden md:block" /> un resultado.
            </h3>
            <div className="h-1.5 w-14 bg-blue-500 mt-3 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>
          </div>
        </div>
        
        {/* BOTONERA DERECHA */}
        <div className="relative z-20 flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          
{/* 👉 AQUÍ EMPIEZA LA BARRA DE BÚSQUEDA RÁPIDA CON DROPDOWN Y BOTÓN IR */}
          <div className="relative flex items-center mr-2 group">
            <form onSubmit={buscarPlanPorId} className="relative flex items-center w-full">
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-[10px] text-slate-400">🔍</span>
                <input
                  type="text"
                  placeholder="Ej: 004, servicio..."
                  value={busquedaRapida}
                  onChange={(e) => {
                    setBusquedaRapida(e.target.value);
                    setShowSearchDropdown(true);
                  }}
                  onFocus={() => setShowSearchDropdown(true)}
                  onBlur={() => setTimeout(() => setShowSearchDropdown(false), 250)}
                  className="pl-8 pr-4 py-2.5 bg-slate-900/60 border border-slate-700 border-r-0 rounded-l-xl text-[11px] font-black text-white placeholder-slate-400 w-40 focus:w-56 transition-all outline-none focus:border-blue-500 focus:bg-slate-900/90 shadow-inner backdrop-blur-sm"
                />
              </div>
              <button 
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white font-black text-[11px] px-4 py-2.5 rounded-r-xl border border-blue-600 shadow-md transition-colors"
              >
                Ir
              </button>
            </form>

            {/* LISTA DESPLEGABLE DE COINCIDENCIAS (AUTOCOMPLETADO) */}
            {showSearchDropdown && busquedaRapida.length > 0 && (informesMatch.length > 0 || planesMatch.length > 0) && (
              <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-2xl z-[100] overflow-hidden max-h-96 overflow-y-auto flex flex-col animate-in fade-in slide-in-from-top-2">
                
                {informesMatch.length > 0 && (
                  <div className="border-b border-slate-100">
                    <h4 className="text-[9px] font-black text-[#0A3B32] uppercase tracking-widest bg-[#f0fdf4] py-1.5 px-3">Informes Encontrados</h4>
                    <div className="p-1">
                      {informesMatch.map(inf => (
                        <button 
                          type="button" 
                          key={`s-inf-${inf.id}`} 
                          onClick={() => {
                            setBusquedaRapida(inf.ref); // Solo rellena el input
                            setShowSearchDropdown(false); // Cierra la lista
                          }} 
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg transition-colors flex items-start gap-2"
                        >
                          <span className="text-xl shrink-0">📂</span>
                          <div className="truncate w-full">
                            <p className="text-[11px] font-black text-slate-800">
                              {inf.ref} 
                              <span className="text-[8px] bg-slate-100 text-slate-500 ml-2 px-1.5 py-0.5 rounded font-sans uppercase tracking-wider">{inf.proceso}</span>
                            </p>
                            <p className="text-[9px] text-slate-500 truncate" title={inf.titulo}>{inf.titulo}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {planesMatch.length > 0 && (
                  <div>
                    <h4 className="text-[9px] font-black text-blue-800 uppercase tracking-widest bg-blue-50 py-1.5 px-3">Planes Encontrados</h4>
                    <div className="p-1">
                      {planesMatch.map(p => {
                        const hallazgoAsociado = safeHallazgos.find(h => h.id === p.idHallazgo) || {};
                        return (
                          <button 
                            type="button" 
                            key={`s-plan-${p.id}`} 
                            onClick={() => {
                              setBusquedaRapida(`PLA-${p.id.toString().slice(-4)}`); // Solo rellena el input
                              setShowSearchDropdown(false); // Cierra la lista
                            }} 
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg transition-colors flex items-start gap-2"
                          >
                            <span className="text-xl shrink-0">📋</span>
                            <div className="truncate w-full">
                              <p className="text-[11px] font-black text-slate-800 font-mono">
                                PLA-{p.id.toString().slice(-4)} 
                                <span className="text-[8px] bg-slate-100 text-slate-500 ml-2 px-1.5 py-0.5 rounded font-sans uppercase tracking-wider">{hallazgoAsociado.proceso || 'General'}</span>
                              </p>
                              <p className="text-[9px] text-slate-500 truncate" title={p.accion}>{p.accion}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
         </div>
          {/* 👉 AQUÍ TERMINA LA BARRA DE BÚSQUEDA RÁPIDA */}

          <button type="button" aria-current={vistaActiva === 'dashboard' ? 'page' : undefined} onClick={() => cambiarVistaSegura('dashboard')} className={`px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all backdrop-blur-sm border ${vistaActiva === 'dashboard' ? 'bg-gradient-to-r from-[#0055ff] to-[#0077ff] text-white shadow-[0_4px_15px_rgba(0,85,255,0.3)] border-transparent' : 'bg-slate-900/60 text-slate-300 border-slate-700 hover:bg-slate-800/80 hover:text-white'}`}>📊 Resumen Visual</button>
          <button type="button" aria-current={vistaActiva === 'historial' ? 'page' : undefined} onClick={() => cambiarVistaSegura('historial')} className={`px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all backdrop-blur-sm border ${vistaActiva === 'historial' ? 'bg-gradient-to-r from-[#0055ff] to-[#0077ff] text-white shadow-[0_4px_15px_rgba(0,85,255,0.3)] border-transparent' : 'bg-slate-900/60 text-slate-300 border-slate-700 hover:bg-slate-800/80 hover:text-white'}`}>📜 Historial Matriz</button>
          
          {/* Oculto temporalmente el botón "Nuevo Plan" ya que la creación es automática por Hallazgo */}
          {/* isAdmin && (
            <button onClick={() => { setEditPlan(null); setVistaActiva('nuevo'); }} className="px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center shadow-lg bg-emerald-600 text-white hover:bg-emerald-500 border border-emerald-500">
              <span className="mr-2">➕</span> Nuevo Plan
            </button>
          ) */}
        </div>
      </div>

      {evaluacionesIntegralesPendientes.length > 0 && (
        <section
          role="status"
          aria-live="polite"
          className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm animate-in slide-in-from-top-2 duration-300"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-black text-amber-900">
                <span aria-hidden="true">🔔</span>
                Evaluación inicial pendiente
                <span className="rounded-md bg-amber-200 px-2 py-0.5 text-[10px]">{evaluacionesIntegralesPendientes.length}</span>
              </h3>
              <p className="mt-1 text-xs font-medium text-amber-800">
                Evalúa el diseño de las acciones registradas. Un resultado mayor o igual al 80% habilita su ejecución; no cierra las acciones.
              </p>
            </div>
          </div>
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {evaluacionesIntegralesPendientes.map(({ informe, planes, actividadesPendientes }) => (
              <div
                key={`evaluacion-pendiente-${informe.id}`}
                className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-black text-slate-800">
                    {informe.ref || `Informe ${informe.id}`} · {informe.titulo || 'Sin título'}
                  </p>
                  <p className="mt-0.5 text-[10px] font-medium text-slate-500">
                    {actividadesPendientes} {actividadesPendientes === 1 ? 'acción pendiente' : 'acciones pendientes'} de evaluación
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => iniciarEvaluacionIntegral(informe, planes)}
                  className="shrink-0 rounded-lg bg-[#0A3B32] px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white shadow-sm transition-colors hover:bg-[#062620]"
                >
                  ⚖️ Diligenciar evaluación
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 🚀 VISTA 1: DASHBOARD FIEL A TU MAQUETA */}
      {vistaActiva === 'dashboard' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
{/* 🚨 BANNER ROJO DE PLANES VENCIDOS */}
          {planesVencidosNotificables.length > 0 && (
            <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded-xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-in slide-in-from-top-4 duration-500">
              <div>
                <button type="button" onClick={() => setDetallePanelPlanes(detallePanelPlanes === 'vencidos' ? null : 'vencidos')} className="text-left rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600">
                  <h3 className="text-red-800 font-black text-sm flex items-center gap-2">
                    <span>❌</span> ¡Urgente! Hay {planesVencidosNotificables.length} plan(es) de acción VENCIDOS.
                    <span className="ml-1 bg-red-600 text-white px-2 py-1 rounded-md text-[9px] uppercase">Ver {planesVencidosNotificables.length} planes</span>
                  </h3>
                </button>
                <p className="text-red-700 text-xs font-medium mt-1">
                  Se requiere enviar recordatorio de atraso a los dueños del proceso. Pulsa el título para ver el detalle a la derecha.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                {planesVencidosNotificables.slice(0, 3).map(plan => {
                  const asunto = encodeURIComponent(`❌ URGENTE: Plan de Acción VENCIDO (PLA-${plan.id.toString().slice(-4)})`);
                  const cuerpo = encodeURIComponent(`Estimado/a Líder del Proceso,\n\nLe informamos que el siguiente plan de acción bajo su responsabilidad se encuentra actualmente VENCIDO en nuestra plataforma:\n\n📌 Acción requerida: "${plan.accion}"\n📅 Fecha límite original: ${plan.fecha}\n\nPor favor, ingrese de inmediato a la plataforma para actualizar el avance o cargar los soportes correspondientes, ya que este retraso afecta los indicadores de cumplimiento de la compañía.\n\nCordialmente,\nAuditoría GCM`);
                  return (
                    <a 
                      key={`vencido-${plan.id}`}
                      href={`https://mail.google.com/mail/?view=cm&fs=1&to=${plan.correoResponsable || ''}&su=${asunto}&body=${cuerpo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-2 transition-all hover:scale-105"
                      title={`Clic para enviar correo a ${plan.responsable} usando Gmail`}
                    >
                      <span>📧 Reclamar PLA-{plan.id.toString().slice(-4)}</span>
                    </a>
                  )
                })}
                {planesVencidosNotificables.length > 3 && <span className="text-[10px] text-red-600 font-bold self-center">+ {planesVencidosNotificables.length - 3} vencidos más en la tabla</span>}
              </div>
            </div>
          )}

          {/* 🚨 BANNER NARANJA DE ALERTAS PREVENTIVAS */}
          {planesEnAlerta.length > 0 && (
            <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-in slide-in-from-top-4 duration-500">
              <div>
                <button type="button" onClick={() => setDetallePanelPlanes(detallePanelPlanes === 'proximos' ? null : 'proximos')} className="text-left rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-600">
                  <h3 className="text-orange-800 font-black text-sm flex items-center gap-2">
                    <span>⚠️</span> ¡Atención! {planesEnAlerta.length} plan(es) vence(n) en 2 días o menos.
                    <span className="ml-1 bg-orange-600 text-white px-2 py-1 rounded-md text-[9px] uppercase">Ver {planesEnAlerta.length} planes</span>
                  </h3>
                </button>
                <p className="text-orange-700 text-xs font-medium mt-1">
                  Notifica a los responsables para evitar incumplimientos. Pulsa el título para ver el detalle a la derecha.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                {planesEnAlerta.map(plan => {
                  const asunto = encodeURIComponent(`⚠️ Recordatorio Preventivo: Vencimiento Próximo de Plan de Acción (PLA-${plan.id.toString().slice(-4)})`);
                  const cuerpo = encodeURIComponent(`Estimado/a Líder del Proceso,\n\nLe escribimos de manera preventiva para recordarle que el siguiente plan de acción bajo su responsabilidad está a punto de vencer:\n\n📌 Acción requerida: "${plan.accion}"\n📅 Fecha límite: ${plan.fecha}\n\nPor favor, asegúrese de cargar los soportes correspondientes en la plataforma antes de la fecha límite para evitar que el plan pase a estado VENCIDO y afecte sus indicadores.\n\nCordialmente,\nAuditoría GCM`);
                  return (
                    <a 
                      key={`alerta-${plan.id}`}
                      href={`https://mail.google.com/mail/?view=cm&fs=1&to=${plan.correoResponsable || ''}&su=${asunto}&body=${cuerpo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-2 transition-all hover:scale-105"
                      title={`Clic para notificar a ${plan.responsable} usando Gmail`}
                    >
                      <span>📧 Notificar PLA-{plan.id.toString().slice(-4)}</span>
                    </a>
                  )
                })}
              </div>
            </div>
          )}
          
{/* 🚀 TARJETAS 100% INTERACTIVAS: Al hacer clic, aplican filtro de Estado */}
          <div data-scroll-focus="filter" className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            
            {/* 1. TOTAL PLANES (Resetea los filtros) */}
            <div onClick={() => setDashFiltroEstado('Todos')} className={`bg-white p-4 rounded-2xl border shadow-sm flex flex-col justify-center relative overflow-hidden cursor-pointer transition-all hover:scale-105 ${dashFiltroEstado === 'Todos' ? 'border-slate-800 ring-4 ring-slate-800/10' : 'border-slate-200 hover:border-slate-400'}`}>
               <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Planes</p>
               <div className="flex items-center space-x-2">
                 <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-black shadow-sm">∑</div>
                 <p className="text-2xl font-black text-slate-800">{totalPlanesBase}</p>
               </div>
            </div>          
            
            {/* 2. CERRADOS */}
            <div onClick={() => setDashFiltroEstado('Cerrado')} className={`bg-white p-4 rounded-2xl border shadow-sm flex flex-col justify-center relative overflow-hidden cursor-pointer transition-all hover:scale-105 ${dashFiltroEstado === 'Cerrado' ? 'border-emerald-500 ring-4 ring-emerald-500/20' : 'border-emerald-200 hover:border-emerald-500'}`}>
               <p className="text-[9px] font-black text-emerald-700 uppercase tracking-widest mb-1">Cerrados</p>
               <div className="flex items-center space-x-2">
                 <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-black shadow-sm">✓</div>
                 <div>
                   <p className="text-2xl font-black text-slate-800 leading-none">{cerrados}</p>
                   <p className="text-[9px] font-bold text-emerald-500 mt-0.5">{pct(cerrados)}% del total</p>
                 </div>
               </div>
            </div>
            
            {/* 3. EN PROCESO */}
            <div onClick={() => setDashFiltroEstado('En Proceso')} className={`bg-white p-4 rounded-2xl border shadow-sm flex flex-col justify-center relative overflow-hidden cursor-pointer transition-all hover:scale-105 ${dashFiltroEstado === 'En Proceso' ? 'border-amber-500 ring-4 ring-amber-500/20' : 'border-amber-200 hover:border-amber-500'}`}>
               <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest mb-1">En Proceso</p>
               <div className="flex items-center space-x-2">
                 <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-black shadow-sm">🕒</div>
                 <div>
                   <p className="text-2xl font-black text-slate-800 leading-none">{enProceso}</p>
                   <p className="text-[9px] font-bold text-amber-500 mt-0.5">{pct(enProceso)}% del total</p>
                 </div>
               </div>
            </div>
            
            {/* 4. PENDIENTES */}
            <div onClick={() => setDashFiltroEstado('Pendiente')} className={`bg-white p-4 rounded-2xl border shadow-sm flex flex-col justify-center relative overflow-hidden cursor-pointer transition-all hover:scale-105 ${dashFiltroEstado === 'Pendiente' ? 'border-orange-500 ring-4 ring-orange-500/20' : 'border-orange-200 hover:border-orange-500'}`}>
               <p className="text-[9px] font-black text-orange-700 uppercase tracking-widest mb-1">Pendientes</p>
               <div className="flex items-center space-x-2">
                 <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-black shadow-sm">?</div>
                 <div>
                   <p className="text-2xl font-black text-slate-800 leading-none">{pendientes}</p>
                   <p className="text-[9px] font-bold text-orange-500 mt-0.5">{pct(pendientes)}% del total</p>
                 </div>
               </div>
            </div>
            
            {/* 5. VENCIDOS */}
            <div onClick={() => setDashFiltroEstado('Vencido')} className={`bg-white p-4 rounded-2xl border shadow-sm flex flex-col justify-center relative overflow-hidden cursor-pointer transition-all hover:scale-105 ${dashFiltroEstado === 'Vencido' ? 'border-red-500 ring-4 ring-red-500/20' : 'border-red-200 hover:border-red-500'}`}>
               <p className="text-[9px] font-black text-red-700 uppercase tracking-widest mb-1">Vencidos</p>
               <div className="flex items-center space-x-2">
                 <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-black shadow-sm animate-pulse">!</div>
                 <div>
                   <p className="text-2xl font-black text-slate-800 leading-none">{vencidos}</p>
                   <p className="text-[9px] font-bold text-red-500 mt-0.5">{pct(vencidos)}% del total</p>
                 </div>
               </div>
            </div> 
            
            {/* 6. CUMPLIMIENTO */}
            <div onClick={() => setDashFiltroEstado('Cerrado')} className={`bg-white p-4 rounded-2xl border shadow-sm flex flex-col justify-center relative overflow-hidden cursor-pointer transition-all hover:scale-105 ${dashFiltroEstado === 'Cerrado' ? 'border-blue-500 ring-4 ring-blue-500/20' : 'border-blue-200 hover:border-blue-500'}`}>
               <p className="text-[9px] font-black text-blue-700 uppercase tracking-widest mb-1">Cumplimiento</p>
               <div className="flex items-center space-x-2">
                 <div className="w-9 h-9 rounded-full border-4 border-emerald-500 flex items-center justify-center text-[10px] font-black text-slate-800 shadow-sm bg-white">{cumplimientoGlobal}%</div>
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
                      { id: 'Subproceso', label: 'Vista por Subproceso', icon: '🗂️' }, // ✨ NUEVO BOTÓN
                      { id: 'Estado', label: 'Vista por Estado', icon: '🚩' },
                      { id: 'Prioridad', label: 'Vista por Prioridad', icon: '⚠️' },
                      { id: 'Responsable', label: 'Vista Responsable', icon: '👤' },
                      { id: 'Tipo de Fuente', label: 'Vista por Tipo de Fuente', icon: '📄' }
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
                    <select 
                      value={dashFiltroProceso} 
                      onChange={e => { setDashFiltroProceso(e.target.value); setDashFiltroSubproceso('Todos'); }} 
                      className="w-full text-xs border border-slate-200 rounded-lg p-2 font-bold text-slate-700 outline-none focus:border-[#0A3B32]"
                    >
                      <option value="Todos">Todos</option>
                      {[...new Set(planesEnriquecidos.map(p => p.proceso).filter(Boolean))].sort().map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Tipo de fuente</label>
                    <select value={dashFiltroFuente} onChange={event => setDashFiltroFuente(event.target.value)} className="w-full text-xs border border-slate-200 rounded-lg p-2 font-bold text-slate-700 outline-none focus:border-[#0A3B32]">
                      <option value="Todos">Todos</option>
                      {TIPOS_FUENTE_HISTORIAL.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
                    </select>
                  </div>
                  
                  {/* ✨ NUEVO: SELECTOR DE SUBPROCESO DINÁMICO */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Subproceso</label>
                    <select 
                      value={dashFiltroSubproceso} 
                      onChange={e => setDashFiltroSubproceso(e.target.value)} 
                      className="w-full text-xs border border-slate-200 rounded-lg p-2 font-bold text-slate-700 outline-none focus:border-[#0A3B32]"
                    >
                      <option value="Todos">Todos</option>
                      {[...new Set(
                        planesEnriquecidos
                          .filter(p => dashFiltroProceso === 'Todos' || p.proceso === dashFiltroProceso)
                          .map(p => p.subproceso)
                          .filter(Boolean)
                      )].sort().map(sp => (
                        <option key={sp} value={sp}>{sp}</option>
                      ))}
                    </select>
                  </div>          
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Estado</label>
                    <select value={dashFiltroEstado} onChange={e=>setDashFiltroEstado(e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg p-2 font-bold text-slate-700 outline-none focus:border-[#0A3B32]">
                      <option value="Todos">Todos</option>
                      <option value="Cerrado">Cerrado (100%)</option>
                      <option value="En Proceso">En Proceso (&gt; 0%)</option>
                      <option value="Pendiente">Pendiente (0%)</option>
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
            <div className="lg:col-span-2 flex min-h-0 flex-col gap-4">
               {gruposOrdenados.length === 0 ? (
                 <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center text-slate-400 font-bold italic">No hay planes que coincidan con los filtros.</div>
               ) : (
                 gruposOrdenados.map(grupo => {
                   const items = planesAgrupados[grupo];
                   const gCerrados = items.filter(planCerrado).length;
                   const gProceso = items.filter(p => !planCerrado(p) && !p.esVencido).length;
                   const gVencidos = items.filter(p => p.esVencido).length;
                   const gCumplimiento = items.length > 0 ? Math.round((gCerrados / items.length) * 100) : 0;
                   const isExpanded = grupoExpandido === grupo;
                   const totalPaginasGrupo = Math.max(1, Math.ceil(items.length / accionesPorPaginaDashboard));
                   const paginaActualGrupo = Math.min(paginaGrupoDashboard, totalPaginasGrupo);
                   const inicioPaginaGrupo = (paginaActualGrupo - 1) * accionesPorPaginaDashboard;
                   const accionesPaginaGrupo = items.slice(inicioPaginaGrupo, inicioPaginaGrupo + accionesPorPaginaDashboard);
                   const primeraAccionGrupo = inicioPaginaGrupo + 1;
                   const ultimaAccionGrupo = Math.min(inicioPaginaGrupo + accionesPorPaginaDashboard, items.length);
                   const panelId = `planes-grupo-${encodeURIComponent(grupo)}`;

                   return (
                     <div key={grupo} className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all ${isExpanded ? 'flex min-h-0 flex-1 flex-col' : ''}`}>
                       <div
                         role="button"
                         tabIndex={0}
                         aria-expanded={isExpanded}
                         aria-controls={panelId}
                         onClick={() => { setGrupoExpandido(isExpanded ? null : grupo); setPaginaGrupoDashboard(1); }}
                         onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setGrupoExpandido(isExpanded ? null : grupo); setPaginaGrupoDashboard(1); } }}
                         className={`p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${isExpanded ? 'border-b border-slate-100 bg-slate-50/50' : ''}`}
                       >
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
                         <div id={panelId} className="flex min-h-0 flex-1 flex-col p-4 sm:p-5 bg-white animate-in slide-in-from-top-2 duration-300">
                           <div className="grid grid-cols-5 gap-2 mb-4 border-b pb-4 text-center text-[10px] font-black text-slate-400 uppercase">
                             <div><p>Cerrados</p><p className="text-base text-emerald-600 font-black mt-0.5">{gCerrados}</p></div>
                             <div className="border-l"><p>En Proceso</p><p className="text-base text-amber-500 font-black mt-0.5">{gProceso}</p></div>
                             <div className="border-l"><p>Vencidos</p><p className="text-base text-red-500 font-black mt-0.5">{gVencidos}</p></div>
                             <div className="border-l col-span-2 bg-slate-50 rounded-xl p-1"><p>Cumplimiento</p><p className="text-base text-emerald-700 font-black mt-0.5">{gCumplimiento}%</p></div>
                           </div>
<div className="min-h-0 flex-1 overflow-auto">
  <table className="w-full text-[10px] text-left">
    <thead className="text-slate-400 uppercase tracking-widest border-b border-slate-100">
      <tr>
        <th className="pb-2 font-bold">Plan</th>
        <th className="pb-2 font-bold">Actividad Remedial</th>
        <th className="pb-2 font-bold">Proceso</th>
        <th className="pb-2 font-bold text-center">Prioridad</th>
        <th className="pb-2 font-bold text-center">Vencimiento</th>
        <th className="pb-2 font-bold text-center">Último Envío</th>
        <th className="pb-2 font-bold text-right">Avance / Reclamo</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-50">
      {accionesPaginaGrupo.map(p => {
        const asuntoReclamo = encodeURIComponent(`❌ URGENTE: Plan VENCIDO (PLA-${p.id.toString().slice(-4)})`);
        const cuerpoReclamo = encodeURIComponent(`Estimado/a ${p.responsable || 'Líder'},\n\nLe recordamos que el plan de acción: "${p.accion}" venció el ${p.fecha}.\n\nPor favor ingrese a la plataforma para actualizar el estado.\n\nAtentamente,\nAuditoría GCM`);

        return (
          <tr 
            key={p.id} 
            className="hover:bg-blue-50 transition-colors group/row"
          >
            <td 
              onClick={() => { setEditPlan(p); setVistaActiva('nuevo'); scrollToForm(); }}
              className="py-2.5 font-mono font-black text-slate-700 group-hover/row:text-blue-700 cursor-pointer"
            >
              PLA-{p.id.toString().slice(-4)}
            </td>
            <td 
              onClick={() => { setEditPlan(p); setVistaActiva('nuevo'); scrollToForm(); }}
              className="py-2.5 font-bold text-slate-600 max-w-[140px] truncate group-hover/row:text-blue-900 cursor-pointer" 
              title={p.accion}
            >
              {p.accion}
            </td>
            <td className="py-2.5 font-medium text-slate-500 truncate max-w-[80px]">{p.proceso}</td>
            <td className="py-2.5 text-center">
              <span className={`px-1.5 py-0.5 rounded-md font-black text-[8px] border ${p.severidad === 'Crítico' ? 'bg-red-50 text-red-600 border-red-200' : p.severidad === 'Alto' ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>{p.severidad}</span>
            </td>
            <td className={`py-2.5 text-center font-bold ${p.esVencido ? 'text-red-500' : 'text-slate-400'}`}>{p.fecha || 'N/A'}</td>

            {/* 🕒 TRAZABILIDAD: FECHA DEL ÚLTIMO CORREO */}
            <td className="py-2.5 text-center">
              {p.ultimoRecordatorio ? (
                <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-mono font-bold" title="Último correo enviado">
                  ✉️ {p.ultimoRecordatorio}
                </span>
              ) : (
                <span className="text-[9px] text-slate-300 italic">Sin notificar</span>
              )}
            </td>

            {/* 📧 ACCIÓN: BOTÓN DE RECLAMO Y AVANCE */}
            <td className="py-2.5 text-right font-black flex items-center justify-end space-x-2">
              <span>{p.progreso}%</span>
              {p.esVencido && puedeReclamarPlan(p) && (
                <a 
                  href={`https://mail.google.com/mail/?view=cm&fs=1&to=${p.correoResponsable || ''}&su=${asuntoReclamo}&body=${cuerpoReclamo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleNotificarPlan(p.id)}
                  className="bg-red-600 hover:bg-red-700 text-white text-[8px] font-black px-2 py-1 rounded-md uppercase tracking-wider shadow-sm transition-all hover:scale-105 inline-flex items-center gap-1 ml-1"
                  title={`Enviar correo de reclamo a ${p.responsable}`}
                >
                  ✉️ Reclamar
                </a>
              )}
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
</div>
                           <div className="mt-auto flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                             <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-slate-600">
                               <span aria-live="polite">Mostrando <strong className="text-slate-800">{primeraAccionGrupo}-{ultimaAccionGrupo}</strong> de <strong className="text-slate-800">{items.length}</strong> acciones</span>
                               <label className="flex items-center gap-2 font-medium">
                                 Acciones por página
                                 <select value={accionesPorPaginaDashboard} onChange={event => { setAccionesPorPaginaDashboard(Number(event.target.value)); setPaginaGrupoDashboard(1); }} aria-label={`Acciones por página para ${grupo}`} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                   <option value={10}>10</option>
                                   <option value={15}>15</option>
                                   <option value={20}>20</option>
                                   <option value={30}>30</option>
                                   <option value={50}>50</option>
                                 </select>
                               </label>
                             </div>
                             {totalPaginasGrupo > 1 && (
                               <nav className="flex items-center justify-between gap-2 sm:justify-end" aria-label={`Paginación de acciones de ${grupo}`}>
                                 <button type="button" onClick={() => setPaginaGrupoDashboard(Math.max(1, paginaActualGrupo - 1))} disabled={paginaActualGrupo <= 1} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40">Anterior</button>
                                 <span className="min-w-24 text-center text-xs font-semibold tabular-nums text-slate-600" aria-live="polite">Página {paginaActualGrupo} de {totalPaginasGrupo}</span>
                                 <button type="button" onClick={() => setPaginaGrupoDashboard(Math.min(totalPaginasGrupo, paginaActualGrupo + 1))} disabled={paginaActualGrupo >= totalPaginasGrupo} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40">Siguiente</button>
                               </nav>
                             )}
                           </div>
                         </div>
                       )}
                     </div>
                   );
                 })
               )}
            </div>

            {/* 3. Columna derecha: detalle de alertas o distribución del portafolio */}
            <div id="planes-task-detail" tabIndex={-1} className={`lg:col-span-1 rounded-2xl border bg-white p-5 h-fit sticky top-24 transition-all duration-300 ${detallePanelPlanes === 'aprobacion' ? 'border-emerald-500 ring-4 ring-emerald-300 shadow-xl shadow-emerald-100' : detallePanelPlanes === 'revision' ? 'border-amber-400 ring-2 ring-amber-300 shadow-lg shadow-amber-100' : detallePanelPlanes === 'ejecucion' ? 'border-rose-400 ring-2 ring-rose-300 shadow-lg shadow-rose-100' : 'border-slate-200 shadow-sm'}`}>
{detallePanelPlanes ? (() => {
                const esEjecucion = detallePanelPlanes === 'ejecucion';
                const esRevision = detallePanelPlanes === 'revision';
                const esAprobacion = detallePanelPlanes === 'aprobacion';
                const esVencido = detallePanelPlanes === 'vencidos';
                
                const planesRevisionFiltrados = esRevision
                  ? misPlanesRevision.map(plan => planesEnriquecidos.find(enriquecido => String(enriquecido.id) === String(plan.id)) || plan)
                  : [];

                const planesAprobacionFiltrados = esAprobacion
                  ? misPlanesAprobacion.map(plan => planesEnriquecidos.find(enriquecido => String(enriquecido.id) === String(plan.id)) || plan)
                  : [];

                const planesDetalle = esEjecucion
                  ? misPlanesEjecucion.map(plan => planesEnriquecidos.find(enriquecido => String(enriquecido.id) === String(plan.id)) || plan)
                  : esRevision
                    ? planesRevisionFiltrados
                    : esAprobacion
                      ? planesAprobacionFiltrados
                      : esVencido ? planesVencidosNotificables : planesEnAlerta;
                
                return (
                  <>
                    <div className={`flex items-start justify-between gap-3 border-b pb-3 mb-3 ${esVencido || esEjecucion ? 'border-rose-100' : esRevision ? 'border-amber-100' : esAprobacion ? 'border-emerald-100' : 'border-orange-100'}`}>
                      <div>
                        <h3 className={`text-xs font-black uppercase tracking-wide ${esVencido || esEjecucion ? 'text-rose-800' : esRevision ? 'text-amber-800' : esAprobacion ? 'text-emerald-800' : 'text-orange-800'}`}>
                          {esEjecucion ? 'Planes por ejecutar' : esRevision ? 'Planes por revisar' : esAprobacion ? 'Planes por aprobar' : esVencido ? 'Planes vencidos' : 'Próximos a vencer'}
                        </h3>
                        <p className="text-[10px] text-slate-500 mt-1">
                          {planesDetalle.length} {esEjecucion ? 'acciones por ejecutar o corregir' : esRevision ? 'planes esperando tu Visto Bueno' : esAprobacion ? 'diseños o evidencias por aprobar' : 'casos para verificar'}
                        </p>
                      </div>
                      <button type="button" onClick={() => setDetallePanelPlanes(null)} aria-label="Cerrar detalle de planes" className="text-slate-400 hover:text-slate-800 text-lg leading-none">×</button>
                    </div>
                    <div className="max-h-[62vh] overflow-y-auto space-y-2 pr-1">
                      {planesDetalle.map(plan => (
                        <article key={`alert-detail-${plan.id}`} className={`border rounded-lg p-3 ${esVencido || esEjecucion ? 'border-rose-100 bg-rose-50/40' : esRevision ? 'border-amber-100 bg-amber-50/40' : esAprobacion ? 'border-emerald-100 bg-emerald-50/40' : 'border-orange-100 bg-orange-50/40'}`}>
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-mono text-[9px] font-black text-slate-500">PLA-{String(plan.id).slice(-4)}</span>
                            <span className={`text-[9px] font-black ${esVencido || esEjecucion ? 'text-rose-700' : esRevision ? 'text-amber-700' : esAprobacion ? 'text-emerald-700' : 'text-orange-700'}`}>
                              {esVencido ? `Venció ${plan.fecha || 'sin fecha'}` : esEjecucion || esRevision || esAprobacion ? plan.estadoWorkflow : `Vence ${plan.fecha || 'sin fecha'}`}
                            </span>
                          </div>
                          <h4 className="text-xs font-black text-slate-800 mt-1.5 break-words">{plan.accion || 'Acción sin descripción'}</h4>
                          <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 mt-2 text-[10px] text-slate-600">
                            <dt className="font-bold">Proceso</dt><dd className="break-words">{plan.proceso || 'General'}{plan.sede ? ` · ${plan.sede}` : ''}</dd>
                            <dt className="font-bold">Ejecutor</dt><dd className="break-words">{plan.responsable || 'No asignado'}</dd>
                            {esEjecucion && <><dt className="font-bold">Correo</dt><dd className="break-all">{plan.correoResponsable || 'No registrado'}</dd></>}
                            <dt className="font-bold">Avance</dt><dd>{Number(plan.progreso) || 0}%</dd>
                          </dl>
                          <button type="button" onClick={() => {
                            if (esAprobacion) {
                              if (esPlanProgramaAuditoria(plan) && pendienteEvaluacionInicial(plan)) {
                                const informe = informesAuditoria.find(item => String(item.id) === String(plan.idInforme));
                                iniciarEvaluacionIntegral(informe, planesEnriquecidos.filter(item => String(item.idInforme) === String(plan.idInforme)));
                              } else abrirEvaluacionAccion(plan);
                              return;
                            }
                            const hallazgo = safeHallazgos.find(item => String(item.id) === String(plan.idHallazgo));
                            const informeId = String(plan.idInforme || hallazgo?.idInforme || '');
                            setEditPlan(null);
                            setVistaActiva('historial');
                            setInformePlanesExpandido(informeId);
                            setDetallePanelPlanes(null);
                            window.setTimeout(() => {
                              document.getElementById(`plan-completo-${informeId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }, 80);
                          }} className={`mt-2 text-[10px] font-black underline underline-offset-2 ${esEjecucion ? 'text-rose-700 hover:text-rose-900' : 'text-blue-700 hover:text-blue-900'}`}>
                            {esAprobacion ? 'Evaluar aprobación' : 'Abrir matriz'}
                          </button>
                        </article>
                      ))}
                    </div>
                  </>
                );
              })() : (
                <>
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 border-b pb-2">Distribución por prioridad</h3>
                <div className="flex items-center justify-center mb-6">
                   <div className="relative w-36 h-36 rounded-full border-[14px] border-emerald-500 border-l-red-500 border-t-red-500 border-r-orange-500 border-b-amber-500 flex items-center justify-center transform -rotate-45 shadow-inner">
                      <div className="transform rotate-45 text-center">
                         <span className="block text-3xl font-black text-slate-800 leading-none">{totalPlanesReactivo}</span>
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
                            <div className="bg-[#0A3B32] h-full rounded-full" style={{width: `${totalPlanesReactivo > 0 ? (count/totalPlanesReactivo)*100 : 0}%`}}></div>
                          </div>
                          <span className="w-6 text-right font-black text-slate-800">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🚀 VISTA 2: FORMULARIO MATRICIAL ORIGINAL COMPLETO (PRESERVADO Y RE-POTENCIADO) */}
      {vistaActiva === 'nuevo' && (
        <div id="edit-form" className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-6 animate-in fade-in duration-500 relative">
          
          {modoRevisionMatriz && (
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl shadow-sm mb-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-amber-500 text-lg">👁️</span>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-black text-amber-800 uppercase tracking-widest">{modoValidacionFinalRevisor ? 'Validación de ejecución al 100% (Solo Lectura)' : 'Modo Revisión de Diseño (Solo Lectura)'}</h3>
                  <div className="mt-1 text-xs text-amber-700 font-medium">
                    {modoValidacionFinalRevisor
                      ? 'Verifica las evidencias y el resultado de la ejecución. Si está conforme, envía la acción al aprobador final; si no, devuélvela al ejecutor para ajuste.'
                      : 'Estás visualizando el diseño del plan en modo de solo lectura. Revisa la acción y utiliza los botones al final para aprobarla o solicitar correcciones.'}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="w-full">
            <div className="flex justify-between items-center mb-1.5">
              <label className="font-black text-gray-700 text-xs">1. Seleccione el Informe Emitido Evaluado</label>
              {formInformeId && !modoRevisionMatriz && (
                <button type="button" onClick={() => handleInformeChange('')} className="text-[10px] text-red-500 hover:text-red-700 font-bold uppercase transition-colors px-2 py-0.5 border border-red-200 rounded-md bg-red-50 cursor-pointer">
                  ✖️ Limpiar Matriz
                </button>
              )}
            </div>
            <select disabled={modoRevisionMatriz} value={formInformeId} onChange={(e) => handleInformeChange(e.target.value)} className={`w-full border-2 border-slate-300 rounded-xl p-3 bg-white font-black text-slate-800 focus:ring-2 focus:ring-blue-600 outline-none text-xs shadow-sm ${modoRevisionMatriz ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}>
              <option value="">-- Seleccione el Informe de Auditoría Radicado --</option>
              {informesOrdenadosPorFecha.map((inf) => <option key={inf.id} value={inf.id}>[{inf.ref}] {inf.titulo} — ({inf.proceso})</option>)}
            </select>
          </div>

          {formInformeId && (
<form id="matrix-master-form" onChangeCapture={() => setMatrixDirty(true)} onSubmit={handleMasterMatrixSubmit} className="space-y-6">
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
      
      {/* ⚖️ ETIQUETA INTELIGENTE DE RIESGO EMERGENTE */}
      <span className={`px-2 py-0.5 font-black rounded text-[9px] uppercase tracking-wider border ${
        h.claseObservacion === 'Riesgo Emergente' || h.isEmergente || h.claseObservacion?.toLowerCase().includes('emergente')
          ? 'bg-amber-100 text-amber-900 border-amber-400 animate-pulse'
          : 'bg-amber-50 text-amber-800 border-amber-200'
      }`}>
        {h.claseObservacion === 'Riesgo Emergente' || h.isEmergente || h.claseObservacion?.toLowerCase().includes('emergente')
          ? '⚠️ Riesgo Emergente (Incluir en Matriz)' 
          : `⚖️ Clase: ${h.claseObservacion || 'Hallazgo'}`}
      </span>
    </div>
    <h4 className="text-xs font-black text-slate-900 mt-2">{h.titulo}</h4>
  </div>
                      {(!modoRevisionMatriz) && (
                        <div className="flex items-center space-x-1 shrink-0 bg-white p-1 rounded-lg border shadow-sm">
                          <button type="button" onClick={() => handleToggleAplica(h.id, true)} className={`px-3 py-1.5 rounded-md font-bold text-[10px] uppercase ${node.aplica ? 'bg-blue-600 text-white shadow-sm':'text-slate-500 hover:bg-slate-100'}`}>Sí Aplica</button>
                          <button type="button" onClick={() => handleToggleAplica(h.id, false)} className={`px-3 py-1.5 rounded-md font-bold text-[10px] uppercase ${!node.aplica ? 'bg-slate-400 text-white shadow-sm':'text-slate-500 hover:bg-slate-100'}`}>No Aplica</button>
                        </div>
                      )}
                    </div>

                    {node.aplica && (
                      <div className="space-y-5">
{Array.isArray(node?.actividades) && node.actividades.map((act, index) => {
  const actividadNueva = String(act.id).startsWith('new-');
  const planOriginal = actividadNueva ? null : safePlanes.find(plan => String(plan.id) === String(act.id));
  const informeDeActividad = informesAuditoria.find(informe => (
    String(informe.id) === String(formInformeId) ||
    String(informe.ref || '').trim().toLowerCase() === String(formInformeId).trim().toLowerCase()
  ));
  const correoActual = String(user?.email || '').trim().toLowerCase();
  const correoAuditorOriginal = planOriginal?.correoAuditor || informeDeActividad?.correoAuditor || informeDeActividad?.correoAuditorResponsable || '';
  const correoAuditorAsignado = act.correoAuditor || correoAuditorOriginal;
  const conflictoRoles = obtenerConflictoRolesPlan({
    correoResponsable: act.correoResponsable,
    correoRevisor: act.correoRevisor,
    correoAuditor: correoAuditorAsignado,
  });
  const cambiaAsignacionRoles = actividadNueva ||
    normalizarIdentidad(act.correoResponsable) !== normalizarIdentidad(planOriginal?.correoResponsable) ||
    normalizarIdentidad(act.correoRevisor) !== normalizarIdentidad(planOriginal?.correoRevisor) ||
    normalizarIdentidad(correoAuditorAsignado) !== normalizarIdentidad(correoAuditorOriginal);
  const esResponsableActividad = !actividadNueva && correoActual && String(act.correoResponsable || '').trim().toLowerCase() === correoActual;
  const programaActividad = esFuenteProgramaAuditoria(informeDeActividad);
  const bloqueadaPorAuditor = programaActividad && !actividadNueva && disenoInicialBloqueado(act);
  const puedeEditarActividad = !modoRevisionMatriz && (isAdmin || actividadNueva || (esResponsableActividad &&
    (!bloqueadaPorAuditor || act.estadoWorkflow === ESTADO_AJUSTES_INICIALES)));
  const puedeEditarAsignacion = !modoRevisionMatriz && (isAdmin || actividadNueva);
  const puedeEditarCorreo = !modoRevisionMatriz && (isAdmin || actividadNueva || esResponsableActividad);
  const puedeEditarCorreoAuditor = !modoRevisionMatriz && (!actividadNueva && (isAdmin || esResponsableActividad));
  const puedeEditarAvance = !modoRevisionMatriz && !actividadNueva && !bloqueadaPorAuditor && (isAdmin || (
    esResponsableActividad && act.estadoWorkflow === 'En Ejecución'
  ));
  return (
                          <fieldset key={`act-row-${index}`} disabled={!puedeEditarActividad} className="contents">
                          {!modoRevisionMatriz && !isAdmin && !actividadNueva && !esResponsableActividad && (
                            <div role="note" className="md:col-span-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-950">
                              <strong>Edición bloqueada por correo:</strong> esta acción está asignada a {act.correoResponsable || 'un correo no registrado'}, pero tu sesión es {user?.email || 'un usuario sin correo'}. Solicita a un administrador que actualice el correo del ejecutor para que coincida con la cuenta con la que inicias sesión.
                            </div>
                          )}
                          {!modoRevisionMatriz && conflictoRoles && cambiaAsignacionRoles && (
                            <div role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-900 md:col-span-6">
                              No se puede guardar: el correo se repite entre {conflictoRoles}. Asigna personas distintas; el auditor se hereda del informe.
                            </div>
                          )}
                          <div 
                            className="relative space-y-4 rounded-xl border-2 border-emerald-900/25 border-l-[8px] border-l-[#0A3B32] bg-gradient-to-br from-white via-white to-emerald-50/40 p-5 pl-6 shadow-[0_2px_8px_-3px_rgba(15,23,42,0.16)] ring-1 ring-emerald-900/5 transition-colors hover:border-emerald-900/40"
                          >
                            {/* CABECERA SUTIL DE LA ACTIVIDAD */}
                            <div className="flex justify-between items-center border-b border-emerald-900/15 bg-gradient-to-r from-emerald-50 to-white -ml-6 -mr-5 -mt-5 px-5 py-3 rounded-tr-lg rounded-tl-md mb-4">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 text-[11px] font-black text-[#0A3B32] uppercase tracking-widest">
                                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0A3B32] text-xs font-black text-white shadow-sm">{index + 1}</span>
                                  <span>Actividad</span>
                                </div>
                                <span className={`px-2.5 py-0.5 rounded-md font-mono font-bold text-[10px] tracking-widest border shadow-sm transition-colors ${String(act.id).startsWith('new-') ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-slate-500 border-slate-200'}`}>
                                  PLA-{String(act.id).startsWith('new-') ? 'NUEVO' : String(act.id).slice(-4)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {!modoRevisionMatriz && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={Boolean(guardandoAccionKey) || uploadingCell === `${h.id}-${index}`}
                                      onClick={() => guardarAccionIndividual(h.id, index)}
                                      className="bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50 hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 font-black text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
                                      title="Guarda únicamente esta acción"
                                    >
                                      {guardandoAccionKey === `${h.id}-${index}`
                                        ? 'Guardando…'
                                        : uploadingCell === `${h.id}-${index}`
                                          ? 'Subiendo evidencia…'
                                          : <><span>💾</span> Guardar acción</>}
                                    </button>
                                    {node.actividades.length > 1 && (isAdmin || actividadNueva) && (
                                      <button type="button" onClick={() => handleRemoveActivity(h.id, index)} className="text-red-400 hover:text-red-600 hover:bg-red-50 font-bold text-[10px] uppercase px-3 py-1.5 rounded-lg transition-colors">
                                        🗑️ Quitar
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-6 gap-3 text-xs">
                              
                             {/* CAMPO A1: TIPO DE ACCIÓN (NUEVO - 2 COLUMNAS) */}
                              <div className="md:col-span-2">
                                <div className="flex items-center justify-between mb-1">
                                  <label className="font-bold text-[#0A3B32] block">Tipo de Acción</label>
                                  <span className="text-slate-400 text-[10px] cursor-help" title="Clasificación metodológica de la acción a tomar">❔</span>
                                </div>
                                <select 
                                  value={act.tipoAccion || 'Acción Correctiva'} 
                                  onChange={(e) => handleUpdateActivityField(h.id, index, 'tipoAccion', e.target.value)} 
                                  className="w-full border border-emerald-200 p-2.5 rounded-lg font-bold text-emerald-800 bg-[#f0fdf4] focus:bg-white shadow-sm outline-none focus:border-[#0A3B32] cursor-pointer"
                                >
                                  <option value="Contención">Contención (Corrección Inmediata)</option>
                                  <option value="Acción Correctiva">Acción Correctiva (Ataca Causa Raíz)</option>
                                  <option value="Acción Preventiva">Acción Preventiva (Mitiga Riesgos)</option>
                                  <option value="Iniciativa de Mejora">Iniciativa de Mejora Continua</option>
                                </select>
                              </div>

                              {/* CAMPO A2: DESCRIPCIÓN (AJUSTADO A 4 COLUMNAS) */}
                              <div className="md:col-span-4">
                                <label className="font-bold text-gray-500 block mb-1">Descripción de la Tarea / Actividad</label>
                                <textarea 
                                  value={act.accion} 
                                  onChange={(e) => handleUpdateActivityField(h.id, index, 'accion', e.target.value)} 
                                  className="w-full border border-slate-300 p-2.5 rounded-lg font-medium bg-slate-50 focus:bg-white text-slate-800 resize-y shadow-sm outline-none focus:border-[#0A3B32]" 
                                  rows="2"
                                  placeholder="Describa la acción detalladamente..."
                                  required 
                                />
                              </div>
                              
{/* --- INICIO SECTOR MÚLTIPLE: SEDE --- */}
                              {(() => {
                                const sedesActuales = act.sede ? act.sede.split(',').map(s => s.trim()).filter(Boolean) : [];

                                return (
                                  <>
                                    {/* CAMPO S1: SEDES MÚLTIPLES */}
                                    <div className="md:col-span-2 bg-slate-50 p-2 rounded-lg border border-slate-200 flex flex-col justify-start">
                                      <label className="font-bold text-slate-700 block mb-1 text-[10px]">🏢 Sedes</label>
                                      <select 
                                        value="" 
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          if(val && !sedesActuales.includes(val)) {
                                            const nuevasSedes = [...sedesActuales, val].join(', ');
                                            handleUpdateActivityField(h.id, index, 'sede', nuevasSedes);
                                          }
                                        }} 
                                        className="w-full border border-slate-300 p-1.5 rounded bg-white font-bold text-slate-700 cursor-pointer shadow-sm text-[10px] outline-none"
                                      >
                                        <option value="">-- Añadir Sede --</option>
                                        {sedesEmpresa.map(s => <option key={s} value={s} disabled={sedesActuales.includes(s)}>{s}</option>)}
                                      </select>
                                      <div className="flex flex-wrap gap-1 mt-1.5">
                                        {sedesActuales.length === 0 && <span className="text-[9px] text-slate-400 italic">Ninguna...</span>}
                                        {sedesActuales.map(s => (
                                          <span key={s} className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center shadow-sm">
                                            {s} 
                                            <button type="button" onClick={() => {
                                              const filtrado = sedesActuales.filter(item => item !== s).join(', ');
                                              handleUpdateActivityField(h.id, index, 'sede', filtrado);
                                            }} className="ml-1 text-indigo-400 hover:text-indigo-600 font-black">✕</button>
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </>
                                );
                              })()}
                              {/* --- FIN SECTOR MÚLTIPLE --- */}
                              
{/* ✨ CAMPO C: AUDITOR Y CORREO - HEREDADOS Y BLOQUEADOS */}
<div className="md:col-span-2">
  <label className="font-bold text-blue-600 block mb-0.5">🛡️ Auditor de Seguimiento (APROBADOR)</label>
  <input 
    type="text" 
    value={act.auditorAsignado || 'No asignado'} 
    disabled 
    title="Este dato se hereda automáticamente del Informe de Auditoría"
    className="w-full border border-blue-200 p-2 rounded-lg font-black text-blue-900 bg-blue-50/50 cursor-not-allowed shadow-inner" 
  />
</div>
                              <div className="md:col-span-2">
<label className="font-bold text-blue-600 block mb-0.5">✉️ Correo del Auditor de Seguimiento (APROBADOR)</label>
                                <input 
                                  type="email" 
                                  value={act.correoAuditor || ''} 
                                  onChange={(e) => handleUpdateActivityField(h.id, index, 'correoAuditor', e.target.value)}
                                  disabled={!puedeEditarCorreoAuditor}
                                  title="Este dato se hereda automáticamente del Informe de Auditoría"
                                  className="w-full border border-blue-200 p-2 rounded-lg font-black text-blue-900 bg-blue-50/50 disabled:cursor-not-allowed shadow-inner" 
                                />
                              </div>
                            {/* ROLES DE EJECUCIÓN Y REVISIÓN CON VALIDACIÓN VISUAL */}
                              {(() => {
                                const correoEjecutor1 = (act.correoResponsable || '').trim().toLowerCase();
                                const correoEjecutor2 = (act.correoConfirmacion || '').trim().toLowerCase();
                                const ejecutorCoincide = correoEjecutor1 === correoEjecutor2;
                                const mostrarAlertaEjecutor = correoEjecutor2.length > 0 && !ejecutorCoincide;

                                const correoRevisor1 = (act.correoRevisor || '').trim().toLowerCase();
                                const correoRevisor2 = (act.correoRevisorConfirmacion || '').trim().toLowerCase();
                                const revisorCoincide = correoRevisor1 === correoRevisor2;
                                const mostrarAlertaRevisor = correoRevisor2.length > 0 && !revisorCoincide;

                                return (
                                  <>
                                    <div className="md:col-span-2">
                                      <label className="font-bold text-purple-700 block mb-0.5">👷 Quien EJECUTA la Acción (Cargo)</label>
                                      <select 
                                        value={act.responsable || ''} 
                                        onChange={(e) => handleUpdateActivityField(h.id, index, 'responsable', e.target.value)} 
                                        disabled={!puedeEditarAsignacion}
                                        className="w-full border border-purple-200 p-2 rounded-lg font-bold text-purple-900 bg-purple-50 focus:bg-white shadow-sm outline-none cursor-pointer" 
                                        required
                                      >
                                        <option value="">-- Asignar Ejecutor --</option>
                                        {CARGOS_EMPRESA.map((cargo, i) => <option key={`resp-${i}`} value={cargo}>{cargo}</option>)}
                                      </select>
                                    </div>
                                    <div className="md:col-span-2">
                                      <label className="font-bold text-purple-700 block mb-0.5">📧 Correo de quien EJECUTA</label>
                                      <input 
                                        type="email" 
                                        value={act.correoResponsable || ''} 
                                        onChange={(e) => handleUpdateActivityField(h.id, index, 'correoResponsable', e.target.value)} 
                                        disabled={!puedeEditarCorreo}
                                        placeholder="Correo del responsable" 
                                        className="w-full border border-purple-200 p-2 rounded-lg bg-purple-50 focus:bg-white shadow-sm outline-none" 
                                        required 
                                      />
                                    </div>
                                    <div className="md:col-span-2">
                                      <label className="font-bold text-purple-700 block mb-0.5 flex justify-between">
                                        <span>✓ Confirmar correo</span>
                                        {mostrarAlertaEjecutor && <span className="text-red-500 font-black animate-pulse">NO COINCIDE</span>}
                                      </label>
                                      <input 
                                        type="email" 
                                        value={act.correoConfirmacion || ''} 
                                        onChange={(e) => handleUpdateActivityField(h.id, index, 'correoConfirmacion', e.target.value)} 
                                        disabled={!puedeEditarCorreo}
                                        placeholder="Confirme el correo" 
                                        className={`w-full border p-2 rounded-lg shadow-sm outline-none transition-colors ${mostrarAlertaEjecutor ? 'border-red-500 bg-red-50 text-red-900 focus:ring-2 focus:ring-red-500' : 'border-purple-200 bg-purple-50 focus:bg-white focus:ring-2 focus:ring-purple-400'}`} 
                                        required 
                                      />
                                    </div>

                                    <div className="md:col-span-2">
                                      <label className="font-bold text-amber-600 block mb-0.5">👀 Quien REVISA la Acción (Cargo)</label>
                                      <select 
                                        value={act.revisor || ''} 
                                        onChange={(e) => handleUpdateActivityField(h.id, index, 'revisor', e.target.value)} 
                                        disabled={!puedeEditarAsignacion}
                                        className="w-full border border-amber-200 p-2 rounded-lg font-bold text-amber-900 bg-amber-50 focus:bg-white cursor-pointer shadow-sm outline-none" 
                                        required
                                      >
                                         <option value="">-- Asignar Revisor --</option>
                                        {CARGOS_EMPRESA.map((cargo, i) => <option key={`rev-${i}`} value={cargo}>{cargo}</option>)}
                                      </select>
                                    </div>
                                    <div className="md:col-span-2">
                                      <label className="font-bold text-amber-600 block mb-0.5">✉️ Correo del Revisor</label>
                                      <input 
                                        type="email" 
                                        value={act.correoRevisor || ''} 
                                        onChange={(e) => handleUpdateActivityField(h.id, index, 'correoRevisor', e.target.value)} 
                                        disabled={!puedeEditarCorreo}
                                        placeholder="Correo de Jefatura" 
                                        className="w-full border border-amber-200 p-2 rounded-lg font-bold text-amber-900 bg-amber-50 focus:bg-white shadow-sm outline-none" 
                                        required
                                      />
                                    </div>
                                    <div className="md:col-span-2">
                                      <label className="font-bold text-amber-600 block mb-0.5 flex justify-between">
                                        <span>✓ Confirmar correo Revisor</span>
                                        {mostrarAlertaRevisor && <span className="text-red-500 font-black animate-pulse">NO COINCIDE</span>}
                                      </label>
                                      <input 
                                        type="email" 
                                        value={act.correoRevisorConfirmacion || ''} 
                                        onChange={(e) => handleUpdateActivityField(h.id, index, 'correoRevisorConfirmacion', e.target.value)} 
                                        disabled={!puedeEditarCorreo}
                                        placeholder="Confirme correo Jefatura" 
                                        className={`w-full border p-2 rounded-lg font-bold shadow-sm outline-none transition-colors ${mostrarAlertaRevisor ? 'border-red-500 bg-red-50 text-red-900 focus:ring-2 focus:ring-red-500' : 'border-amber-200 bg-amber-50 focus:bg-white focus:ring-2 focus:ring-amber-400'}`} 
                                        required
                                      />
                                    </div>
                                  </>
                                );
                              })()}
                              <div className="md:col-span-1">
                                <label className="font-bold text-gray-500 block mb-0.5">Avance ({act.progreso}%)</label>
                                <input type="number" min="0" max="100" step="1" value={actividadNueva ? 0 : act.progreso ?? 0} disabled={!puedeEditarAvance} onChange={(e) => handleUpdateActivityField(h.id, index, 'progreso', e.target.value === '' ? '' : Number(e.target.value))} className="w-full border p-2 rounded-lg font-black text-blue-700 bg-blue-50 disabled:bg-slate-100 disabled:text-slate-500" />
                              </div>
                              <div className="md:col-span-1">
                                <label className="font-bold text-gray-500 block mb-0.5">Fecha Inicio</label>
                                <input type="date" value={act.fechaInicio} onChange={(e) => handleUpdateActivityField(h.id, index, 'fechaInicio', e.target.value)} className="w-full border p-1.5 rounded-lg" />
                              </div>
                              <div className="md:col-span-1">
                                <label className="font-bold text-gray-500 block mb-0.5">Fecha Límite</label>
                                <input type="date" value={act.fecha} onChange={(e) => handleUpdateActivityField(h.id, index, 'fecha', e.target.value)} className="w-full border p-1.5 rounded-lg" />
                              </div>
                              <div className="md:col-span-3 bg-slate-50 border border-slate-200 p-2 rounded-xl flex flex-col justify-between shadow-inner">
                                <label className="font-black text-slate-700 block mb-2 text-[10px] uppercase">☁️ Soportes y Evidencias Múltiples</label>
                                
                                <div className="flex flex-col gap-1.5 mb-2">
                                  {(() => {
                                    // Comprobamos si hay evidencias y las volvemos un arreglo seguro
                                    const evidencias = Array.isArray(act.evidenciaUrl) ? act.evidenciaUrl : (act.evidenciaUrl ? [act.evidenciaUrl] : []);
                                    
                                    if (evidencias.length === 0 && uploadingCell !== `${h.id}-${index}`) {
                                      return <span className="text-[9px] text-slate-400 italic mb-1">Aún no hay soportes cargados...</span>;
                                    }
                                    
                                    // Listamos todos los archivos cargados
                                    return evidencias.map((url, i) => (
                                      <div key={i} className="flex justify-between items-center bg-white border border-slate-200 p-1.5 rounded-lg shadow-sm">
                                        <a href={url} target="_blank" rel="noreferrer" className="text-[10px] text-emerald-700 font-black truncate hover:underline max-w-[80%]" title={url}>
                                          ✅ Soporte #{i + 1}
                                        </a>
                                        {!modoRevisionMatriz && (
                                          <button type="button" onClick={async () => {
                                            if (!(await confirmarEliminacion(`Se quitará el soporte #${i + 1} de esta acción. Esta operación retira su vínculo; no borra el archivo del repositorio.`))) return;
                                            const nuevas = evidencias.filter((_, idx) => idx !== i);
                                            handleUpdateActivityField(h.id, index, 'evidenciaUrl', nuevas);
                                          }} className="text-red-500 hover:bg-red-50 font-bold text-[10px] px-2 rounded transition-colors" title="Borrar este soporte">✕</button>
                                        )}
                                      </div>
                                    ));
                                  })()}
                                  
                                  {/* Mensaje de carga */}
                                  {uploadingCell === `${h.id}-${index}` && (
                                    <p className="text-[9px] font-bold text-amber-600 animate-pulse bg-amber-50 p-1.5 rounded-lg border border-amber-200 text-center">⏳ Subiendo archivo al servidor...</p>
                                  )}
                                </div>

                               {/* Botón que siempre queda visible para agregar más */}
                                {!modoRevisionMatriz && (
                                  <label className="cursor-pointer flex items-center justify-center w-full border-2 border-dashed border-slate-300 py-2 rounded-lg bg-white hover:bg-slate-100 transition-all mt-auto shadow-sm">
                                    <span className="text-[10px] font-bold text-slate-600">➕ Agregar Soporte Adicional</span>
                                    <input type="file" className="hidden" accept=".pdf, .jpg, .png, .docx, .xlsx, .zip" onChange={(e) => handleFileUpload(e, h.id, index, act.evidenciaUrl)} />
                                  </label>
                                )}
                              </div>

                              {/* ✨ NUEVO: SECCIÓN DE IMPACTO EN MATRICES */}
                              <div className="md:col-span-6 bg-[#f8fafa] border border-slate-200 p-4 rounded-xl shadow-sm mt-1">
                                <label className="font-black text-[#0A3B32] block mb-3 text-[10px] uppercase tracking-widest">¿Esta acción actualiza alguna de estas matrices?</label>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                  <div>
                                    <label className="font-bold text-slate-500 block mb-1 text-[10px]">Matriz de riesgos (ISO 9001)</label>
                                    <select value={act.matrizRiesgos || 'No aplica'} onChange={(e) => handleUpdateActivityField(h.id, index, 'matrizRiesgos', e.target.value)} className="w-full border border-slate-300 p-2 rounded-lg bg-white text-[11px] font-bold text-slate-700 focus:ring-2 focus:ring-[#0A3B32] outline-none cursor-pointer">
                                      <option value="No aplica">No aplica</option>
                                      <option value="Sí aplica">Sí aplica</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="font-bold text-slate-500 block mb-1 text-[10px]">Aspectos e impactos (ISO 14001)</label>
                                    <select value={act.matrizAspectos || 'No aplica'} onChange={(e) => handleUpdateActivityField(h.id, index, 'matrizAspectos', e.target.value)} className="w-full border border-slate-300 p-2 rounded-lg bg-white text-[11px] font-bold text-slate-700 focus:ring-2 focus:ring-[#0A3B32] outline-none cursor-pointer">
                                      <option value="No aplica">No aplica</option>
                                      <option value="Sí aplica">Sí aplica</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="font-bold text-slate-500 block mb-1 text-[10px]">Peligros y riesgos SST (ISO 45001)</label>
                                    <select value={act.matrizPeligros || 'No aplica'} onChange={(e) => handleUpdateActivityField(h.id, index, 'matrizPeligros', e.target.value)} className="w-full border border-slate-300 p-2 rounded-lg bg-white text-[11px] font-bold text-slate-700 focus:ring-2 focus:ring-[#0A3B32] outline-none cursor-pointer">
                                      <option value="No aplica">No aplica</option>
                                      <option value="Sí aplica">Sí aplica</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="font-bold text-slate-500 block mb-1 text-[10px]">Matriz de requisitos legales</label>
                                    <select value={act.matrizLegal || 'No aplica'} onChange={(e) => handleUpdateActivityField(h.id, index, 'matrizLegal', e.target.value)} className="w-full border border-slate-300 p-2 rounded-lg bg-white text-[11px] font-bold text-slate-700 focus:ring-2 focus:ring-[#0A3B32] outline-none cursor-pointer">
                                      <option value="No aplica">No aplica</option>
                                      <option value="Sí aplica">Sí aplica</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                              {/* --- FIN NUEVA SECCIÓN --- */}

                            </div>
                          </div>
                          </fieldset>
  );
})}
                {!modoRevisionMatriz && (
                  <button type="button" onClick={() => handleAddActivity(h.id)} className="bg-white border-2 border-dashed border-slate-300 text-blue-600 font-bold py-2 px-4 rounded-xl text-[10px] uppercase">➕ Agregar Otra Actividad</button>
                )}
                      </div>
                    )}

                    {/* Si está marcado como "No Aplica", mostramos el recuadro con la justificación */}
                    {!node.aplica && (
                      <div className="bg-slate-100 p-4 rounded-xl border border-slate-300 shadow-inner flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mt-2">
                       <div>
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Motivo de rechazo (No Aplica)</span>
                          <p className="text-xs text-slate-700 font-medium italic whitespace-pre-wrap">"{node.justificacionNoAplica}"</p>
                        </div>
                        {!modoRevisionMatriz && (
                          <button type="button" onClick={() => handleToggleAplica(h.id, false)} className="bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase transition-colors shrink-0 shadow-sm flex items-center gap-1">
                            <span>✏️</span> Editar Observación
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );       
              })}
             

{/* BOTONES INFERIORES: DINÁMICOS SEGÚN MODO REVISIÓN O EDICIÓN */}
             <div className="pt-4 border-t flex flex-col items-end gap-4 w-full">
               
               {/* ----------------- MODO REVISIÓN DE DISEÑO ----------------- */}
               {modoRevisionMatriz ? (
                 <div className="w-full flex flex-col items-end gap-3">
                   {/* CAJA MOTIVO DE CORRECCIÓN */}
                   {mostrarMotivoCorreccion && (
                     <div className="w-full bg-white border border-orange-200 rounded-xl p-4 mb-2 animate-in slide-in-from-top-2">
                       <label htmlFor="motivo-correccion-diseno" className="text-[10px] uppercase tracking-widest font-black text-orange-800 block mb-2">Motivo de corrección · Obligatorio</label>
                       <textarea id="motivo-correccion-diseno" autoFocus rows="3" maxLength={2000} value={motivoCorreccion} onChange={event => setMotivoCorreccion(event.target.value)} className="w-full border border-slate-300 rounded p-3 text-sm text-slate-800 focus:ring-2 focus:ring-orange-500 outline-none" placeholder="Indique qué debe corregirse en el diseño de las acciones para que el gestor pueda ajustar." />
                     </div>
                   )}
                   
                   {/* BOTONES DE DECISIÓN */}
                   <div className="flex flex-wrap justify-end gap-3 w-full">
                     {!mostrarMotivoCorreccion ? (
                       <>
                         <button type="button" disabled={guardandoDecisionRevision} onClick={() => {
                            setEditPlan(null);
                            setFormInformeId('');
                            setMatrixState({});
                            setModoRevisionMatriz(false);
                            setVistaActiva('historial');
                         }} className="px-5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">Cerrar Vista</button>
                         {puedeDecidirRevision && <>
                         <button type="button" disabled={guardandoDecisionRevision} onClick={() => setMostrarMotivoCorreccion(true)} className="px-5 py-2.5 bg-orange-100 border border-orange-200 hover:bg-orange-200 text-orange-900 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm transition-colors disabled:opacity-50">{modoValidacionFinalRevisor ? 'Devolver al ejecutor' : 'Solicitar corrección'}</button>
                         <button type="button" disabled={guardandoDecisionRevision} onClick={() => resolverDecisionRevision('aprobar')} className="px-6 py-2.5 bg-[#69b193] hover:bg-[#549c7f] text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-colors disabled:opacity-50">{guardandoDecisionRevision ? 'Guardando…' : modoValidacionFinalRevisor ? 'Validar y enviar al aprobador' : 'Aprobar diseño'}</button>
                         </>}
                       </>
                     ) : (
                       <>
                         <button type="button" disabled={guardandoDecisionRevision} onClick={() => guardMotivoCorreccion(() => { setMotivoCorreccion(''); setMostrarMotivoCorreccion(false); })} className="px-5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">Volver</button>
                         <button type="button" disabled={!puedeDecidirRevision || guardandoDecisionRevision || !motivoCorreccion.trim()} onClick={() => resolverDecisionRevision('corregir')} className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-colors disabled:opacity-50 flex items-center gap-2">{guardandoDecisionRevision ? 'Enviando…' : modoValidacionFinalRevisor ? 'Devolver al ejecutor al 90%' : 'Enviar corrección al Gestor'}</button>
                       </>
                     )}
                   </div>
                 </div>
               ) : (
                 /* ----------------- MODO EDICIÓN NORMAL ----------------- */
                 <div className="flex flex-col md:flex-row justify-end items-center gap-4 w-full">
                    <label className="flex items-center gap-2 cursor-pointer text-[10px] font-bold text-slate-600 bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-200 transition-all hover:bg-slate-100 shadow-sm mr-auto">
                      <input 
                        type="checkbox" 
                        checked={enviarNotificaciones || esFuenteProgramaAuditoria(informesAuditoria.find(item => String(item.id) === String(formInformeId)))}
                        disabled={esFuenteProgramaAuditoria(informesAuditoria.find(item => String(item.id) === String(formInformeId)))}
                        onChange={(e) => setEnviarNotificaciones(e.target.checked)}
                        className="w-4 h-4 text-[#004d40] rounded border-slate-300 focus:ring-[#004d40]"
                      />
                      <span>📧 Enviar correos de notificación</span>
                    </label>
                    
                    <button 
                      type="button" 
                      onClick={() => cambiarVistaSegura('historial')}
                      className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs shadow-sm transition-all w-full md:w-auto"
                    >
                      ❌ Salir sin guardar
                    </button>
                    
                    <button type="submit" className="bg-[#0A3B32] hover:bg-[#062620] text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs shadow-md transition-all w-full md:w-auto flex items-center gap-2">
                      <span>💾</span> Guardar Matriz y Sincronizar
                    </button>
                 </div>
               )}
              </div>
            </form>
          )}
        </div>
      )}

      {/* 🚀 VISTA 3: HISTORIAL MATRIZ AGRUPADO POR INFORME EMITIDO (ACORDEÓN ANIDADO) */}
      {vistaActiva === 'historial' && (() => {
        const planesFiltradosFinal = applyFilters(planesEnriquecidos, searchTerm, columnFilters);
        
        // Agrupar dinámicamente las actividades filtradas bajo su respectivo informe de origen
        const planesPorInforme = planesFiltradosFinal.reduce((acc, p) => {
          const key = p.idInforme || 'sin-informe';
          if (!acc[key]) acc[key] = [];
          acc[key].push(p);
          return acc;
        }, {});
        Object.values(planesPorInforme).forEach(planes => planes.sort((a, b) => {
          const actividadA = obtenerUltimoCambio(a);
          const actividadB = obtenerUltimoCambio(b);
          if (actividadA !== actividadB) {
            if (actividadA === null) return 1;
            if (actividadB === null) return -1;
            return actividadB - actividadA;
          }
          return String(b.id || '').localeCompare(String(a.id || ''), 'es', { numeric: true, sensitivity: 'base' });
        }));

        // Conservar informes con hallazgos sin planes, aplicando también los filtros activos.
        const hallazgosFiltrados = applyFilters(safeHallazgos, searchTerm, columnFilters);
        const informesConHallazgos = hallazgosFiltrados.map(h => String(h.idInforme));
        const listaInformesIds = [...new Set([...Object.keys(planesPorInforme), ...informesConHallazgos])].filter(id => id && id !== 'undefined' && id !== 'null');
        const informesPorId = new Map(informesAuditoria.map(informe => [String(informe.id), informe]));
        const informesFiltradosPorFuente = listaInformesIds
          .map(id => {
            const informe = informesPorId.get(String(id)) || { id };
            const actividades = [
              obtenerUltimoCambio(informe),
              obtenerTiempoActividad(informe.fechaHora),
              obtenerTiempoActividad(informe.fecha),
              ...(planesPorInforme[id] || []).map(obtenerUltimoCambio),
            ].filter(tiempo => tiempo !== null);
            return {
              informe,
              ultimaActividad: actividades.length > 0 ? Math.max(...actividades) : null,
              fechaInforme: obtenerTiempoInforme(informe.fecha),
            };
          })
          .filter(({ informe }) => !filtroFuenteMatriz || (
            resolverCategoriaFuente(informe.tipoFuente, fuentesMejora) === filtroFuenteMatriz
          ))
          .sort((a, b) => {
            if (a.ultimaActividad !== b.ultimaActividad) {
              if (a.ultimaActividad === null) return 1;
              if (b.ultimaActividad === null) return -1;
              return b.ultimaActividad - a.ultimaActividad;
            }
            if (a.fechaInforme !== b.fechaInforme) {
              if (a.fechaInforme === null) return 1;
              if (b.fechaInforme === null) return -1;
              return b.fechaInforme - a.fechaInforme;
            }
            return String(b.informe.ref || b.informe.id || '').localeCompare(
              String(a.informe.ref || a.informe.id || ''),
              'es',
              { numeric: true, sensitivity: 'base' }
            );
          })
          .map(({ informe }) => String(informe.id));
        const totalInformesMatriz = informesFiltradosPorFuente.length;
        const totalPaginasMatriz = Math.max(1, Math.ceil(totalInformesMatriz / informesPorPaginaMatriz));
        const paginaMatrizActual = Math.min(paginaHistorialMatriz, totalPaginasMatriz);
        const inicioPaginaMatriz = (paginaMatrizActual - 1) * informesPorPaginaMatriz;
        const informesPaginaMatriz = informesFiltradosPorFuente.slice(inicioPaginaMatriz, inicioPaginaMatriz + informesPorPaginaMatriz);
        const primerInformeMatriz = totalInformesMatriz === 0 ? 0 : inicioPaginaMatriz + 1;
        const ultimoInformeMatriz = Math.min(inicioPaginaMatriz + informesPorPaginaMatriz, totalInformesMatriz);

        return (
          <div className="space-y-4 animate-in slide-in-from-left-8 duration-500">
            {/* 🎛️ BARRA DE FILTROS Y BÚSQUEDA SUPERIOR CORRESPONDIENTE */}
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-800">Seguimiento por informe emitido</h3>
                <span className="text-xs font-semibold text-slate-500" aria-live="polite">
                  {totalInformesMatriz} {totalInformesMatriz === 1 ? 'informe' : 'informes'}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[1.1fr_1.1fr_1.1fr_1.1fr_.9fr_1.4fr]">
                    
                    {/* ✨ NUEVO: FILTRO DINÁMICO DE PROCESO */}
                    <label className="min-w-0">
                      <span className="block text-[11px] font-semibold text-slate-500">Proceso</span>
                      <select
                        value={columnFilters['proceso'] || ''}
                        onChange={(e) => {
                          setPaginaHistorialMatriz(1);
                          handleColFilterChange('proceso', e.target.value);
                          handleColFilterChange('subproceso', '');
                        }}
                        className="mt-1 h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="">Todos los procesos</option>
                        {[...new Set(planesEnriquecidos.map(p => p.proceso).filter(Boolean))].sort().map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </label>

                    {/* ✨ NUEVO: FILTRO DINÁMICO DE SUBPROCESO */}
                    <label className="min-w-0">
                      <span className="block text-[11px] font-semibold text-slate-500">Subproceso</span>
                      <select
                        value={columnFilters['subproceso'] || ''}
                        onChange={(e) => { setPaginaHistorialMatriz(1); handleColFilterChange('subproceso', e.target.value); }}
                        className="mt-1 h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="">Todos los subprocesos</option>
                        {[...new Set(
                          planesEnriquecidos
                            .filter(p => !columnFilters['proceso'] || p.proceso === columnFilters['proceso'])
                            .map(p => p.subproceso)
                            .filter(Boolean)
                        )].sort().map(sp => (
                          <option key={sp} value={sp}>{sp}</option>
                        ))}
                      </select>
                    </label>

                    <label className="min-w-0">
                      <span className="block text-[11px] font-semibold text-slate-500">Auditor</span>
                      <select value={columnFilters['auditorAsignado'] || ''} onChange={(e) => { setPaginaHistorialMatriz(1); handleColFilterChange('auditorAsignado', e.target.value); }} className="mt-1 h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                        <option value="">Todos los auditores</option>
                        {[...new Set(planesEnriquecidos.map(p => p.auditorAsignado).filter(Boolean))].sort().map(aud => (
                          <option key={aud} value={aud}>{aud}</option>
                        ))}
                      </select>
                    </label>

                    <label className="min-w-0">
                      <span className="block text-[11px] font-semibold text-slate-500">Tipo de fuente</span>
                      <select value={filtroFuenteMatriz} onChange={(e) => { setFiltroFuenteMatriz(e.target.value); setPaginaHistorialMatriz(1); }} className="mt-1 h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                        <option value="">Todas las fuentes</option>
                        {TIPOS_FUENTE_HISTORIAL.map(fuente => <option key={fuente} value={fuente}>{fuente}</option>)}
                      </select>
                    </label>

                    <label className="min-w-0">
                      <span className="block text-[11px] font-semibold text-slate-500">Fase</span>
                      <select value={columnFilters['estadoWorkflow'] || ''} onChange={(e) => { setPaginaHistorialMatriz(1); handleColFilterChange('estadoWorkflow', e.target.value); }} className="mt-1 h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                        <option value="">Todas las fases</option>
                        <option value="Borrador">Borrador</option>
                        <option value={ESTADO_EVALUACION_INICIAL}>{ESTADO_EVALUACION_INICIAL}</option>
                        <option value={ESTADO_AJUSTES_INICIALES}>{ESTADO_AJUSTES_INICIALES}</option>
                        <option value="En Revisión">En revisión</option>
                        <option value="Cerrado">Cerrada</option>
                      </select>
                    </label>

                    <label className="min-w-0">
                      <span className="block text-[11px] font-semibold text-slate-500">Buscar</span>
                      <span className="relative mt-1 block">
                        <Search size={15} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text" aria-label="Buscar informes y actividades" placeholder="Informe, actividad o responsable" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPaginaHistorialMatriz(1); }} className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs font-semibold text-slate-700 shadow-sm outline-none transition-colors placeholder:font-normal placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                      </span>
                    </label>
              </div>
            </div>

            {/* 📂 LISTADO DE INFORMES CON ACTIVIDADES ASOCIADAS */}
            {listaInformesIds.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm font-medium text-slate-500 shadow-sm">
                No se encontraron informes para los filtros seleccionados.
              </div>
            ) : (
              <div className="space-y-2">
                {informesPaginaMatriz.map(idInf => {
                  const planesDelInforme = planesPorInforme[idInf] || []; // ✨ Salvaguarda para informes sin planes
                  const planesPaqueteCompleto = planesEnriquecidos.filter(plan => String(plan.idInforme) === String(idInf));
                  const informeBase = informesPorId.get(String(idInf));
                  
                 // Mapear trazabilidad del informe padre
                  const codigoInforme = informeBase ? informeBase.ref : "INF-S/N";
                  const tituloInforme = informeBase ? informeBase.titulo : "Informe general o registros huérfanos"; 
                  const procesoInforme = informeBase ? informeBase.proceso : "Varios Procesos";
                  const fechaInforme = informeBase ? informeBase.fecha : "Sin Fecha";

                  const nCerrados = planesDelInforme.filter(planCerrado).length;
                  const nVencidos = planesDelInforme.filter(p => p.esVencido).length;
                  const nProceso = planesDelInforme.length - nCerrados - nVencidos;
                  const isExpanded = informePlanesExpandido === idInf;
                  const pendientesInforme = tareasPendientesPorInforme.get(String(idInf));
                  const tipoPendientePrioritario = pendientesInforme?.revision
                    ? 'revision'
                    : pendientesInforme?.aprobacion
                      ? 'aprobacion'
                      : pendientesInforme?.ejecucion
                        ? 'ejecucion'
                        : '';
                  const estiloPendiente = tipoPendientePrioritario === 'revision'
                    ? { card: 'border-amber-300 ring-1 ring-amber-200 shadow-[0_0_18px_rgba(245,158,11,0.16)]', rail: 'bg-amber-500' }
                    : tipoPendientePrioritario === 'aprobacion'
                      ? { card: 'border-blue-300 ring-1 ring-blue-200 shadow-[0_0_18px_rgba(59,130,246,0.16)]', rail: 'bg-blue-600' }
                      : tipoPendientePrioritario === 'ejecucion'
                        ? { card: 'border-emerald-300 ring-1 ring-emerald-200 shadow-[0_0_18px_rgba(16,185,129,0.16)]', rail: 'bg-emerald-600' }
                        : { card: 'border-slate-200', rail: '' };

                  return (
                    <div key={`inf-plan-card-${idInf}`} className={`relative bg-white rounded-xl border shadow-sm overflow-hidden transition-shadow hover:shadow-md ${estiloPendiente.card}`}>
                      {tipoPendientePrioritario && <span aria-hidden="true" className={`absolute inset-y-0 left-0 z-10 w-1 ${estiloPendiente.rail}`} />}
                      
                      {/* Fila Resumen del Informe (Línea de Trazabilidad Principal) */}
                      <div 
                        onClick={() => setInformePlanesExpandido(isExpanded ? null : idInf)}
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setInformePlanesExpandido(isExpanded ? null : idInf); } }}
                        className={`p-3.5 pl-4 flex flex-col md:flex-row items-start md:items-center justify-between cursor-pointer transition-colors gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${isExpanded ? 'bg-slate-50/80 border-b border-slate-100' : 'hover:bg-slate-50'}`}
                      >
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <span className="text-xl shrink-0">📂</span>
                          <div className="truncate w-full">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 bg-[#0A3B32] text-white font-mono font-black rounded text-[9px] tracking-wider uppercase">{codigoInforme}</span>
                              <span className="text-[10px] text-slate-400 font-bold">📅 {fechaInforme}</span>
                              <span className="text-[10px] bg-slate-100 text-slate-600 font-black px-2 py-0.5 rounded uppercase max-w-[200px] truncate" title={procesoInforme}>🏛️ {procesoInforme}</span>
                            </div>
                            <h4 className="text-xs font-black text-slate-800 mt-1 truncate" title={tituloInforme}>{tituloInforme}</h4>
                            {pendientesInforme && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {pendientesInforme.revision > 0 && (
                                  <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-900">
                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 motion-safe:animate-pulse" />
                                    <ClipboardCheck size={12} aria-hidden="true" />
                                    Revisar acciones <span className="tabular-nums">{pendientesInforme.revision}</span>
                                  </span>
                                )}
                                {pendientesInforme.aprobacion > 0 && (
                                  <button
                                    type="button"
                                    aria-label={`Evaluar ${pendientesInforme.aprobacion} acción(es) pendientes`}
                                    onClick={event => {
                                      event.stopPropagation();
                                      const correoActual = String(user?.email || '').trim().toLowerCase();
                                      const disenosPendientes = planesPaqueteCompleto.filter(plan => pendienteEvaluacionInicial(plan) && esAuditorAsignado(plan, correoActual, perfilUsuario));
                                      if (esFuenteProgramaAuditoria(informeBase) && disenosPendientes.length) {
                                        iniciarEvaluacionIntegral(informeBase, disenosPendientes);
                                        return;
                                      }
                                      const planPendiente = planesPaqueteCompleto.find(plan => (
                                        enRevisionAuditor(plan) && (
                                          esAuditorAsignado(plan, correoActual, perfilUsuario)
                                        )
                                      ));
                                      if (!planPendiente) {
                                        showNotification('No se encontró una acción pendiente de cierre asignada a tu usuario.', 'error');
                                        return;
                                      }

                                      abrirEvaluacionAccion(planPendiente);
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-900 transition-colors hover:border-blue-400 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
                                  >
                                    <span className="h-1.5 w-1.5 rounded-full bg-blue-600 motion-safe:animate-pulse" />
                                    <BadgeCheck size={12} aria-hidden="true" />
                                    Aprobar acciones <span className="tabular-nums">{pendientesInforme.aprobacion}</span>
                                  </button>
                                )}
                                {pendientesInforme.ejecucion > 0 && (
                                  <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-900">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 motion-safe:animate-pulse" />
                                    <Play size={11} aria-hidden="true" />
                                    Ejecutar plan <span className="tabular-nums">{pendientesInforme.ejecucion}</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Indicadores de Trazabilidad del Plan de Acción */}
                        <div className="flex items-center space-x-4 shrink-0 self-end md:self-center">
                          <div className="flex items-center space-x-2 text-[10px] font-bold bg-white px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm">
                            <span className="text-slate-500">Actividades: <span className="font-black text-slate-800">{planesDelInforme.length}</span></span>
                            <span className="text-emerald-600 border-l pl-2 flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1"></span> {nCerrados} Cerradas</span>
                            <span className="text-amber-500 border-l pl-2 flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1"></span> {nProceso} En Proceso</span>
                            <span className="text-red-600 border-l pl-2 flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1"></span> {nVencidos} Vencidas</span>
                          </div>
                          <span className="text-slate-400 font-black text-xs w-4 text-center">{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </div>

                     {/* Sub-tabla Desplegable de Actividades Amarradas */}
                      {isExpanded && (
<div id={`plan-completo-${idInf}`} className="p-3 bg-white border-t border-slate-50 overflow-x-auto relative">
<div className="flex justify-between items-center mb-3">
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Desglose de Actividades</h4>
                     <button 
  type="button"
  disabled={generandoPdfId === idInf}
  onClick={() => handleDescargarPdfConLoader(idInf, codigoInforme)}
  className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm transition-all flex items-center gap-2 text-white ${  
    generandoPdfId === idInf 
      ? 'bg-amber-600 opacity-90 cursor-wait' 
      : 'bg-slate-800 hover:bg-slate-900 cursor-pointer'
  }`}
>
  {generandoPdfId === idInf ? (
    <>
      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
      <span>Generando Documento...</span>
    </>
  ) : (
    <>
      <span>📥</span>
      <span>Descargar Formato Institucional</span>
    </>
  )}
</button>
                          </div>
                          <table className="w-full text-xs text-left divide-y border border-slate-100 rounded-xl overflow-hidden shadow-inner">
                            <thead className="bg-slate-900 text-white font-bold text-[10px] uppercase tracking-wider">
                              <tr>
                                <th className="p-3 w-28">ID Plan</th>
                                <th className="p-3 w-32">Gobernanza (Fase)</th>
                                <th className="p-3 w-40">Hallazgo / Proceso</th>
                                <th className="p-3">Acción Remedial Programada</th>
                                <th className="p-3 w-44">% Avance</th>
                                <th className="p-3 text-center w-32">Gestión</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y text-slate-700 bg-white">
                              {planesDelInforme.length === 0 ? (
                                <tr>
                                  <td colSpan="6" className="p-8 text-center bg-slate-50/50">
                                    <div className="flex flex-col items-center justify-center space-y-3">
                                      <span className="text-3xl">⚠️</span>
                                      <p className="text-slate-500 font-bold text-xs">Este informe tiene hallazgos, pero aún no se ha diseñado su matriz de planes de acción.</p>
                                      {(isAdmin || puedeCrearPlanes) && (
                                        <button
                                          onClick={() => {
                                            handleInformeChange(String(idInf));
                                            setVistaActiva('nuevo');
                                            scrollToForm();
                                          }}
                                          className="mt-2 bg-[#0A3B32] hover:bg-[#062620] text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-md transition-all flex items-center gap-2"
                                        >
                                          <span>📝</span> Diligenciar Matriz Ahora
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ) : planesDelInforme.map((p, pIdx) => (
                                <tr key={`h-child-plan-${p.id}-${pIdx}`} className="hover:bg-slate-50/60 transition-colors">
                                  <td className="p-3 font-mono font-black text-slate-900">PLA-{p.id.toString().slice(-4)}</td>
                                  <td className="p-3">
                                    <span className="px-2 py-0.5 rounded font-black text-[9px] uppercase border bg-slate-100 text-slate-700">{p.estadoWorkflow}</span>
                                  </td>
                                  <td className="p-3 text-red-600 font-bold">
                                    {p.proceso}
                                    <span className="block text-[9px] text-slate-400 font-black">{p.sede}</span>
                                  </td>
                                  <td className="p-3 font-medium text-slate-800">
                                    <div className="font-black text-slate-900">{p.accion}</div>
                                    <div className="text-[9px] text-slate-500 mt-1 bg-slate-50 p-2 rounded">
                                      👤 Ejecutor: {p.responsable} | 🛡️ Auditor: {p.auditorAsignado}
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    <ProgressBar progress={p.progreso} />
                                  </td>
                                  <td className="p-3 text-center flex flex-col space-y-1.5 items-center justify-center">
                                    {/* 🛡️ REGLAS DE SEGURIDAD POR CORREO DEL USUARIO */}
                                    {(() => {
                                      const miCorreo = (user?.email || '').toLowerCase().trim();
                                      const esEjecutor = miCorreo === (p.correoResponsable || '').toLowerCase().trim();
                                      const esRevisor = miCorreo === (p.correoRevisor || '').toLowerCase().trim();
                                      const esAuditor = esAuditorAsignado(p, miCorreo, perfilUsuario);

                                      return (
                                        <>
                                         {/* BOTONES DEL EJECUTOR (Y Admin) - Pueden gestionar mientras no esté cerrado */}
                                          {(esEjecutor || isAdmin) && p.estadoWorkflow !== 'Cerrado' && (
                                            <>
                                              <button onClick={() => { setEditPlan(p); setVistaActiva('nuevo'); scrollToForm(); }} className="bg-slate-100 text-slate-800 border border-slate-300 font-bold px-3 py-1.5 rounded-lg text-[10px] w-full hover:bg-slate-200 transition-colors shadow-sm">✏️ Modificar Matriz</button>
                                              
                                              {/* NUEVO BOTÓN: Evaluar / Modo Lectura para Revisor o Auditor */}
                                              {(esRevisor || esAuditor || isAdmin) && (
                                                <button 
                                                  onClick={() => {
                                                    if (enRevisionAuditor(p) && esAuditor) {
                                                      abrirEvaluacionAccion(p);
                                                      return;
                                                    }
                                                    setEditPlan(null);
                                                    setModoRevisionMatriz(true);
                                                    setRevisionInformeId(p.idInforme);
                                                    handleInformeChange(String(p.idInforme));
                                                    setVistaActiva('nuevo');
                                                    scrollToForm();
                                                  }} 
                                                  className="bg-sky-50 text-sky-700 border border-sky-200 font-bold px-3 py-1.5 rounded-lg text-[10px] w-full hover:bg-sky-100 transition-colors shadow-sm flex items-center justify-center gap-1"
                                                  title="Abrir en Modo Lectura para evaluar soportes"
                                                >
                                                  <span>👁️</span> Evaluar / Ver
                                                </button>
                                              )}
                                            </>
                                          )}

                                          {/* 👉 BOTÓN HISTORIAL (Visible para todos) */}
                                          <button 
                                            onClick={() => setHistorialModal({ activo: true, plan: p })} 
                                            className="bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold px-3 py-1.5 rounded-lg text-[10px] w-full hover:bg-indigo-100 transition-colors shadow-sm flex items-center justify-center gap-1"
                                            title="Ver el historial de modificaciones (Audit Trail)"
                                          >
                                            <span>📜</span> Historial
                                          </button>

                                          {/* ========================================================================= */}
                                          {/* NIVEL 1: REVISOR (Jefatura) -> Aprueba el diseño para que el ejecutor actúe */}
                                          {/* ========================================================================= */}
                                          {p.estadoWorkflow === ESTADO_PENDIENTE_VALIDACION_REVISOR && esRevisor && (
                                            <div className="flex flex-col gap-1 w-full mt-1 pt-1 border-t border-slate-200">
                                              <button type="button" onClick={() => abrirRevisionPlan(p)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-2 py-1.5 rounded text-[9px] uppercase tracking-wider shadow-sm transition-all">
                                                ✓ Validar ejecución al 100%
                                              </button>
                                            </div>
                                          )}
                                          {p.estadoWorkflow === 'Pendiente Revisión Jefatura' && esRevisor && !esPlanProgramaAuditoria(p) && (
                                            <div className="flex flex-col gap-1 w-full mt-1 pt-1 border-t border-slate-200">
                                              <button type="button" onClick={() => abrirRevisionPlan(p)} className="bg-amber-500 hover:bg-amber-600 text-white font-black px-2 py-1.5 rounded text-[9px] uppercase tracking-wider shadow-sm transition-all shadow-amber-500/30">
                                                👀 Revisar Diseño
                                              </button>
                                            </div>
                                          )}

                                          {/* ========================================================================= */}
                                          {/* NIVEL 3: AUDITOR -> Revisa el 100% y cierra o rechaza el plan             */}
                                          {/* ========================================================================= */}
                                          {enRevisionAuditor(p) && esAuditor && (
                                            <div className="flex flex-col gap-1 w-full mt-1 pt-1 border-t border-slate-200">
                                              <button type="button" onClick={() => abrirEvaluacionAccion(p)} className="individual-close-glow flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border-2 border-emerald-300 bg-[#0A3B32] px-3 py-2 text-[10px] font-black uppercase tracking-wide text-white transition-transform hover:scale-[1.02] hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">
                                                <BadgeCheck size={15} aria-hidden="true" />
                                                <span>Evaluar y cerrar acción</span>
                                              </button>
                                              
                                              <button type="button" onClick={async () => {
                                                const r = prompt("Ingrese el motivo de rechazo de la evidencia:");
                                                if(r) {
                                                  try {
                                                    const respuesta = await apiService.decidirPlanComoAuditor(p.id, 'rechazar', r);
                                                    setPlanes(prev => (Array.isArray(prev) ? prev : []).map(x => String(x.id) === String(p.id) ? respuesta.plan : x));
                                                  } catch (error) {
                                                    alert(error.message || 'No se pudo rechazar la evidencia.');
                                                    return;
                                                  }
                                                  
                                                  const notificados = await enviarNotificacionPlanConReintento({
                                                    ref_consecutivo: `PLA-${String(p.id).slice(-4)}`,
                                                    titulo_informe: 'Evidencia de plan rechazada',
                                                    proceso_auditado: `El Auditor rechazó los soportes de la acción: "${p.accion}". Motivo: ${r}. El avance regresa a 90% (En Ejecución) para su corrección.`,
                                                    enlace_pdf: window.location.origin,
                                                    destinatarios: [p.correoResponsable, p.correoRevisor].filter(Boolean).join(', ')
                                                  });
                                                  alert(notificados ? 'Rechazo aplicado y responsables notificados.' : 'Rechazo aplicado. La notificación quedó pendiente para reintento.');
                                                }
                                              }} className="bg-rose-600 hover:bg-rose-700 text-white font-black px-2 py-1.5 rounded text-[9px] uppercase tracking-wider shadow-sm transition-all">
                                                ✕ Rechazar Evidencia
                                              </button>
                                            </div>
                                          )}

                                          {/* ELIMINAR (SOLO ADMIN) */}
                                          {isAdmin && <button onClick={() => handleDeleteItem('planes', p.id)} className="bg-red-50 text-red-700 hover:bg-red-100 font-bold px-2 py-1 rounded text-[10px] w-full mt-1 border border-red-200 transition-colors">🗑️ Eliminar</button>}
                                        </>
                                      );
                                    })()}
                                  </td>
                                </tr>
                              ))}
                           </tbody>
                          </table>
                          
                         {/* ⚖️ BOTÓN MAESTRO DE EVALUACIÓN HOLÍSTICA (DISEÑO Y MEMORIA) */}
                          {planesPaqueteCompleto.length > 0 &&
                            esFuenteProgramaAuditoria(informeBase) && (() => {
                            const planConEval = planesPaqueteCompleto.find(p => p.evaluacionHolistica);
                            const evalGuardada = planConEval ? planConEval.evaluacionHolistica : null;
                            const pendientes = planesPaqueteCompleto.filter(plan => pendienteEvaluacionInicial(plan) && esAuditorAsignado(plan, user?.email, perfilUsuario));
                            const puedeEvaluar = paqueteListoParaEvaluacion(informeBase, pendientes) && esAuditorAsignadoEvaluador(informeBase, pendientes);

                            return (
                              <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col md:flex-row justify-between items-center shadow-sm gap-3 animate-in fade-in">
                                <div className="text-center md:text-left">
                                  <p className="text-[10px] font-black text-[#0A3B32] uppercase tracking-widest">⚖️ Evaluación inicial del diseño de acciones</p>
                                  {evalGuardada?.aprobado ? (
                                    <p className="text-[9px] text-emerald-600 font-bold mt-0.5">
                                      ✅ Evaluación integral aprobada el {evalGuardada.fecha} con {evalGuardada.puntaje}%.
                                    </p>
                                  ) : evalGuardada ? (
                                    <p className="text-[9px] text-rose-600 font-bold mt-0.5">
                                      ⚠️ Evaluación anterior no aprobada ({evalGuardada.puntaje}%). Requiere corregir el diseño y reenviarlo al auditor.
                                    </p>
                                  ) : (
                                    <p className="text-[9px] text-slate-500 font-medium mt-0.5">
                                      Mayor o igual al 80% habilita la ejecución. El cierre requiere completar la ejecución, validación del revisor y aprobación final del auditor.
                                    </p>
                                  )}
                                </div>
                                
                               {evalGuardada ? (
                                  <div className="flex gap-2 w-full md:w-auto">
                                    <button
                                      onClick={() => {
                                        setCriterios(evalGuardada?.criterios || { c1: 100, c2: 100, c3: 100, c4: 100, c5: 100 });
                                        setJustificacion(evalGuardada?.justificacion || '');
                                        setModalEval({
                                          activo: true, idInforme: idInf, planes: planesPaqueteCompleto,
                                          totalActividades: planesPaqueteCompleto.length, isReadOnly: true
                                        });
                                      }}
                                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-5 py-2.5 rounded-xl text-xs font-black shadow-sm transition-all uppercase tracking-widest flex items-center gap-2 w-full md:w-auto justify-center"
                                    >
                                      <span>👁️</span> Ver Calificación Realizada
                                    </button>

                                    {puedeEvaluar && <button
                                      onClick={() => iniciarEvaluacionIntegral(informeBase, pendientes)}
                                      className="bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-2.5 rounded-xl text-[10px] font-black shadow-sm transition-all uppercase tracking-widest flex items-center gap-1 w-full md:w-auto justify-center"
                                      title="Evaluar acciones pendientes antes de su ejecución"
                                    >
                                      ⚖️ Evaluar diseño pendiente
                                    </button>}
                                  </div>
                                ) : puedeEvaluar ? (
                                  <button 
                                    onClick={() => iniciarEvaluacionIntegral(informeBase, pendientes)}
                                    className="bg-[#0A3B32] hover:bg-[#062620] text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-md transition-all uppercase tracking-widest flex items-center gap-2 w-full md:w-auto justify-center"
                                  >
                                    <span>⚖️</span> Evaluar Plan Integral
                                 </button>
                                ) : null}
                              </div>
                            );
                          })()}

                   {/* ===================================================================== */}
      {/* 📄 LIENZO OCULTO PARA EXPORTAR EL DICTAMEN A PDF (BLINDADO ANTI-CORTES) */}
      {/* ===================================================================== */}
      {modalEval.activo && createPortal(
        <div className="absolute -left-[9999px] top-0 opacity-0 pointer-events-none">
          <div ref={dictamenRef} className="w-[1000px] bg-white p-12 font-sans text-slate-800 flex flex-col gap-6">
            
            {/* Cabecera Institucional */}
            <div className="flex justify-between items-center border-b-4 border-[#0A3B32] pb-6 break-inside-avoid" style={{ pageBreakInside: 'avoid' }}>
              <div className="flex items-center gap-6">
                <img src="/logo_termales.png" alt="Termales Santa Rosa" className="w-24 h-auto object-contain drop-shadow-sm" />
                <div>
                  <h1 className="text-3xl font-black text-[#0A3B32]">TERMALES SANTA ROSA DE CABAL</h1>
                  <h2 className="text-xl font-bold text-slate-600 mt-1">DICTAMEN DE EVALUACIÓN DE AUDITORÍA</h2>
                  <p className="text-sm font-bold text-slate-400 mt-1">
                    Referencia de Informe: {(informesAuditoria || []).find(i => i && String(i.id) === String(modalEval.idInforme))?.ref || modalEval.idInforme || 'N/A'}
                  </p>
                  <p className="text-sm font-bold text-slate-400">
                    Proceso Auditado: {(informesAuditoria || []).find(i => i && String(i.id) === String(modalEval.idInforme))?.proceso || 'Proceso General'}
                  </p>
                </div>
              </div>
              <div className="text-right text-sm shrink-0">
                <p><span className="font-bold">Fecha de Emisión:</span> {new Date().toLocaleDateString('es-CO')}</p>
                <p><span className="font-bold">De:</span> Control Interno y Auditoría Interna</p>
                <p><span className="font-bold">Para:</span> Liderazgo de Proceso</p>
              </div>
            </div>

            {/* Texto Introductorio formal */}
            <p className="text-base text-justify font-medium leading-relaxed break-inside-avoid" style={{ pageBreakInside: 'avoid' }}>
              El presente documento constituye el dictamen oficial sobre el paquete de acciones correctivas propuesto por el área responsable para mitigar los riesgos derivados del informe en referencia. La evaluación se fundamenta en el marco metodológico del Sistema Integral de Riesgos y las Normas Globales de Auditoría Interna.
            </p>

            {/* Sección 1: Calificación */}
            <div className="break-inside-avoid" style={{ pageBreakInside: 'avoid' }}>
              <h3 className="text-lg font-black text-[#0A3B32] bg-slate-100 p-3 rounded-lg mb-4 uppercase">1. Calificación Global y Ponderada</h3>
              <div className="flex gap-6 items-center bg-slate-50 p-6 rounded-xl border border-slate-200">
                <div className={`w-32 h-32 rounded-full flex flex-col items-center justify-center border-8 shrink-0 ${evaluacionAprobadaVisible ? 'border-emerald-500 text-emerald-700 bg-emerald-50' : (puntajeHolistico || 0) >= 50 ? 'border-amber-500 text-amber-700 bg-amber-50' : 'border-red-500 text-red-700 bg-red-50'}`}>
                  <span className="text-5xl font-black leading-none">{puntajeHolistico || 0}</span>
                  <span className="text-xs font-bold uppercase mt-1">Puntos / 100</span>
                </div>
                <div className="flex-1">
                  <h4 className={`text-2xl font-black uppercase mb-2 ${evaluacionAprobadaVisible ? 'text-emerald-700' : (puntajeHolistico || 0) >= 50 ? 'text-amber-700' : 'text-red-700'}`}>
                    {evaluacionAprobadaVisible ? 'EVALUACIÓN: APROBADA' : 'EVALUACIÓN: NO APROBADA'}
                  </h4>
                  <p className="text-base text-slate-700 font-medium leading-relaxed">
                    {modalEval.isReadOnly ? 'Dictamen histórico conservado con su resultado original.'
                      : evaluacionAprobadaVisible
                        ? 'El diseño cumple el umbral mayor o igual al 80%. Al guardar se habilita la ejecución; no se cierran las acciones.'
                        : 'El diseño no alcanza el 80%. Se requieren correcciones del responsable y una nueva evaluación antes de ejecutar.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Sección 2: Criterios (Refactorizada para anti-cortes) */}
            <div className="break-inside-avoid" style={{ pageBreakInside: 'avoid' }}>
              <h3 className="text-lg font-black text-[#0A3B32] bg-slate-100 p-3 rounded-lg mb-4 uppercase">2. Desglose de Evaluación Técnica</h3>
              <div className="flex flex-col border border-slate-300 rounded-lg overflow-hidden text-base">
                <div className="flex bg-slate-800 text-white font-bold">
                  <div className="p-4 flex-1 border-r border-slate-700">Criterio Metodológico (COSO/ISO 31000)</div>
                  <div className="p-4 w-24 text-center border-r border-slate-700">Peso</div>
                  <div className="p-4 w-32 text-center">Calificación</div>
                </div>
                {[
                  { t: 'Completitud y Cobertura: ¿Atiende todos los hallazgos sin omitir riesgos?', p: '30%', v: criterios?.c1 ?? 100 },
                  { t: 'Análisis de Causa Raíz: ¿Va a la raíz del problema y no solo al síntoma?', p: '20%', v: criterios?.c2 ?? 100 },
                  { t: 'Planes de Choque Inmediato: ¿Implementa contingencias a corto plazo?', p: '20%', v: criterios?.c3 ?? 100 },
                  { t: 'Temporalidad: ¿Las fechas son realistas y oportunas?', p: '20%', v: criterios?.c4 ?? 100 },
                  { t: 'Indicadores: ¿Propone controles medibles y KPIs claros?', p: '10%', v: criterios?.c5 ?? 100 }
                ].map((row, i) => (
                  <div key={i} className="flex border-t border-slate-300 break-inside-avoid" style={{ pageBreakInside: 'avoid' }}>
                    <div className="p-4 flex-1 font-bold text-slate-700 border-r border-slate-300">{row.t}</div>
                    <div className="p-4 w-24 text-center text-slate-500 font-bold border-r border-slate-300 flex items-center justify-center">{row.p}</div>
                    <div className={`p-4 w-32 text-center font-black flex items-center justify-center ${row.v >= 80 ? 'text-emerald-600' : row.v >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{row.v}%</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sección 3: Dictamen Escrito */}
            <div className="break-inside-avoid" style={{ pageBreakInside: 'avoid' }}>
              <h3 className="text-lg font-black text-[#0A3B32] bg-slate-100 p-3 rounded-lg mb-4 uppercase">3. Justificación y Dictamen Oficial del Auditor</h3>
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-300 min-h-[150px]">
                <p className="text-base font-medium text-slate-800 whitespace-pre-wrap italic">
                  "{justificacion || 'Se han revisado las acciones propuestas frente a los criterios normativos y se concluye que el diseño del plan es robusto. No se presentan observaciones adicionales, se autoriza proceder con la ejecución.'}"
                </p>
              </div>
            </div>

            {/* Pie de página Legal */}
            <div className="pt-6 border-t-2 border-slate-300 flex justify-between items-center text-xs text-slate-500 font-bold break-inside-avoid" style={{ pageBreakInside: 'avoid' }}>
              <span className="uppercase tracking-widest">Documento Oficial Generado por el Sistema GCM</span>
              <span>Auditoría Interna Corporativa</span>
            </div>
          </div>
        </div>,
        document.body
      )}
{/* FIN DEL LIENZO OCULTO */}

                        </div>
                      )}

                     {/* ===================================================================== */}
                      {/* 📄 LIENZO OCULTO PARA EXPORTAR EL PLAN DE ACCIÓN INSTITUCIONAL        */}
                      {/* ===================================================================== */}
                      {createPortal(
                        <div className="absolute -left-[9999px] top-0 opacity-0 pointer-events-none">
                          <div 
                            id={`pdf-export-plan-${idInf}`}
                            style={{ width: '1350px', backgroundColor: '#ffffff', padding: '32px', fontFamily: 'sans-serif', color: '#1e293b' }}
                          >
                            {/* Cabecera Membretada */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0A3B32', paddingBottom: '16px', marginBottom: '24px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                                <img src="/logo_termales.png" alt="Termales Santa Rosa" style={{ width: '144px', height: 'auto', objectFit: 'contain' }} />
                                <div>
                                  <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#0A3B32', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Termales Santa Rosa de Cabal</h1>
                                  <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#475569', marginTop: '4px', margin: 0 }}>PLAN DE MEJORAMIENTO CORPORATIVO</h2>
                                </div>
                              </div>
                              <div style={{ textAlign: 'right', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Referencia Oficial</div>
                                <div style={{ fontSize: '20px', fontWeight: '900', color: '#0A3B32', marginTop: '2px' }}>{codigoInforme}</div>
                              </div>
                            </div>

                            {/* Información General Dinámica en Tabla Rígida (Anti-Solapamiento 100%) */}
                            <table style={{ width: '100%', marginBottom: '24px', borderCollapse: 'separate', borderSpacing: '12px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '12px' }}>
                              <tbody>
                                <tr>
                                  <td style={{ verticalAlign: 'top', width: '25%' }}>
                                    <div style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>FECHA EMISIÓN / REGISTRO</div>
                                    <div style={{ fontSize: '12px', fontWeight: '900', color: '#1e293b' }}>{fechaInforme || 'N/A'}</div>
                                  </td>
                                  <td style={{ verticalAlign: 'top', width: '50%' }} colSpan={2}>
                                    <div style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>FUENTE / TÍTULO DEL INFORME</div>
                                    <div style={{ fontSize: '12px', fontWeight: '900', color: '#0f172a', lineHeight: '1.4' }}>{tituloInforme || 'Sin Título'}</div>
                                  </td>
                                  <td style={{ verticalAlign: 'top', width: '25%' }}>
                                    <div style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>PROCESO AUDITADO</div>
                                    <div style={{ fontSize: '12px', fontWeight: '900', color: '#1e293b', textTransform: 'uppercase' }}>{procesoInforme || 'General'}</div>
                                  </td>
                                </tr>
                                <tr>
                                  <td style={{ verticalAlign: 'top', width: '25%' }}>
                                    <div style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>TIPO DE PLAN</div>
                                    <div style={{ fontSize: '12px', fontWeight: '900', color: '#1e293b' }}>Acción Correctiva / De Proceso</div>
                                  </td>
                                  <td style={{ verticalAlign: 'top', width: '50%' }} colSpan={2}>
                                    <div style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>OBJETIVO / ALCANCE</div>
                                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#334155', lineHeight: '1.4' }}>
                                      Fortalecimiento de los controles del proceso para garantizar el cumplimiento legal, documental y operativo derivado de la auditoría.
                                    </div>
                                  </td>
                                  <td style={{ verticalAlign: 'top', width: '25%' }}>
                                    <div style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>VENCIMIENTO GLOBAL</div>
                                    <div style={{ fontSize: '12px', fontWeight: '900', color: '#dc2626' }}>
                                      {(() => {
                                        const fechas = planesDelInforme.map(p => p.fecha).filter(Boolean);
                                        return fechas.length > 0 ? fechas.sort().reverse()[0] : 'N/A';
                                      })()}
                                    </div>
                                  </td>
                                </tr>
                              </tbody>
                            </table>

                            {/* Tabla de Actividades (Estructura de Renglón Rígido) */}
                            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', border: '2px solid #0A3B32' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#0A3B32', color: '#ffffff', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.05em', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                  <th style={{ padding: '8px', border: '1px solid #475569', textAlign: 'center', width: '32px' }}>No.</th>
                                  <th style={{ padding: '8px', border: '1px solid #475569', width: '220px' }}>Descripción Observación y/o Hallazgo</th>
                                  <th style={{ padding: '8px', border: '1px solid #475569', textAlign: 'center', width: '90px' }}>Clase de Observación</th>
                                  <th style={{ padding: '8px', border: '1px solid #475569', width: '110px' }}>Áreas / Procesos Vinculados</th>
                                  <th style={{ padding: '8px', border: '1px solid #475569', width: '220px' }}>Acciones de Mejoramiento</th>
                                  <th style={{ padding: '8px', border: '1px solid #475569', width: '110px' }}>Mecanismo de Seguimiento</th>
                                  <th style={{ padding: '8px', border: '1px solid #475569', width: '130px' }}>Resp. Seguimiento (Auditor)</th>
                                  <th style={{ padding: '8px', border: '1px solid #475569', textAlign: 'center', width: '60px' }}>Meta / Unidad</th>
                                  <th style={{ padding: '8px', border: '1px solid #475569', textAlign: 'center', width: '75px' }}>Fecha Inicio</th>
                                  <th style={{ padding: '8px', border: '1px solid #475569', textAlign: 'center', width: '75px' }}>Fecha Terminación</th>
                                  <th style={{ padding: '8px', border: '1px solid #475569', textAlign: 'center', width: '60px' }}>Plazo (Semanas)</th>
                                  <th style={{ padding: '8px', border: '1px solid #475569', textAlign: 'center', width: '85px' }}>Estado / Observación</th>
                                  <th style={{ padding: '8px', border: '1px solid #475569', width: '130px' }}>Responsable de Mejoramiento</th>
                                </tr>
                              </thead>
                              <tbody style={{ fontSize: '9.5px', color: '#0f172a', backgroundColor: '#ffffff' }}>
                                {planesDelInforme.map((p, idx) => {
                                  const hallazgoBase = safeHallazgos.find(h => String(h.id) === String(p.idHallazgo));
                                  
                                  let semanas = 'N/A';
                                  if (p.fechaInicio && p.fecha) {
                                    const d1 = new Date(p.fechaInicio);
                                    const d2 = new Date(p.fecha);
                                    if (!isNaN(d1) && !isNaN(d2)) {
                                      const diffTime = Math.abs(d2 - d1);
                                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                      semanas = (diffDays / 7).toFixed(1);
                                    }
                                  }

                                  return (
                                    <tr 
                                      key={idx} 
                                      className="break-inside-avoid pdf-row-avoid"
                                      style={{ 
                                        borderBottom: '1px solid #cbd5e1', 
                                        pageBreakInside: 'avoid', 
                                        breakInside: 'avoid'
                                      }}
                                    >
                                      {/* 1. NO */}
                                      <td style={{ padding: '8px 4px', borderRight: '1px solid #cbd5e1', textAlign: 'center', fontWeight: '900', color: '#0f172a', verticalAlign: 'top', fontSize: '10px' }}>{idx + 1}</td>
                                      
                                      {/* 2. DESCRIPCIÓN OBSERVACIÓN Y/O HALLAZGO */}
                                      <td style={{ padding: '8px', borderRight: '1px solid #cbd5e1', verticalAlign: 'top', fontSize: '9.5px', lineHeight: '1.35' }}>
                                        <div style={{ fontWeight: '900', color: '#dc2626', marginBottom: '3px', fontSize: '10px' }}>
                                          {hallazgoBase?.ref || `HAL-${p.idHallazgo}`}
                                        </div>
                                        <div style={{ fontWeight: '500', color: '#0f172a' }}>
                                          {hallazgoBase?.titulo || hallazgoBase?.descripcion || hallazgoBase?.hallazgo || hallazgoBase?.detalle || hallazgoBase?.observacion || 'Sin descripción detallada registrada.'}
                                        </div>
                                      </td>
                                      
                                      {/* 3. CLASE DE OBSERVACIÓN */}
                                      <td style={{ padding: '8px 4px', borderRight: '1px solid #cbd5e1', verticalAlign: 'top', textAlign: 'center', fontWeight: '900', textTransform: 'uppercase', color: '#0A3B32', fontSize: '9px' }}>
                                        {hallazgoBase?.claseObservacion || 'No Conformidad'}
                                      </td>
                                      
                                      {/* 4. ÁREAS / PROCESOS */}
                                      <td style={{ padding: '8px 4px', borderRight: '1px solid #cbd5e1', verticalAlign: 'top', textTransform: 'uppercase', fontWeight: 'bold', color: '#0f172a', fontSize: '9px', lineHeight: '1.3' }}>
                                        <div>{p.proceso}</div>
                                        <div style={{ color: '#475569', fontWeight: '600', fontSize: '8.5px', marginTop: '3px' }}>{p.sede}</div>
                                      </td>
                                      
                                      {/* 5. ACCIONES DE MEJORAMIENTO */}
                                      <td style={{ padding: '8px', borderRight: '1px solid #cbd5e1', verticalAlign: 'top', fontSize: '9.5px', lineHeight: '1.35' }}>
                                        <div style={{ fontWeight: '900', color: '#2563eb', marginBottom: '3px', fontSize: '10px' }}>PLA-{p.id.toString().slice(-4)}</div>
                                        <div style={{ fontWeight: '900', color: '#0f172a' }}>{p.accion}</div>
                                      </td>
                                      
                                      {/* 6. MECANISMO DE SEGUIMIENTO */}
                                      <td style={{ padding: '8px 4px', borderRight: '1px solid #cbd5e1', verticalAlign: 'top', fontWeight: '600', color: '#334155', textTransform: 'uppercase', fontSize: '8.5px' }}>
                                        Revisión de Evidencias Digitales GCM
                                      </td>
                                      
                                      {/* 7. RESPONSABLE DE SEGUIMIENTO */}
                                      <td style={{ padding: '8px 4px', borderRight: '1px solid #cbd5e1', verticalAlign: 'top', fontWeight: '900', color: '#0A3B32', fontSize: '9px' }}>
                                        {p.auditorAsignado || 'Auditoría Interna'}
                                      </td>
                                      
                                      {/* 8. META */}
                                      <td style={{ padding: '8px 2px', borderRight: '1px solid #cbd5e1', verticalAlign: 'top', textAlign: 'center' }}>
                                        <span style={{ backgroundColor: '#d1fae5', color: '#065f46', fontWeight: '900', padding: '2px 6px', borderRadius: '4px', fontSize: '9px' }}>100%</span>
                                      </td>
                                      
                                      {/* 9. FECHA INICIO */}
                                      <td style={{ padding: '8px 2px', borderRight: '1px solid #cbd5e1', verticalAlign: 'top', textAlign: 'center', fontWeight: 'bold', color: '#0f172a', fontSize: '9px' }}>
                                        {p.fechaInicio || 'N/A'}
                                      </td>
                                      
                                      {/* 10. FECHA TERMINACIÓN */}
                                      <td style={{ padding: '8px 2px', borderRight: '1px solid #cbd5e1', verticalAlign: 'top', textAlign: 'center', fontWeight: 'bold', color: '#0f172a', fontSize: '9px' }}>
                                        {p.fecha || 'N/A'}
                                      </td>
                                      
                                      {/* 11. PLAZO SEMANAS */}
                                      <td style={{ padding: '8px 2px', borderRight: '1px solid #cbd5e1', verticalAlign: 'top', textAlign: 'center', fontWeight: '900', color: '#1d4ed8', fontSize: '9px' }}>
                                        {semanas}
                                      </td>
                                      
                                      {/* 12. ESTADO / OBSERVACIONES */}
                                      <td style={{ padding: '8px 2px', borderRight: '1px solid #cbd5e1', verticalAlign: 'top', textAlign: 'center', fontSize: '9px', lineHeight: '1.3' }}>
                                        <div style={{ display: 'inline-block', padding: '2px 6px', borderRadius: '4px', fontWeight: '900', textTransform: 'uppercase', fontSize: '8px', backgroundColor: p.progreso === 100 ? '#d1fae5' : '#fef3c7', color: p.progreso === 100 ? '#065f46' : '#92400e', marginBottom: '3px' }}>
                                          {p.estadoWorkflow || 'En Proceso'}
                                        </div>
                                        <div style={{ fontWeight: '900', color: '#0f172a', fontSize: '8.5px' }}>{p.progreso}% Avance</div>
                                      </td>
                                      
                                      {/* 13. RESPONSABLE DE MEJORAMIENTO */}
                                      <td style={{ padding: '8px 4px', verticalAlign: 'top', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', fontSize: '9px' }}>
                                        {p.responsable || 'Sin Asignar'}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>

                            {/* Sección de Firmas Dinámicas */}
                            <div style={{ marginTop: '64px', display: 'flex', justifyContent: 'space-between', paddingLeft: '64px', paddingRight: '64px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                              <div style={{ textAlign: 'center', width: '288px' }}>
                                <div style={{ borderBottom: '2px solid #475569', height: '48px', marginBottom: '8px' }}></div>
                                <div style={{ fontSize: '12px', fontWeight: '900', color: '#1e293b', textTransform: 'uppercase' }}>
                                  {planesDelInforme[0]?.responsable || 'FIRMA LÍDER DEL PROCESO'}
                                </div>
                                <div style={{ fontSize: '9px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>Responsable de Ejecución</div>
                              </div>
                              <div style={{ textAlign: 'center', width: '288px' }}>
                                <div style={{ borderBottom: '2px solid #475569', height: '48px', marginBottom: '8px' }}></div>
                                <div style={{ fontSize: '12px', fontWeight: '900', color: '#1e293b', textTransform: 'uppercase' }}>
                                  {planesDelInforme[0]?.auditorAsignado || 'FIRMA CONTROL INTERNO'}
                                </div>
                                <div style={{ fontSize: '9px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>Aprobación y Seguimiento</div>
                              </div>
                            </div>

                            {/* Pie de Página */}
                            <div style={{ marginTop: '48px', borderTop: '2px solid #0A3B32', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', color: '#64748b', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              <span>Generado Automáticamente por el Sistema GCM Auditor V5</span>
                              <span>Uso Oficial - Control Interno</span>
                            </div>
                          </div>
                        </div>,
                        document.body
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
                <span aria-live="polite">Mostrando <strong className="text-slate-800">{primerInformeMatriz}-{ultimoInformeMatriz}</strong> de <strong className="text-slate-800">{totalInformesMatriz}</strong> informes</span>
                <label className="flex items-center gap-2 font-medium">
                  Informes por página
                  <select value={informesPorPaginaMatriz} onChange={(e) => { setInformesPorPaginaMatriz(Number(e.target.value)); setPaginaHistorialMatriz(1); }} aria-label="Informes por página" className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                  </select>
                </label>
              </div>
              <nav className="flex items-center justify-between gap-2 sm:justify-end" aria-label="Paginación del historial matriz">
                <button type="button" onClick={() => setPaginaHistorialMatriz(Math.max(1, paginaMatrizActual - 1))} disabled={paginaMatrizActual <= 1} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40">Anterior</button>
                <span className="min-w-24 text-center text-xs font-semibold tabular-nums text-slate-600" aria-live="polite">Página {paginaMatrizActual} de {totalPaginasMatriz}</span>
                <button type="button" onClick={() => setPaginaHistorialMatriz(Math.min(totalPaginasMatriz, paginaMatrizActual + 1))} disabled={paginaMatrizActual >= totalPaginasMatriz} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40">Siguiente</button>
              </nav>
            </div>
          </div>
        );
      })()}

     {/* ===================================================================== */}
      {/* ⚖️ MODAL DE EVALUACIÓN HOLÍSTICA PONDERADA (METODOLOGÍA EXCEL)        */}
      {/* ===================================================================== */}
      {modalEval.activo && (
        <div role="dialog" aria-modal="true" aria-labelledby="evaluacion-integral-titulo" className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
            
            <div className="bg-[#0A3B32] p-5 flex justify-between items-center shrink-0">
              <div>
                <h3 id="evaluacion-integral-titulo" className="text-white font-black text-lg flex items-center gap-2"><span aria-hidden="true">⚖️</span> Evaluación Ponderada del Plan de Acción</h3>
                <p className="text-emerald-100 text-[10px] font-medium tracking-wide uppercase mt-0.5">Metodología COSO/ISO 31000 - Evaluando {modalEval?.planes?.length || 0} actividad(es).</p>
              </div>
              <button type="button" onClick={cerrarModalEvaluacionIntegral} aria-label="Cerrar evaluación integral" className="min-h-11 min-w-11 text-emerald-100 hover:text-white font-black text-xl px-2 transition-colors">✕</button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-inner">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Parámetros de Calificación del Paquete</h4>
                
                <div className="space-y-4">
                  {[
                    { id: 'c1', titulo: 'Completitud y Cobertura (30%)', desc: '¿El plan atiende todos los hallazgos o dejó riesgos por fuera?', peso: 0.3 },
                    { id: 'c2', titulo: 'Análisis de Causa Raíz (20%)', desc: '¿Va a la raíz del problema o solo propone paños de agua tibia?', peso: 0.2 },
                    { id: 'c3', titulo: 'Planes de Choque Inmediato (20%)', desc: '¿Hay acciones de contingencia a corto plazo para frenar el impacto?', peso: 0.2 },
                    { id: 'c4', titulo: 'Temporalidad y Fechas (20%)', desc: '¿Las fechas programadas son realistas y oportunas?', peso: 0.2 },
                    { id: 'c5', titulo: 'Controles e Indicadores (10%)', desc: '¿Proponen formas claras de medir la efectividad (KRIs/KPIs)?', peso: 0.1 }
                  ].map(crit => {
                    const valorCriterio = criterios?.[crit.id] ?? 100;
                    return (
                    <div key={crit.id} className="flex flex-col md:flex-row items-start md:items-center gap-4 bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm transition-all hover:border-slate-300">
                      <div className="flex-1">
                        <label className="text-xs font-black text-slate-800 uppercase tracking-wide">{crit.titulo}</label>
                        <p className="text-[10px] text-slate-500 mt-0.5">{crit.desc}</p>
                      </div>
                      <div className="w-full md:w-1/3 flex items-center gap-3">
                        <input 
                          type="range" min="0" max="100" step="5" 
                          value={valorCriterio} 
                          onChange={(e) => setCriterios({...criterios, [crit.id]: Number(e.target.value)})}
                          disabled={modalEval.isReadOnly}
                          className={`w-full accent-[#0A3B32] ${modalEval.isReadOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                        />
                        <span className={`font-mono font-black text-[11px] w-12 text-center rounded py-1 border shadow-sm ${valorCriterio >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : valorCriterio >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                          {valorCriterio}%
                        </span>
                      </div>
                    </div>
                  )})}
                </div>
              </div>

      {/* 📜 HISTORIAL COMPLETO DE CALIFICACIONES REALIZADAS (CON BOTÓN DE DESGLOSE) */}
              {(() => {
                const historial = modalEval.planes[0]?.historialEvaluaciones || 
                  (modalEval.planes[0]?.evaluacionHolistica ? [modalEval.planes[0].evaluacionHolistica] : []);
                
                if (historial.length === 0) return null;

                return (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-inner mb-4">
                    <h4 className="text-[10px] font-black text-[#0A3B32] uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span>📜</span> Historial de Evaluaciones ({historial.length})
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {historial.map((ev, hIdx) => (
                        <div 
                          key={hIdx} 
                          className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-2 text-xs shadow-sm transition-all hover:border-[#0A3B32]"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`px-2.5 py-1 rounded-lg font-black text-[10px] font-mono shrink-0 ${ev.aprobado ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                              {ev.puntaje}% ({ev.aprobado ? 'APROBADO' : 'RECHAZADO'})
                            </span>
                            <div className="truncate">
                              <p className="font-bold text-slate-800 text-[11px]">{ev.fecha}</p>
                              {ev.justificacion && (
                                <p className="text-[10px] text-slate-500 italic mt-0.5 truncate max-w-md">
                                  "{ev.justificacion}"
                                </p>
                              )}
                            </div>
                          </div>
                          
                         <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                            {hIdx === 0 && <span className="bg-blue-100 text-blue-800 text-[9px] font-black px-2 py-1 rounded uppercase">Más Reciente</span>}
                            
                            {/* ✨ BOTÓN DE ELIMINAR: SOLO VISIBLE PARA ADMINISTRADORES */}
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleEliminarEvaluacion(hIdx)}
                                className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-sm border border-red-200 cursor-pointer"
                                title="Eliminar esta evaluación (Solo Administradores)"
                              >
                                <span>🗑️</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setEvalDetalleModal(ev)}
                              className="bg-[#0A3B32] hover:bg-[#062620] text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                            >
                              <span>🔍</span>
                              <span>Ver Desglose</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Dictamen / Justificación de Auditoría</label>
                  <textarea 
                    value={justificacion || ''}
                    onChange={(e) => setJustificacion(e.target.value)}
                    disabled={modalEval.isReadOnly}
                    placeholder="Escriba la justificación (obligatoria si el puntaje es inferior al 80%)..."
                    className={`w-full border rounded-xl p-4 text-xs font-medium outline-none min-h-[120px] transition-all shadow-sm ${modalEval.isReadOnly ? 'bg-slate-100 text-slate-600 cursor-not-allowed' : (puntajeHolistico < 80 && (!justificacion || justificacion.trim() === '') ? 'border-red-300 bg-red-50 focus:border-red-500' : 'border-slate-300 bg-slate-50 focus:bg-white focus:border-[#0A3B32]')}`}
                  />
                  {!modalEval.isReadOnly && puntajeHolistico < 80 && !justificacion.trim() && <span className="text-[9px] font-bold text-red-500 block">⚠️ La justificación es obligatoria para un resultado inferior al 80%.</span>}
                </div>
                
              <div className="w-full md:w-64 flex flex-col gap-4 shrink-0">
                  <div className="bg-slate-900 rounded-2xl p-5 flex flex-col justify-center items-center text-center shadow-lg relative overflow-hidden flex-1">
                    <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl opacity-20 ${evaluacionAprobadaVisible ? 'bg-emerald-400' : (puntajeHolistico || 0) >= 50 ? 'bg-amber-400' : 'bg-rose-400'}`}></div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-2 relative z-10">Score Ponderado</p>
                    <span className={`text-6xl font-black font-mono leading-none relative z-10 ${evaluacionAprobadaVisible ? 'text-emerald-400' : (puntajeHolistico || 0) >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                      {puntajeHolistico || 0}<span className="text-3xl text-slate-500 ml-1">%</span>
                    </span>
                    <span className={`mt-4 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider relative z-10 shadow-sm ${evaluacionAprobadaVisible ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50' : (puntajeHolistico || 0) >= 50 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50' : 'bg-rose-500/20 text-rose-300 border border-rose-500/50'}`}>
                      {modalEval.isReadOnly ? evaluacionAprobadaVisible ? 'Aprobada' : 'No aprobada' : evaluacionAprobadaVisible ? '✅ Habilitará la ejecución' : '⚠️ Requiere ajustes'}
                    </span>
                  </div>
                </div>
              </div>

            </div>

            <div className="bg-slate-50 border-t border-slate-200 p-5 flex flex-col md:flex-row justify-between items-center gap-3 shrink-0">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center md:text-left">
                {modalEval.isReadOnly 
                  ? "Esta es una vista histórica de solo lectura. No se puede modificar." 
                  : `La calificación se aplicará en lote a las ${modalEval?.planes?.length || 0} actividades seleccionadas.`}
              </span>
              <div className="flex gap-3 w-full md:w-auto">
                {modalEval.isReadOnly ? (
                  <button type="button" onClick={cerrarModalEvaluacionIntegral} className="min-h-11 w-full md:w-auto px-8 py-3 rounded-xl text-xs font-black text-white bg-slate-800 hover:bg-slate-900 transition-colors uppercase tracking-widest shadow-sm">
                    Cerrar Visualización
                  </button>
                ) : (
                  <>
                    <button type="button" onClick={cerrarModalEvaluacionIntegral} className="min-h-11 w-full md:w-auto px-5 py-3 rounded-xl text-xs font-black text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 transition-colors uppercase tracking-widest shadow-sm">
                      Cancelar
                    </button>
                    <button type="button" disabled={guardandoEvaluacionInicial} onClick={confirmarEvaluacionHolistica} className={`w-full md:w-auto px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-all flex items-center justify-center gap-2 text-white disabled:opacity-50 ${puntajeHolistico >= 80 ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                      {guardandoEvaluacionInicial ? 'Guardando…' : puntajeHolistico >= 80 ? '✅ Aprobar y habilitar ejecución' : '✕ Devolver diseño para ajustes'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ⏳ OVERLAY SUTIL DE PROCESAMIENTO DE PDF */}
      {generandoPdfId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[9999] flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white p-6 rounded-2xl shadow-2xl border border-slate-200 flex flex-col items-center gap-4 max-w-sm w-full mx-4 text-center animate-in zoom-in-95">
            <div className="w-10 h-10 border-4 border-[#0A3B32] border-t-transparent rounded-full animate-spin" aria-hidden="true"></div>
            <div aria-live="polite" aria-atomic="true">
              <h4 className="font-black text-slate-800 text-sm uppercase tracking-wider">Generando Reporte Oficial</h4>
              <p className="text-slate-500 text-xs font-bold mt-1">{pdfProgress}</p>
            </div>
            <div className="w-full h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Generando PDF">
              <div className="h-full w-full rounded-full bg-[#0A3B32] animate-pulse" />
            </div>
          </div>
        </div>
      )}
{/* 🔍 MINI-MODAL SUTIL: DESGLOSE PUNTO POR PUNTO DE EVALUACIÓN HISTÓRICA */}
      {evalDetalleModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95">
            
            {/* Cabecera */}
            <div className="bg-[#0A3B32] p-4 flex justify-between items-center text-white shrink-0">
              <div>
                <h4 className="font-black text-sm flex items-center gap-2">
                  <span>📊</span> Detalle de Criterios Evaluados
                </h4>
                <p className="text-emerald-100 text-[10px] font-medium mt-0.5">
                  Registro del {evalDetalleModal.fecha}
                </p>
              </div>
              <button 
                onClick={() => setEvalDetalleModal(null)} 
                className="text-emerald-100 hover:text-white font-black text-lg px-2 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Cuerpo de Criterios */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              
              {/* Badge de Score Global */}
              <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Resultado Global</span>
                  <span className={`text-xs font-black uppercase ${evalDetalleModal.aprobado ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {evalDetalleModal.aprobado ? '✅ PLAN VIABLE (APROBADO)' : '❌ PLAN RECHAZADO'}
                  </span>
                </div>
                <span className={`text-3xl font-black font-mono px-4 py-1 rounded-xl border ${evalDetalleModal.aprobado ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                  {evalDetalleModal.puntaje}%
                </span>
              </div>

              {/* Lista de los 5 Criterios COSO */}
              <div className="space-y-2.5">
                <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b pb-1">
                  Calificación por Parámetro Técnico
                </h5>
                
                {[
                  { id: 'c1', nombre: 'Completitud y Cobertura (30%)', desc: 'Atención a todos los hallazgos' },
                  { id: 'c2', nombre: 'Análisis de Causa Raíz (20%)', desc: 'Ataque a la causa profunda' },
                  { id: 'c3', nombre: 'Planes de Choque Inmediato (20%)', desc: 'Acciones de contingencia cortas' },
                  { id: 'c4', nombre: 'Temporalidad y Fechas (20%)', desc: 'Coherencia en tiempos' },
                  { id: 'c5', nombre: 'Controles e Indicadores (10%)', desc: 'KRIs/KPIs medibles' }
                ].map(item => {
                  const nota = evalDetalleModal.criterios?.[item.id] ?? 100;
                  return (
                    <div key={item.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-xs space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-800">{item.nombre}</span>
                        <span className={`font-mono font-black text-[11px] px-2 py-0.5 rounded border ${nota >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : nota >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                          {nota}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${nota >= 80 ? 'bg-emerald-500' : nota >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                          style={{ width: `${nota}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Justificación completa */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                  Dictamen / Observación Registrada
                </span>
                <p className="text-xs font-medium text-slate-700 italic leading-relaxed whitespace-pre-wrap">
                  "{evalDetalleModal.justificacion || 'Sin observaciones adicionales registradas.'}"
                </p>
              </div>

            </div>

            {/* Cierre */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end shrink-0">
              <button 
                type="button"
                onClick={() => setEvalDetalleModal(null)} 
                className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm transition-all cursor-pointer"
              >
                Cerrar Detalle
              </button>
            </div>

          </div>
        </div>
      )}
     {/* 🛑 MODAL SUTIL PARA JUSTIFICACIÓN "NO APLICA" */}
      {modalNoAplica?.activo && (
        <div role="dialog" aria-modal="true" aria-labelledby="no-aplica-titulo" onKeyDown={event => { if (event.key === 'Escape') cerrarModalNoAplica(); }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95">
            <div className="bg-slate-800 p-4 flex justify-between items-center text-white shrink-0">
              <h4 id="no-aplica-titulo" className="font-black text-sm flex items-center gap-2">
                <span>🛑</span> Justificación de Inaplicabilidad
              </h4>
              <button type="button" aria-label="Cerrar justificación" onClick={cerrarModalNoAplica} className="min-h-11 min-w-11 text-slate-300 hover:text-white font-black text-lg px-2">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 font-medium">
                Por favor, detalla los argumentos técnicos, normativos o de proceso por los cuales este hallazgo <strong>no requiere</strong> un plan de acción correctivo. Esta observación quedará registrada en el historial de auditoría.
              </p>
              <label htmlFor="justificacion-no-aplica" className="block text-xs font-bold text-slate-700">Justificación</label>
              <textarea
                id="justificacion-no-aplica"
                autoFocus
                value={modalNoAplica.justificacionTemporal}
                onChange={(e) => setModalNoAplica(prev => ({ ...prev, justificacionTemporal: e.target.value }))}
                placeholder="Ej: El hallazgo fue subsanado en campo el día de la visita, según consta en el acta X..."
                className="w-full border border-slate-300 rounded-xl p-4 text-xs font-medium outline-none min-h-[120px] focus:border-slate-800 bg-slate-50 focus:bg-white transition-colors resize-y shadow-sm"
              />
            </div>
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-3 shrink-0">
              <button type="button" onClick={cerrarModalNoAplica} className="min-h-11 bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm transition-all">Cancelar</button>
              <button type="button" onClick={confirmarNoAplica} className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm transition-all">Guardar Observación</button>
            </div>
          </div>
        </div>
      )}  
      {modalEficaciaCierre.activo && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="evaluacion-eficacia-titulo"
            className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-2xl animate-in zoom-in-95 duration-200"
          >
            <header className="flex items-start justify-between gap-4 bg-[#0A3B32] px-5 py-4 text-white sm:px-7">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-200">Cierre del plan · Verificación final</p>
                <h2 id="evaluacion-eficacia-titulo" className="mt-1 text-lg font-black sm:text-xl">Evaluación de eficacia</h2>
                <p className="mt-1 text-[11px] font-medium text-emerald-100">
                  PLA-{String(modalEficaciaCierre.plan?.id || '').slice(-4)} · {modalEficaciaCierre.plan?.responsable || 'Responsable no asignado'}
                </p>
              </div>
              <button
                type="button"
                disabled={guardandoEficaciaCierre}
                onClick={cerrarModalEficacia}
                aria-label="Cerrar evaluación de eficacia"
                className="rounded-lg px-2 text-xl font-bold text-emerald-100 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                ×
              </button>
            </header>

            <div className="space-y-5 overflow-y-auto p-5 sm:p-7">
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
                <span className="text-lg" aria-hidden="true">✓</span>
                <div>
                  <p className="text-xs font-black text-emerald-900">La acción llegó al 100% de avance</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-emerald-800">Registra la conclusión de la verificación antes de cerrar el ciclo de mejora.</p>
                </div>
              </div>

              <div>
                <label htmlFor="conclusion-eficacia" className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-600">
                  Conclusión de eficacia <span className="text-rose-600">· Obligatoria</span>
                </label>
                <textarea
                  id="conclusion-eficacia"
                  rows="3"
                  maxLength={2000}
                  value={modalEficaciaCierre.conclusion}
                  onChange={event => setModalEficaciaCierre(prev => ({ ...prev, conclusion: event.target.value }))}
                  placeholder="Resume la evidencia revisada y cómo demuestra el resultado de la acción..."
                  className="w-full resize-y rounded-xl border border-slate-300 bg-slate-50 p-3 text-xs font-medium text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <fieldset>
                <legend className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-600">¿La acción fue eficaz?</legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {[
                    { value: 'si', title: 'Sí, fue eficaz', detail: 'Se confirma el resultado y se cierra la acción.', selected: 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-100' },
                    { value: 'no', title: 'No fue eficaz', detail: 'Se devuelve al ejecutor para realizar ajustes.', selected: 'border-rose-400 bg-rose-50 text-rose-950 ring-2 ring-rose-100' },
                  ].map(option => (
                    <label key={option.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${modalEficaciaCierre.fueEficaz === option.value ? option.selected : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                      <input
                        type="radio"
                        name="fue-eficaz"
                        value={option.value}
                        checked={modalEficaciaCierre.fueEficaz === option.value}
                        onChange={event => setModalEficaciaCierre(prev => ({ ...prev, fueEficaz: event.target.value }))}
                        className="mt-0.5 h-4 w-4 accent-emerald-700"
                      />
                      <span>
                        <span className="block text-xs font-black">{option.title}</span>
                        <span className="mt-0.5 block text-[10px] leading-relaxed opacity-75">{option.detail}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-600">¿Requiere acciones adicionales?</legend>
                <div className="flex gap-2">
                  {[
                    { value: 'si', label: 'Sí, requiere acciones' },
                    { value: 'no', label: 'No requiere acciones' },
                  ].map(option => (
                    <label key={option.value} className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-[10px] font-bold transition-colors ${modalEficaciaCierre.requiereAcciones === option.value ? 'border-slate-700 bg-slate-100 text-slate-900' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                      <input
                        type="radio"
                        name="requiere-acciones-adicionales"
                        value={option.value}
                        checked={modalEficaciaCierre.requiereAcciones === option.value}
                        onChange={event => setModalEficaciaCierre(prev => ({ ...prev, requiereAcciones: event.target.value }))}
                        className="h-3.5 w-3.5 accent-slate-700"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <label htmlFor="observaciones-eficacia" className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-600">
                  Observaciones {modalEficaciaCierre.fueEficaz === 'no' && <span className="text-rose-600">· Obligatoria para devolver la acción</span>}
                </label>
                <textarea
                  id="observaciones-eficacia"
                  rows="2"
                  maxLength={2000}
                  value={modalEficaciaCierre.observaciones}
                  onChange={event => setModalEficaciaCierre(prev => ({ ...prev, observaciones: event.target.value }))}
                  placeholder="Indica qué debe corregirse o agrega una observación de cierre..."
                  className="w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-xs font-medium text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              {modalEficaciaCierre.fueEficaz && (
                <p className={`rounded-lg px-3 py-2.5 text-[10px] font-bold ${modalEficaciaCierre.fueEficaz === 'si' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                  {modalEficaciaCierre.fueEficaz === 'si'
                    ? 'Al guardar, quedará registrada la conclusión y la acción pasará a estado Cerrado.'
                    : 'Al guardar, la acción volverá a Ejecución (90%) y se notificará al responsable para su ajuste.'}
                </p>
              )}
            </div>

            <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
              <button
                type="button"
                disabled={guardandoEficaciaCierre}
                onClick={cerrarModalEficacia}
                className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={guardandoEficaciaCierre || !modalEficaciaCierre.conclusion.trim() || !modalEficaciaCierre.fueEficaz || (modalEficaciaCierre.fueEficaz === 'no' && !modalEficaciaCierre.observaciones.trim())}
                onClick={guardarEvaluacionEficaciaCierre}
                className={`rounded-lg px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${modalEficaciaCierre.fueEficaz === 'no' ? 'bg-rose-700 hover:bg-rose-800' : 'bg-emerald-700 hover:bg-emerald-800'}`}
              >
                {guardandoEficaciaCierre ? 'Guardando...' : modalEficaciaCierre.fueEficaz === 'no' ? 'Guardar y devolver al ejecutor' : 'Guardar eficacia y cerrar'}
              </button>
            </footer>
          </section>
        </div>
      )}
      {confirmacionCierreEficaz && (
        <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="cierre-eficaz-confirmado-titulo"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200"
          >
            <div className="bg-emerald-700 px-6 py-5 text-white">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-2xl font-black" aria-hidden="true">✓</span>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-100">Evaluación guardada</p>
                  <h2 id="cierre-eficaz-confirmado-titulo" className="mt-0.5 text-base font-black">Cierre confirmado</h2>
                </div>
              </div>
            </div>
            <div className="space-y-3 p-6">
              <p className="text-xs leading-relaxed text-slate-700">
                La eficacia quedó registrada para <strong>PLA-{String(confirmacionCierreEficaz.id).slice(-4)}</strong>
                {confirmacionCierreEficaz.accion ? ` · ${confirmacionCierreEficaz.accion}` : ''}.
              </p>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-900">Estado de la acción</span>
                <span className="rounded-full bg-emerald-700 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white">Cerrado</span>
              </div>
              <p className="text-[10px] text-slate-500">La acción ya aparece como cerrada en el Historial Matriz.</p>
            </div>
            <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmacionCierreEficaz(null)}
                className="rounded-lg bg-emerald-700 px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white shadow-sm transition-colors hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                Entendido
              </button>
            </div>
          </section>
        </div>
      )}
      {/* 📜 MODAL DE HISTORIAL DE CAMBIOS (ESTILO AUDIT TRAIL) */}
      {historialModal.activo && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95">
            
            <div className="bg-slate-900 p-5 flex justify-between items-center text-white shrink-0">
              <div>
                <h4 className="font-black text-sm flex items-center gap-2 uppercase tracking-widest">
                  <span>📜</span> Audit Trail / Historial de Trazabilidad
                </h4>
                <p className="text-slate-400 text-[10px] font-bold mt-1">
                  PLA-{historialModal.plan?.id?.toString().slice(-4)} | Control de Cambios Estricto
                </p>
              </div>
              <button onClick={() => setHistorialModal({ activo: false, plan: null })} className="text-slate-400 hover:text-white font-black text-xl px-2 cursor-pointer">✕</button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50">
              <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm mb-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Acción / Tarea Actual</p>
                <p className="text-xs font-bold text-slate-800">{historialModal.plan?.accion}</p>
              </div>

              {(!historialModal.plan?.historialCambios || historialModal.plan.historialCambios.length === 0) ? (
                <div className="text-center p-8">
                  <span className="text-4xl opacity-50">📂</span>
                  <p className="text-slate-500 font-bold text-xs mt-3">No hay historial registrado para esta actividad.</p>
                </div>
              ) : (
                <div className="relative border-l-2 border-slate-200 ml-4 space-y-6 pb-4">
                  {[...historialModal.plan.historialCambios].reverse().map((log, idx) => (
                    <div key={idx} className="relative pl-6">
                      <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-white border-4 border-slate-800 shadow-sm"></div>
                      
                      <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm hover:border-slate-300 transition-colors">
                        <div className="flex justify-between items-start gap-4 mb-2">
                          <div>
                            <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest">
                              {log.accion}
                            </span>
                            <p className="text-[10px] text-slate-500 font-bold mt-1.5 flex items-center gap-1">
                              <span>👤 {log.usuario || 'Auditor GCM'}</span>
                              <span>•</span>
                              <span>📅 {log.fecha}</span>
                            </p>
                          </div>
                        </div>

                        {log.motivo && (
                          <div className="mt-3 bg-orange-50 border border-orange-100 rounded-lg p-2.5">
                            <span className="text-[9px] font-black text-orange-800 uppercase tracking-widest block mb-1">Justificación del Cambio:</span>
                            <p className="text-xs text-orange-900 font-medium italic">"{log.motivo}"</p>
                          </div>
                        )}

                        {log.detalleCambios && log.detalleCambios.length > 0 && (
                          <div className="mt-3">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Campos Modificados:</span>
                            <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                              <table className="w-full text-left text-[10px]">
                                <thead className="bg-slate-100 text-slate-500">
                                  <tr>
                                    <th className="px-3 py-1.5 font-bold w-1/3">Campo</th>
                                    <th className="px-3 py-1.5 font-bold w-1/3 text-rose-600">Valor Anterior</th>
                                    <th className="px-3 py-1.5 font-bold w-1/3 text-emerald-600">Nuevo Valor</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {log.detalleCambios.map((c, i) => (
                                    <tr key={i}>
                                      <td className="px-3 py-2 font-bold text-slate-700">{c.campo}</td>
                                      <td className="px-3 py-2 text-slate-500 line-through bg-rose-50/30">{c.antes || '(Vacío)'}</td>
                                      <td className="px-3 py-2 font-bold text-slate-800 bg-emerald-50/30">{c.despues || '(Vacío)'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-white border-t border-slate-200 p-4 flex justify-end shrink-0">
              <button onClick={() => setHistorialModal({ activo: false, plan: null })} className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-sm transition-all">Cerrar Historial</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}