// Ruta: src/components/ModalIA.jsx
import React, { useState, useRef } from 'react';
import { exportarA_PDF } from '../utils/pdfUtils';

function cleanMarkdown(text) {
  if (typeof text !== 'string') return text;
  // Elimina encabezados tipo ### y limpia caracteres extra de formato
  return text.replace(/###\s*([^:\n#]+):?/g, '$1:').trim();
}

function normalizePanelEjecutivo(parsedData, rawText) {
  if (!parsedData && !rawText) return null;
  
  let data = parsedData || {};
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data.replace(/```json/g, '').replace(/```/g, '').trim());
    } catch (e) {
      data = {};
    }
  }

  // 1. Extracción de Badges y KPIs
  const kpis = data.kpis || {};
  const badges = data.headerBadges || {};

  const scoreRiesgo = data.scoreRiesgo ?? kpis.scoreRiesgo ?? '36%';
  const madurez = data.scoreMadurez ?? kpis.scoreMadurez ?? data.madurez ?? '62%';
  const cobertura = data.coberturaControles ?? kpis.coberturaControles ?? data.cobertura ?? '95%';
  const totalControles = data.totalControles ?? kpis.totalControles ?? 3;

  // 2. Análisis Ejecutivo
  let analisis = data.analisis || data.analisisEjecutivo || data.diagnosticoGeneral;
  if (!analisis && typeof rawText === 'string' && !rawText.trim().startsWith('{')) {
    analisis = rawText;
  }
  analisis = cleanMarkdown(analisis || "Evaluación técnica de auditoría realizada. No se detectaron suficientes datos para un análisis cruzado.");

  // 3. Recomendaciones
  let recomendaciones = data.recomendaciones;
  if (typeof recomendaciones === 'string') {
    recomendaciones = recomendaciones.split(/(?:\r?\n|;|\. )+/).filter(r => r.trim().length > 5);
  }
  if (!Array.isArray(recomendaciones) || recomendaciones.length === 0) {
    recomendaciones = [
      `Implementar un programa de fortalecimiento para elevar la efectividad operativa de los ${totalControles} controles hacia el nivel de diseño.`,
      `Establecer un sistema de monitoreo continuo que asegure cerrar la brecha entre cobertura teórica y evidencia ejecutable.`
    ];
  }

  // 4. Plan de Acción
  let planAccion = data.planAccion;
  if (!Array.isArray(planAccion) || planAccion.length === 0) {
    planAccion = [
      {
        prioridad: 'ALTA',
        accion: `Diseñar e implementar el plan de mejora de efectividad para los ${totalControles} controles registrados.`,
        responsable: 'Comité de Innovación y Dirección de Operaciones'
      }
    ];
  }

  // 5. Dictamen del Director
  let dictamen = data.dictamenDirector || data.dictamen || "\"Atención requerida sobre la efectividad operativa de los controles.\"";
  dictamen = cleanMarkdown(dictamen);

  // 6. Secciones Metodológicas
  const acuerdos = data.acuerdosTecnicos || {};
  const iso31000 = cleanMarkdown(data.iso31000 || acuerdos.analisisMetodologico || "Análisis realizado bajo los principios de la norma ISO 31000, evaluando riesgo y exposición.");
  const cosoErm = cleanMarkdown(data.cosoErm || acuerdos.evaluacionControles || acuerdos.isoCosoAlignment || "Evaluación de controles bajo el marco COSO ERM indicando la madurez operativa.");
  const kris = cleanMarkdown(data.kris || data.kpisEvidencias || `1) KRI Madurez: Meta ${madurez}. 2) KRI Cobertura: Meta ${cobertura}.`);

  return {
    inherente: badges.inherente || data.inherente || 'MEDIO',
    residual: badges.residual || data.residual || 'MEDIO',
    calidad: badges.calidad || data.calidad || '90/100',
    scoreRiesgo: typeof scoreRiesgo === 'number' ? `${scoreRiesgo}%` : scoreRiesgo,
    madurez: typeof madurez === 'number' ? `${madurez}%` : madurez,
    cobertura: typeof cobertura === 'number' ? `${cobertura}%` : cobertura,
    totalControles,
    analisis,
    recomendaciones,
    planAccion,
    dictamen,
    iso31000,
    cosoErm,
    kris
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
  
  console.log("🚨 PAYLOAD CRUDO DE LA IA:", parsedData);
  const panelData = normalizePanelEjecutivo(parsedData, rawText);

  // Hooks y Handlers para PDF
  const pdfRef = useRef();
  const [isExporting, setIsExporting] = useState(false);

  const descargarPDF = async (modoModoBlanco = false) => {
    setIsExporting(true);
    await new Promise(resolve => setTimeout(resolve, 400));

    const safeTitle = (aiModal?.titulo || 'Informe_GRC_Ejecutivo').replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `${safeTitle}.pdf`;
    
    const colorFondo = modoModoBlanco ? '#ffffff' : '#0f172a';
    await exportarA_PDF(pdfRef, fileName, colorFondo);
    setIsExporting(false);
  };

  /* CUERPO DEL INFORME EN 7 BLOQUES (PANEL EJECUTIVO INTELIGENTE) */
  return (
    <>
      {/* 1. LOADING OVERLAY */}
      {isExporting && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center">
          <div className="animate-spin text-5xl mb-4">⚙️</div>
          <h2 className="text-lg font-black text-blue-400 tracking-widest uppercase animate-pulse">
            Generando Reporte PDF...
          </h2>
        </div>
      )}

      {/* 2. CONTENEDOR MODAL */}
      <div className="fixed inset-0 z-[250] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
        <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl shadow-2xl max-w-5xl w-full max-h-[92vh] overflow-hidden flex flex-col">        
          
          {/* CABECERA */}
          <div className="bg-slate-900/95 border-b border-slate-800 p-5 flex items-center justify-between sticky top-0 z-20">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-xl shadow-lg">
                🛡️
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 bg-cyan-950/80 border border-cyan-800/50 px-2 py-0.5 rounded-md">
                  Panel Ejecutivo Inteligente
                </span>
                <h3 className="font-extrabold text-base text-slate-100 mt-0.5">
                  {aiModal.titulo || 'Informe Ejecutivo de Auditoría'}
                </h3>
              </div>
            </div>
            <button 
              onClick={() => setAiModal(null)} 
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-bold transition-colors"
            >
              ✕
            </button>
          </div>

          {/* ESTRUCTURA VISUAL DE 7 BLOQUES (RSK-189) */}
          <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white text-slate-800">
            <div ref={pdfRef} className="p-6 space-y-6 text-xs leading-relaxed text-slate-800">
              
              {/* BADGES SUPERIORES */}
              <div className="flex justify-between items-center text-[10px] font-extrabold text-slate-500 uppercase border-b pb-2">
                <span>INH: <strong className="text-slate-800">{panelData?.inherente}</strong></span>
                <span>RESIDUAL: <strong className="text-slate-800">{panelData?.residual}</strong></span>
                <span>CALIDAD: <strong className="text-slate-800">{panelData?.calidad}</strong></span>
              </div>

              {/* BLOQUE 1: KPIS */}
              <div className="grid grid-cols-4 gap-4 text-center">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Score Riesgo</span>
                  <span className="text-xl font-black text-amber-600">{panelData?.scoreRiesgo}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Madurez</span>
                  <span className="text-xl font-black text-blue-600">{panelData?.madurez}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Controles</span>
                  <span className="text-xl font-black text-slate-700">{panelData?.totalControles}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cobertura</span>
                  <span className="text-xl font-black text-emerald-600">{panelData?.cobertura}</span>
                </div>
              </div>

              {/* BLOQUE 2: ANÁLISIS EJECUTIVO */}
              <div className="text-justify space-y-2 text-slate-700">
                {panelData?.analisis.split('\n\n').map((parrafo, idx) => (
                  <p key={idx}>{parrafo}</p>
                ))}
              </div>

              {/* BLOQUE 3: RECOMENDACIONES */}
              <div className="space-y-2 pt-1">
                <h4 className="font-extrabold text-slate-900 border-b pb-1 text-[11px] uppercase tracking-wider">Recomendaciones</h4>
                <ul className="space-y-2 text-slate-700">
                  {panelData?.recomendaciones.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-justify">
                      <span className="text-emerald-600 font-bold shrink-0">✔</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* BLOQUE 4: PLAN DE ACCIÓN */}
              <div className="space-y-2 pt-1">
                <h4 className="font-extrabold text-slate-900 border-b pb-1 text-[11px] uppercase tracking-wider">Plan de Acción Inmediato</h4>
                <table className="w-full text-left border-collapse border border-slate-200 text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 uppercase text-[10px] border-b">
                      <th className="p-2 border-r w-24 font-bold">Prioridad</th>
                      <th className="p-2 border-r font-bold">Acción</th>
                      <th className="p-2 w-48 font-bold">Responsable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {panelData?.planAccion.map((item, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="p-2 border-r font-black text-red-600 align-top">{item.prioridad}</td>
                        <td className="p-2 border-r text-slate-700 text-justify align-top">{item.accion}</td>
                        <td className="p-2 font-bold text-slate-800 align-top">{item.responsable}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* BLOQUE 5: DICTAMEN DEL DIRECTOR */}
              <div className="bg-slate-50 border-l-4 border-slate-800 p-4 italic text-slate-700 text-justify rounded-r-xl">
                <h5 className="font-extrabold not-italic text-slate-900 mb-1 text-[10px] uppercase tracking-wider">Dictamen del Director</h5>
                {panelData?.dictamen}
              </div>

              {/* BLOQUE 6: ISO 31000 */}
              <div className="space-y-1 pt-1">
                <h5 className="font-extrabold text-slate-900 text-[10px] uppercase flex items-center gap-1">
                  <span>▼</span> Análisis Metodológico ISO 31000
                </h5>
                <p className="text-slate-600 text-justify">{panelData?.iso31000}</p>
              </div>

              {/* BLOQUE 7: COSO ERM & KRIS */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                <div className="space-y-1">
                  <h5 className="font-extrabold text-slate-900 text-[10px] uppercase flex items-center gap-1">
                    <span>▼</span> Evaluación de Controles & COSO ERM
                  </h5>
                  <p className="text-slate-600 text-justify">{panelData?.cosoErm}</p>
                </div>
                <div className="space-y-1">
                  <h5 className="font-extrabold text-slate-900 text-[10px] uppercase flex items-center gap-1">
                    <span>▼</span> KRIs, Monitoreo y Evidencias
                  </h5>
                  <p className="text-slate-600 text-justify">{panelData?.kris}</p>
                </div>
              </div>

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
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-bold transition-colors"
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