import React from 'react';

export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  user, 
  handleLogout, 
  dbConnected, 
  currentUserRole 
}) {
  const tabs = [
    { id: 'dashboard_tab', label: '📊 Dashboard' },
    { id: 'plan_anual_tab', label: '📅 Planificación' },
    { id: 'evaluaciones', label: '📝 Campo / Evaluaciones' },
    { id: 'resultados_tab', label: '📈 Resultados' },
    { id: 'planes_tab', label: '🎯 Planes de Acción' },
    { id: 'auditor_ia_tab', label: '🤖 Auditor IA' },
    { id: 'gobernanza_tab', label: '⚙️ Configuración' },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo y Status DB */}
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🛡️</span>
            <div>
              <h1 className="text-base font-black tracking-wider text-white">GCM AUDITOR <span className="text-blue-500 text-xs">v5</span></h1>
              <div className="flex items-center space-x-1.5">
                <span className={`w-2 h-2 rounded-full ${dbConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                  {dbConnected ? 'Cloud Sync Online' : 'Desconectado'}
                </span>
              </div>
            </div>
          </div>

          {/* Selector de Pestañas */}
          <nav className="hidden md:flex space-x-1 overflow-x-auto py-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Datos del Usuario y Logout */}
          <div className="flex items-center space-x-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-200">{user?.email}</p>
              <span className="inline-block px-2 py-0.5 text-[9px] font-black uppercase rounded bg-slate-800 text-blue-400 border border-slate-700">
                {currentUserRole || 'Usuario'}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="bg-slate-800 hover:bg-red-600/20 hover:text-red-400 text-slate-400 p-2 rounded-lg text-xs font-bold border border-slate-700 transition-colors"
              title="Cerrar Sesión"
            >
              🚪
            </button>
          </div>

        </div>
      </div>
    </header>
  );
}