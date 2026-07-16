import React, { useState } from 'react';
import { formatSafeDate, getItemAnio, getItemMesText } from '../utils/helpers';

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
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-full">
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
                <g key={`point-${i}`} className="group cursor-pointer" onClick={() => onPointClick && onPointClick(d)}>
                    <circle cx={x} cy={y} r="5" fill="white" stroke={color} strokeWidth="3" className="transition-all duration-200 group-hover:r-[7px] group-hover:fill-slate-800" />
                    <rect x={x - 35} y={y - 32} width="70" height="22" rx="6" fill="#1e293b" className="opacity-0 group-hover:opacity-100 transition-opacity" pointerEvents="none" />
                    <text x={x} y={y - 17} fontSize="11" fill="white" textAnchor="middle" className="opacity-0 group-hover:opacity-100 transition-opacity font-bold pointer-events-none notranslate" translate="no">
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
    </div>
  );
};

export default function DashboardEjecutivo({
  rFiltrados, riesgos, hFiltrados, hallazgos, pFiltrados, planes,
  cFiltrados, cronograma, informesAuditoria, safeIncidentes,
  matrizFiltro, setMatrizFiltro, setChartDetail, defaultMeses, defaultAnios,
  selectedAnios, selectedMeses, toggleAnio, toggleMes,
  setSelectedAnios, setSelectedMeses, setActiveTab, evalFiltrados
}) {
  const hoy = new Date();

  // 🤖 ESTADOS PARA EL CAPTURADOR INTELIGENTE DE DICTÁMENES
  const [dictamenIA, setDictamenIA] = useState(null);
  const [procesandoIA, setProcesandoIA] = useState(false);

  // 📊 CÁLCULO SEGURO Y AISLADO DE LA EVOLUCIÓN FINANCIERA MULTI-CAMPOS
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

  // 🧠 FILTRADO EXACTO DE RIESGOS POR AÑO
  const riesgosBase = (riesgos || []).filter(r => {
    const anioR = Number(r.anio) || 2026;
    return selectedAnios.length === 0 || selectedAnios.includes(anioR) || selectedAnios.includes(String(anioR));
  });

  const hallazgosBase = typeof hFiltrados !== 'undefined' ? hFiltrados : (typeof hallazgos !== 'undefined' ? hallazgos : []);
  
  // 🧠 FILTRADO EXACTO DE PLANES POR AÑO
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
    if (str === '0' || str === '0%') return 1;
    const num = parseInt(str.charAt(0), 10);
    if (!isNaN(num) && num >= 1 && num <= 5) return num;
    if (str.includes('rara') || str.includes('baja')) return 1;
    if (str.includes('improbable')) return 2;
    if (str.includes('posible') || str.includes('media')) return 3;
    if (str.includes('probable') || str.includes('alta')) return 4;
    if (str.includes('casi seguro')) return 5;
    if (str.includes('insignificante') || str.includes('leve')) return 1;
    if (str.includes('menor')) return 2;
    if (str.includes('moderado') || str.includes('medio')) return 3;
    if (str.includes('mayor') || str.includes('alto')) return 4;
    if (str.includes('catastrófico') || str.includes('crítico')) return 5;
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

  const totalHallazgos = hallazgosBase.length;
  const hallazgosAbiertos = hallazgosBase.filter(h => h.estado !== 'Cerrado').length; 
  const hallazgosCriticosCount = hallazgosBase.filter(h => h.estado !== 'Cerrado' && (h.severidad === 'Crítica' || h.severidad === 'Alta' || h.severidad === 'Crítico')).length;

  const contarRiesgosEnCelda = (p, i) => {
    return riesgosBase.filter(r => extraerNumeroPuro(r.probabilidadResidual) === p && extraerNumeroPuro(r.impactoResidual) === i).length;
  };

  const riesgosFiltradosPorMatriz = matrizFiltro 
    ? riesgosBase.filter(r => extraerNumeroPuro(r.probabilidadResidual) === matrizFiltro.p && extraerNumeroPuro(r.impactoResidual) === matrizFiltro.i)
    : riesgosBase.slice(0, 5);

  const planesVencidosList = planesBase
    .filter(p => (Number(p.progreso) || 0) < 100 && p.fecha && new Date(p.fecha) < hoy)
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
    .slice(0, 5);

  const cronogramaBase = typeof cFiltrados !== 'undefined' ? cFiltrados : (typeof cronograma !== 'undefined' ? cronograma : []);
  const proximasAuditorias = cronogramaBase.filter(c => (Number(c.cumplimiento) || 0) < 100).slice(0, 4);

  const solicitarDictamenIA = (tipoCard) => {
    setProcesandoIA(true); setDictamenIA(null);
    setTimeout(() => {
      let analitica = {};
      if (tipoCard === 'cumplimiento') {
        analitica = { titulo: "Cumplimiento Global de Compromisos", valor: `${avancePlanesGlobal}%`, significado: "Mide el avance y cierre formal de los planes.", dictamen: `Efectividad física de planes al ${avancePlanesGlobal}%.`, color: "border-emerald-500/30 text-emerald-400" };
      } else if (tipoCard === 'riesgos') {
        analitica = { titulo: "Inventario de Riesgos", valor: `${totalRiesgos} Activos`, significado: "Total de amenazas.", dictamen: `Mapeo maduro con ${totalRiesgos} riesgos activos.`, color: "border-red-500/30 text-red-400" };
      } else if (tipoCard === 'controles') {
        analitica = { titulo: "Efectividad Operacional de Controles", valor: `${efectividadControlesGlobal}%`, significado: "Salvaguardas eficaces.", dictamen: `Efectividad registrada al ${efectividadControlesGlobal}%.`, color: "border-cyan-500/30 text-cyan-400" };
      } else if (tipoCard === 'hallazgos') {
        analitica = { titulo: "Desviaciones Abiertas", valor: `${hallazgosAbiertos} Abiertos`, significado: "Brechas normativas.", dictamen: `Controlado con solo ${hallazgosAbiertos} hallazgos abiertos.`, color: "border-amber-500/30 text-amber-400" };
      } else if (tipoCard === 'planes') {
        analitica = { titulo: "Planes en Ejecución", valor: `${planesActivos} Activos`, significado: "Saturación operativa.", dictamen: `Sostenible con ${planesActivos} planes activos.`, color: "border-purple-500/30 text-purple-400" };
      }
      setDictamenIA(analitica); setProcesandoIA(false);
    }, 400);
  };

  let allActivity = [];
  const parseDateStr = (dateStr) => {
    try {
      const [datePart, timePart] = dateStr.split(', ');
      const [d, m, y] = datePart.split(/[\/\-]/);
      return new Date(`${y}-${m}-${d}T${timePart || '00:00:00'}`).getTime();
    } catch(e) { return 0; }
  };

  const addAct = (items, type, icon, colorClass) => {
    items.forEach(item => {
      if (item.historialCambios && item.historialCambios.length > 0) {
        const last = item.historialCambios[item.historialCambios.length - 1];
        allActivity.push({ timestamp: parseDateStr(last.fecha), fechaStr: last.fecha, accion: last.accion, usuario: last.usuario || 'Sistema', ref: item.ref || (item.id ? `${type.substring(0,3).toUpperCase()}-${String(item.id).substring(0,5)}` : 'N/A'), proceso: item.proceso || 'General', type, icon, colorClass });
      }
    });
  };
  
  addAct(planesBase, 'Plan', '✅', 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30');
  addAct(hallazgosBase, 'Hallazgo', '⚠️', 'bg-amber-500/20 text-amber-400 border border-amber-500/30');
  addAct(riesgosBase, 'Riesgo', '🛡️', 'bg-red-500/20 text-red-400 border border-red-500/30');
  
  allActivity.sort((a, b) => b.timestamp - a.timestamp);
  const recentActivityList = allActivity.slice(0, 4);

  const mesesCortos = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const currentMonthIdx = hoy.getMonth();
  const ultimos6Meses = Array.from({length: 6}, (_, i) => {
      let m = currentMonthIdx - 5 + i; if (m < 0) m += 12;
      return { idx: m, nombre: mesesCortos[m], nombreLargo: defaultMeses[m] };
  });

  const trendData = ultimos6Meses.map(mInfo => {
     const riesgosMes = riesgosBase.filter(r => r.mes === mInfo.nombreLargo);
     const crit = riesgosMes.filter(r => (extraerNumeroPuro(r.probabilidadResidual) * extraerNumeroPuro(r.impactoResidual)) >= 16).length;
     const med = riesgosMes.filter(r => { const score = extraerNumeroPuro(r.probabilidadResidual) * extraerNumeroPuro(r.impactoResidual); return score >= 6 && score < 16; }).length;
     const baj = riesgosMes.length - crit - med;
     return { mes: mInfo.nombre, crit, med, baj };
  });

  const maxVal = Math.max(1, ...trendData.flatMap(d => [d.crit, d.med, d.baj]));
  const getY = (val) => 35 - ((val / maxVal) * 25); 
  const getX = (idx) => (idx * (100 / 5)); 

  const pathCriticos = trendData.map((d, i) => `${i===0?'M':'L'}${getX(i)},${getY(d.crit)}`).join(' ');
  const pathMedios = trendData.map((d, i) => `${i===0?'M':'L'}${getX(i)},${getY(d.med)}`).join(' ');
  const pathBajos = trendData.map((d, i) => `${i===0?'M':'L'}${getX(i)},${getY(d.baj)}`).join(' ');

  const procesosCount = Object.entries(riesgosBase.reduce((acc, r) => { const proc = r.proceso || 'General / Otros'; acc[proc] = (acc[proc] || 0) + 1; return acc; }, {}));
  const coloresMini = ['#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899'];
  let offsetCirculo = 0;

  return (
    <div className="flex-1 bg-[#060b16] text-slate-100 overflow-y-auto p-6 font-sans space-y-6 scrollbar-thin select-none relative">
      
      {/* ─── 🤖 CAPA DE ENFOQUE INTELIGENTE ─── */}
      {(procesandoIA || dictamenIA) && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in">
          {dictamenIA && (
            <div className="bg-[#0f172a] border border-slate-800 p-6 rounded-3xl shadow-2xl max-w-2xl relative border-l-4 border-l-emerald-500 w-full">
              <button onClick={() => setDictamenIA(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white text-xs font-bold uppercase bg-[#1e293b] px-2.5 py-1 rounded-xl">✕ Cerrar</button>
              <h3 className="text-sm font-black text-white uppercase mb-4">{dictamenIA.titulo}</h3>
              <div className="text-emerald-300 bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/20">{dictamenIA.dictamen}</div>
            </div>
          )}
        </div>
      )}

      {/* ─── ENCABEZADO PREMIUM Y FILTROS ─── */}
      <div className="bg-[#0a1122] border border-blue-500/10 p-5 rounded-2xl shadow-md space-y-4 mb-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800/80 pb-4 gap-4">
          <div>
            <h2 className="text-xl font-black text-white">Dashboard Ejecutivo</h2>
            <p className="text-xs text-slate-400 font-medium">Resumen general del Sistema de Control Interno y Gestión Integral del Riesgo</p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-4 pt-1 items-start md:items-end">
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Años de Análisis</label>
            <div className="flex flex-wrap gap-2">
              {defaultAnios.map(anio => (
                <button key={`tablero-anio-${anio}`} onClick={() => toggleAnio(anio)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${selectedAnios.includes(anio) ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>{anio}</button>
              ))}
            </div>
          </div>
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Meses de Análisis</label>
            <div className="flex flex-wrap gap-1.5">
              {defaultMeses.map(mes => (
                <button key={`tablero-mes-${mes}`} onClick={() => toggleMes(mes)} className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border notranslate ${selectedMeses.includes(mes) ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>{mes.substring(0,3)}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── TARJETAS SUPERIORES ─── */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-[#0a1122] border border-slate-800 p-4 rounded-2xl shadow-lg">
          <span className="text-xs font-black text-slate-400 uppercase">Cumplimiento Global</span>
          <div className="mt-2 text-3xl font-black text-white">{avancePlanesGlobal}%</div>
        </div>
        <div className="bg-[#0a1122] border border-slate-800 p-4 rounded-2xl shadow-lg">
          <span className="text-xs font-black text-slate-400 uppercase">Riesgos Activos</span>
          <div className="mt-2 text-3xl font-black text-white">{totalRiesgos}</div>
        </div>
        <div className="bg-[#0a1122] border border-slate-800 p-4 rounded-2xl shadow-lg">
          <span className="text-xs font-black text-slate-400 uppercase">Controles Auditados</span>
          <div className="mt-2 text-3xl font-black text-white">{efectividadControlesGlobal}%</div>
        </div>
        <div className="bg-[#0a1122] border border-slate-800 p-4 rounded-2xl shadow-lg">
          <span className="text-xs font-black text-slate-400 uppercase">Hallazgos Abiertos</span>
          <div className="mt-2 text-3xl font-black text-white">{hallazgosAbiertos}</div>
        </div>
        <div className="bg-[#0a1122] border border-slate-800 p-4 rounded-2xl shadow-lg">
          <span className="text-xs font-black text-slate-400 uppercase">Planes en Ejecución</span>
          <div className="mt-2 text-3xl font-black text-white">{planesActivos}</div>
        </div>
      </div>

      {/* ─── PANEL CENTRAL CON MATRIZ 5X5 ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#0a1122] border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
          <h3 className="text-xs font-black uppercase text-slate-300 mb-4">Mapa de Riesgos (Matriz 5x5)</h3>
          <div className="flex items-center space-x-4 flex-1">
            <div className="flex-1 flex flex-col space-y-1">
              {[5, 4, 3, 2, 1].map((impactoLvl) => {
                const etiquetasY = ["", "Insignificante", "Menor", "Moderado", "Mayor", "Catastrófico"];
                return (
                  <div key={`row-${impactoLvl}`} className="flex items-center space-x-1 h-12">
                    <span className="w-24 text-[10px] font-bold text-slate-400 text-right pr-2 truncate">{impactoLvl} {etiquetasY[impactoLvl]}</span>
                    {[1, 2, 3, 4, 5].map((probLvl) => {
                      const cant = contarRiesgosEnCelda(probLvl, impactoLvl);
                      let colorCelda = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"; 
                      const score = probLvl * impactoLvl;
                      if (score >= 5 && score <= 9) colorCelda = "bg-amber-500/20 text-amber-400 border-amber-500/30";
                      else if (score >= 10 && score <= 15) colorCelda = "bg-orange-500/30 text-orange-400 border-orange-500/40";
                      else if (score >= 16) colorCelda = "bg-red-500/30 text-red-400 border-red-500/50";
                      return (
                        <div key={`cell-${probLvl}-${impactoLvl}`} className={`flex-1 h-full rounded-lg border flex flex-col items-center justify-center font-black text-sm ${colorCelda}`}>
                          <span>{cant}</span>
                        </div>
                      );
                    })}                      
                  </div>
                );
              })}
              <div className="flex items-center space-x-1 pt-1 pl-24 text-center">
                {["1 Rara vez", "2 Improbable", "3 Posible", "4 Probable", "5 Casi seguro"].map((probText, idx) => (
                  <span key={`prob-lbl-${idx}`} className="flex-1 text-[9px] font-bold text-slate-500 truncate">{probText}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* TENDENCIA HISTÓRICA */}
        <div className="bg-[#0a1122] border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
          <h3 className="text-xs font-black uppercase text-slate-300">Tendencia Histórica</h3>
          <div className="w-full h-36 mt-2 relative">
            <svg viewBox="0 -5 100 45" className="w-full h-full overflow-visible" preserveAspectRatio="none">
              <path d={pathCriticos} fill="none" stroke="#ff4444" strokeWidth="1.5" />
              <path d={pathMedios} fill="none" stroke="#fbbf24" strokeWidth="1.5" />
              <path d={pathBajos} fill="none" stroke="#10b981" strokeWidth="1.5" />
            </svg>
            <div className="flex justify-between text-[8px] font-bold text-slate-500 mt-2 px-1 uppercase">
              {trendData.map((d, i) => <span key={`mes-${i}`}>{d.mes}</span>)}
            </div>
          </div>
        </div>
      </div>

      {/* ─── GRÁFICA ÚNICA DE TENDENCIA FINANCIERA A ANCHO COMPLETO ─── */}
      <div className="grid grid-cols-1 gap-6 mt-6">
        <div className="bg-[#0a1122] p-4 rounded-3xl border border-slate-800 shadow-xl overflow-hidden">
          <div className="bg-[#0a1122]">
            <TrendChart 
              data={infoFinancieraLimpia}
              title="Evolución de Impacto Financiero (5 Años)"
              isCurrency={true}
              color="#ef4444"
              fillColor="rgba(239, 68, 68, 0.15)"
              onPointClick={(pt) => {
                const filtrados = (safeIncidentes || [])
                  .filter(inc => {
                    const mesIncText = inc.fecha ? defaultMeses[parseInt(inc.fecha.split('-')[1], 10) - 1] : inc.mes;
                    const perdidaReal = (Number(inc.costo) || 0) + (Number(inc.montoFaltante) || 0) + (Number(inc.montoSobrante) || 0);
                    return mesIncText === pt.mes && perdidaReal > 0;
                  })
                  .map(inc => ({
                    ...inc,
                    costo: (Number(inc.costo) || 0) + (Number(inc.montoFaltante) || 0) + (Number(inc.montoSobrante) || 0)
                  }));
                if (filtrados.length > 0) {
                  setChartDetail({ tipo: 'Incidentes Financiados', mesCompleto: pt.mes, items: filtrados });
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* ─── ALERTAS INTELIGENTES (IA) ─── */}
      <div className="bg-[#0a1122] border border-slate-800 p-5 rounded-2xl shadow-xl space-y-3 mt-6">
        <h3 className="text-xs font-black uppercase text-slate-300">🤖 Alertas e Incidentes</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-left">
          <div className="bg-[#1c0d15] border border-red-500/20 p-3 rounded-xl">
            <h4 className="text-[11px] font-black text-red-400">{riesgosExtremos + riesgosAltos} Riesgos Extremos/Altos</h4>
          </div>
          <div className="bg-[#1c140d] border border-amber-500/20 p-3 rounded-xl">
            <h4 className="text-[11px] font-black text-amber-400">{planesVencidos} Planes Vencidos</h4>
          </div>
        </div>
      </div>

    </div>
  );
}