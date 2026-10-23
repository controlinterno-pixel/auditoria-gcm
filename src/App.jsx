import { useMemo, useCallback, lazy, Suspense, useState, useEffect, useRef } from 'react';
import { ArrowLeft, MailWarning, RefreshCw } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from './services/firebase';
import { markSignOutReason } from './services/authDiagnostics';
import {
  consumeUpdateNotice, reloadForFreshAssets, reloadPreservingContext, rememberNavigation,
  UPDATE_AVAILABLE_EVENT, UPDATE_NOTICE_MESSAGE
} from './services/appUpdate';
import AppErrorBoundary from './components/AppErrorBoundary';
import { formatSafeDate, calcularMatriz5x5, applyFilters } from './utils/helpers';
import { esInformePrograma, pendienteEvaluacionInicial, ESTADO_AJUSTES_INICIALES } from './utils/programPlanWorkflow.js';

import Configuracion from './components/Configuracion';
import Hallazgos from './components/Hallazgos';
import Incidentes from './components/Incidentes';
import Planes from './components/Planes';
import Trazabilidad from './components/Trazabilidad';
import Evaluaciones from './components/Evaluaciones';
import Riesgos from './components/Riesgos';
import Apetito from './components/Apetito';
import PlanAnual from './components/PlanAnual';
import ProgramasAuditoria from './components/ProgramasAuditoria'; 
import AuditorIA from './components/AuditorIA';
import InformesAuditoria from './components/InformesAuditoria';

// 🔄 Si una pestaña conserva un chunk de un deployment anterior, recarga una vez para obtener el HTML vigente.
// Con cambios sin guardar no recarga: AppErrorBoundary ofrece actualizar cuando el usuario decida.
const lazyWithReload = (importFn) =>
  lazy(() =>
    importFn().catch((err) => {
      if (reloadForFreshAssets()) {
        return new Promise(() => {}); // Mantiene la promesa pendiente mientras recarga
      }
      throw err; // Si ya se intentó recargar, deja que el ErrorBoundary lo maneje
    })
  );

// 🚀 Carga perezosa (Lazy Loading) de módulos secundarios/pesados
const FuentesDeMejora = lazyWithReload(() => import('./components/FuentesDeMejora'));
const CargosProcesos = lazyWithReload(() => import('./components/CargosProcesos'));
const Comites = lazyWithReload(() => import('./components/Comites'));
const ConceptMapper = lazyWithReload(() => import('./components/AuditoriaAutomatizada/ConceptMapper'));
const DashboardEjecutivo = lazyWithReload(() => import('./components/DashboardEjecutivo'));
const Reporte360 = lazyWithReload(() => import('./components/Reporte360'));
import MiEspacio from './components/MiEspacio';
import ModalIA from './components/ModalIA';
import ModalDetalleGrafico from './components/ModalDetalleGrafico';
import WelcomeScreen from './components/WelcomeScreen';
import AuthScreen from './components/AuthScreen';
import ResetPassword from './components/ResetPassword';
import { FilterInput, StepIndicatorHUD, HeaderFiltros } from './components/UIComponents';
import Navbar from './components/Navbar';
import SidebarNavigation from './components/SidebarNavigation';
import MiPerfil from './components/MiPerfil';
import { useNavigationGuard } from './hooks/useUnsavedChangesGuard.js';
import { useDeleteConfirmation } from './hooks/useDeleteConfirmation.js';

import { enviarCorreoGmail, prepararAutorizacionGmail } from './services/gmailService';
import { useGrcData } from './hooks/useGrcData';
import { useGrcUI } from './hooks/useGrcUI';
import { useGrcPeriodFilters } from './hooks/useGrcPeriodFilters';
import { createFormHandlers } from './handlers/grcFormHandlers';
import { exportToExcel, exportToJSON, saveToCloud as syncCloud } from './services/grcStorageService';
import { executeAuditorQuery } from './handlers/auditorIaHandler';
import { processExcelRiesgos } from './utils/excelImporter';
import { analizarEvidenciaDocumento } from './services/copilotService';
import { apiService } from './services/apiService';
import { defaultCronograma } from './constants/defaultData';
import { restaurarCronogramaOficial } from './utils/cronogramaOficial';
import { CatalogosProvider } from './context/CatalogosContext.jsx';
import { vigentes } from './utils/anulacion.js';


// =====================================================================
// 🛠️ FUNCIONES GLOBALES Y CÁLCULOS
// =====================================================================
// ⚡ Estado persistente para la barra colapsada
const getInitialSidebarState = () => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('grc_sidebar_collapsed');
    return saved === null ? window.innerWidth < 1280 : saved === 'true';
  }
  return false;
};


