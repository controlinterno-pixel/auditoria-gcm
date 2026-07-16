import React, { useState, useEffect, useMemo } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth'; 
import { doc, setDoc, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';
// 🔥 NUEVA CONEXIÓN MODULAR A FIREBASE
import { auth, db } from './services/firebase';
import { obtenerSugerenciaIA, obtenerAnalisisEvidenciaIA } from './services/gemini';
import { 
  formatSafeDate, getMonthFromDate, getYearFromDate, 
  getItemAnio, getItemMesText, calcularMatriz5x5, applyFilters, mapMesNumATexto 
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
import Tablero from './components/Tablero';
import DashboardRiesgos from './components/DashboardRiesgos';
import AuditorIA from './components/AuditorIA';
import Comites from './components/Comites';
import DashboardEjecutivo from './components/DashboardEjecutivo';
import MiEspacio from './components/MiEspacio';
import ModalIA from './components/ModalIA';
import ModalDetalleGrafico from './components/ModalDetalleGrafico';
import { enviarCorreoGmail } from './services/gmailService';
import { 
  defaultCronograma, defaultRiesgos, defaultHallazgos, 
  defaultPlanes, defaultIncidentes, defaultEvaluaciones, defaultMonitoreo 
} from './constants/defaultData';
// =====================================================================
// 🤖 CONEXIÓN SEGURA A GEMINI PRO IA
// =====================================================================
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
// --- CONTROL DE ACCESO (ROLES) ---
const ADMIN_EMAILS = [
  "controlinterno@termales.com.co",
  "auditoria@termales.com.co",
  "analista.auditoria@termales.com.co",
  "analista.controlinterno@termales.com.co"
];

// =====================================================================
// 🛠️ FUNCIONES GLOBALES Y CÁLCULOS
// =====================================================================

// --- COMPONENTES VISUALES ---
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

const Gauge = ({ value, label, sublabel, colorClass }) => {
  const safeValue = Math.min(Math.max(Math.round(Number(value) || 0), 0), 100);
  
  // 💡 Lógica para identificar y mostrar el Tooltip (title) correcto
  let tooltipText = "";
  if (label === "MITIGACIÓN GLOBAL" || label === "PLANES DE ACCIÓN") {
    tooltipText = "📍 ORIGEN: Planes de Acción\n❓ POR QUÉ: Mide el esfuerzo de mitigación\n📝 EXPLICACIÓN: Tareas y acciones correctivas que el equipo tiene actualmente en progreso o pendientes.";
  } else if (label === "CONTROLES DE SALUD" || label === "SALUD DE CONTROLES") {
    tooltipText = "📍 ORIGEN: Auditoría de Controles\n❓ POR QUÉ: Indica la cobertura de nuestro aseguramiento\n📝 EXPLICACIÓN: Porcentaje de controles que han sido evaluados frente al universo total de riesgos.";
  }

  return (
    <div 
      className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center text-center h-full hover:shadow-md transition-shadow cursor-help"
      title={tooltipText}
    >
      <div className="relative w-32 h-32 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="64" cy="64" r="54" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-100" />
          <circle cx="64" cy="64" r="54" stroke="currentColor" strokeWidth="12" fill="transparent" 
            strokeDasharray={339} strokeDashoffset={339 - (339 * safeValue) / 100}
            className={`${colorClass} transition-all duration-1000`} strokeLinecap="round" />
        </svg>
        <span className="absolute text-3xl font-black text-slate-800 notranslate" translate="no">{safeValue} %</span>
      </div>
      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-6">{label}</p>
      <p className="text-[10px] font-bold text-slate-500 mt-1">{sublabel}</p>
    </div>
  );
};

const FilterInput = ({ colKey, placeholder, dark, columnFilters, handleColFilterChange }) => (
  <input 
    type="text" 
    placeholder={placeholder || "Filtrar..."}
    className={`mt-2 w-full text-[10px] px-2 py-1.5 font-medium rounded-md border focus:outline-none focus:ring-2 transition-all ${
      dark 
        ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:ring-blue-500' 
        : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-[#004d40]'
    }`}
    value={columnFilters[colKey] || ''}
    onChange={(e) => handleColFilterChange(colKey, e.target.value)}
    onClick={(e) => e.stopPropagation()} 
  />
);
// 🛤️ COMPONENTE ASISTENTE: BARRA DE PROGRESO DE FASE (STEPPER HUD)
const StepIndicatorHUD = ({ activeStep }) => {
  const steps = [
    { label: "1. Planificación", key: "plan_anual_tab" },
    { label: "2. Campo", key: "evaluaciones" },
    { label: "3. Resultados", key: "resultados_tab" },
    { label: "4. Planes", key: "planes_tab" },
    { label: "5. Gobernanza", key: "gobernanza_tab" }
  ];
  return (
    <div className="bg-[#0b1329] border-b border-slate-800 px-8 py-2.5 flex items-center justify-between gap-4 text-xs font-bold text-slate-400">
      <span className="text-slate-400 text-[10px] uppercase tracking-wider font-black">Flujo de Trabajo GRC Activo:</span>
      <div className="flex items-center space-x-3 overflow-x-auto py-0.5">
        {steps.map((st, i) => {
          const isCurrent = activeStep === st.key;
          return (
            <React.Fragment key={st.key}>
              <div className={`flex items-center space-x-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${isCurrent ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-900 border border-slate-800 text-slate-500'}`}>
                <span>{i + 1}.</span>
                <span>{st.label.split('. ')[1]}</span>
              </div>
              {i < steps.length - 1 && <span className="text-slate-700 font-bold">➔</span>}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('tablero');
  
  // 🔌 ESTADOS PARA NAVEGACIÓN ANIDADA DE PROCESOS (WORKFLOW)
  const [subTabPlanificar, setSubTabPlanificar] = useState('plan_anual');
  const [subTabResultados, setSubTabResultados] = useState('hallazgos');
  const [subTabPlanes, setSubTabPlanes] = useState('planes');
  const [subTabGobernanza, setSubTabGobernanza] = useState('comites');

  // 🔌 ESTADO PARA EL CASO ACTIVO DEL EXPEDIENTE ÚNICO

  const [auditoresLista, setAuditoresLista] = useState(["Rodolfo González", "Yehison Pineda", "Angelica Hernandez", "Luz Angela Chico"]);
  const [notification, setNotification] = useState(null);
  const [tipoMatriz, setTipoMatriz] = useState('residual'); 
  const [isPresentationMode, setIsPresentationMode] = useState(false); 
  const [formResetKey, setFormResetKey] = useState(Date.now()); 

  const [searchTerm, setSearchTerm] = useState('');
  const [columnFilters, setColumnFilters] = useState({});
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCloudLoaded, setIsCloudLoaded] = useState(false);
  const [filtroHeatMap, setFiltroHeatMap] = useState(null);
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

// 🔐 ESTADOS DE AUTENTICACIÓN
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

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
    setFiltroHeatMap(null);
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

 useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const emailNorm = currentUser.email?.toLowerCase().trim();
        setIsAdmin(ADMIN_EMAILS.includes(emailNorm));
      } else {
        setIsAdmin(false);
        setShowWelcome(true); // 🛡️ ¡LÍNEA NUEVA! Cada vez que se cierre sesión, reinicia la bienvenida a true
      }
    });
    return () => unsubscribe();
  }, []);

 useEffect(() => {
    if (!user) return;
    setIsCloudLoaded(false);
    
    // 🛡️ Seguro anti-congelamiento: Si Firebase no responde en 4 segundos, fuerza la entrada
    const timeoutSeguridad = setTimeout(() => {
      console.warn("⚠️ Firebase está tardando demasiado o Storage no está activo. Forzando entrada...");
      setIsCloudLoaded(true);
    }, 4000);

    const docRef = doc(db, 'workspace_compartido', 'base_de_datos_grc');
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      clearTimeout(timeoutSeguridad); // Si responde bien, cancela el timer
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
        if (ADMIN_EMAILS.some(email => email.toLowerCase().trim() === user.email?.toLowerCase().trim())) {
           setDoc(docRef, { riesgos: defaultRiesgos, hallazgos: defaultHallazgos, planes: defaultPlanes, incidentes: defaultIncidentes, evaluaciones: defaultEvaluaciones, cronograma: defaultCronograma, monitoreo: defaultMonitoreo, informesAuditoria: [], comites: [] });
        }
      }
      setIsCloudLoaded(true);
    }, (error) => {
      clearTimeout(timeoutSeguridad);
      console.error("🔥 Error de Firebase:", error);
      setIsCloudLoaded(true); // Forzamos entrada aunque haya error
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

  const handleAuthSubmit = async (e) => {
    e.preventDefault(); setAuthError('');
    try {
      if (isRegistering) { await createUserWithEmailAndPassword(auth, authEmail, authPassword); }
      else { await signInWithEmailAndPassword(auth, authEmail, authPassword); }
    } catch (error) { setAuthError('Error en credenciales.'); }
  };

const handleLogout = async () => { 
    await signOut(auth); 
    setShowWelcome(true); // 🛡️ Asegura que al dar clic al botón se active la pantalla de nuevo
  };
  const saveToCloud = async (partialData) => { await setDoc(doc(db, 'workspace_compartido', 'base_de_datos_grc'), partialData, { merge: true }); };
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
  // 🧠 FUNCIÓN CENTRAL DEL "AUDITOR IA" (SOPORTE DE CLIC AUTOMÁTICO E INTEGRAL)
  // =====================================================================
  const handleAuditorSubmit = async (e, textoDirecto = null) => {
    if (e) e.preventDefault(); // Evita recargar la página si viene de un formulario
    
    // Si viene de un clic directo usa ese texto, si no, usa el del input bar
    const consultaFinal = textoDirecto || auditorInput;
    if (!consultaFinal.trim()) return;

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY;

    if (!apiKey) {
      setAuditorRespuesta("⚠️ Error: No se encontró la API Key en tu archivo .env local o en Vercel.");
      return;
    }

    setIsAuditorThinking(true);
    setAuditorRespuesta('');

    try {
      const hoy = new Date();

      // 🛑 EXTRACCIÓN DE DATOS FILTRADOS POR EL PERIODO SELECCIONADO
      const riesgosBase = rFiltrados;
      const hallazgosBase = hFiltrados;
      const planesBase = pFiltrados;
      const incidentesBase = incFiltrados;
      const cronogramaBase = cFiltrados;

      // 🛑 MÓDULO 1: MATRIZ DE RIESGOS
      const totalRiesgos = riesgosBase.length;
      let criticosTotal = 0;
      let riesgosOperativos = riesgosBase.filter(r => r.categoria === 'Operativo').length;
      let riesgosEstrategicos = riesgosBase.filter(r => r.categoria === 'Estratégico').length;
      let riesgosTecnologicos = riesgosBase.filter(r => r.categoria === 'Tecnológico').length;
      try {
        criticosTotal = riesgosBase.filter(r => r.probabilidadResidual && r.impactoResidual && calcularMatriz5x5(r.probabilidadResidual, r.impactoResidual).score > 16).length;
      } catch(err) {}

      // 📄 MÓDULO 2 & 3: HALLAZGOS Y PLANES
      const totalHallazgos = hallazgosBase.length;
      const hallazgosAbiertos = hallazgosBase.filter(h => h.estado === 'Abierto').length;
      const hallazgosCerrados = totalHallazgos - hallazgosAbiertos;
      const totalPlanes = planesBase.length;
      const planesVencidos = planesBase.filter(p => p.estado !== 'Cerrado' && p.fecha && new Date(p.fecha) < hoy).length;
      const avancePlanesGlobal = totalPlanes > 0 ? Math.round(planesBase.reduce((acc, p) => acc + (p.progreso || p.avance || 0), 0) / totalPlanes) : 0;

      // 🚨 MÓDULO 4: INCIDENTES Y PÉRDIDAS
      const totalIncidentes = incidentesBase.length;
      const lossesAcumuladas = incidentesBase.reduce((acc, i) => acc + (Number(i.costo) || 0), 0);

      // 🔬 MÓDULO 5: AUDITORÍA DE CONTROLES
      const evalFiltradas = safeEvaluaciones.filter(filterByGlobalPeriod);
      const totalEvaluaciones = evalFiltradas.length;
      const controlesEficaces = evalFiltradas.filter(ev => ev.calificacion === 100).length;
      const efectividadControlesGlobal = totalEvaluaciones > 0 ? Math.round((controlesEficaces / totalEvaluaciones) * 100) : 0;

      // 🗓️ MÓDULO 6: PLAN ANUAL DE AUDITORÍA
      const totalCronograma = cronogramaBase.length;
      const cronogramaIniciados = cronogramaBase.filter(c => (Number(c.cumplimiento) || 0) > 0);
      const avanceCronogramaGlobal = cronogramaIniciados.length > 0 
        ? Math.round(cronogramaIniciados.reduce((acc, c) => acc + (Number(c.cumplimiento) || 0), 0) / cronogramaIniciados.length) 
        : 0;
      const pendientesArray = cronogramaBase.filter(c => (Number(c.cumplimiento) || 0) < 100).map(c => c.proceso);
      const listadoPendientesCronograma = pendientesArray.length > 0 ? pendientesArray.join(', ') : 'Ninguno (100% de ejecución)';

      // 📁 NUEVO MÓDULO 7: INFORMES EMITIDOS
      const totalInformes = (Array.isArray(informesAuditoria) ? informesAuditoria : []).length;

      // 📈 NUEVO MÓDULO 8: INDICADORES DE MONITOREO
      const totalIndicadores = safeMonitoreo.length;
      const alertasIndicadores = safeMonitoreo.filter(m => m.valor > m.limite).map(m => m.indicador).join(', ') || 'Ninguno bajo alerta crítica';

      // 2. RE-ESTRUCTURACIÓN COMPLETA DEL PROMPT CON TODOS LOS MÓDULOS
      const megaContexto = `
        Actúas como el "Auditor IA", un asistente senior del equipo de CONTROL INTERNO de TERMALES DE SANTA ROSA.
        Eres directo, ejecutivo y experto en GRC. Responde utilizando únicamente esta radiografía matemática filtrada del sistema:

        [DATOS DEL DASHBOARD EJECUTIVO Y GENERAL]
        - Cumplimiento de Ejecución del Plan Anual: ${avanceCronogramaGlobal}%
        - Avance Físico de Planes de Mejoramiento: ${avancePlanesGlobal}%
        - Efectividad General de Controles Auditados: ${efectividadControlesGlobal}%

        [DATOS DE MATRIZ DE RIESGOS]
        - Total Riesgos Identificados: ${totalRiesgos}
        - Riesgos Críticos o Extremos (Zona Roja Crítica): ${criticosTotal}
        - Clasificación: Operativos (${riesgosOperativos}), Estratégicos (${riesgosEstrategicos}), Tecnológicos (${riesgosTecnologicos}).

        [DATOS DE PLANES DE MEJORAMIENTO Y GOBERNANZA]
        - Planes de Acción Totales: ${totalPlanes} (Planes Vencidos: ${planesVencidos})
        - Hallazgos/Desviaciones Abiertas detectadas: ${hallazgosAbiertos} (Cerradas: ${hallazgosCerrados})

        [DATOS DE EVENTOS DE PÉRDIDA E INCIDENTES]
        - Total Incidentes Materializados: ${totalIncidentes}
        - Impacto Financiero Acumulado: $${lossesAcumuladas.toLocaleString('es-CO')} COP

        [DATOS DE INFORMES EMITIDOS]
        - Total Informes Radicados Formalmente en el Repositorio: ${totalInformes} informes emitidos.

        [DATOS DE INDICADORES DE MONITOREO]
        - Total Indicadores en Seguimiento Continuo: ${totalIndicadores}
        - Indicadores que superan límites máximos de alerta: [ ${alertasIndicadores} ]

        REGLAS OBLIGATORIAS DE RESPUESTA:
        1. RESPONDE EXCLUSIVAMENTE SOBRE EL TEMA DE LA PREGUNTA. Si seleccionan Riesgos, habla de riesgos. Si seleccionan Informes, habla de informes. No mezcles métricas de otros módulos.
        2. COMIENZA RESPONDIENDO AL GRANO. La primera línea debe contener el dato exacto de forma contundente (Ej: "A hoy Control Interno registra un total de ${totalInformes} informes emitidos...", "La efectividad general de los controles se encuentra en un ${efectividadControlesGlobal}%...").
        3. SÉ UN CONSULTOR DE CONTROL INTERNO. Añade un breve párrafo analítico corporativo senior evaluando si la gestión de ese módulo va por buen camino o si requiere atención urgente según las cifras expuestas.
      `;

      const promptFinal = `${megaContexto}\n\nConsulta del Líder: "${consultaFinal}"`;

      // 3. LLAMADO DE BAJA TEMPERATURA A GEMINI 2.5 FLASH
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptFinal }] }],
          generationConfig: { temperature: 0.1 }
        })
      });

      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error?.message || `Error HTTP ${response.status}`);
      
      if (data.candidates && data.candidates[0].content.parts[0].text) {
        setAuditorRespuesta(data.candidates[0].content.parts[0].text.trim());
      } else {
        throw new Error("Respuesta vacía del servidor.");
      }

    } catch (error) {
      console.error("🔍 Error IA:", error);
      setAuditorRespuesta(`❌ Error en consolidación de datos: ${error.message}`);
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

        if(window.confirm("⚠️ ALERTA: ¿Deseas cargar esta Matriz de Riesgos? Reemplazará los riesgos actuales para NO acumular basura. Las variables avanzadas COSO de los riesgos que ya existían se mantendrán intactas.")) {
          setIsCloudLoaded(false);
          
          const riesgosAgrupados = {};

          json.forEach((r, index) => {
             // 🎯 Adaptabilidad exacta a las columnas en MAYÚSCULA de tu archivo Excel
             const idRaw = r['NO'] || r['No'] || r['ID'] || r['Id'] || r['id'] || (Date.now() + index);
             const idRiesgo = parseInt(idRaw) || idRaw;
             
             // Busca si existe para no borrar variables COSO, si no, crea uno nuevo
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
                  
                  // 🔥 CAPTURANDO LAS PROBABILIDADES E IMPACTOS DEL EXCEL
                  probabilidadInherente: r['PROBABILIDAD INHERENTE'] || riesgoExistente.probabilidadInherente || 1,
                  impactoInherente: r['IMPACTO INHERENTE'] || riesgoExistente.impactoInherente || 1,
                  probabilidadResidual: r['PROBABILIDAD RESIDUAL FINAL'] || riesgoExistente.probabilidadResidual || 1,
                  impactoResidual: r['IMPACTO RESIDUAL FINAL'] || riesgoExistente.impactoResidual || 1,
                  
                  noControl: r['NO. CONTROL'] || riesgoExistente.noControl || '',
                  descripcionControl: r['DESCRIPCIÓN DEL CONTROL'] || riesgoExistente.descripcionControl || '',

                  // 🔥 Variables COSO ERM protegidas
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

          // 🧹 Al guardar "Object.values", automáticamente SE BORRAN los riesgos viejos que no venían en este Excel
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

  // ✨ ESTA ES LA VERSIÓN REAL Y AUTOMÁTICA PARA TUS COMITÉS:
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

// ⚡ MOTOR NATIVO GOOGLE GMAIL API OAUTH2 (REEMPLAZO TOTAL DE EMAILJS)
  // =====================================================================
  const ejecutarDespachoGmailApi = (emailParams) => enviarCorreoGmail(emailParams, user?.email, showNotification);

 const handleRiesgoSubmit = async (e) => {
    e.preventDefault(); const formData = new FormData(e.target);
    const ts = new Date().toLocaleString();
    let updated;
    if (editRiesgo) {
      const mod = { ...editRiesgo, sede: formData.get('sede'), proceso: formData.get('proceso'), categoria: formData.get('categoria'), normativa: formData.get('normativa'), responsable: formData.get('responsable'), descripcionControl: formData.get('control'), descripcion: formData.get('descripcion'), probabilidadInherente: formData.get('probInh'), impactoInherente: formData.get('impInh'), probabilidadResidual: formData.get('probRes'), impactoResidual: formData.get('impRes'), capacidadRiesgo: editRiesgo.capacidadRiesgo||null, toleranciaFinanciera: editRiesgo.toleranciaFinanciera||null, apetitoFinanciero: editRiesgo.apetitoFinanciero||null, posturaEstrategica: editRiesgo.posturaEstrategica||null, kriScore: editRiesgo.kriScore||null, historialCambios: [...(editRiesgo.historialCambios || []), { fecha: ts, usuario: user?.email || 'Usuario', accion: 'Modificado en matriz' }] };
      updated = safeRiesgos.map(r => r.id === editRiesgo.id ? mod : r); setEditRiesgo(null);
    } else {
      const nuevo = { id: Date.now(), sede: formData.get('sede'), proceso: formData.get('proceso'), categoria: formData.get('categoria'), normativa: formData.get('normativa'), responsable: formData.get('responsable'), noControl: 'C-' + Math.floor(Math.random() * 100 + 100), descripcionControl: formData.get('control'), descripcion: formData.get('descripcion'), probabilidadInherente: formData.get('probInh'), impactoInherente: formData.get('impInh'), probabilidadResidual: formData.get('probRes'), impactoResidual: formData.get('impRes'), anio: 2026, mes: "Junio", historialCambios: [{ fecha: ts, usuario: user?.email || 'Usuario', accion: 'Creado' }] };
      updated = [nuevo, ...safeRiesgos];
    }
    setRiesgos(updated); await saveToCloud({ riesgos: updated }); e.target.reset(); showNotification("Riesgo estructurado.");
  };

const handlePlanSubmit = async (e) => {
    e.preventDefault(); 
    const formData = new FormData(e.target);
    const ts = new Date().toLocaleString();
    
    let evidenciaUrlOut = formData.get('evidenciaUrlInput') || editPlan?.evidenciaUrl || '';
    const progresoVal = parseInt(formData.get('progreso') || 0);
    
    // 🟢 CAMPOS CONECTADOS
    const fechaInicioVal = formData.get('fechaInicio') || '';
    const mecanismoVal = formData.get('mecanismo') || '';

    let updatedList;
    let dispararCorreo = false;
    let auditorNotificar = '';
    let accionNotificar = '';

    if (editPlan && isAdmin) {
      // Flujo Admin: Guarda y si es 100% cierra automáticamente
      const estadoVal = progresoVal === 100 ? 'Cerrado' : 'En Proceso';
      const workflowVal = progresoVal === 100 ? 'Cerrado' : (editPlan.estadoWorkflow || 'Borrador');
      
      const modificado = { ...editPlan, idHallazgo: parseInt(formData.get('idHallazgo')), accion: formData.get('accion'), responsable: formData.get('responsable'), fecha: formData.get('fecha'), progreso: progresoVal, estado: estadoVal, estadoWorkflow: workflowVal, evidenciaUrl: evidenciaUrlOut, fechaInicio: fechaInicioVal, mecanismo: mecanismoVal, historialCambios: [...(editPlan.historialCambios || []), { fecha: ts, usuario: user?.email || 'Usuario', accion: 'Plan actualizado' }] };
      
      if(progresoVal === 100 && !modificado.fechaCierre) {
          modificado.fechaCierre = new Date().toISOString().split('T')[0];
      }
      updatedList = safePlanes.map(p => p.id === editPlan.id ? modificado : p);
      setEditPlan(null);

    } else if (!isAdmin) {
      // 🛡️ Flujo Líder de Proceso: Interceptar el 100%
      const idHallazgo = parseInt(formData.get('idHallazgo'));
      const planToUpdate = safePlanes.find(p => p.idHallazgo === idHallazgo);
      
      if (planToUpdate) {
        let estadoVal = 'En Proceso'; 
        let workflowVal = planToUpdate.estadoWorkflow || 'Borrador';

        if (progresoVal === 100 && workflowVal !== 'Cerrado') {
            workflowVal = 'En Revisión'; // Pasa a gobernanza del auditor
            dispararCorreo = true;
            auditorNotificar = planToUpdate.auditorAsignado;
            accionNotificar = planToUpdate.accion;
        } else if (progresoVal < 100) {
            workflowVal = 'Borrador';
        }

        const mod = { ...planToUpdate, progreso: progresoVal, estado: estadoVal, estadoWorkflow: workflowVal, evidenciaUrl: evidenciaUrlOut, fechaInicio: fechaInicioVal, mecanismo: mecanismoVal, historialCambios: [...(planToUpdate.historialCambios || []), { fecha: ts, usuario: user?.email || 'Usuario', accion: progresoVal === 100 ? 'Reportado al 100% - Pendiente de revisión' : 'Avance reportado por Jefe de área' }] };
        updatedList = safePlanes.map(p => p.id === planToUpdate.id ? mod : p);
      } else {
        showNotification("Error: No se encontró el plan asociado a este hallazgo.", "error");
        return;
      }
    } else {
      // Nuevo plan
      const estadoVal = progresoVal === 100 ? 'Cerrado' : 'En Proceso';
      const workflowVal = progresoVal === 100 ? 'Cerrado' : 'Borrador';
      const nuevo = { id: Date.now(), idHallazgo: parseInt(formData.get('idHallazgo')), accion: formData.get('accion'), responsable: formData.get('responsable'), fecha: formData.get('fecha'), progreso: progresoVal, estado: estadoVal, estadoWorkflow: workflowVal, anio: 2026, mes: "Junio", evidenciaUrl: evidenciaUrlOut, fechaInicio: fechaInicioVal, mecanismo: mecanismoVal, historialCambios: [{ fecha: ts, usuario: user?.email || 'Usuario', accion: 'Plan asignado' }] };
      updatedList = [...safePlanes, nuevo];
    }
    
    setPlanes(updatedList); 
    await saveToCloud({ planes: updatedList }); 

    // ✉️ DISPARAR CORREO AL AUDITOR ASIGNADO
    if (dispararCorreo && auditorNotificar) {
        const diccionarioCorreos = {
            "Rodolfo González": "auditoria@termales.com.co",
            "Yehison Pineda": "controlinterno@termales.com.co",
            "Angelica Hernandez": "analista.auditoria@termales.com.co",
            "Luz Angela Chico": "analista.controlinterno@termales.com.co"
        };
        const correoDestino = diccionarioCorreos[auditorNotificar] || "controlinterno@termales.com.co";

        await ejecutarDespachoGmailApi({
          ref_consecutivo: `APROBACION-100`,
          titulo_informe: 'Verificar soportes cargados al 100 por ciento para proceder con el cierre',
          proceso_auditado: 'Plan de accion pendiente por aprobar',
          enlace_pdf: evidenciaUrlOut || 'https://auditoria-gcm.vercel.app',
          destinatarios: correoDestino
        });
        showNotification("Avance al 100% guardado. Se notificó al auditor para el cierre.", "success");
    } else {
        showNotification("Progreso del plan guardado correctamente.");
    }
    e.target.reset();
};

const handleAprobarCierrePlan = async (plan) => {
    if (!window.confirm("¿Aprobar evidencias y cerrar definitivamente este plan y su hallazgo vinculado?")) return;
    
    const ts = new Date().toLocaleString();
    const fechaCierreStr = new Date().toISOString().split('T')[0];

    // 1. Cerrar el Plan
    const planModificado = {
        ...plan,
        estado: 'Cerrado',
        estadoWorkflow: 'Cerrado',
        progreso: 100,
        fechaCierre: fechaCierreStr,
        historialCambios: [...(plan.historialCambios || []), { fecha: ts, usuario: user?.email || 'Sistema', accion: '✅ Plan aprobado y cerrado por el Auditor' }]
    };
    const updatedPlanes = safePlanes.map(p => p.id === plan.id ? planModificado : p);
    
    // 2. Buscar y Cerrar el Hallazgo Vinculado
    let updatedHallazgos = safeHallazgos;
    const hallazgoPadre = safeHallazgos.find(h => h.id === plan.idHallazgo);
    if (hallazgoPadre) {
        const hallazgoModificado = {
            ...hallazgoPadre,
            estado: 'Cerrado',
            fechaCierre: fechaCierreStr,
            historialCambios: [...(hallazgoPadre.historialCambios || []), { fecha: ts, usuario: user?.email || 'Sistema', accion: '✅ Hallazgo cerrado tras validación de evidencias del plan' }]
        };
        updatedHallazgos = safeHallazgos.map(h => h.id === hallazgoPadre.id ? hallazgoModificado : h);
        setHallazgos(updatedHallazgos);
    }

    setPlanes(updatedPlanes);
    await saveToCloud({ planes: updatedPlanes, hallazgos: updatedHallazgos });

    // 3. 📧 DISPARAR CORREO DE CIERRE AL DUEÑO DEL PROCESO
    // Toma el correo que el usuario digitó en la matriz. Si es un plan viejo, usa el de control interno por defecto.
    let correoDestino = plan.correoResponsable;
    if (!correoDestino || !correoDestino.includes('@')) {
        correoDestino = "controlinterno@termales.com.co"; 
    }

    await ejecutarDespachoGmailApi({
        ref_consecutivo: `CIERRE-PLAN-${plan.id}`,
        titulo_informe: '✅ Plan de Acción y Hallazgo Cerrados con Éxito',
        proceso_auditado: plan.accion.substring(0, 50) + '...',
        enlace_pdf: plan.evidenciaUrl || 'https://auditoria-gcm.vercel.app',
        destinatarios: correoDestino
    });

    showNotification("¡Ciclo cerrado! Plan marcado como 'Cerrado' y notificación enviada al líder.", "success");
  };

 const handleEvaluacionSubmit = async (e) => {
    e.preventDefault(); 
    const formData = new FormData(e.target);
    const calif = (formData.get('diseno') === 'Eficaz' && formData.get('ejecucion') === 'Eficaz') ? 100 : 0;
    const ts = new Date().toLocaleString();
    
    let evidenciaUrlOut = formData.get('evidenciaUrlInput') || editEvaluacion?.evidenciaUrl || '';
    const idRiesgoVal = parseInt(formData.get('idRiesgo'));
    const noControlVal = formData.get('noControl') || ''; // 🆕 Capturamos el Control seleccionado

    let updatedList;
    if (editEvaluacion && isAdmin) {
      const mod = { 
        ...editEvaluacion, 
        idRiesgo: idRiesgoVal, 
        noControl: noControlVal, // 🆕 Guardamos el control en la edición
        diseño: formData.get('diseno'), 
        ejecucion: formData.get('ejecucion'), 
        calificacion: calif, 
        comentarios: formData.get('comentarios'), 
        evidenciaUrl: evidenciaUrlOut, 
        historialCambios: [...(editEvaluacion.historialCambios || []), { fecha: ts, usuario: user?.email || 'Usuario', accion: 'Evaluación modificada' }] 
      };
      updatedList = safeEvaluaciones.map(ev => ev.id === editEvaluacion.id ? mod : ev);
      setEditEvaluacion(null);
    } else {
      const nuevo = { 
        id: Date.now(), 
        idRiesgo: idRiesgoVal, 
        noControl: noControlVal, // 🆕 Guardamos el control en el registro nuevo
        fecha: new Date().toISOString().split('T')[0], 
        diseño: formData.get('diseno'), 
        ejecucion: formData.get('ejecucion'), 
        calificacion: calif, 
        comentarios: formData.get('comentarios'), 
        auditor: user.email, 
        anio: 2026, 
        mes: "Junio", 
        evidenciaUrl: evidenciaUrlOut, 
        historialCambios: [{ fecha: ts, usuario: user?.email || 'Usuario', accion: 'Evaluación de control registrada' }] 
      };
      updatedList = [...safeEvaluaciones, nuevo];
    }
    setEvaluaciones(updatedList); 
    await saveToCloud({ evaluaciones: updatedList }); 
    e.target.reset(); 
    showNotification("Evaluación registrada exitosamente.");
  };
const handleHallazgoSubmit = async (e) => {
  e.preventDefault(); 
  const formData = new FormData(e.target);
  const ts = new Date().toLocaleString();

  let evidenciaUrlOut = formData.get('evidenciaUrlInput') || editHallazgo?.evidenciaUrl || '';
  const causaVal = formData.get('causa') || '';
  const claseObservacionVal = formData.get('claseObservacion') || 'Oportunidad de Mejora';

  // 🔗 Captura del ID del informe seleccionado
  const idInformeVal = formData.get('idInforme') || '';

  let updated;
  if (editHallazgo) {
    const mod = { 
      ...editHallazgo, 
      idInforme: idInformeVal, 
      sede: formData.get('sede'), 
      ref: formData.get('ref'), 
      proceso: formData.get('proceso'), 
      responsable: formData.get('responsable'), 
      auditor: formData.get('auditor'), 
      titulo: formData.get('titulo'), 
      severidad: formData.get('severidad'), 
      evidenciaUrl: evidenciaUrlOut, 
      causa: causaVal, 
      claseObservacion: claseObservacionVal, 
      historialCambios: [...(editHallazgo.historialCambios || []), { fecha: ts, usuario: user?.email || 'Usuario', accion: 'Hallazgo modificado' }] 
    };
    updated = safeHallazgos.map(h => h.id === editHallazgo.id ? mod : h);
    setEditHallazgo(null);
  } else {
    const nuevo = { 
      id: Date.now(), 
      idInforme: idInformeVal, 
      sede: formData.get('sede'), 
      ref: formData.get('ref'), 
      proceso: formData.get('proceso'), 
      responsable: formData.get('responsable'), 
      auditor: formData.get('auditor'), 
      titulo: formData.get('titulo'), 
      severidad: formData.get('severidad'), 
      estado: 'Abierto', 
      fecha: new Date().toISOString().split('T')[0], 
      anio: 2026, 
      mes: "Junio", 
      evidenciaUrl: evidenciaUrlOut, 
      causa: causaVal, 
      claseObservacion: claseObservacionVal, 
      historialCambios: [{ fecha: ts, usuario: user?.email || 'Usuario', accion: 'Desviación documentada' }] 
    };
    updated = [...safeHallazgos, nuevo];
  }
  setHallazgos(updated); 
  await saveToCloud({ hallazgos: updated }); 
  e.target.reset(); 
  showNotification("Desviación conectada al informe de origen correctamente.");
};
const handleComiteSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const ts = new Date().toLocaleString();
    let updated;

    if (editComite) {
      const mod = {
        ...editComite,
        nombre: formData.get('nombre'),
        tipo: formData.get('tipo'),
        fecha: formData.get('fecha'),
        presentacionUrl: formData.get('presentacionUrl'),
        actaUrl: formData.get('actaUrl'),
        compromisos: formData.get('compromisos'),
        historialCambios: [...(editComite.historialCambios || []), { fecha: ts, usuario: user?.email || 'Usuario', accion: 'Modificado' }]
      };
      updated = safeComites.map(c => c.id === editComite.id ? mod : c);
      setEditComite(null);
    } else {
      const fechaCorte = new Date(formData.get('fecha') + 'T00:00:00');
      const nuevo = {
        id: Date.now(),
        nombre: formData.get('nombre'),
        tipo: formData.get('tipo'),
        fecha: formData.get('fecha'),
        presentacionUrl: formData.get('presentacionUrl'),
        actaUrl: formData.get('actaUrl'),
        compromisos: formData.get('compromisos'),
        anio: fechaCorte.getFullYear(),
        mes: defaultMeses[fechaCorte.getMonth()],
        historialCambios: [{ fecha: ts, usuario: user?.email || 'Usuario', accion: 'Radicado sesión' }]
      };
      updated = [nuevo, ...safeComites];
    }

    setComites(updated);
    await saveToCloud({ comites: updated });
    e.target.reset();
    
    // 🛡️ LIMPIEZA FORZADA DE ESTADOS INTERNOS DEL REPOSITORIO DOCUMENTAL
    setFormResetKey(Date.now());
    
    showNotification("Sesión de comité guardada con éxito.");
  };
  const handleIncidenteSubmit = async (e) => {
    e.preventDefault(); 
    const formData = new FormData(e.target);
    const ts = new Date().toLocaleString();
    
    // 💰 Extraemos los nuevos campos
    const sobranteVal = parseFloat(formData.get('montoSobrante') || 0);
    const faltanteVal = parseFloat(formData.get('montoFaltante') || 0);

    let updated;
    if (editIncidente) {
      const mod = { 
        ...editIncidente, 
        proceso: formData.get('proceso'), 
        idRiesgo: parseInt(formData.get('idRiesgo')), 
        titulo: formData.get('titulo'), 
        descripcion: formData.get('descripcion'), 
        montoSobrante: sobranteVal, 
        montoFaltante: faltanteVal, 
        impacto: formData.get('impacto'), 
        evidenciaUrl: formData.get('evidenciaUrlInput') || editIncidente.evidenciaUrl, 
        historialCambios: [...(editIncidente.historialCambios || []), { fecha: ts, usuario: user?.email || 'Usuario', accion: 'Evento modificado' }] 
      };
      updated = safeIncidentes.map(i => i.id === editIncidente.id ? mod : i);
      setEditIncidente(null);
    } else {
      const nuevo = { 
        id: Date.now(), 
        proceso: formData.get('proceso'), 
        idRiesgo: parseInt(formData.get('idRiesgo')), 
        fecha: new Date().toISOString().split('T')[0], 
        titulo: formData.get('titulo'), 
        descripcion: formData.get('descripcion'), 
        montoSobrante: sobranteVal, 
        montoFaltante: faltanteVal, 
        impacto: formData.get('impacto'), 
        reportadoPor: user.email, 
        evidenciaUrl: formData.get('evidenciaUrlInput'), 
        estado: 'Abierto', 
        anio: new Date().getFullYear(), 
        mes: "Junio", 
        historialCambios: [{ fecha: ts, usuario: user?.email || 'Usuario', accion: 'Evento de pérdida registrado' }] 
      };
      updated = [...safeIncidentes, nuevo];
    }
    setIncidentes(updated); 
    await saveToCloud({ incidentes: updated }); 
    e.target.reset(); 
    setFormResetKey(Date.now()); // Limpia la subida de archivos
    showNotification("Evento registrado y guardado con éxito.");
  };

  const handleCronogramaSubmit = async (e) => {
    e.preventDefault(); 
    if (!isAdmin) return;
    const formData = new FormData(e.target);
    
    const mesesSeleccionados = [];
    ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].forEach(mes => {
      if (formData.get(`mes_${mes}`)) mesesSeleccionados.push(mes);
    });

    let updatedList;
    if (editCronograma) {
      const modificado = {
        ...editCronograma,
        anio: parseInt(formData.get('anio')),
        codigo: formData.get('codigo'),
        proceso: formData.get('proceso'),
        responsable: formData.get('responsable'),
        apoyo: formData.get('apoyo'),
        periodo: formData.get('periodo'),
        enfoque: formData.get('enfoque'),
        cumplimiento: parseInt(formData.get('cumplimiento') || 0),
        meses: mesesSeleccionados
      };
      updatedList = safeCronograma.map(c => c.id === editCronograma.id ? modificado : c);
      setEditCronograma(null);
      showNotification("Proceso del plan actualizado.");
    } else {
      const nuevo = {
        id: Date.now(),
        anio: parseInt(formData.get('anio')),
        codigo: formData.get('codigo'),
        proceso: formData.get('proceso'),
        responsable: formData.get('responsable'),
        apoyo: formData.get('apoyo'),
        periodo: formData.get('periodo'),
        enfoque: formData.get('enfoque'),
        cumplimiento: parseInt(formData.get('cumplimiento') || 0),
        meses: mesesSeleccionados
      };
      updatedList = [...safeCronograma, nuevo];
      showNotification("Proceso agregado al Plan Anual.");
    }

    setCronograma(updatedList);
    await saveToCloud({ cronograma: updatedList });
    e.target.reset();
  };

 const handleApetitoSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin || !editApetito) return;
    const formData = new FormData(e.target);
    const timestamp = new Date().toLocaleString();

    const apetito = parseFloat(formData.get('apetitoFinanciero') || 0);
    const tolerancia = parseFloat(formData.get('toleranciaFinanciera') || 0);
    const capacidad = parseFloat(formData.get('capacidadRiesgo') || 0);

    if (apetito > tolerancia || tolerancia > capacidad) {
showNotification("Error: La jerarquía debe ser: Apetito ≤ Tolerancia ≤ Capacidad.", "error");
      return;
    }

    const modificado = {
      ...editApetito,
      posturaEstrategica: formData.get('posturaEstrategica'),
      kriScore: parseInt(formData.get('kriScore')),
      apetitoFinanciero: apetito,
      toleranciaFinanciera: tolerancia,
      capacidadRiesgo: capacidad,
      // --- NUEVAS DIMENSIONES COSO ERM ---
      impactoOperativo: formData.get('impactoOperativo') || 'No definido',
      impactoReputacional: formData.get('impactoReputacional') || 'No definido',
      impactoLegal: formData.get('impactoLegal') || 'No definido',
      escalamiento: formData.get('escalamiento') || 'Jefe de Área',
      historialCambios: [...(editApetito.historialCambios || []), { fecha: timestamp, accion: 'Arquitectura de apetito COSO ERM (Integral) parametrizada' }]
    };

    const updatedList = safeRiesgos.map(r => r.id === editApetito.id ? modificado : r);
    setRiesgos(updatedList);
    setEditApetito(null);
    await saveToCloud({ riesgos: updatedList });
    showNotification("Perfil COSO de Apetito Integral guardado exitosamente.");
    scrollToForm();
  };

