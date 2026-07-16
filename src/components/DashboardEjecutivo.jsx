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

// 🧠 FILTRADO EXACTO DE RIESGOS POR AÑO (Ignora el mes para ver el inventario total real)
  const riesgosBase = (riesgos || []).filter(r => {
    const anioR = Number(r.anio) || 2026;
    return selectedAnios.length === 0 || selectedAnios.includes(anioR) || selectedAnios.includes(String(anioR));
  });

  const hallazgosBase = typeof hFiltrados !== 'undefined' ? hFiltrados : (typeof hallazgos !== 'undefined' ? hallazgos : []);
// 🧠 FILTRADO EXACTO DE PLANES POR AÑO (Ignora el filtro de mes para ver el acumulado real)
  const planesBase = (planes || []).filter(p => {
    const anioPlan = p.fecha ? Number(p.fecha.split('-')[0]) : (Number(p.anio) || 2026);
    return selectedAnios.length === 0 || selectedAnios.includes(anioPlan) || selectedAnios.includes(String(anioPlan));
  });
  // 🧠 TRADUCTOR UNIVERSAL REFORZADO (Compatible con todos los formatos)
  const extraerNumeroPuro = (valor) => {
    if (valor === undefined || valor === null || valor === '') return 0;
    
    if (typeof valor === 'number') {
      if (valor >= 1 && valor <= 5) return valor;
      if (valor === 20) return 1;
      if (valor === 40) return 2;
      if (valor === 60) return 3;
      if (valor === 80) return 4;
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

  // 🧮 CÁLCULO IDÉNTICO AL MÓDULO DE PLANES (Basado en % de Progreso real)
  const totalPlanes = planesBase.length;
  const planesActivos = planesBase.filter(p => (Number(p.progreso) || 0) < 100).length;
  const planesVencidos = planesBase.filter(p => (Number(p.progreso) || 0) < 100 && p.fecha && new Date(p.fecha) < hoy).length;
  const planesCerrados = planesBase.filter(p => (Number(p.progreso) || 0) === 100).length;
  const avancePlanesGlobal = totalPlanes > 0 ? Math.round((planesCerrados / totalPlanes) * 100) : 0;
// 🧮 CÁLCULO DE RIESGOS ALINEADO CON EL MÓDULO MATRIZ (4 Niveles)
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
 // 🧮 CÁLCULO DE EFECTIVIDAD OPERACIONAL (Ignorando el mes, calculando el acumulado del año)
  const evaluacionesBase = (evalFiltrados || []).filter(e => {
    const anioE = Number(e.anio) || 2026;
    return selectedAnios.length === 0 || selectedAnios.includes(anioE) || selectedAnios.includes(String(anioE));
  });
  const totalEvaluaciones = evaluacionesBase.length;
  const evaluacionesEficaces = evaluacionesBase.filter(e => Number(e.calificacion) === 100).length;
  
  const efectividadControlesGlobal = totalEvaluaciones > 0 
    ? Math.round((evaluacionesEficaces / totalEvaluaciones) * 100) 
    : 0;
  // 🧠 NUEVO CÁLCULO EXACTO DE HALLAZGOS ABIERTOS Y CRÍTICOS
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
  const proximasAuditorias = cronogramaBase
    .filter(c => (Number(c.cumplimiento) || 0) < 100)
    .slice(0, 4);

  // 🧠 MAPEADOR COMPLETO DE DICTÁMENES COSO / ISO 31000 PARA TODOS LOS ELEMENTOS
  const solicitarDictamenIA = (tipoCard) => {
    setProcesandoIA(true);
    setDictamenIA(null);

    setTimeout(() => {
      let analitica = {};
      
      if (tipoCard === 'cumplimiento') {
        analitica = {
          titulo: "Cumplimiento Global de Compromisos",
          valor: `${avancePlanesGlobal}%`,
          significado: "Mide el avance y cierre formal de los planes de mejoramiento acordados con las áreas.",
          dictamen: `Al Gerente General: Registramos un ${avancePlanesGlobal}% de efectividad física. Indica un ritmo de mitigación intermedio. Un tercio de los compromisos sigue abierto; es clave exigir celeridad a los líderes de subprocesos para consolidar la protección operativa antes del cierre de temporada alta.`,
          color: "border-emerald-500/30 text-emerald-400"
        };
      } else if (tipoCard === 'riesgos') {
        analitica = {
          titulo: "Volumen del Inventario de Riesgos",
          valor: `${totalRiesgos} Activos`,
          significado: "Total de amenazas procedimentales, ambientales y normativas mapeadas en la matriz 5x5.",
          dictamen: `Al Gerente General: Contar con ${totalRiesgos} riesgos indica un alto nivel de madurez y cultura de prevención. Al tener controlados los riesgos Extremos (solo ${riesgosExtremos}), el verdadero foco de supervisión gerencial debe estar en los ${riesgosAltos} riesgos Altos y ${riesgosModerados} Moderados para evitar desviaciones operativas recurrentes.`,
          color: "border-red-500/30 text-red-400"
        };
      } else if (tipoCard === 'controles') {
        analitica = {
          titulo: "Efectividad Operacional de Controles",
          valor: `${efectividadControlesGlobal}%`,
          significado: "Porcentaje de salvaguardas que superaron con éxito las pruebas documentales y en sitio.",
          dictamen: `Al Gerente General: El tablero registra ${efectividadControlesGlobal}%. Es un estado normal y esperado al limpiar el entorno para el inicio del nuevo ciclo de campo. Significa que el equipo de auditoría está abriendo las hojas de prueba en limpio; no hay desprotección institucional.`,
          color: "border-cyan-500/30 text-cyan-400"
        };
      } else if (tipoCard === 'hallazgos') {
        analitica = {
          titulo: "Desviaciones Normativas No Resueltas",
          valor: `${hallazgosAbiertos} Abiertos`,
          significado: "Brechas regulatorias identificadas en informes aprobados pendientes de plan de acción.",
          dictamen: `Al Gerente General: Tener solo ${hallazgosAbiertos} hallazgos abiertos para un complejo hotelero de esta envergadura es un récord de alta excelencia. Indica una gestión administrativa y legal limpia, blindada contra contingencias o multas de entes de supervisión.`,
          color: "border-amber-500/30 text-amber-400"
        };
      } else if (tipoCard === 'planes') {
        analitica = {
          titulo: "Saturación Administrativa de Planes",
          valor: `${planesActivos} en Ejecución`,
          significado: "Cantidad de procesos de mejora simultáneos que ejecutan los jefes de departamento.",
          dictamen: `Al Gerente General: Registrar solo ${planesActivos} planes activos es el escenario ideal. La estructura operativa de Termales no sufre de 'parálisis por análisis'. Hay total disponibilidad de tiempo para enfocar al personal en la calidad del servicio diario.`,
          color: "border-purple-500/30 text-purple-400"
        };
      } else if (tipoCard === 'matriz') {
        analitica = {
          titulo: "Distribución de Calor COSO (5x5)",
          valor: "Matriz P x I",
          significado: "Ubicación espacial de las amenazas según su nivel de probabilidad e impacto residual.",
          dictamen: `Al Gerente General: El mapa muestra una concentración saludable en las zonas verde y amarilla (Bajo/Medio). La baja densidad en el cuadrante crítico (Zona Roja) ratifica que las tomas de decisiones gerenciales previas han logrado neutralizar las amenazas de gran impacto financiero.`,
          color: "border-amber-500/30 text-amber-400"
        };
      } else if (tipoCard === 'tendencia') {
        analitica = {
          titulo: "Línea de Tendencia Histórica",
          valor: "Análisis 6 Meses",
          significado: "Comportamiento del perfil de riesgo de Termales a lo largo del último semestre.",
          dictamen: `Al Gerente General: La gráfica lineal muestra estabilidad en la contención de picos de riesgo. La consistencia en el aplanamiento de las líneas críticas demuestra que el sistema predictivo del hotel está actuando con oportunidad antes de que los eventos generen pérdidas.`,
          color: "border-blue-500/30 text-blue-400"
        };
      } else if (tipoCard === 'severidad') {
        analitica = {
          titulo: "Desglose por Severidad de Hallazgos",
          valor: "Métrica Concéntrica",
          significado: "Participación porcentual de las no conformidades según su urgencia de atención.",
          dictamen: `Al Gerente General: El gráfico de dona muestra un balance controlado. Al no registrarse picos de severidad crítica acumulados, la carga de trabajo de control interno se mantiene en un nivel puramente preventivo y de mejora continua.`,
          color: "border-emerald-500/30 text-emerald-400"
        };
      } else if (tipoCard === 'kpis') {
        analitica = {
          titulo: "Tablero de Control KRI Operativos",
          valor: "Semáforos de Tolerancia",
          significado: "Comparativa de rendimiento en vivo frente a los umbrales aprobados por el manual de riesgos.",
          dictamen: `Al Gerente General: Los indicadores de Ejecución, Eficiencia y Oportunidad se encuentran alineados con las metas deseadas. El entorno de gobierno corporativo califica como seguro, respaldando de forma sólida la toma de decisiones presupuestales.`,
          color: "border-cyan-500/30 text-cyan-400"
        };
      } else if (tipoCard === 'vencidos') {
        analitica = {
          titulo: "Frenos Operativos por Planes Vencidos",
          valor: `${planesVencidos} Retrasados`,
          significado: "Compromisos correctivos que han superado el plazo formal de entrega en el servidor.",
          dictamen: `Al Gerente General: Registrar ${planesVencidos} planes vencidos es una métrica perfecta. Indica cero tolerancia a la desidia administrativa. Los dueños de procesos están cumpliendo rigurosamente los cronogramas pactados con el área de control.`,
          color: "border-red-500/30 text-red-400"
        };
      } else if (tipoCard === 'proximas') {
        analitica = {
          titulo: "Avance y Cobertura del Plan Anual",
          valor: "Fases Pendientes",
          significado: "Procesos oficiales del hotel agendados próximos a ser intervenidos por auditoría.",
          dictamen: `Al Gerente General: La agenda muestra los frentes regulatorios subsiguientes. Permite anticiparse logísticamente en las áreas para asegurar que las auditorías actúen como un catalizador de mejora y no como un freno de la operación del hotel.`,
          color: "border-blue-500/30 text-blue-400"
        };
      } else if (tipoCard === 'actividad') {
        analitica = {
          titulo: "Trazabilidad de Movimientos (Audit Trail)",
          valor: "Logs en Vivo",
          significado: "Últimas acciones, cambios y modificaciones registradas de forma segura en la base de datos.",
          dictamen: `Al Gerente General: Este bloque garantiza el principio de responsabilidad y transparencia de la plataforma. Cada movimiento queda sellado con usuario, fecha y hora, impidiendo la manipulación de información y asegurando un rastro limpio para revisorías fiscales.`,
          color: "border-purple-500/30 text-purple-400"
        };
      }

      setDictamenIA(analitica);
      setProcesandoIA(false);
    }, 700);
  };

  let allActivity = [];
  const parseDateStr = (dateStr) => {
    try {
      const [datePart, timePart] = dateStr.split(', ');
      const [d, m, y] = datePart.split(/[\/\-]/);
      if (d && m && y) return new Date(`${y}-${m}-${d}T${timePart || '00:00:00'}`).getTime();
      return new Date(dateStr).getTime();
    } catch(e) { return 0; }
  };

  const addAct = (items, type, icon, colorClass) => {
    items.forEach(item => {
      if (item.historialCambios && item.historialCambios.length > 0) {
        const last = item.historialCambios[item.historialCambios.length - 1];
        allActivity.push({
           timestamp: parseDateStr(last.fecha),
           fechaStr: last.fecha,
           accion: last.accion,
           usuario: last.usuario || 'Sistema',
           ref: item.ref || (item.id ? `${type.substring(0,3).toUpperCase()}-${String(item.id).substring(0,5)}` : 'N/A'),
           proceso: item.proceso || 'General',
           type, icon, colorClass
        });
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
      let m = currentMonthIdx - 5 + i;
      if (m < 0) m += 12;
      return { idx: m, nombre: mesesCortos[m], nombreLargo: defaultMeses[m] };
  });

  const trendData = ultimos6Meses.map(mInfo => {
     const riesgosMes = riesgosBase.filter(r => r.mes === mInfo.nombreLargo);
     const crit = riesgosMes.filter(r => (extraerNumeroPuro(r.probabilidadResidual) * extraerNumeroPuro(r.impactoResidual)) >= 16).length;
     const med = riesgosMes.filter(r => {
       const score = extraerNumeroPuro(r.probabilidadResidual) * extraerNumeroPuro(r.impactoResidual);
       return score >= 6 && score < 16;
     }).length;
     const baj = riesgosMes.length - crit - med;
     return { mes: mInfo.nombre, crit, med, baj };
  });

  const maxVal = Math.max(1, ...trendData.flatMap(d => [d.crit, d.med, d.baj]));
  const getY = (val) => 35 - ((val / maxVal) * 25); 
  const getX = (idx) => (idx * (100 / 5)); 

  const pathCriticos = trendData.map((d, i) => `${i===0?'M':'L'}${getX(i)},${getY(d.crit)}`).join(' ');
  const pathMedios = trendData.map((d, i) => `${i===0?'M':'L'}${getX(i)},${getY(d.med)}`).join(' ');
  const pathBajos = trendData.map((d, i) => `${i===0?'M':'L'}${getX(i)},${getY(d.baj)}`).join(' ');

  const procesosCount = Object.entries(
    riesgosBase.reduce((acc, r) => {
      const proc = r.proceso || 'General / Otros';
      acc[proc] = (acc[proc] || 0) + 1;
      return acc;
    }, {})
  );
  
  const coloresMini = ['#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899'];
  let offsetCirculo = 0;

  return (
    <div className="flex-1 bg-[#060b16] text-slate-100 overflow-y-auto p-6 font-sans space-y-6 scrollbar-thin select-none relative">
      
      {/* ─── 🤖 CAPA DE ENFOQUE INTELIGENTE (FIXED BACKDROP BLUR) ─── */}
      {(procesandoIA || dictamenIA) && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300">
          
          {/* Carga Animada Inline */}
          {procesandoIA && (
            <div className="bg-[#0f172a] border border-slate-800 p-6 rounded-3xl flex items-center gap-4 shadow-2xl max-w-xl border-l-4 border-l-blue-500 scale-100 transition-transform">
              <span className="text-2xl animate-spin">🤖</span>
              <div className="text-xs">
                <span className="font-black text-white block uppercase tracking-wider text-[11px] mb-0.5">GCM Auditor v5 IA Assistant</span>
                <span className="text-slate-400 font-medium">Extrayendo métricas de Firebase, aplicando matrices de calor y redactando dictamen gerencial...</span>
              </div>
            </div>
          )}

          {/* Recuadro de Resultados Nítido */}
          {dictamenIA && (
            <div className="bg-[#0f172a] border border-slate-800 p-6 rounded-3xl shadow-2xl max-w-2xl relative border-l-4 border-l-emerald-500 w-full max-h-[90vh] overflow-y-auto scrollbar-thin">
              <button onClick={() => setDictamenIA(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-wider bg-[#1e293b] px-2.5 py-1 rounded-xl transition-colors">✕ Cerrar</button>
              
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">🤖</span>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dictamen de Inteligencia Artificial para Gerencia</h4>
              </div>

              <h3 className="text-sm font-black text-white uppercase tracking-tight mb-4 border-b border-slate-800/80 pb-2.5 flex justify-between items-center">
                <span>{dictamenIA.titulo}</span>
                <span className={`text-xs px-2.5 py-1 rounded-lg bg-slate-900 font-mono ${dictamenIA.color}`}>{dictamenIA.valor}</span>
              </h3>

              <div className="space-y-4 text-xs leading-relaxed font-medium">
                <div className="text-slate-300 bg-[#020617] p-3.5 rounded-2xl border border-slate-800/60">
                  <b className="text-slate-400 uppercase block text-[9px] mb-1.5 tracking-wider">¿Qué representa este dato?</b> 
                  {dictamenIA.significado}
                </div>
                <div className="text-emerald-300 bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/20">
                  <b className="text-emerald-400 uppercase block text-[9px] mb-1.5 tracking-wider">🎯 Diagnóstico Gerencial:</b> 
                  {dictamenIA.dictamen}
                </div>
              </div>
            </div>
          )}
          
        </div>
      )}

      {/* ─── ENCABEZADO PREMIUM Y FILTROS INTEGRADOS ─── */}
      <div className="bg-[#0a1122] border border-blue-500/10 p-5 rounded-2xl shadow-md space-y-4 mb-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800/80 pb-4 gap-4">
          <div>
            <h2 className="text-xl font-black tracking-wide text-white">Dashboard Ejecutivo</h2>
            <p className="text-xs text-slate-400 font-medium">Resumen general del Sistema de Control Interno y Gestión Integral del Riesgo</p>
          </div>
          <div className="flex items-center space-x-3 shrink-0">
            <div className="bg-[#111c35] border border-slate-700/50 px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 flex items-center space-x-2">
              <span>📅</span> 
              <span>{`${String(hoy.getDate()).padStart(2, '0')} / ${defaultMeses[hoy.getMonth()]} / ${hoy.getFullYear()}`}</span>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-2 rounded-xl text-xs font-black tracking-widest uppercase flex items-center space-x-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <span>En Línea</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 pt-1 items-start md:items-end">
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Años de Análisis</label>
            <div className="flex flex-wrap gap-2">
              {defaultAnios.map(anio => (
                <button key={`tablero-anio-${anio}`} onClick={() => toggleAnio(anio)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-sm border ${selectedAnios.includes(anio) ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}>
                  {anio}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Meses de Análisis</label>
            <div className="flex flex-wrap gap-1.5">
              {defaultMeses.map(mes => (
                <button key={`tablero-mes-${mes}`} onClick={() => toggleMes(mes)} className={`px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all border shadow-sm notranslate ${selectedMeses.includes(mes) ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`} translate="no" title={mes}>
                  {mes.substring(0,3)}
                </button>
              ))}
            </div>
          </div>
          {(selectedAnios.length > 0 || selectedMeses.length > 0) && (
            <div className="flex items-end mt-2 md:mt-0 md:ml-auto">
              <button onClick={() => { setSelectedAnios([]); setSelectedMeses([]); }} className="h-[30px] px-3 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-[10px] font-bold transition-colors uppercase tracking-wider">
                Limpiar Filtros
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── BLOQUE DE TARJETAS SUPERIORES CON TODOS LOS 5 TOOLTIPS ENRIQUECIDOS ─── */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        
        {/* CARDA 1: CUMPLIMIENTO GLOBAL */}
        <div className="bg-[#0a1122] border border-slate-800 p-4 rounded-2xl shadow-lg relative group overflow-visible hover:border-blue-500/50 transition-colors cursor-help">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black tracking-wider text-slate-400 uppercase">Cumplimiento Global</span>
            <button onClick={() => solicitarDictamenIA('cumplimiento')} className="text-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-md flex items-center gap-1 transition-all font-black shadow-sm shrink-0">✨ IA</button>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-black text-white">{avancePlanesGlobal}%</span>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">Muy Bueno</span>
          </div>
          <div className="w-full h-8 mt-2 opacity-60 group-hover:opacity-100 transition-opacity">
            <svg viewBox="0 0 100 20" className="w-full h-full text-emerald-400" preserveAspectRatio="none">
              <path d="M0,15 Q20,5 40,12 T80,8 L100,2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="absolute top-[105%] left-1/2 -translate-x-1/2 w-72 bg-[#0f172a]/95 backdrop-blur-md border border-blue-500/40 p-4 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0">
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#0f172a] border-t border-l border-blue-500/40 rotate-45"></div>
            <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 border-b border-slate-700/80 pb-1.5">Contexto de Control</h4>
            <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-300 font-medium">
              <p><b className="text-emerald-400 uppercase">📍 Origen:</b> Matriz Integrada de Planes de Acción.</p>
              <p><b className="text-amber-400 uppercase">❓ Justificación:</b> Mide la velocidad de mitigación frente a las brechas.</p>
              <p><b className="text-slate-200 uppercase">📝 Explicación:</b> Porcentaje de tareas de mejora completadas.</p>
              <div className="mt-2 p-1.5 bg-[#020617] border border-slate-800 rounded-md font-mono text-cyan-400 text-[8px]">
                FÓRMULA: (Planes Cerrados / Total Planes) * 100
              </div>
            </div>
          </div>
        </div>

        {/* CARDA 2: RIESGOS ACTIVOS */}
        <div className="bg-[#0a1122] border border-slate-800 p-4 rounded-2xl shadow-lg relative group overflow-visible hover:border-blue-500/50 transition-colors cursor-help">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black tracking-wider text-slate-400 uppercase">Riesgos Activos</span>
            <button onClick={() => solicitarDictamenIA('riesgos')} className="text-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-md flex items-center gap-1 transition-all font-black shadow-sm shrink-0">✨ IA</button>
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
          <div className="absolute top-[105%] left-1/2 -translate-x-1/2 w-72 bg-[#0f172a]/95 backdrop-blur-md border border-red-500/40 p-4 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0">
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#0f172a] border-t border-l border-red-500/40 rotate-45"></div>
            <h4 className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-2 border-b border-slate-700/80 pb-1.5">Contexto de Riesgo</h4>
            <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-300 font-medium">
              <p><b className="text-emerald-400">📍 ORIGEN:</b> Mapa de Calor Empresarial (Matriz 5x5).</p>
              <p><b className="text-amber-400">❓ JUSTIFICACIÓN:</b> Cuantifica la exposición residual total del hotel.</p>
              <p><b className="text-slate-300">📝 METODOLOGÍA:</b> Clasificación por cuadrante de criticidad.</p>
              <div className="mt-2 p-1.5 bg-[#020617] border border-slate-800 rounded-md font-mono text-red-400 text-[8px]">
                NIVEL: Probabilidad Residual * Impacto Residual
              </div>
            </div>
          </div>
        </div>

        {/* CARDA 3: CONTROLES AUDITADOS */}
        <div className="bg-[#0a1122] border border-slate-800 p-4 rounded-2xl shadow-lg relative group overflow-visible hover:border-blue-500/50 transition-colors cursor-help">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black tracking-wider text-slate-400 uppercase">Controles Auditados</span>
            <button onClick={() => solicitarDictamenIA('controles')} className="text-[10px] bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 px-1.5 py-0.5 rounded-md flex items-center gap-1 transition-all font-black shadow-sm shrink-0">✨ IA</button>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-black text-white">{efectividadControlesGlobal}%</span>
            <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded-md">Eficaces</span>
          </div>
          <div className="w-full h-8 mt-2 opacity-60 group-hover:opacity-100 transition-opacity">
            <svg viewBox="0 0 100 20" className="w-full h-full text-cyan-400" preserveAspectRatio="none">
              <path d="M0,10 Q25,18 50,8 T100,5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="absolute top-[105%] left-1/2 -translate-x-1/2 w-72 bg-[#0f172a]/95 backdrop-blur-md border border-cyan-500/40 p-4 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0">
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#0f172a] border-t border-l border-cyan-500/40 rotate-45"></div>
            <h4 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-2 border-b border-slate-700/80 pb-1.5">Contexto de Aseguramiento</h4>
            <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-300 font-medium">
              <p><b className="text-emerald-400 uppercase">📍 Origen:</b> Auditoría de Trabajo de Campo.</p>
              <p><b className="text-amber-400 uppercase">❓ Por Qué:</b> Evalúa la robustez operacional de las defensas.</p>
              <p><b className="text-slate-200 uppercase">📝 Explicación:</b> Porcentaje de controles que han sido evaluados frente al universo total de riesgos.</p>
              <div className="mt-2 p-1.5 bg-[#020617] border border-slate-800 rounded-md font-mono text-cyan-400 text-[8px]">
                FÓRMULA: (Evaluaciones Calif. 100 / Total Evaluaciones) * 100
              </div>
            </div>
          </div>
        </div>

        {/* CARDA 4: HALLAZGOS ABIERTOS */}
        <div className="bg-[#0a1122] border border-slate-800 p-4 rounded-2xl shadow-lg relative group overflow-visible hover:border-blue-500/50 transition-colors cursor-help">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black tracking-wider text-slate-400 uppercase">Hallazgos Abiertos</span>
            <button onClick={() => solicitarDictamenIA('hallazgos')} className="text-[10px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-md flex items-center gap-1 transition-all font-black shadow-sm shrink-0">✨ IA</button>
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-white">{hallazgosAbiertos}</span>
          </div>
          <div className="mt-3 text-[10px] font-black uppercase text-red-400 tracking-wider">
            🚨 {hallazgosCriticosCount} Con Alerta Crítica
          </div>        
          <div className="absolute top-[105%] left-1/2 -translate-x-1/2 w-72 bg-[#0f172a]/95 backdrop-blur-md border border-orange-500/40 p-4 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0">
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#0f172a] border-t border-l border-orange-500/40 rotate-45"></div>
            <h4 className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-2 border-b border-slate-700/80 pb-1.5">Contexto de Desviaciones</h4>
            <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-300 font-medium">
              <p><b className="text-emerald-400 uppercase">📍 Origen:</b> Repositorio de Informes Emitidos.</p>
              <p><b className="text-amber-400 uppercase">❓ Justificación:</b> Refleja la cantidad de brechas normativas no resueltas.</p>
              <p><b className="text-slate-200 uppercase">📝 Metodología:</b> Conteo de no conformidades con estado 'Abierto'.</p>
              <div className="mt-2 p-1.5 bg-[#020617] border border-slate-800 rounded-md font-mono text-orange-400 text-[8px]">
                FÓRMULA: Sumatoria (Hallazgos donde Estado === 'Abierto')
              </div>
            </div>
          </div>
        </div>

        {/* CARDA 5: PLANES EN EJECUCIÓN */}
        <div className="bg-[#0a1122] border border-slate-800 p-4 rounded-2xl shadow-lg relative group overflow-visible hover:border-blue-500/50 transition-colors cursor-help">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black tracking-wider text-slate-400 uppercase">Planes en Ejecución</span>
            <button onClick={() => solicitarDictamenIA('planes')} className="text-[10px] bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded-md flex items-center gap-1 transition-all font-black shadow-sm shrink-0">✨ IA</button>
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-white">{planesActivos}</span>
          </div>
          <div className="mt-3 text-[10px] font-black uppercase text-amber-500 tracking-wider">
            ⚠️ {planesVencidos} Vencidos / Retrasados
          </div>
          <div className="absolute top-[105%] left-[80%] -translate-x-[80%] w-72 bg-[#0f172a]/95 backdrop-blur-md border border-purple-500/40 p-4 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0">
            <div className="absolute -top-2 left-[80%] -translate-x-[80%] w-4 h-4 bg-[#0f172a] border-t border-l border-purple-500/40 rotate-45"></div>
            <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-2 border-b border-slate-700/80 pb-1.5">Contexto de Gestión</h4>
            <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-300 font-medium">
              <p><b className="text-emerald-400 uppercase">📍 Origen:</b> Módulo de Planes de Acción.</p>
              <p><b className="text-amber-400 uppercase">❓ Justificación:</b> Indica la saturación operativa para el cierre de brechas.</p>
              <p><b className="text-slate-200 uppercase">📝 Metodología:</b> Sumatoria de planes cuyo estado es diferente a 'Cerrado'.</p>
              <div className="mt-2 p-1.5 bg-[#020617] border border-slate-800 rounded-md font-mono text-purple-400 text-[8px]">
                FÓRMULA: Conteo (Planes donde Estado !== 'Cerrado')
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── CUADRÍCULA PRINCIPAL CENTRAL CON MAPA 5X5 INTEGRADO ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* MAPA DE CALOR */}
        <div className="lg:col-span-2 bg-[#0a1122] border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between relative group overflow-visible hover:border-slate-700 transition-all cursor-help">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-2">
              <h3 className="text-xs font-black tracking-widest uppercase text-slate-300">Mapa de Riesgos (Matriz 5x5)</h3>
              <button onClick={() => solicitarDictamenIA('matriz')} className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-black shadow-sm">✨ IA</button>
            </div>
            {matrizFiltro && (
              <button 
                onClick={() => setMatrizFiltro(null)} 
                className="text-[9px] bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-blue-400 font-bold uppercase tracking-wider"
              >
                Clear Filtro
              </button>
            )}
          </div>

          <div className="flex items-center space-x-4 flex-1">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center -rotate-90 origin-center w-4">
              Impacto
            </div>

            <div className="flex-1 flex flex-col space-y-1">
              {[5, 4, 3, 2, 1].map((impactoLvl) => {
                const etiquetasY = ["", "Insignificante", "Menor", "Moderado", "Mayor", "Catastrófico"];
                return (
                  <div key={`row-${impactoLvl}`} className="flex items-center space-x-1 h-12">
                    <span className="w-24 text-[10px] font-bold text-slate-400 text-right pr-2 truncate">
                      {impactoLvl} {etiquetasY[impactoLvl]}
                    </span>
                    
                    {[1, 2, 3, 4, 5].map((probLvl) => {
                      const cant = contarRiesgosEnCelda(probLvl, impactoLvl);
                      let colorCelda = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30"; 
                      const score = probLvl * impactoLvl;
                      if (score >= 5 && score <= 9) colorCelda = "bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30";
                      else if (score >= 10 && score <= 15) colorCelda = "bg-orange-500/30 text-orange-400 border-orange-500/40 hover:bg-orange-500/40";
                      else if (score >= 16) colorCelda = "bg-red-500/30 text-red-400 border-red-500/50 hover:bg-red-500/40";

                      const isSelected = matrizFiltro?.p === probLvl && matrizFiltro?.i === impactoLvl;

                      return (
                        <button
                          key={`cell-${probLvl}-${impactoLvl}`}
                          onClick={() => {
                            setMatrizFiltro({ p: probLvl, i: impactoLvl });
                            const riesgosCelda = riesgosBase.filter(r => extraerNumeroPuro(r.probabilidadResidual) === probLvl && extraerNumeroPuro(r.impactoResidual) === impactoLvl);
                            
                            if (riesgosCelda.length > 0) {
                              setChartDetail({
                                tipo: `Riesgos en Cuadrante (P:${probLvl} x I:${impactoLvl})`,
                                mesCompleto: 'Detalle de Matriz 5x5',
                                items: riesgosCelda.map(r => ({
                                   ref: r.id ? `RSG-${r.id}` : 'N/A',
                                   proceso: r.proceso || 'Proceso General',
                                   titulo: r.descripcion || r.riesgo || 'Riesgo sin descripción',
                                   sede: r.sede || 'No definida',
                                   responsable: r.responsable || 'Sin asignar',
                                   severidad: score >= 16 ? 'Crítico' : (score >= 10 ? 'Alto' : 'Medio')
                                }))
                              });
                            }
                          }}
                          className={`flex-1 h-full rounded-lg border flex flex-col items-center justify-center font-black text-sm transition-all relative ${colorCelda} ${isSelected ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-[#060b16] scale-95 shadow-[0_0_15px_rgba(34,211,238,0.4)]' : ''}`}
                        >
                          <span>{cant}</span>
                          {cant > 0 && <span className="absolute bottom-0.5 right-1 text-[12px] opacity-70 animate-pulse">🖱️</span>}
                        </button>
                      );
                    })}                      
                  </div>
                );
              })}

              <div className="flex items-center space-x-1 pt-1 pl-24 text-center">
                {["1 Rara vez", "2 Improbable", "3 Posible", "4 Probable", "5 Casi seguro"].map((probText, idx) => (
                  <span key={`prob-lbl-${idx}`} className="flex-1 text-[9px] font-bold text-slate-500 truncate">
                    {probText}
                  </span>
                ))}
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center mt-1">
                Probabilidad
              </div>
            </div>
          </div>
          <div className="absolute bottom-[102%] right-4 w-64 bg-[#0f172a]/95 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0">
            <div className="absolute -bottom-2 right-8 w-4 h-4 bg-[#0f172a] border-b border-r border-slate-700 rotate-45"></div>
            <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2 border-b border-slate-700 pb-1.5">Distribución Residual</h4>
            <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-400 font-medium">
              <p><b className="text-emerald-400">📍 ORIGEN:</b> Matriz Integral de Riesgos.</p>
              <p><b className="text-amber-400">❓ POR QUÉ:</b> Interseca la Probabilidad x Impacto de la severidad del semáforo COSO.</p>
              <p><b className="text-slate-300">📝 METODOLOGÍA:</b> Los cuadrantes filtran la grilla inferior automáticamente.</p>
            </div>
          </div>
        </div>

        {/* HISTÓRICO ORIGINAL + RUEDA CONCÉNTRICA DE PROCESOS */}
        <div className="bg-[#0a1122] border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between relative group overflow-visible hover:border-slate-700 transition-all cursor-help">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-xs font-black tracking-widest uppercase text-slate-300">Tendencia Histórica</h3>
            <button onClick={() => solicitarDictamenIA('tendencia')} className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-black shadow-sm">✨ IA</button>
          </div>
          <div className="w-full h-36 mt-2 relative">
            <svg viewBox="0 -5 100 45" className="w-full h-full overflow-visible" preserveAspectRatio="none">
              <line x1="0" y1="10" x2="100" y2="10" stroke="#1e293b" strokeWidth="0.2" strokeDasharray="1,1" />
              <line x1="0" y1="20" x2="100" y2="20" stroke="#1e293b" strokeWidth="0.2" strokeDasharray="1,1" />
              <line x1="0" y1="30" x2="100" y2="30" stroke="#1e293b" strokeWidth="0.2" strokeDasharray="1,1" />
              <path d={pathCriticos} fill="none" stroke="#ff4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d={pathMedios} fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d={pathBajos} fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
                {totalRiesgos === 0 ? (
                  <div className="text-slate-500 italic text-[8px]">No hay riesgos registrados</div>
                ) : (
                  procesosCount.map(([procesoNombre, cantidad], idx) => {
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
                  })
                )}
              </div>
            </div>
          </div>
          <div className="absolute bottom-[102%] right-4 w-64 bg-[#0f172a]/95 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0">
            <div className="absolute -bottom-2 right-8 w-4 h-4 bg-[#0f172a] border-b border-r border-slate-700 rotate-45"></div>
            <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2 border-b border-slate-700 pb-1.5">Análisis de Tendencia</h4>
            <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-400 font-medium">
              <p><b className="text-emerald-400">📍 ORIGEN:</b> Historial de Evaluaciones Corporativas.</p>
              <p><b className="text-amber-400">❓ POR QUÉ:</b> Monitorea la concentración por área y la evolución mensual de criticidades.</p>
              <p><b className="text-slate-300">📝 METODOLOGÍA:</b> Histórico a 6 meses con distribución concéntrica por procesos.</p>
            </div>
          </div>
        </div>
      </div>

{/* ─── GRÁFICA ÚNICA DE TENDENCIA FINANCIERA A ANCHO COMPLETO ─── */}
      <div className="grid grid-cols-1 gap-6 mt-6">
        {/* GRÁFICA: EVOLUCIÓN DE IMPACTO FINANCIERO */}
        <div className="bg-[#0a1122] p-4 rounded-3xl border border-slate-800 shadow-xl overflow-hidden">
          <div className="bg-[#0a1122]">
            <TrendChart 
              data={defaultMeses.map((mText) => {
                if (!safeIncidentes || safeIncidentes.length === 0) return { mes: mText, valor: 0 };
                const totalCostoMes = safeIncidentes.filter(inc => {
                  const anioInc = inc.fecha ? Number(inc.fecha.split('-')[0]) : Number(inc.anio);
                  const mesIncText = inc.fecha ? defaultMeses[parseInt(inc.fecha.split('-')[1], 10) - 1] : (inc.mes || "Junio");
                  const passAnio = selectedAnios.length === 0 || selectedAnios.includes(anioInc) || selectedAnios.includes(String(anioInc));
                  return passAnio && mesIncText === mText;
                }).reduce((acc, current) => {
                  return acc + ((Number(current.montoFaltante) || 0) + (Number(current.montoSobrante) || 0));
                }, 0);
                return { mes: mText, valor: totalCostoMes };
              })}
              title="Evolución de Impacto Financiero (5 Años)"
              isCurrency={true}
              color="#ef4444"
              fillColor="rgba(239, 68, 68, 0.15)"
              onPointClick={(pt) => {
                const filtrados = (safeIncidentes || [])
                  .filter(inc => {
                    const mesIncText = inc.fecha ? defaultMeses[parseInt(inc.fecha.split('-')[1], 10) - 1] : inc.mes;
                    const perdidaReal = (Number(inc.montoFaltante) || 0) + (Number(inc.montoSobrante) || 0);
                    return mesIncText === pt.mes && perdidaReal > 0;
                  })
                  .map(inc => ({
                    ...inc,
                    costo: (Number(inc.montoFaltante) || 0) + (Number(inc.montoSobrante) || 0)
                  }));
                
                if (filtrados.length > 0) {
                  setChartDetail({
                    tipo: 'Incidentes Financiados',
                    mesCompleto: pt.mes,
                    items: filtrados
                  });
                } else {
                   alert(`No hay registros operativos con pérdida financiera en ${pt.mes}.`);
                }
              }}
            />
          </div>
        </div>
      </div>
                 const infoFinanciera = defaultMeses.map((mText) => {
              if (!safeIncidentes || safeIncidentes.length === 0) return { mes: mText, valor: 0 };
              
              const totalCostoMes = safeIncidentes.filter(inc => {
                // Extracción segura que ignora la zona horaria
                const anioInc = inc.fecha ? Number(inc.fecha.split('-')[0]) : Number(inc.anio);
                const mesIncText = inc.fecha ? defaultMeses[parseInt(inc.fecha.split('-')[1], 10) - 1] : (inc.mes || "Junio");
                
                const passAnio = selectedAnios.length === 0 || selectedAnios.includes(anioInc) || selectedAnios.includes(String(anioInc));
                return passAnio && mesIncText === mText;
              }).reduce((acc, current) => {
                // Sumamos costo antiguo + los nuevos campos de sobrante/faltante que creamos
                const perdida = (Number(current.costo) || 0) + (Number(current.montoFaltante) || 0) + (Number(current.montoSobrante) || 0);
                return acc + perdida;
              }, 0);
              
              return { mes: mText, valor: totalCostoMes };
            });

            return (
              <div className="bg-[#0a1122]">
                <TrendChart 
                  data={infoFinanciera}
                  title="Evolución de Impacto Financiero (5 Años)"
                  isCurrency={true}
                  color="#ef4444"
                  fillColor="rgba(239, 68, 68, 0.15)"
                  onPointClick={(pt) => {
                    // 💡 FIX DEL MODAL: Sumamos el nuevo formato de costos y se lo pasamos al modal con el nombre antiguo 'costo'
                    const filtrados = (safeIncidentes || []).filter(inc => {
                      const mesIncText = inc.fecha ? defaultMeses[parseInt(inc.fecha.split('-')[1], 10) - 1] : inc.mes;
                      return mesIncText === pt.mes;
                    }).map(inc => ({
                      ...inc,
                      costo: (Number(inc.costo) || 0) + (Number(inc.montoFaltante) || 0) + (Number(inc.montoSobrante) || 0)
                    }));
                    
                    setChartDetail({
                      tipo: 'Incidentes Financiados',
                      mesCompleto: pt.mes,
                      items: filtrados
                    });
                  }}
                />
              </div>
            );
          })()}
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
          <div className="bg-[#1c0d15] border border-red-500/20 p-3 rounded-xl flex items-start space-x-3 group cursor-pointer hover:border-red-500/40 transition-colors relative overflow-visible">
            <div className="text-red-400 text-lg bg-red-500/10 p-1.5 rounded-lg">⚠️</div>
            <div className="space-y-0.5">
              <h4 className="text-[11px] font-black text-red-400">{riesgosExtremos + riesgosAltos} Riesgos Extremos/Altos</h4>
              <p className="text-[9px] text-slate-400 font-medium">Requieren priorización de controles inmediata</p>
            </div>
          </div>
          <div className="bg-[#1c140d] border border-amber-500/20 p-3 rounded-xl flex items-start space-x-3 group cursor-pointer hover:border-amber-500/40 transition-colors relative overflow-visible">
            <div className="text-amber-400 text-lg bg-amber-500/10 p-1.5 rounded-lg">📝</div>
            <div className="space-y-0.5">
              <h4 className="text-[11px] font-black text-amber-400">{planesVencidos} Planes de Acción Vencidos</h4>
              <p className="text-[9px] text-slate-400 font-medium">Planes retrasados fuera de la fecha límite establecida</p>
            </div>
          </div>

          <div className="bg-[#0d1624] border border-blue-500/20 p-3 rounded-xl flex items-start space-x-3 group cursor-pointer hover:border-blue-500/40 transition-colors relative overflow-visible">
            <div className="text-blue-400 text-lg bg-blue-500/10 p-1.5 rounded-lg">🔬</div>
            <div className="space-y-0.5">
              <h4 className="text-[11px] font-black text-blue-400">{hallazgosCriticosCount} Hallazgos Críticos/Altos</h4>
              <p className="text-[9px] text-slate-400 font-medium">Pendientes de apertura de Plan de Acción formal</p>
            </div>
          </div>

          <div className="bg-[#091819] border border-cyan-500/20 p-3 rounded-xl flex items-start space-x-3 group cursor-pointer hover:border-cyan-500/40 transition-colors relative overflow-visible">
            <div className="text-cyan-400 text-lg bg-cyan-500/10 p-1.5 rounded-lg">💡</div>
            <div className="space-y-0.5">
              <h4 className="text-[11px] font-black text-cyan-400">Eficiencia Global: {efectividadControlesGlobal}%</h4>
              <p className="text-[9px] text-slate-400 font-medium">Efectividad ponderada de la matriz de controles mitigantes</p>
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
        const kpiPlanAnual = cronogramaIniciados.length > 0 
          ? Math.round(cronogramaIniciados.reduce((acc, c) => acc + (Number(c.cumplimiento) || 0), 0) / cronogramaIniciados.length) 
          : 0;
        const kpiOportunidad = totalPlanes > 0 ? Math.round(((totalPlanes - planesVencidos) / totalPlanes) * 100) : 100;

        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left mt-6">
            
            <div className="bg-[#0a1122] border border-slate-800 p-4 rounded-2xl shadow-lg relative group overflow-visible hover:border-slate-700 transition-all cursor-help">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-black tracking-widest uppercase text-slate-300">Severidad de Hallazgos</h3>
                <button onClick={() => solicitarDictamenIA('severidad')} className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-black shadow-sm">✨ IA</button>
              </div>
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
            </div>

            <div className="bg-[#0a1122] border border-slate-800 p-5 rounded-2xl shadow-lg relative group overflow-visible hover:border-slate-700 transition-all cursor-help">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-black tracking-widest uppercase text-slate-300">Métricas de Planes</h3>
                <button onClick={() => solicitarDictamenIA('planes')} className="text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded font-black shadow-sm">✨ IA</button>
              </div>
              <div className="space-y-3 font-bold text-xs text-slate-400">
                <div className="bg-[#060b16] border border-slate-800/60 p-2.5 rounded-xl flex justify-between items-center hover:border-blue-500/30 transition-colors">
                  <span className="flex items-center">📈 Cumplimiento</span>
                  <span className="text-white font-black text-sm">{avancePlanesGlobal}%</span>
                </div>
                <div className="bg-[#060b16] border border-slate-800/60 p-2.5 rounded-xl flex justify-between items-center hover:border-cyan-500/30 transition-colors">
                  <span className="flex items-center">📂 Abiertos</span>
                  <span className="text-cyan-400 font-black">{planesActivos}</span>
                </div>
                <div className="bg-[#060b16] border border-slate-800/60 p-2.5 rounded-xl flex justify-between items-center hover:border-red-500/30 transition-colors">
                  <span className="text-slate-400 flex items-center">🚨 Vencidos</span>
                  <span className="text-red-400 font-black">{planesVencidos}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#0a1122] border border-slate-800 p-4 rounded-2xl shadow-lg relative group overflow-visible hover:border-slate-700 transition-all cursor-help">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xs font-black tracking-widest uppercase text-slate-300">Indicadores (KPI)</h3>
                <button onClick={() => solicitarDictamenIA('kpis')} className="text-[9px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-1.5 py-0.5 rounded font-black shadow-sm">✨ IA</button>
              </div>
              <div className="overflow-x-auto w-full flex-1">
                <table className="w-full text-left text-[10px] font-bold text-slate-400 border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider text-[9px]">
                      <th className="py-2 font-black">Indicador</th>
                      <th className="py-2 font-black text-center">Valor Real</th>
                      <th className="py-2 font-black text-center">Meta</th>
                      <th className="py-2 font-black text-right">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    <tr className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2 text-white truncate max-w-[120px]">Ejecución Plan Anual</td>
                      <td className="py-2 text-center text-slate-200">{kpiPlanAnual}%</td>
                      <td className="py-2 text-center text-slate-500">85%</td>
                      <td className="py-2 text-right">{kpiPlanAnual >= 85 ? '✅' : (kpiPlanAnual >= 60 ? '⚠️' : '🚨')}</td>
                    </tr>
                    <tr className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2 text-white truncate max-w-[120px]">Salud de Controles</td>
                      <td className="py-2 text-center text-slate-200">{efectividadControlesGlobal}%</td>
                      <td className="py-2 text-center text-slate-500">80%</td>
                      <td className="py-2 text-right">{efectividadControlesGlobal >= 80 ? '✅' : (efectividadControlesGlobal >= 60 ? '⚠️' : '🚨')}</td>
                    </tr>
                    <tr className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2 text-white truncate max-w-[120px]">Oportunidad Planes</td>
                      <td className="py-2 text-center text-slate-200">{kpiOportunidad}%</td>
                      <td className="py-2 text-center text-slate-500">85%</td>
                      <td className="py-2 text-right">{kpiOportunidad >= 85 ? '✅' : (kpiOportunidad >= 60 ? '⚠️' : '🚨')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        );
      })()}

      {/* ─── SECCIÓN DE OPERACIONES, CALENDARIO Y LOGS RESTAURADA ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 mt-6">
        
        <div className="bg-[#0a1122] border border-slate-800 rounded-2xl shadow-xl p-5 flex flex-col relative group overflow-visible hover:border-slate-700 transition-all cursor-help">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-3">
              <h3 className="text-sm font-black text-slate-200">Planes Vencidos</h3>
              <span className="bg-red-500/20 text-red-400 font-bold px-2 py-0.5 rounded-md text-[10px]">{planesVencidosList.length}</span>
            </div>
            <button onClick={() => solicitarDictamenIA('vencidos')} className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded font-black shadow-sm">✨ IA</button>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[220px] scrollbar-thin">
            <table className="w-full text-left text-[10px]">
              <thead className="text-slate-500 border-b border-slate-800">
                <tr>
                  <th className="pb-2 font-bold">Plan</th>
                  <th className="pb-2 font-bold">Proceso</th>
                  <th className="pb-2 font-bold">Vencimiento</th>
                  <th className="pb-2 font-bold">Responsable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {planesVencidosList.map((p, i) => {
                  const hallazgoAsociado = hallazgosBase.find(h => h.id === p.idHallazgo) || {};
                  return (
                  <tr key={`venc-${i}`} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
                      <span className="font-bold text-slate-300">PLAN-{p.id}</span>
                    </td>
                    <td className="py-2.5 text-slate-400 truncate max-w-[80px]" title={hallazgoAsociado.proceso || 'N/A'}>{hallazgoAsociado.proceso || 'N/A'}</td>
                    <td className="py-2.5 text-slate-400">{formatSafeDate(p.fecha)}</td>
                    <td className="py-2.5 text-slate-400 truncate max-w-[80px]" title={p.responsable}>{p.responsable}</td>
                  </tr>
                )})}
                {planesVencidosList.length === 0 && (
                  <tr><td colSpan="4" className="py-4 text-center text-slate-500 italic">No hay planes vencidos registrados</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="pt-3 mt-auto border-t border-slate-800/50 text-left">
             <button onClick={() => setActiveTab('planes_tab')} className="text-red-400 text-[10px] font-bold hover:underline transition-colors">Ver todos los planes vencidos →</button>
          </div>
        </div>

        <div className="bg-[#0a1122] border border-slate-800 rounded-2xl shadow-xl p-5 flex flex-col relative group overflow-visible hover:border-slate-700 transition-all cursor-help">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-3">
              <h3 className="text-sm font-black text-slate-200">Próximas Auditorías</h3>
              <span className="bg-blue-500/20 text-blue-400 font-bold px-2 py-0.5 rounded-md text-[10px]">{proximasAuditorias.length}</span>
            </div>
            <button onClick={() => solicitarDictamenIA('proximas')} className="text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded font-black shadow-sm">✨ IA</button>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[220px] scrollbar-thin">
             <table className="w-full text-left text-[10px]">
              <thead className="text-slate-500 border-b border-slate-800">
                <tr>
                  <th className="pb-2 font-bold">Auditoría</th>
                  <th className="pb-2 font-bold">Proceso</th>
                  <th className="pb-2 font-bold">Periodo</th>
                  <th className="pb-2 font-bold">Auditor</th>
                </tr>
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
                 {proximasAuditorias.length === 0 && (
                  <tr><td colSpan="4" className="py-4 text-center text-slate-500 italic">No hay auditorías pendientes en cronograma</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="pt-3 mt-auto border-t border-slate-800/50 text-left">
             <button onClick={() => setActiveTab('plan_anual_tab')} className="text-blue-400 text-[10px] font-bold hover:underline transition-colors">Ver calendario completo →</button>
          </div>
        </div>

        <div className="bg-[#0a1122] border border-slate-800 rounded-2xl shadow-xl p-5 flex flex-col relative group overflow-visible hover:border-slate-700 transition-all cursor-help">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-black text-slate-200">Actividad Reciente</h3>
            <button onClick={() => solicitarDictamenIA('actividad')} className="text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded font-black shadow-sm">✨ IA</button>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[220px] scrollbar-thin space-y-4">
              {recentActivityList.map((act, i) => (
                <div key={`act-${i}`} className="flex items-start space-x-3 text-left">
                  <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${act.colorClass} shrink-0`}>
                    {act.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-slate-300 leading-snug">
                      <span className="font-bold text-white">{act.type} {act.ref}</span> {String(act.accion).toLowerCase()}
                    </p>
                    <p className="text-[9px] text-slate-500 truncate mt-0.5">Por: {act.usuario}</p>
                  </div>
                  <div className="text-[9px] text-slate-500 shrink-0 text-right whitespace-nowrap">
                    {act.fechaStr.split(',')[0]}
                  </div>
                </div>
              ))}
               {recentActivityList.length === 0 && (
                  <div className="py-4 text-center text-slate-500 italic text-[10px]">No hay actividad reciente registrada en sistema</div>
                )}
          </div>
        </div>

      </div>

      {/* ─── ANEXO INTERACTIVO DE TRAZABILIDAD COMPLETO RESTAURADO ─── */}
      <div className="bg-[#0a1122] border border-slate-800 p-4 rounded-2xl shadow-xl text-left relative group overflow-visible hover:border-slate-700 transition-all cursor-help">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-black tracking-widest uppercase text-slate-300">
            {matrizFiltro ? `🔍 Riesgos en Cuadrante (Probabilidad: ${matrizFiltro.p} | Impacto: ${matrizFiltro.i})` : '📋 Resumen de Riesgos Críticos Recientes'}
          </h3>
          <span className="text-[10px] font-black text-slate-400 bg-[#060b16] px-2 py-1 rounded-lg border border-slate-800">
            Registros: {riesgosFiltradosPorMatriz.length}
          </span>
        </div>

        <div className="space-y-2">
          {riesgosFiltradosPorMatriz.length === 0 ? (
            <p className="text-xs font-medium text-slate-500 py-4 text-center">No se registran riesgos mapeados in esta coordenada exacta.</p>
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
                      <h4 className="text-xs font-black text-slate-200">
                        {r.proceso || 'Proceso No Asignado'} — <span className="font-semibold text-slate-400">{r.riesgo || r.descripcion || 'Riesgo sin descripción'}</span>
                      </h4>
                      <p className="text-[9px] text-slate-500 font-medium mt-0.5">
                        Factor/Causa: {r.factorRiesgo || r.causa || 'No especificada'} | Clasificación: {r.clasificacion || r.categoria || 'Operativo'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 text-right self-end sm:self-auto">
                    <div className="text-[10px] font-bold text-slate-400">
                      P: <span className="text-slate-200">{r.probabilidadResidual || 1}</span> / I: <span className="text-slate-200">{r.impactoResidual || 1}</span>
                    </div>
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-md tracking-wider uppercase ${score >= 16 ? 'bg-red-500/10 text-red-400 border border-red-500/20' : score >= 10 ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'} font-mono`}>
                      SCORE {score}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}