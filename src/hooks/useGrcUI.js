// src/hooks/useGrcUI.js
import { useState, useEffect } from 'react';

export function useGrcUI() {
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [oobCode, setOobCode] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const code = params.get('oobCode');
    if (mode === 'resetPassword' && code) {
      setIsResettingPassword(true);
      setOobCode(code);
    }
  }, []);

  const [activeTab, setActiveTab] = useState('tablero');
  const [menuAbierto, setMenuAbierto] = useState('inicio');
  const [subTabPlanificar, setSubTabPlanificar] = useState('plan_anual');
  const [subTabResultados, setSubTabResultados] = useState('hallazgos');
  const [subTabPlanes, setSubTabPlanes] = useState('planes');
  const [subTabGobernanza, setSubTabGobernanza] = useState('comites');
  const [selectedProcesoExpediente, setSelectedProcesoExpediente] = useState('');

  const [notification, setNotification] = useState(null);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [formResetKey, setFormResetKey] = useState(Date.now());
  const [searchTerm, setSearchTerm] = useState('');
  const [columnFilters, setColumnFilters] = useState({});

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

  useEffect(() => {
    const tema = localStorage.getItem('temaApp') || 'calido';
    document.documentElement.classList.remove('dark', 'warm');
    if (tema === 'oscuro') document.documentElement.classList.add('dark');
    if (tema === 'calido') document.documentElement.classList.add('warm');
  }, [activeTab]);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  return {
    isResettingPassword, oobCode,
    activeTab, setActiveTab,
    menuAbierto, setMenuAbierto,
    subTabPlanificar, setSubTabPlanificar,
    subTabResultados, setSubTabResultados,
    subTabPlanes, setSubTabPlanes,
    subTabGobernanza, setSubTabGobernanza,
    selectedProcesoExpediente, setSelectedProcesoExpediente,
    notification, showNotification,
    isPresentationMode, setIsPresentationMode,
    formResetKey, setFormResetKey,
    searchTerm, setSearchTerm,
    columnFilters, setColumnFilters,
    xlsxLoaded, isThinking, setIsThinking,
    aiModal, setAiModal,
    chartDetail, setChartDetail,
    isSubmitting, setIsSubmitting,
    matrizFiltro, setMatrizFiltro,
    showAuditorIA, setShowAuditorIA,
    auditorInput, setAuditorInput,
    auditorRespuesta, setAuditorRespuesta,
    isAuditorThinking, setIsAuditorThinking,
    editRiesgo, setEditRiesgo,
    editPlan, setEditPlan,
    editEvaluacion, setEditEvaluacion,
    editHallazgo, setEditHallazgo,
    editIncidente, setEditIncidente,
    editCronograma, setEditCronograma,
    editApetito, setEditApetito,
    editMonitoreo, setEditMonitoreo,
    activeTooltip, setActiveTooltip,
    editInformeAuditoria, setEditInformeAuditoria,
    editComite, setEditComite,
    editPrograma, setEditPrograma
  };
}