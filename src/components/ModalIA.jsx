import React, { useState, useRef } from 'react';
import html2pdf from 'html2pdf.js';
export default function ModalIA({ aiModal, setAiModal }) {
  if (!aiModal) return null;

  // Extraemos el valor asumiendo que el padre nos mandó un string
  const rawText = aiModal?.contenido !== undefined ? aiModal.contenido : aiModal;

  let data = null;
  let isDashboardData = false;

  // 🔄 Intentamos transformar el String de nuevo a Objeto SOLO dentro de este componente
  try {
    const parsed = typeof rawText === 'string' ? JSON.parse(rawText) : rawText;
    if (parsed && typeof parsed === 'object' && parsed.encabezado) {
      data = parsed;
      isDashboardData = true;
    }
  } catch (e) {
    // Si falla el parseo, lo tratamos como texto normal (Fallback extremo)
  }

  const [openAccordion, setOpenAccordion] = useState('metodologia');
  const toggleAccordion = (key) => setOpenAccordion(openAccordion === key ? null : key);

  const pdfRef = useRef();

  const descargarPDF = () => {
    const element = pdfRef.current;
    const opciones = {
      margin: 0.5,
      filename: `Dictamen_Riesgo_${data?.encabezado?.codigo || 'ERIR'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#0f172a' },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opciones).from(element).save();
  };

  return (
    <div className="fixed inset-0 z-[250] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
<div ref={pdfRef} className="bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">        
        {/* CABECERA */}
        <div className="bg-slate-900/90 border-b border-slate-800 p-5 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-xl shadow-lg shadow-cyan-500/20">🛡️</div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 bg-cyan-950/80 border border-cyan-800/50 px-2 py-0.5 rounded-md">Panel Ejecutivo Inteligente</span>
                <span className="text-[10px] font-mono font-bold text-slate-400">{data?.encabezado?.codigo || 'RSK-ANALYSIS'}</span>
              </div>
              <h3 className="font-extrabold text-base text-slate-100 mt-0.5">{aiModal.titulo || data?.encabezado?.proceso || 'Análisis del Riesgo Corporativo'}</h3>
            </div>
          </div>
          <button onClick={() => setAiModal(null)} className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center font-bold text-sm">✕</button>
        </div>

        {/* CUERPO DEL WORKSPACE */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
          {isDashboardData && data ? (
            <>
              {/* BADGES */}
              <div className="flex flex-wrap items-center gap-2 pb-1">
                <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-400"></span>Inh: {data.encabezado.riesgoInherenteLabel || 'Alto'}</span>
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400"></span>Residual: {data.encabezado.riesgoResidualLabel || 'Bajo'}</span>
                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider">⭐ Calidad: {data.encabezado.calidadRegistroScore}/100</span>
              </div>

              {/* KPIS */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: "Score Riesgo", val: `${data.kpis.scoreRiesgo}%`, color: "text-orange-400" },
                  { label: "Madurez", val: `${data.kpis.scoreMadurez}%`, color: "text-blue-400" },
                  { label: "Controles", val: data.kpis.totalControles, color: "text-slate-100" },
                  { label: "Cobertura", val: `${data.kpis.coberturaControles}%`, color: "text-emerald-400" }
                ].map((kpi, i) => (
                  <div key={i} className="bg-slate-800/40 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{kpi.label}</span>
                    <span className={`text-3xl font-black mt-2 ${kpi.color}`}>{kpi.val}</span>
                  </div>
                ))}
              </div>

              {/* HALLAZGOS Y RECOMENDACIONES */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-800/30 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">⚠️ Hallazgos</h4>
                  <ul className="space-y-2 text-xs text-slate-300 font-medium">
                    {data.hallazgos?.map((item, idx) => (
                      <li key={idx} className="flex items-start space-x-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800"><span className="text-amber-400 font-bold shrink-0">•</span><span>{item}</span></li>
                    ))}
                  </ul>
                </div>
                <div className="bg-slate-800/30 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">💡 Recomendaciones</h4>
                  <ul className="space-y-2 text-xs text-slate-300 font-medium">
                    {data.recomendaciones?.map((item, idx) => (
                      <li key={idx} className="flex items-start space-x-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800"><span className="text-cyan-400 font-bold shrink-0">✔</span><span>{item}</span></li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* PLAN DE ACCION */}
              <div className="bg-slate-800/30 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">📈 Plan de Acción Inmediato</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead><tr className="border-b border-slate-800 text-[10px] font-black uppercase text-slate-400 tracking-wider"><th className="pb-2">Prioridad</th><th className="pb-2">Acción</th><th className="pb-2 text-right">Responsable</th></tr></thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {data.planAccion?.map((act, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/20">
                          <td className="py-2.5"><span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${act.prioridad === 'Alta' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>{act.prioridad}</span></td>
                          <td className="py-2.5 font-medium text-slate-200">{act.accion}</td>
                          <td className="py-2.5 text-right font-bold text-slate-400 whitespace-nowrap">{act.responsable}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* DICTAMEN */}
              <div className="bg-gradient-to-r from-blue-950/40 via-slate-900 to-purple-950/40 border border-blue-500/30 p-4 rounded-2xl space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-2">🧠 Dictamen del Director</h4>
                <p className="text-xs text-slate-200 font-medium leading-relaxed italic">"{data.dictamenDirector}"</p>
              </div>

              {/* ACORDEONES */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                {[
                  { id: 'metodologia', title: 'Análisis Metodológico ISO 31000', text: data.acordeonesTecnicos?.analisisMetodologico },
                  { id: 'controles', title: 'Evaluación de Controles & COSO ERM', text: data.acordeonesTecnicos?.evaluacionControles },
                  { id: 'kris', title: 'KRIs, Monitoreo y Evidencias', text: data.acordeonesTecnicos?.krisEvidencias }
                ].map((acc) => (
                  <div key={acc.id} className="bg-slate-800/40 border border-slate-800 rounded-xl overflow-hidden">
                    <button onClick={() => toggleAccordion(acc.id)} className="w-full p-3.5 text-left text-xs font-bold text-slate-200 flex justify-between items-center hover:bg-slate-800/60 transition-colors">
                      <span className="flex items-center gap-2"><span>▼</span> {acc.title}</span>
                    </button>
                    {openAccordion === acc.id && <div className="p-4 text-xs text-slate-300 font-normal leading-relaxed border-t border-slate-800/60 bg-slate-900/80">{acc.text || 'Sin información técnica detallada.'}</div>}
                  </div>
                ))}
              </div>
            </>
          ) : (
            // Si llega un string que NO es JSON (ej. fallo grave), lo muestra como texto plano
            <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-medium p-4 bg-slate-800/50 rounded-2xl border border-slate-800 overflow-auto">
              {String(rawText)}
            </div>
          )}
        </div>

{/* FOOTER */}
        <div data-html2canvas-ignore="true" className="bg-slate-900/90 border-t border-slate-800 p-4 flex justify-between items-center sticky bottom-0 backdrop-blur-md z-50">
          <span className="text-[10px] text-slate-500 font-semibold">Enterprise GRC Suite</span>
          <div className="flex gap-3">
            <button onClick={descargarPDF} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-xs font-bold transition-colors shadow-lg shadow-blue-500/20">
              Descargar PDF
            </button>
            <button onClick={() => setAiModal(null)} className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-5 py-2 rounded-xl text-xs font-bold transition-colors">
              Cerrar Panel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}