const handleDeleteItem = async (listType, id) => {
    if (!isAdmin) return;
    if (!window.confirm('¿Seguro que desea eliminar este registro permanentemente?')) return;
    
    let updated;
    if (listType === 'riesgos') { updated = safeRiesgos.filter(r => r.id !== id); setRiesgos(updated); }
    if (listType === 'evaluaciones') { updated = safeEvaluaciones.filter(e => e.id !== id); setEvaluaciones(updated); }
    if (listType === 'hallazgos') { updated = safeHallazgos.filter(h => h.id !== id); setHallazgos(updated); }
    if (listType === 'planes') { updated = safePlanes.filter(p => p.id !== id); setPlanes(updated); }
    if (listType === 'incidentes') { updated = safeIncidentes.filter(i => i.id !== id); setIncidentes(updated); }
    if (listType === 'cronograma') { updated = safeCronograma.filter(c => c.id !== id); setCronograma(updated); }
    if (listType === 'monitoreo') { updated = safeMonitoreo.filter(m => m.id !== id); setMonitoreo(updated); }
    if (listType === 'informesAuditoria') { updated = informesAuditoria.filter(i => i.id !== id); setInformesAuditoria(updated); } // <--- LÍNEA CORREGIDA
if (listType === 'comites') { updated = safeComites.filter(c => c.id !== id); setComites(updated); }
    
    await saveToCloud({ [listType]: updated });
    showNotification("Registro eliminado.", "success");
  };
  const handleMonitoreoSubmit = async (e) => {
    e.preventDefault(); 
    if (!isAdmin) return;
    const formData = new FormData(e.target);
    let updatedList;
    if (editMonitoreo && editMonitoreo.id) {
      const modificado = {
        ...editMonitoreo,
        anio: parseInt(formData.get('anio')),
        indicador: formData.get('indicador').toUpperCase(),
        proceso: formData.get('proceso') || '',
        valor: parseInt(formData.get('valor') || 0),
        limite: parseInt(formData.get('limite') || 0),
        tendencia: formData.get('tendencia') || 'flat'
      };
      updatedList = safeMonitoreo.map(m => m.id === editMonitoreo.id ? modificado : m);
      setEditMonitoreo(null);
      showNotification("Indicador actualizado exitosamente.");
    } else {
      const nuevo = {
        id: Date.now(),
        anio: parseInt(formData.get('anio')),
        indicador: formData.get('indicador').toUpperCase(),
        proceso: formData.get('proceso') || '',
        valor: parseInt(formData.get('valor') || 0),
        limite: parseInt(formData.get('limite') || 0),
        tendencia: formData.get('tendencia') || 'flat'
      };
      updatedList = [...safeMonitoreo, nuevo];
      setEditMonitoreo(null);
      showNotification("Nuevo indicador agregado.");
    }
    setMonitoreo(updatedList);
    await saveToCloud({ monitoreo: updatedList });
    e.target.reset();
  };

