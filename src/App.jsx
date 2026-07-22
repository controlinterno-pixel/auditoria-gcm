import React, { useState, useEffect, useMemo } from 'react';
import { signOut, onAuthStateChanged } from 'firebase/auth'; 
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
// 🔥 CONEXIÓN MODULAR Y SERVICIOS CENTRALIZADOS
import { auth, db } from './services/firebase';
import { 
  formatSafeDate, getItemAnio, getItemMesText, calcularMatriz5x5, applyFilters 
} from './utils/helpers';
import InformesAuditoria from './components/InformesAuditoria';
import Configuracion from './components/Configuracion';
import Incidentes from './components/Incidentes';
import Hallazgos from './components/Hallazgos';
import Planes from './components/Planes';
import Trazabilidad from './components/Trazabilidad';
import Evaluaciones from './components/Evaluaciones';
import Riesgos from './components/Riesgos';
import Apetito from './components/Apetito';
import PlanAnual from './components/PlanAnual';
import AuditorIA from './components/AuditorIA';
import Comites from './components/Comites';
import DashboardEjecutivo from './components/DashboardEjecutivo';
import MiEspacio from './components/MiEspacio';
import ModalIA from './components/ModalIA';
import ModalDetalleGrafico from './components/ModalDetalleGrafico';
import WelcomeScreen from './components/WelcomeScreen';
import AuthScreen from './components/AuthScreen';
import ResetPassword from './components/ResetPassword';
import { FilterInput, StepIndicatorHUD, HeaderFiltros } from './components/UIComponents';
import Navbar from './components/Navbar';
import { enviarCorreoGmail } from './services/gmailService';
import { consultarCopilotoIA } from './services/gemini';
import { 
  defaultCronograma, defaultRiesgos, defaultHallazgos, 
  defaultPlanes, defaultIncidentes, defaultEvaluaciones, defaultMonitoreo 
} from './constants/defaultData';
// =====================================================================
// 🤖 CONEXIÓN SEGURA A GEMINI PRO IA
// =====================================================================
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
// =====================================================================
// 🛠️ FUNCIONES GLOBALES Y CÁLCULOS
// =====================================================================

export default function App() {
  // 🔑 Detectar si el usuario viene desde el correo de restablecer contraseña
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [oobCode, setOobCode] = useState(null); // <-- NUEVO ESTADO PARA EL CÓDIGO

  useEffect(() => {
    // Leemos la URL para ver si Firebase nos mandó un código secreto
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const code = params.get('oobCode');

    if (mode === 'resetPassword' && code) {
      setIsResettingPassword(true);
      setOobCode(code); // <-- GUARDAMOS EL CÓDIGO
    }
  }, []);

  const [activeTab, setActiveTab] = useState('tablero');
  // 🔌 Hook para gestionar peticiones a la base de datos
  // 🔌 ESTADOS PARA NAVEGACIÓN ANIDADA DE PROCESOS (WORKFLOW)
  const [subTabPlanificar, setSubTabPlanificar] = useState('plan_anual');
  const [subTabResultados, setSubTabResultados] = useState('hallazgos');
  const [subTabPlanes, setSubTabPlanes] = useState('planes');
  const [subTabGobernanza, setSubTabGobernanza] = useState('comites');
// 🔌 ESTADO PARA NAVEGACIÓN DIRECTA DE PROCESOS AL EXPEDIENTE 360°
const [selectedProcesoExpediente, setSelectedProcesoExpediente] = useState('');
  // 🔌 ESTADO PARA EL CASO ACTIVO DEL EXPEDIENTE ÚNICO

  const [auditoresLista, setAuditoresLista] = useState(["Rodolfo González", "Yehison Pineda", "Angelica Hernandez", "Luz Angela Chico"]);
  const [notification, setNotification] = useState(null);
  const [isPresentationMode, setIsPresentationMode] = useState(false); 
  const [formResetKey, setFormResetKey] = useState(Date.now()); 

  const [searchTerm, setSearchTerm] = useState('');
  const [columnFilters, setColumnFilters] = useState({});
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCloudLoaded, setIsCloudLoaded] = useState(false);
  const [xlsxLoaded, setXlsxLoaded] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [aiModal, setAiModal] = useState(null);
  const [chartDetail, setChartDetail] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [matrizFiltro, setMatrizFiltro] = useState(null);

// =========================================================
  // 🤖 NUEVOS ESTADOS: AUDITOR IA (PANEL OSCURO FLOTANTE)
  // =========================================================
  const [showAuditorIA, setShowAuditorIA] = useState(false);
  const [auditorInput, setAuditorInput] = useState('');
  const [auditorRespuesta, setAuditorRespuesta] = useState('');
  const [isAuditorThinking, setIsAuditorThinking] = useState(false);

  // ✏️ ESTADOS DE EDICIÓN Y COMPONENTES
  const [editRiesgo, setEditRiesgo] = useState(null);
  const [editPlan, setEditPlan] = useState(null);
  const [editEvaluacion, setEditEvaluacion] = useState(null);
  const [editHallazgo, setEditHallazgo] = useState(null);
  const [editIncidente, setEditIncidente] = useState(null);
  const [editCronograma, setEditCronograma] = useState(null);
  const [editApetito, setEditApetito] = useState(null);
  const [editMonitoreo, setEditMonitoreo] = useState(null);
  const [activeTooltip, setActiveTooltip] = useState(null);
// --- NUEVOS ESTADOS PARA INFORMES DE AUDITORÍA ---
  const [informesAuditoria, setInformesAuditoria] = useState([]);
  const [editInformeAuditoria, setEditInformeAuditoria] = useState(null);
const [comites, setComites] = useState([]);
const [editComite, setEditComite] = useState(null);

 // =====================================================================
  // ⚙️ ENTIDADES PRINCIPALES (ESTADOS DE BASE DE DATOS)
  // =====================================================================
  const [riesgos, setRiesgos] = useState([]);
  const [hallazgos, setHallazgos] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [incidentes, setIncidentes] = useState([]);
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [cronograma, setCronograma] = useState([]);
  const [monitoreo, setMonitoreo] = useState([]);

  const safeRiesgos = Array.isArray(riesgos) ? riesgos : [];
  const safeHallazgos = Array.isArray(hallazgos) ? hallazgos : [];
  const safePlanes = Array.isArray(planes) ? planes : [];
  const safeIncidentes = Array.isArray(incidentes) ? incidentes : [];
  const safeEvaluaciones = Array.isArray(evaluaciones) ? evaluaciones : [];
  const safeCronograma = Array.isArray(cronograma) ? cronograma : [];
  const safeMonitoreo = Array.isArray(monitoreo) ? monitoreo : [];
  const safeComites = Array.isArray(comites) ? comites : [];

  // =====================================================================
  // 🗓️ FILTROS DE PERIODICIDAD INTELIGENTES Y ABIERTOS
  // =====================================================================
  const [periodFilters, setPeriodFilters] = useState({});

  // 🔥 ESCÁNER DINÁMICO: Encuentra automáticamente todos los años con datos + año actual
  const defaultAnios = useMemo(() => {
    const currentYear = new Date().getFullYear();
const yearsSet = new Set([currentYear - 1, currentYear, currentYear + 1, currentYear + 2, currentYear + 3]);

    // Extrae dinámicamente cualquier año registrado en tus módulos
    safeRiesgos.forEach(r => r.anio && yearsSet.add(Number(r.anio)));
    safeHallazgos.forEach(h => h.anio && yearsSet.add(Number(h.anio)));
    safePlanes.forEach(p => p.anio && yearsSet.add(Number(p.anio)));
    safeIncidentes.forEach(i => i.anio && yearsSet.add(Number(i.anio)));
    safeCronograma.forEach(c => c.anio && yearsSet.add(Number(c.anio)));

    // Devuelve la lista ordenada de menor a mayor
    return Array.from(yearsSet).sort((a, b) => a - b);
  }, [safeRiesgos, safeHallazgos, safePlanes, safeIncidentes, safeCronograma]);

  const defaultMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  // El sistema lee la pestaña activa y saca su filtro correspondiente
  const selectedAnios = periodFilters[activeTab]?.anios || defaultAnios;
  const selectedMeses = periodFilters[activeTab]?.meses || defaultMeses;

  const setSelectedAnios = (valOrFunc) => {
    setPeriodFilters(prev => {
      const cur = prev[activeTab] || { anios: defaultAnios, meses: defaultMeses };
      return { ...prev, [activeTab]: { ...cur, anios: typeof valOrFunc === 'function' ? valOrFunc(cur.anios) : valOrFunc } };
    });
  };

  const setSelectedMeses = (valOrFunc) => {
    setPeriodFilters(prev => {
      const cur = prev[activeTab] || { anios: defaultAnios, meses: defaultMeses };
      return { ...prev, [activeTab]: { ...cur, meses: typeof valOrFunc === 'function' ? valOrFunc(cur.meses) : valOrFunc } };
    });
  };

  // Limpiar buscador al cambiar de pestaña
  useEffect(() => {
  setSearchTerm('');
  setColumnFilters({});
}, [activeTab]);

  const handleColFilterChange = (key, value) => {
    setColumnFilters(prev => ({ ...prev, [key]: value }));
  };

  const toggleAnio = (anio) => {
    setSelectedAnios(prev => prev.includes(anio) ? prev.filter(a => a !== anio) : [...prev, anio]);
  };
  
  const toggleMes = (mes) => {
    setSelectedMeses(prev => prev.includes(mes) ? prev.filter(m => m !== mes) : [...prev, mes]);
  };
