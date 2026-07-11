import React from 'react';

export default function ModalIA({ aiModal, setAiModal }) {
  if (!aiModal) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-purple-600 p-4 flex justify-between items-center text-white">
          <h3 className="font-black text-sm uppercase tracking-widest flex items-center space-x-2">
            <span>🤖</span> <span>{aiModal.titulo}</span>
          </h3>
          <button onClick={() => setAiModal(null)} className="hover:text-purple-200 font-bold text-lg">✖</button>
        </div>
        <div className="p-6 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed border-b border-slate-100">
          {aiModal.contenido}
        </div>
        <div className="bg-slate-50 p-4 flex justify-between items-center">
          {aiModal.url && (
            <a href={aiModal.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-purple-600 hover:text-purple-800 flex items-center space-x-1">
              <span>🔗</span> <span>Ver Evidencia</span>
            </a>
          )}
          <button onClick={() => setAiModal(null)} className="bg-slate-800 text-white px-6 py-2 rounded-xl font-bold hover:bg-slate-700 transition-colors">
            Cerrar Análisis
          </button>
        </div>
      </div>
    </div>
  );
}