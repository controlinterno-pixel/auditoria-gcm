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

       {/* TOOLTIP GRÁFICA */}
       <div className="absolute top-[105%] left-1/2 -translate-x-1/2 w-72 bg-[#0f172a]/95 backdrop-blur-md border border-slate-700/80 p-4 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0 text-left">
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#0f172a] border-t border-l border-slate-700/80 rotate-45"></div>
          <h4 className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2 border-b border-slate-700/80 pb-1.5">Contexto Financiero</h4>
          <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-300 font-medium">
            <p><b className="text-emerald-400 uppercase">📍 Origen:</b> Módulo Eventos de Pérdida.</p>
            <p><b className="text-amber-400 uppercase">❓ Por qué:</b> Cuantifica el impacto real monetario materializado.</p>
            <p><b className="text-slate-200 uppercase">📝 Explicación:</b> Sumatoria de costos operativos, dineros faltantes y sobrantes sin justificar.</p>
            <div className="mt-2 p-1.5 bg-[#020617] border border-slate-800 rounded-md font-mono text-rose-400 text-[8px]">
              FÓRMULA: Suma (Costos + Faltantes + Sobrantes) / Mes
            </div>
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

  // 🧠 FILTRADOS EXACTOS
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
        analitica = { titulo: "Cumplimiento Global de Compromisos", valor: `${avancePlanesGlobal}%`, significado: "Mide el avance y cierre formal de los planes.", dictamen: `Efectividad física de planes al ${avancePlanesGlobal}%. El nivel de mitigación indica la agilidad del hotel para subsanar debilidades.`, color: "border-emerald-500/30 text-emerald-400" };
      } else if (tipoCard === 'riesgos') {
        analitica = { titulo: "Inventario de Riesgos", valor: `${totalRiesgos} Activos`, significado: "Total de amenazas.", dictamen: `Mapeo maduro con ${totalRiesgos} riesgos activos. La concentración de exposición requiere monitoreo periódico.`, color: "border-red-500/30 text-red-400" };
      } else if (tipoCard === 'controles') {
        analitica = { titulo: "Efectividad Operacional de Controles", valor: `${efectividadControlesGlobal}%`, significado: "Salvaguardas eficaces.", dictamen: `Efectividad registrada al ${efectividadControlesGlobal}%. Es fundamental fortalecer las hojas de prueba en sitio.`, color: "border-cyan-500/30 text-cyan-400" };
      } else if (tipoCard === 'hallazgos') {
        analitica = { titulo: "Desviaciones Abiertas", valor: `${hallazgosAbiertos} Abiertos`, significado: "Brechas normativas.", dictamen: `Controlado con ${hallazgosAbiertos} hallazgos abiertos. Los hallazgos críticos deben generar planes inmediatos.`, color: "border-amber-500/30 text-amber-400" };
      } else if (tipoCard === 'planes') {
        analitica = { titulo: "Planes en Ejecución", valor: `${planesActivos} Activos`, significado: "Saturación operativa.", dictamen: `Sostenible con ${planesActivos} planes activos. Exigir cierres formales en los plazos acordados.`, color: "border-purple-500/30 text-purple-400" };
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
  addAct(typeof informesAuditoria !== 'undefined' ? informesAuditoria : [], 'Informe', '📄', 'bg-blue-500/20 text-blue-400 border border-blue-500/30');
  
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
      <div className="bg-[#0a1122] border border-blue-500/10 p-5 rounded-2xl shadow-md space-y-4 mb-4 relative z-50">
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

      {/* ─── TARJETAS SUPERIORES CON TOOLTIPS ─── */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        
        {/* CARDA 1 */}
        <div className="bg-[#0a1122] border border-slate-800 p-4 rounded-2xl shadow-lg relative group overflow-visible hover:border-blue-500/50 transition-colors cursor-help">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black tracking-wider text-slate-400 uppercase">Cumplimiento Global</span>
            <button onClick={() => solicitarDictamenIA('cumplimiento')} className="text-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-md flex items-center gap-1 transition-all font-black shadow-sm shrink-0 relative z-10">✨ IA</button>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-black text-white">{avancePlanesGlobal}%</span>
          </div>
          {/* TOOLTIP 1 */}
          <div className="absolute top-[105%] left-1/2 -translate-x-1/2 w-72 bg-[#0f172a]/95 backdrop-blur-md border border-slate-700/80 p-4 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0 text-left">
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#0f172a] border-t border-l border-slate-700/80 rotate-45"></div>
            <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2 border-b border-slate-700/80 pb-1.5">Contexto de Control</h4>
            <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-300 font-medium">
              <p><b className="text-emerald-400 uppercase">📍 Origen:</b> Matriz Integrada de Planes de Acción.</p>
              <p><b className="text-amber-400 uppercase">❓ Por qué:</b> Mide la velocidad de mitigación frente a las brechas.</p>
              <p><b className="text-slate-200 uppercase">📝 Explicación:</b> Porcentaje de tareas de mejora completadas al 100%.</p>
              <div className="mt-2 p-1.5 bg-[#020617] border border-slate-800 rounded-md font-mono text-emerald-400 text-[8px]">
                FÓRMULA: (Planes Cerrados / Total Planes) * 100
              </div>
            </div>
          </div>
        </div>

        {/* CARDA 2 */}
        <div className="bg-[#0a1122] border border-slate-800 p-4 rounded-2xl shadow-lg relative group overflow-visible hover:border-blue-500/50 transition-colors cursor-help">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black tracking-wider text-slate-400 uppercase">Riesgos Activos</span>
            <button onClick={() => solicitarDictamenIA('riesgos')} className="text-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-md flex items-center gap-1 transition-all font-black shadow-sm shrink-0 relative z-10">✨ IA</button>
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-white">{totalRiesgos}</span>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-1 text-[8px] font-black tracking-wider uppercase text-center">
            <span className="text-red-500">{riesgosExtremos} Extr</span>
            <span className="text-orange-400">{riesgosAltos} Altos</span>
            <span className="text-amber-400">{riesgosModerados} Mod</span>
            <span className="text-emerald-400">{riesgosBajos} Bajos</span>
          </div>
          {/* TOOLTIP 2 */}
          <div className="absolute top-[105%] left-1/2 -translate-x-1/2 w-72 bg-[#0f172a]/95 backdrop-blur-md border border-slate-700/80 p-4 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0 text-left">
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#0f172a] border-t border-l border-slate-700/80 rotate-45"></div>
            <h4 className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-2 border-b border-slate-700/80 pb-1.5">Contexto de Riesgo</h4>
            <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-300 font-medium">
              <p><b className="text-emerald-400 uppercase">📍 Origen:</b> Mapa de Calor Empresarial (Matriz 5x5).</p>
              <p><b className="text-amber-400 uppercase">❓ Por qué:</b> Cuantifica la exposición residual total del hotel.</p>
              <p><b className="text-slate-200 uppercase">📝 Explicación:</b> Riesgos corporativos actualmente abiertos.</p>
              <div className="mt-2 p-1.5 bg-[#020617] border border-slate-800 rounded-md font-mono text-red-400 text-[8px]">
                FÓRMULA: Sumatoria (Riesgos Registrados)
              </div>
            </div>
          </div>
        </div>

        {/* CARDA 3 */}
        <div className="bg-[#0a1122] border border-slate-800 p-4 rounded-2xl shadow-lg relative group overflow-visible hover:border-blue-500/50 transition-colors cursor-help">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black tracking-wider text-slate-400 uppercase">Controles Auditados</span>
            <button onClick={() => solicitarDictamenIA('controles')} className="text-[10px] bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 px-1.5 py-0.5 rounded-md flex items-center gap-1 transition-all font-black shadow-sm shrink-0 relative z-10">✨ IA</button>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-black text-white">{efectividadControlesGlobal}%</span>
          </div>
          {/* TOOLTIP 3 */}
          <div className="absolute top-[105%] left-1/2 -translate-x-1/2 w-72 bg-[#0f172a]/95 backdrop-blur-md border border-slate-700/80 p-4 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0 text-left">
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#0f172a] border-t border-l border-slate-700/80 rotate-45"></div>
            <h4 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-2 border-b border-slate-700/80 pb-1.5">Contexto de Aseguramiento</h4>
            <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-300 font-medium">
              <p><b className="text-emerald-400 uppercase">📍 Origen:</b> Trabajo de Campo (Auditoría).</p>
              <p><b className="text-amber-400 uppercase">❓ Por qué:</b> Evalúa la robustez operativa de las defensas (Controles).</p>
              <p><b className="text-slate-200 uppercase">📝 Explicación:</b> Porcentaje de controles evaluados como eficaces al 100%.</p>
              <div className="mt-2 p-1.5 bg-[#020617] border border-slate-800 rounded-md font-mono text-cyan-400 text-[8px]">
                FÓRMULA: (Evaluaciones Calificadas 100 / Total Evaluaciones) * 100
              </div>
            </div>
          </div>
        </div>

        {/* CARDA 4 */}
        <div className="bg-[#0a1122] border border-slate-800 p-4 rounded-2xl shadow-lg relative group overflow-visible hover:border-blue-500/50 transition-colors cursor-help">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black tracking-wider text-slate-400 uppercase">Hallazgos Abiertos</span>
            <button onClick={() => solicitarDictamenIA('hallazgos')} className="text-[10px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-md flex items-center gap-1 transition-all font-black shadow-sm shrink-0 relative z-10">✨ IA</button>
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-white">{hallazgosAbiertos}</span>
          </div>
          <div className="mt-3 text-[10px] font-black uppercase text-red-400 tracking-wider">
            🚨 {hallazgosCriticosCount} Con Alerta Crítica
          </div> 
          {/* TOOLTIP 4 */}
          <div className="absolute top-[105%] left-1/2 -translate-x-1/2 w-72 bg-[#0f172a]/95 backdrop-blur-md border border-slate-700/80 p-4 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0 text-left">
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#0f172a] border-t border-l border-slate-700/80 rotate-45"></div>
            <h4 className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2 border-b border-slate-700/80 pb-1.5">Contexto de Desviaciones</h4>
            <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-300 font-medium">
              <p><b className="text-emerald-400 uppercase">📍 Origen:</b> Repositorio de Informes Emitidos.</p>
              <p><b className="text-amber-400 uppercase">❓ Por qué:</b> Refleja cantidad de brechas normativas no resueltas.</p>
              <p><b className="text-slate-200 uppercase">📝 Explicación:</b> Conteo de no conformidades con estado 'Abierto'.</p>
              <div className="mt-2 p-1.5 bg-[#020617] border border-slate-800 rounded-md font-mono text-amber-400 text-[8px]">
                FÓRMULA: Sumatoria (Hallazgos donde Estado === 'Abierto')
              </div>
            </div>
          </div>       
        </div>

        {/* CARDA 5 (Alineada a la izquierda para no salirse de pantalla) */}
        <div className="bg-[#0a1122] border border-slate-800 p-4 rounded-2xl shadow-lg relative group overflow-visible hover:border-blue-500/50 transition-colors cursor-help">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black tracking-wider text-slate-400 uppercase">Planes en Ejecución</span>
            <button onClick={() => solicitarDictamenIA('planes')} className="text-[10px] bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded-md flex items-center gap-1 transition-all font-black shadow-sm shrink-0 relative z-10">✨ IA</button>
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-white">{planesActivos}</span>
          </div>
          <div className="mt-3 text-[10px] font-black uppercase text-amber-500 tracking-wider">
            ⚠️ {planesVencidos} Vencidos / Retrasados
          </div>
          {/* TOOLTIP 5 */}
          <div className="absolute top-[105%] left-[80%] -translate-x-[80%] w-72 bg-[#0f172a]/95 backdrop-blur-md border border-slate-700/80 p-4 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0 text-left">
            <div className="absolute -top-2 left-[80%] -translate-x-[80%] w-4 h-4 bg-[#0f172a] border-t border-l border-slate-700/80 rotate-45"></div>
            <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-2 border-b border-slate-700/80 pb-1.5">Contexto de Gestión</h4>
            <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-300 font-medium">
              <p><b className="text-emerald-400 uppercase">📍 Origen:</b> Módulo de Planes de Acción.</p>
              <p><b className="text-amber-400 uppercase">❓ Por qué:</b> Indica la saturación operativa para cierre de brechas.</p>
              <p><b className="text-slate-200 uppercase">📝 Explicación:</b> Sumatoria de planes con progreso menor a 100%.</p>
              <div className="mt-2 p-1.5 bg-[#020617] border border-slate-800 rounded-md font-mono text-purple-400 text-[8px]">
                FÓRMULA: Conteo (Planes donde Estado !== 'Cerrado')
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── PANEL CENTRAL CON MATRIZ 5X5 ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* MAPA DE CALOR */}
        <div className="lg:col-span-2 bg-[#0a1122] border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between relative group overflow-visible hover:border-slate-700 transition-all cursor-help">
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
          {/* TOOLTIP MATRIZ */}
          <div className="absolute bottom-[102%] left-4 w-72 bg-[#0f172a]/95 backdrop-blur-md border border-slate-700/80 p-4 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0 text-left">
            <div className="absolute -bottom-2 left-8 w-4 h-4 bg-[#0f172a] border-b border-r border-slate-700/80 rotate-45"></div>
            <h4 className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2 border-b border-slate-700/80 pb-1.5">Distribución Residual COSO</h4>
            <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-300 font-medium">
              <p><b className="text-emerald-400 uppercase">📍 Origen:</b> Matriz Integral de Riesgos.</p>
              <p><b className="text-amber-400 uppercase">❓ Por qué:</b> Muestra dónde se concentra la severidad corporativa.</p>
              <p><b className="text-slate-200 uppercase">📝 Explicación:</b> Intersección Probabilidad x Impacto en su fase Residual.</p>
            </div>
          </div>
        </div>

        {/* TENDENCIA HISTÓRICA & PROCESOS */}
        <div className="bg-[#0a1122] border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between relative group overflow-visible hover:border-slate-700 transition-all cursor-help">
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
          
          <div className="border-t border-slate-800 pt-3 mt-3">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">Distribución por Proceso</h4>
            <div className="flex items-center justify-between space-x-4">
              <div className="w-16 h-16 relative shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                  <circle cx="18" cy="18" r="15.915" fill="none" stroke="#1e293b" strokeWidth="4" />
                  {totalRiesgos > 0 && procesosCount.map(([proc, cant], idx) => {
                    const p = (cant / totalRiesgos) * 100;
                    const color = coloresMini[idx % coloresMini.length];
                    const dash = `${p} 100`;
                    const off = `-${offsetCirculo}`;
                    offsetCirculo += p;
                    return <circle key={`circ-${idx}`} cx="18" cy="18" r="15.915" fill="none" stroke={color} strokeWidth="4" strokeDasharray={dash} strokeDashoffset={off} className="transition-all duration-1000"/>;
                  })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                   <span className="text-[10px] font-black text-white leading-none">{totalRiesgos}</span>
                   <span className="text-[7px] text-slate-400 font-bold leading-none mt-0.5">Total</span>
                </div>
              </div>
              <div className="flex-1 text-[9px] font-bold space-y-1 text-slate-400 overflow-y-auto max-h-20 scrollbar-none">
                {procesosCount.map(([procesoNombre, cantidad], idx) => {
                  const porcentaje = Math.round((cantidad / totalRiesgos) * 100);
                  const colorActual = coloresMini[idx % coloresMini.length];
                  return (
                    <div key={`proc-dist-${idx}`} className="flex justify-between items-center hover:bg-slate-800/50 p-0.5 rounded transition-colors">
                      <span className="flex items-center truncate max-w-[140px]" title={procesoNombre}>
                        <span className="w-1.5 h-1.5 rounded-full mr-1.5 shrink-0" style={{ backgroundColor: colorActual }}></span>
                        {procesoNombre}
                      </span>
                      <span className="text-white ml-2 shrink-0">{porcentaje}% ({cantidad})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {/* TOOLTIP TENDENCIAS */}
          <div className="absolute bottom-[102%] right-4 w-72 bg-[#0f172a]/95 backdrop-blur-md border border-slate-700/80 p-4 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0 text-left">
            <div className="absolute -bottom-2 right-8 w-4 h-4 bg-[#0f172a] border-b border-r border-slate-700/80 rotate-45"></div>
            <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 border-b border-slate-700/80 pb-1.5">Análisis de Tendencia</h4>
            <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-300 font-medium">
              <p><b className="text-emerald-400 uppercase">📍 Origen:</b> Histórico de Módulo de Riesgos.</p>
              <p><b className="text-amber-400 uppercase">❓ Por qué:</b> Monitorea evolución mensual de criticidades y concentración por área.</p>
              <p><b className="text-slate-200 uppercase">📝 Explicación:</b> Picos históricos a 6 meses.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── GRÁFICA ÚNICA DE TENDENCIA FINANCIERA A ANCHO COMPLETO ─── */}
      <div className="grid grid-cols-1 gap-6 mt-6">
        <div className="bg-[#0a1122] p-4 rounded-3xl border border-slate-800 shadow-xl overflow-hidden relative group cursor-help">
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
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h3 className="text-xs font-black tracking-widest uppercase text-slate-300 flex items-center">
            <span className="text-base mr-1.5">🤖</span> Alertas y Recomendaciones IA
          </h3>
          <span className="text-[9px] font-black uppercase text-blue-400 cursor-pointer hover:underline">Monitoreo en vivo</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-left">
          <div className="bg-[#1c0d15] border border-red-500/20 p-3 rounded-xl flex items-start space-x-3">
            <div className="text-red-400 text-lg bg-red-500/10 p-1.5 rounded-lg">⚠️</div>
            <div className="space-y-0.5">
              <h4 className="text-[11px] font-black text-red-400">{riesgosExtremos + riesgosAltos} Riesgos Extremos/Altos</h4>
              <p className="text-[9px] text-slate-400 font-medium">Requieren priorización de controles</p>
            </div>
          </div>
          <div className="bg-[#1c140d] border border-amber-500/20 p-3 rounded-xl flex items-start space-x-3">
            <div className="text-amber-400 text-lg bg-amber-500/10 p-1.5 rounded-lg">📝</div>
            <div className="space-y-0.5">
              <h4 className="text-[11px] font-black text-amber-400">{planesVencidos} Planes Vencidos</h4>
              <p className="text-[9px] text-slate-400 font-medium">Fuera de la fecha límite establecida</p>
            </div>
          </div>
          <div className="bg-[#0d1624] border border-blue-500/20 p-3 rounded-xl flex items-start space-x-3">
            <div className="text-blue-400 text-lg bg-blue-500/10 p-1.5 rounded-lg">🔬</div>
            <div className="space-y-0.5">
              <h4 className="text-[11px] font-black text-blue-400">{hallazgosCriticosCount} Hallazgos Críticos/Altos</h4>
              <p className="text-[9px] text-slate-400 font-medium">Pendientes de apertura de Plan</p>
            </div>
          </div>
          <div className="bg-[#091819] border border-cyan-500/20 p-3 rounded-xl flex items-start space-x-3">
            <div className="text-cyan-400 text-lg bg-cyan-500/10 p-1.5 rounded-lg">💡</div>
            <div className="space-y-0.5">
              <h4 className="text-[11px] font-black text-cyan-400">Eficiencia Global: {efectividadControlesGlobal}%</h4>
              <p className="text-[9px] text-slate-400 font-medium">Efectividad ponderada de la matriz</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── SECCIÓN INFERIOR DE COMPONENTES RESTAURADA ─── */}
      {(() => {
        const totalHallazgosReal = hallazgosBase.length || 1; 
        const hCrit = hallazgosBase.filter(h => h.severidad === 'Crítico' || h.severidad === 'Crítica').length;
        const hAlt = hallazgosBase.filter(h => h.severidad === 'Alto' || h.severidad === 'Alta').length;
        const hMed = hallazgosBase.filter(h => h.severidad === 'Medio' || h.severidad === 'Media').length;
        const hBaj = hallazgosBase.filter(h => h.severidad === 'Bajo' || h.severidad === 'Baja').length;
        
        const pCrit = Math.round((hCrit / totalHallazgosReal) * 100) || 0;
        const pAlt = Math.round((hAlt / totalHallazgosReal) * 100) || 0;
        const pMed = Math.round((hMed / totalHallazgosReal) * 100) || 0;
        const pBaj = Math.round((hBaj / totalHallazgosReal) * 100) || 0;

        const cronogramaIniciados = cronogramaBase.filter(c => (Number(c.cumplimiento) || 0) > 0);
        const kpiPlanAnual = cronogramaIniciados.length > 0 ? Math.round(cronogramaIniciados.reduce((acc, c) => acc + (Number(c.cumplimiento) || 0), 0) / cronogramaIniciados.length) : 0;
        const kpiOportunidad = totalPlanes > 0 ? Math.round(((totalPlanes - planesVencidos) / totalPlanes) * 100) : 100;

        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left mt-6">
            
            {/* SEVERIDAD DE HALLAZGOS */}
            <div className="bg-[#0a1122] border border-slate-800 p-4 rounded-2xl shadow-lg relative group overflow-visible hover:border-slate-700 transition-all cursor-help">
              <h3 className="text-xs font-black tracking-widest uppercase text-slate-300 mb-3">Severidad de Hallazgos</h3>
              <div className="flex items-center justify-around h-32">
                <div className="w-24 h-24 relative">
                  <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90 drop-shadow-md">
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#1e293b" strokeWidth="4" />
                    {pCrit > 0 && <circle cx="18" cy="18" r="15.915" fill="none" stroke="#ff4444" strokeWidth="4" strokeDasharray={`${pCrit} 100`} strokeDashoffset="0" className="transition-all duration-1000" />}
                    {pAlt > 0 && <circle cx="18" cy="18" r="15.915" fill="none" stroke="#fbbf24" strokeWidth="4" strokeDasharray={`${pAlt} 100`} strokeDashoffset={`-${pCrit}`} className="transition-all duration-1000" />}
                    {pMed > 0 && <circle cx="18" cy="18" r="15.915" fill="none" stroke="#3b82f6" strokeWidth="4" strokeDasharray={`${pMed} 100`} strokeDashoffset={`-${pCrit + pAlt}`} className="transition-all duration-1000" />}
                    {pBaj > 0 && <circle cx="18" cy="18" r="15.915" fill="none" stroke="#10b981" strokeWidth="4" strokeDasharray={`${pBaj} 100`} strokeDashoffset={`-${pCrit + pAlt + pMed}`} className="transition-all duration-1000" />}
                  </svg>
                </div>
                <div className="text-[10px] font-bold text-slate-400 space-y-1">
                  <div className="flex items-center justify-between w-28"><span className="flex items-center"><span className="w-2 h-2 rounded-full bg-red-500 mr-1.5"></span>Críticos</span><span className="text-white">{hCrit} ({pCrit}%)</span></div>
                  <div className="flex items-center justify-between w-28"><span className="flex items-center"><span className="w-2 h-2 rounded-full bg-amber-500 mr-1.5"></span>Altos</span><span className="text-white">{hAlt} ({pAlt}%)</span></div>
                  <div className="flex items-center justify-between w-28"><span className="flex items-center"><span className="w-2 h-2 rounded-full bg-blue-500 mr-1.5"></span>Medios</span><span className="text-white">{hMed} ({pMed}%)</span></div>
                  <div className="flex items-center justify-between w-28"><span className="flex items-center"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5"></span>Bajos</span><span className="text-white">{hBaj} ({pBaj}%)</span></div>
                </div>
              </div>
              {/* TOOLTIP SEVERIDAD */}
              <div className="absolute bottom-[102%] left-4 w-72 bg-[#0f172a]/95 backdrop-blur-md border border-slate-700/80 p-4 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0 text-left">
                <div className="absolute -bottom-2 left-8 w-4 h-4 bg-[#0f172a] border-b border-r border-slate-700/80 rotate-45"></div>
                <h4 className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2 border-b border-slate-700/80 pb-1.5">Desglose de Severidad</h4>
                <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-300 font-medium">
                  <p><b className="text-emerald-400 uppercase">📍 Origen:</b> Repositorio de Informes.</p>
                  <p><b className="text-amber-400 uppercase">❓ Por qué:</b> Identifica la urgencia de atención operativa.</p>
                  <p><b className="text-slate-200 uppercase">📝 Explicación:</b> Participación porcentual de no conformidades (Críticas a Bajas).</p>
                </div>
              </div>
            </div>

            {/* MÉTRICAS DE PLANES */}
            <div className="bg-[#0a1122] border border-slate-800 p-5 rounded-2xl shadow-lg relative group overflow-visible hover:border-slate-700 transition-all cursor-help">
              <h3 className="text-xs font-black tracking-widest uppercase text-slate-300 mb-3">Métricas de Planes</h3>
              <div className="space-y-3 font-bold text-xs text-slate-400">
                <div className="bg-[#060b16] border border-slate-800/60 p-2.5 rounded-xl flex justify-between items-center hover:border-blue-500/30 transition-colors">
                  <span className="flex items-center">📈 Cumplimiento</span><span className="text-white font-black text-sm">{avancePlanesGlobal}%</span>
                </div>
                <div className="bg-[#060b16] border border-slate-800/60 p-2.5 rounded-xl flex justify-between items-center hover:border-cyan-500/30 transition-colors">
                  <span className="flex items-center">📂 Abiertos</span><span className="text-cyan-400 font-black">{planesActivos}</span>
                </div>
                <div className="bg-[#060b16] border border-slate-800/60 p-2.5 rounded-xl flex justify-between items-center hover:border-red-500/30 transition-colors">
                  <span className="text-slate-400 flex items-center">🚨 Vencidos</span><span className="text-red-400 font-black">{planesVencidos}</span>
                </div>
              </div>
              {/* TOOLTIP MÉTRICAS */}
              <div className="absolute bottom-[102%] left-1/2 -translate-x-1/2 w-72 bg-[#0f172a]/95 backdrop-blur-md border border-slate-700/80 p-4 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0 text-left">
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#0f172a] border-b border-r border-slate-700/80 rotate-45"></div>
                <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-2 border-b border-slate-700/80 pb-1.5">Salud de la Remediación</h4>
                <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-300 font-medium">
                  <p><b className="text-emerald-400 uppercase">📍 Origen:</b> Módulo Planes de Acción.</p>
                  <p><b className="text-amber-400 uppercase">❓ Por qué:</b> Control de tiempos y cuellos de botella.</p>
                  <p><b className="text-slate-200 uppercase">📝 Explicación:</b> Resumen dinámico del estado de las tareas preventivas.</p>
                </div>
              </div>
            </div>

            {/* INDICADORES KPI */}
            <div className="bg-[#0a1122] border border-slate-800 p-4 rounded-2xl shadow-lg relative group overflow-visible hover:border-slate-700 transition-all cursor-help">
              <h3 className="text-xs font-black tracking-widest uppercase text-slate-300 mb-2">Indicadores (KPI)</h3>
              <div className="overflow-x-auto w-full flex-1">
                <table className="w-full text-left text-[10px] font-bold text-slate-400 border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider text-[9px]">
                      <th className="py-2 font-black">Indicador</th><th className="py-2 font-black text-center">Valor Real</th><th className="py-2 font-black text-center">Meta</th><th className="py-2 font-black text-right">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    <tr className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2 text-white truncate max-w-[120px]">Ejecución Plan Anual</td><td className="py-2 text-center text-slate-200">{kpiPlanAnual}%</td><td className="py-2 text-center text-slate-500">85%</td><td className="py-2 text-right">{kpiPlanAnual >= 85 ? '✅' : (kpiPlanAnual >= 60 ? '⚠️' : '🚨')}</td>
                    </tr>
                    <tr className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2 text-white truncate max-w-[120px]">Salud de Controles</td><td className="py-2 text-center text-slate-200">{efectividadControlesGlobal}%</td><td className="py-2 text-center text-slate-500">80%</td><td className="py-2 text-right">{efectividadControlesGlobal >= 80 ? '✅' : (efectividadControlesGlobal >= 60 ? '⚠️' : '🚨')}</td>
                    </tr>
                    <tr className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2 text-white truncate max-w-[120px]">Oportunidad Planes</td><td className="py-2 text-center text-slate-200">{kpiOportunidad}%</td><td className="py-2 text-center text-slate-500">85%</td><td className="py-2 text-right">{kpiOportunidad >= 85 ? '✅' : (kpiOportunidad >= 60 ? '⚠️' : '🚨')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {/* TOOLTIP KPI */}
              <div className="absolute bottom-[102%] right-4 w-72 bg-[#0f172a]/95 backdrop-blur-md border border-slate-700/80 p-4 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0 text-left">
                <div className="absolute -bottom-2 right-8 w-4 h-4 bg-[#0f172a] border-b border-r border-slate-700/80 rotate-45"></div>
                <h4 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-2 border-b border-slate-700/80 pb-1.5">Tablero de Control Operativo</h4>
                <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-300 font-medium">
                  <p><b className="text-emerald-400 uppercase">📍 Origen:</b> Fusión Transversal de Módulos GRC.</p>
                  <p><b className="text-amber-400 uppercase">❓ Por qué:</b> Indicadores Clave de Riesgo (KRI).</p>
                  <p><b className="text-slate-200 uppercase">📝 Explicación:</b> Comparativa de rendimiento real en vivo frente al umbral aprobado.</p>
                </div>
              </div>
            </div>

          </div>
        );
      })()}

      {/* ─── SECCIÓN DE OPERACIONES Y CALENDARIO ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 mt-6">
        
        {/* PLANES VENCIDOS */}
        <div className="bg-[#0a1122] border border-slate-800 rounded-2xl shadow-xl p-5 flex flex-col relative group overflow-visible hover:border-slate-700 transition-all cursor-help">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-3">
              <h3 className="text-sm font-black text-slate-200">Planes Vencidos</h3>
              <span className="bg-red-500/20 text-red-400 font-bold px-2 py-0.5 rounded-md text-[10px]">{planesVencidosList.length}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[220px] scrollbar-thin">
            <table className="w-full text-left text-[10px]">
              <thead className="text-slate-500 border-b border-slate-800">
                <tr><th className="pb-2 font-bold">Plan</th><th className="pb-2 font-bold">Proceso</th><th className="pb-2 font-bold">Vencimiento</th><th className="pb-2 font-bold">Responsable</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {planesVencidosList.map((p, i) => {
                  const hallazgoAsociado = hallazgosBase.find(h => h.id === p.idHallazgo) || {};
                  return (
                  <tr key={`venc-${i}`} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 flex items-center space-x-2"><span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span><span className="font-bold text-slate-300">PLAN-{p.id}</span></td>
                    <td className="py-2.5 text-slate-400 truncate max-w-[80px]" title={hallazgoAsociado.proceso || 'N/A'}>{hallazgoAsociado.proceso || 'N/A'}</td>
                    <td className="py-2.5 text-slate-400">{formatSafeDate(p.fecha)}</td>
                    <td className="py-2.5 text-slate-400 truncate max-w-[80px]" title={p.responsable}>{p.responsable}</td>
                  </tr>
                )})}
                {planesVencidosList.length === 0 && (<tr><td colSpan="4" className="py-4 text-center text-slate-500 italic">No hay planes vencidos registrados</td></tr>)}
              </tbody>
            </table>
          </div>
          <div className="pt-3 mt-auto border-t border-slate-800/50 text-left">
             <button onClick={() => setActiveTab('planes_tab')} className="text-red-400 text-[10px] font-bold hover:underline transition-colors">Ver todos los planes vencidos →</button>
          </div>
          {/* TOOLTIP PLANES VENCIDOS */}
          <div className="absolute bottom-[102%] left-4 w-72 bg-[#0f172a]/95 backdrop-blur-md border border-slate-700/80 p-4 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0 text-left">
            <div className="absolute -bottom-2 left-8 w-4 h-4 bg-[#0f172a] border-b border-r border-slate-700/80 rotate-45"></div>
            <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2 border-b border-slate-700/80 pb-1.5">Frenos Operativos</h4>
            <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-300 font-medium">
              <p><b className="text-emerald-400 uppercase">📍 Origen:</b> Módulo de Planes.</p>
              <p><b className="text-amber-400 uppercase">❓ Por qué:</b> Son contingencias o brechas prolongadas innecesariamente.</p>
              <p><b className="text-slate-200 uppercase">📝 Explicación:</b> Compromisos correctivos que han superado el plazo formal de entrega en el servidor.</p>
            </div>
          </div>
        </div>

        {/* PRÓXIMAS AUDITORÍAS */}
        <div className="bg-[#0a1122] border border-slate-800 rounded-2xl shadow-xl p-5 flex flex-col relative group overflow-visible hover:border-slate-700 transition-all cursor-help">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-3">
              <h3 className="text-sm font-black text-slate-200">Próximas Auditorías</h3>
              <span className="bg-blue-500/20 text-blue-400 font-bold px-2 py-0.5 rounded-md text-[10px]">{proximasAuditorias.length}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[220px] scrollbar-thin">
             <table className="w-full text-left text-[10px]">
              <thead className="text-slate-500 border-b border-slate-800">
                <tr><th className="pb-2 font-bold">Auditoría</th><th className="pb-2 font-bold">Proceso</th><th className="pb-2 font-bold">Periodo</th><th className="pb-2 font-bold">Auditor</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {proximasAuditorias.map((c, i) => (
                  <tr key={`aud-${i}`} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 font-bold text-slate-300">AUD-{c.codigo || `2026-${i+1}`}</td>
                    <td className="py-2.5 text-slate-400 truncate max-w-[80px]" title={c.proceso}>{c.proceso}</td>
                    <td className="py-2.5 text-slate-400 truncate max-w-[70px]">{c.periodo}</td>
                    <td className="py-2.5 text-slate-400 truncate max-w-[80px]" title={c.responsable}>{c.responsable}</td>
                  </tr>
                ))}
                 {proximasAuditorias.length === 0 && (<tr><td colSpan="4" className="py-4 text-center text-slate-500 italic">No hay auditorías pendientes en cronograma</td></tr>)}
              </tbody>
            </table>
          </div>
          <div className="pt-3 mt-auto border-t border-slate-800/50 text-left">
             <button onClick={() => setActiveTab('plan_anual_tab')} className="text-blue-400 text-[10px] font-bold hover:underline transition-colors">Ver calendario completo →</button>
          </div>
          {/* TOOLTIP AUDITORIAS */}
          <div className="absolute bottom-[102%] left-1/2 -translate-x-1/2 w-72 bg-[#0f172a]/95 backdrop-blur-md border border-slate-700/80 p-4 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0 text-left">
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#0f172a] border-b border-r border-slate-700/80 rotate-45"></div>
            <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 border-b border-slate-700/80 pb-1.5">Avance Plan Anual</h4>
            <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-300 font-medium">
              <p><b className="text-emerald-400 uppercase">📍 Origen:</b> Cronograma Aprobado.</p>
              <p><b className="text-amber-400 uppercase">❓ Por qué:</b> Visibilidad para agendar recursos logísticos en campo.</p>
              <p><b className="text-slate-200 uppercase">📝 Explicación:</b> Procesos oficiales con cumplimiento < 100%.</p>
            </div>
          </div>
        </div>

        {/* ACTIVIDAD RECIENTE (AUDIT TRAIL) */}
        <div className="bg-[#0a1122] border border-slate-800 rounded-2xl shadow-xl p-5 flex flex-col relative group overflow-visible hover:border-slate-700 transition-all cursor-help">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-black text-slate-200">Actividad Reciente</h3>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[220px] scrollbar-thin space-y-4">
              {recentActivityList.map((act, i) => (
                <div key={`act-${i}`} className="flex items-start space-x-3 text-left">
                  <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${act.colorClass} shrink-0`}>
                    {act.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-slate-300 leading-snug"><span className="font-bold text-white">{act.type} {act.ref}</span> {String(act.accion).toLowerCase()}</p>
                    <p className="text-[9px] text-slate-500 truncate mt-0.5">Por: {act.usuario}</p>
                  </div>
                  <div className="text-[9px] text-slate-500 shrink-0 text-right whitespace-nowrap">{act.fechaStr.split(',')[0]}</div>
                </div>
              ))}
               {recentActivityList.length === 0 && (<div className="py-4 text-center text-slate-500 italic text-[10px]">No hay actividad reciente registrada en sistema</div>)}
          </div>
          {/* TOOLTIP ACTIVIDAD */}
          <div className="absolute bottom-[102%] right-4 w-72 bg-[#0f172a]/95 backdrop-blur-md border border-slate-700/80 p-4 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0 text-left">
            <div className="absolute -bottom-2 right-8 w-4 h-4 bg-[#0f172a] border-b border-r border-slate-700/80 rotate-45"></div>
            <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-2 border-b border-slate-700/80 pb-1.5">Trazabilidad de Movimientos</h4>
            <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-300 font-medium">
              <p><b className="text-emerald-400 uppercase">📍 Origen:</b> Logs en Vivo (Audit Trail).</p>
              <p><b className="text-amber-400 uppercase">❓ Por qué:</b> Principio de responsabilidad y transparencia para revisiones fiscales.</p>
              <p><b className="text-slate-200 uppercase">📝 Explicación:</b> Últimas acciones, cambios y modificaciones registradas de forma segura.</p>
            </div>
          </div>
        </div>

      </div>

      {/* ─── ANEXO INTERACTIVO DE TRAZABILIDAD COMPLETO ─── */}
      <div className="bg-[#0a1122] border border-slate-800 p-4 rounded-2xl shadow-xl text-left relative group overflow-visible hover:border-slate-700 transition-all cursor-help">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-black tracking-widest uppercase text-slate-300">
            {matrizFiltro ? `🔍 Riesgos en Cuadrante (Probabilidad: ${matrizFiltro.p} | Impacto: ${matrizFiltro.i})` : '📋 Resumen de Riesgos Críticos Recientes'}
          </h3>
          <span className="text-[10px] font-black text-slate-400 bg-[#060b16] px-2 py-1 rounded-lg border border-slate-800">Registros: {riesgosFiltradosPorMatriz.length}</span>
        </div>

        <div className="space-y-2">
          {riesgosFiltradosPorMatriz.length === 0 ? (
            <p className="text-xs font-medium text-slate-500 py-4 text-center">No se registran riesgos mapeados en esta coordenada exacta.</p>
          ) : (
            riesgosFiltradosPorMatriz.map((r, idx) => {
              const pRes = extraerNumeroPuro(r.probabilidadResidual) || 1;
              const iRes = extraerNumeroPuro(r.impactoResidual) || 1;
              const score = pRes * iRes;
              return (
                <div key={`risk-row-${idx}`} className="bg-[#060b16] border border-slate-800/80 p-3 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:border-slate-700 transition-all">
                  <div className="flex items-start space-x-3">
                    <span className="bg-blue-600/10 text-blue-400 px-2 py-1 rounded-lg font-mono text-[10px] font-black border border-blue-500/10">
                      {r.id ? `RSG-${r.id}` : `RSG-${idx + 101}`}
                    </span>
                    <div>
                      <h4 className="text-xs font-black text-slate-200">{r.proceso || 'Proceso No Asignado'} — <span className="font-semibold text-slate-400">{r.riesgo || r.descripcion || 'Riesgo sin descripción'}</span></h4>
                      <p className="text-[9px] text-slate-500 font-medium mt-0.5">Factor/Causa: {r.factorRiesgo || r.causa || 'No especificada'} | Clasificación: {r.clasificacion || r.categoria || 'Operativo'}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 text-right self-end sm:self-auto">
                    <div className="text-[10px] font-bold text-slate-400">P: <span className="text-slate-200">{r.probabilidadResidual || 1}</span> / I: <span className="text-slate-200">{r.impactoResidual || 1}</span></div>
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-md tracking-wider uppercase ${score >= 16 ? 'bg-red-500/10 text-red-400 border border-red-500/20' : score >= 10 ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'} font-mono`}>SCORE {score}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        {/* TOOLTIP ANEXO RIESGOS */}
        <div className="absolute bottom-[102%] left-1/2 -translate-x-1/2 w-72 bg-[#0f172a]/95 backdrop-blur-md border border-slate-700/80 p-4 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0 text-left">
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#0f172a] border-b border-r border-slate-700/80 rotate-45"></div>
          <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2 border-b border-slate-700/80 pb-1.5">Inspección de Cuadrante</h4>
          <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-300 font-medium">
            <p><b className="text-emerald-400 uppercase">📍 Origen:</b> Clic Interactivo en Mapa de Calor.</p>
            <p><b className="text-amber-400 uppercase">❓ Por qué:</b> Despliega el detalle exacto de los riesgos que componen cada casilla.</p>
            <p><b className="text-slate-200 uppercase">📝 Explicación:</b> Listado dinámico filtrado por la coordenada Probabilidad x Impacto.</p>
          </div>
        </div>
      </div>

    </div>
  );
}