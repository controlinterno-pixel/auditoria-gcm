import React, { useEffect } from 'react';

// --- SUBCOMPONENTE DE GRÁFICOS INTEGRADO DE FORMA SEGURA ---
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

export default function DashboardRiesgos({
  tipoMatriz,
  rFiltrados,
  incFiltrados,
  hFiltrados,
  calcularMatriz5x5,
  getItemMesText,
  selectedAnios,
  setChartDetail,
  filtroHeatMap,
  setFiltroHeatMap,
  searchTerm,
  columnFilters,
  applyFilters,
  renderHeaderFiltros
}) {
  const esRes = tipoMatriz === 'residual';
  const totalRiesgos = rFiltrados.length;
  const riesgosCriticos = rFiltrados.filter(r => calcularMatriz5x5(r.probabilidadResidual, r.impactoResidual).score > 16).length;
  const riesgosFueraApetito = rFiltrados.filter(r => calcularMatriz5x5(r.probabilidadResidual, r.impactoResidual).apetito === "Fuera de Apetito").length;
  const totalPerdidas = incFiltrados.reduce((acc, i) => acc + (Number(i.costo) || 0), 0);

  const impactos = ['Crítico', 'Alto', 'Medio', 'Bajo'];
  const probabilidades = ['Rara', 'Posible', 'Frecuente'];

  const contarCelda = (imp, prob) => rFiltrados.filter(r => (esRes ? r.impactoResidual : r.impactoInherente) === imp && (esRes ? r.probabilidadResidual : r.probabilidadInherente) === prob).length;

  const mesesCompletos = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const mesesGrafica = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  const dataIncidentes = mesesCompletos.map((mesTexto, idx) => {
    const itemsMes = incFiltrados.filter(i => getItemMesText(i) === mesTexto);
    const valorMes = itemsMes.reduce((acc, val) => acc + (Number(val.costo) || 0), 0);
    return { mes: mesesGrafica[idx], mesCompleto: mesTexto, valor: valorMes, items: itemsMes, tipo: 'Incidentes Financiados' };
  });

  const dataHallazgos = mesesCompletos.map((mesTexto, idx) => {
    const itemsMes = hFiltrados.filter(h => getItemMesText(h) === mesTexto);
    const valorMes = itemsMes.length;
    return { mes: mesesGrafica[idx], mesCompleto: mesTexto, valor: valorMes, items: itemsMes, tipo: 'Hallazgos Detectados' };
  });

  const chartTitleLabel = selectedAnios.length === 0 ? 'TODOS LOS AÑOS' : selectedAnios.length <= 2 ? selectedAnios.join(' y ') : `${selectedAnios.length} AÑOS`;

  // 🚀 MAGIA DEL SCROLL: Cuando cambia el filtroHeatMap (hace clic en un recuadro), baja suavemente
  useEffect(() => {
    if (filtroHeatMap) {
      setTimeout(() => {
        const elemento = document.getElementById('detalle-heatmap');
        const mainArea = document.getElementById('main-scroll-area'); // Busca el contenedor con scroll que tenemos en App.jsx
        
        if (elemento && mainArea) {
           mainArea.scrollTo({ top: elemento.offsetTop - 20, behavior: 'smooth' });
        } else if (elemento) {
           // Fallback si no encuentra el contenedor específico
           elemento.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 150); // Pequeño retraso para dar tiempo a que la tabla aparezca en pantalla
    }
  }, [filtroHeatMap]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {renderHeaderFiltros("Panel de inteligencia GRC", "Análisis predictivo de apetito ISO 31000 y Evolución de KRI.", true)}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TrendChart data={dataIncidentes} title={`EVOLUCIÓN DE IMPACTO FINANCIERO (${chartTitleLabel})`} isCurrency={true} color="#ef4444" fillColor="#fef2f2" onPointClick={setChartDetail} />
        <TrendChart data={dataHallazgos} title={`VOLUMEN DE DESVIACIONES (${chartTitleLabel})`} isCurrency={false} color="#3b82f6" fillColor="#eff6ff" onPointClick={setChartDetail} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 border-l-8 border-l-blue-500">
           <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">RIESGOS TOTALES</h4>
           <span className="text-4xl font-black mt-2 block text-slate-800 notranslate" translate="no">{totalRiesgos}</span>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 border-l-8 border-l-red-600">
           <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">FUERA DE APETITO</h4>
           <span className="text-4xl font-black mt-2 block text-red-600 notranslate" translate="no">{riesgosFueraApetito}</span>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 border-l-8 border-l-orange-500">
           <h4 className="text-xl font-black text-slate-500 uppercase tracking-widest">RIESGOS CRÍTICOS</h4>
           <span className="text-4xl font-black mt-2 block text-orange-500 notranslate" translate="no">{riesgosCriticos}</span>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 border-l-8 border-l-purple-600">
           <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">PÉRDIDAS TOTALES</h4>
           <span className="text-3xl font-black mt-2 block text-purple-700 notranslate" translate="no">$ {(totalPerdidas).toLocaleString('es-CO')}</span>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 flex flex-col items-center relative">
        <h3 className="font-black text-slate-600 text-xs uppercase tracking-widest mb-8 w-full flex items-center space-x-3">
          <span>🗺️ MAPA DE CALOR EMPRESARIAL (HAZ CLIC EN UN CUADRANTE CON NÚMEROS)</span>
          <span className="bg-slate-800 text-white px-3 py-1 rounded-full text-[9px] font-bold tracking-widest">{tipoMatriz}</span>
        </h3>
        
        <div className="flex flex-col items-center justify-center w-full">
          <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-3 w-full max-w-3xl relative pb-4">
            <div className="absolute -left-16 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] font-black text-slate-400 uppercase tracking-widest">IMPACTO</div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest">PROBABILIDAD</div>
            <div></div>
            {probabilidades.map(p => <div key={`prob-${p}`} className="text-center text-[10px] font-black uppercase text-slate-500 bg-slate-50 py-2 rounded-t-lg border-b border-slate-200">{p}</div>)}
            {impactos.map(imp => (
              <React.Fragment key={`imp-${imp}`}>
                <div className="text-right pr-4 py-6 flex items-center justify-end text-[10px] font-black uppercase text-slate-500 bg-slate-50 rounded-l-lg">{imp}</div>
                {probabilidades.map(prob => {
                  const count = contarCelda(imp, prob);
                  const { score, color, borderSemaforo } = calcularMatriz5x5(prob, imp);
                  const isSelected = filtroHeatMap?.impacto === imp && filtroHeatMap?.probabilidad === prob;
                  
                  return (
                    <div key={`cell-${imp}-${prob}`} onClick={() => { 
                      if (count > 0) {
                        setFiltroHeatMap({ impacto: imp, probabilidad: prob, count }); 
                      }
                    }}
                      className={`relative border-2 p-6 flex flex-col justify-center items-center h-28 rounded-2xl transition-all duration-200 ${count > 0 ? 'cursor-pointer hover:scale-105 shadow-md opacity-100' : 'opacity-20 cursor-not-allowed'} ${color} ${isSelected ? 'ring-4 ring-slate-900 scale-105 shadow-xl bg-opacity-100 border-black' : borderSemaforo}`}>
                      <span className="absolute top-2 right-3 text-[9px] font-mono font-black opacity-50 text-slate-900 notranslate" translate="no">S: {score}</span>
                      <span className={`text-4xl font-black text-slate-900 drop-shadow-sm notranslate`} translate="no">{count}</span>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        {filtroHeatMap && (
          <div id="detalle-heatmap" className="mt-8 w-full bg-white rounded-xl border border-slate-200 shadow-sm animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-4 p-4 border-b bg-slate-50 rounded-t-xl">
              <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider">🔎 Detalle de Riesgos en Cuadrante: {filtroHeatMap.probabilidad} / {filtroHeatMap.impacto}</h4>
              <button onClick={() => setFiltroHeatMap(null)} className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition-colors">✖ Limpiar Filtro</button>
            </div>
            <div className="overflow-x-auto p-4 pt-0">
              <table className="w-full text-xs text-left divide-y border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-900 text-white font-bold text-[10px] uppercase">
                  <tr>
                    <th className="p-3">Identificación</th>
                    <th className="p-3">Proceso</th>
                    <th className="p-3 w-1/2">Descripción</th>
                    <th className="p-3">Responsable</th>
                    <th className="p-3 text-center">Estrategia</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-700 bg-white">
                  {rFiltrados.filter(r => (esRes ? r.impactoResidual : r.impactoInherente) === filtroHeatMap.impacto && (esRes ? r.probabilidadResidual : r.probabilidadInherente) === filtroHeatMap.probabilidad).map((r, index) => {
                     const matrizData = calcularMatriz5x5(esRes ? r.probabilidadResidual : r.probabilidadInherente, esRes ? r.impactoResidual : r.impactoInherente);
                     return (
                      <tr key={`filtered-${r.id}-${index}`} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-bold text-slate-800">#{r.id}</td>
                        <td className="p-3">
                          <span className="font-black text-slate-900 block">{r.proceso}</span>
                          <span className="text-[9px] text-slate-400 font-bold block mt-1">{r.sede || 'Hotel'}</span>
                        </td>
                        <td className="p-3 font-medium">{r.descripcion}</td>
                        <td className="p-3">{r.responsable || 'No Asignado'}</td>
                        <td className="p-3 text-center">
                          <span className={`px-3 py-1.5 rounded text-[9px] uppercase font-black shadow-sm block w-full truncate ${matrizData.color}`}>
                            {matrizData.accion}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}