export default function App() {
  const confirmarEliminacion = useDeleteConfirmation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(getInitialSidebarState);
  const [isMobileNavigation, setIsMobileNavigation] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 767px)');
    const compact = window.matchMedia('(max-width: 1279px)');
    const updateNavigation = () => {
      const focusInNavigation = document.activeElement?.closest('#application-sidebar');
      if (focusInNavigation) document.activeElement.blur();
      setIsMobileNavigation(mobile.matches);
      setMobileNavOpen(false);
      setIsSidebarCollapsed(compact.matches || localStorage.getItem('grc_sidebar_collapsed') === 'true');
      if (focusInNavigation) requestAnimationFrame(() => document.getElementById(mobile.matches ? 'navigation-toggle' : 'sidebar-collapse')?.focus());
    };
    mobile.addEventListener('change', updateNavigation);
    compact.addEventListener('change', updateNavigation);
    return () => {
      mobile.removeEventListener('change', updateNavigation);
      compact.removeEventListener('change', updateNavigation);
    };
  }, []);
  useEffect(() => {
    if (!mobileNavOpen || !isMobileNavigation) return undefined;
    const sidebar = document.getElementById('application-sidebar');
    const trigger = document.getElementById('navigation-toggle');
    sidebar?.querySelector('button')?.focus();
    const handleKey = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileNavOpen(false);
      }
      if (event.key === 'Tab') {
        const buttons = [...sidebar.querySelectorAll('button:not(:disabled), a[href]')].filter(element => element.getClientRects().length && !element.closest('[inert]'));
        const first = buttons[0];
        const last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      trigger?.focus();
    };
  }, [mobileNavOpen, isMobileNavigation]);
  const [detallePanelPlanes, setDetallePanelPlanes] = useState(null);
  const [solicitudTareasPlanes, setSolicitudTareasPlanes] = useState(0);
  const seleccionarTareasPlanes = tipo => {
    setDetallePanelPlanes(tipo);
    setSolicitudTareasPlanes(solicitud => solicitud + 1);
  };
  const [reintentosNotificacion, setReintentosNotificacion] = useState([]);
  const [reintentandoNotificacionId, setReintentandoNotificacionId] = useState(null);
  const mainScrollAreaRef = useRef(null);
  const autoScrollTargetRef = useRef(null);
  const autoScrollFrameRef = useRef(0);
  const autoScrollDelayRef = useRef(null);

  const programarScrollDeEnfoque = useCallback((control, retraso = 0, forzarScroll = false) => {
    autoScrollTargetRef.current = control;
    if (autoScrollFrameRef.current) cancelAnimationFrame(autoScrollFrameRef.current);
    if (autoScrollDelayRef.current) window.clearTimeout(autoScrollDelayRef.current);

    const alistarScroll = () => {
      autoScrollFrameRef.current = requestAnimationFrame(() => {
        autoScrollFrameRef.current = requestAnimationFrame(() => {
          const controlActual = autoScrollTargetRef.current;
          const areaPrincipal = mainScrollAreaRef.current;
          if (!controlActual?.isConnected || !areaPrincipal?.contains(controlActual)) return;

          let destino = controlActual;
          if (controlActual.hasAttribute('aria-expanded')) {
            if (controlActual.getAttribute('aria-expanded') !== 'true') return;
            const panelId = controlActual.getAttribute('aria-controls');
            const filaActual = controlActual.closest('tr');
            const panelExpandido = panelId
              ? document.getElementById(panelId)
              : filaActual?.nextElementSibling || controlActual.nextElementSibling;
            if (panelExpandido && areaPrincipal.contains(panelExpandido)) destino = panelExpandido;
          }

          const limitesArea = areaPrincipal.getBoundingClientRect();
          const limitesDestino = destino.getBoundingClientRect();
          const estaVisible = limitesDestino.top >= limitesArea.top && limitesDestino.bottom <= limitesArea.bottom;
          if (forzarScroll || !estaVisible) destino.scrollIntoView({ behavior: 'smooth', block: 'start' });
          autoScrollTargetRef.current = null;
        });
      });
    };

    if (retraso > 0) {
      autoScrollDelayRef.current = window.setTimeout(alistarScroll, retraso);
    } else {
      alistarScroll();
    }
  }, []);

  const manejarCambioConScroll = useCallback(event => {
    const elemento = event.target instanceof HTMLElement ? event.target : null;
    if (!elemento) return;
    const filtroMarcado = elemento.closest('[data-scroll-focus="filter"]');
    if (elemento.closest('form') && !filtroMarcado) return;

    const esSelector = elemento.matches('select, input[type="checkbox"], input[type="radio"], input[type="date"]');
    const esBusqueda = elemento.matches('input[type="search"]') || /buscar/i.test(
      `${elemento.getAttribute('placeholder') || ''} ${elemento.getAttribute('aria-label') || ''}`
    );
    if (!filtroMarcado && !esSelector && !esBusqueda) return;

    const control = filtroMarcado || elemento;
    programarScrollDeEnfoque(control, esBusqueda ? 350 : 0, true);
  }, [programarScrollDeEnfoque]);

  const manejarClickConScroll = useCallback(event => {
    const elemento = event.target instanceof Element ? event.target : null;
    const control = elemento?.closest('[aria-pressed], [data-scroll-focus="filter"]');
    if (!control || (control.closest('form') && !control.matches('[data-scroll-focus="filter"]'))) return;
    programarScrollDeEnfoque(control, 0, true);
  }, [programarScrollDeEnfoque]);

  useEffect(() => () => {
    if (autoScrollFrameRef.current) cancelAnimationFrame(autoScrollFrameRef.current);
    if (autoScrollDelayRef.current) window.clearTimeout(autoScrollDelayRef.current);
  }, []);

  // 🔔 Versión nueva detectada con cambios sin guardar: se avisa en lugar de recargar
  const [actualizacionPendiente, setActualizacionPendiente] = useState(false);

  // 🛡️ BARRERA DE CONTENCIÓN: Captura errores de importación dinámica (Chunk 404 Vercel)
  useEffect(() => {
    const handlePreloadError = (event) => {
      event.preventDefault();
      reloadForFreshAssets();
    };
    const handleUpdateAvailable = () => setActualizacionPendiente(true);

    window.addEventListener('vite:preload-error', handlePreloadError);
    window.addEventListener(UPDATE_AVAILABLE_EVENT, handleUpdateAvailable);
    return () => {
      window.removeEventListener('vite:preload-error', handlePreloadError);
      window.removeEventListener(UPDATE_AVAILABLE_EVENT, handleUpdateAvailable);
    };
  }, []);

 // 1. Extraemos TODA la información de Firebase y el Backend
  const {
    user, setUser, authReady, isAdmin, setIsAdmin,
    perfilUsuario,
    isCloudLoaded, setIsCloudLoaded, showWelcome, setShowWelcome,
    setRiesgos, hallazgos, setHallazgos, planes, setPlanes,
    setIncidentes, setEvaluaciones,
    cronograma, setCronograma, setMonitoreo,
    informesAuditoria, setInformesAuditoria, setComites,
    setProgramas, fuentesMejora, setFuentesMejora,
    catalogoCargos, setCatalogoCargos, mapaProcesos, setMapaProcesos,
    sedesEmpresa, setSedesEmpresa,
    catalogosInicializados, setCatalogosInicializados,
    safePlanes, safeHallazgos, safeRiesgos, safeEvaluaciones,
    safeProgramas, safeIncidentes, safeCronograma, safeMonitoreo, safeComites
  } = useGrcData();
  const notificacionesPendientesUsuario = reintentosNotificacion.filter(item => item.propietario === String(user?.email || '').trim().toLowerCase());

  useEffect(() => {
    const areaPrincipal = mainScrollAreaRef.current;
    if (!areaPrincipal) return undefined;

    const observer = new MutationObserver(cambios => {
      const controlExpandido = cambios
        .map(cambio => cambio.target)
        .find(elemento => elemento instanceof HTMLElement && elemento.getAttribute('aria-expanded') === 'true');
      if (controlExpandido) programarScrollDeEnfoque(controlExpandido);
    });
    observer.observe(areaPrincipal, {
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-expanded'],
    });

    return () => observer.disconnect();
  }, [isCloudLoaded, showWelcome, user, programarScrollDeEnfoque]);

  // 2. El estado de autenticación lo resuelve un único listener centralizado en useGrcData (authReady)

  const toggleSidebar = () => {
    const newVal = !isSidebarCollapsed;
    setIsSidebarCollapsed(newVal);
    localStorage.setItem('grc_sidebar_collapsed', String(newVal));
  };

  const ui = useGrcUI();
  const {
    isResettingPassword, oobCode, activeTab, setActiveTab, menuAbierto, setMenuAbierto,
    subTabPlanificar, setSubTabPlanificar, subTabResultados, setSubTabResultados,
    subTabPlanes, setSubTabPlanes, subTabGobernanza, setSubTabGobernanza,
    selectedProcesoExpediente, setSelectedProcesoExpediente, notification, showNotification,
    isPresentationMode, setIsPresentationMode, formResetKey, setFormResetKey,
    searchTerm, setSearchTerm, columnFilters, setColumnFilters,
    setIsThinking, aiModal, setAiModal, chartDetail, setChartDetail,
    isSubmitting, setIsSubmitting, matrizFiltro, setMatrizFiltro,
    showAuditorIA, setShowAuditorIA, auditorInput, setAuditorInput,
    auditorRespuesta, setAuditorRespuesta, isAuditorThinking, setIsAuditorThinking,
    editRiesgo, setEditRiesgo, editPlan, setEditPlan, editEvaluacion, setEditEvaluacion,
    editHallazgo, setEditHallazgo, editIncidente, setEditIncidente, editCronograma, setEditCronograma,
    editApetito, setEditApetito, editMonitoreo, setEditMonitoreo, activeTooltip, setActiveTooltip,
    editInformeAuditoria, setEditInformeAuditoria, editComite, setEditComite
  } = ui;
  const guardNavigation = useNavigationGuard();
  const setActiveTabWithGuard = useCallback((nextTab) => {
    return guardNavigation(() => {
      if (nextTab !== activeTab) setActiveTab(nextTab);
    });
  }, [activeTab, guardNavigation, setActiveTab]);
  useEffect(() => rememberNavigation({
    activeTab, menuAbierto, subTabPlanificar, subTabResultados, subTabPlanes, subTabGobernanza,
  }), [activeTab, menuAbierto, subTabPlanificar, subTabResultados, subTabPlanes, subTabGobernanza]);

  // Tras una recarga por versión nueva, avisar cuando la pantalla principal ya es visible
  // (así nadie confunde la actualización con un cierre de sesión).
  const avisoActualizacionRevisado = useRef(false);
  useEffect(() => {
    if (avisoActualizacionRevisado.current || !user || !isCloudLoaded || showWelcome) return;
    avisoActualizacionRevisado.current = true;
    if (consumeUpdateNotice()) showNotification(UPDATE_NOTICE_MESSAGE, 'success');
  }, [user, isCloudLoaded, showWelcome, showNotification]);
  const reviewReportId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('reviewReportId')
    : null;
  const nombresVistas = {
    tablero: 'Mi Espacio GRC',
    dashboard_riesgos: 'GRC Dashboard',
    plan_anual_tab: {
      plan_anual: 'Cronograma anual',
      programas: 'Programas de Auditoría',
      riesgos: 'Matriz de Riesgos',
      apetito: 'Apetito de Riesgo',
    },
    evaluaciones: 'Trabajo de Campo',
    resultados_tab: {
      fuentes_mejora: 'Fuentes de Mejora',
      informes: 'Informes Emitidos',
      hallazgos: 'Hallazgos Registrados',
      cargos_procesos: 'Cargos y Procesos',
    },
    planes_tab: {
      planes: 'Planes de Acción',
      reporte360: 'Reporte 360',
      incidentes: 'Eventos de Pérdida',
    },
    gobernanza_tab: {
      comites: 'Sesiones de Comité',
      trazabilidad: 'Trazabilidad',
      auditoria_auto: 'Auditoría Automatizada',
    },
    config: 'Configuración',
    mi_perfil: 'Mi Perfil',
  };
  const contextoVista = {
    plan_anual_tab: subTabPlanificar,
    resultados_tab: subTabResultados,
    planes_tab: subTabPlanes,
    gobernanza_tab: subTabGobernanza,
  }[activeTab];
  const nombreVistaActual = typeof nombresVistas[activeTab] === 'string'
    ? nombresVistas[activeTab]
    : nombresVistas[activeTab]?.[contextoVista] || 'Módulo GRC';
  const puedeVerDashboard = isAdmin || perfilUsuario?.permisos?.includes('sub_dashboard') === true;
  const puedeVerFuentesMejora = isAdmin || perfilUsuario?.permisos?.includes('sub_fuentes_mejora') === true;
  const puedeVerCronograma = isAdmin || perfilUsuario?.permisos?.includes('sub_cronograma') === true;
  // Auditorías y Gobernanza solo con permiso explícito (el servidor tampoco entrega esos datos sin él).
  const puedeVerProgramas = isAdmin || perfilUsuario?.permisos?.includes('sub_programas') === true;
  const puedeVerComites = isAdmin || perfilUsuario?.permisos?.includes('sub_comites') === true;
  const puedeVerTrazabilidad = isAdmin || perfilUsuario?.permisos?.includes('sub_trazabilidad') === true;
  const puedeCrearInformes = isAdmin || perfilUsuario?.permisos?.includes('sub_informes') === true;
  const puedeCrearHallazgos = isAdmin || perfilUsuario?.permisos?.includes('sub_hallazgos') === true;
  const puedeCrearPlanes = isAdmin || perfilUsuario?.permisos?.includes('sub_seguimiento_planes') === true;

  // Riesgos anulados: se consultan en el módulo Riesgos, pero no cuentan en tableros, indicadores ni IA.
  const riesgosVigentes = useMemo(() => vigentes(safeRiesgos), [safeRiesgos]);

  const {
    defaultAnios, defaultMeses, selectedAnios, selectedMeses,
    setSelectedAnios, setSelectedMeses, handleColFilterChange,
    toggleAnio, toggleMes, incFiltrados, rFiltrados, hFiltrados,
    pFiltrados, comitesFiltrados, cFiltrados
  } = useGrcPeriodFilters({
    activeTab, subTabPlanificar, subTabResultados, subTabPlanes, subTabGobernanza,
    safeRiesgos: riesgosVigentes, safeHallazgos, safePlanes, safeIncidentes, safeCronograma, safeComites,
    setSearchTerm, setColumnFilters
  });

