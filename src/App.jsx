import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth'; 
import { auth } from './services/firebase';
import { formatSafeDate, calcularMatriz5x5, applyFilters } from './utils/helpers';

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
import SidebarNavigation from './components/SidebarNavigation';
import MiPerfil from './components/MiPerfil';

import { enviarCorreoGmail } from './services/gmailService';
import { useGrcData } from './hooks/useGrcData';
import { useGrcPeriodFilters } from './hooks/useGrcPeriodFilters';
import { createFormHandlers } from './handlers/grcFormHandlers';
import { exportToExcel, exportToJSON, saveToCloud as syncCloud } from './services/grcStorageService';
import { executeAuditorQuery } from './handlers/auditorIaHandler';
import { processExcelRiesgos } from './utils/excelImporter';
import { sugerirTextoConIA, analizarEvidenciaDocumento } from './services/copilotService';
import { defaultCronograma } from './constants/defaultData';


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

  const {
    defaultAnios, defaultMeses, selectedAnios, selectedMeses,
    setSelectedAnios, setSelectedMeses, handleColFilterChange,
    toggleAnio, toggleMes, incFiltrados, rFiltrados, hFiltrados,
    pFiltrados, comitesFiltrados, cFiltrados
  } = useGrcPeriodFilters({
    activeTab, subTabPlanificar, subTabResultados, subTabPlanes, subTabGobernanza,
    safeRiesgos, safeHallazgos, safePlanes, safeIncidentes, safeCronograma, safeComites,
    setSearchTerm, setColumnFilters
  });

const showNotification = (message, type = 'success') => { 
    setNotification({ message, type }); 
    setTimeout(() => setNotification(null), 4000); 
  };

  const saveToCloud = async (partialData) => {
    await syncCloud(partialData, showNotification);
  };

  const handleLogout = async () => { 
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      await signOut(auth);
      setUser(null);
      setIsAdmin(false);
      setShowWelcome(true);
      window.location.reload(); 
    } catch (error) {
      window.location.reload(); 
    }
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
    await executeAuditorQuery({
      textoDirecto, auditorInput, setIsAuditorThinking, setAuditorRespuesta,
      setAiModal, safeRiesgos, safeHallazgos, safePlanes, safeIncidentes,
      safeCronograma, safeEvaluaciones, safeMonitoreo, informesAuditoria
    });
    setAuditorInput('');
  };

  const handleExportExcel = (dataArray, fileName) => exportToExcel(dataArray, fileName, xlsxLoaded, showNotification);
  const handleExportJSON = () => exportToJSON({ riesgos: safeRiesgos, hallazgos: safeHallazgos, planes: safePlanes, incidentes: safeIncidentes, evaluaciones: safeEvaluaciones, cronograma: safeCronograma, monitoreo: safeMonitoreo });
  const handleImportJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsedData = JSON.parse(event.target.result);
        if (window.confirm("⚠️ ALERTA: Sobrescribirá TODA la base de datos. ¿Continuar?")) {
          setIsCloudLoaded(false); 
          await saveToCloud(parsedData);
          showNotification("Base de datos actualizada.", "success");
          setIsCloudLoaded(true);
        }
      } catch (error) {
        showNotification("Error: Formato JSON no válido.", "error");
      }
      e.target.value = null; 
    };
    reader.readAsText(file);
  };

  const handleImportExcelRiesgos = (e) => processExcelRiesgos({ event: e, safeRiesgos, setRiesgos, saveToCloud, showNotification, setIsCloudLoaded, user });
  const forceUpdateCronograma = async () => {
    if (window.confirm("¿Deseas cargar los 20 procesos del Plan Anual?")) {
      await saveToCloud({ cronograma: defaultCronograma });
      showNotification("¡Plan Anual actualizado!", "success");
    }
  };

  const sugerirConIA = (tipoTarget) => sugerirTextoConIA(tipoTarget, setIsThinking, showNotification);
  const analizarEvidenciaIA = (evidenciaUrl, contextoItem, tipoItem) => analizarEvidenciaDocumento(evidenciaUrl, contextoItem, tipoItem, setIsThinking, showNotification, setAiModal);

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

<SidebarNavigation 
        isPresentationMode={isPresentationMode}
        menuAbierto={menuAbierto}
        setMenuAbierto={setMenuAbierto}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        subTabPlanificar={subTabPlanificar}
        setSubTabPlanificar={setSubTabPlanificar}
        subTabResultados={subTabResultados}
        setSubTabResultados={setSubTabResultados}
        subTabPlanes={subTabPlanes}
        setSubTabPlanes={setSubTabPlanes}
        subTabGobernanza={subTabGobernanza}
        setSubTabGobernanza={setSubTabGobernanza}
        pendingPlansCount={pendingPlansCount}
        isAdmin={isAdmin}
        user={user}
        handleLogout={handleLogout}
      /> 
      
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