const handleInformeAuditoriaSubmit = async (e) => {
    e.preventDefault(); 
    setIsSubmitting(true); 
    console.log("🚀 Ejecución global V5 (Con Campos PDF Big-4)...");
    
    // 🛡️ Filtro purificador para erradicar errores de codificación (ÃƒÂ³) en Gmail
    const limpiarTildesParaCorreo = (texto) => {
      if (!texto) return '';
      return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    };
    
    try {
      const safeInformes = Array.isArray(informesAuditoria) ? informesAuditoria : [];
      const formData = new FormData(e.target);

      const tituloVal = formData.get('titulo') || 'Sin título';
      const procesoVal = formData.get('proceso') || 'Sin proceso';
      const evidenciaUrlOut = formData.get('evidenciaUrlInput') || editInformeAuditoria?.evidenciaUrl || '';
      const actaSocializacionUrlOut = formData.get('actaSocializacionUrlInput') || editInformeAuditoria?.actaSocializacionUrl || '';
      const correosNotificacionOut = String(formData.get('correosNotificacionInput') || '').trim();

      const fechaVal = formData.get('fecha') || editInformeAuditoria?.fecha || new Date().toISOString().split('T')[0];
      const elaboradoPorVal = formData.get('elaboradoPor') || editInformeAuditoria?.elaboradoPor || '';
      const revisadoPorVal = formData.get('revisadoPor') || editInformeAuditoria?.revisadoPor || '';
      const aprobadoPorVal = formData.get('aprobadoPor') || editInformeAuditoria?.aprobadoPor || '';
      const socializadoVal = formData.get('socializado') || editInformeAuditoria?.socializado || 'No';
      const socializadoConVal = formData.get('socializadoCon') || editInformeAuditoria?.socializadoCon || '';

      const objetivoVal = formData.get('objetivo') || editInformeAuditoria?.objetivo || 'Evaluar la eficacia de los controles y la gestión de riesgos...';
      const alcanceVal = formData.get('alcance') || editInformeAuditoria?.alcance || 'La auditoría cubre los procesos y sistemas...';
      const conclusionVal = formData.get('conclusion') || editInformeAuditoria?.conclusion || '';
      const fortalezasVal = formData.get('fortalezas') || editInformeAuditoria?.fortalezas || '';
      
      const img1Url = formData.get('img1Url') || editInformeAuditoria?.img1Url || '';
      const img1Desc = formData.get('img1Desc') || editInformeAuditoria?.img1Desc || '';
      const img2Url = formData.get('img2Url') || editInformeAuditoria?.img2Url || '';
      const img2Desc = formData.get('img2Desc') || editInformeAuditoria?.img2Desc || '';
      const img3Url = formData.get('img3Url') || editInformeAuditoria?.img3Url || '';
      const img3Desc = formData.get('img3Desc') || editInformeAuditoria?.img3Desc || '';
      const img4Url = formData.get('img4Url') || editInformeAuditoria?.img4Url || '';
      const img4Desc = formData.get('img4Desc') || editInformeAuditoria?.img4Desc || '';

      let updated;
      let refConsecutivoFinal = '';

      const tsActual = new Date().toLocaleString();
      const correoRegistrado = correosNotificacionOut !== '' ? correosNotificacionOut : (editInformeAuditoria?.correoEnviadoA || '');
      const fechaCorreoRegistrada = correosNotificacionOut !== '' ? tsActual : (editInformeAuditoria?.fechaCorreoEnviado || '');

      if (editInformeAuditoria) {
        refConsecutivoFinal = editInformeAuditoria.ref;
        const mod = { 
          ...editInformeAuditoria, titulo: tituloVal, proceso: procesoVal, fecha: fechaVal,
          elaboradoPor: elaboradoPorVal, revisadoPor: revisadoPorVal, aprobadoPor: aprobadoPorVal,
          socializado: socializadoVal, socializadoCon: socializadoConVal,
          evidenciaUrl: evidenciaUrlOut, actaSocializacionUrl: actaSocializacionUrlOut,
          objetivo: objetivoVal, alcance: alcanceVal, conclusion: conclusionVal, fortalezas: fortalezasVal,
          img1Url, img1Desc, img2Url, img2Desc, img3Url, img3Desc, img4Url, img4Desc,
          correoEnviadoA: correoRegistrado, fechaCorreoEnviado: fechaCorreoRegistrada
        };
        updated = safeInformes.map(inf => inf.id === editInformeAuditoria.id ? mod : inf);
        setEditInformeAuditoria(null);
      } else {
        const ultimo = Math.max(...safeInformes.map(i => parseInt(i.ref?.split('-')[2] || 0)), 0);
        const idx = ultimo + 1;

        refConsecutivoFinal = `INF-2026-${String(idx).padStart(3, '0')}`;
        const nuevo = {
          id: crypto.randomUUID(), ref: refConsecutivoFinal, titulo: tituloVal, proceso: procesoVal,
          fecha: fechaVal, elaboradoPor: elaboradoPorVal, revisadoPor: revisadoPorVal,
          aprobadoPor: aprobadoPorVal, socializado: socializadoVal, socializadoCon: socializadoConVal,
          evidenciaUrl: evidenciaUrlOut, actaSocializacionUrl: actaSocializacionUrlOut,
          objetivo: objetivoVal, alcance: alcanceVal, conclusion: conclusionVal, fortalezas: fortalezasVal,
          img1Url, img1Desc, img2Url, img2Desc, img3Url, img3Desc, img4Url, img4Desc,
          correoEnviadoA: correoRegistrado, fechaCorreoEnviado: fechaCorreoRegistrada
        };
        updated = [nuevo, ...safeInformes];
      }

      // 🟢 DESPACHO SANITIZADO: Limpiamos el asunto y el proceso de acentos problemáticos
      if (correosNotificacionOut !== '') {
        await ejecutarDespachoGmailApi({
          ref_consecutivo: refConsecutivoFinal,
          titulo_informe: limpiarTildesParaCorreo(`Radicacion de Informe: ${tituloVal}`),
          proceso_auditado: limpiarTildesParaCorreo(procesoVal),
          enlace_pdf: evidenciaUrlOut || 'https://auditoria-gcm.vercel.app',
          destinatarios: correosNotificacionOut
        });
      }
      setInformesAuditoria(updated);    
      await saveToCloud({ informesAuditoria: updated });
      e.target.reset();
      showNotification("Informe de auditoría procesado y guardado correctamente.");

    } catch (error) {
      console.error("Error crítico al procesar informe:", error);
      showNotification("Hubo un error al procesar la solicitud.", "error");
    } finally {
      setIsSubmitting(false); 
    }
  };