// 🛡️ Estado y validación robusta de perfil/rol de usuario
  const [perfilUsuario, setPerfilUsuario] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const emailLimpio = (currentUser.email || '').trim().toLowerCase();

        // 🚨 1. Hardcode / Bypass de emergencia para el correo principal de Control Interno
        if (emailLimpio === 'controlinterno@termales.com.co') {
          console.log("🛡️ Superadmin identificado por correo corporativo.");
          setPerfilUsuario({ email: currentUser.email, rol: 'admin' });
          setIsAdmin(true);
          return;
        }

        // 🔍 2. Validación secundaria en Firestore si no es el correo principal
        try {
          const docRef = doc(db, 'usuarios', currentUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const datosPerfil = docSnap.data();
            setPerfilUsuario(datosPerfil);
            setIsAdmin(datosPerfil.rol === 'admin'); 
          } else {
            setPerfilUsuario(null);
            setIsAdmin(false);
          }
        } catch (error) {
          console.error("Error obteniendo perfil en Firestore:", error);
          setIsAdmin(false);
        }
      } else {
        setPerfilUsuario(null);
        setIsAdmin(false);
        setShowWelcome(true); // 🛡️ Reinicia la bienvenida al cerrar sesión
      }
    });
    return () => unsubscribe();
  }, []);
 // 📥 Carga Inicial Centralizada con Firebase
  useEffect(() => {
    if (!user) return;
    setIsCloudLoaded(false);
    
    const timeoutSeguridad = setTimeout(() => {
      console.warn("⚠️ Firebase está tardando. Forzando entrada...");
      setIsCloudLoaded(true);
    }, 4000);

    const docRef = doc(db, 'workspace_compartido', 'base_de_datos_grc');
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      clearTimeout(timeoutSeguridad); 
      if (docSnap.exists()) {
        const data = docSnap.data() || {};
        setRiesgos(data.riesgos || defaultRiesgos);
        setHallazgos(data.hallazgos || defaultHallazgos);
        setPlanes(data.planes || defaultPlanes);
        setIncidentes(data.incidentes || []);
        setEvaluaciones(data.evaluaciones || defaultEvaluaciones);
        setCronograma(data.cronograma || defaultCronograma);
        setMonitoreo(data.monitoreo || defaultMonitoreo);
        setInformesAuditoria(data.informesAuditoria || []);
        setComites(data.comites || []);
        setAuditoresLista(data.auditoresLista || ["Rodolfo González", "Yehison Pineda", "Angelica Hernandez", "Luz Angela Chico"]);
} else {
        // Solo un admin validado puede inicializar la base de datos vacía
        if (isAdmin) {
           setDoc(docRef, { riesgos: defaultRiesgos, hallazgos: defaultHallazgos, planes: defaultPlanes, incidentes: defaultIncidentes, evaluaciones: defaultEvaluaciones, cronograma: defaultCronograma, monitoreo: defaultMonitoreo, informesAuditoria: [], comites: [] });
        }
      }      
      setIsCloudLoaded(true);
    }, (error) => {
      clearTimeout(timeoutSeguridad);
      console.error("🔥 Error de Firebase:", error);
      setIsCloudLoaded(true);
    });

    return () => {
      clearTimeout(timeoutSeguridad);
      unsubscribe();
    };
  }, [user]);
  useEffect(() => {
    if (window.XLSX) { setXlsxLoaded(true); return; }
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    script.async = true;
    script.onload = () => setXlsxLoaded(true);
    document.head.appendChild(script);
  }, []);

const handleLogout = async () => { 
    await signOut(auth); 
    setShowWelcome(true); // 🛡️ Asegura que al dar clic al botón se active la pantalla de nuevo
  };
