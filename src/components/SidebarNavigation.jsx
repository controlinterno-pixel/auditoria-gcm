// src/components/SidebarNavigation.jsx

export default function SidebarNavigation({
  isPresentationMode,
  isCollapsed,
  toggleSidebar,
  menuAbierto,
  setMenuAbierto,
  activeTab,
  setActiveTab,
  subTabPlanificar,
  setSubTabPlanificar,
  subTabResultados,
  setSubTabResultados,
  subTabPlanes,
  setSubTabPlanes,
  subTabGobernanza,
  setSubTabGobernanza,
  misTareasEjecucion = 0,
  misTareasRevision = 0,
  misTareasAprobacion = 0,
 onSelectExecutionTasks = () => {},
  onSelectRevisionTasks = () => {},
  onSelectAprobacionTasks = () => {},
  isAdmin,
  puedeVerFuentesMejora = false,
  user,
  handleLogout
}) {
  
  // 🔔 CÁLCULO DE ALERTAS INTELIGENTES PARA EL MENÚ
  const totalMisTareas = misTareasEjecucion + misTareasRevision + misTareasAprobacion;
  const tieneAlertas = totalMisTareas > 0;
  
  const colorAlerta = misTareasEjecucion > 0 ? 'bg-rose-500' : 'bg-amber-500';
  return (
    <div 
      className={`text-[#a3c2e0] flex flex-col shadow-[10px_0_20px_rgba(0,0,0,0.15)] z-50 border-r border-slate-800/80 ${isPresentationMode ? 'hidden' : 'flex'} relative transition-all duration-300 ease-in-out overflow-visible ${isCollapsed ? 'w-[80px]' : 'w-[260px]'}`}
      style={{ background: 'linear-gradient(180deg, #041428 0%, #010613 100%)' }}
    >
      {/* 🔘 BOTÓN FLOTANTE COLLAPSE (Centrado con matemática perfecta) */}
      <button
        onClick={toggleSidebar}
        className="absolute right-0 translate-x-1/2 top-8 w-6 h-6 bg-[#0055ff] border-[3px] border-[#010613] rounded-full flex items-center justify-center text-white shadow-xl cursor-pointer hover:scale-110 hover:bg-[#0077ff] transition-all z-[100] group"
      >
        <svg className={`w-3 h-3 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
        </svg>
        <div className="absolute left-8 bg-[#0055ff] text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap shadow-md">
          {isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
        </div>
      </button>

      {/* BRANDING LOGO */}
      <div 
        className="px-4 py-6 flex items-center gap-2.5 border-b border-[#0066ff1a] shrink-0 shadow-[0_4px_20px_rgba(0,102,255,0.05)] overflow-hidden"
        style={{ background: 'radial-gradient(circle at 50% 50%, rgba(0, 102, 255, 0.15) 0%, transparent 70%)' }}
      >
        {/* Isotipo de Escudo con resplandor (Glow) */}
        <div className="relative flex items-center justify-center shrink-0">
          {/* Efecto de luz de fondo */}
          <div className="absolute -inset-1 rounded-full bg-cyan-500/20 blur-md"></div>
          <svg 
            className="relative w-8 h-8 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]" 
            viewBox="0 0 24 24" 
            fill="currentColor"
          >
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
          </svg>
        </div>

        {/* Texto Principal y Subtítulo dinámico */}
        <div className={`flex flex-col justify-center transition-all duration-300 whitespace-nowrap ${isCollapsed ? 'w-0 opacity-0 overflow-hidden hidden' : 'w-auto opacity-100'}`}>
          <div className="flex items-baseline gap-1.5 leading-none">
            <span className="text-lg font-black text-white tracking-tight drop-shadow-md">GCM</span>
            <span className="text-sm font-normal text-cyan-300/90 tracking-wide">ENTERPRISE</span>
          </div>
          <span className="text-[7px] font-bold text-[#6b96c3] tracking-widest uppercase mt-1">
            GOVERNANCE • COMPLIANCE • MANAGEMENT
          </span>
        </div>
      </div>

     {/* MENÚ ACORDEÓN */}
      <nav className="flex-1 px-4 py-4 space-y-1 text-sm font-medium overflow-y-auto custom-scrollbar relative z-10">

        {/* 1. INICIO */}
        <div className="flex flex-col">
          <button 
            onClick={() => {
              setMenuAbierto(menuAbierto === 'inicio' ? null : 'inicio');
              if (menuAbierto !== 'inicio') setActiveTab('tablero');
            }} 
            className={`flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all duration-200 ${(activeTab === 'tablero' || activeTab === 'dashboard_riesgos') ? 'bg-gradient-to-r from-[#0055ff] to-[#0077ff] text-white shadow-[0_4px_15px_rgba(0,85,255,0.3)]' : 'hover:bg-slate-800/60 text-[#a3c2e0] hover:text-white'}`}>
            <div className="flex items-center gap-3 group relative">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              <span className={`font-bold transition-all duration-300 whitespace-nowrap ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'}`}>Inicio</span>
              {isCollapsed && <div className="absolute left-10 bg-[#0055ff] text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible z-50 shadow-md">Inicio</div>}
            </div>
            {!isCollapsed && <svg className={`w-4 h-4 shrink-0 transition-transform duration-300 ${menuAbierto === 'inicio' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>}
          </button>
          <div className={`overflow-hidden transition-all duration-300 pl-11 ${menuAbierto === 'inicio' && !isCollapsed ? 'max-h-40 opacity-100 mt-1 mb-2' : 'max-h-0 opacity-0'}`}>
            <div className="flex flex-col border-l-2 border-slate-800/80 space-y-1 py-1">
              <button onClick={() => setActiveTab('tablero')} className={`text-left pl-4 py-2 text-xs font-semibold rounded-r-lg ${activeTab === 'tablero' ? 'text-white bg-slate-800/40 border-l-2 border-[#0055ff] -ml-[2px]' : 'text-[#6b96c3] hover:text-white hover:bg-slate-800/30'}`}>Mi Espacio GRC</button>
              <button onClick={() => setActiveTab('dashboard_riesgos')} className={`text-left pl-4 py-2 text-xs font-semibold rounded-r-lg ${activeTab === 'dashboard_riesgos' ? 'text-white bg-slate-800/40 border-l-2 border-[#0055ff] -ml-[2px]' : 'text-[#6b96c3] hover:text-white hover:bg-slate-800/30'}`}>GRC Dashboard</button>
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
            <div className="flex items-center gap-3 group relative">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
              <span className={`font-bold transition-all duration-300 whitespace-nowrap ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'}`}>Auditorías</span>
              {isCollapsed && <div className="absolute left-10 bg-[#0055ff] text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible z-50 shadow-md">Auditorías</div>}
            </div>
            {!isCollapsed && <svg className={`w-4 h-4 shrink-0 transition-transform duration-300 ${menuAbierto === 'auditorias' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>}
          </button>
          <div className={`overflow-hidden transition-all duration-300 pl-11 ${menuAbierto === 'auditorias' && !isCollapsed ? 'max-h-40 opacity-100 mt-1 mb-2' : 'max-h-0 opacity-0'}`}>
            <div className="flex flex-col border-l-2 border-slate-800/80 space-y-1 py-1">
              <button onClick={() => { setActiveTab('plan_anual_tab'); setSubTabPlanificar('plan_anual'); }} className={`text-left pl-4 py-2 text-xs font-semibold rounded-r-lg ${activeTab === 'plan_anual_tab' && subTabPlanificar === 'plan_anual' ? 'text-white bg-slate-800/40 border-l-2 border-[#0055ff] -ml-[2px]' : 'text-[#6b96c3] hover:text-white hover:bg-slate-800/30'}`}>Cronograma Anual</button>
              <button onClick={() => { setActiveTab('plan_anual_tab'); setSubTabPlanificar('programas'); }} className={`text-left pl-4 py-2 text-xs font-semibold rounded-r-lg ${activeTab === 'plan_anual_tab' && subTabPlanificar === 'programas' ? 'text-white bg-slate-800/40 border-l-2 border-[#0055ff] -ml-[2px]' : 'text-[#6b96c3] hover:text-white hover:bg-slate-800/30'}`}>Programas de Auditoría</button>
              {isAdmin && <button onClick={() => setActiveTab('evaluaciones')} className={`text-left pl-4 py-2 text-xs font-semibold rounded-r-lg ${activeTab === 'evaluaciones' ? 'text-white bg-slate-800/40 border-l-2 border-[#0055ff] -ml-[2px]' : 'text-[#6b96c3] hover:text-white hover:bg-slate-800/30'}`}>Trabajo de Campo</button>}
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
            <div className="flex items-center gap-3 group relative">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <span className={`font-bold transition-all duration-300 whitespace-nowrap ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'}`}>Riesgos</span>
              {isCollapsed && <div className="absolute left-10 bg-[#0055ff] text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible z-50 shadow-md">Riesgos</div>}
            </div>
            {!isCollapsed && <svg className={`w-4 h-4 shrink-0 transition-transform duration-300 ${menuAbierto === 'riesgos' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>}
          </button>
          <div className={`overflow-hidden transition-all duration-300 pl-11 ${menuAbierto === 'riesgos' && !isCollapsed ? 'max-h-40 opacity-100 mt-1 mb-2' : 'max-h-0 opacity-0'}`}>
            <div className="flex flex-col border-l-2 border-slate-800/80 space-y-1 py-1">
              <button onClick={() => { setActiveTab('plan_anual_tab'); setSubTabPlanificar('riesgos'); }} className={`text-left pl-4 py-2 text-xs font-semibold rounded-r-lg ${activeTab === 'plan_anual_tab' && subTabPlanificar === 'riesgos' ? 'text-white bg-slate-800/40 border-l-2 border-[#0055ff] -ml-[2px]' : 'text-[#6b96c3] hover:text-white hover:bg-slate-800/30'}`}>Matriz de Riesgos</button>
              <button onClick={() => { setActiveTab('plan_anual_tab'); setSubTabPlanificar('apetito'); }} className={`text-left pl-4 py-2 text-xs font-semibold rounded-r-lg ${activeTab === 'plan_anual_tab' && subTabPlanificar === 'apetito' ? 'text-white bg-slate-800/40 border-l-2 border-[#0055ff] -ml-[2px]' : 'text-[#6b96c3] hover:text-white hover:bg-slate-800/30'}`}>Apetito de Riesgo</button>
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
            <div className="flex items-center gap-3 group relative">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              <span className={`font-bold transition-all duration-300 whitespace-nowrap ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'}`}>Informes y Hallazgos</span>
              {isCollapsed && <div className="absolute left-10 bg-[#0055ff] text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible z-50 shadow-md whitespace-nowrap">Informes y Hallazgos</div>}
            </div>
            {!isCollapsed && <svg className={`w-4 h-4 shrink-0 transition-transform duration-300 ${menuAbierto === 'hallazgos' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>}
          </button>
         <div className={`overflow-hidden transition-all duration-300 pl-11 ${menuAbierto === 'hallazgos' && !isCollapsed ? 'max-h-80 opacity-100 mt-1 mb-2' : 'max-h-0 opacity-0'}`}>
            <div className="flex flex-col border-l-2 border-slate-800/80 space-y-1 py-1">
              {/* ✨ Permiso de visualización abierto. La seguridad de datos se controla desde el Backend (RLS) */}
              <button onClick={() => { setActiveTab('resultados_tab'); setSubTabResultados('informes'); }} className={`text-left pl-4 py-2 text-xs font-semibold rounded-r-lg ${activeTab === 'resultados_tab' && subTabResultados === 'informes' ? 'text-white bg-slate-800/40 border-l-2 border-[#0055ff] -ml-[2px]' : 'text-[#6b96c3] hover:text-white hover:bg-slate-800/30'}`}>Informes Emitidos</button>
              
              {/* Este botón sí se queda solo para el Administrador */}
              {(isAdmin || puedeVerFuentesMejora) && <button onClick={() => { setActiveTab('resultados_tab'); setSubTabResultados('fuentes_mejora'); }} className={`text-left pl-4 py-2 text-xs font-semibold rounded-r-lg ${activeTab === 'resultados_tab' && subTabResultados === 'fuentes_mejora' ? 'text-white bg-slate-800/40 border-l-2 border-[#0055ff] -ml-[2px]' : 'text-[#6b96c3] hover:text-white hover:bg-slate-800/30'}`}>Fuente de mejora</button>}

              <button onClick={() => { setActiveTab('resultados_tab'); setSubTabResultados('hallazgos'); }} className={`text-left pl-4 py-2 text-xs font-semibold rounded-r-lg ${activeTab === 'resultados_tab' && subTabResultados === 'hallazgos' ? 'text-white bg-slate-800/40 border-l-2 border-[#0055ff] -ml-[2px]' : 'text-[#6b96c3] hover:text-white hover:bg-slate-800/30'}`}>Hallazgos Registrados</button>
              {isAdmin && <button onClick={() => { setActiveTab('resultados_tab'); setSubTabResultados('cargos_procesos'); }} className={`text-left pl-4 py-2 text-xs font-semibold rounded-r-lg ${activeTab === 'resultados_tab' && subTabResultados === 'cargos_procesos' ? 'text-white bg-slate-800/40 border-l-2 border-[#0055ff] -ml-[2px]' : 'text-[#6b96c3] hover:text-white hover:bg-slate-800/30'}`}>Cargos y Procesos</button>}
              <button onClick={() => { setActiveTab('planes_tab'); setSubTabPlanes('incidentes'); }} className={`text-left pl-4 py-2 text-xs font-semibold rounded-r-lg ${activeTab === 'planes_tab' && subTabPlanes === 'incidentes' ? 'text-white bg-slate-800/40 border-l-2 border-[#0055ff] -ml-[2px]' : 'text-[#6b96c3] hover:text-white hover:bg-slate-800/30'}`}>Eventos de Pérdida</button>
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
            <div className="flex items-center gap-3 group relative">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className={`font-bold transition-all duration-300 whitespace-nowrap ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'}`}>Planes de Acción</span>
              
              {/* Tooltip cuando está colapsado */}
              {isCollapsed && <div className="absolute left-10 bg-[#0055ff] text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible z-50 shadow-md whitespace-nowrap">Planes de Acción</div>}
              
              {/* ALERTA TITILANTE COLAPSADA */}
              {isCollapsed && tieneAlertas && (
                <span className={`absolute -top-1 -right-1 ${colorAlerta} text-white text-[8px] font-black px-1 rounded-full animate-pulse ring-2 ring-slate-900 shadow-md`}>
                  {totalMisTareas}
                </span>
              )}
            </div>
            
            {/* ALERTA TITILANTE EXPANDIDA */}
            {!isCollapsed && (
              <div className="flex items-center gap-2 shrink-0">
                {tieneAlertas && (
                  <span className={`${colorAlerta} text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-md animate-pulse border border-white/20`}>
                    {totalMisTareas}
                  </span>
                )}
                <svg className={`w-4 h-4 transition-transform duration-300 ${menuAbierto === 'planes' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            )}
          </button>

          {/* SUB-MENÚ DE PLANES DE ACCIÓN (Desglosado para mayor claridad) */}
          <div className={`overflow-hidden transition-all duration-300 pl-11 ${menuAbierto === 'planes' && !isCollapsed ? 'max-h-40 opacity-100 mt-1 mb-2' : 'max-h-0 opacity-0'}`}>
            <div className="flex flex-col border-l-2 border-slate-800/80 space-y-1 py-1">
              <button 
                onClick={() => { setActiveTab('planes_tab'); setSubTabPlanes('planes'); }} 
                className={`text-left pl-4 py-2 text-xs font-semibold rounded-r-lg flex flex-col justify-center ${activeTab === 'planes_tab' && subTabPlanes === 'planes' ? 'text-white bg-slate-800/40 border-l-2 border-[#0055ff] -ml-[2px]' : 'text-[#6b96c3] hover:text-white hover:bg-slate-800/30'}`}
              >
                <span>Gestión de Planes</span>
              </button>
              {!isCollapsed && misTareasEjecucion > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('planes_tab');
                    setSubTabPlanes('planes');
                    onSelectExecutionTasks();
                  }}
                  className="group relative isolate ml-4 flex items-center justify-between gap-2 rounded-lg border border-rose-300/40 bg-rose-500/10 px-3 py-1.5 text-[10px] font-extrabold text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.2)] transition-all duration-300 hover:-translate-y-0.5 hover:border-rose-300 hover:bg-rose-500/20 hover:text-rose-100 hover:shadow-[0_0_18px_rgba(244,63,94,0.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-300"
                  aria-label={`Mostrar ${misTareasEjecucion} planes pendientes de ejecutar`}
                >
                  <span aria-hidden="true" className="absolute -inset-1 -z-10 rounded-xl bg-rose-400/15 blur-md animate-pulse" />
                  <span className="flex items-center gap-2"><span aria-hidden="true" className="text-sm transition-transform duration-300 group-hover:scale-110">▶</span>Ejecutar</span>
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-black text-white shadow-sm">{misTareasEjecucion}</span>
                </button>
              )}
              {!isCollapsed && (misTareasRevision > 0 || misTareasAprobacion > 0) && (
                <div className="ml-4 flex flex-wrap items-center gap-2 px-3 text-[10px] font-bold text-amber-400">
                  {misTareasRevision > 0 && (
                    <button 
                      type="button" 
                      onClick={() => {
                        setActiveTab('planes_tab');
                        setSubTabPlanes('planes');
                        onSelectRevisionTasks();
                      }}
                      className="group relative isolate flex items-center gap-2 rounded-lg border border-amber-300/40 bg-amber-400/10 px-3 py-1.5 font-extrabold text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.18)] transition-all duration-300 hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-400/20 hover:text-amber-100 hover:shadow-[0_0_18px_rgba(251,191,36,0.38)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
                    >
                      <span aria-hidden="true" className="absolute -inset-1 -z-10 rounded-xl bg-amber-300/15 blur-md animate-pulse" />
                      <span aria-hidden="true" className="text-sm transition-transform duration-300 group-hover:scale-110">👀</span>
                      <span>Revisar</span>
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[10px] font-black text-slate-950 shadow-sm">{misTareasRevision}</span>
                    </button>
                  )}
                  {misTareasAprobacion > 0 && (
                    <button 
                      type="button" 
                      onClick={() => {
                        setActiveTab('planes_tab');
                        setSubTabPlanes('planes');
                        onSelectAprobacionTasks();
                      }}
                      className="hover:underline hover:text-emerald-500 cursor-pointer transition-all"
                    >
                      ✓ Aprobar: {misTareasAprobacion}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 6. GOBERNANZA E INTELIGENCIA */}
        {isAdmin && (
          <div className="flex flex-col">
            <button 
              onClick={() => { 
                setMenuAbierto(menuAbierto === 'gobernanza' ? null : 'gobernanza');
                if (menuAbierto !== 'gobernanza') { setActiveTab('gobernanza_tab'); setSubTabGobernanza('comites'); }
              }} 
              className={`flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'gobernanza_tab' ? 'bg-gradient-to-r from-[#0055ff] to-[#0077ff] text-white shadow-[0_4px_15px_rgba(0,85,255,0.3)]' : 'hover:bg-slate-800/60 text-[#a3c2e0] hover:text-white'}`}>
              <div className="flex items-center gap-3 group relative">
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                <span className={`font-bold transition-all duration-300 whitespace-nowrap ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'}`}>Gobernanza & IA</span>
                {isCollapsed && <div className="absolute left-10 bg-[#0055ff] text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible z-50 shadow-md whitespace-nowrap">Gobernanza & IA</div>}
              </div>
              {!isCollapsed && <svg className={`w-4 h-4 shrink-0 transition-transform duration-300 ${menuAbierto === 'gobernanza' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>}
            </button>
            <div className={`overflow-hidden transition-all duration-300 pl-11 ${menuAbierto === 'gobernanza' && !isCollapsed ? 'max-h-40 opacity-100 mt-1 mb-2' : 'max-h-0 opacity-0'}`}>
              <div className="flex flex-col border-l-2 border-slate-800/80 space-y-1 py-1">
                <button onClick={() => { setActiveTab('gobernanza_tab'); setSubTabGobernanza('comites'); }} className={`text-left pl-4 py-2 text-xs font-semibold rounded-r-lg ${activeTab === 'gobernanza_tab' && subTabGobernanza === 'comites' ? 'text-white bg-slate-800/40 border-l-2 border-[#0055ff] -ml-[2px]' : 'text-[#6b96c3] hover:text-white hover:bg-slate-800/30'}`}>Sesiones de Comité</button>
                <button onClick={() => { setActiveTab('gobernanza_tab'); setSubTabGobernanza('trazabilidad'); }} className={`text-left pl-4 py-2 text-xs font-semibold rounded-r-lg ${activeTab === 'gobernanza_tab' && subTabGobernanza === 'trazabilidad' ? 'text-white bg-slate-800/40 border-l-2 border-[#0055ff] -ml-[2px]' : 'text-[#6b96c3] hover:text-white hover:bg-slate-800/30'}`}>Bitácora Trazabilidad</button>
                <button onClick={() => { setActiveTab('gobernanza_tab'); setSubTabGobernanza('auditoria_auto'); }} className={`text-left pl-4 py-2 text-xs font-semibold rounded-r-lg ${activeTab === 'gobernanza_tab' && subTabGobernanza === 'auditoria_auto' ? 'text-white bg-slate-800/40 border-l-2 border-[#0055ff] -ml-[2px]' : 'text-[#6b96c3] hover:text-white hover:bg-slate-800/30'}`}>Auditoría Automatizada</button>
              </div>
            </div>
          </div>
        )}

        {/* 7. CONFIGURACIÓN */}
        {isAdmin && (
          <div className="flex flex-col pt-2 border-t border-slate-800/50 mt-2">
            <button onClick={() => setActiveTab('config')} className={`flex items-center gap-3 group relative w-full px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'config' ? 'bg-gradient-to-r from-[#0055ff] to-[#0077ff] text-white shadow-[0_4px_15px_rgba(0,85,255,0.3)]' : 'hover:bg-slate-800/60 text-[#a3c2e0] hover:text-white'}`}>
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <span className={`font-bold transition-all duration-300 whitespace-nowrap ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'}`}>Configuración</span>
              {isCollapsed && <div className="absolute left-10 bg-[#0055ff] text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible z-50 shadow-md">Configuración</div>}
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
          
          <div 
            className="flex items-center gap-3 cursor-pointer group relative"
            onClick={() => setActiveTab('mi_perfil')}
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0055ff] to-[#00aaff] flex items-center justify-center text-white font-black text-lg shadow-[0_0_15px_rgba(0,102,255,0.4)] shrink-0 overflow-hidden ring-2 ring-transparent group-hover:ring-[#0055ff] transition-all">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Perfil" className="w-full h-full object-cover" />
              ) : (
                user?.displayName ? user.displayName.charAt(0).toUpperCase() : (user?.email ? user.email.charAt(0).toUpperCase() : 'U')
              )}
            </div>
            <div className={`flex-1 transition-all duration-300 overflow-hidden whitespace-nowrap ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'}`}>
              <h4 className="text-xs font-bold text-white truncate group-hover:text-[#a3c2e0] transition-colors drop-shadow-sm">
                {user?.displayName || user?.email?.split('@')[0] || 'Usuario'}
              </h4>
              <p className="text-[9px] font-semibold text-[#00aaff] uppercase tracking-widest mt-0.5">
                {isAdmin ? 'Auditor Líder' : 'Gestor'}
              </p>
            </div>
            {isCollapsed && <div className="absolute left-12 bg-[#0055ff] text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible z-50 shadow-md whitespace-nowrap">Ir a mi perfil</div>}
          </div>

          <div className={`h-[1px] w-full bg-slate-800/80 transition-opacity duration-300 ${isCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`} />
          
          <div className={`flex flex-col gap-1 transition-all duration-300 ${isCollapsed ? 'opacity-0 hidden w-0 h-0 m-0' : 'opacity-100 w-auto h-auto'}`}>
            <button 
              onClick={() => setActiveTab('mi_perfil')} 
              className="flex items-center justify-between text-[11px] font-bold text-[#a3c2e0] hover:text-white hover:bg-slate-800/60 transition-colors px-2 py-1.5 rounded-lg w-full whitespace-nowrap"
            >
              <span>⚙️ Configurar Perfil</span>
            </button>
            <button 
              onClick={handleLogout} 
              className="flex items-center justify-between text-[11px] font-bold text-[#a3c2e0] hover:text-rose-400 hover:bg-rose-950/30 transition-colors px-2 py-1.5 rounded-lg w-full whitespace-nowrap"
            >
              <span>Cerrar Sesión</span>
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}