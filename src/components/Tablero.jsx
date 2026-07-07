import React from 'react';

const Gauge = ({ value, label, sublabel, colorClass }) => {
  const safeValue = Math.min(Math.max(Math.round(Number(value) || 0), 0), 100);

  // 💡 Lógica interna para inyectar la explicación flotante exacta según el título del velocímetro
  let tooltipText = "";
  if (label === "MITIGACIÓN GLOBAL" || label === "PLANES DE ACCIÓN") {
    tooltipText = "📍 ORIGEN: Planes de Acción\n❓ POR QUÉ: Mide el esfuerzo de mitigación\n📝 EXPLICACIÓN: Promedio de avance físico y tareas correctivas en progreso o pendientes por el equipo.";
  } else if (label === "CONTROLES DE SALUD" || label === "SALUD DE CONTROLES") {
    tooltipText = "📍 ORIGEN: Auditoría de Controles\n❓ POR QUÉ: Indica la cobertura de nuestro aseguramiento\n📝 EXPLICACIÓN: Porcentaje de controles evaluados como eficaces frente al universo total evaluado.";
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

export default function Tablero({
  avanceGlobal,
  rendimientoControles,
  hAbiertos,
  hFiltrados,
  renderHeaderFiltros
}) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {renderHeaderFiltros("Tablero Analítico de Auditoría", "Análisis integral de desviaciones operativas.")}
      
      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">INDICADORES KRI EN TIEMPO REAL</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Gauge value={avanceGlobal} label="MITIGACIÓN GLOBAL" sublabel="Promedio Planes de Acción" colorClass="text-blue-500" />
        <Gauge value={rendimientoControles} label="CONTROLES DE SALUD" sublabel="Test Auditoría Exitosos" colorClass="text-emerald-500" />
        
        {/* RECUADRO: ALERTA CRÍTICA GENERAL */}
        <div 
          className="bg-[#0f172a] text-white p-6 rounded-2xl flex flex-col justify-center text-center shadow-lg border border-slate-800 hover:shadow-xl transition-shadow cursor-help"
          title={"📍 ORIGEN: Módulo de Hallazgos\n❓ POR QUÉ: Alerta sobre desviaciones pendientes de atención\n📝 EXPLICACIÓN: Cantidad total de hallazgos detectados que se encuentran actualmente abiertos y pendientes de un cierre definitivo."}
        >
          <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">ALERTA CRÍTICA</span>
          <span className="text-6xl font-black mt-4 notranslate" translate="no">{hAbiertos}</span>
          <p className="text-xs font-bold text-slate-300 mt-4">Hallazgos Pendientes de Cierre</p>
        </div>
      </div>

      <div className="space-y-4 mt-8">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">DESEMPEÑO POR UNIDAD DE NEGOCIO</h3>
        
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <h4 className="text-xl font-black text-slate-800 mb-6 border-b pb-2">Hotel</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* RECUADRO: HALLAZGOS ABIERTOS POR UNIDAD (HOTEL) */}
            <div 
              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow cursor-help"
              title={"📍 ORIGEN: Módulo de Hallazgos (Sede: Hotel)\n❓ POR QUÉ: Controla el foco de brechas específicas del área\n📝 EXPLICACIÓN: Total de desviaciones o no conformidades operacionales identificadas propiamente en la unidad de negocio Hotel."}
            >
              <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">HALLAZGOS ABIERTOS</span>
              <span className="text-5xl font-black mt-4 text-slate-800 notranslate" translate="no">
                {hFiltrados.filter(h => h.sede === 'Hotel' && h.estado === 'Abierto').length}
              </span>
              <p className="text-[10px] font-bold mt-4 opacity-60 text-slate-500">Pendientes de Cierre</p>
            </div>

            <Gauge value={rendimientoControles} label="SALUD DE CONTROLES" sublabel="Test Auditoría Exitosos" colorClass="text-emerald-500" />
            <Gauge value={avanceGlobal} label="PLANES DE ACCIÓN" sublabel="Promedio de Avance Físico" colorClass="text-blue-500" />
          </div>
        </div>
      </div>
    </div>
  );
}