const saveToCloud = async (partialData) => { 
    await setDoc(doc(db, 'workspace_compartido', 'base_de_datos_grc'), partialData, { merge: true }); 
  };

  const handleDeleteItem = async (listType, id) => {
    if (!isAdmin) return; if (!window.confirm('¿Eliminar registro permanentemente?')) return;
    let updated;
    if (listType === 'riesgos') { updated = safeRiesgos.filter(r => r.id !== id); setRiesgos(updated); }
    if (listType === 'evaluaciones') { updated = safeEvaluaciones.filter(e => e.id !== id); setEvaluaciones(updated); }
    if (listType === 'hallazgos') { updated = safeHallazgos.filter(h => h.id !== id); setHallazgos(updated); }
    if (listType === 'planes') { updated = safePlanes.filter(p => p.id !== id); setPlanes(updated); }
    if (listType === 'incidentes') { updated = safeIncidentes.filter(i => i.id !== id); setIncidentes(updated); }
    if (listType === 'cronograma') { updated = safeCronograma.filter(c => c.id !== id); setCronograma(updated); }
    if (listType === 'monitoreo') { updated = safeMonitoreo.filter(m => m.id !== id); setMonitoreo(updated); }
    if (listType === 'informesAuditoria') { updated = informesAuditoria.filter(i => i.id !== id); setInformesAuditoria(updated); }
    if (listType === 'comites') { updated = safeComites.filter(c => c.id !== id); setComites(updated); }
    await saveToCloud({ [listType]: updated }); showNotification("Registro eliminado.", "success");
  };
  const showNotification = (message, type = 'success') => { setNotification({message, type}); setTimeout(() => setNotification(null), 4000); };
  
  // SOLUCIÓN AL SCROLL DE EDICIÓN: Búsqueda precisa del contenedor central para evitar el salto
  const scrollToForm = () => {
    setTimeout(() => {
      const formEl = document.getElementById('edit-form');
      const mainArea = document.getElementById('main-scroll-area');
      if (formEl && mainArea) {
        mainArea.scrollTo({ top: formEl.offsetTop - 20, behavior: 'smooth' });
      } else if (formEl) {
        formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 100);
  };

// =====================================================================
  // 🧠 FUNCIÓN CENTRAL DEL "AUDITOR IA" (CONECTADA A GEMINI.JS)
  // =====================================================================
  const handleAuditorSubmit = async (e, textoDirecto = null) => {
    if (e) e.preventDefault(); 
    
    const consultaFinal = textoDirecto || auditorInput;
    if (!consultaFinal.trim()) return;

    setIsAuditorThinking(true);
    setAuditorRespuesta('');

    try {
      const hoy = new Date();

      // 🛑 1. RECOLECCIÓN DE DATOS (Usamos la base "safe" para visión CONSOLIDADA)
      const riesgosBase = safeRiesgos;
      const hallazgosBase = safeHallazgos;
      const planesBase = safePlanes;
      const incidentesBase = safeIncidentes;
      const cronogramaBase = safeCronograma;

      let criticosTotal = 0;
      try { criticosTotal = riesgosBase.filter(r => r.probabilidadResidual && r.impactoResidual && calcularMatriz5x5(r.probabilidadResidual, r.impactoResidual).score > 16).length; } catch(err) {}
      
      const evalFiltradas = safeEvaluaciones; // También consolidado
      const totalEvaluaciones = evalFiltradas.length;
      const controlesEficaces = evalFiltradas.filter(ev => ev.calificacion === 100).length;
      const efectividadControlesGlobal = totalEvaluaciones > 0 ? Math.round((controlesEficaces / totalEvaluaciones) * 100) : 0;

      const cronogramaIniciados = cronogramaBase.filter(c => (Number(c.cumplimiento) || 0) > 0);
      const avanceCronogramaGlobal = cronogramaIniciados.length > 0 ? Math.round(cronogramaIniciados.reduce((acc, c) => acc + (Number(c.cumplimiento) || 0), 0) / cronogramaIniciados.length) : 0;

      const resumenInformes = (Array.isArray(informesAuditoria) ? informesAuditoria : []).map(inf => ({
        referencia: inf.ref,
        titulo: inf.titulo,
        proceso: inf.proceso || inf.macroproceso,
        estado: inf.socializado === 'Sí' ? 'Socializado' : 'Pendiente',
        fecha: inf.fecha
      }));

      // 📦 2. EMPAQUETADO DEL CONTEXTO PARA LA IA (Enriquecido para cuadrar con tu Dashboard)
      const contextoDatos = {
        dashboard: {
          cumplimientoPlanAnual: avanceCronogramaGlobal + '%',
          avancePlanesAccion: (planesBase.length > 0 ? Math.round(planesBase.reduce((acc, p) => acc + (p.progreso || p.avance || 0), 0) / planesBase.length) : 0) + '%',
          efectividadControles: efectividadControlesGlobal + '%'
        },
        riesgos: {
          total: riesgosBase.length,
          criticos: criticosTotal,
          operativos: riesgosBase.filter(r => r.categoria === 'Operativo').length,
          estrategicos: riesgosBase.filter(r => r.categoria === 'Estratégico').length,
          tecnologicos: riesgosBase.filter(r => r.categoria === 'Tecnológico').length
        },
        hallazgos_y_planes: {
          hallazgosTotales: hallazgosBase.length,
          hallazgosAbiertos: hallazgosBase.filter(h => h.estado === 'Abierto').length,
          hallazgosCerrados: hallazgosBase.filter(h => h.estado !== 'Abierto').length,
          // 🎯 Aquí alineamos la IA con las tarjetas de tu Dashboard
          planesTotales: planesBase.length,
          planesCerrados: planesBase.filter(p => p.estado === 'Cerrado' || p.progreso === 100).length,
          planesVencidos: planesBase.filter(p => p.estado !== 'Cerrado' && p.fecha && new Date(p.fecha) < hoy).length,
          planesEnProceso: planesBase.filter(p => p.estado === 'En Proceso').length
        },
        incidentes: {
          total: incidentesBase.length,
          perdidasAcumuladas: '$' + incidentesBase.reduce((acc, i) => acc + (Number(i.costo) || 0), 0).toLocaleString('es-CO') + ' COP'
        },
        informes: {
          totalEmitidos: resumenInformes.length,
          detalleInformes: resumenInformes
        },
        indicadores: {
          alertas: safeMonitoreo.filter(m => m.valor > m.limite).map(m => m.indicador).join(', ') || 'Ninguno bajo alerta crítica'
        }
      };

      // 🚀 3. LLAMADA LIMPIA A TU ARCHIVO GEMINI.JS
      const respuestaIA = await consultarCopilotoIA(consultaFinal, contextoDatos);
      
      setAuditorRespuesta(respuestaIA);

    } catch (error) {
      console.error("🔍 Error IA:", error);
      setAuditorRespuesta(`❌ Error al consultar al asistente: ${error.message}`);
    } finally {
      setIsAuditorThinking(false);
      setAuditorInput(''); 
    }
  };  
// =====================================================================
  // 📥 FUNCIONES DE EXPORTACIÓN (EXCEL Y JSON)
  // =====================================================================
  const exportToExcel = (dataArray, fileName) => {
    if (!xlsxLoaded || !window.XLSX) {
      showNotification("La librería de exportación aún está cargando.", "error");
      return;
    }
    const cleanData = dataArray.map(item => {
      const { historialCambios, ...rest } = item;
      return rest;
    });
    
    const ws = window.XLSX.utils.json_to_sheet(cleanData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    window.XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
    showNotification(`Archivo ${fileName} exportado con éxito.`);
  };

  const exportToJSON = () => {
    const data = { riesgos: safeRiesgos, hallazgos: safeHallazgos, planes: safePlanes, incidentes: safeIncidentes, evaluaciones: safeEvaluaciones, cronograma: safeCronograma, monitoreo: safeMonitoreo };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "GCM_Backup_" + new Date().toISOString().split('T')[0] + ".json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsedData = JSON.parse(event.target.result);
        if(window.confirm("⚠️ ALERTA: Esto sobrescribirá TODA la base de datos actual con los datos del archivo. ¿Estás seguro?")) {
          setIsCloudLoaded(false); 
          await saveToCloud(parsedData);
          showNotification("Base de datos actualizada masivamente con éxito.", "success");
          setIsCloudLoaded(true);
        }
      } catch(error) {
        showNotification("Error: El archivo no tiene un formato JSON válido.", "error");
      }
      e.target.value = null; 
    };
    reader.readAsText(file);
  };

const handleImportExcelRiesgos = (e) => {
    if (!window.XLSX) {
      showNotification("La librería de Excel aún no ha cargado. Intenta de nuevo en unos segundos.", "error");
      return;
    }
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = window.XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = window.XLSX.utils.sheet_to_json(worksheet);

        // 🔥 NUEVO: Función traductora para extraer el número (1 al 5) de textos como "Nivel4:Alta (80%)"
        const extraerNivel = (val) => {
            if (!val) return 1;
            if (typeof val === 'number') return val > 5 ? Math.ceil(val/20) : val;
            const str = String(val).toLowerCase();
            const match = str.match(/nivel\s*(\d)/); // Busca la palabra nivel seguida de un número
            if (match) return parseInt(match[1], 10);
            
            // Plan B por si escribieron otra cosa
            if (str.includes('1') || str.includes('rara') || str.includes('baja') || str.includes('insignificante')) return 1;
            if (str.includes('2') || str.includes('improbable') || str.includes('menor')) return 2;
            if (str.includes('3') || str.includes('posible') || str.includes('media') || str.includes('moderado')) return 3;
            if (str.includes('4') || str.includes('probable') || str.includes('alta') || str.includes('mayor')) return 4;
            if (str.includes('5') || str.includes('seguro') || str.includes('extrema') || str.includes('catastr')) return 5;
            return 1;
        };

        if(window.confirm("⚠️ ALERTA: ¿Deseas cargar esta Matriz de Riesgos? Reemplazará los riesgos actuales para NO acumular basura.")) {
          setIsCloudLoaded(false);
          const riesgosAgrupados = {};

          json.forEach((r, index) => {
             const idRaw = r['NO'] || r['No'] || r['ID'] || r['Id'] || r['id'] || (Date.now() + index);
             const idRiesgo = parseInt(idRaw) || idRaw;
             const riesgoExistente = safeRiesgos?.find(existente => String(existente.id) === String(idRiesgo)) || {};

             if (!riesgosAgrupados[idRiesgo]) {
                riesgosAgrupados[idRiesgo] = {
                  ...riesgoExistente, 
                  id: idRiesgo,
                  sede: r['Sede'] || riesgoExistente.sede || 'Administrativos',
                  proceso: r['PROCESO/SUBPROCESO'] || r['Proceso'] || riesgoExistente.proceso || 'Proceso General',
                  categoria: r['CATEGORÍA'] || r['Categoría'] || riesgoExistente.categoria || 'Operativo',
                  clasificacionRiesgo: r['CLASIFICACIÓN DEL RIESGO'] || r['Clasificación del riesgo'] || riesgoExistente.clasificacionRiesgo || 'Ejecución',
                  normativa: riesgoExistente.normativa || 'Interna',
                  responsable: r['RESPONSABLE'] || r['Responsable'] || riesgoExistente.responsable || 'Sin Asignar',
                  descripcion: r['DESCRIPCIÓN DEL RIESGO'] || r['Descripción'] || riesgoExistente.descripcion || '',
                  causa: r['CAUSA INMEDIATA'] || r['CAUSA RAÍZ'] || r['Causas'] || riesgoExistente.causa || '',
                  
                  // 🔥 AQUÍ APLICAMOS EL TRADUCTOR PARA QUE SEAN NÚMEROS LIMPIOS (1, 2, 3, 4 o 5)
                  probabilidadInherente: extraerNivel(r['PROBABILIDAD INHERENTE'] || riesgoExistente.probabilidadInherente),
                  impactoInherente: extraerNivel(r['IMPACTO INHERENTE'] || riesgoExistente.impactoInherente),
                  probabilidadResidual: extraerNivel(r['PROBABILIDAD RESIDUAL FINAL'] || riesgoExistente.probabilidadResidual),
                  impactoResidual: extraerNivel(r['IMPACTO RESIDUAL FINAL'] || riesgoExistente.impactoResidual),
                  
                  noControl: r['NO. CONTROL'] || riesgoExistente.noControl || '',
                  descripcionControl: r['DESCRIPCIÓN DEL CONTROL'] || riesgoExistente.descripcionControl || '',

                  capacidadRiesgo: riesgoExistente.capacidadRiesgo || 0,
                  toleranciaFinanciera: riesgoExistente.toleranciaFinanciera || 0,
                  apetitoFinanciero: riesgoExistente.apetitoFinanciero || 0,
                  posturaEstrategica: riesgoExistente.posturaEstrategica || 'No definida',
                  kriScore: riesgoExistente.kriScore || 0,
                  impactoOperativo: riesgoExistente.impactoOperativo || 'No definido',
                  impactoReputacional: riesgoExistente.impactoReputacional || 'No definido',
                  impactoLegal: riesgoExistente.impactoLegal || 'No definido',
                  escalamiento: riesgoExistente.escalamiento || 'Jefe de Área',
                  anio: riesgoExistente.anio || new Date().getFullYear(),
                  mes: riesgoExistente.mes || "Julio",
                  historialCambios: [...(riesgoExistente.historialCambios || []), { fecha: new Date().toLocaleString(), usuario: user?.email || 'Sistema', accion: 'Actualizado vía Carga Masiva (Excel)' }]
                };
             }
          });

          const nuevosRiesgos = Object.values(riesgosAgrupados);
          setRiesgos(nuevosRiesgos);
          await saveToCloud({ riesgos: nuevosRiesgos });
          showNotification(`Éxito: Matriz cargada. Los datos obsoletos fueron eliminados.`, "success");
          setIsCloudLoaded(true);
        }
      } catch (error) {
        console.error(error);
        showNotification("Error al procesar el archivo. Verifica el formato.", "error");
        setIsCloudLoaded(true);
      }
      e.target.value = null;
    };
    reader.readAsArrayBuffer(file);
  };
  const forceUpdateCronograma = async () => {
    if(window.confirm("¿Seguro que deseas cargar los 20 procesos del nuevo Plan Anual? Esto borrará el cronograma actual y lo reemplazará por la versión de Termales Santa Rosa.")) {
      await saveToCloud({ cronograma: defaultCronograma });
      showNotification("¡Plan Anual actualizado exitosamente con los 20 procesos!", "success");
    }
  };

  const sugerirConIA = async (tipoTarget) => {
    let textoBase = "";
    let inputDestino = null;

    if (tipoTarget === 'control') {
      textoBase = document.querySelector('input[name="descripcion"]')?.value || "";
      inputDestino = document.querySelector('input[name="control"]');
    } else if (tipoTarget === 'plan') {
      const selectElement = document.querySelector('select[name="idHallazgo"]');
      textoBase = selectElement ? selectElement.options[selectElement.selectedIndex]?.text : "";
      inputDestino = document.querySelector('input[name="accion"]');
    } else if (tipoTarget === 'hallazgo') {
      textoBase = document.querySelector('input[name="proceso"]')?.value || "";
      inputDestino = document.querySelector('input[name="titulo"]');
    }

    if (!textoBase || textoBase.trim() === '' || textoBase.includes('-- Seleccione --')) {
      showNotification("Escribe una descripción o selecciona un hallazgo primero para que la IA lo analice.", "error");
      return;
    }

    if (!GEMINI_API_KEY) {
      showNotification("La clave de API de Gemini no se ha cargado correctamente.", "error");
      return;
    }

    setIsThinking(true);
    showNotification("Gemini Pro está analizando el escenario...", "success");

    try {
      let prompt = "";
      if (tipoTarget === 'control') {
        prompt = `Actúa como un experto en auditoría GRC y ciberseguridad (ISO 31000). El siguiente es un evento de riesgo en una empresa: "${textoBase}". Redacta la descripción de un CONTROL CLAVE mitigante o preventivo, de forma muy ejecutiva, técnica y directa (máximo 20 words). Solo responde con el texto del control, sin comillas ni saludos.`;
      } else if (tipoTarget === 'plan') {
        prompt = `Actúa como un gerente de auditoría interno corporativo. Se ha detectado el siguiente hallazgo o desviación: "${textoBase}". Redacta una ACCIÓN DE CHOQUE o plan correctivo, de forma muy ejecutiva, técnica y directa (máximo 20 words). Solo responde con el texto de la acción, sin comillas ni saludos.`;
      } else if (tipoTarget === 'hallazgo') {
        prompt = `Actúa como un Auditor Senior de Control Interno. Estás auditando el siguiente proceso: "${textoBase}". Redacta la descripción de un HALLAZGO O DESVIACIÓN grave y realista (máximo 20 palabras) que se podría encontrar en este proceso. Sé muy ejecutivo, técnico y directo. Solo responde con el texto del hallazgo, sin comillas ni saludos.`;
      }

const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
       method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 }
        })
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message);
      }

      let sugerencia = data.candidates[0].content.parts[0].text.trim();

      if (inputDestino) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeInputValueSetter.call(inputDestino, sugerencia);
        inputDestino.dispatchEvent(new Event('input', { bubbles: true }));
        inputDestino.dispatchEvent(new Event('change', { bubbles: true }));
        showNotification("¡Gemini ha insertado una sugerencia ejecutiva de alto nivel!");
      }
    } catch (error) {
      console.error("Error conectando a Gemini:", error);
      showNotification("Error conectando con la IA de Google. Verifica los ajustes.", "error");
    } finally {
      setIsThinking(false);
    }
  };

  const analizarEvidenciaIA = async (evidenciaUrl, contextoItem, tipoItem) => {
    setIsThinking(true);
    showNotification("🤖 Extrayendo documento y enviando a Gemini...", "success");

    if (!GEMINI_API_KEY) {
      showNotification("⚠️ La clave de API de Gemini no se ha cargado correctamente.", "error");
      setIsThinking(false);
      return;
    }

    try {
      const prompt = `Actúa como un Auditor Senior de Control Interno y Cumplimiento Normativo ISO.
      Se acaba de adjuntar un archivo de evidencia (Foto o PDF o Enlace) para el siguiente ${tipoItem}: "${contextoItem}".
      Tu tarea es generar un dictamen de pre-auditoría rápido y estricto. Genera una lista de 4 puntos exactos que el analista DEBE verificar OBLIGATORIAMENTE con sus propios ojos al abrir ese archivo para asegurar que la evidencia es legalmente válida, mitiga el riesgo y no es fraudulenta. Sé muy técnico y directo (sin saludos).`;

const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }]
          })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      
      const analisis = data.candidates[0].content.parts[0].text.trim();
      setAiModal({ titulo: `📋 Checklist IA (Gemini)`, contenido: analisis, url: evidenciaUrl });

    } catch (error) {
        console.error(error);
        showNotification("Error conectando con la IA de Google.", "error");
    } finally {
        setIsThinking(false);
    }
  };

  // --- FILTRADO GLOBAL COMPACTO (AÑOS Y MESES MÚLTIPLES) ---
  const filterByGlobalPeriod = (item) => {
    const a = getItemAnio(item);
    const m = getItemMesText(item);
    
    const passAnio = selectedAnios.length === 0 || selectedAnios.includes(Number(a)) || selectedAnios.includes(String(a));
    const passMes = selectedMeses.length === 0 || selectedMeses.includes(m);
    
    return passAnio && passMes;
  };

