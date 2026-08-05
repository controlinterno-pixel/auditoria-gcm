import React, { useState, useRef } from 'react';
import { exportarA_PDF } from '../utils/pdfUtils';
import { AuditDiagnosticView } from './AuditoriaAutomatizada/AuditDiagnosticView';

export default function ModalIA({ aiModal, setAiModal }) {
  if (!aiModal) return null;

  const rawText = aiModal?.contenido !== undefined ? aiModal.contenido : aiModal;

  let data = null;

  try {
    const parsed = typeof rawText === 'string' ? JSON.parse(rawText) : rawText;
    if (parsed && typeof parsed === 'object') {
      data = parsed;
    }
  } catch (e) {
    // Fallback si viene texto plano
  }

  const pdfRef = useRef();
  const [isExporting, setIsExporting] = useState(false);

  const descargarPDF = async () => {
    setIsExporting(true);

    // Damos un pequeño margen para asegurar el render de captura
    await new Promise(resolve => setTimeout(resolve, 300));

    const safeTitle = (aiModal?.titulo || 'Informe_GRC').replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `${safeTitle}.pdf`;
    
    await exportarA_PDF(pdfRef, fileName);
    setIsExporting(false);
  };

  return (
    <>
      {/* 1. PANTALLA DE CARGA AL EXPORTAR PDF */}
      {isExporting && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-200">
          <div className="animate-spin text-5xl mb-4 drop-shadow-[0_0_15px_rgba(59,130,246,0.6)]">
            ⚙️
          </div>
          <h2 className="text-lg font-black text-blue-400 tracking-widest uppercase animate-pulse">
            Generando Documento PDF...
          </h2>
          <p className="text-slate-400 text-xs font-bold mt-2">
            Compilando informe técnico y métricas de auditoría
          </p>
        </div>
      )}

      {/* 2. CONTENEDOR MODAL */}
      <div className="fixed inset-0 z-[250] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
        <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl shadow-2xl max-w-5xl w-full max-h-[92vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">        
          
          {/* CABECERA */}
          <div className="bg-slate-900/90 border-b border-slate-800 p-5 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-xl shadow-lg shadow-cyan-500/20">
                🛡️
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 bg-cyan-950/80 border border-cyan-800/50 px-2 py-0.5 rounded-md">
                    Panel Ejecutivo Inteligente
                  </span>
                  <span className="text-[10px] font-mono font-bold text-slate-400">
                    {data?.encabezado?.codigo || 'GRC-AUDIT'}
                  </span>
                </div>
                <h3 className="font-extrabold text-base text-slate-100 mt-0.5">
                  {aiModal.titulo || data?.encabezado?.proceso || 'Análisis de Auditoría y Riesgos'}
                </h3>
              </div>
            </div>
            <button 
              onClick={() => setAiModal(null)} 
              className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center font-bold text-sm"
            >
              ✕
            </button>
          </div>

          {/* CUERPO - COMPONENTE DE DIAGNÓSTICO REUTILIZABLE */}
          <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
            <div ref={pdfRef} className="space-y-6 bg-slate-900 p-2 text-slate-100 rounded-2xl">
              {data ? (
                <AuditDiagnosticView auditData={data} />
              ) : (
                <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-medium p-4 bg-slate-800/50 rounded-2xl border border-slate-800 overflow-auto">
                  {String(rawText)}
                </div>
              )}
            </div>
          </div>

          {/* FOOTER */}
          <div data-html2canvas-ignore="true" className="bg-slate-900/90 border-t border-slate-800 p-4 flex justify-between items-center sticky bottom-0 backdrop-blur-md z-50">
            <span className="text-[10px] text-slate-500 font-semibold">Enterprise GRC Suite</span>
            <div className="flex gap-3">
              <button 
                onClick={descargarPDF} 
                disabled={isExporting}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-xs font-bold transition-colors shadow-lg shadow-blue-500/20"
              >
                Descargar PDF
              </button>
              <button 
                onClick={() => setAiModal(null)} 
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-5 py-2 rounded-xl text-xs font-bold transition-colors"
              >
                Cerrar Panel
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}