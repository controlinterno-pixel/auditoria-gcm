// Ruta: src/components/ModalIA.jsx
import React, { useState, useRef } from 'react';
import { exportarA_PDF } from '../utils/pdfUtils';
import { AuditDiagnosticView } from './AuditoriaAutomatizada/AuditDiagnosticView';

/**
 * Normaliza cualquier JSON recibido al contrato exacto de AuditDiagnosticView.jsx
 */
function normalizeAuditData(parsedData, rawText) {
  if (!parsedData || typeof parsedData !== 'object') return null;

  // Si ya cumple exactamente con la estructura de AuditDiagnosticView
  if (parsedData.resumenEjecutivo && parsedData.diagnosticoRiesgosCriticos) {
    return parsedData;
  }

  // Extraer datos flexibles de la IA
  const title = parsedData.dashboardTitle || parsedData.proceso || 'Análisis de Auditoría y Riesgos';
  const marco = parsedData.marcoMetodologico || 'ISO 31000 / COSO ERM';
  const resumen = parsedData.resumenEjecutivo || {};

  const totalRiesgos = resumen.totalRiesgosEvaluados ?? 5;
  const totalHallazgos = resumen.totalHallazgosRegistrados ?? 3;

  return {
    resumenEjecutivo: {
      empresa: 'Termales de Santa Rosa de Cabal',
      marcoMetodologico: marco,
      diagnosticoGeneral: typeof resumen === 'string' ? resumen : (parsedData.dictamenDirector || `Evaluación técnica ejecutada bajo los lineamientos del marco ${marco}.`),
      alertaCiberseguridad: parsedData.alertaCiberseguridad || 'Monitoreo continuo de activos digitales y controles de acceso activos.'
    },
    hallazgosAuditoria: {
      totalHallazgos: totalHallazgos,
      abiertos: Array(totalHallazgos).fill({}),
      cerradosCount: 0
    },
    diagnosticoRiesgosCriticos: parsedData.diagnosticoRiesgosCriticos || [
      {
        codigo: 'R-01',
        proceso: title,
        nivelRiesgoISO31000: 'Alto',
        descripcion: `Evaluación de vulnerabilidad e impacto potencial sobre el proceso ${title}.`,
        evaluacionControles: 'Controles parciales requeridos. Se sugiere revisión quincenal.',
        probabilidadResidual: 4,
        impactoResidual: 4
      }
    ],
    planCAPAPriorizado: parsedData.planCAPAPriorizado || [
      {
        prioridad: 'ALTA',
        codigoRiesgo: 'R-01',
        proceso: title,
        accionRemediacion: 'Implementar salvaguardas automatizadas y matriz de segregación de funciones.'
      }
    ],
    limitacionesEvidencia: parsedData.limitacionesEvidencia || ['Trazabilidad derivada de la muestra presentada.']
  };
}

export default function ModalIA({ aiModal, setAiModal }) {
  if (!aiModal) return null;

  const rawText = aiModal?.contenido !== undefined ? aiModal.contenido : aiModal;
  let parsedData = null;

  try {
    if (typeof rawText === 'string') {
      const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(cleaned);
    } else if (typeof rawText === 'object') {
      parsedData = rawText;
    }
  } catch (e) {
    parsedData = null;
  }

  const auditData = normalizeAuditData(parsedData, rawText);
  const pdfRef = useRef();
  const [isExporting, setIsExporting] = useState(false);

  const descargarPDF = async (modoModoBlanco = false) => {
    setIsExporting(true);
    await new Promise(resolve => setTimeout(resolve, 400));

    const safeTitle = (aiModal?.titulo || 'Informe_GRC_Ejecutivo').replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `${safeTitle}.pdf`;
    
    // Si prefiere blanco corporativo pasa #ffffff, sino el azul oscuro por defecto #0f172a
    const colorFondo = modoModoBlanco ? '#ffffff' : '#0f172a';
    await exportarA_PDF(pdfRef, fileName, colorFondo);
    setIsExporting(false);
  };

  return (
    <>
      {/* 1. LOADING OVERLAY */}
      {isExporting && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-200">
          <div className="animate-spin text-5xl mb-4 drop-shadow-[0_0_15px_rgba(59,130,246,0.6)]">⚙️</div>
          <h2 className="text-lg font-black text-blue-400 tracking-widest uppercase animate-pulse">
            Generando Reporte PDF...
          </h2>
        </div>
      )}

      {/* 2. CONTENEDOR MODAL */}
      <div className="fixed inset-0 z-[250] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
        <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl shadow-2xl max-w-5xl w-full max-h-[92vh] overflow-hidden flex flex-col">        
          
          {/* CABECERA */}
          <div className="bg-slate-900/95 border-b border-slate-800 p-5 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-xl shadow-lg shadow-cyan-500/20">
                🛡️
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 bg-cyan-950/80 border border-cyan-800/50 px-2 py-0.5 rounded-md">
                  Informe Ejecutivo Inteligente
                </span>
                <h3 className="font-extrabold text-base text-slate-100 mt-0.5">
                  {aiModal.titulo || auditData?.resumenEjecutivo?.empresa || 'Análisis de Auditoría'}
                </h3>
              </div>
            </div>
            <button 
              onClick={() => setAiModal(null)} 
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-bold"
            >
              ✕
            </button>
          </div>

          {/* CUERPO DEL INFORME */}
          <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
            <div ref={pdfRef} className="space-y-6 bg-slate-900 p-2 text-slate-100 rounded-2xl">
              {auditData ? (
                <AuditDiagnosticView auditData={auditData} />
              ) : (
                <div className="p-6 bg-slate-800/40 rounded-2xl border border-slate-800 text-slate-200 text-sm whitespace-pre-wrap font-sans">
                  {String(rawText)}
                </div>
              )}
            </div>
          </div>

          {/* FOOTER ACCIONES */}
          <div data-html2canvas-ignore="true" className="bg-slate-900/95 border-t border-slate-800 p-4 flex justify-between items-center sticky bottom-0 backdrop-blur-md z-50">
            <span className="text-[10px] text-slate-500 font-semibold uppercase">
              Enterprise GRC Suite • Termales Santa Rosa
            </span>
            <div className="flex gap-2">
              <button 
                onClick={() => descargarPDF(false)} 
                disabled={isExporting}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-1.5"
              >
                <span>📥</span> PDF Dark
              </button>
              <button 
                onClick={() => descargarPDF(true)} 
                disabled={isExporting}
                className="bg-slate-100 hover:bg-white text-slate-900 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-1.5"
              >
                <span>📄</span> PDF Impresión (Blanco)
              </button>
              <button 
                onClick={() => setAiModal(null)} 
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-bold"
              >
                Cerrar
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}