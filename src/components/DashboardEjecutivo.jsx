import React, { useState } from 'react';
import { formatSafeDate } from '../utils/helpers';

// 🧹 Normalizador estricto para emparejar cadenas
const normalizeStr = (str) => {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") 
    .replace(/[^a-z0-9]/g, ""); 
};

// 📋 LISTA CON TODOS LOS PROCESOS REALES Y OFICIALES DE LA BASE DE DATOS
const PROCESOS_OFICIALES_CARDS = [
  { nombreOficial: "Gestión Administrativa y Financiera", icono: "🏢" },
  { nombreOficial: "Gestión de servicio al cliente", icono: "🎧" },
  { nombreOficial: "I+D+i", icono: "💻" },
  { nombreOficial: "Gestión de la cadena de abastecimiento", icono: "📦" },
  { nombreOficial: "Subproceso gestión ambiental", icono: "🌱" },
  { nombreOficial: "Gestión de talento humano", icono: "👥" },
  { nombreOficial: "Gestión de operaciones y servicios", icono: "⚙️" },
  { nombreOficial: "Gestión comercial y mercadeo", icono: "📈" }
];

const TrendChart = ({ data, title, isCurrency, color, fillColor, onPointClick }) => {
  const maxVal = Math.max(...data.map(d => d.valor), 1);
  const height = 120;
  const width = 600;
  const paddingY = 20;
  const paddingX = 20;

  const points = data.map((d, i) => {
    const x = paddingX + (i * (width - 2 * paddingX) / (data.length - 1 || 1));
    const y = height - paddingY - ((d.valor / maxVal) * (height - 2 * paddingY));
    return `${x},${y}`;
  }).join(' ');

  const fillPoints = `${paddingX},${height - paddingY} ${points} ${width - paddingX},${height - paddingY}`;

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-full relative group cursor-help">
       <div className="flex justify-between items-center mb-6">
         <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">{title}</h4>
         <span className="text-xl">{isCurrency ? '📉' : '📊'}</span>
       </div>
       <div className="relative w-full">
         <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto drop-shadow-sm overflow-visible" preserveAspectRatio="none">
           <polygon points={fillPoints} fill={fillColor} opacity="0.5" />
           <polyline points={points} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
           {data.map((d, i) => {
              const x = paddingX + (i * (width - 2 * paddingX) / (data.length - 1 || 1));
              const y = height - paddingY - ((d.valor / maxVal) * (height - 2 * paddingY));
              return (
                <g key={`point-${i}`} className="group/pt cursor-pointer" onClick={() => onPointClick && onPointClick(d)}>
                    <circle cx={x} cy={y} r="5" fill="white" stroke={color} strokeWidth="3" className="transition-all duration-200 group-hover/pt:r-[7px] group-hover/pt:fill-slate-800" />
                    <rect x={x - 35} y={y - 32} width="70" height="22" rx="6" fill="#1e293b" className="opacity-0 group-hover/pt:opacity-100 transition-opacity" pointerEvents="none" />
                    <text x={x} y={y - 17} fontSize="11" fill="white" textAnchor="middle" className="opacity-0 group-hover/pt:opacity-100 transition-opacity font-bold pointer-events-none notranslate" translate="no">
                       {isCurrency ? `$${(d.valor/1000000).toFixed(1)}M` : Math.round(d.valor)}
                    </text>
                </g>
              );
           })}
         </svg>
         <div className="flex justify-between mt-4 text-[9px] font-bold text-slate-400 uppercase px-2 border-t border-slate-100 pt-3">
            {data.map((d, idx) => <span key={`chart-mes-${idx}`} className="notranslate" translate="no">{d.mes.substring(0,3)}</span>)}
         </div>
       </div>

       <div className="absolute top-[105%] left-1/2 -translate-x-1/2 w-72 bg-[#0f172a]/95 backdrop-blur-md border border-slate-700/80 p-4 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0 text-left">
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#0f172a] border-t border-l border-slate-700/80 rotate-45"></div>
          <h4 className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2 border-b border-slate-700/80 pb-1.5">Contexto Financiero</h4>
          <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-300 font-medium">
            <p><b className="text-emerald-400 uppercase">📍 Origen:</b> Módulo Eventos de Pérdida.</p>
            <p><b className="text-amber-400 uppercase">❓ Por qué:</b> Cuantifica el impacto real monetario materializado.</p>
            <p><b className="text-slate-200 uppercase">📝 Explicación:</b> Sumatoria de costos operativos, dineros faltantes y sobrantes sin justificar.</p>
          </div>
       </div>
    </div>
  );
};