const renderHeaderFiltros = (titulo, subtitulo) => (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 mb-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-50"></div>
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800">{titulo}</h2>
          <p className="text-xs text-slate-500 font-bold mt-1">{subtitulo}</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex flex-col">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Años de Análisis</label>
            <div className="flex flex-wrap gap-2">
              {defaultAnios.map(anio => (
                <button key={`filt-anio-${anio}`} onClick={() => toggleAnio(anio)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-sm border ${selectedAnios.includes(anio) ? 'bg-slate-800 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                  {anio}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Meses de Análisis</label>
            <div className="flex flex-wrap gap-1.5">
              {defaultMeses.map(mes => (
                <button key={`filt-mes-${mes}`} onClick={() => toggleMes(mes)} className={`px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all border shadow-sm notranslate ${selectedMeses.includes(mes) ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`} translate="no" title={mes}>
                  {mes.substring(0,3)}
                </button>
              ))}
            </div>
          </div>
          {(selectedAnios.length > 0 || selectedMeses.length > 0) && (
            <div className="flex items-end">
              <button onClick={() => { setSelectedAnios([]); setSelectedMeses([]); }} className="h-[30px] px-3 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-lg text-[10px] font-bold transition-colors">
                Limpiar Filtros
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // =====================================================================
  // RENDERS DE VISTAS (ADMIN INTERFACE)
  // =====================================================================


const renderConfiguracion = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="border-b pb-4">
        <h2 className="text-2xl font-black text-slate-800">⚙️ Configuración y Cargas Masivas</h2>
        <p className="text-xs text-slate-500 font-bold mt-1">Gestión avanzada de la base de datos y copias de seguridad.</p>
      </div>

      <div className="bg-amber-50 p-6 rounded-3xl border border-amber-200">
        <div className="flex justify-between items-center">
           <div>
              <h3 className="font-black text-amber-900 uppercase tracking-widest text-sm mb-1">🚀 Forzar Actualización de Cronograma (NUEVO)</h3>
              <p className="text-xs text-amber-700 max-w-2xl">Utiliza este botón para borrar el cronograma de prueba antiguo de tu base de datos y cargar automáticamente los <b>procesos auditables</b> oficiales de Termales Santa Rosa.</p>
           </div>
           <button onClick={forceUpdateCronograma} className="bg-amber-600 hover:bg-amber-700 text-white font-black uppercase tracking-widest px-6 py-3 rounded-xl shadow-md transition-all">
             Cargar Procesos
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* NUEVO BOTON PARA IMPORTAR MATRIZ RIESGOS DESDE EXCEL */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 border-t-4 border-t-emerald-600">
          <h3 className="font-black text-emerald-700 uppercase tracking-widest text-sm mb-4">📊 Cargar Matriz de Riesgos (Excel)</h3>
          <p className="text-xs text-slate-600 mb-6">Sube un archivo .xlsx para actualizar masivamente <b>solo la Matriz de Riesgos</b>. Asegúrate de usar la plantilla descargada previamente.</p>
          
          <label className="block w-full cursor-pointer bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-black uppercase tracking-widest py-3 text-center rounded-xl shadow-sm border border-emerald-200 transition-all">
            Seleccionar Archivo Excel
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcelRiesgos} />
          </label>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <h3 className="font-black text-slate-700 uppercase tracking-widest text-sm mb-4">📥 Exportar Backup (Descarga)</h3>
          <p className="text-xs text-slate-600 mb-6">Descarga una copia completa de toda tu base de datos actual en formato JSON. Útil para tener respaldos de seguridad o para editar los datos masivamente en un editor de texto o Excel.</p>
          <button onClick={exportToJSON} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black uppercase tracking-widest py-3 rounded-xl shadow-md transition-all">
            Descargar Base de Datos (.JSON)
          </button>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 border-t-4 border-t-red-600">
          <h3 className="font-black text-red-600 uppercase tracking-widest text-sm mb-4">📤 Carga Masiva Completa DB</h3>
          <p className="text-xs text-slate-600 mb-6">Sube un archivo JSON con la estructura correcta para actualizar masivamente. <b>ADVERTENCIA:</b> Esta acción borrará todos los datos actuales de todos los módulos.</p>
          
          <label className="block w-full cursor-pointer bg-red-50 hover:bg-red-100 text-red-700 font-black uppercase tracking-widest py-3 text-center rounded-xl shadow-sm border border-red-200 transition-all">
            Seleccionar Archivo JSON
            <input type="file" accept=".json" className="hidden" onChange={handleImportJSON} />
          </label>
        </div>
      </div>
      
      <div className="bg-blue-50 p-6 rounded-3xl border border-blue-200">
        <h3 className="font-black text-blue-800 uppercase tracking-widest text-sm mb-2">💡 ¿Cómo hacer una carga masiva desde Excel?</h3>
        <ol className="list-decimal pl-5 text-xs text-blue-900 space-y-2 mt-4 font-medium">
          <li>Ve a la pestaña <b>Matriz de Riesgos</b> y presiona el botón de <b>Exportar</b> para obtener la estructura actual en Excel.</li>
          <li>Abre el Excel y agrega tus cientos de filas nuevas en el Excel asegurándote de no cambiar los nombres de las columnas (ej. <i>id, proceso, sede</i>).</li>
          <li>Ve a esta pestaña de Configuración y usa el botón verde <b>Cargar Matriz de Riesgos (Excel)</b> para subir el archivo actualizado.</li>
        </ol>
      </div>
    </div>
  );

const renderDashboardRiesgos = () => {
    // 🧠 TRADUCTOR INTELIGENTE UNIVERSAL (Porcentajes y Textos del Manual)
    const extraerNumeroPuro = (valor) => {
      if (valor === undefined || valor === null || valor === '') return 0;
      
      const str = String(valor).toLowerCase().trim();
      
      // 🟢 SI YA ES UN PORCENTAJE NUMÉRICO DIRECTO (20, 40, 60, 80, 100)
      if (str === '20') return 1;
      if (str === '40') return 2;
      if (str === '60') return 3;
      if (str === '80') return 4;
      if (str === '100') return 5;
      if (str === '0') return 1; // Control de seguridad por si baja a cero

      // 🔵 SI VIENE COMO TEXTO DEL EXCEL ANTERIOR
      const num = parseInt(str.charAt(0), 10);
      if (!isNaN(num) && num >= 1 && num <= 5) return num;
      
      if (str.includes('rara') || str.includes('muy baja')) return 1;
      if (str.includes('improbable') || str.includes('baja')) return 2;
      if (str.includes('posible') || str.includes('media')) return 3;
      if (str.includes('probable') || str.includes('alta')) return 4;
      if (str.includes('casi seguro') || str.includes('muy alta')) return 5;
      
      if (str.includes('insignificante') || str.includes('leve')) return 1;
      if (str.includes('menor')) return 2;
      if (str.includes('moderado') || stroke.includes('medio')) return 3;
      if (str.includes('mayor') || str.includes('alto')) return 4;
      if (str.includes('catastrófico') || str.includes('crítico')) return 5;
      
      return 0;
    };

    // Copia de los riesgos con los números traducidos con total precisión
    const riesgosLimpiosParaMatriz = (rFiltrados || []).map(r => ({
      ...r,
      probabilidadResidual: extraerNumeroPuro(r.probabilidadResidual),
      impactoResidual: extraerNumeroPuro(r.impactoResidual),
      probabilidadInherente: extraerNumeroPuro(r.probabilidadInherente),
      impactoInherente: extraerNumeroPuro(r.impactoInherente)
    }));

    return (
      <DashboardRiesgos 
        tipoMatriz={tipoMatriz}
        rFiltrados={riesgosLimpiosParaMatriz} 
        incFiltrados={incFiltrados}
        hFiltrados={hFiltrados}
        calcularMatriz5x5={calcularMatriz5x5}
        getItemMesText={getItemMesText}
        selectedAnios={selectedAnios}
        setChartDetail={setChartDetail}
        filtroHeatMap={filtroHeatMap}
        setFiltroHeatMap={setFiltroHeatMap}
        searchTerm={searchTerm}
        columnFilters={columnFilters}
        applyFilters={applyFilters}
        renderHeaderFiltros={renderHeaderFiltros}
      />
    );
  };    
const renderPlanAnual = () => {
    return (
      <PlanAnual 
        isAdmin={isAdmin}
        cFiltrados={cFiltrados}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        columnFilters={columnFilters}
        handleColFilterChange={handleColFilterChange}
        FilterInput={FilterInput}
        applyFilters={applyFilters}
        editCronograma={editCronograma}
        setEditCronograma={setEditCronograma}
        handleCronogramaSubmit={handleCronogramaSubmit}
        formResetKey={formResetKey}
        setFormResetKey={setFormResetKey}
        scrollToForm={scrollToForm}
        handleDeleteItem={handleDeleteItem}
        safeMonitoreo={safeMonitoreo}
        editMonitoreo={editMonitoreo}
        setEditMonitoreo={setEditMonitoreo}
        handleMonitoreoSubmit={handleMonitoreoSubmit}
        selectedAnios={selectedAnios}
        renderHeaderFiltros={renderHeaderFiltros}
      />
    );
  };  
  const renderRiesgos = () => {
    return (
      <Riesgos 
        isAdmin={isAdmin}
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
        exportToExcel={exportToExcel}
        safeRiesgos={safeRiesgos}
      />
    );
  };
const renderApetito = () => {
    return (
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
        rFiltrados={rFiltrados}
        incFiltrados={incFiltrados}
        calcularMatriz5x5={calcularMatriz5x5}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        columnFilters={columnFilters}
        handleColFilterChange={handleColFilterChange}
        FilterInput={FilterInput}
        applyFilters={applyFilters}
      />
    );
  };
  const renderEvaluaciones = () => {
    return (
      <Evaluaciones 
        isAdmin={isAdmin}
        editEvaluacion={editEvaluacion}
        setEditEvaluacion={setEditEvaluacion}
        handleAuthorizationSubmit={handleEvaluacionSubmit} // Asegura que invoque handleEvaluacionSubmit
        handleEvaluacionSubmit={handleEvaluacionSubmit}
        safeRiesgos={safeRiesgos}
        user={user}
        analizarEvidenciaIA={analizarEvidenciaIA}
        safeEvaluaciones={safeEvaluaciones}
        formatSafeDate={formatSafeDate}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        columnFilters={columnFilters}
        handleColFilterChange={handleColFilterChange}
        FilterInput={FilterInput}
        applyFilters={applyFilters}
        setFormResetKey={setFormResetKey}
        scrollToForm={scrollToForm}
        handleDeleteItem={handleDeleteItem}
      />
    );
  };
  
const renderHallazgos = () => {
  return (
    <Hallazgos 
      isAdmin={isAdmin}
      informesAuditoria={informesAuditoria} // 🟢 Envía los informes a la vista
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
  );
};

const renderPlanes = () => {
    return (
      <Planes 
ejecutarDespachoGmailApi={ejecutarDespachoGmailApi}
handleAprobarCierrePlan={handleAprobarCierrePlan}
        isAdmin={isAdmin}
        editPlan={editPlan}
        setEditPlan={setEditPlan}
        handlePlanSubmit={handlePlanSubmit}
        formResetKey={formResetKey}
        setFormResetKey={setFormResetKey}
        scrollToForm={scrollToForm}
        handleDeleteItem={handleDeleteItem}
        applyFilters={applyFilters}
        FilterInput={FilterInput}
        pFiltrados={pFiltrados}
        safeHallazgos={safeHallazgos}
        setHallazgos={setHallazgos}
        safePlanes={safePlanes} 
        setPlanes={setPlanes}   
        saveToCloud={saveToCloud} 
        formatSafeDate={formatSafeDate}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        columnFilters={columnFilters}
        handleColFilterChange={handleColFilterChange}
        informesAuditoria={informesAuditoria} 
        defaultAnios={defaultAnios}
        defaultMeses={defaultMeses}
        selectedAnios={selectedAnios}
        selectedMeses={selectedMeses}
        toggleAnio={toggleAnio}
        toggleMes={toggleMes}
        setSelectedAnios={setSelectedAnios}
        setSelectedMeses={setSelectedMeses}
selectAllAnios={() => setSelectedAnios([...defaultAnios])}
        clearAllAnios={() => setSelectedAnios([])}
        selectAllMeses={() => setSelectedMeses([...defaultMeses])}
        clearAllMeses={() => setSelectedMeses([])}
        onUpdateItemStatus={async (coleccion, id, nuevoEstadoWorkflow) => {
          try {
            const ts = new Date().toLocaleString();
            const logTrazabilidad = {
              fecha: ts,
              usuario: user?.email || 'Usuario',
              accion: `Fase de Gobernanza actualizada a: ${nuevoEstadoWorkflow}`
            };

            const planActual = safePlanes.find(p => p.id === id);
            if (!planActual) return;

            const planModificado = {
              ...planActual,
              estadoWorkflow: nuevoEstadoWorkflow,
              historialCambios: [...(planActual.historialCambios || []), logTrazabilidad]
            };

            const updatedList = safePlanes.map(p => p.id === id ? planModificado : p);
            setPlanes(updatedList);
            await saveToCloud({ planes: updatedList });

            setEditPlan(planModificado);
            setFormResetKey(Date.now());

// 🟢 DISPARADOR GMAIL API INTEGRADO (PLAN DE ACCIÓN EN REVISIÓN)
            if (nuevoEstadoWorkflow === 'En Revisión') {
              await ejecutarDespachoGmailApi({
                ref_consecutivo: `PLAN-${id}`,
                titulo_informe: 'Plan de Acción Publicado Listo para Validación',
                proceso_auditado: planModificado.accion.substring(0, 50) + '...',
                enlace_pdf: 'https://auditoria-gcm.vercel.app',
                destinatarios: 'controlinterno@termales.com.co'
              });
            }           

            if (nuevoEstadoWorkflow === 'En Revisión') {
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
    );
  };

 const renderIncidentes = () => {
    return (
      <Incidentes 
        incFiltrados={incFiltrados}
        isAdmin={isAdmin}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        columnFilters={columnFilters}
        handleColFilterChange={handleColFilterChange}
        editIncidente={editIncidente}
        setEditIncidente={setEditIncidente}
        handleIncidenteSubmit={handleIncidenteSubmit}
        formResetKey={formResetKey}
        setFormResetKey={setFormResetKey}
        scrollToForm={scrollToForm}
        handleDeleteItem={handleDeleteItem}
        applyFilters={applyFilters}
        FilterInput={FilterInput}
        safeRiesgos={safeRiesgos} 
      />
    );
  };
  const renderInforme = () => {
    return (
      <Trazabilidad 
        safeRiesgos={safeRiesgos}
        safeEvaluaciones={safeEvaluaciones}
        safeHallazgos={safeHallazgos}
        safePlanes={safePlanes}
        safeIncidentes={safeIncidentes}
      />
    );
  };

// =====================================================================
  // PANTALLA DE BIENVENIDA DINÁMICA (ADMINISTRADORES Y JEFES DE ÁREA)
  // =====================================================================
  const renderWelcomeScreen = () => {
    // Logo Vectorial (SVG Puro)
    const LogoTermales = () => (
      <svg viewBox="0 0 100 100" className="w-[75px] h-[75px] drop-shadow-sm shrink-0">
        <circle cx="16" cy="45" r="2" fill="#203d4a" />
        <circle cx="12" cy="49" r="1.5" fill="#203d4a" />
        <circle cx="18" cy="52" r="1.2" fill="#203d4a" />
        <circle cx="85" cy="42" r="1.8" fill="#203d4a" />
        <circle cx="92" cy="45" r="2.5" fill="#203d4a" />
        <circle cx="90" cy="50" r="1.5" fill="#203d4a" />
        <circle cx="84" cy="54" r="1.2" fill="#203d4a" />
        <path d="M 68 28 C 76 20, 88 22, 90 28 C 82 32, 72 32, 68 28 Z" fill="#4CAF50" />
        <path d="M 63 15 C 68 8, 76 10, 78 14 C 72 17, 65 18, 63 15 Z" fill="#4CAF50" />
        <path d="M 32 72 C 24 80, 12 78, 10 72 C 18 68, 28 68, 32 72 Z" fill="#4CAF50" />
        <path d="M 37 85 C 32 92, 24 90, 22 86 C 28 83, 35 82, 37 85 Z" fill="#4CAF50" />
        <circle cx="50" cy="50" r="25" stroke="#203d4a" strokeWidth="11" fill="none" />
        <circle cx="43" cy="55" r="7" stroke="#203d4a" strokeWidth="3.5" fill="none" />
        <circle cx="58" cy="62" r="4.5" stroke="#203d4a" strokeWidth="2.5" fill="none" />
        <circle cx="59" cy="48" r="2.2" fill="#203d4a" />
        <circle cx="53" cy="45" r="1.5" fill="#203d4a" />
      </svg>
    );

    return (
      <div className="relative flex min-h-screen w-full bg-[#f8fbfa] font-sans overflow-hidden">
        
        {/* ================= 1. FONDOS PRINCIPALES ================= */}
        
        {/* Lado Izquierdo: Cascada */}
        <div 
          className="absolute left-0 top-0 w-[45%] h-full bg-cover bg-center z-0"
          style={{ backgroundImage: "url('/cascada.jpg'), linear-gradient(to right, #0A1A12, #11322A)" }}
        >
          {/* Difuminado suave hacia el centro */}
          <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#f8fbfa] to-transparent z-10"></div>
        </div>

        {/* ================= 2. GEOMETRÍA Y VECTORES EXACTOS (HUD) ================= */}
        
        {/* A. Esquina Superior Derecha (Polígono verde oscuro con láser) */}
        <svg className="absolute top-0 right-0 w-[400px] h-[400px] z-10 pointer-events-none" viewBox="0 0 400 400">
          <defs>
            <linearGradient id="grad-top-right" x1="1" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#051f15" />
              <stop offset="100%" stopColor="#0a3b2a" />
            </linearGradient>
            <filter id="glow-green" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-dot" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          {/* Forma oscura */}
          <polygon points="120,0 400,0 400,280" fill="url(#grad-top-right)" />
          {/* Línea láser verde brillante en el borde diagonal */}
          <line x1="120" y1="0" x2="400" y2="280" stroke="#00FF87" strokeWidth="4" filter="url(#glow-green)" />
          {/* Destello/Estrella cerca del borde */}
          <circle cx="280" cy="80" r="2.5" fill="#eab308" filter="url(#glow-dot)" />
          <path d="M280,70 L280,90 M270,80 L290,80" stroke="#eab308" strokeWidth="1" filter="url(#glow-dot)" opacity="0.6"/>
        </svg>

        {/* B. Esquina Inferior Izquierda (Polígono oscuro con borde neón exacto a la maqueta) */}
        <svg className="absolute bottom-0 left-0 w-[250px] h-[250px] z-10 pointer-events-none" viewBox="0 0 250 250">
          <defs>
            <linearGradient id="grad-bottom-left" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#051f15" />
              <stop offset="100%" stopColor="#0a3b2a" />
            </linearGradient>
            <filter id="glow-green-bl" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          {/* Forma oscura anclada a la esquina */}
          <polygon points="0,100 150,250 0,250" fill="url(#grad-bottom-left)" />
          {/* Línea láser verde brillante en el borde diagonal */}
          <line x1="0" y1="100" x2="150" y2="250" stroke="#00FF87" strokeWidth="3" filter="url(#glow-green-bl)" />
          {/* Pequeños nodos decorativos de conexión */}
          <circle cx="75" cy="175" r="2.5" fill="#00FF87" filter="url(#glow-green-bl)" />
          <line x1="75" y1="175" x2="110" y2="175" stroke="#00FF87" strokeWidth="1" filter="url(#glow-green-bl)" opacity="0.5"/>
          <line x1="110" y1="175" x2="125" y2="190" stroke="#00FF87" strokeWidth="1" filter="url(#glow-green-bl)" opacity="0.5"/>
          <circle cx="125" cy="190" r="1.5" fill="#00FF87" opacity="0.8"/>
        </svg>

        {/* C. Fondo Tecnológico Derecho (Hexágonos y Líneas de puntos exactas) */}
        <svg className="absolute top-0 right-0 w-full h-full opacity-60 z-0 pointer-events-none" viewBox="0 0 1000 1000" preserveAspectRatio="xMaxYMid slice">
          {/* Línea segmentada principal */}
          <path d="M550,-50 L850,250 L850,600 L600,850 L200,850" fill="none" stroke="#64A338" strokeWidth="1.2" strokeDasharray="8,8" />
          {/* Nodos de intersección */}
          <circle cx="850" cy="250" r="4" fill="#64A338" />
          <circle cx="850" cy="600" r="4" fill="#64A338" />
          <circle cx="600" cy="850" r="4" fill="#64A338" />
          
          {/* Grupo de Hexágonos */}
          <g stroke="#64A338" strokeWidth="1.2" fill="none">
            {/* Hexágono Centro-Derecha */}
            <polygon points="760,400 785,415 785,445 760,460 735,445 735,415" />
            {/* Hexágono Pequeño anidado */}
            <polygon points="820,470 835,480 835,500 820,510 805,500 805,480" />
            {/* Hexágono Inferior */}
            <polygon points="680,700 700,712 700,736 680,748 660,736 660,712" />
          </g>
        </svg>

        {/* ================= 3. TARJETA CENTRAL ================= */}
        <div className="absolute inset-0 flex items-center justify-center p-4 z-20">
          
          <div className="relative w-full max-w-[620px] animate-in zoom-in-95 duration-700">
            
            {/* Resplandor Neon Verde debajo de la tarjeta */}
            <div className="absolute -inset-1.5 bg-gradient-to-r from-emerald-400 to-green-200 rounded-[3rem] blur-xl opacity-50"></div>
            
            {/* Contenedor Blanco Principal */}
            <div className="relative bg-white rounded-[2.5rem] shadow-2xl p-3 overflow-hidden">
              
              {/* --- EL MARCO TECNOLÓGICO INTERNO (Idéntico a tu maqueta) --- */}
              <div className="relative border-[1.5px] border-gray-200 rounded-[2rem] p-10 sm:p-14">
                
                {/* Ocultadores para hacer los "cortes" del marco */}
                {/* Corte superior izquierdo */}
                <div className="absolute top-[-2px] left-10 w-8 h-1 bg-white"></div>
                <div className="absolute top-10 left-[-2px] w-1 h-8 bg-white"></div>
                <div className="absolute top-5 left-5 w-5 h-5 border-t-2 border-l-2 border-gray-300 rounded-tl-xl pointer-events-none"></div>

                {/* Corte superior derecho (con los 9 puntos) */}
                <div className="absolute top-[-2px] right-10 w-16 h-1 bg-white"></div>
                <div className="absolute top-10 right-[-2px] w-1 h-12 bg-white"></div>
                <div className="absolute top-6 right-6 grid grid-cols-3 gap-[4px] opacity-40 bg-white p-1">
                  {[...Array(9)].map((_, i) => <div key={i} className="w-[5px] h-[5px] bg-[#4A5D66] rounded-full"></div>)}
                </div>

                {/* Corte inferior derecho */}
                <div className="absolute bottom-[-2px] right-10 w-8 h-1 bg-white"></div>
                <div className="absolute bottom-10 right-[-2px] w-1 h-8 bg-white"></div>
                <div className="absolute bottom-5 right-5 w-5 h-5 border-b-2 border-r-2 border-gray-300 rounded-br-xl pointer-events-none"></div>

                {/* ---------------- CONTENIDO ---------------- */}
                
                {/* LOGO */}
                <div className="flex flex-col items-center mb-6 mt-1">
                  <div className="flex items-center space-x-2">
                    <LogoTermales />
                    <div className="flex flex-col leading-none ml-2">
                      <h1 className="text-[34px] font-black text-[#0B2A36] tracking-tight mt-1" style={{ fontFamily: 'Arial, sans-serif' }}>
                        TERMALES
                      </h1>
                      <p className="text-[17px] font-bold text-[#64A338] -mt-1 tracking-wide">
                        Santa Rosa de Cabal
                      </p>
                    </div>
                  </div>
                </div>

                {/* TÍTULO Y SEPARADOR */}
                <div className="text-center mb-6">
                  <h2 className="text-[26px] font-black text-[#0A3B32] tracking-tight">
                    {isAdmin ? 'Centro de Mando GRC' : 'Portal Operativo GRC'}
                  </h2>
                  <div className="flex items-center justify-center my-4 opacity-80">
                    <div className="h-[1px] bg-gray-300 w-10"></div>
                    <div className="w-[5px] h-[5px] rounded-full bg-[#64A338] mx-2"></div>
                    <div className="h-[1px] bg-gray-300 w-10"></div>
                  </div>
                </div>

                {/* TEXTO DESCRIPTIVO */}
                <div className="text-center mb-10 px-2">
                  <p className="text-[14px] text-gray-500 leading-relaxed font-medium max-w-sm mx-auto">
                    {isAdmin
                      ? 'Bienvenido al panel de Administración y Auditoría. Desde aquí podrá supervisar los riesgos corporativos, emitir informes formales, aprobar planes de acción y gestionar la base de datos global.'
                      : 'Bienvenido, Líder de Proceso. Desde aquí podrá visualizar los tableros analíticos, reportar el avance de sus planes de acción y registrar eventos de pérdida operativos.'}
                  </p>
                </div>

                {/* BOTONES */}
                <div className="space-y-4 max-w-[400px] mx-auto relative z-20">
                  <button 
                    onClick={() => setShowWelcome(false)} 
                    className="w-full bg-[#0A3B32] hover:bg-[#062620] text-white py-3.5 rounded-xl font-bold text-[11px] uppercase tracking-widest shadow-lg transition-all flex items-center justify-center space-x-3 active:scale-95 group"
                  >
                    <svg className="w-4 h-4 text-emerald-400 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                    <span>Acceder al Tablero de Control</span>
                  </button>

                  <button 
                    onClick={handleLogout} 
                    className="w-full bg-white border border-gray-300 hover:bg-gray-50 text-[#64A338] py-3.5 rounded-xl font-bold text-[11px] uppercase tracking-widest transition-all flex items-center justify-center space-x-3 active:scale-95 group shadow-sm"
                  >
                    <svg className="w-4 h-4 text-[#64A338]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
                
                {/* PUNTOS INFERIORES */}
                <div className="flex justify-center items-center space-x-2 mt-8">
                  <div className="w-[7px] h-[7px] rounded-full border border-[#64A338] bg-transparent"></div>
                  <div className="w-[7px] h-[7px] rounded-full border border-[#64A338] bg-transparent"></div>
                  <div className="w-[7px] h-[7px] rounded-full bg-[#64A338]"></div>
                  <div className="w-[7px] h-[7px] rounded-full bg-[#64A338]"></div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

// 🔔 Calculador de notificaciones para la barra lateral (Planes en Revisión)
  const pendingPlansCount = safePlanes.filter(p => p.estadoWorkflow === 'En Revisión').length;
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-12">
        <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-2xl shadow-2xl">
          <div className="text-center"><span className="text-5xl block animate-bounce">🛡️</span><h2 className="mt-4 text-3xl font-extrabold text-slate-900">GCM Auditor v5</h2><p className="text-xs text-blue-600 font-bold uppercase tracking-widest mt-1">Termales GRC Platform</p></div>
          <form className="mt-8 space-y-4" onSubmit={handleAuthSubmit}>
            {authError && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-xs font-medium">⚠️ {authError}</div>}
            <div className="space-y-3">
              <div><label className="text-[10px] font-bold text-slate-500 uppercase">Correo</label><input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="tu_correo@termales.com.co" className="block w-full rounded-lg border px-3 py-2 text-xs mt-1"/></div>
              <div><label className="text-[10px] font-bold text-slate-500 uppercase">Contraseña</label><input type="password" required value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="••••••••" className="block w-full rounded-lg border px-3 py-2 text-xs mt-1"/></div>
            </div>
            <button type="submit" className="w-full flex justify-center rounded-lg bg-slate-800 px-4 py-2.5 text-xs font-bold text-white shadow-md">{isRegistering ? 'Crear Cuenta' : 'Ingresar al Portal'}</button>
          </form>
          <div className="text-center pt-2 border-t"><button onClick={() => {setIsRegistering(!isRegistering); setAuthError('');}} className="text-xs font-bold text-blue-600">{isRegistering ? '¿Ya tiene cuenta? Iniciar Sesión' : '¿No tiene acceso? Regístrese aquí'}</button></div>
        </div>
      </div>
    );
  }

if (!isCloudLoaded) return (<div className="flex h-screen w-full items-center justify-center bg-slate-900 text-white flex-col space-y-4"><span className="text-6xl animate-bounce">☁️</span><h2 className="text-xl font-bold tracking-widest uppercase">Conectando...</h2></div>);
  if (showWelcome) return renderWelcomeScreen();
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
{/* HEADER SUPERIOR */}
        <header className={`bg-white border-b h-20 items-center justify-between px-8 shadow-sm flex-shrink-0 z-10 ${isPresentationMode ? 'hidden' : 'flex'}`}>
          <div className="flex items-center space-x-4 bg-slate-100/80 backdrop-blur-md px-6 py-2.5 rounded-full border border-slate-200 shadow-sm transition-all hover:bg-slate-200/80">
            {/* Logo Corporativo */}
            <img 
              src="/logo_termales.png.png" 
              alt="Logo Termales" 
              className="h-10 w-auto object-contain drop-shadow-sm transition-transform hover:scale-105" 
              onError={(e) => { e.target.style.display = 'none'; }} 
            />
            
            {/* Separador vertical sutil */}
            <div className="h-8 w-px bg-slate-300 hidden sm:block"></div>
            
            {/* Texto Corporativo */}
            <span className="text-xs font-black text-slate-600 uppercase tracking-widest hidden sm:inline-block">
              Termales de Santa Rosa de Cabal — Sistema de Gestión Integral
            </span>
          </div>   
          
          <button 
            onClick={() => setIsPresentationMode(true)} 
            className="bg-slate-800 text-white hover:bg-slate-700 px-5 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center space-x-2 shadow-md"
          >
            <span>📺</span><span>Modo Presentación</span>
          </button>
        </header>
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
                />
              );
            })()}
            {/* 1️⃣ FASE DE PLANIFICACIÓN (Subpestañas Anidadas) */}
            {activeTab === 'plan_anual_tab' && (
              <div className="space-y-6">
                <div className="flex flex-wrap border-b border-slate-200 bg-white p-2 rounded-2xl gap-2 shadow-sm text-xs font-bold">
                  <button onClick={() => setSubTabPlanificar('plan_anual')} className={`px-4 py-2 rounded-xl transition-all ${subTabPlanificar === 'plan_anual' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>🗓️ Cronograma Anual</button>
                  <button onClick={() => setSubTabPlanificar('riesgos')} className={`px-4 py-2 rounded-xl transition-all ${subTabPlanificar === 'riesgos' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>⚠️ Matriz de Riesgos</button>
                  <button onClick={() => setSubTabPlanificar('apetito')} className={`px-4 py-2 rounded-xl transition-all ${subTabPlanificar === 'apetito' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>⚖️ Apetito de Riesgo</button>
                </div>
                {subTabPlanificar === 'plan_anual' && renderPlanAnual()}
                {subTabPlanificar === 'riesgos' && renderRiesgos()}
                {subTabPlanificar === 'apetito' && renderApetito()}
              </div>
            )}

            {/* 2️⃣ FASE DE TRABAJO DE CAMPO */}
            {activeTab === 'evaluaciones' && renderEvaluaciones()}

            {/* 3️⃣ FASE DE RESULTADOS & BRECHAS (Subpestañas Anidadas) */}
            {activeTab === 'resultados_tab' && (
              <div className="space-y-6">
                <div className="flex flex-wrap border-b border-slate-200 bg-white p-2 rounded-2xl gap-2 shadow-sm text-xs font-bold">
                  <button onClick={() => setSubTabResultados('hallazgos')} className={`px-4 py-2 rounded-xl transition-all ${subTabResultados === 'hallazgos' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>📄 Hallazgos Registrados</button>
                  {isAdmin && (
                    <button onClick={() => setSubTabResultados('informes')} className={`px-4 py-2 rounded-xl transition-all ${subTabResultados === 'informes' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>📁 Informes Emitidos</button>
                  )}
                </div>
                {subTabResultados === 'hallazgos' && renderHallazgos()}
                {subTabResultados === 'informes' && isAdmin && (
                  <InformesAuditoria 
                    informesAuditoria={informesAuditoria}
                    setInformesAuditoria={setInformesAuditoria}
                    editInformeAuditoria={editInformeAuditoria}
                    setEditInformeAuditoria={setEditInformeAuditoria}
                    isAdmin={isAdmin}
                    user={user}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    columnFilters={columnFilters}
                    handleColFilterChange={handleColFilterChange}
                    exportToExcel={exportToExcel}
                    handleInformeAuditoriaSubmit={handleInformeAuditoriaSubmit}
                    isSubmitting={isSubmitting}
                    setFormResetKey={setFormResetKey}
                    scrollToForm={scrollToForm}
                    handleDeleteItem={handleDeleteItem}
                    applyFilters={applyFilters}
                    FilterInput={FilterInput}
                    safeHallazgos={safeHallazgos}
                    safePlanes={safePlanes}
                    formatSafeDate={formatSafeDate}
                    auditoresLista={auditoresLista}
                    onActualizarAuditores={async (nuevaLista) => {
                      setAuditoresLista(nuevaLista);
                      await saveToCloud({ auditoresLista: nuevaLista });
                    }}
                  />
                )}
              </div>
            )}

            {/* 4️⃣ FASE DE PLANES DE ACCIÓN (Subpestañas Anidadas) */}
            {activeTab === 'planes_tab' && (
              <div className="space-y-6">
                <div className="flex flex-wrap border-b border-slate-200 bg-white p-2 rounded-2xl gap-2 shadow-sm text-xs font-bold">
                  <button onClick={() => setSubTabPlanes('planes')} className={`px-4 py-2 rounded-xl transition-all ${subTabPlanes === 'planes' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>✅ Seguimiento de Planes</button>
                  <button onClick={() => setSubTabPlanes('incidentes')} className={`px-4 py-2 rounded-xl transition-all ${subTabPlanes === 'incidentes' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>🚨 Eventos de Pérdida</button>
                </div>
                {subTabPlanes === 'planes' && renderPlanes()}
                {subTabPlanes === 'incidentes' && renderIncidentes()}
              </div>
            )}

            {/* 5️⃣ FASE DE GOBERNANZA, COMITÉS Y CIERRE (Subpestañas Anidadas) */}
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
                    isAdmin={isAdmin}
                    editComite={editComite}
                    setEditComite={setEditComite}
                    handleComiteSubmit={handleComiteSubmit}
                    setFormResetKey={setFormResetKey}
                    formResetKey={formResetKey}
                    scrollToForm={scrollToForm}
                    handleDeleteItem={handleDeleteItem}
                    applyFilters={applyFilters}
                    comitesFiltrados={comitesFiltrados}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    columnFilters={columnFilters}
                    handleColFilterChange={handleColFilterChange}
                    FilterInput={FilterInput}
                  />
                )}
                {subTabGobernanza === 'trazabilidad' && isAdmin && renderInforme()}
              </div>
            )}

            {/* ⚙️ CONFIGURACIÓN */}
            {activeTab === 'config' && renderConfiguracion()}
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