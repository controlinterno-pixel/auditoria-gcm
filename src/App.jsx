import React from 'react';
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
import { useGrcUI } from './hooks/useGrcUI';
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
  const ui = useGrcUI();
  const {
    isResettingPassword, oobCode, activeTab, setActiveTab, menuAbierto, setMenuAbierto,
    subTabPlanificar, setSubTabPlanificar, subTabResultados, setSubTabResultados,
    subTabPlanes, setSubTabPlanes, subTabGobernanza, setSubTabGobernanza,
    selectedProcesoExpediente, setSelectedProcesoExpediente, notification, showNotification,
    isPresentationMode, setIsPresentationMode, formResetKey, setFormResetKey,
    searchTerm, setSearchTerm, columnFilters, setColumnFilters, xlsxLoaded,
    isThinking, setIsThinking, aiModal, setAiModal, chartDetail, setChartDetail,
    isSubmitting, setIsSubmitting, matrizFiltro, setMatrizFiltro,
    showAuditorIA, setShowAuditorIA, auditorInput, setAuditorInput,
    auditorRespuesta, setAuditorRespuesta, isAuditorThinking, setIsAuditorThinking,
    editRiesgo, setEditRiesgo, editPlan, setEditPlan, editEvaluacion, setEditEvaluacion,
    editHallazgo, setEditHallazgo, editIncidente, setEditIncidente, editCronograma, setEditCronograma,
    editApetito, setEditApetito, editMonitoreo, setEditMonitoreo, activeTooltip, setActiveTooltip,
    editInformeAuditoria, setEditInformeAuditoria, editComite, setEditComite, editPrograma, setEditPrograma
  } = ui;

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

const saveToCloud = async (partialData) => syncCloud(partialData, showNotification);

  const handleLogout = async () => { 
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      await signOut(auth);
      setUser(null); setIsAdmin(false); setShowWelcome(true); window.location.reload(); 
    } catch (e) { window.location.reload(); }
  };

  const handleDeleteItem = async (listType, id) => {
    if (!isAdmin || !window.confirm('¿Eliminar registro permanentemente?')) return;
    const mapLists = { 
      riesgos: [safeRiesgos, setRiesgos], evaluaciones: [safeEvaluaciones, setEvaluaciones], 
      hallazgos: [safeHallazgos, setHallazgos], planes: [safePlanes, setPlanes], 
      incidentes: [safeIncidentes, setIncidentes], cronograma: [safeCronograma, setCronograma], 
      monitoreo: [safeMonitoreo, setMonitoreo], informesAuditoria: [informesAuditoria, setInformesAuditoria], 
      comites: [safeComites, setComites], programas: [safeProgramas, setProgramas] 
    };
    const [targetList, setTarget] = mapLists[listType] || [];
    if (targetList && setTarget) {
      const updated = targetList.filter(item => item.id !== id);
      setTarget(updated);
      await saveToCloud({ [listType]: updated });
      showNotification("Registro eliminado.", "success");
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
      setAiModal, safeRiesgos, safeHallazgos, safePlanes, safeIncidentes, 
      safeCronograma, safeEvaluaciones, safeMonitoreo, informesAuditoria 
    });
    setAuditorInput('');
  };

  const handleExportExcel = (dataArray, fileName) => exportToExcel(dataArray, fileName, xlsxLoaded, showNotification);
  const handleExportJSON = () => exportToJSON({ riesgos: safeRiesgos, hallazgos: safeHallazgos, planes: safePlanes, incidentes: safeIncidentes, evaluaciones: safeEvaluaciones, cronograma: safeCronograma, monitoreo: safeMonitoreo });
  const handleImportJSON = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        if (window.confirm("⚠️ ALERTA: Sobrescribirá TODA la base de datos. ¿Continuar?")) {
          setIsCloudLoaded(false); await saveToCloud(JSON.parse(event.target.result));
          showNotification("Base de datos actualizada.", "success"); setIsCloudLoaded(true);
        }
      } catch (err) { showNotification("Error: Formato JSON no válido.", "error"); }
      e.target.value = null;
    };
    reader.readAsText(file);
  };

  const handleImportExcelRiesgos = (e) => processExcelRiesgos({ event: e, safeRiesgos, setRiesgos, saveToCloud, showNotification, setIsCloudLoaded, user });
  const forceUpdateCronograma = async () => { if (window.confirm("¿Deseas cargar los 20 procesos del Plan Anual?")) { await saveToCloud({ cronograma: defaultCronograma }); showNotification("¡Plan Anual actualizado!", "success"); } };
  const sugerirConIA = (tipoTarget) => sugerirTextoConIA(tipoTarget, setIsThinking, showNotification);
  const analizarEvidenciaIA = (evidenciaUrl, contextoItem, tipoItem) => analizarEvidenciaDocumento(evidenciaUrl, contextoItem, tipoItem, setIsThinking, showNotification, setAiModal);
  const ejecutarDespachoGmailApi = (emailParams) => enviarCorreoGmail(emailParams, user?.email, showNotification);

  const {
    handleRiesgoSubmit, handleHallazgoSubmit, handlePlanSubmit, handleAprobarCierrePlan,
    handleEvaluacionSubmit, handleComiteSubmit, handleIncidenteSubmit, handleCronogramaSubmit,
    handleApetitoSubmit, handleMonitoreoSubmit, handleInformeAuditoriaSubmit
  } = createFormHandlers({
    user, isAdmin, safeRiesgos, safeHallazgos, safePlanes, safeEvaluaciones, safeComites, safeIncidentes, safeCronograma, safeMonitoreo, informesAuditoria,
    editRiesgo, editHallazgo, editPlan, editEvaluacion, editComite, editIncidente, editCronograma, editApetito, editMonitoreo, editInformeAuditoria,
    setRiesgos, setHallazgos, setPlanes, setEvaluaciones, setComites, setIncidentes, setCronograma, setMonitoreo, setInformesAuditoria,
    setEditRiesgo, setEditHallazgo, setEditPlan, setEditEvaluacion, setEditComite, setEditIncidente, setEditCronograma, setEditApetito, setEditMonitoreo, setEditInformeAuditoria,
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
           {activeTab === 'dashboard_riesgos' && (
              <DashboardEjecutivo 
                rFiltrados={rFiltrados} riesgos={riesgos}
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
                setActiveTab={setActiveTab}
                setSelectedProcesoExpediente={setSelectedProcesoExpediente}
              />
            )}

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