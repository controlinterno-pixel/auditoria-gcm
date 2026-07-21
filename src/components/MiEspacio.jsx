import React, { useMemo, useRef, useEffect } from 'react';
import { MAPA_PROCESOS } from '../constants/diccionariosGRC';

// 🧠 Lista oficial limpia a prueba de fallos
const PROCESOS_OFICIALES = MAPA_PROCESOS ? Object.keys(MAPA_PROCESOS).reduce((acc, macro) => {
  acc.push(macro);
  const subs = MAPA_PROCESOS[macro];
  if (Array.isArray(subs)) {
    subs.forEach(sub => {
      if (sub !== 'General' && !acc.includes(sub)) {
        acc.push(`Subproceso ${sub.toLowerCase()}`);
      }
    });
  }
  return acc;
}, []).sort() : [];

// 🧹 Normalizador
const normalizeStr = (str) => {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") 
    .replace(/[^a-z0-9]/g, ""); 
};

// 🗺️ Motor Homologador
const homologarProcesoUniversal = (nombreEntrante, listaOficial = []) => {
  if (!nombreEntrante) return "";

  const normEntrante = normalizeStr(nombreEntrante);

  const MAPA_EXCEPCIONES = {
    "servicioalcliente": "Gestión de servicio al cliente",
    "gestionadministrativa": "Gestión Administrativa y Financiera",
    "gestionfinanciera": "Gestión Administrativa y Financiera",
    "comprasyabastecimiento": "Gestión de la cadena de abastecimiento",
    "tecnologiati": "I+D+i",
    "ti": "I+D+i",
    "sstymedioambiente": "Subproceso gestión ambiental",
    "medioambiente": "Subproceso gestión ambiental",
    "gestiondeoperacionesyservicios": "Gestión de operaciones y servicios",
    "gestiondeoperaciones": "Gestión de operaciones y servicios",
    "operaciones": "Gestión de operaciones y servicios"
  };

  if (MAPA_EXCEPCIONES[normEntrante]) {
    return MAPA_EXCEPCIONES[normEntrante];
  }

  const coincidenciaExacta = listaOficial.find(p => normalizeStr(p) === normEntrante);
  if (coincidenciaExacta) return coincidenciaExacta;

  const coincidenciaParcial = listaOficial.find(p => {
    const normOficial = normalizeStr(p);
    return normOficial.includes(normEntrante) || normEntrante.includes(normOficial);
  });

  return coincidenciaParcial || nombreEntrante;
};

