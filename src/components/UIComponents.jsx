import React from 'react';

export const ProgressBar = ({ progress }) => {
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

export const Gauge = ({ value, label, sublabel, colorClass }) => {
  const safeValue = Math.min(Math.max(Math.round(Number(value) || 0), 0), 100);
  
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

export const FilterInput = ({ colKey, placeholder, dark, columnFilters, handleColFilterChange }) => (
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

export const StepIndicatorHUD = ({ activeStep }) => {
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
export const HeaderFiltros = ({ titulo, subtitulo, defaultAnios, defaultMeses, selectedAnios, selectedMeses, toggleAnio, toggleMes, setSelectedAnios, setSelectedMeses }) => (
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