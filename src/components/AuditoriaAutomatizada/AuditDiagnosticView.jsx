import React from 'react';
import { 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  FileText, 
  TrendingUp, 
  Info 
} from 'lucide-react';

export const AuditDiagnosticView = ({ auditData }) => {
  if (!auditData) return null;

  const {
    resumenEjecutivo,
    diagnosticoRiesgosCriticos = [],
    hallazgosAuditoria,
    planCAPAPriorizado = [],
    limitacionesEvidencia = []
  } = auditData;

  // Helper para badges de riesgo ISO 31000
  const getSeverityBadge = (level = '') => {
    const l = level.toLowerCase();
    if (l.includes('crítico') || l.includes('inaceptable')) {
      return 'bg-red-100 text-red-800 border-red-300';
    }
    if (l.includes('alto')) {
      return 'bg-orange-100 text-orange-800 border-orange-300';
    }
    if (l.includes('medio')) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    }
    return 'bg-blue-100 text-blue-800 border-blue-300';
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-8 bg-slate-50 font-sans">
      
      {/* 1. ENCABEZADO Y RESUMEN EJECUTIVO */}
      <header className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 space-y-4">
        <div className="flex justify-between items-start border-b border-slate-100 pb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Informe Técnico de Auditoría Interna
            </span>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">
              {resumenEjecutivo?.empresa || 'Organización'}
            </h1>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            Marco: {resumenEjecutivo?.marcoMetodologico}
          </span>
        </div>

        <p className="text-slate-700 text-sm leading-relaxed">
          {resumenEjecutivo?.diagnosticoGeneral}
        </p>

        {/* Banner de Ciberseguridad / Alerta */}
        {resumenEjecutivo?.alertaCiberseguridad && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-sm">
            <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold">Nota de Cobertura / Ciberseguridad:</strong>
              <p className="mt-0.5 text-amber-800">{resumenEjecutivo.alertaCiberseguridad}</p>
            </div>
          </div>
        )}
      </header>

      {/* 2. TARJETAS DE MÉTRICAS RÁPIDAS (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">Hallazgos Registrados</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {hallazgosAuditoria?.totalHallazgos || 0}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              <span className="text-amber-600 font-semibold">{hallazgosAuditoria?.abiertos?.length || 0} abiertos</span> · {hallazgosAuditoria?.cerradosCount || 0} cerrados
            </p>
          </div>
          <FileText className="w-10 h-10 text-slate-300" />
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">Riesgos Críticos Identificados</p>
            <p className="text-2xl font-bold text-red-600 mt-1">
              {diagnosticoRiesgosCriticos.length}
            </p>
            <p className="text-xs text-slate-500 mt-1">Requieren atención inmediata</p>
          </div>
          <ShieldAlert className="w-10 h-10 text-red-200" />
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">Acciones CAPA Priorizadas</p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">
              {planCAPAPriorizado.length}
            </p>
            <p className="text-xs text-slate-500 mt-1">Planes de remediación activos</p>
          </div>
          <TrendingUp className="w-10 h-10 text-indigo-200" />
        </div>
      </div>

      {/* 3. MATRIZ DE RIESGOS CRÍTICOS (ISO 31000) */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <h2 className="text-lg font-bold text-slate-900">Diagnóstico de Riesgos Críticos</h2>
        </div>

        <div className="divide-y divide-slate-100">
          {diagnosticoRiesgosCriticos.map((item, idx) => (
            <div key={idx} className="p-5 hover:bg-slate-50 transition-colors space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs px-2.5 py-1 bg-slate-100 font-bold rounded text-slate-700">
                    CÓDIGO {item.codigo}
                  </span>
                  <span className="text-xs font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                    Proceso: {item.proceso}
                  </span>
                </div>
                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${getSeverityBadge(item.nivelRiesgoISO31000)}`}>
                  ISO 31000: {item.nivelRiesgoISO31000}
                </span>
              </div>

              <p className="text-slate-800 font-medium text-sm">
                {item.descripcion}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-xs">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                  <span className="text-slate-500 font-semibold block mb-1">Evaluación de Controles:</span>
                  <p className="text-slate-700">{item.evaluacionControles}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60 flex items-center justify-around text-center">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Probabilidad Residual</span>
                    <span className="text-base font-bold text-slate-800">{item.probabilidadResidual ?? 'N/A'}</span>
                  </div>
                  <div className="h-8 w-px bg-slate-200"></div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Impacto Residual</span>
                    <span className="text-base font-bold text-red-600">{item.impactoResidual ?? 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. PLAN DE ACCIÓN Y REMEDIACIÓN (CAPA) */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-slate-900">Plan CAPA Priorizado</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {planCAPAPriorizado.map((capa) => (
            <div key={capa.prioridad} className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-600"></div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  Prioridad #{capa.prioridad}
                </span>
                <span className="text-slate-400">Riesgo Asociado: #{capa.codigoRiesgo}</span>
              </div>
              <h3 className="font-semibold text-sm text-slate-800">{capa.proceso}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {capa.accionRemediacion}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. LIMITACIONES DE EVIDENCIA (GUARDRAILS CALLOUT) */}
      {limitacionesEvidencia.length > 0 && (
        <section className="p-4 bg-slate-100 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2">
          <span className="font-bold text-slate-700 block uppercase tracking-wider text-[10px]">
            Trazabilidad y Limitaciones de Evidencia
          </span>
          <ul className="list-disc list-inside space-y-1 pl-1">
            {limitacionesEvidencia.map((lim, i) => (
              <li key={i}>{lim}</li>
            ))}
          </ul>
        </section>
      )}

    </div>
  );
};