export default function MiEspacio({
  user, safePlanes = [], safeHallazgos = [], safeComites = [], safeCronograma = [],
  safeRiesgos = [], safeEvaluaciones = [], informesAuditoria = [],
  activeTab, setActiveTab, setSubTabResultados, setSubTabPlanes, scrollToForm,
  selectedProceso, setSelectedProceso
}) {
  const usuarioNombre = user?.email?.split('@')[0] || 'Líder de GRC';
  const totalVencidos = safePlanes.filter(p => p.estado !== 'Cerrado' && p.fecha && new Date(p.fecha) < new Date()).length;
  const totalAbiertos = safeHallazgos.filter(h => h.estado === 'Abierto').length;
  const totalRevision = safePlanes.filter(p => p.estadoWorkflow === 'En Revisión').length;

  const expedienteRef = useRef(null);

  const procesoHomologado = useMemo(() => {
    return homologarProcesoUniversal(selectedProceso, PROCESOS_OFICIALES);
  }, [selectedProceso]);

  useEffect(() => {
    if (selectedProceso && expedienteRef.current) {
      const timer = setTimeout(() => {
        expedienteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [selectedProceso]);

  const expedienteSeleccionado = useMemo(() => {
    if (!procesoHomologado) return null;

    const target = normalizeStr(procesoHomologado);

    const auditorias = (safeCronograma || []).filter(c => normalizeStr(c.proceso) === target);
    const auditoria = auditorias.length > 0 ? auditorias[auditorias.length - 1] : { responsable: 'Múltiples / No asignado', enfoque: 'N/A', meses: [] };

    const riesgosVinculados = (safeRiesgos || []).filter(r => normalizeStr(r.proceso) === target);
    const evaluacionesVinculadas = (safeEvaluaciones || []).filter(ev => riesgosVinculados.some(r => r.id === ev.idRiesgo));
    const hallazgosVinculados = (safeHallazgos || []).filter(h => normalizeStr(h.proceso) === target || riesgosVinculados.some(r => r.id === h.idRiesgo));
    const planesVinculados = (safePlanes || []).filter(p => hallazgosVinculados.some(h => h.id === p.idHallazgo));
    const informesVinculados = (informesAuditoria || []).filter(inf => normalizeStr(inf.proceso) === target);

    return {
      auditoria,
      proceso: procesoHomologado,
      riesgos: riesgosVinculados,
      evaluaciones: evaluacionesVinculadas,
      hallazgos: hallazgosVinculados,
      planes: planesVinculados,
      informes: informesVinculados
    };
  }, [procesoHomologado, safeCronograma, safeRiesgos, safeEvaluaciones, safeHallazgos, safePlanes, informesAuditoria]);

  return (
    <div className="space-y-6 text-left">
      {/* BANNER DE BIENVENIDA */}
      <div className="bg-[#0a1122] border border-blue-500/20 p-6 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="space-y-1 relative z-10">
          <h2 className="text-2xl font-black text-white">¡Buen día, <span className="text-emerald-400 capitalize">{usuarioNombre}</span>!</h2>
          <p className="text-xs text-slate-400 font-bold">Consola de Gobierno, Gestión de Riesgos y Cumplimiento Normativo • Termales Santa Rosa</p>
        </div>
      </div>

      {/* 📁 EXPEDIENTE ÚNICO MAESTRO */}
      <div 
        ref={expedienteRef}
        className="bg-[#0a1122] border border-blue-500/20 p-6 sm:p-8 rounded-3xl shadow-[0_0_40px_rgba(59,130,246,0.06)] space-y-6 relative overflow-hidden scroll-mt-6"
      >
        <div className="border-b border-slate-800/80 pb-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
          <div>
            <div className="inline-block px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-black uppercase tracking-widest rounded mb-2">Expediente Vivo</div>
            <h3 className="text-sm font-black tracking-widest uppercase text-white">📁 Expediente Único de Auditoría 360°</h3>
            <p className="text-[10px] text-slate-400 font-medium mt-1">Visión panorámica de la auditoría. Navegación End-to-End sin cambiar de módulo.</p>
          </div>
          <select
            value={procesoHomologado || ''}
            onChange={(e) => setSelectedProceso && setSelectedProceso(e.target.value)}
            className="bg-[#060b16] border border-blue-500/30 rounded-xl text-xs font-black py-3.5 px-4 text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-96 shadow-inner cursor-pointer"
          >
            <option value="">-- Seleccionar Proceso --</option>
            {PROCESOS_OFICIALES.map((proc, idx) => (
              <option key={`opt-${idx}`} value={proc}>📁 {proc}</option>
            ))}
          </select>
        </div>

        {expedienteSeleccionado ? (
          <div className="relative animate-in fade-in duration-700 pl-6 sm:pl-10 pt-4 pb-4">
            <div className="space-y-10 relative z-10">
              
              {/* NODO 1: PLANIFICACIÓN */}
              <div className="relative flex items-start group">
                <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl w-full">
                  <div className="flex justify-between items-start mb-2 border-b border-slate-800/80 pb-2">
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">1. Planificación Estratégica</span>
                    <span className="px-2 py-0.5 bg-[#060b16] border border-slate-700 text-slate-300 text-[9px] font-bold rounded">
                      Meses: {Array.isArray(expedienteSeleccionado.auditoria.meses) ? expedienteSeleccionado.auditoria.meses.join(', ') : (expedienteSeleccionado.auditoria.meses || 'N/A')}
                    </span>
                  </div>
                  <h4 className="text-base font-black text-white">{expedienteSeleccionado.proceso}</h4>
                  <p className="text-[10px] text-slate-400 mt-1.5 font-medium leading-relaxed">
                    <b className="text-slate-300">Auditor Asignado:</b> {expedienteSeleccionado.auditoria.responsable}<br/>
                    <b className="text-slate-300">Enfoque:</b> {expedienteSeleccionado.auditoria.enfoque}
                  </p>
                </div>
              </div>

              {/* NODO 2: RIESGOS */}
              <div className="relative flex items-start group">
                <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl w-full">
                  <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-3 block border-b border-slate-800/80 pb-2">2. Riesgos Mapeados del Proceso</span>
                  <div className="flex items-center space-x-5">
                    <div className="text-4xl font-black text-white">{expedienteSeleccionado.riesgos.length}</div>
                    <div className="text-[11px] text-slate-400 font-medium">
                      Registrados en la matriz corporativa.
                    </div>
                  </div>
                </div>
              </div>

              {/* NODO 3: HALLAZGOS */}
              <div className="relative flex items-start group">
                <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl w-full">
                  <span className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-3 block border-b border-slate-800/80 pb-2">3. Hallazgos Detectados</span>
                  {expedienteSeleccionado.hallazgos.length === 0 ? (
                    <div className="text-[11px] text-slate-500 italic py-2">✅ Sin hallazgos abiertos registrados.</div>
                  ) : (
                    <div className="space-y-2">
                      {expedienteSeleccionado.hallazgos.map((h, i) => (
                        <div key={i} className="flex justify-between items-center bg-[#060b16] p-3 rounded-xl border border-slate-800">
                          <span className="text-[11px] text-slate-300 font-bold">[{h.ref || 'HALL'}] {h.titulo}</span>
                          <span className="text-[9px] font-black px-2 py-0.5 rounded uppercase border bg-red-500/10 text-red-400 border-red-500/30">{h.estado}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-slate-500">
            <p className="text-sm font-black uppercase">Selecciona un proceso arriba para desplegar su expediente</p>
          </div>
        )}
      </div>

    </div>
  );
}