// --- FILTROS GLOBALES OPTIMIZADOS ---
  const incFiltrados = useMemo(() => safeIncidentes.filter(filterByGlobalPeriod), [safeIncidentes, selectedAnios, selectedMeses]);
  const rFiltrados = useMemo(() => safeRiesgos.filter(filterByGlobalPeriod), [safeRiesgos, selectedAnios, selectedMeses]);
  const hFiltrados = useMemo(() => safeHallazgos.filter(filterByGlobalPeriod), [safeHallazgos, selectedAnios, selectedMeses]);
  const pFiltrados = useMemo(() => safePlanes.filter(filterByGlobalPeriod), [safePlanes, selectedAnios, selectedMeses]);

  const comitesFiltrados = useMemo(() => {
    return safeComites.filter(c => {
      const anioComite = Number(c.anio) || new Date().getFullYear();
      const mesComite = c.mes || '';
      const cumpleAnio = selectedAnios.length === 0 || selectedAnios.includes(anioComite);
      const cumpleMes = selectedMeses.length === 0 || selectedMeses.includes(mesComite);
      return cumpleAnio && cumpleMes;
    });
  }, [safeComites, selectedAnios, selectedMeses]);

  const cFiltrados = useMemo(() => safeCronograma.filter(c => {
    const anio = Number(c.anio) || new Date().getFullYear();
    return selectedAnios.length === 0 || selectedAnios.includes(anio);
  }), [safeCronograma, selectedAnios]);

