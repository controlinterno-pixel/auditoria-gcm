// src/components/SidebarNavigation.jsx
import React from 'react';

export default function SidebarNavigation({
  isPresentationMode,
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
  pendingPlansCount,
  isAdmin,
  user,
  handleLogout
}) {
  return (
    <div 
      className={`w-[260px] text-[#a3c2e0] flex flex-col shadow-2xl z-20 border-r border-slate-800/50 ${isPresentationMode ? 'hidden' : 'flex'} relative`}
      style={{
        background: 'linear-gradient(180deg, #041428 0%, #010613 100%)'
      }}
    >
      {/* BRANDING LOGO */}
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

      {/* MENÚ ACORDEÓN */}
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
  );
}