export default function DashboardEjecutivo({
  rFiltrados, riesgos, hFiltrados, hallazgos, pFiltrados, planes,
  cFiltrados, cronograma, informesAuditoria, safeIncidentes,
  matrizFiltro, setMatrizFiltro, setChartDetail, defaultMeses, defaultAnios,
  selectedAnios, selectedMeses, toggleAnio, toggleMes,
  setSelectedAnios, setSelectedMeses, setActiveTab, evalFiltrados,
  setSelectedProcesoExpediente
}) {
  const hoy = new Date();

  const [dictamenIA, setDictamenIA] = useState(null);
  const [procesandoIA, setProcesandoIA] = useState(false);

  const infoFinancieraLimpia = (defaultMeses || []).map((mText) => {
    if (!safeIncidentes || safeIncidentes.length === 0) return { mes: mText, valor: 0 };
    const totalCostoMes = safeIncidentes.filter(inc => {
      const anioInc = inc.fecha ? Number(inc.fecha.split('-')[0]) : Number(inc.anio);
      const mesIncText = inc.fecha ? defaultMeses[parseInt(inc.fecha.split('-')[1], 10) - 1] : (inc.mes || "Junio");
      const passAnio = selectedAnios.length === 0 || selectedAnios.includes(anioInc) || selectedAnios.includes(String(anioInc));
      return passAnio && mesIncText === mText;
    }).reduce((acc, current) => {
      const perdida = (Number(current.costo) || 0) + (Number(current.montoFaltante) || 0) + (Number(current.montoSobrante) || 0);
      return acc + perdida;
    }, 0);
    return { mes: mText, valor: totalCostoMes };
  });

  const riesgosBase = (riesgos || []).filter(r => {
    const anioR = Number(r.anio) || 2026;
    return selectedAnios.length === 0 || selectedAnios.includes(anioR) || selectedAnios.includes(String(anioR));
  });

  const hallazgosBase = typeof hFiltrados !== 'undefined' ? hFiltrados : (typeof hallazgos !== 'undefined' ? hallazgos : []);
  
  const planesBase = (planes || []).filter(p => {
    const anioPlan = p.fecha ? Number(p.fecha.split('-')[0]) : (Number(p.anio) || 2026);
    return selectedAnios.length === 0 || selectedAnios.includes(anioPlan) || selectedAnios.includes(String(anioPlan));
  });

  const extraerNumeroPuro = (valor) => {
    if (valor === undefined || valor === null || valor === '') return 0;
    if (typeof valor === 'number') {
      if (valor >= 1 && valor <= 5) return valor;
      if (valor === 20) return 1; if (valor === 40) return 2;
      if (valor === 60) return 3; if (valor === 80) return 4;
      if (valor === 100) return 5;
    }
    const str = String(valor).toLowerCase().trim();
    if (str === '20' || str === '20%') return 1;
    if (str === '40' || str === '40%') return 2;
    if (str === '60' || str === '60%') return 3;
    if (str === '80' || str === '80%') return 4;
    if (str === '100' || str === '100%') return 5;
    const num = parseInt(str.charAt(0), 10);
    if (!isNaN(num) && num >= 1 && num <= 5) return num;
    return 1; 
  };

  const totalPlanes = planesBase.length;
  const planesActivos = planesBase.filter(p => (Number(p.progreso) || 0) < 100).length;
  const planesVencidos = planesBase.filter(p => (Number(p.progreso) || 0) < 100 && p.fecha && new Date(p.fecha) < hoy).length;
  const planesCerrados = planesBase.filter(p => (Number(p.progreso) || 0) === 100).length;
  const avancePlanesGlobal = totalPlanes > 0 ? Math.round((planesCerrados / totalPlanes) * 100) : 0;

  const totalRiesgos = riesgosBase.length;
  let riesgosExtremos = 0; let riesgosAltos = 0; let riesgosModerados = 0; let riesgosBajos = 0;

  riesgosBase.forEach(r => {
    const p = extraerNumeroPuro(r.probabilidadResidual);
    const i = extraerNumeroPuro(r.impactoResidual);
    if (p >= 4 && i >= 4) { riesgosExtremos++; } 
    else if ((p >= 3 && i >= 4) || (p >= 4 && i >= 3)) { riesgosAltos++; } 
    else if ((p >= 2 && i >= 3) || (p >= 3 && i >= 2) || (p >= 2 && i >= 2)) { riesgosModerados++; } 
    else { riesgosBajos++; }
  });

  const evaluacionesBase = (evalFiltrados || []).filter(e => {
    const anioE = Number(e.anio) || 2026;
    return selectedAnios.length === 0 || selectedAnios.includes(anioE) || selectedAnios.includes(String(anioE));
  });
  const totalEvaluaciones = evaluacionesBase.length;
  const evaluacionesEficaces = evaluacionesBase.filter(e => Number(e.calificacion) === 100).length;
  const efectividadControlesGlobal = totalEvaluaciones > 0 ? Math.round((evaluacionesEficaces / totalEvaluaciones) * 100) : 0;

  const hallazgosAbiertos = hallazgosBase.filter(h => h.estado !== 'Cerrado').length; 
  const hallazgosCriticosCount = hallazgosBase.filter(h => h.estado !== 'Cerrado' && (h.severidad === 'Crítica' || h.severidad === 'Alta' || h.severidad === 'Crítico')).length;

  const contarRiesgosEnCelda = (p, i) => {
    return riesgosBase.filter(r => extraerNumeroPuro(r.probabilidadResidual) === p && extraerNumeroPuro(r.impactoResidual) === i).length;
  };

  const solicitarDictamenIA = (tipoCard) => {
    setProcesandoIA(true); setDictamenIA(null);
    setTimeout(() => {
      let analitica = { titulo: "Analítica GRC", dictamen: "Monitoreo en línea procesado correctamente." };
      setDictamenIA(analitica); setProcesandoIA(false);
    }, 400);
  };

  return (
    <div className="flex-1 bg-[#060b16] text-slate-100 overflow-y-auto p-6 font-sans space-y-6 scrollbar-thin select-none relative">
      
      {/* ENCABEZADO Y FILTROS */}
      <div className="bg-[#0a1122] border border-blue-500/10 p-5 rounded-2xl shadow-md space-y-4 mb-4 relative z-50">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800/80 pb-4 gap-4">
          <div>
            <h2 className="text-xl font-black text-white">Dashboard Ejecutivo</h2>
            <p className="text-xs text-slate-400 font-medium">Resumen general del Sistema de Control Interno y Gestión Integral del Riesgo</p>
          </div>
        </div>
      </div>

      {/* 🚀 CENTRO DE CONTROL POR PROCESOS */}
      <div className="mt-8 space-y-4 text-left border-t border-slate-800/80 pt-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-3 gap-2">
          <div>
            <h3 className="text-sm font-black tracking-widest uppercase text-white flex items-center gap-2">
              <span>🚀</span> Centro de Control por Procesos
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">
              Monitoreo en tiempo real. Haz clic en cualquier área para desplegar su Expediente Único 360°.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PROCESOS_OFICIALES_CARDS.map((proc, idx) => {
            const normTarget = normalizeStr(proc.nombreOficial);

            const hallazgosProc = (hallazgosBase || []).filter(h => {
              const normH = normalizeStr(h.proceso);
              return normH === normTarget || normH.includes(normTarget) || normTarget.includes(normH);
            });

            const abiertos = hallazgosProc.filter(h => h.estado === 'Abierto').length;
            const criticos = hallazgosProc.filter(h => h.estado === 'Abierto' && (h.severidad === 'Alta' || h.severidad === 'Crítica' || h.severidad === 'Crítico')).length;

            let semaforo = "border-emerald-500/30 hover:border-emerald-500 text-emerald-400";
            let badge = "🟢 Controlado";
            if (criticos > 0) {
              semaforo = "border-red-500/30 hover:border-red-500 text-red-400";
              badge = "🔴 Crítico";
            } else if (abiertos > 0) {
              semaforo = "border-amber-500/30 hover:border-amber-500 text-amber-400";
              badge = "🟡 En Atención";
            }

            return (
              <div
                key={idx}
                onClick={() => {
                  if (setSelectedProcesoExpediente) setSelectedProcesoExpediente(proc.nombreOficial);
                  if (setActiveTab) setActiveTab('tablero'); // 🎯 'tablero' es el ID real de Mi Espacio GRC
                }}
                className={`bg-[#0a1122] border ${semaforo} p-4 rounded-2xl cursor-pointer transition-all duration-300 hover:scale-[1.02] flex flex-col justify-between group shadow-lg`}
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center gap-2">
                    <h4 className="text-xs font-black text-white uppercase tracking-wider group-hover:text-blue-400 transition-colors flex items-center gap-1.5 truncate">
                      <span>{proc.icono}</span> <span className="truncate">{proc.nombreOficial}</span>
                    </h4>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded border border-current shrink-0">
                      {badge}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="bg-[#060b16] p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block font-bold">Hallazgos Abiertos</span>
                      <span className="text-sm font-black text-white">{abiertos}</span>
                    </div>
                    <div className="bg-[#060b16] p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block font-bold">Alertas Críticas</span>
                      <span className="text-sm font-black text-red-400">{criticos}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-blue-400 font-bold group-hover:translate-x-1 transition-transform">
                  <span>Abrir Expediente 360°</span>
                  <span>➔</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}