const ejecutarDespachoGmailApi = (emailParams) => enviarCorreoGmail(emailParams, user?.email, showNotification);

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
    
    // 🛡️ Blindaje de Subproceso y Proceso
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

    setPlanes(updatedList); 
    await saveToCloud({ planes: updatedList }); 

    if (dispararCorreo && auditorNotificar) {
        const diccionarioCorreos = { 
          "Rodolfo González": "auditoria@termales.com.co", 
          "Yehison Pineda": "controlinterno@termales.com.co", 
          "Angelica Hernandez": "analista.auditoria@termales.com.co", 
          "Luz Angela Chico": "analista.controlinterno@termales.com.co" 
        };
        await ejecutarDespachoGmailApi({ 
          ref_consecutivo: `APROBACION-100`, 
          titulo_informe: 'Verificar soportes cargados al 100% para proceder con el cierre', 
          proceso_auditado: 'Plan de acción pendiente por aprobar', 
          enlace_pdf: evidenciaUrlOut || 'https://auditoria-gcm.vercel.app', 
          destinatarios: diccionarioCorreos[auditorNotificar] || "controlinterno@termales.com.co" 
        });
        showNotification("Avance guardado. Se notificó al auditor.", "success");
    } else {
        showNotification("Progreso del plan guardado correctamente.");
    }
    e.target.reset();
  };
  const handleAprobarCierrePlan = async (plan) => {
    if (!window.confirm("¿Aprobar evidencias y cerrar definitivamente este plan y su hallazgo vinculado?")) return;
    const ts = new Date().toLocaleString();
    const fechaCierreStr = new Date().toISOString().split('T')[0];
    const planModificado = { ...plan, estado: 'Cerrado', estadoWorkflow: 'Cerrado', progreso: 100, fechaCierre: fechaCierreStr, historialCambios: [...(plan.historialCambios || []), { fecha: ts, usuario: user?.email || 'Sistema', accion: '✅ Plan aprobado y cerrado por el Auditor' }] };
    const updatedPlanes = safePlanes.map(p => p.id === plan.id ? planModificado : p);
    let updatedHallazgos = safeHallazgos;
    const hallazgoPadre = safeHallazgos.find(h => h.id === plan.idHallazgo);
    if (hallazgoPadre) {
        const hallazgoModificado = { ...hallazgoPadre, estado: 'Cerrado', fechaCierre: fechaCierreStr, historialCambios: [...(hallazgoPadre.historialCambios || []), { fecha: ts, usuario: user?.email || 'Sistema', accion: '✅ Hallazgo cerrado' }] };
        updatedHallazgos = safeHallazgos.map(h => h.id === hallazgoPadre.id ? hallazgoModificado : h);
        setHallazgos(updatedHallazgos);
    }
    setPlanes(updatedPlanes);
    await saveToCloud({ planes: updatedPlanes, hallazgos: updatedHallazgos });
    await ejecutarDespachoGmailApi({ ref_consecutivo: `CIERRE-PLAN-${plan.id}`, titulo_informe: '✅ Plan de Acción y Hallazgo Cerrados con Éxito', proceso_auditado: plan.accion.substring(0, 50) + '...', enlace_pdf: plan.evidenciaUrl || 'https://auditoria-gcm.vercel.app', destinatarios: plan.correoResponsable || "controlinterno@termales.com.co" });
    showNotification("¡Ciclo cerrado exitosamente!", "success");
  };

  const handleEvaluacionSubmit = async (e) => {
    e.preventDefault(); 
    const formData = new FormData(e.target);
    const ts = new Date().toLocaleString();
    const hoy = new Date();
    const mesActual = defaultMeses[hoy.getMonth()];
    const anioActual = hoy.getFullYear();

    let updated;
    if (editEvaluacion) {
      const mod = { 
        ...editEvaluacion, 
        proceso: formData.get('proceso'), 
        control: formData.get('control'), 
        calificacion: parseInt(formData.get('calificacion') || 0), 
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
        proceso: formData.get('proceso'), 
        control: formData.get('control'), 
        calificacion: parseInt(formData.get('calificacion') || 0), 
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
    await saveToCloud({ evaluaciones: updated }); 
    e.target.reset(); 
    setFormResetKey(Date.now()); 
    showNotification("Evaluación guardada.");
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
      const nuevo = { id: Date.now(), proceso: formData.get('proceso'), idRiesgo: parseInt(formData.get('idRiesgo')), fecha: new Date().toISOString().split('T')[0], titulo: formData.get('titulo'), descripcion: formData.get('descripcion'), montoSobrante: sobranteVal, montoFaltante: faltanteVal, impacto: formData.get('impacto'), reportadoPor: user.email, evidenciaUrl: formData.get('evidenciaUrlInput'), estado: 'Abierto', anio: new Date().getFullYear(), mes: "Junio", historialCambios: [{ fecha: ts, usuario: user?.email || 'Usuario', accion: 'Evento de pérdida registrado' }] };
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
      
      // 🛡️ Blindaje absoluto de lectura de Subproceso
      const procesoVal = formData.get('proceso') || formData.get('Proceso') || 'Sin proceso';
      const subprocesoVal = formData.get('subproceso') || formData.get('Subproceso') || formData.get('subProceso') || 'General';
      
      const evidenciaUrlOut = formData.get('evidenciaUrlInput') || editInformeAuditoria?.evidenciaUrl || '';
      const correosNotificacionOut = String(formData.get('correosNotificacionInput') || '').trim();
      const tsActual = new Date().toLocaleString();
      let updated; let refConsecutivoFinal = '';

      if (editInformeAuditoria) {
        refConsecutivoFinal = editInformeAuditoria.ref;
        const mod = { 
          ...editInformeAuditoria, 
          titulo: tituloVal, 
          proceso: procesoVal, 
          subproceso: subprocesoVal, 
          fecha: formData.get('fecha') || editInformeAuditoria.fecha, 
          elaboradoPor: formData.get('elaboradoPor') || editInformeAuditoria.elaboradoPor || '', 
          revisadoPor: formData.get('revisadoPor') || editInformeAuditoria.revisadoPor || '', 
          aprobadoPor: formData.get('aprobadoPor') || formData.get('approvedPor') || editInformeAuditoria.aprobadoPor || '', 
          socializado: formData.get('socializado') || editInformeAuditoria.socializado || 'No', 
          socializadoCon: formData.get('socializadoCon') || editInformeAuditoria.socializadoCon || '', 
          evidenciaUrl: evidenciaUrlOut, 
          actaSocializacionUrl: formData.get('actaSocializacionUrlInput') || editInformeAuditoria.actaSocializacionUrl || '', 
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
          correoEnviadoA: correosNotificacionOut !== '' ? correosNotificacionOut : (editInformeAuditoria.correoEnviadoA || ''), 
          fechaCorreoEnviado: correosNotificacionOut !== '' ? tsActual : (editInformeAuditoria.fechaCorreoEnviado || '') 
        };
        updated = safeInformes.map(inf => inf.id === editInformeAuditoria.id ? mod : inf); 
        setEditInformeAuditoria(null);
      } else {
        const ultimo = Math.max(...safeInformes.map(i => parseInt(i.ref?.split('-')[2] || 0)), 0);
        refConsecutivoFinal = `INF-2026-${String(ultimo + 1).padStart(3, '0')}`;
        const nuevo = { 
          id: crypto.randomUUID(), 
          ref: refConsecutivoFinal, 
          titulo: tituloVal, 
          proceso: procesoVal, 
          subproceso: subprocesoVal, 
          fecha: formData.get('fecha') || new Date().toISOString().split('T')[0], 
          elaboradoPor: formData.get('elaboradoPor') || '', 
          revisadoPor: formData.get('revisadoPor') || '', 
          aprobadoPor: formData.get('aprobadoPor') || '', 
          socializado: formData.get('socializado') || 'No', 
          socializadoCon: formData.get('socializadoCon') || '', 
          evidenciaUrl: evidenciaUrlOut, 
          actaSocializacionUrl: formData.get('actaSocializacionUrlInput') || '', 
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
          correoEnviadoA: correosNotificacionOut, 
          fechaCorreoEnviado: correosNotificacionOut !== '' ? tsActual : '' 
        };
        updated = [nuevo, ...safeInformes];
      }
      if (correosNotificacionOut !== '') {
        await ejecutarDespachoGmailApi({ ref_consecutivo: refConsecutivoFinal, titulo_informe: limpiarTildesParaCorreo(`Radicacion de Informe: ${tituloVal}`), proceso_auditado: limpiarTildesParaCorreo(procesoVal), enlace_pdf: evidenciaUrlOut || 'https://auditoria-gcm.vercel.app', destinatarios: correosNotificacionOut });
      }
      setInformesAuditoria(updated); await saveToCloud({ informesAuditoria: updated }); e.target.reset(); showNotification("Informe guardado.");
    } catch (error) {
      showNotification("Error al procesar el informe.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };


// 🔔 Calculador de notificaciones para la barra lateral (Planes en Revisión)
  const pendingPlansCount = safePlanes.filter(p => p.estadoWorkflow === 'En Revisión').length;
  
  // 🛑 SI VIENE DEL CORREO, INTERCEPTAMOS Y MOSTRAMOS LA PANTALLA NUEVA
  if (isResettingPassword) return <ResetPassword oobCode={oobCode} />;

  if (!user) return <AuthScreen />;
if (!isCloudLoaded) return (<div className="flex h-screen w-full items-center justify-center bg-slate-900 text-white flex-col space-y-4"><span className="text-6xl animate-bounce">☁️</span><h2 className="text-xl font-bold tracking-widest uppercase">Conectando...</h2></div>);
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
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      
      {/* BOTÓN FLOTANTE: SALIR DE MODO PRESENTACIÓN */}
      {isPresentationMode && (
        <button 
          onClick={() => setIsPresentationMode(false)} 
          className="fixed bottom-6 right-6 z-[100] bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all hover:scale-105 flex items-center space-x-2 border-2 border-slate-700 animate-in slide-in-from-bottom-10"
        >
          <span>✖</span><span>Salir de Presentación</span>
        </button>
      )}

     {/* SIDEBAR CON NAV DE PROCESOS WORKFLOW */}
      <div className={`w-64 bg-slate-900 text-white flex flex-col shadow-xl z-20 ${isPresentationMode ? 'hidden' : 'flex'}`}>
        <div className="p-6 flex items-center space-x-3 border-b border-slate-800">
          <span className="text-2xl">🛡️</span>
          <div>
            <h1 className="text-sm font-bold tracking-wide">GCM Auditor v5</h1>
            <p className="text-[10px] text-slate-400 font-mono truncate max-w-[170px]">{user.email}</p>
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-4 text-xs font-medium overflow-y-auto">
          {/* CONTROL CENTER */}
          <div>
            <span className="px-3 text-[9px] font-black uppercase text-slate-500 tracking-wider block mb-2">Consola Principal</span>
            <div className="space-y-1">
              <button onClick={() => setActiveTab('tablero')} className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center space-x-2 transition-colors ${activeTab === 'tablero' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}>
                <span>🏠</span> <span>Mi Espacio GRC</span>
              </button>
              <button onClick={() => setActiveTab('dashboard_riesgos')} className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center space-x-2 transition-colors ${activeTab === 'dashboard_riesgos' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}>
                <span>📈</span> <span>GRC Dashboard</span>
              </button>
            </div>
          </div>

          {/* WORKFLOW GRUPOS */}
          <div>
            <span className="px-3 text-[9px] font-black uppercase text-slate-500 tracking-wider block mb-2">Proceso de Auditoría</span>
            <div className="space-y-1">
              
              <button onClick={() => { setActiveTab('plan_anual_tab'); }} className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between transition-colors ${activeTab === 'plan_anual_tab' ? 'bg-[#004d40] text-white font-bold shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}>
                <div className="flex items-center space-x-2">
                  <span>1️⃣</span> <span>Planificación</span>
                </div>
              </button>

              <button onClick={() => { setActiveTab('evaluaciones'); }} className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between transition-colors ${activeTab === 'evaluaciones' ? 'bg-[#004d40] text-white font-bold shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}>
                <div className="flex items-center space-x-2">
                  <span>2️⃣</span> <span>Trabajo de Campo</span>
                </div>
              </button>

              <button onClick={() => { setActiveTab('resultados_tab'); }} className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between transition-colors ${activeTab === 'resultados_tab' ? 'bg-[#004d40] text-white font-bold shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}>
                <div className="flex items-center space-x-2">
                  <span>3️⃣</span> <span>Resultados & Brechas</span>
                </div>
              </button>

              <button onClick={() => { setActiveTab('planes_tab'); }} className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between transition-colors ${activeTab === 'planes_tab' ? 'bg-[#004d40] text-white font-bold shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}>
                <div className="flex items-center space-x-2">
                  <span>4️⃣</span> <span>Planes de Acción</span>
                </div>
                {pendingPlansCount > 0 && (
                  <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse">{pendingPlansCount}</span>
                )}
              </button>

              <button onClick={() => { setActiveTab('gobernanza_tab'); }} className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between transition-colors ${activeTab === 'gobernanza_tab' ? 'bg-[#004d40] text-white font-bold shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}>
                <div className="flex items-center space-x-2">
                  <span>5️⃣</span> <span>Gobernanza y Cierre</span>
                </div>
              </button>

            </div>
          </div>

          {/* ADMIN */}
          {isAdmin && (
            <div>
              <span className="px-3 text-[9px] font-black uppercase text-slate-500 tracking-wider block mb-2">Administración</span>
              <button onClick={() => setActiveTab('config')} className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center space-x-2 transition-colors ${activeTab === 'config' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}>
                <span>⚙️</span> <span>Copias de Seguridad</span>
              </button>
            </div>
          )}
        </nav>
        <div className="p-4 border-t border-slate-800"><button onClick={handleLogout} className="w-full text-[10px] text-slate-300 border border-slate-700/50 rounded-lg py-1.5 font-bold flex items-center justify-center space-x-1"><span>🚪</span> <span>Cerrar Sesión</span></button></div>
      </div>
      
      <div className="flex-1 flex flex-col overflow-hidden relative">
<Navbar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          user={user} 
          handleLogout={handleLogout} 
          dbConnected={isCloudLoaded} 
          currentUserRole={isAdmin ? 'Administrador' : 'Usuario'} 
          isPresentationMode={isPresentationMode}
          setIsPresentationMode={setIsPresentationMode}
        />
{/*  Tracks de gobernanza guiada del Workflow en la cabecera */}
        {!isPresentationMode && <StepIndicatorHUD activeStep={activeTab} />}
        
        <main id="main-scroll-area" className={`flex-grow overflow-y-auto ${isPresentationMode ? 'p-12' : 'p-8'} bg-slate-50 scroll-smooth relative`}>
          <div className={`${isPresentationMode ? 'max-w-none' : 'max-w-7xl'} mx-auto transition-all duration-500`}>
          {/* 🏠 FASE 0: MI ESPACIO DE TRABAJO (Bandeja Ejecutiva + Expediente Único + Dashboard) */}
            {activeTab === 'tablero' && (
              <MiEspacio
                user={user}
                safePlanes={safePlanes}
                safeHallazgos={safeHallazgos}
                safeComites={safeComites}
                safeCronograma={safeCronograma}
                safeRiesgos={safeRiesgos}
                safeEvaluaciones={safeEvaluaciones}
                informesAuditoria={informesAuditoria}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                setSubTabResultados={setSubTabResultados}
                setSubTabPlanes={setSubTabPlanes}
                scrollToForm={scrollToForm}
                selectedProceso={selectedProcesoExpediente}
                setSelectedProceso={setSelectedProcesoExpediente}
              />
            )}
{/* 📈 DASHBOARD INTELIGENTE — RECONECTADO AQUÍ */}
            {activeTab === 'dashboard_riesgos' && (() => {
              const ajustarCoordenada = (valor) => {
                if (valor === undefined || valor === null || valor === '') return 0;
                const s = String(valor).toLowerCase().trim();
                if (s === '20') return 1;
                if (s === '40') return 2;
                if (s === '60') return 3;
                if (s === '80') return 4;
                if (s === '100') return 5;
                if (s === '0') return 1;

                const num = parseInt(s.charAt(0), 10);
                if (!isNaN(num) && num >= 1 && num <= 5) return num;
                
                if (s.includes('rara') || s.includes('muy baja')) return 1;
                if (s.includes('improbable') || s.includes('baja')) return 2;
                if (s.includes('posible') || s.includes('media')) return 3;
                if (s.includes('probable') || s.includes('alta')) return 4;
                if (s.includes('casi seguro') || s.includes('muy alta')) return 5;
                
                if (s.includes('insignificante') || s.includes('leve')) return 1;
                if (s.includes('menor')) return 2;
                if (s.includes('moderado') || s.includes('medio')) return 3;
                if (s.includes('mayor') || s.includes('alto')) return 4;
                if (s.includes('catastrófico') || s.includes('crítico')) return 5;
                return 0;
              };

              const riesgosEstructurados5x5 = (rFiltrados || []).map(r => ({
                ...r,
                probabilidadResidual: ajustarCoordenada(r.probabilidadResidual),
                impactoResidual: ajustarCoordenada(r.impactoResidual),
                probabilidadInherente: ajustarCoordenada(r.probabilidadInherente),
                impactoInherente: ajustarCoordenada(r.impactoInherente)
              }));

// 🟢 Solo evaluar si pertenecen al año y mes que el auditor seleccionó explícitamente en los botones
const evalFiltrados = (safeEvaluaciones || []).filter(item => {
  const anioItem = String(item.anio || '');
  const mesItem = String(item.mes || '');
  
  // Si están todos los meses marcados, obligar a que solo lea el mes de análisis operativo (Junio) 
  // para evitar que los datos demo del pasado ensucien el tablero.
  const aniosSeleccionados = periodFilters['dashboard_riesgos']?.anios || [2026];
  const mesesSeleccionados = periodFilters['dashboard_riesgos']?.meses || ["Junio"];

  return aniosSeleccionados.map(String).includes(anioItem) && mesesSeleccionados.includes(mesItem);
});
              return (
                <DashboardEjecutivo 
                  rFiltrados={riesgosEstructurados5x5} riesgos={riesgos}
                  hFiltrados={hFiltrados} hallazgos={hallazgos}
                  pFiltrados={pFiltrados} planes={planes}
                  cFiltrados={cFiltrados} cronograma={cronograma}
                  // 🟢 INYECCIÓN MULTI-PROP PARA BLINDAR LA CONEXIÓN REAL
                  safeEvaluaciones={safeEvaluaciones}
                  evaluaciones={safeEvaluaciones}
                  evalFiltrados={evalFiltrados}
                  evFiltrados={evalFiltrados}
                  eFiltrados={evalFiltrados}
                  informesAuditoria={informesAuditoria} safeIncidentes={safeIncidentes}
                  matrizFiltro={matrizFiltro} setMatrizFiltro={setMatrizFiltro}
                  setChartDetail={setChartDetail}
                  defaultMeses={defaultMeses} defaultAnios={defaultAnios}
                  selectedAnios={selectedAnios} selectedMeses={selectedMeses}
                  toggleAnio={toggleAnio} toggleMes={toggleMes}
                  setSelectedAnios={setSelectedAnios} setSelectedMeses={setSelectedMeses}
                  setActiveTab={setActiveTab}
                  setSelectedProcesoExpediente={setSelectedProcesoExpediente}
                />
              );
            })()}
{/* 1️⃣ FASE DE PLANIFICACIÓN */}
            {activeTab === 'plan_anual_tab' && (
              <div className="space-y-6">
                <div className="flex flex-wrap border-b border-slate-200 bg-white p-2 rounded-2xl gap-2 shadow-sm text-xs font-bold">
                  <button onClick={() => setSubTabPlanificar('plan_anual')} className={`px-4 py-2 rounded-xl transition-all ${subTabPlanificar === 'plan_anual' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>🗓️ Cronograma Anual</button>
                  <button onClick={() => setSubTabPlanificar('riesgos')} className={`px-4 py-2 rounded-xl transition-all ${subTabPlanificar === 'riesgos' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>⚠️ Matriz de Riesgos</button>
                  <button onClick={() => setSubTabPlanificar('apetito')} className={`px-4 py-2 rounded-xl transition-all ${subTabPlanificar === 'apetito' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>⚖️ Apetito de Riesgo</button>
                </div>
                {subTabPlanificar === 'plan_anual' && (
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
                {subTabPlanificar === 'riesgos' && (
                  <Riesgos 
                    isAdmin={isAdmin} editRiesgo={editRiesgo} setEditRiesgo={setEditRiesgo} handleRiesgoSubmit={handleRiesgoSubmit}
                    setFormResetKey={setFormResetKey} scrollToForm={scrollToForm} handleDeleteItem={handleDeleteItem}
                    applyFilters={applyFilters} FilterInput={FilterInput} rFiltrados={rFiltrados} calcularMatriz5x5={calcularMatriz5x5}
                    searchTerm={searchTerm} setSearchTerm={setSearchTerm} columnFilters={columnFilters} handleColFilterChange={handleColFilterChange}
                    exportToExcel={exportToExcel} safeRiesgos={safeRiesgos}
                  />
                )}
                {subTabPlanificar === 'apetito' && (
                  <Apetito 
                    isAdmin={isAdmin} editApetito={editApetito} setEditApetito={setEditApetito} handleApetitoSubmit={handleApetitoSubmit}
                    activeTooltip={activeTooltip} setActiveTooltip={setActiveTooltip} setFormResetKey={setFormResetKey} formResetKey={formResetKey}
                    scrollToForm={scrollToForm} rFiltrados={rFiltrados} incFiltrados={incFiltrados} calcularMatriz5x5={calcularMatriz5x5}
                    searchTerm={searchTerm} setSearchTerm={setSearchTerm} columnFilters={columnFilters} handleColFilterChange={handleColFilterChange}
                    FilterInput={FilterInput} applyFilters={applyFilters}
                  />
                )}
              </div>
            )}

            {/* 2️⃣ FASE DE TRABAJO DE CAMPO */}
{activeTab === 'evaluaciones' && (
  <Evaluaciones 
    isAdmin={isAdmin} editEvaluacion={editEvaluacion} setEditEvaluacion={setEditEvaluacion}
    handleEvaluacionSubmit={handleEvaluacionSubmit}
    safeRiesgos={safeRiesgos} user={user} analizarEvidenciaIA={analizarEvidenciaIA} safeEvaluaciones={safeEvaluaciones}
    formatSafeDate={formatSafeDate} searchTerm={searchTerm} setSearchTerm={setSearchTerm} columnFilters={columnFilters}
    handleColFilterChange={handleColFilterChange} FilterInput={FilterInput} applyFilters={applyFilters}
    setFormResetKey={setFormResetKey} scrollToForm={scrollToForm} handleDeleteItem={handleDeleteItem}
  />
)}
            {/* 3️⃣ FASE DE RESULTADOS & BRECHAS */}
            {activeTab === 'resultados_tab' && (
              <div className="space-y-6">
                <div className="flex flex-wrap border-b border-slate-200 bg-white p-2 rounded-2xl gap-2 shadow-sm text-xs font-bold">
                  <button onClick={() => setSubTabResultados('hallazgos')} className={`px-4 py-2 rounded-xl transition-all ${subTabResultados === 'hallazgos' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>📄 Hallazgos Registrados</button>
                  {isAdmin && (
                    <button onClick={() => setSubTabResultados('informes')} className={`px-4 py-2 rounded-xl transition-all ${subTabResultados === 'informes' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>📁 Informes Emitidos</button>
                  )}
                </div>
                {subTabResultados === 'hallazgos' && (
                  <Hallazgos 
                    isAdmin={isAdmin} informesAuditoria={informesAuditoria} editHallazgo={editHallazgo} setEditHallazgo={setEditHallazgo}
                    handleHallazgoSubmit={handleHallazgoSubmit} setFormResetKey={setFormResetKey} scrollToForm={scrollToForm}
                    handleDeleteItem={handleDeleteItem} applyFilters={applyFilters} hFiltrados={hFiltrados} searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm} columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} FilterInput={FilterInput}
                  />
                )}
                {subTabResultados === 'informes' && isAdmin && (
                  <InformesAuditoria 
                    informesAuditoria={informesAuditoria} setInformesAuditoria={setInformesAuditoria} editInformeAuditoria={editInformeAuditoria}
                    setEditInformeAuditoria={setEditInformeAuditoria} isAdmin={isAdmin} user={user} searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                    columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} exportToExcel={exportToExcel}
                    handleInformeAuditoriaSubmit={handleInformeAuditoriaSubmit} isSubmitting={isSubmitting} setFormResetKey={setFormResetKey}
                    scrollToForm={scrollToForm} handleDeleteItem={handleDeleteItem} applyFilters={applyFilters} FilterInput={FilterInput}
                    safeHallazgos={safeHallazgos} safePlanes={safePlanes} formatSafeDate={formatSafeDate} auditoresLista={auditoresLista}
                    onActualizarAuditores={async (nuevaLista) => { setAuditoresLista(nuevaLista); await saveToCloud({ auditoresLista: nuevaLista }); }}
                  />
                )}
              </div>
            )}

            {/* 4️⃣ FASE DE PLANES DE ACCIÓN */}
            {activeTab === 'planes_tab' && (
              <div className="space-y-6">
                <div className="flex flex-wrap border-b border-slate-200 bg-white p-2 rounded-2xl gap-2 shadow-sm text-xs font-bold">
                  <button onClick={() => setSubTabPlanes('planes')} className={`px-4 py-2 rounded-xl transition-all ${subTabPlanes === 'planes' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>✅ Seguimiento de Planes</button>
                  <button onClick={() => setSubTabPlanes('incidentes')} className={`px-4 py-2 rounded-xl transition-all ${subTabPlanes === 'incidentes' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>🚨 Eventos de Pérdida</button>
                </div>
                {subTabPlanes === 'planes' && (
                  <Planes 
                    ejecutarDespachoGmailApi={ejecutarDespachoGmailApi} handleAprobarCierrePlan={handleAprobarCierrePlan} isAdmin={isAdmin}
                    editPlan={editPlan} setEditPlan={setEditPlan} handlePlanSubmit={handlePlanSubmit} formResetKey={formResetKey}
                    setFormResetKey={setFormResetKey} scrollToForm={scrollToForm} handleDeleteItem={handleDeleteItem} applyFilters={applyFilters}
                    FilterInput={FilterInput} pFiltrados={pFiltrados} safeHallazgos={safeHallazgos} setHallazgos={setHallazgos}
                    safePlanes={safePlanes} setPlanes={setPlanes} saveToCloud={saveToCloud} formatSafeDate={formatSafeDate}
                    searchTerm={searchTerm} setSearchTerm={setSearchTerm} columnFilters={columnFilters} handleColFilterChange={handleColFilterChange}
                    informesAuditoria={informesAuditoria} defaultAnios={defaultAnios} defaultMeses={defaultMeses} selectedAnios={selectedAnios}
                    selectedMeses={selectedMeses} toggleAnio={toggleAnio} toggleMes={toggleMes} setSelectedAnios={setSelectedAnios} setSelectedMeses={setSelectedMeses}
                    selectAllAnios={() => setSelectedAnios([...defaultAnios])} clearAllAnios={() => setSelectedAnios([])}
                    selectAllMeses={() => setSelectedMeses([...defaultMeses])} clearAllMeses={() => setSelectedMeses([])}
                    onUpdateItemStatus={async (coleccion, id, nuevoEstadoWorkflow) => {
                      try {
                        const ts = new Date().toLocaleString();
                        const logTrazabilidad = { fecha: ts, usuario: user?.email || 'Usuario', accion: `Fase de Gobernanza actualizada a: ${nuevoEstadoWorkflow}` };
                        const planActual = safePlanes.find(p => p.id === id);
                        if (!planActual) return;
                        const planModificado = { ...planActual, estadoWorkflow: nuevoEstadoWorkflow, historialCambios: [...(planActual.historialCambios || []), logTrazabilidad] };
                        const updatedList = safePlanes.map(p => p.id === id ? planModificado : p);
                        setPlanes(updatedList);
                        await saveToCloud({ planes: updatedList });
                        setEditPlan(planModificado);
                        setFormResetKey(Date.now());
                        if (nuevoEstadoWorkflow === 'En Revisión') {
                          await ejecutarDespachoGmailApi({ ref_consecutivo: `PLAN-${id}`, titulo_informe: 'Plan de Acción Publicado Listo para Validación', proceso_auditado: planModificado.accion.substring(0, 50) + '...', enlace_pdf: 'https://auditoria-gcm.vercel.app', destinatarios: 'controlinterno@termales.com.co' });
                          showNotification("Plan enviado a revisión y administrador notificado.");
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
            {activeTab === 'gobernanza_tab' && (
              <div className="space-y-6">
                <div className="flex flex-wrap border-b border-slate-200 bg-white p-2 rounded-2xl gap-2 shadow-sm text-xs font-bold">
                  <button onClick={() => setSubTabGobernanza('comites')} className={`px-4 py-2 rounded-xl transition-all ${subTabGobernanza === 'comites' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>👥 Sesiones de Comité</button>
                  {isAdmin && (
                    <button onClick={() => setSubTabGobernanza('trazabilidad')} className={`px-4 py-2 rounded-xl transition-all ${subTabGobernanza === 'trazabilidad' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>📜 Bitácora de Trazabilidad</button>
                  )}
                </div>
                {subTabGobernanza === 'comites' && (
                  <Comites 
                    isAdmin={isAdmin} editComite={editComite} setEditComite={setEditComite} handleComiteSubmit={handleComiteSubmit}
                    setFormResetKey={setFormResetKey} formResetKey={formResetKey} scrollToForm={scrollToForm} handleDeleteItem={handleDeleteItem}
                    applyFilters={applyFilters} comitesFiltrados={comitesFiltrados} searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                    columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} FilterInput={FilterInput}
                  />
                )}
                {subTabGobernanza === 'trazabilidad' && isAdmin && (
                  <Trazabilidad 
                    safeRiesgos={safeRiesgos} safeEvaluaciones={safeEvaluaciones} safeHallazgos={safeHallazgos}
                    safePlanes={safePlanes} safeIncidentes={safeIncidentes}
                  />
                )}
              </div>
            )}

            {/* ⚙️ CONFIGURACIÓN */}
            {activeTab === 'config' && (
              <Configuracion 
                forceUpdateCronograma={forceUpdateCronograma}
                handleImportExcelRiesgos={handleImportExcelRiesgos}
                exportToJSON={exportToJSON}
                handleImportJSON={handleImportJSON}
              />
            )}
          </div>
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
{notification && (<div className={`fixed bottom-4 right-4 px-6 py-4 rounded-xl shadow-2xl font-bold text-sm z-50 animate-in slide-in-from-bottom-5 ${notification.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>{notification.message}</div>)}
    </div>
  );
}