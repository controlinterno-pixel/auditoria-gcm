import React from 'react';

export default function ModalDetalleGrafico({ chartDetail, setChartDetail }) {
  if (!chartDetail) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-slate-900 p-4 flex justify-between items-center text-white">
          <h3 className="font-black text-xs uppercase tracking-widest flex items-center space-x-2">
            <span>📈</span> <span>Foco de Control: {chartDetail.tipo} — {chartDetail.mesCompleto.toUpperCase()}</span>
          </h3>
          <button onClick={() => setChartDetail(null)} className="hover:text-slate-300 font-bold text-lg">✖</button>
        </div>
        
        <div className="p-6 max-h-[380px] overflow-y-auto text-xs">
          {chartDetail.items.length === 0 ? (
            <div className="text-center py-12 text-slate-400 font-bold uppercase tracking-wider border border-dashed border-slate-200 rounded-2xl bg-slate-50">
              🚫 No se encontraron eventos ni novedades en este periodo.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden p-2 bg-white">
              {chartDetail.tipo === 'Incidentes Financiados' ? (
                chartDetail.items.map((item, idx) => (
                  <div key={`modal-inc-${idx}`} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-start space-x-4">
                    <div>
                      <div className="font-black text-slate-800 text-sm">{item.titulo}</div>
                      <div className="text-slate-500 mt-1 font-medium leading-relaxed">{item.descripcion}</div>
                      <div className="text-[9px] text-slate-400 font-mono font-bold mt-2 uppercase tracking-wide">Vinculado a Riesgo: #{item.idRiesgo} • Reporta: {item.reportadoPor}</div>
                    </div>
                   <div className="font-mono font-black text-red-600 text-right text-sm whitespace-nowrap bg-red-50 px-3 py-1 rounded-lg border border-red-100">
                      ${Number(item.costo || 0).toLocaleString('es-CO')}
                    </div>
                  </div>
                ))
              ) : (
                chartDetail.items.map((item, idx) => (
                  <div key={`modal-hal-${idx}`} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-start space-x-4">
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-black text-slate-900 text-sm">{item.ref}</span>
                        <span className="px-2 py-0.5 bg-slate-800 text-white font-bold text-[8px] rounded uppercase tracking-wider">{item.proceso}</span>
                      </div>
                      <div className="text-slate-600 font-semibold leading-relaxed">{item.titulo}</div>
                      <div className="text-[9px] text-slate-400 font-bold mt-2 uppercase tracking-wide">Sede: {item.sede} • Dueño de Proceso: {item.responsable}</div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full font-black text-[9px] uppercase tracking-widest border shrink-0 ${
                      item.severidad === 'Crítico' || item.severidad === 'Alto' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>{item.severidad}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        
        <div className="bg-slate-50 px-6 py-4 flex justify-end border-t">
          <button onClick={() => setChartDetail(null)} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-colors shadow-md">
            Cerrar Análisis
          </button>
        </div>
      </div>
    </div>
  );
}