const saveToCloud = useCallback(async (partialData) => syncCloud(partialData, showNotification), [showNotification]);
  const exportarExcel = useCallback((datos, nombreArchivo) => exportToExcel(datos, nombreArchivo, showNotification), [showNotification]);
  // Respaldo JSON con las mismas claves que acepta el servidor, para poder restaurarlo con "Importar".
  const exportarRespaldoJSON = () => exportToJSON({
    riesgos: safeRiesgos, hallazgos: safeHallazgos, planes: safePlanes, informesAuditoria,
    evaluaciones: safeEvaluaciones, comites: safeComites, incidentes: safeIncidentes,
    cronograma: safeCronograma, monitoreo: safeMonitoreo, programas: safeProgramas,
    fuentesMejora, catalogoCargos, mapaProcesos, sedesEmpresa, catalogosInicializados,
  });

  const guardarCatalogos = async (cargos, procesos, sedes = sedesEmpresa) => {
    if (!isAdmin) return false;
    const guardado = await saveToCloud({
      catalogoCargos: cargos,
      mapaProcesos: procesos,
      sedesEmpresa: sedes,
      catalogosInicializados: true,
    });
    if (!guardado) {
      showNotification('No se pudo guardar el catálogo de cargos y procesos.', 'error');
      return false;
    }
    setCatalogoCargos(cargos);
    setMapaProcesos(procesos);
    setSedesEmpresa(sedes);
    setCatalogosInicializados(true);
    return true;
  };

  const eliminarCargoCatalogo = async id => {
    if (!isAdmin) return false;
    const respuesta = await apiService.eliminarCargoCatalogo(id);
    if (!Array.isArray(respuesta?.catalogoCargos)) {
      throw new Error('El servidor no devolvió el catálogo actualizado.');
    }
    setCatalogoCargos(respuesta.catalogoCargos);
    return true;
  };
  

  const handleDeleteItem = async (listType, id) => {
    if (!isAdmin) return;
    const mapLists = { 
      riesgos: [safeRiesgos, setRiesgos], evaluaciones: [safeEvaluaciones, setEvaluaciones], 
      hallazgos: [safeHallazgos, setHallazgos], planes: [safePlanes, setPlanes], 
      incidentes: [safeIncidentes, setIncidentes], cronograma: [safeCronograma, setCronograma], 
      monitoreo: [safeMonitoreo, setMonitoreo], informesAuditoria: [informesAuditoria, setInformesAuditoria], 
      comites: [safeComites, setComites], programas: [safeProgramas, setProgramas] 
    };
    const [targetList, setTarget] = mapLists[listType] || [];
    if (targetList && setTarget) {
      const registro = targetList.find(item => String(item.id) === String(id));
      const nombre = registro?.ref || registro?.titulo || registro?.nombre || id;
      const vinculados = listType === 'informesAuditoria'
        ? ' También se eliminarán sus hallazgos y planes de acción vinculados.'
        : listType === 'hallazgos' ? ' También se eliminarán sus planes de acción vinculados.' : '';
      if (!(await confirmarEliminacion(`Se eliminará el registro ${nombre}.${vinculados}`))) return;
      const updated = targetList.filter(item => item.id !== id);
      if (listType === 'hallazgos' || listType === 'informesAuditoria') {
        const hallazgosEliminados = listType === 'informesAuditoria'
          ? safeHallazgos.filter(hallazgo => String(hallazgo.idInforme) === String(id))
          : safeHallazgos.filter(hallazgo => String(hallazgo.id) === String(id));
        const idsHallazgosEliminados = new Set(hallazgosEliminados.map(hallazgo => String(hallazgo.id)));
        const hallazgosActualizados = listType === 'informesAuditoria'
          ? safeHallazgos.filter(hallazgo => String(hallazgo.idInforme) !== String(id))
          : safeHallazgos;
        const planesActualizados = safePlanes.filter(plan => (
          listType === 'informesAuditoria'
            ? String(plan.idInforme || '') !== String(id) && !idsHallazgosEliminados.has(String(plan.idHallazgo))
            : String(plan.idHallazgo) !== String(id)
        ));
        const guardado = await saveToCloud({
          [listType]: updated,
          ...(listType === 'informesAuditoria' ? { informesEliminados: [String(id)] } : {}),
          ...(listType === 'informesAuditoria' ? { hallazgos: hallazgosActualizados } : {}),
          planes: planesActualizados,
        });
        if (!guardado) {
          showNotification('No se pudo eliminar el registro y sus planes vinculados.', 'error');
          return;
        }
        setTarget(updated);
        if (listType === 'informesAuditoria') setHallazgos(hallazgosActualizados);
        setPlanes(planesActualizados);
        showNotification(`Registro eliminado. ${safePlanes.length - planesActualizados.length} plan(es) vinculado(s) eliminado(s).`, 'success');
        return;
      }

      const guardado = await saveToCloud({ [listType]: updated });
      if (!guardado) return;
      setTarget(updated);
      showNotification('Registro eliminado.', 'success');
    }
  };

  const scrollToForm = () => {
    setTimeout(() => {
      const formEl = document.getElementById('edit-form');
      const mainArea = document.getElementById('main-scroll-area');
      if (formEl && mainArea) mainArea.scrollTo({ top: formEl.offsetTop - 20, behavior: 'smooth' });
      else if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  const handleAuditorSubmit = async (e, textoDirecto = null) => {
    if (e) e.preventDefault();
    await executeAuditorQuery({ 
      textoDirecto, auditorInput, setIsAuditorThinking, setAuditorRespuesta, 
      setAiModal, safeRiesgos: riesgosVigentes, safeHallazgos, safePlanes, safeIncidentes, 
      safeCronograma, safeEvaluaciones, safeMonitoreo, informesAuditoria 
    });
    setAuditorInput('');
  };

 const handleLogout = async () => { 
    try {
      markSignOutReason('manual');
      await apiService.logout();
      await signOut(auth);
      setUser(null); 
      setIsAdmin(false); 
      setShowWelcome(true); 
      window.location.reload(); 
    } catch { 
      window.location.reload(); 
    }
  };
  const handleImportJSON = (e) => {
  const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        if (await confirmarEliminacion('Se eliminarán los datos actuales de todos los módulos y se reemplazarán por el archivo de respaldo seleccionado.')) {
          setIsCloudLoaded(false);
          const respaldo = JSON.parse(event.target.result);
          // Restaurar un respaldo (ya confirmado arriba) reemplaza también la matriz de riesgos.
          await saveToCloud(Array.isArray(respaldo?.riesgos) ? { ...respaldo, riesgosReemplazoTotal: true } : respaldo);
          showNotification("Base de datos actualizada.", "success"); setIsCloudLoaded(true);
        }
      } catch { showNotification("Error: Formato JSON no válido.", "error"); }
      e.target.value = null;
    };
    reader.readAsText(file);
  };

  const handleImportExcelRiesgos = (e) => processExcelRiesgos({ event: e, safeRiesgos, setRiesgos, saveToCloud, showNotification, setIsCloudLoaded, user, confirmarEliminacion });
  // Restaura los 20 procesos oficiales conservando el cargo responsable y de apoyo que cada proceso
  // ya tenía (la plantilla no incluye nombres de personas: H11).
  const forceUpdateCronograma = async () => {
    if (!(await confirmarEliminacion('Se reemplazará el cronograma actual por los 20 procesos oficiales del Plan Anual. Se conservan los cargos responsables y de apoyo ya asignados.'))) return;
    const cronogramaRestaurado = restaurarCronogramaOficial(defaultCronograma, safeCronograma);
    if (await saveToCloud({ cronograma: cronogramaRestaurado })) {
      setCronograma(cronogramaRestaurado);
      showNotification("¡Plan Anual actualizado!", "success");
    }
  };
  const analizarEvidenciaIA = (evidenciaUrl, contextoItem, tipoItem) => analizarEvidenciaDocumento(evidenciaUrl, contextoItem, tipoItem, setIsThinking, showNotification, setAiModal);
  const ejecutarDespachoGmailApi = useCallback((emailParams) => enviarCorreoGmail(emailParams, user?.email, showNotification), [user, showNotification]);
  const prepararEnvioGmail = useCallback(() => prepararAutorizacionGmail(user?.email, showNotification), [user, showNotification]);
  const encolarReintentoNotificacion = useCallback((payload, contexto = {}) => {
    if (!payload?.destinatarios) return false;
    const id = globalThis.crypto?.randomUUID?.() || `email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setReintentosNotificacion(prev => [{
      id,
      propietario: String(user?.email || '').trim().toLowerCase(),
      payload,
      tipo: contexto.tipo || 'general',
      informeId: contexto.informeId || null,
      destinatarios: contexto.destinatarios || String(payload.destinatarios),
      correoEnviado: contexto.correoEnviado === true,
      creadoEn: new Date().toISOString(),
      intentos: 0,
    }, ...prev].slice(0, 30));
    return true;
  }, [user?.email]);
  const reintentarNotificacion = async item => {
    if (!item || item.propietario !== String(user?.email || '').trim().toLowerCase() || reintentandoNotificacionId) return;
    setReintentandoNotificacionId(item.id);
    setReintentosNotificacion(prev => prev.map(actual => actual.id === item.id ? { ...actual, intentos: actual.intentos + 1 } : actual));
    let correoEnviado = item.correoEnviado;

    try {
      if (!correoEnviado) {
        correoEnviado = await enviarCorreoGmail(item.payload, user?.email, showNotification, { forcePrompt: true });
        if (!correoEnviado) return;
        setReintentosNotificacion(prev => prev.map(actual => actual.id === item.id ? { ...actual, correoEnviado: true } : actual));
      }

      if (item.tipo === 'informe' && item.informeId) {
        const fechaCorreoEnviado = new Date().toLocaleString();
        const respuesta = await apiService.registrarCorreoInforme(item.informeId, item.destinatarios, fechaCorreoEnviado);
        if (!respuesta?.informe) {
          setReintentosNotificacion(prev => prev.map(actual => actual.id === item.id ? { ...actual, correoEnviado: true } : actual));
          showNotification('El correo ya se envió, pero falta registrar ese envío. Reintenta el registro desde la bandeja.', 'error');
          return;
        }
        setInformesAuditoria(prev => prev.map(informe => String(informe.id) === String(item.informeId) ? respuesta.informe : informe));
      }

      setReintentosNotificacion(prev => prev.filter(actual => actual.id !== item.id));
      showNotification('Notificación confirmada y registrada.', 'success');
    } catch (error) {
      if (correoEnviado) {
        setReintentosNotificacion(prev => prev.map(actual => actual.id === item.id ? { ...actual, correoEnviado: true } : actual));
      }
      showNotification(error?.message || 'No se pudo completar el reintento. La notificación sigue pendiente.', 'error');
    } finally {
      setReintentandoNotificacionId(null);
    }
  };
  const {
    handleRiesgoSubmit, handleHallazgoSubmit, handlePlanSubmit, handleAprobarCierrePlan,
    handleEvaluacionSubmit, handleComiteSubmit, handleIncidenteSubmit, handleCronogramaSubmit,
    handleApetitoSubmit, handleMonitoreoSubmit, handleInformeAuditoriaSubmit
  } = useMemo(() => createFormHandlers({
    user, isAdmin, safeRiesgos, safeHallazgos, safePlanes, safeEvaluaciones, safeComites, safeIncidentes, safeCronograma, safeMonitoreo, informesAuditoria,
    editRiesgo, editHallazgo, editPlan, editEvaluacion, editComite, editIncidente, editCronograma, editApetito, editMonitoreo, editInformeAuditoria,
    setRiesgos, setHallazgos, setPlanes, setEvaluaciones, setComites, setIncidentes, setCronograma, setMonitoreo, setInformesAuditoria,
    setEditRiesgo, setEditHallazgo, setEditPlan, setEditEvaluacion, setEditComite, setEditIncidente, setEditCronograma, setEditApetito, setEditMonitoreo, setEditInformeAuditoria,
    saveToCloud, showNotification, setIsSubmitting, setFormResetKey, prepararEnvioGmail, ejecutarDespachoGmailApi, encolarReintentoNotificacion, defaultMeses,
    crearRegistroGrc: apiService.crearRegistroGrc,
    actualizarInformeGrc: apiService.actualizarInformeGrc,
    actualizarHallazgoGrc: apiService.actualizarHallazgoGrc,
    registrarCorreoInforme: apiService.registrarCorreoInforme
  }), [
    user, isAdmin, safeRiesgos, safeHallazgos, safePlanes, safeEvaluaciones, safeComites, safeIncidentes, safeCronograma, safeMonitoreo, informesAuditoria,
    editRiesgo, editHallazgo, editPlan, editEvaluacion, editComite, editIncidente, editCronograma, editApetito, editMonitoreo, editInformeAuditoria,
    setRiesgos, setHallazgos, setPlanes, setEvaluaciones, setComites, setIncidentes, setCronograma, setMonitoreo, setInformesAuditoria,
    setEditRiesgo, setEditHallazgo, setEditPlan, setEditEvaluacion, setEditComite, setEditIncidente, setEditCronograma, setEditApetito, setEditMonitoreo, setEditInformeAuditoria,
    saveToCloud, showNotification, setIsSubmitting, setFormResetKey, prepararEnvioGmail, ejecutarDespachoGmailApi, encolarReintentoNotificacion, defaultMeses
  ]);

// 🔔 Calculador de notificaciones personalizadas para la barra lateral
  const userEmailLower = String(user?.email || '').trim().toLowerCase();
  const informesIds = new Set(informesAuditoria.map(informe => String(informe.id)));
  const hallazgosPorId = new Map(safeHallazgos.map(hallazgo => [String(hallazgo.id), hallazgo]));
  const planesConOrigen = safePlanes.filter(plan => {
    const hallazgo = hallazgosPorId.get(String(plan.idHallazgo));
    const idInforme = hallazgo?.idInforme || plan.idInforme;
    return Boolean(hallazgo && idInforme && informesIds.has(String(idInforme)));
  });

  // 1. Tareas que el usuario debe EJECUTAR (Subir evidencias y avance)
  const misPlanesEjecucion = planesConOrigen.filter(p => {
    const correoEjecutor = (p.correoResponsable || '').trim().toLowerCase();
    return correoEjecutor === userEmailLower.trim() && ['En Ejecución', ESTADO_AJUSTES_INICIALES].includes(p.estadoWorkflow);
  });
  const misTareasEjecucion = misPlanesEjecucion.length;

  // 2. Tareas que el usuario debe REVISAR (Dar Visto Bueno como Jefatura)
  const misPlanesRevision = planesConOrigen.filter(p => {
    const correoRevisor = (p.correoRevisor || '').trim().toLowerCase();
    const hallazgo = safeHallazgos.find(item => String(item.id) === String(p.idHallazgo));
    const informe = informesAuditoria.find(item => String(item.id) === String(hallazgo?.idInforme || p.idInforme));
    return correoRevisor === userEmailLower.trim() &&
      (p.estadoWorkflow === 'Pendiente Validación Revisor' ||
        (p.estadoWorkflow === 'Pendiente Revisión Jefatura' && !esInformePrograma(informe, fuentesMejora)));
  });
  const misTareasRevision = misPlanesRevision.length;

  // 3. Tareas que el usuario debe APROBAR (Como Auditor)
  const normalizarIdentidad = valor => String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const misPlanesAprobacion = planesConOrigen.filter(p => {
    const hallazgo = safeHallazgos.find(item => String(item.id) === String(p.idHallazgo));
    const informe = informesAuditoria.find(item => String(item.id) === String(hallazgo?.idInforme || p.idInforme));
    const correosAuditor = [p.correoAuditor, p.correoAuditorResponsable, p.correo_auditor]
      .map(normalizarIdentidad)
      .filter(Boolean);
    const auditorAsignado = normalizarIdentidad(p.auditorAsignado || p.auditorResponsable || p.auditor);
    const identidadesUsuario = [perfilUsuario?.nombreResponsable, perfilUsuario?.nombre, perfilUsuario?.cargo]
      .map(normalizarIdentidad)
      .filter(Boolean);
    const esAuditorDelPlan = correosAuditor.length > 0
      ? correosAuditor.includes(normalizarIdentidad(userEmailLower))
      : Boolean(auditorAsignado && identidadesUsuario.includes(auditorAsignado));
    return esAuditorDelPlan &&
           ((esInformePrograma(informe, fuentesMejora) && pendienteEvaluacionInicial(p)) ||
            ['En Revisión (100%)', 'Pendiente Aprobación Auditor'].includes(p.estadoWorkflow) ||
            (!esInformePrograma(informe, fuentesMejora) && p.estadoWorkflow === 'En Ejecución' && Number(p.progreso) >= 100));
  });
  const misTareasAprobacion = misPlanesAprobacion.length;

  // El total de notificaciones para el usuario actual
  // 📜 Restablecer el scroll arriba del todo al cambiar de módulo o subpestaña (Garantizado)
  useEffect(() => {
    if (activeTab === 'planes_tab' && subTabPlanes === 'planes' && ['aprobacion', 'revision', 'ejecucion'].includes(detallePanelPlanes)) return;
    const resetScroll = () => {
      const mainArea = document.getElementById('main-scroll-area');
      if (mainArea) {
        // 'instant' invalida la animación suave que interrumpe el salto
        mainArea.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    };

    // 1. Ejecución inmediata
    resetScroll();

    // 2. Ejecución diferida para vencer cargas asíncronas y renderizado de Suspense
    const rafId = requestAnimationFrame(() => {
      resetScroll();
      setTimeout(resetScroll, 60);
    });

    return () => cancelAnimationFrame(rafId);
  }, [activeTab, subTabPlanificar, subTabResultados, subTabPlanes, subTabGobernanza, detallePanelPlanes]);
// 🛑 SI VIENE DEL CORREO, INTERCEPTAMOS Y MOSTRAMOS LA PANTALLA NUEVA
  if (isResettingPassword) return <ResetPassword oobCode={oobCode} />;

  // 🛡️ BARRERA DE CONTENCIÓN: Firebase está procesando el token guardado en caché
  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#041224] flex flex-col items-center justify-center space-y-5">
         <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
         <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest animate-pulse">Verificando Sesión...</p>
      </div>
    );
  }

  // Si la sesión es inválida o no existe, al login
  if (!user) return <AuthScreen />;
  
  // Si hay sesión pero los datos aún no descargan, mostramos el conector
  if (!isCloudLoaded) return (<div className="flex h-screen w-full items-center justify-center bg-[#041224] text-white flex-col space-y-4"><span className="text-6xl animate-bounce drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">☁️</span><h2 className="text-xs text-blue-400 font-black tracking-widest uppercase">Sincronizando Base de Datos...</h2></div>);
if (showWelcome) {
  return (
    <WelcomeScreen 
      isAdmin={isAdmin} 
      onEnter={() => setShowWelcome(false)} 
      onLogout={handleLogout} 
    />
  );
}
return (
  <CatalogosProvider
    catalogoCargos={catalogoCargos}
    mapaProcesos={mapaProcesos}
    sedesEmpresa={sedesEmpresa}
    catalogosInicializados={catalogosInicializados}
  >
    <div className="app-shell flex h-dvh bg-slate-50 warm:bg-[#f5f3ef] dark:bg-[#040914] font-sans overflow-hidden transition-colors duration-500">
      {/* BOTÓN FLOTANTE: SALIR DE MODO PRESENTACIÓN */}
      {isPresentationMode && (
        <button 
          onClick={() => setIsPresentationMode(false)} 
          className="fixed bottom-6 right-6 z-[100] bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all hover:scale-105 flex items-center space-x-2 border-2 border-slate-700 animate-in slide-in-from-bottom-10"
        >
          <span>✖</span><span>Salir de Presentación</span>
        </button>
      )}

<a href="#main-scroll-area" className="sr-only fixed left-3 top-3 z-[200] rounded-lg bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-lg focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-blue-600">
  Saltar al contenido principal
</a>

<SidebarNavigation 
        isPresentationMode={isPresentationMode}
        isCollapsed={!isMobileNavigation && isSidebarCollapsed}
        mobileNavOpen={mobileNavOpen}
        onCloseMobileNavigation={() => setMobileNavOpen(false)}
        toggleSidebar={isMobileNavigation ? () => setMobileNavOpen(false) : toggleSidebar}
        menuAbierto={menuAbierto}
        setMenuAbierto={setMenuAbierto}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        guardNavigation={guardNavigation}
        subTabPlanificar={subTabPlanificar}
        setSubTabPlanificar={setSubTabPlanificar}
        subTabResultados={subTabResultados}
        setSubTabResultados={setSubTabResultados}
        subTabPlanes={subTabPlanes}
        setSubTabPlanes={setSubTabPlanes}
        subTabGobernanza={subTabGobernanza}
        setSubTabGobernanza={setSubTabGobernanza}
        misTareasEjecucion={misTareasEjecucion} 
        misTareasRevision={misTareasRevision}   
        misTareasAprobacion={misTareasAprobacion} 
        onSelectExecutionTasks={() => seleccionarTareasPlanes('ejecucion')}
        onSelectRevisionTasks={() => seleccionarTareasPlanes('revision')}
        onSelectAprobacionTasks={() => seleccionarTareasPlanes('aprobacion')}
        isAdmin={isAdmin}
        puedeVerDashboard={puedeVerDashboard}
        puedeVerFuentesMejora={puedeVerFuentesMejora}
        puedeVerCronograma={puedeVerCronograma}
        puedeVerProgramas={puedeVerProgramas}
        puedeVerComites={puedeVerComites}
        puedeVerTrazabilidad={puedeVerTrazabilidad}
        user={user}
        handleLogout={handleLogout}
      />
      
      <div inert={isMobileNavigation && mobileNavOpen} className="min-w-0 flex-1 flex flex-col overflow-hidden relative">
<Navbar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          user={user} 
          handleLogout={handleLogout} 
          dbConnected={isCloudLoaded} 
          currentUserRole={isAdmin ? 'Administrador' : 'Usuario'} 
          isPresentationMode={isPresentationMode}
          setIsPresentationMode={setIsPresentationMode}
          onToggleNavigation={() => setMobileNavOpen(true)}
          mobileNavOpen={mobileNavOpen}
          misTareasEjecucion={misTareasEjecucion}
          misTareasRevision={misTareasRevision}
          misTareasAprobacion={misTareasAprobacion}
          onSelectTasks={tipo => guardNavigation(() => {
            setEditPlan(null);
            setSubTabPlanes('planes');
            setMenuAbierto('planes');
            seleccionarTareasPlanes(tipo);
            setActiveTab('planes_tab');
          })}
        />
{/*  Tracks de gobernanza guiada del Workflow en la cabecera */}
        {!isPresentationMode && <StepIndicatorHUD activeStep={activeTab} />}
        
<main ref={mainScrollAreaRef} onChangeCapture={manejarCambioConScroll} onClickCapture={manejarClickConScroll} id="main-scroll-area" tabIndex={-1} aria-label="Contenido principal" className={`min-h-0 min-w-0 flex-grow overflow-y-auto ${isPresentationMode ? 'p-4 sm:p-8 xl:p-12' : 'p-4 sm:p-5 xl:p-8'} bg-slate-50 warm:bg-[#FCFBF8] warm:text-[#4A3F35] dark:bg-[#070f1e] dark:text-slate-300 scroll-smooth relative transition-colors duration-500`}>
          {actualizacionPendiente && (
            <section role="status" aria-live="polite" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 shadow-sm">
              <div className="flex items-start gap-3">
                <RefreshCw size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-blue-700" />
                <p><b>Hay una versión nueva de GCM.</b> Guarda tus cambios y actualiza cuando termines; tu sesión seguirá activa.</p>
              </div>
              <button
                type="button"
                onClick={() => guardNavigation(reloadPreservingContext)}
                className="min-h-11 rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800"
              >
                Actualizar ahora
              </button>
            </section>
          )}
          <AppErrorBoundary resetKey={activeTab}>
          <Suspense fallback={<div className="flex justify-center items-center p-12 text-slate-400 font-bold text-sm uppercase tracking-widest animate-pulse">⏳ Cargando módulo...</div>}>
<div key={`${activeTab}-${subTabPlanificar}-${subTabResultados}-${subTabPlanes}-${subTabGobernanza}`} className={`app-content @container ${isPresentationMode ? 'max-w-none' : 'max-w-[1600px]'} min-w-0 w-full mx-auto transition-all duration-500`}>
          {notificacionesPendientesUsuario.length > 0 && (
            <section aria-labelledby="notificaciones-pendientes-titulo" aria-live="polite" className="mb-4 rounded-xl border border-amber-300 bg-amber-50/90 p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <MailWarning size={19} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-700" />
                  <div>
                    <h2 id="notificaciones-pendientes-titulo" className="text-sm font-black text-amber-950">Notificaciones pendientes</h2>
                    <p className="mt-0.5 text-xs text-amber-900">Los datos ya se guardaron. Puedes reintentar el correo sin volver a guardar el informe o la matriz.</p>
                  </div>
                </div>
                <span className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-bold tabular-nums text-amber-900">
                  {notificacionesPendientesUsuario.length} pendientes
                </span>
              </div>
              <ul className="mt-3 space-y-2">
                {notificacionesPendientesUsuario.map(item => (
                  <li key={item.id} className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-800">
                        {item.payload.asunto || item.payload.titulo_informe || item.payload.titulo || 'Notificación GRC'}
                      </p>
                      {item.correoEnviado ? (
                        <p className="mt-1 break-all text-[11px] text-slate-600">Enviado a: {item.destinatarios}</p>
                      ) : (
                        <label htmlFor={`retry-recipients-${item.id}`} className="mt-2 block text-[10px] font-bold text-slate-600">
                          Destinatarios
                          <input
                            id={`retry-recipients-${item.id}`}
                            type="text"
                            value={item.destinatarios}
                            onChange={event => {
                              const destinatarios = event.target.value;
                              setReintentosNotificacion(prev => prev.map(actual => actual.id === item.id ? {
                                ...actual,
                                destinatarios,
                                payload: { ...actual.payload, destinatarios },
                              } : actual));
                            }}
                            aria-describedby={`retry-hint-${item.id}`}
                            placeholder="correo@empresa.com"
                            className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          />
                          <span id={`retry-hint-${item.id}`} className="mt-1 block font-normal text-slate-500">Puedes corregir la dirección o separar varios correos con coma.</span>
                        </label>
                      )}
                      <p className="mt-1 text-[10px] font-medium text-amber-800">
                        {item.correoEnviado ? 'Correo enviado; falta confirmar su registro.' : 'No se confirmó el envío.'}
                        {item.intentos > 0 ? ` Intentos: ${item.intentos}.` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={reintentandoNotificacionId !== null || (!item.correoEnviado && !item.destinatarios.trim())}
                      onClick={() => reintentarNotificacion(item)}
                      aria-label={item.correoEnviado ? 'Registrar el envío ya realizado' : `Reintentar envío a ${item.destinatarios}`}
                      className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
                    >
                      <RefreshCw size={14} aria-hidden="true" className={reintentandoNotificacionId === item.id ? 'animate-spin' : ''} />
                      {reintentandoNotificacionId === item.id ? 'Reintentando…' : item.correoEnviado ? 'Registrar envío' : 'Reintentar envío'}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <nav aria-label="Ubicación actual" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white/80 px-3 py-2">
            <ol className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
              <li>
                <button type="button" onClick={() => setActiveTabWithGuard('tablero')} className="min-h-8 rounded px-2 font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
                  Mi Espacio GRC
                </button>
              </li>
              {activeTab !== 'tablero' && (
                <li aria-current="page" className="flex min-w-0 items-center gap-2 font-bold text-slate-900">
                  <span aria-hidden="true" className="text-slate-400">/</span>
                  <span className="truncate">{nombreVistaActual}</span>
                </li>
              )}
            </ol>
            {activeTab !== 'tablero' && (
              <button type="button" onClick={() => setActiveTabWithGuard('tablero')} className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
                <ArrowLeft size={15} aria-hidden="true" />
                Volver a Mi Espacio
              </button>
            )}
          </nav>
          {/* 🏠 FASE 0: MI ESPACIO DE TRABAJO (Bandeja Ejecutiva + Expediente Único + Dashboard) */}
            {activeTab === 'tablero' && (
              <MiEspacio
                user={user}
                safeProgramas={safeProgramas}
                safePlanes={safePlanes}
                safeHallazgos={safeHallazgos}
                safeComites={safeComites}
                safeCronograma={safeCronograma}
                safeRiesgos={riesgosVigentes}
                safeEvaluaciones={safeEvaluaciones}
                informesAuditoria={informesAuditoria}
                activeTab={activeTab}
                setActiveTab={setActiveTabWithGuard}
                guardNavigation={guardNavigation}
                setSubTabResultados={setSubTabResultados}
                setSubTabPlanes={setSubTabPlanes}
                scrollToForm={scrollToForm}
                selectedProceso={selectedProcesoExpediente}
                setSelectedProceso={setSelectedProcesoExpediente}
              />
            )}
{/* 📈 DASHBOARD INTELIGENTE — RECONECTADO AQUÍ */}
           {activeTab === 'dashboard_riesgos' && puedeVerDashboard && (
              <DashboardEjecutivo 
                rFiltrados={rFiltrados} riesgos={riesgosVigentes}
                hFiltrados={hFiltrados} hallazgos={hallazgos}
                pFiltrados={pFiltrados} planes={planes}
                cFiltrados={cFiltrados} cronograma={cronograma}
                safeEvaluaciones={safeEvaluaciones}
                evaluaciones={safeEvaluaciones}
                evalFiltrados={safeEvaluaciones}
                evFiltrados={safeEvaluaciones}
                eFiltrados={safeEvaluaciones}
                informesAuditoria={informesAuditoria} safeIncidentes={safeIncidentes}
                matrizFiltro={matrizFiltro} setMatrizFiltro={setMatrizFiltro}
                setChartDetail={setChartDetail}
                defaultMeses={defaultMeses} defaultAnios={defaultAnios}
                selectedAnios={selectedAnios} selectedMeses={selectedMeses}
                toggleAnio={toggleAnio} toggleMes={toggleMes}
                setSelectedAnios={setSelectedAnios} setSelectedMeses={setSelectedMeses}
                setActiveTab={setActiveTabWithGuard}
                setSelectedProcesoExpediente={setSelectedProcesoExpediente}
              />
            )}

{/* 1️⃣ FASE DE PLANIFICACIÓN */}
 {activeTab === 'plan_anual_tab' && (
      <div className="space-y-6">
        
        {/* Protegemos el renderizado del componente PlanAnual */}
        {puedeVerCronograma && subTabPlanificar === 'plan_anual' && (
          <PlanAnual
        isAdmin={isAdmin} cFiltrados={cFiltrados} searchTerm={searchTerm} setSearchTerm={setSearchTerm}
        columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} FilterInput={FilterInput}
        applyFilters={applyFilters} editCronograma={editCronograma} setEditCronograma={setEditCronograma}
        handleCronogramaSubmit={handleCronogramaSubmit} formResetKey={formResetKey} setFormResetKey={setFormResetKey}
        scrollToForm={scrollToForm} handleDeleteItem={handleDeleteItem} safeMonitoreo={safeMonitoreo}
        editMonitoreo={editMonitoreo} setEditMonitoreo={setEditMonitoreo} handleMonitoreoSubmit={handleMonitoreoSubmit}
        selectedAnios={selectedAnios} renderHeaderFiltros={(t, s) => <HeaderFiltros titulo={t} subtitulo={s} defaultAnios={defaultAnios} defaultMeses={defaultMeses} selectedAnios={selectedAnios} selectedMeses={selectedMeses} toggleAnio={toggleAnio} toggleMes={toggleMes} setSelectedAnios={setSelectedAnios} setSelectedMeses={setSelectedMeses} />}
      />
    )}
{puedeVerProgramas && subTabPlanificar === 'programas' && (
      <ProgramasAuditoria
        programas={safeProgramas}
        setProgramas={setProgramas}
        saveToCloud={saveToCloud}
        isAdmin={isAdmin}
        user={user}
        handleDeleteItem={handleDeleteItem}
      />
    )}
    {subTabPlanificar === 'riesgos' && (
      <Riesgos 
        isAdmin={isAdmin} 
        user={user}
        perfilUsuario={perfilUsuario}
        editRiesgo={editRiesgo} 
        setEditRiesgo={setEditRiesgo} 
        handleRiesgoSubmit={handleRiesgoSubmit}
        setFormResetKey={setFormResetKey} 
        scrollToForm={scrollToForm} 
        handleDeleteItem={handleDeleteItem}
        applyFilters={applyFilters} 
        FilterInput={FilterInput} 
        rFiltrados={rFiltrados} 
        calcularMatriz5x5={calcularMatriz5x5}
        searchTerm={searchTerm} 
        setSearchTerm={setSearchTerm} 
        columnFilters={columnFilters} 
        handleColFilterChange={handleColFilterChange}
        safeRiesgos={safeRiesgos}
        hallazgos={safeHallazgos}
        planesDeAccion={safePlanes}
        setRiesgos={setRiesgos} 
        saveToCloud={saveToCloud} 
        showNotification={showNotification}
      />
    )}

    {subTabPlanificar === 'apetito' && (
      <Apetito 
        isAdmin={isAdmin} 
        editApetito={editApetito} 
        setEditApetito={setEditApetito} 
        handleApetitoSubmit={handleApetitoSubmit}
        activeTooltip={activeTooltip} 
        setActiveTooltip={setActiveTooltip} 
        setFormResetKey={setFormResetKey} 
        formResetKey={formResetKey}
        scrollToForm={scrollToForm} 
        rFiltrados={riesgosVigentes} 
        incFiltrados={safeIncidentes} 
        calcularMatriz5x5={calcularMatriz5x5}
        searchTerm={searchTerm} 
        setSearchTerm={setSearchTerm} 
        columnFilters={columnFilters} 
        handleColFilterChange={handleColFilterChange}
        FilterInput={FilterInput} 
        applyFilters={applyFilters}
      />
    )}
  </div>
)}

{/* 2️⃣ FASE DE TRABAJO DE CAMPO */}
            {isAdmin && activeTab === 'evaluaciones' && (
              <Evaluaciones
    isAdmin={isAdmin} editEvaluacion={editEvaluacion} setEditEvaluacion={setEditEvaluacion}
    handleEvaluacionSubmit={handleEvaluacionSubmit}
    safeRiesgos={riesgosVigentes} user={user} analizarEvidenciaIA={analizarEvidenciaIA} safeEvaluaciones={safeEvaluaciones}
    formatSafeDate={formatSafeDate} searchTerm={searchTerm} setSearchTerm={setSearchTerm} columnFilters={columnFilters}
    handleColFilterChange={handleColFilterChange} FilterInput={FilterInput} applyFilters={applyFilters}
    setFormResetKey={setFormResetKey} scrollToForm={scrollToForm} handleDeleteItem={handleDeleteItem}
    informesAuditoria={informesAuditoria} /* 👈 ESTA LÍNEA SOLUCIONA EL PROBLEMA */
  />
)}
            {/* 3️⃣ FASE DE RESULTADOS & BRECHAS */}
            {activeTab === 'resultados_tab' && (
              <div className="space-y-6">
                
                {subTabResultados === 'hallazgos' && (
                  <Hallazgos
                    exportToExcel={exportarExcel}
                    isAdmin={isAdmin}
                    user={user}
                    puedeCrearHallazgos={puedeCrearHallazgos}
                    safeRiesgos={safeRiesgos} 
                    informesAuditoria={informesAuditoria} 
                    fuentesMejora={fuentesMejora}
                    editHallazgo={editHallazgo} 
                    setEditHallazgo={setEditHallazgo}
                    handleHallazgoSubmit={handleHallazgoSubmit} 
                    setFormResetKey={setFormResetKey} 
                    scrollToForm={scrollToForm}
                    handleDeleteItem={handleDeleteItem} 
                    applyFilters={applyFilters} 
                    hFiltrados={hFiltrados} 
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm} 
                    columnFilters={columnFilters} 
                    handleColFilterChange={handleColFilterChange} 
                    FilterInput={FilterInput}
                  />
                )}
             {subTabResultados === 'informes' && (
                  <InformesAuditoria
                    exportToExcel={exportarExcel}
                    informesAuditoria={informesAuditoria}
                    fuentesMejora={fuentesMejora}
                    safeProgramas={safeProgramas}
                    setInformesAuditoria={setInformesAuditoria} 
                    editInformeAuditoria={editInformeAuditoria}
                    setEditInformeAuditoria={setEditInformeAuditoria} 
                    isAdmin={isAdmin} 
                    user={user} 
                    searchTerm={searchTerm} 
                    setSearchTerm={setSearchTerm}
                    columnFilters={columnFilters} 
                    handleColFilterChange={handleColFilterChange}
                    handleInformeAuditoriaSubmit={handleInformeAuditoriaSubmit} 
                    puedeCrearInformes={puedeCrearInformes}
                    puedeEditarInformes={puedeCrearInformes}
                    isSubmitting={isSubmitting} 
                    setFormResetKey={setFormResetKey}
                    scrollToForm={scrollToForm} 
                    handleDeleteItem={handleDeleteItem} 
                    applyFilters={applyFilters} 
                    FilterInput={FilterInput}
                    safeHallazgos={safeHallazgos} 
                    safePlanes={safePlanes} 
                    formatSafeDate={formatSafeDate}
                  />
                )}
              {subTabResultados === 'cargos_procesos' && isAdmin && (
                <CargosProcesos
                  isAdmin={isAdmin}
                  catalogoCargos={catalogoCargos}
                  mapaProcesos={mapaProcesos}
                  sedesEmpresa={sedesEmpresa}
                  catalogosInicializados={catalogosInicializados}
                  onSaveCatalogos={guardarCatalogos}
                  onDeleteCargo={eliminarCargoCatalogo}
                  showNotification={showNotification}
                />
              )}
              {/* ✨ PANTALLA DE FUENTE DE MEJORA */}
              {subTabResultados === 'fuentes_mejora' && puedeVerFuentesMejora && (
                  <FuentesDeMejora
                    isAdmin={isAdmin}
                    fuentes={fuentesMejora}
                    user={user}
                    onSaveFuentes={async (fuentesActualizadas) => {
                      const guardado = await saveToCloud({ fuentesMejora: fuentesActualizadas });
                      if (!guardado) {
                        showNotification('No se pudieron guardar las fuentes de mejora.', 'error');
                        return false;
                      }
                      setFuentesMejora(fuentesActualizadas);
                      return true;
                    }}
                    onCreateFuente={async (fuente) => {
                      try {
                        const respuesta = await apiService.crearRegistroGrc('fuentesMejora', fuente);
                        if (!respuesta?.registro) return false;
                        setFuentesMejora(prev => [respuesta.registro, ...(Array.isArray(prev) ? prev : [])]);
                        showNotification('Fuente de mejora creada.', 'success');
                        return respuesta.registro;
                      } catch {
                        showNotification('No se pudo crear la fuente de mejora.', 'error');
                        return false;
                      }
                    }}
                  />
              )}
              </div>
            )}

            {/* 4️⃣ FASE DE PLANES DE ACCIÓN */}
            {activeTab === 'planes_tab' && (
              <div className="space-y-6">
                
                {subTabPlanes === 'planes' && (
                  <Planes 
                    key={`planes-tareas-${solicitudTareasPlanes}`}
                    reviewReportId={reviewReportId} detallePanelPlanes={detallePanelPlanes} setDetallePanelPlanes={setDetallePanelPlanes} misPlanesEjecucion={misPlanesEjecucion} misPlanesRevision={misPlanesRevision} misPlanesAprobacion={misPlanesAprobacion} ejecutarDespachoGmailApi={ejecutarDespachoGmailApi} encolarReintentoNotificacion={encolarReintentoNotificacion} prepararEnvioGmail={prepararEnvioGmail} showNotification={showNotification} handleAprobarCierrePlan={handleAprobarCierrePlan} isAdmin={isAdmin} puedeCrearPlanes={puedeCrearPlanes} user={user} perfilUsuario={perfilUsuario}
                    editPlan={editPlan} setEditPlan={setEditPlan} handlePlanSubmit={handlePlanSubmit} formResetKey={formResetKey}
                    setFormResetKey={setFormResetKey} scrollToForm={scrollToForm} handleDeleteItem={handleDeleteItem} applyFilters={applyFilters}
                    FilterInput={FilterInput} pFiltrados={pFiltrados} safeHallazgos={safeHallazgos} setHallazgos={setHallazgos}
                    safePlanes={safePlanes} setPlanes={setPlanes} saveToCloud={saveToCloud} formatSafeDate={formatSafeDate}
                    searchTerm={searchTerm} setSearchTerm={setSearchTerm} columnFilters={columnFilters} handleColFilterChange={handleColFilterChange}
                    informesAuditoria={informesAuditoria} fuentesMejora={fuentesMejora} defaultAnios={defaultAnios} defaultMeses={defaultMeses} selectedAnios={selectedAnios}
                    selectedMeses={selectedMeses} toggleAnio={toggleAnio} toggleMes={toggleMes} setSelectedAnios={setSelectedAnios} setSelectedMeses={setSelectedMeses}
                    selectAllAnios={() => setSelectedAnios([...defaultAnios])} clearAllAnios={() => setSelectedAnios([])}
                    selectAllMeses={() => setSelectedMeses([...defaultMeses])} clearAllMeses={() => setSelectedMeses([])}
                    onUpdateItemStatus={async (coleccion, id, nuevoEstadoWorkflow) => {
                      try {
                        const ts = new Date().toLocaleString();
                        const logTrazabilidad = { fecha: ts, usuario: user?.email || 'Usuario', accion: `Fase de Gobernanza actualizada a: ${nuevoEstadoWorkflow}` };
                        const planActual = safePlanes.find(p => p.id === id);
                        if (!planActual) return;
                        let correoPreparado = true;
                        if (nuevoEstadoWorkflow === 'En Revisión') {
                          try {
                            correoPreparado = Boolean(await prepararEnvioGmail());
                          } catch {
                            correoPreparado = false;
                          }
                        }
                        const planModificado = { ...planActual, estadoWorkflow: nuevoEstadoWorkflow, historialCambios: [...(planActual.historialCambios || []), logTrazabilidad] };
                        const updatedList = safePlanes.map(p => p.id === id ? planModificado : p);
                        const guardado = await saveToCloud({ planes: updatedList });
                        if (!guardado) return;
                        setPlanes(updatedList);
                        setEditPlan(planModificado);
                        setFormResetKey(Date.now());
                        if (nuevoEstadoWorkflow === 'En Revisión') {
                        const correoGestor = auth.currentUser?.email || import.meta.env.VITE_CORREO_ADMIN_DEFAULT || '';
                          const payloadNotificacion = { ref_consecutivo: `PLAN-${id}`, titulo_informe: 'Plan de Acción Publicado Listo para Validación', proceso_auditado: planModificado.accion.substring(0, 50) + '...', enlace_pdf: window.location.origin, destinatarios: correoGestor };
                          let correoEnviado = false;
                          if (correoPreparado) {
                            try {
                              correoEnviado = Boolean(await ejecutarDespachoGmailApi(payloadNotificacion));
                            } catch {
                              correoEnviado = false;
                            }
                          }
                          if (!correoEnviado) encolarReintentoNotificacion(payloadNotificacion, { tipo: 'plan' });
                          showNotification(
                            correoEnviado ? "Plan enviado a revisión y administrador notificado." : "Plan enviado a revisión, pero no se pudo enviar el correo.",
                            correoEnviado ? "success" : "error"
                          );
                        } else {
                          showNotification(`Fase del plan actualizada a: ${nuevoEstadoWorkflow}`);
                        }
                      } catch (err) {
                        console.error("Error al actualizar la fase del Workflow:", err);
                        alert("Hubo un error al actualizar el estado. Revisa la consola.");
                      }
                    }}
                  />
                )}
                {subTabPlanes === 'reporte360' && (
                  <Reporte360
                    informesAuditoria={informesAuditoria}
                    safeHallazgos={safeHallazgos}
                    safePlanes={safePlanes}
                    fuentesMejora={fuentesMejora}
                    user={user}
                    perfilUsuario={perfilUsuario}
                    showNotification={showNotification}
                  />
                )}
                {subTabPlanes === 'incidentes' && (
                  <Incidentes 
                    incFiltrados={incFiltrados} isAdmin={isAdmin} searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                    columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} editIncidente={editIncidente}
                    setEditIncidente={setEditIncidente} handleIncidenteSubmit={handleIncidenteSubmit} formResetKey={formResetKey}
                    setFormResetKey={setFormResetKey} scrollToForm={scrollToForm} handleDeleteItem={handleDeleteItem}
                    applyFilters={applyFilters} FilterInput={FilterInput} safeRiesgos={safeRiesgos}
                  />
                )}
              </div>
            )}

           {/* 5️⃣ FASE DE GOBERNANZA, COMITÉS Y CIERRE */}
            {(isAdmin || puedeVerComites || puedeVerTrazabilidad) && activeTab === 'gobernanza_tab' && (
              <div className="space-y-6">

                {subTabGobernanza === 'comites' && puedeVerComites && (
                  <Comites 
                    isAdmin={isAdmin} editComite={editComite} setEditComite={setEditComite} handleComiteSubmit={handleComiteSubmit}
                    setFormResetKey={setFormResetKey} formResetKey={formResetKey} scrollToForm={scrollToForm} handleDeleteItem={handleDeleteItem}
                    applyFilters={applyFilters} comitesFiltrados={comitesFiltrados} searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                    columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} FilterInput={FilterInput}
                  />
                )}
                {subTabGobernanza === 'trazabilidad' && puedeVerTrazabilidad && (
                  <Trazabilidad 
                    safeRiesgos={safeRiesgos} safeEvaluaciones={safeEvaluaciones} safeHallazgos={safeHallazgos}
                    safePlanes={safePlanes} safeIncidentes={safeIncidentes}
                  />
                )}
{/* Auditoría automatizada trabaja con nómina: solo administradores (el servidor también lo exige). */}
{subTabGobernanza === 'auditoria_auto' && isAdmin && (
                  <ConceptMapper />
                )}
              </div>
            )}

            {/* 🔒 Pantallas de Auditorías / Gobernanza sin el permiso correspondiente: aviso en vez de un área vacía. */}
            {((activeTab === 'dashboard_riesgos' && !puedeVerDashboard) ||
              (activeTab === 'plan_anual_tab' && ((subTabPlanificar === 'plan_anual' && !puedeVerCronograma) || (subTabPlanificar === 'programas' && !puedeVerProgramas))) ||
              (activeTab === 'gobernanza_tab' && !((subTabGobernanza === 'comites' && puedeVerComites) || (subTabGobernanza === 'trazabilidad' && puedeVerTrazabilidad) || (subTabGobernanza === 'auditoria_auto' && isAdmin)))) && (
              <div role="status" className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <p className="text-3xl" aria-hidden="true">🔒</p>
                <h2 className="mt-2 text-lg font-black text-slate-800">No tienes acceso a este módulo</h2>
                <p className="mt-1 text-sm text-slate-600">Solicita el permiso correspondiente a un administrador desde Configuración.</p>
              </div>
            )}

            {/* ⚙️ CONFIGURACIÓN — solo administradores (el servidor también lo exige en cada operación). */}
            {activeTab === 'config' && isAdmin && (
              <Configuracion 
                forceUpdateCronograma={forceUpdateCronograma}
                handleImportExcelRiesgos={handleImportExcelRiesgos}
                exportToJSON={exportarRespaldoJSON}
                handleImportJSON={handleImportJSON}
              />
            )}

            {/* 👤 MI PERFIL (NUEVA PANTALLA DE USUARIO) */}
            {activeTab === 'mi_perfil' && (
              <MiPerfil 
                user={user}
                isAdmin={isAdmin}
                showNotification={showNotification}
                safeProgramas={safeProgramas}
                informesAuditoria={informesAuditoria}
                safePlanes={safePlanes}
              />
            )}
          </div>
          </Suspense>
          </AppErrorBoundary>
        </main>
      </div>

{/* 🤖 COMPONENTE REDISEÑADO EN MÓDULO SEPARADO (AUDITOR IA V5) */}
      <AuditorIA 
        isPresentationMode={isPresentationMode}
        isAdmin={isAdmin}
        showAuditorIA={showAuditorIA}
        setShowAuditorIA={setShowAuditorIA}
        auditorInput={auditorInput}
        setAuditorInput={setAuditorInput}
        auditorRespuesta={auditorRespuesta}
        setAuditorRespuesta={setAuditorRespuesta}
        isAuditorThinking={isAuditorThinking}
        handleAuditorSubmit={handleAuditorSubmit}
      />
                
<ModalIA aiModal={aiModal} setAiModal={setAiModal} />
      <ModalDetalleGrafico chartDetail={chartDetail} setChartDetail={setChartDetail} />      
      {notification && (
        <div
          role={notification.type === 'error' ? 'alert' : 'status'}
          aria-live={notification.type === 'error' ? 'assertive' : 'polite'}
          aria-atomic="true"
          className={`fixed bottom-4 right-4 max-h-[50dvh] max-w-[calc(100vw-2rem)] overflow-y-auto break-words px-6 py-4 rounded-xl shadow-2xl font-bold text-sm z-50 animate-in slide-in-from-bottom-5 ${notification.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}
        >
          {notification.message}
        </div>
      )}
    </div>
  </CatalogosProvider>
  );
}