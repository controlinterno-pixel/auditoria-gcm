import React, { useState, useEffect, useMemo } from 'react';
import { signOut, onAuthStateChanged } from 'firebase/auth'; 
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
// 🔥 CONEXIÓN MODULAR Y SERVICIOS CENTRALIZADOS
import { auth, db } from './services/firebase';
import { 
  formatSafeDate, getItemAnio, getItemMesText, calcularMatriz5x5, applyFilters 
} from './utils/helpers';
import InformesAuditoria from './components/InformesAuditoria';
import * as XLSX from 'xlsx';
import Configuracion from './components/Configuracion';
import Incidentes from './components/Incidentes';
import Hallazgos from './components/Hallazgos';
import Planes from './components/Planes';
import Trazabilidad from './components/Trazabilidad';
import Evaluaciones from './components/Evaluaciones';
import Riesgos from './components/Riesgos';
import Apetito from './components/Apetito';
import PlanAnual from './components/PlanAnual';
import ProgramasAuditoria from './components/ProgramasAuditoria'; 
import AuditorIA from './components/AuditorIA';
import Comites from './components/Comites';
import ConceptMapper from './components/AuditoriaAutomatizada/ConceptMapper';
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
import MiPerfil from './components/MiPerfil';
import { useGrcData } from './hooks/useGrcData';
import { createFormHandlers } from './handlers/grcFormHandlers';
import { exportToExcel, exportToJSON, saveToCloud as syncCloud } from './services/grcStorageService';
import { consultarCopilotoIA } from './services/gemini';
import { 
  defaultCronograma, defaultRiesgos, defaultHallazgos, 
  defaultPlanes, defaultIncidentes, defaultEvaluaciones, defaultMonitoreo 
} from './constants/defaultData';


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
  const [menuAbierto, setMenuAbierto] = useState('inicio');

  // 🎨 LECTURA GLOBAL DEL TEMA EN TODA LA APP
  useEffect(() => {
const tema = localStorage.getItem('temaApp') || 'calido';
    document.documentElement.classList.remove('dark', 'warm');
    if (tema === 'oscuro') document.documentElement.classList.add('dark');
    if (tema === 'calido') document.documentElement.classList.add('warm');
  }, [activeTab]);
  // 🔌 Hook para gestionar peticiones a la base de datos
  // 🔌 ESTADOS PARA NAVEGACIÓN ANIDADA DE PROCESOS (WORKFLOW)
  const [subTabPlanificar, setSubTabPlanificar] = useState('plan_anual');
  const [subTabResultados, setSubTabResultados] = useState('hallazgos');
  const [subTabPlanes, setSubTabPlanes] = useState('planes');
  const [subTabGobernanza, setSubTabGobernanza] = useState('comites');
// 🔌 ESTADO PARA NAVEGACIÓN DIRECTA DE PROCESOS AL EXPEDIENTE 360°
const [selectedProcesoExpediente, setSelectedProcesoExpediente] = useState('');
  // 🔌 ESTADO PARA EL CASO ACTIVO DEL EXPEDIENTE ÚNICO

  const [notification, setNotification] = useState(null);
  const [isPresentationMode, setIsPresentationMode] = useState(false); 
  const [formResetKey, setFormResetKey] = useState(Date.now()); 

  const [searchTerm, setSearchTerm] = useState('');
  const [columnFilters, setColumnFilters] = useState({});
  const {
    user, setUser, isAdmin, setIsAdmin, perfilUsuario, setPerfilUsuario,
    isCloudLoaded, setIsCloudLoaded, showWelcome, setShowWelcome,
    riesgos, setRiesgos, hallazgos, setHallazgos, planes, setPlanes,
    incidentes, setIncidentes, evaluaciones, setEvaluaciones,
    cronograma, setCronograma, monitoreo, setMonitoreo,
    informesAuditoria, setInformesAuditoria, comites, setComites,
    programas, setProgramas, auditoresLista, setAuditoresLista,
    safePlanes, safeHallazgos, safeRiesgos, safeEvaluaciones,
    safeProgramas, safeIncidentes, safeCronograma, safeMonitoreo, safeComites
  } = useGrcData();

  const [xlsxLoaded] = useState(true);
  const [isThinking, setIsThinking] = useState(false);
  const [aiModal, setAiModal] = useState(null);
  const [chartDetail, setChartDetail] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [matrizFiltro, setMatrizFiltro] = useState(null);

  const [showAuditorIA, setShowAuditorIA] = useState(false);
  const [auditorInput, setAuditorInput] = useState('');
  const [auditorRespuesta, setAuditorRespuesta] = useState('');
  const [isAuditorThinking, setIsAuditorThinking] = useState(false);

  const [editRiesgo, setEditRiesgo] = useState(null);
  const [editPlan, setEditPlan] = useState(null);
  const [editEvaluacion, setEditEvaluacion] = useState(null);
  const [editHallazgo, setEditHallazgo] = useState(null);
  const [editIncidente, setEditIncidente] = useState(null);
  const [editCronograma, setEditCronograma] = useState(null);
  const [editApetito, setEditApetito] = useState(null);
  const [editMonitoreo, setEditMonitoreo] = useState(null);
  const [activeTooltip, setActiveTooltip] = useState(null);
  const [editInformeAuditoria, setEditInformeAuditoria] = useState(null);
  const [editComite, setEditComite] = useState(null);
  const [editPrograma, setEditPrograma] = useState(null);

  const [periodFilters, setPeriodFilters] = useState({});

  const defaultAnios = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearsSet = new Set([currentYear - 1, currentYear, currentYear + 1, currentYear + 2, currentYear + 3]);
    safeRiesgos.forEach(r => r.anio && yearsSet.add(Number(r.anio)));
    safeHallazgos.forEach(h => h.anio && yearsSet.add(Number(h.anio)));
    safePlanes.forEach(p => p.anio && yearsSet.add(Number(p.anio)));
    safeIncidentes.forEach(i => i.anio && yearsSet.add(Number(i.anio)));
    safeCronograma.forEach(c => c.anio && yearsSet.add(Number(c.anio)));
    return Array.from(yearsSet).sort((a, b) => a - b);
  }, [safeRiesgos, safeHallazgos, safePlanes, safeIncidentes, safeCronograma]);

  const defaultMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const getCurrentFilterKey = () => {
    if (activeTab === 'plan_anual_tab') return `plan_anual_tab_${subTabPlanificar}`;
    if (activeTab === 'resultados_tab') return `resultados_tab_${subTabResultados}`;
    if (activeTab === 'planes_tab') return `planes_tab_${subTabPlanes}`;
    if (activeTab === 'gobernanza_tab') return `gobernanza_tab_${subTabGobernanza}`;
    return activeTab;
  };
  
  const filterKey = getCurrentFilterKey();

  const getDefaultAnios = (key) => {
    if (key === 'plan_anual_tab_riesgos' || key === 'plan_anual_tab_apetito') {
      return []; 
    }
    return [new Date().getFullYear()];
  };

  const selectedAnios = periodFilters[filterKey]?.anios || getDefaultAnios(filterKey);
  const selectedMeses = periodFilters[filterKey]?.meses || defaultMeses;

  const setSelectedAnios = (valOrFunc) => {
    setPeriodFilters(prev => {
      const cur = prev[filterKey] || { anios: getDefaultAnios(filterKey), meses: defaultMeses };
      return { ...prev, [filterKey]: { ...cur, anios: typeof valOrFunc === 'function' ? valOrFunc(cur.anios) : valOrFunc } };
    });
  };

  const setSelectedMeses = (valOrFunc) => {
    setPeriodFilters(prev => {
      const cur = prev[filterKey] || { anios: getDefaultAnios(filterKey), meses: defaultMeses };
      return { ...prev, [filterKey]: { ...cur, meses: typeof valOrFunc === 'function' ? valOrFunc(cur.meses) : valOrFunc } };
    });
  };

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
  

