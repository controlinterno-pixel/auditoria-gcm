// Ruta: src/components/AuditoriaAutomatizada/RiskHeatmap.jsx
import React from 'react';

export const RiskHeatmap = ({ riesgos = [] }) => {
  // Matriz 5x5 Probabilidad vs Impacto
  const getCellColor = (prob, imp) => {
    const score = prob * imp;
    if (score >= 15) return 'bg-rose-500/20 border-rose-500/50 text-rose-300 font-bold';
    if (score >= 8) return 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold';
    return 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300';
  };

  const contarRiesgosEnCelda = (p, i) => {
    return riesgos.filter(r => {
      const prob = Number(r.probabilidadResidual) || 3;
      const imp = Number(r.impactoResidual) || 3;
      return prob === p && imp === i;
    }).length;
  };

  return (
    <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
          <span>🗺️</span> Matriz Térmica de Riesgo Residual (ISO 31000)
        </h4>
        <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-1 rounded">
          Impacto vs Probabilidad
        </span>
      </div>

      <div className="grid grid-cols-6 gap-1 text-[10px] text-center font-mono">
        <div className="col-span-1"></div>
        {[1, 2, 3, 4, 5].map(imp => (
          <div key={imp} className="text-slate-400 font-bold py-1">Imp. {imp}</div>
        ))}

        {[5, 4, 3, 2, 1].map(prob => (
          <React.Fragment key={prob}>
            <div className="flex items-center justify-end pr-2 text-slate-400 font-bold">Prob. {prob}</div>
            {[1, 2, 3, 4, 5].map(imp => {
              const cantidad = contarRiesgosEnCelda(prob, imp);
              return (
                <div 
                  key={`${prob}-${imp}`} 
                  className={`h-9 rounded-lg border flex items-center justify-center relative transition-transform hover:scale-105 ${getCellColor(prob, imp)}`}
                >
                  {cantidad > 0 ? (
                    <span className="w-5 h-5 bg-cyan-500 text-slate-950 font-black rounded-full flex items-center justify-center text-[10px] shadow-md animate-pulse">
                      {cantidad}
                    </span>
                  ) : (
                    <span className="opacity-20 text-[8px]">{prob * imp}</span>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};