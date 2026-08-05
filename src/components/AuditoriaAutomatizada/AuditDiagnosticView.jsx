// Ruta: src/components/AuditoriaAutomatizada/AuditDiagnosticView.jsx
import React from 'react';
import { AlertTriangle, ShieldAlert, CheckCircle2, FileText, TrendingUp, Info } from 'lucide-react';
import { RiskHeatmap } from './RiskHeatmap';

export const AuditDiagnosticView = ({ auditData }) => {
  if (!auditData) return null;

  const {
    resumenEjecutivo,
    diagnosticoRiesgosCriticos = [],
    hallazgosAuditoria,
    planCAPAPriorizado = [],
    limitacionesEvidencia = []
  } = auditData;

  const getSeverityBadge = (level = '') => {
    const l = level.toLowerCase();
    if (l.includes('crítico') || l.includes('inaceptable')) return 'bg-red-950/80 text-red-300 border-red-800';
    if (l.includes('alto')) return 'bg-amber-950/80 text-amber-300 border-amber-800';
    if (l.includes('medio')) return 'bg-yellow-950/80 text-yellow-300 border-yellow-800';
    return 'bg-blue-950/80 text-blue-300 border-blue-800';
  };

  return (
    <div className="w-full space-y-6 text-slate-100 font-sans">
      
      {/* 1. ENCABEZADO Y RESUMEN EJECUTIVO */}
      <header className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700/60 space-y-4 shadow-xl">
        <div className="flex justify-between items-start border-b border-slate-700/60 pb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950/80 border border-cyan-800/50 px-2.5 py-0.5 rounded-md">
              Informe Técnico de Auditoría Interna
            </span>
            <h1 className="text-2xl font-black text-white mt-2">
              {resumenEjecutivo?.empresa || 'Termales de Santa Rosa de Cabal'}
            </h1>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-900 text-cyan-300 border border-slate-700">
            Marco: {resumenEjecutivo?.marcoMetodologico || 'ISO 31000 / COSO ERM'}
          </span>
        </div>

        <p className="text-slate-300 text-sm leading-relaxed">
          {resumenEjecutivo?.diagnosticoGeneral}
        </p>

        {resumenEjecutivo?.alertaCiberseguridad && (
          <div className="flex items-start gap-3 p-4 bg-amber-950/40 rounded-xl border border-amber-800/50 text-amber-200 text-sm">
            <Info className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold text-amber-300">Nota de Cobertura / Ciberseguridad:</strong>
              <p className="mt-0.5 text-amber-200/80 text-xs">{resumenEjecutivo.alertaCiberseguridad}</p>
            </div>
          </div>
        )}
      </header>

      {/* 2. TARJETAS DE MÉTRICAS RÁPIDAS (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/60 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase">Hallazgos Registrados</p>
            <p className="text-3xl font-extrabold text-white mt-1">
              {hallazgosAuditoria?.totalHallazgos || 0}
            </p>
          </div>
          <FileText className="w-10 h-10 text-slate-600" />
        </div>

        <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/60 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase">Riesgos Críticos</p>
            <p className="text-3xl font-extrabold text-rose-400 mt-1">
              {diagnosticoRiesgosCriticos.length}
            </p>
          </div>
          <ShieldAlert className="w-10 h-10 text-rose-950" />
        </div>

        <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/60 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase">Acciones CAPA</p>
            <p className="text-3xl font-extrabold text-cyan-400 mt-1">
              {planCAPAPriorizado.length}
            </p>
          </div>
          <TrendingUp className="w-10 h-10 text-cyan-950" />
        </div>
      </div>

      {/* 3. MATRIZ TÉRMICA 5x5 */}
      <RiskHeatmap riesgos={diagnosticoRiesgosCriticos} />

      {/* 4. DIAGNÓSTICO DE RIESGOS CRÍTICOS */}
      <section className="bg-slate-800/80 rounded-2xl shadow-xl border border-slate-700/60 overflow-hidden">
        <div className="p-5 border-b border-slate-700/60 flex items-center gap-2 bg-slate-900/50">
          <AlertTriangle className="w-5 h-5 text-rose-400" />
          <h2 className="text-base font-bold text-white">Diagnóstico de Riesgos Críticos</h2>
        </div>

        <div className="divide-y divide-slate-700/50">
          {diagnosticoRiesgosCriticos.map((item, idx) => (
            <div key={idx} className="p-5 hover:bg-slate-800/50 transition-colors space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs px-2.5 py-1 bg-slate-900 font-bold rounded border border-slate-700 text-cyan-400">
                  CÓDIGO {item.codigo}
                </span>
                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${getSeverityBadge(item.nivelRiesgoISO31000)}`}>
                  ISO 31000: {item.nivelRiesgoISO31000}
                </span>
              </div>

              <p className="text-slate-200 font-medium text-sm">{item.descripcion}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/40">
                  <span className="text-slate-400 font-semibold block mb-1">Evaluación de Controles:</span>
                  <p className="text-slate-300">{item.evaluacionControles}</p>
                </div>
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/40 flex items-center justify-around text-center">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Probabilidad</span>
                    <span className="text-base font-bold text-white">{item.probabilidadResidual ?? 'N/A'}</span>
                  </div>
                  <div className="h-8 w-px bg-slate-700"></div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Impacto</span>
                    <span className="text-base font-bold text-rose-400">{item.impactoResidual ?? 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. PLAN CAPA PRIORIZADO */}
      <section className="bg-slate-800/80 rounded-2xl shadow-xl border border-slate-700/60 p-5 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-700/60">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <h2 className="text-base font-bold text-white">Plan CAPA Priorizado</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {planCAPAPriorizado.map((capa, idx) => (
            <div key={idx} className="p-4 rounded-xl border border-slate-700/60 bg-slate-900/50 space-y-2 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500"></div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/50">
                  Prioridad #{capa.prioridad}
                </span>
                <span className="text-slate-400">Riesgo: #{capa.codigoRiesgo}</span>
              </div>
              <h3 className="font-semibold text-sm text-white">{capa.proceso}</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{capa.accionRemediacion}</p>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
};