const handleLogout = async () => { 
    try {
      // 1. Matamos la sesión en el Backend (Cookie)
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      // 2. Matamos la sesión en el Frontend (Firebase)
      await signOut(auth);
      // 3. Limpiamos los estados de React
      setUser(null);
      setIsAdmin(false);
      setShowWelcome(true);
      // 4. 🔥 BALA DE PLATA: Forzamos la limpieza del DOM para evitar formularios atascados
      window.location.reload(); 
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      window.location.reload(); // Si falla algo, recargamos por seguridad
    }
  };
const saveToCloud = async (partialData) => {
    await syncCloud(partialData, showNotification);
  };

  const handleDeleteItem = async (listType, id) => {
    if (!isAdmin) return; 
    if (!window.confirm('¿Eliminar registro permanentemente?')) return;
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
    if (listType === 'programas') { updated = safeProgramas.filter(p => p.id !== id); setProgramas(updated); }
    await saveToCloud({ [listType]: updated }); 
    showNotification("Registro eliminado.", "success");
  };

  const showNotification = (message, type = 'success') => { 
    setNotification({message, type}); 
    setTimeout(() => setNotification(null), 4000); 
  };
  
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

  const handleAuditorSubmit = async (e, textoDirecto = null) => {
    if (e) e.preventDefault(); 
    const consultaFinal = textoDirecto || auditorInput;
    if (!consultaFinal.trim()) return;

    setIsAuditorThinking(true);
    setAuditorRespuesta('');

    try {
      const hoy = new Date();
      const riesgosBase = safeRiesgos;
      const hallazgosBase = safeHallazgos;
      const planesBase = safePlanes;
      const incidentesBase = safeIncidentes;
      const cronogramaBase = safeCronograma;

      let criticosTotal = 0;
      try { criticosTotal = riesgosBase.filter(r => r.probabilidadResidual && r.impactoResidual && calcularMatriz5x5(r.probabilidadResidual, r.impactoResidual).score > 16).length; } catch(err) {}
      
      const evalFiltradas = safeEvaluaciones;
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

      const contextoDatos = {
        dashboard: {
          cumplimientoPlanAnual: avanceCronogramaGlobal + '%',
          avancePlanesAccion: (planesBase.length > 0 ? Math.round(planesBase.reduce((acc, p) => acc + (p.progreso || p.avance || 0), 0) / planesBase.length) : 0) + '%',
          efectividadControles: efectividadControlesGlobal + '%'
        },
        riesgos: riesgosBase,
        hallazgos: hallazgosBase,
        planesAccion: planesBase,
        controlesEvaluados: evalFiltradas,
        incidentes: incidentesBase,
        informesAuditoria: resumenInformes,
        indicadoresMonitoreo: safeMonitoreo
      };  

      if (
        consultaFinal.toLowerCase().includes('planes de mejoramiento') || 
        consultaFinal.toLowerCase().includes('avance físico') || 
        consultaFinal.toLowerCase().includes('planes de acción')
      ) {
        const total = planesBase.length;
        const cerrados = planesBase.filter(p => p.estado === 'Cerrado' || p.progreso === 100).length;
        const abiertos = total - cerrados;
        const vencidosPlanes = planesBase.filter(p => p.estado !== 'Cerrado' && p.fecha && new Date(p.fecha) < hoy);
        const vencidos = vencidosPlanes.length;
        
        const pctCerrados = total > 0 ? Math.round((cerrados / total) * 100) : 0;
        const pctVencidos = total > 0 ? Math.round((vencidos / total) * 100) : 0;
        const avanceFisico = total > 0 ? Math.round(planesBase.reduce((acc, p) => acc + (p.progreso || p.avance || 0), 0) / total) : 0;

        const conteoProcesos = {};
        const conteoResponsables = {};

        vencidosPlanes.forEach(p => {
          const hallazgoVinculado = safeHallazgos.find(h => String(h.id) === String(p.idHallazgo));
          const procesoNombre = hallazgoVinculado?.proceso || p.proceso || 'Procesos Específicos';
          const respNombre = p.responsable || 'Sin Asignar';

          conteoProcesos[procesoNombre] = (conteoProcesos[procesoNombre] || 0) + 1;
          conteoResponsables[respNombre] = (conteoResponsables[respNombre] || 0) + 1;
        });

        const topProcesos = Object.entries(conteoProcesos).sort((a, b) => b[1] - a[1]);
        const topResponsables = Object.entries(conteoResponsables).sort((a, b) => b[1] - a[1]);

        let hallazgoPatron = "";
        if (topProcesos.length > 0) {
          const acumTopProcesos = topProcesos.slice(0, 3).reduce((acc, curr) => acc + curr[1], 0);
          hallazgoPatron += `• Focalización de la mora: ${acumTopProcesos} de los ${vencidos} planes vencidos pertenecen principalmente a los procesos de **${topProcesos.slice(0, 3).map(p => p[0]).join(', ')}**, lo que sugiere que el problema de oportunidad no es institucional sino focalizado.\n`;
        }
        if (topResponsables.length > 0 && topResponsables[0][1] > 1) {
          const pctResp = Math.round((topResponsables[0][1] / (vencidos || 1)) * 100);
          hallazgoPatron += `• Concentración de carga: El responsable **${topResponsables[0][0]}** acumula el ${pctResp}% de las acciones vencidas (${topResponsables[0][1]} planes), lo que evidencia una posible sobrecarga o cuello de botella operativo.`;
        }

        const nivelSemaforo = pctVencidos > 35 ? '🔴 Crítico' : (pctVencidos > 15 ? '🟠 Atención' : '🟢 Controlado');

        const dictamenEjecutivo = `📌 DIAGNÓSTICO EJECUTIVO GRC
• Estado General: ${nivelSemaforo}
• Nivel de Riesgo Operativo: Alto
• Nivel de Cumplimiento: ${pctCerrados}%
• Urgencia de Intervención: Alta
• Confianza del Análisis: 98% (Evidencia sobre ${total} registros)

---

## 📊 Estado Situacional de los Planes de Acción
Actualmente existen **${total} planes de acción**, de los cuales **${cerrados} (${pctCerrados}%)** se encuentran cerrados y **${abiertos}** continúan abiertos.

El avance físico consolidado es del **${avanceFisico}%**, indicando que la mayoría de los compromisos están en proceso de implementación.

No obstante, el **${pctVencidos}% de la cartera (${vencidos} planes)** se encuentra vencido. Esta cifra evidencia que el proceso de seguimiento no está logrando convertir oportunamente los hallazgos en acciones efectivas, lo cual podría incrementar el riesgo residual y afectar el cumplimiento oportuno de las mejoras.

---

## 🔎 Patrones y Cuellos de Botella Detectados
${hallazgoPatron || '• Los vencimientos se distribuyen de manera uniforme sin concentraciones críticas por proceso.'}

---

## 🟢 Aspectos Positivos
✔ El programa de mejoramiento registra un avance físico continuo (**${avanceFisico}%**), descartando una paralización del proceso.
✔ Un **${pctCerrados}%** de los planes ha completado satisfactoriamente su ciclo de cierre.
✔ La trazabilidad del sistema permite identificar con precisión las áreas de retraso para intervenir de forma quirúrgica.

---

## 🎯 Prioridades Recomendadas por la Dirección de Auditoría
1. **Recuperar la cartera vencida**: Concentrar esfuerzos en resolver los ${vencidos} planes vencidos antes de autorizar o cargar nuevas acciones de mejora.
2. **Revisar sobrecargas**: Evaluar la capacidad de gestión en los procesos de ${topProcesos[0]?.[0] || 'las áreas críticas'} y con el responsable **${topResponsables[0]?.[0] || 'asignado'}**.
3. **Escalamiento**: Presentar este mapa de patrones en la próxima sesión del Comité de Auditoría.

---

## 💡 Conclusión Ejecutiva
Aunque el programa mantiene dinámica de ejecución, la acumulación de un **${pctVencidos}% de planes vencidos** representa el principal factor que limita el cierre efectivo de las desviaciones. La administración debería priorizar la nivelación de los planes atrasados para fortalecer la madurez del Sistema de Control Interno.`;

        setAuditorRespuesta(dictamenEjecutivo);
      } else {
        const respuestaIA = await consultarCopilotoIA(consultaFinal, contextoDatos);
        
        if (typeof respuestaIA === 'object' && respuestaIA !== null) {
          setAuditorRespuesta(respuestaIA.summary || respuestaIA.dictamen || "Análisis completado. Revisa el informe detallado en pantalla.");
          setAiModal({
            titulo: respuestaIA.title || respuestaIA.titulo || "Informe Ejecutivo de Auditoría GRC",
            contenido: respuestaIA
          });
        } else {
          setAuditorRespuesta(respuestaIA);
        }
      }
    } catch (error) {
      console.error("🔍 Error IA:", error);
      setAuditorRespuesta(`❌ Error al consultar al asistente: ${error.message}`);
    } finally {
      setIsAuditorThinking(false);
      setAuditorInput(''); 
    }
  };  

  const handleExportExcel = (dataArray, fileName) => {
    exportToExcel(dataArray, fileName, xlsxLoaded, showNotification);
  };

  const handleExportJSON = () => {
    const data = { riesgos: safeRiesgos, hallazgos: safeHallazgos, planes: safePlanes, incidentes: safeIncidentes, evaluaciones: safeEvaluaciones, cronograma: safeCronograma, monitoreo: safeMonitoreo };
    exportToJSON(data);
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

    textoBase = textoBase.replace(/[<>{}[\]\\]/g, '').trim();

    if (!textoBase || textoBase === '' || textoBase.includes('-- Seleccione --')) {
      showNotification("Escribe una descripción o selecciona un hallazgo primero para que la IA lo analice.", "error");
      return;
    }

    setIsThinking(true);
    showNotification("Procesando consulta con el Motor GRC Serverless...", "success");

    try {
      const sugerencia = await consultarCopilotoIA({
        tipoAccion: 'sugerir_grc',
        tipoTarget,
        prompt: textoBase
      });

      if (inputDestino) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeInputValueSetter.call(inputDestino, typeof sugerencia === 'string' ? sugerencia.replace(/(^"|"$)/g, '') : JSON.stringify(sugerencia));
        inputDestino.dispatchEvent(new Event('input', { bubbles: true }));
        inputDestino.dispatchEvent(new Event('change', { bubbles: true }));
        showNotification("¡Sugerencia ejecutiva insertada con éxito!");
      }
    } catch (error) {
      console.error("Error conectando al Asistente IA:", error);
      showNotification("Error conectando con el servidor de auditoría.", "error");
    } finally {
      setIsThinking(false);
    }
  };

  const analizarEvidenciaIA = async (evidenciaUrl, contextoItem, tipoItem) => {
    setIsThinking(true);
    showNotification("🤖 Enviando documento al Asistente Serverless...", "success");

    try {
      const analisis = await consultarCopilotoIA({
        tipoAccion: 'analizar_evidencia',
        evidenciaUrl,
        contextoItem,
        tipoItem
      });

      setAiModal({ 
        titulo: `📋 Checklist IA de Auditoría`, 
        contenido: typeof analisis === 'string' ? analisis : JSON.stringify(analisis), 
        url: evidenciaUrl 
      });

    } catch (error) {
      console.error(error);
      showNotification("Error al procesar la evidencia en el servidor.", "error");
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
  const {
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
  } = createFormHandlers({
    user, isAdmin, safeRiesgos, safeHallazgos, safePlanes, safeEvaluaciones,
    safeComites, safeIncidentes, safeCronograma, safeMonitoreo, informesAuditoria,
    editRiesgo, editHallazgo, editPlan, editEvaluacion, editComite, editIncidente,
    editCronograma, editApetito, editMonitoreo, editInformeAuditoria,
    setRiesgos, setHallazgos, setPlanes, setEvaluaciones, setComites, setIncidentes,
    setCronograma, setMonitoreo, setInformesAuditoria,
    setEditRiesgo, setEditHallazgo, setEditPlan, setEditEvaluacion, setEditComite,
    setEditIncidente, setEditCronograma, setEditApetito, setEditMonitoreo, setEditInformeAuditoria,
    saveToCloud, showNotification, setIsSubmitting, setFormResetKey, ejecutarDespachoGmailApi, defaultMeses
  });


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
    <div className="flex h-screen bg-slate-50 warm:bg-[#f5f3ef] dark:bg-[#040914] font-sans overflow-hidden transition-colors duration-500">
      {/* BOTÓN FLOTANTE: SALIR DE MODO PRESENTACIÓN */}
      {isPresentationMode && (
        <button 
          onClick={() => setIsPresentationMode(false)} 
          className="fixed bottom-6 right-6 z-[100] bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all hover:scale-105 flex items-center space-x-2 border-2 border-slate-700 animate-in slide-in-from-bottom-10"
        >
          <span>✖</span><span>Salir de Presentación</span>
        </button>
      )}

<div 
      className={`w-[260px] text-[#a3c2e0] flex flex-col shadow-2xl z-20 border-r border-slate-800/50 ${isPresentationMode ? 'hidden' : 'flex'} relative`}
      style={{
        background: 'linear-gradient(180deg, #041428 0%, #010613 100%)'
      }}
    >
      
      {/* BRANDING LOGO (Con resplandor radial) */}
      <div 
        className="p-6 flex items-center space-x-3 border-b border-[#0066ff1a] shrink-0 shadow-[0_4px_20px_rgba(0,102,255,0.05)]"
        style={{ background: 'radial-gradient(circle at 50% 50%, rgba(0, 102, 255, 0.15) 0%, transparent 70%)' }}
      >
        <div className="w-8 h-8 bg-gradient-to-br from-[#0055ff] to-[#00aaff] rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(0,102,255,0.4)]">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
        </div>
        <div>
          <h1 className="text-sm font-black text-white tracking-tight drop-shadow-md">GCM Auditor v5</h1>
          <p className="text-[8px] text-[#6b96c3] font-bold uppercase tracking-widest mt-0.5">Auditoría • Riesgos • Cumplimiento</p>
        </div>
      </div>

     {/* MENÚ ACORDEÓN CON FUNCIÓN TOGGLE (OCULTAR/MOSTRAR) */}
      <nav className="flex-1 px-4 py-4 space-y-1 text-xs font-medium overflow-y-auto custom-scrollbar relative z-10">

        {/* 1. INICIO */}
        <div className="flex flex-col">
          <button 
            onClick={() => {
              setMenuAbierto(menuAbierto === 'inicio' ? null : 'inicio');
              if (menuAbierto !== 'inicio') setActiveTab('tablero');
            }} 
            className={`flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all duration-200 ${(activeTab === 'tablero' || activeTab === 'dashboard_riesgos') ? 'bg-gradient-to-r from-[#0055ff] to-[#0077ff] text-white shadow-[0_4px_15px_rgba(0,85,255,0.3)]' : 'hover:bg-slate-800/60 text-[#a3c2e0] hover:text-white'}`}>
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              <span className="font-bold">Inicio</span>
            </div>
            <svg className={`w-4 h-4 transition-transform duration-300 ${menuAbierto === 'inicio' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          <div className={`overflow-hidden transition-all duration-300 pl-11 ${menuAbierto === 'inicio' ? 'max-h-40 opacity-100 mt-1 mb-2' : 'max-h-0 opacity-0'}`}>
            <div className="flex flex-col border-l-2 border-slate-800/80 space-y-1 py-1">
              <button onClick={() => setActiveTab('tablero')} className={`text-left pl-4 py-2 text-[11px] font-semibold rounded-r-lg ${activeTab === 'tablero' ? 'text-white bg-slate-800/40 border-l-2 border-[#0055ff] -ml-[2px]' : 'text-[#6b96c3] hover:text-white hover:bg-slate-800/30'}`}>Mi Espacio GRC</button>
              <button onClick={() => setActiveTab('dashboard_riesgos')} className={`text-left pl-4 py-2 text-[11px] font-semibold rounded-r-lg ${activeTab === 'dashboard_riesgos' ? 'text-white bg-slate-800/40 border-l-2 border-[#0055ff] -ml-[2px]' : 'text-[#6b96c3] hover:text-white hover:bg-slate-800/30'}`}>GRC Dashboard</button>
            </div>
          </div>
        </div>

        {/* 2. AUDITORÍAS */}
        <div className="flex flex-col">
          <button 
            onClick={() => { 
              setMenuAbierto(menuAbierto === 'auditorias' ? null : 'auditorias');
              if (menuAbierto !== 'auditorias') { setActiveTab('plan_anual_tab'); setSubTabPlanificar('plan_anual'); }
            }} 
            className={`flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all duration-200 ${(activeTab === 'plan_anual_tab' && (subTabPlanificar === 'plan_anual' || subTabPlanificar === 'programas')) || activeTab === 'evaluaciones' ? 'bg-gradient-to-r from-[#0055ff] to-[#0077ff] text-white shadow-[0_4px_15px_rgba(0,85,255,0.3)]' : 'hover:bg-slate-800/60 text-[#a3c2e0] hover:text-white'}`}>
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
              <span className="font-bold">Auditorías</span>
            </div>
            <svg className={`w-4 h-4 transition-transform duration-300 ${menuAbierto === 'auditorias' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          <div className={`overflow-hidden transition-all duration-300 pl-11 ${menuAbierto === 'auditorias' ? 'max-h-40 opacity-100 mt-1 mb-2' : 'max-h-0 opacity-0'}`}>
            <div className="flex flex-col border-l-2 border-slate-800/80 space-y-1 py-1">
              <button onClick={() => { setActiveTab('plan_anual_tab'); setSubTabPlanificar('plan_anual'); }} className={`text-left pl-4 py-2 text-[11px] font-semibold rounded-r-lg ${activeTab === 'plan_anual_tab' && subTabPlanificar === 'plan_anual' ? 'text-white bg-slate-800/40 border-l-2 border-[#0055ff] -ml-[2px]' : 'text-[#6b96c3] hover:text-white hover:bg-slate-800/30'}`}>Cronograma Anual</button>
              <button onClick={() => { setActiveTab('plan_anual_tab'); setSubTabPlanificar('programas'); }} className={`text-left pl-4 py-2 text-[11px] font-semibold rounded-r-lg ${activeTab === 'plan_anual_tab' && subTabPlanificar === 'programas' ? 'text-white bg-slate-800/40 border-l-2 border-[#0055ff] -ml-[2px]' : 'text-[#6b96c3] hover:text-white hover:bg-slate-800/30'}`}>Programas de Auditoría</button>
              {isAdmin && <button onClick={() => setActiveTab('evaluaciones')} className={`text-left pl-4 py-2 text-[11px] font-semibold rounded-r-lg ${activeTab === 'evaluaciones' ? 'text-white bg-slate-800/40 border-l-2 border-[#0055ff] -ml-[2px]' : 'text-[#6b96c3] hover:text-white hover:bg-slate-800/30'}`}>Trabajo de Campo</button>}
            </div>
          </div>
        </div>

        {/* 3. RIESGOS */}
        <div className="flex flex-col">
          <button 
            onClick={() => { 
              setMenuAbierto(menuAbierto === 'riesgos' ? null : 'riesgos');
              if (menuAbierto !== 'riesgos') { setActiveTab('plan_anual_tab'); setSubTabPlanificar('riesgos'); }
            }} 
            className={`flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'plan_anual_tab' && (subTabPlanificar === 'riesgos' || subTabPlanificar === 'apetito') ? 'bg-gradient-to-r from-[#0055ff] to-[#0077ff] text-white shadow-[0_4px_15px_rgba(0,85,255,0.3)]' : 'hover:bg-slate-800/60 text-[#a3c2e0] hover:text-white'}`}>
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <span className="font-bold">Riesgos</span>
            </div>
            <svg className={`w-4 h-4 transition-transform duration-300 ${menuAbierto === 'riesgos' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          <div className={`overflow-hidden transition-all duration-300 pl-11 ${menuAbierto === 'riesgos' ? 'max-h-40 opacity-100 mt-1 mb-2' : 'max-h-0 opacity-0'}`}>
            <div className="flex flex-col border-l-2 border-slate-800/80 space-y-1 py-1">
              <button onClick={() => { setActiveTab('plan_anual_tab'); setSubTabPlanificar('riesgos'); }} className={`text-left pl-4 py-2 text-[11px] font-semibold rounded-r-lg ${activeTab === 'plan_anual_tab' && subTabPlanificar === 'riesgos' ? 'text-white bg-slate-800/40 border-l-2 border-[#0055ff] -ml-[2px]' : 'text-[#6b96c3] hover:text-white hover:bg-slate-800/30'}`}>Matriz de Riesgos</button>
              <button onClick={() => { setActiveTab('plan_anual_tab'); setSubTabPlanificar('apetito'); }} className={`text-left pl-4 py-2 text-[11px] font-semibold rounded-r-lg ${activeTab === 'plan_anual_tab' && subTabPlanificar === 'apetito' ? 'text-white bg-slate-800/40 border-l-2 border-[#0055ff] -ml-[2px]' : 'text-[#6b96c3] hover:text-white hover:bg-slate-800/30'}`}>Apetito de Riesgo</button>
            </div>
          </div>
        </div>

        {/* 4. INFORMES Y HALLAZGOS */}
        <div className="flex flex-col">
          <button 
            onClick={() => { 
              setMenuAbierto(menuAbierto === 'hallazgos' ? null : 'hallazgos');
              if (menuAbierto !== 'hallazgos') { 
                setActiveTab('resultados_tab'); 
                setSubTabResultados(isAdmin ? 'informes' : 'hallazgos'); 
              }
            }} 
            className={`flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all duration-200 ${(activeTab === 'resultados_tab' || (activeTab === 'planes_tab' && subTabPlanes === 'incidentes')) ? 'bg-gradient-to-r from-[#0055ff] to-[#0077ff] text-white shadow-[0_4px_15px_rgba(0,85,255,0.3)]' : 'hover:bg-slate-800/60 text-[#a3c2e0] hover:text-white'}`}>
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              <span className="font-bold">Informes y Hallazgos</span>
            </div>
            <svg className={`w-4 h-4 transition-transform duration-300 ${menuAbierto === 'hallazgos' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          <div className={`overflow-hidden transition-all duration-300 pl-11 ${menuAbierto === 'hallazgos' ? 'max-h-60 opacity-100 mt-1 mb-2' : 'max-h-0 opacity-0'}`}>
            <div className="flex flex-col border-l-2 border-slate-800/80 space-y-1 py-1">
              {isAdmin && <button onClick={() => { setActiveTab('resultados_tab'); setSubTabResultados('informes'); }} className={`text-left pl-4 py-2 text-[11px] font-semibold rounded-r-lg ${activeTab === 'resultados_tab' && subTabResultados === 'informes' ? 'text-white bg-slate-800/40 border-l-2 border-[#0055ff] -ml-[2px]' : 'text-[#6b96c3] hover:text-white hover:bg-slate-800/30'}`}>Informes Emitidos</button>}
              <button onClick={() => { setActiveTab('resultados_tab'); setSubTabResultados('hallazgos'); }} className={`text-left pl-4 py-2 text-[11px] font-semibold rounded-r-lg ${activeTab === 'resultados_tab' && subTabResultados === 'hallazgos' ? 'text-white bg-slate-800/40 border-l-2 border-[#0055ff] -ml-[2px]' : 'text-[#6b96c3] hover:text-white hover:bg-slate-800/30'}`}>Hallazgos Registrados</button>
              <button onClick={() => { setActiveTab('planes_tab'); setSubTabPlanes('incidentes'); }} className={`text-left pl-4 py-2 text-[11px] font-semibold rounded-r-lg ${activeTab === 'planes_tab' && subTabPlanes === 'incidentes' ? 'text-white bg-slate-800/40 border-l-2 border-[#0055ff] -ml-[2px]' : 'text-[#6b96c3] hover:text-white hover:bg-slate-800/30'}`}>Eventos de Pérdida</button>
            </div>
          </div>
        </div>

        {/* 5. PLANES DE ACCIÓN */}
        <div className="flex flex-col">
          <button 
            onClick={() => { 
              setMenuAbierto(menuAbierto === 'planes' ? null : 'planes');
              if (menuAbierto !== 'planes') { setActiveTab('planes_tab'); setSubTabPlanes('planes'); }
            }} 
            className={`flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all duration-200 ${(activeTab === 'planes_tab' && subTabPlanes === 'planes') ? 'bg-gradient-to-r from-[#0055ff] to-[#0077ff] text-white shadow-[0_4px_15px_rgba(0,85,255,0.3)]' : 'hover:bg-slate-800/60 text-[#a3c2e0] hover:text-white'}`}>
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="font-bold">Planes de Acción</span>
            </div>
            <div className="flex items-center gap-2">
              {pendingPlansCount > 0 && <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-md">{pendingPlansCount}</span>}
              <svg className={`w-4 h-4 transition-transform duration-300 ${menuAbierto === 'planes' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </button>
          <div className={`overflow-hidden transition-all duration-300 pl-11 ${menuAbierto === 'planes' ? 'max-h-40 opacity-100 mt-1 mb-2' : 'max-h-0 opacity-0'}`}>
            <div className="flex flex-col border-l-2 border-slate-800/80 space-y-1 py-1">
              <button onClick={() => { setActiveTab('planes_tab'); setSubTabPlanes('planes'); }} className={`text-left pl-4 py-2 text-[11px] font-semibold rounded-r-lg flex justify-between ${activeTab === 'planes_tab' && subTabPlanes === 'planes' ? 'text-white bg-slate-800/40 border-l-2 border-[#0055ff] -ml-[2px]' : 'text-[#6b96c3] hover:text-white hover:bg-slate-800/30'}`}>
                Seguimiento de Planes {pendingPlansCount > 0 && <span className="text-rose-400">({pendingPlansCount})</span>}
              </button>
            </div>
          </div>
        </div>

        {/* 5. GOBERNANZA E INTELIGENCIA */}
        {isAdmin && (
          <div className="flex flex-col">
            <button 
              onClick={() => { 
                setMenuAbierto(menuAbierto === 'gobernanza' ? null : 'gobernanza');
                if (menuAbierto !== 'gobernanza') { setActiveTab('gobernanza_tab'); setSubTabGobernanza('comites'); }
              }} 
              className={`flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'gobernanza_tab' ? 'bg-gradient-to-r from-[#0055ff] to-[#0077ff] text-white shadow-[0_4px_15px_rgba(0,85,255,0.3)]' : 'hover:bg-slate-800/60 text-[#a3c2e0] hover:text-white'}`}>
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                <span className="font-bold">Gobernanza & IA</span>
              </div>
              <svg className={`w-4 h-4 transition-transform duration-300 ${menuAbierto === 'gobernanza' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            <div className={`overflow-hidden transition-all duration-300 pl-11 ${menuAbierto === 'gobernanza' ? 'max-h-40 opacity-100 mt-1 mb-2' : 'max-h-0 opacity-0'}`}>
              <div className="flex flex-col border-l-2 border-slate-800/80 space-y-1 py-1">
                <button onClick={() => { setActiveTab('gobernanza_tab'); setSubTabGobernanza('comites'); }} className={`text-left pl-4 py-2 text-[11px] font-semibold rounded-r-lg ${activeTab === 'gobernanza_tab' && subTabGobernanza === 'comites' ? 'text-white bg-slate-800/40 border-l-2 border-[#0055ff] -ml-[2px]' : 'text-[#6b96c3] hover:text-white hover:bg-slate-800/30'}`}>Sesiones de Comité</button>
                <button onClick={() => { setActiveTab('gobernanza_tab'); setSubTabGobernanza('trazabilidad'); }} className={`text-left pl-4 py-2 text-[11px] font-semibold rounded-r-lg ${activeTab === 'gobernanza_tab' && subTabGobernanza === 'trazabilidad' ? 'text-white bg-slate-800/40 border-l-2 border-[#0055ff] -ml-[2px]' : 'text-[#6b96c3] hover:text-white hover:bg-slate-800/30'}`}>Bitácora Trazabilidad</button>
                <button onClick={() => { setActiveTab('gobernanza_tab'); setSubTabGobernanza('auditoria_auto'); }} className={`text-left pl-4 py-2 text-[11px] font-semibold rounded-r-lg ${activeTab === 'gobernanza_tab' && subTabGobernanza === 'auditoria_auto' ? 'text-white bg-slate-800/40 border-l-2 border-[#0055ff] -ml-[2px]' : 'text-[#6b96c3] hover:text-white hover:bg-slate-800/30'}`}>Auditoría Automatizada</button>
              </div>
            </div>
          </div>
        )}

        {/* 6. CONFIGURACIÓN */}
        {isAdmin && (
          <div className="flex flex-col pt-2 border-t border-slate-800/50 mt-2">
            <button onClick={() => setActiveTab('config')} className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'config' ? 'bg-gradient-to-r from-[#0055ff] to-[#0077ff] text-white shadow-[0_4px_15px_rgba(0,85,255,0.3)]' : 'hover:bg-slate-800/60 text-[#a3c2e0] hover:text-white'}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <span className="font-bold">Configuración</span>
            </button>
          </div>
        )}

      </nav>

      {/* 👤 PERFIL DE USUARIO AL FONDO */}
      <div 
        className="p-4 shrink-0 z-10"
        style={{
          background: 'linear-gradient(180deg, rgba(4, 25, 55, 0.8) 0%, rgba(1, 6, 19, 0.9) 100%)',
          boxShadow: '0 -10px 25px rgba(0, 102, 255, 0.1)',
          borderTop: '1px solid rgba(0, 102, 255, 0.2)'
        }}
      >
        <div className="bg-slate-800/40 border border-[#0066ff1a] rounded-xl p-3 flex flex-col gap-3">
          
          {/* Info del usuario (Clickable) */}
          <div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => setActiveTab('mi_perfil')}
            title="Ir a mi perfil"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0055ff] to-[#00aaff] flex items-center justify-center text-white font-black text-lg shadow-[0_0_15px_rgba(0,102,255,0.4)] shrink-0 overflow-hidden ring-2 ring-transparent group-hover:ring-[#0055ff] transition-all">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Perfil" className="w-full h-full object-cover" />
              ) : (
                user?.displayName ? user.displayName.charAt(0).toUpperCase() : (user?.email ? user.email.charAt(0).toUpperCase() : 'U')
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <h4 className="text-xs font-bold text-white truncate group-hover:text-[#a3c2e0] transition-colors drop-shadow-sm">
                {user?.displayName || user?.email?.split('@')[0] || 'Usuario'}
              </h4>
              <p className="text-[9px] font-semibold text-[#00aaff] uppercase tracking-widest mt-0.5">
                {isAdmin ? 'Auditor Líder' : 'Gestor de Proceso'}
              </p>
            </div>
          </div>

          <div className="h-[1px] w-full bg-slate-800/80" />
          
          {/* Botonera de cuenta */}
          <div className="flex flex-col gap-1">
            <button 
              onClick={() => setActiveTab('mi_perfil')} 
              className="flex items-center justify-between text-[11px] font-bold text-[#a3c2e0] hover:text-white hover:bg-slate-800/60 transition-colors px-2 py-1.5 rounded-lg w-full"
            >
              <span>⚙️ Configurar Perfil</span>
            </button>
            <button 
              onClick={handleLogout} 
              className="flex items-center justify-between text-[11px] font-bold text-[#a3c2e0] hover:text-rose-400 hover:bg-rose-950/30 transition-colors px-2 py-1.5 rounded-lg w-full"
            >
              <span>Cerrar Sesión</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>

        </div>
      </div>
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
        
<main id="main-scroll-area" className={`flex-grow overflow-y-auto ${isPresentationMode ? 'p-12' : 'p-8'} bg-slate-50 warm:bg-[#FCFBF8] warm:text-[#4A3F35] dark:bg-[#070f1e] dark:text-slate-300 scroll-smooth relative transition-colors duration-500`}>
          <div className={`${isPresentationMode ? 'max-w-none' : 'max-w-7xl'} mx-auto transition-all duration-500`}>
          {/* 🏠 FASE 0: MI ESPACIO DE TRABAJO (Bandeja Ejecutiva + Expediente Único + Dashboard) */}
            {activeTab === 'tablero' && (
              <MiEspacio
                user={user}
                safeProgramas={safeProgramas}
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
        
        {/* Protegemos el renderizado del componente PlanAnual */}
        {isAdmin && subTabPlanificar === 'plan_anual' && (
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
{subTabPlanificar === 'programas' && (
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
        rFiltrados={safeRiesgos} 
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
    safeRiesgos={safeRiesgos} user={user} analizarEvidenciaIA={analizarEvidenciaIA} safeEvaluaciones={safeEvaluaciones}
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
                    isAdmin={isAdmin} 
                    safeRiesgos={safeRiesgos} 
                    informesAuditoria={informesAuditoria} 
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
                {subTabResultados === 'informes' && isAdmin && (
                  <InformesAuditoria 
                    informesAuditoria={informesAuditoria} 
                    safeProgramas={safeProgramas} /* 👈 ¡AQUÍ ESTÁ LA LÍNEA QUE FALTABA! */
                    setInformesAuditoria={setInformesAuditoria} editInformeAuditoria={editInformeAuditoria}
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
                          const correoGestor = auth.currentUser?.email || process.env.VITE_CORREO_ADMIN_DEFAULT || "admin@termales.com.co";
                          await ejecutarDespachoGmailApi({ ref_consecutivo: `PLAN-${id}`, titulo_informe: 'Plan de Acción Publicado Listo para Validación', proceso_auditado: planModificado.accion.substring(0, 50) + '...', enlace_pdf: 'https://auditoria-gcm.vercel.app', destinatarios: correoGestor });
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
            {isAdmin && activeTab === 'gobernanza_tab' && (
              <div className="space-y-6">
                
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
{subTabGobernanza === 'auditoria_auto' && (
                  <ConceptMapper />
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