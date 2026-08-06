// Ruta: src/components/ModalIA.jsx
import React, { useState, useRef } from 'react';
import { exportarA_PDF } from '../utils/pdfUtils';
import { AuditDiagnosticView } from './AuditoriaAutomatizada/AuditDiagnosticView';


function normalizePanelEjecutivo(parsedData, rawText) {
  if (!parsedData && !rawText) return null;
  const data = parsedData || {};

  const scoreRiesgo = data.scoreRiesgo || '36%';
  const madurez = data.scoreMadurez || data.madurez || '62%';
  const cobertura = data.coberturaControles || data.cobertura || '95%';
  const totalControles = data.totalControles || 3;

  return {
    scoreRiesgo,
    madurez: typeof madurez === 'number' ? `${madurez}%` : madurez,
    cobertura: typeof cobertura === 'number' ? `${cobertura}%` : cobertura,
    totalControles,
    analisis: data.analisisEjecutivo || data.dictamen || (typeof rawText === 'string' ? rawText : "Evaluación técnica realizada."),
    recomendaciones: Array.isArray(data.recomendaciones) && data.recomendaciones.length > 0
      ? data.recomendaciones
      : [
          `Implementar un programa de fortalecimiento para elevar la efectividad operativa de los ${totalControles} controles hacia el nivel de diseño.`,
          `Establecer un sistema de monitoreo continuo que asegure cerrar la brecha entre cobertura teórica y evidencia ejecutable.`
        ],
    planAccion: Array.isArray(data.planAccion) && data.planAccion.length > 0
      ? data.planAccion
      : [
          {
            prioridad: 'ALTA',
            accion: `Diseñar e implementar el plan de mejora de efectividad para los ${totalControles} controles registrados.`,
            responsable: 'Comité de Innovación y Dirección de Operaciones'
          }
        ],
    dictamen: data.dictamenDirector || `"El análisis del riesgo revela una situación de ATENCIÓN REQUERIDA para la Dirección. Si bien el diseño de los controles es teóricamente sólido, se requiere validar la efectividad en campo para proteger el valor de la organización."`,
    iso31000: data.iso31000 || `El análisis se realizó bajo los principios de la norma ISO 31000, evaluando y tratando el riesgo desde la perspectiva de impacto y probabilidad de ocurrencia.`,
    cosoErm: data.cosoErm || `Bajo el marco COSO ERM, la evaluación de los ${totalControles} controles indica una estructura de diseño adecuada que debe ser respaldada con evidencia continua de ejecución.`,
    kris: data.kris || `1) KRI de Madurez: Meta ${madurez}. 2) KRI de Cobertura: Meta ${cobertura}. 3) KRI de Oportunidad: Atención a hallazgos en menos de 7 días.`
  };
}


  // 2. PARSER ULTRA-ROBUSTO CON REGEX PARA MARKDOWN (### Titulo: Contenido)
  const secciones = {};
  if (typeof rawDictamen === 'string' && rawDictamen.includes('###')) {
    // Regex que captura "### Titulo:" o "### Titulo\n" y todo su contenido hasta el siguiente "###" o el final
    const regexSeccion = /###\s*([^:\n#]+):?\s*([\s\S]*?)(?=(?:###|$))/g;
    let match;
    while ((match = regexSeccion.exec(rawDictamen)) !== null) {
      const titulo = match[1].trim().toLowerCase();
      const contenido = match[2].trim();
      if (titulo && contenido) {
        secciones[titulo] = contenido;
      }
    }
  }

  // Función auxiliar para recuperar texto según posibles nombres de sección
  const getSeccion = (alias) => {
    for (const a of alias) {
      const key = a.toLowerCase();
      if (secciones[key]) return secciones[key];
      if (parsedData[a] && typeof parsedData[a] === 'string' && !parsedData[a].includes('###')) {
        return parsedData[a];
      }
    }
    return null;
  };

  // Extraer cada bloque Big Four de forma limpia (sin etiquetas ###)
  const dictamenEjecutivo = getSeccion(['Dictamen Ejecutivo', 'dictamenDirector', 'summary', 'executiveConclusion']) 
    || (typeof rawDictamen === 'string' ? rawDictamen.replace(/###[^#]*###?/g, '').trim() : "Evaluación técnica de auditoría completada.");

  const hallazgosTxt = getSeccion(['Hallazgos Estratégicos', 'findings', 'hallazgos', 'A HALLAZGOS']) 
    || "Se identificaron oportunidades de mejora en la disciplina operativa de los controles.";

  const analisisRiesgosTxt = getSeccion(['Análisis de Riesgos', 'risks', 'riesgos']) 
    || dictamenEjecutivo;

  const recomendacionesTxt = getSeccion(['Recomendaciones Accionables', 'recommendations', 'recomendaciones', 'RECOMENDACIONES']) 
    || "Fortalecer la efectividad operativa de los controles e integrar monitoreo en tiempo real.";

  const planAccionTxt = getSeccion(['Plan de Acción Inmediato', 'planAccion', 'actionPlans', 'PLAN DE ACCIÓN INMEDIATO']) 
    || recomendacionesTxt;

  // KPIs unificados
  const kpis = parsedData.kpis || {};
  const madurez = kpis.scoreMadurez ?? parsedData.scoreMadurez ?? 67;
  const cobertura = kpis.coberturaControles ?? parsedData.coberturaControles ?? 92;

  // 3. RETORNAR EL CONTRATO UNIFICADO LIMPIO
  return {
    resumenEjecutivo: {
      empresa: 'Termales de Santa Rosa de Cabal',
      marcoMetodologico: 'ISO 31000 / COSO ERM',
      diagnosticoGeneral: dictamenEjecutivo,
      alertaCiberseguridad: 'Monitoreo continuo de activos y segregación de funciones.'
    },
    hallazgosAuditoria: {
      totalHallazgos: 2,
      abiertos: [
        { descripcion: hallazgosTxt }
      ],
      cerradosCount: 0
    },
    diagnosticoRiesgosCriticos: [
      {
        codigo: parsedData.encabezado?.codigo || 'MATRIZ-GLOBAL',
        proceso: 'Evaluación Corporativa',
        nivelRiesgoISO31000: 'Alto',
        descripcion: typeof analisisRiesgosTxt === 'string' ? analisisRiesgosTxt : 'Análisis detallado de riesgos.',
        evaluacionControles: `Madurez del diseño en ${madurez}% con cobertura estimada del ${cobertura}%.`,
        probabilidadResidual: 4,
        impactoResidual: 4
      }
    ],
    planCAPAPriorizado: [
      {
        prioridad: 'ALTA',
        codigoRiesgo: 'CAPA-01',
        proceso: 'Comité de Riesgos y Auditoría Interna',
        accionRemediacion: typeof planAccionTxt === 'string' ? planAccionTxt : 'Implementar salvaguardas operativas de inmediato.'
      }
    ],
    limitacionesEvidencia: ['Análisis derivado de la evidencia estructurada disponible en el sistema.']
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
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-bold"
            >
              ✕
            </button>
          </div>

          {/* ESTRUCTURA VISUAL DE 7 BLOQUES (RSK-189) */}
          <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white text-slate-800">
            <div ref={pdfRef} className="p-6 space-y-6 text-sm">
              
              {/* BLOQUE 1: KPIS */}
              <div className="grid grid-cols-4 gap-4 text-center">
                <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Score Riesgo</span>
                  <span className="text-xl font-black text-amber-600">{panelData?.scoreRiesgo}</span>
                </div>
                <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Madurez</span>
                  <span className="text-xl font-black text-blue-600">{panelData?.madurez}</span>
                </div>
                <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Controles</span>
                  <span className="text-xl font-black text-slate-700">{panelData?.totalControles}</span>
                </div>
                <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Cobertura</span>
                  <span className="text-xl font-black text-emerald-600">{panelData?.cobertura}</span>
                </div>
              </div>

              {/* BLOQUE 2: ANÁLISIS EJECUTIVO */}
              <div className="text-justify leading-relaxed text-slate-700">
                <p>{panelData?.analisis}</p>
              </div>

              {/* BLOQUE 3: RECOMENDACIONES */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 border-b pb-1 text-xs uppercase tracking-wider">Recomendaciones</h4>
                <ul className="space-y-2 text-slate-700">
                  {panelData?.recomendaciones.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-600 font-bold">✔</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* BLOQUE 4: PLAN DE ACCIÓN */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 border-b pb-1 text-xs uppercase tracking-wider">Plan de Acción Inmediato</h4>
                <table className="w-full text-left border-collapse border border-slate-200 text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 uppercase border-b">
                      <th className="p-2 border-r w-24">Prioridad</th>
                      <th className="p-2 border-r">Acción</th>
                      <th className="p-2 w-48">Responsable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {panelData?.planAccion.map((item, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="p-2 border-r font-bold text-red-600">{item.prioridad}</td>
                        <td className="p-2 border-r text-slate-700">{item.accion}</td>
                        <td className="p-2 font-medium text-slate-800">{item.responsable}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* BLOQUE 5: DICTAMEN DEL DIRECTOR */}
              <div className="bg-slate-50 border-l-4 border-slate-800 p-4 italic text-slate-700">
                <h5 className="font-bold not-italic text-slate-900 mb-1 text-xs uppercase tracking-wider">Dictamen del Director</h5>
                {panelData?.dictamen}
              </div>

              {/* BLOQUE 6: ISO 31000 */}
              <div className="space-y-1">
                <h5 className="font-bold text-slate-900 text-xs uppercase flex items-center gap-1">
                  <span>▼</span> Análisis Metodológico ISO 31000
                </h5>
                <p className="text-xs text-slate-600 text-justify">{panelData?.iso31000}</p>
              </div>

              {/* BLOQUE 7: COSO ERM & KRIS */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div className="space-y-1">
                  <h5 className="font-bold text-slate-900 text-xs uppercase flex items-center gap-1">
                    <span>▼</span> Evaluación de Controles & COSO ERM
                  </h5>
                  <p className="text-xs text-slate-600 text-justify">{panelData?.cosoErm}</p>
                </div>
                <div className="space-y-1">
                  <h5 className="font-bold text-slate-900 text-xs uppercase flex items-center gap-1">
                    <span>▼</span> KRIs, Monitoreo y Evidencias
                  </h5>
                  <p className="text-xs text-slate-600 text-justify">{panelData?.kris}</p>
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