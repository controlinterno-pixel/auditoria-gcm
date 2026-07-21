import React, { useState, useMemo, useRef, useEffect } from 'react';
import InformeProceso from './InformeProceso';
import { MAPA_PROCESOS } from '../constants/diccionariosGRC';

// 🧠 Lista oficial de procesos
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

// 🧹 Normalizador estricto
const normalizeStr = (str) => {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") 
    .replace(/[^a-z0-9]/g, ""); 
};

// 🗺️ Motor Homologador Universal
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
    "operaciones": "Gestión de operaciones y servicios",
    "gestioncomercialymercadeo": "Gestión comercial y mercadeo",
    "gestiondetalentohumano": "Gestión de talento humano"
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
  const usuarioNombre = user?.email?.split('@')[0] || 'Controlinterno';
const [pestanaActiva, setPestanaActiva] = useState('resumen');
  
  // Listas seguras contra valores nulos
  const planesList = Array.isArray(safePlanes) ? safePlanes : [];
  const hallazgosList = Array.isArray(safeHallazgos) ? safeHallazgos : [];
  const cronogramaList = Array.isArray(safeCronograma) ? safeCronograma : [];
  const riesgosList = Array.isArray(safeRiesgos) ? safeRiesgos : [];
  const evaluacionesList = Array.isArray(safeEvaluaciones) ? safeEvaluaciones : [];
  const informesList = Array.isArray(informesAuditoria) ? informesAuditoria : [];
  const comitesList = Array.isArray(safeComites) ? safeComites : [];

  // Cálculos dinámicos
  const totalVencidos = planesList.filter(p => p.estado !== 'Cerrado' && p.fecha && new Date(p.fecha) < new Date()).length;
  const totalAbiertos = hallazgosList.filter(h => h.estado === 'Abierto').length;
  const totalRevision = planesList.filter(p => p.estadoWorkflow === 'En Revisión').length;

  const expedienteRef = useRef(null);

  const procesoHomologado = useMemo(() => {
    return homologarProcesoUniversal(selectedProceso, PROCESOS_OFICIALES);
  }, [selectedProceso]);

// 🎯 MANTENER Y ENFOCAR EN EL EXPEDIENTE 360° AL CAMBIAR DE PROCESO
  useEffect(() => {
    if (selectedProceso && expedienteRef.current) {
      expedienteRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedProceso]);
  
  const expedienteSeleccionado = useMemo(() => {
    if (!procesoHomologado) return null;

    const target = normalizeStr(procesoHomologado);

    // Helper flexible para hacer match en proceso o subproceso
    const matchesTarget = (itemStr) => {
      if (!itemStr) return false;
      const norm = normalizeStr(itemStr);
      return norm === target || norm.includes(target) || target.includes(norm);
    };

    const auditorias = cronogramaList.filter(c => matchesTarget(c.proceso) || matchesTarget(c.subproceso));
    const auditoria = auditorias.length > 0 ? auditorias[auditorias.length - 1] : { responsable: 'Múltiples / No asignado', enfoque: 'N/A', meses: [] };

    const riesgosVinculados = riesgosList.filter(r => matchesTarget(r.proceso) || matchesTarget(r.macroproceso) || matchesTarget(r.subproceso));
    const evaluacionesVinculadas = evaluacionesList.filter(ev => riesgosVinculados.some(r => r.id === ev.idRiesgo) || matchesTarget(ev.proceso) || matchesTarget(ev.subproceso));
    const hallazgosVinculados = hallazgosList.filter(h => matchesTarget(h.proceso) || matchesTarget(h.subproceso) || riesgosVinculados.some(r => r.id === h.idRiesgo));
    const planesVinculados = planesList.filter(p => hallazgosVinculados.some(h => h.id === p.idHallazgo) || matchesTarget(p.proceso) || matchesTarget(p.subproceso));
    
    // 🔍 AHORA BUSCA EN PROCESO, SUBPROCESO Y MACROPROCESO
    const informesVinculados = informesList.filter(inf => matchesTarget(inf.proceso) || matchesTarget(inf.subproceso) || matchesTarget(inf.macroproceso));

    return {
      auditoria,
      proceso: procesoHomologado,
      riesgos: riesgosVinculados,
      evaluaciones: evaluacionesVinculadas,
      hallazgos: hallazgosVinculados,
      planes: planesVinculados,
      informes: informesVinculados
    };
  }, [procesoHomologado, cronogramaList, riesgosList, evaluacionesList, hallazgosList, planesList, informesList]);
  return (
    <div className="space-y-6 text-left">
      
      {/* 1️⃣ BANNER CON BOTONES DE ACCIÓN */}
      <div className="bg-[#0a1122] border border-blue-500/20 p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="space-y-1 relative z-10">
          <h2 className="text-2xl sm:text-3xl font-black text-white">¡Buen día, <span className="text-emerald-400 capitalize">{usuarioNombre}</span>!</h2>
          <p className="text-xs text-slate-400 font-bold">Consola de Gobierno, Gestión de Riesgos y Cumplimiento Normativo • Termales Santa Rosa</p>
        </div>
        <div className="flex flex-wrap gap-3 relative z-10">
          <button 
            onClick={() => { if(setActiveTab) setActiveTab('resultados_tab'); if(setSubTabResultados) setSubTabResultados('informes'); if(scrollToForm) scrollToForm(); }} 
            className="bg-[#1e293b]/80 hover:bg-[#334155] text-blue-400 font-black py-2.5 px-4 rounded-xl text-[10px] uppercase tracking-wider border border-blue-500/30 transition-all shadow-md"
          >
            FILTRAR INFORMES
          </button>
          <button 
            onClick={() => { if(setActiveTab) setActiveTab('planes_tab'); if(setSubTabPlanes) setSubTabPlanes('planes'); }} 
            className="bg-[#1e1b4b]/80 hover:bg-[#312e81] text-purple-400 font-black py-2.5 px-4 rounded-xl text-[10px] uppercase tracking-wider border border-purple-500/30 transition-all shadow-md"
          >
            GESTIONAR PLANES
          </button>
        </div>
      </div>

      {/* 2️⃣ BLOQUES PRINCIPALES DE MÉTRICAS (CUE DE TRABAJO) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Card 1: Hallazgos Abiertos */}
        <div 
          onClick={() => { if(setActiveTab) setActiveTab('resultados_tab'); if(setSubTabResultados) setSubTabResultados('hallazgos'); }} 
          className="bg-[#1c0d15] hover:bg-[#25101b] transition-all border border-red-500/20 p-6 rounded-2xl shadow-lg cursor-pointer flex flex-col justify-between"
        >
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">HALLAZGOS ABIERTOS</span>
            <span className="text-amber-400 text-sm">⚠️</span>
          </div>
          <div className="mt-4">
            <div className="text-4xl font-black text-white">{totalAbiertos}</div>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">Brechas por mitigar urgentemente</p>
          </div>
        </div>

        {/* Card 2: Planes Vencidos */}
        <div 
          onClick={() => { if(setActiveTab) setActiveTab('planes_tab'); if(setSubTabPlanes) setSubTabPlanes('planes'); }} 
          className="bg-[#1c140d] hover:bg-[#281d13] transition-all border border-amber-500/20 p-6 rounded-2xl shadow-lg cursor-pointer flex flex-col justify-between"
        >
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">PLANES VENCIDOS</span>
            <span className="text-amber-400 text-sm">⌛</span>
          </div>
          <div className="mt-4">
            <div className="text-4xl font-black text-white">{totalVencidos}</div>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">Fuera del límite programado</p>
          </div>
        </div>

        {/* Card 3: En Revisión por Auditor */}
        <div 
          onClick={() => { if(setActiveTab) setActiveTab('planes_tab'); if(setSubTabPlanes) setSubTabPlanes('planes'); }} 
          className="bg-[#0b171c] hover:bg-[#10232b] transition-all border border-cyan-500/20 p-6 rounded-2xl shadow-lg cursor-pointer flex flex-col justify-between"
        >
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">EN REVISIÓN POR AUDITOR</span>
            <span className="text-cyan-400 text-sm">🔬</span>
          </div>
          <div className="mt-4">
            <div className="text-4xl font-black text-white">{totalRevision}</div>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">Esperando aprobación de cierre</p>
          </div>
        </div>

        {/* Card 4: Sesiones de Comité */}
        <div 
          onClick={() => setActiveTab && setActiveTab('gobernanza_tab')} 
          className="bg-[#0e0c1a] hover:bg-[#141126] transition-all border border-purple-500/20 p-6 rounded-2xl shadow-lg cursor-pointer flex flex-col justify-between"
        >
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">SESIONES DE COMITÉ</span>
            <span className="text-purple-400 text-sm">👥</span>
          </div>
          <div className="mt-4">
            <div className="text-4xl font-black text-white">{comitesList.length}</div>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">Actas oficiales indexadas</p>
          </div>
        </div>

      </div>

      {/* 3️⃣ RUTA GUIADA DE AUDITORÍA (GRC ASSISTANT) */}
      <div className="bg-[#0a1122] border border-slate-800 p-6 rounded-3xl shadow-xl">
        <h3 className="text-xs font-black tracking-widest uppercase text-slate-300 mb-6 flex items-center gap-2">
          <span>🛣️</span> RUTA GUIADA DE AUDITORÍA (GRC ASSISTANT)
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {[
            { step: '1', name: 'Planificación', desc: 'Plan Anual y Riesgos', tab: 'plan_anual_tab' },
            { step: '2', name: 'Trabajo de Campo', desc: 'Pruebas de Controles', tab: 'evaluaciones' },
            { step: '3', name: 'Hallazgos', desc: 'Emisión de Brechas', tab: 'resultados_tab' },
            { step: '4', name: 'Plan de Acción', desc: 'Ejecución y Cierre', tab: 'planes_tab' },
            { step: '5', name: 'Gobernanza', desc: 'Comité y Trazabilidad', tab: 'gobernanza_tab' }
          ].map((st, i) => (
            <div 
              key={`step-${i}`}
              onClick={() => setActiveTab && setActiveTab(st.tab)}
              className="p-4 rounded-2xl border border-slate-800/80 bg-[#060b16]/80 hover:border-blue-500/50 hover:bg-[#0c162b] transition-all cursor-pointer flex flex-col justify-between h-28 group"
            >
              <div className="flex justify-between items-center">
                <span className="w-6 h-6 rounded-full bg-slate-800/80 text-slate-400 font-black text-xs flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  {st.step}
                </span>
              </div>
              <div>
                <h4 className="text-xs font-black text-white group-hover:text-blue-400 transition-colors">{st.name}</h4>
                <p className="text-[9px] text-slate-500 font-bold mt-0.5">{st.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* 4️⃣ EXPEDIENTE ÚNICO DE AUDITORÍA 360° */}
      <div 
        ref={expedienteRef}
        className="bg-[#0a1122] border border-blue-500/20 p-6 sm:p-8 rounded-3xl shadow-[0_0_40px_rgba(59,130,246,0.06)] space-y-6 relative overflow-hidden scroll-mt-6"
      >
        <div className="border-b border-slate-800/80 pb-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
          <div>
            <div className="inline-block px-3 py-1 bg-blue-600/20 border border-blue-500/30 text-blue-400 text-[9px] font-black uppercase tracking-widest rounded-lg mb-2">
              FASE 2 COMPLETADA
            </div>
            <h3 className="text-sm font-black tracking-widest uppercase text-white flex items-center gap-2">
              <span>📁</span> EXPEDIENTE ÚNICO DE AUDITORÍA 360°
            </h3>
            <p className="text-[10px] text-slate-400 font-medium mt-1">
              Visión panorámica de la auditoría. Navegación End-to-End sin cambiar de módulo.
            </p>
          </div>

          <select
            value={procesoHomologado || ''}
            onChange={(e) => {
  if(setSelectedProceso) setSelectedProceso(e.target.value);
  setPestanaActiva('resumen');
}}
            className="bg-[#060b16] border border-blue-500/30 rounded-xl text-xs font-black py-3.5 px-4 text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-96 shadow-inner cursor-pointer"
          >
            <option value="">-- Seleccionar Proceso --</option>
            {PROCESOS_OFICIALES.map((proc, idx) => (
              <option key={`opt-${idx}`} value={proc}>📁 {proc}</option>
            ))}
          </select>
        </div>

        {expedienteSeleccionado ? (
  <>
    {/* MENÚ DE PESTAÑAS */}
    <div className="flex space-x-2 border-b border-slate-800/80 mb-2 mt-4 relative z-10 pl-6 sm:pl-10">
      <button
        onClick={() => setPestanaActiva('resumen')}
        className={`px-5 py-3 font-black text-[10px] uppercase tracking-widest rounded-t-lg transition-colors border-t border-x ${
          pestanaActiva === 'resumen' 
            ? 'bg-blue-900/30 text-blue-400 border-blue-500/40 border-b-transparent shadow-[0_-4px_15px_rgba(59,130,246,0.1)]' 
            : 'bg-[#060b16] text-slate-500 border-slate-800 border-b-transparent hover:text-slate-300'
        }`}
      >
        📊 Resumen Ejecutivo
      </button>
      <button
        onClick={() => setPestanaActiva('nodos')}
        className={`px-5 py-3 font-black text-[10px] uppercase tracking-widest rounded-t-lg transition-colors border-t border-x ${
          pestanaActiva === 'nodos' 
            ? 'bg-blue-900/30 text-blue-400 border-blue-500/40 border-b-transparent shadow-[0_-4px_15px_rgba(59,130,246,0.1)]' 
            : 'bg-[#060b16] text-slate-500 border-slate-800 border-b-transparent hover:text-slate-300'
        }`}
      >
        ⚙️ Detalle Operativo (6 Nodos)
      </button>
    </div>

   {/* CONTENIDO DEL INFORME (PESTAÑA 1) */}
    {pestanaActiva === 'resumen' && (
      <div className="relative animate-in fade-in duration-500 pt-4 pl-6 sm:pl-10">
        <InformeProceso 
          datosProceso={{
            nombreProceso: expedienteSeleccionado.proceso,
            fechaGeneracion: new Date().toLocaleDateString(),
            cumplimiento: expedienteSeleccionado.hallazgos.filter(h => h.estado !== 'Abierto').length === expedienteSeleccionado.hallazgos.length && expedienteSeleccionado.hallazgos.length > 0 ? 100 : 91,
            totales: {
              auditorias: 1,
              riesgos: expedienteSeleccionado.riesgos.length,
              hallazgos: expedienteSeleccionado.hallazgos.length,
              planes: expedienteSeleccionado.planes.length,
            },
            topRiesgos: expedienteSeleccionado.riesgos.slice(0, 5),
            topHallazgos: expedienteSeleccionado.hallazgos.slice(0, 5),
            estadisticas: {
              hallazgosAbiertos: expedienteSeleccionado.hallazgos.filter(h => h.estado === 'Abierto').length,
              riesgosCriticos: expedienteSeleccionado.riesgos.filter(r => (Number(r.probabilidadResidual || 1) * Number(r.impactoResidual || 1)) >= 16).length
            }
          }} 
        />
      </div>
    )}

    {/* CONTENIDO DE LOS NODOS (PESTAÑA 2) */}
    {pestanaActiva === 'nodos' && (
      <div className="relative animate-in fade-in duration-700 pl-6 sm:pl-10 pt-4 pb-4">            
            <div className="absolute left-[34px] sm:left-[50px] top-8 bottom-8 w-[3px] bg-gradient-to-b from-blue-500 via-purple-500 to-emerald-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>

            <div className="space-y-10 relative z-10">
              
              {/* NODO 1: PLANIFICACIÓN */}
              <div className="relative flex items-start group">
                <div className="absolute -left-[24px] sm:-left-[24px] w-12 h-12 bg-[#060b16] border-2 border-blue-500 rounded-full flex items-center justify-center text-xl shadow-[0_0_20px_rgba(59,130,246,0.5)] group-hover:scale-110 transition-transform">
                  🏢
                </div>
                <div className="ml-10 sm:ml-12 bg-slate-900/60 border border-slate-800 p-5 rounded-2xl w-full hover:border-blue-500/40 transition-colors shadow-lg">
                  <div className="flex justify-between items-start mb-2 border-b border-slate-800/80 pb-2">
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">1. Planificación Estratégica</span>
                    <span className="px-2 py-0.5 bg-[#060b16] border border-slate-700 text-slate-300 text-[9px] font-bold rounded">
                      Meses: {
                        Array.isArray(expedienteSeleccionado.auditoria.meses) 
                          ? expedienteSeleccionado.auditoria.meses.join(', ') 
                          : String(expedienteSeleccionado.auditoria.meses || 'Enero - Diciembre')
                      }
                    </span>
                  </div>
                  <h4 className="text-base font-black text-white">{expedienteSeleccionado.proceso}</h4>
                  <p className="text-[10px] text-slate-400 mt-1.5 font-medium leading-relaxed">
                    <b className="text-slate-300">Auditor Asignado:</b> {expedienteSeleccionado.auditoria.responsable || 'Múltiples / No asignado'}<br/>
                    <b className="text-slate-300">Enfoque:</b> {expedienteSeleccionado.auditoria.enfoque || 'N/A'}
                  </p>
                </div>
              </div>

              {/* NODO 2: RIESGOS */}
              <div className="relative flex items-start group">
                <div className="absolute -left-[24px] sm:-left-[24px] w-12 h-12 bg-[#060b16] border-2 border-orange-500 rounded-full flex items-center justify-center text-xl shadow-[0_0_20px_rgba(249,115,22,0.5)] group-hover:scale-110 transition-transform">
                  🔥
                </div>
                <div className="ml-10 sm:ml-12 bg-slate-900/60 border border-slate-800 p-5 rounded-2xl w-full hover:border-orange-500/40 transition-colors shadow-lg">
                  <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-3 block border-b border-slate-800/80 pb-2">2. Riesgos Mapeados del Proceso</span>
                  <div className="flex items-center space-x-5">
                    <div className="text-4xl font-black text-white">{expedienteSeleccionado.riesgos.length}</div>
                    <div className="text-[11px] text-slate-400 font-medium">
                      Se documentaron en la matriz corporativa.<br/>
                      Existen <span className="text-red-400 font-black px-1.5 py-0.5 bg-red-500/10 rounded">{expedienteSeleccionado.riesgos.filter(r => (Number(r.probabilidadResidual || 1) * Number(r.impactoResidual || 1)) >= 16).length} Críticos</span> con alta exposición.
                    </div>
                  </div>
                </div>
              </div>

              {/* NODO 3: PRUEBAS */}
              <div className="relative flex items-start group">
                <div className="absolute -left-[24px] sm:-left-[24px] w-12 h-12 bg-[#060b16] border-2 border-cyan-500 rounded-full flex items-center justify-center text-xl shadow-[0_0_20px_rgba(6,182,212,0.5)] group-hover:scale-110 transition-transform">
                  🛡️
                </div>
                <div className="ml-10 sm:ml-12 bg-slate-900/60 border border-slate-800 p-5 rounded-2xl w-full hover:border-cyan-500/40 transition-colors shadow-lg">
                  <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-3 block border-b border-slate-800/80 pb-2">3. Evaluaciones y Pruebas de Control</span>
                  <div className="flex items-center space-x-5">
                    <div className="text-4xl font-black text-white">{expedienteSeleccionado.evaluaciones.length}</div>
                    <div className="text-[11px] text-slate-400 font-medium">
                      Pruebas de recorrido ejecutadas en campo.<br/>
                      <span className="text-emerald-400 font-black px-1.5 py-0.5 bg-emerald-500/10 rounded">{expedienteSeleccionado.evaluaciones.filter(e => Number(e.calificacion) === 100).length} Evaluados como Eficaces</span> (Diseño y Ejecución).
                    </div>
                  </div>
                </div>
              </div>

              {/* NODO 4: HALLAZGOS */}
              <div className="relative flex items-start group">
                <div className="absolute -left-[24px] sm:-left-[24px] w-12 h-12 bg-[#060b16] border-2 border-red-500 rounded-full flex items-center justify-center text-xl shadow-[0_0_20px_rgba(239,68,68,0.5)] group-hover:scale-110 transition-transform">
                  🔎
                </div>
                <div className="ml-10 sm:ml-12 bg-slate-900/60 border border-slate-800 p-5 rounded-2xl w-full hover:border-red-500/40 transition-colors shadow-lg">
                  <span className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-3 block border-b border-slate-800/80 pb-2">4. Hallazgos y Desviaciones Detectadas</span>
                 
                  {expedienteSeleccionado.hallazgos.length === 0 ? (
                     <div className="text-[11px] text-slate-500 italic py-2">✅ Proceso limpio. No hay hallazgos registrados o conectados.</div>
                  ) : (
                    <div className="space-y-2.5">
                      {expedienteSeleccionado.hallazgos.map((h, i) => (
                        <div 
                          key={i} 
                          onClick={() => {
                            if(setActiveTab) setActiveTab('resultados_tab'); 
                            if(setSubTabResultados) setSubTabResultados('hallazgos');
                            if(scrollToForm) scrollToForm();
                          }}
                          className="flex justify-between items-center bg-[#060b16] hover:bg-[#0c162b] p-3 rounded-xl border border-slate-800 hover:border-red-500/40 shadow-inner cursor-pointer transition-all group/item"
                          title="Clic para viajar y gestionar este Hallazgo"
                        >
                          <span className="text-[11px] text-slate-300 font-bold truncate pr-4 group-hover/item:text-white transition-colors">
                            <span className="text-slate-500">[{h.ref || `HAL-${i+1}`}]</span> {h.titulo || h.hallazgo || 'Sin título'}
                          </span>
                          <div className="flex items-center space-x-2 shrink-0">
                            <span className={`px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-widest border ${h.estado === 'Abierto' ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'}`}>{h.estado || 'Abierto'}</span>
                            <span className="text-[10px] opacity-0 group-hover/item:opacity-100 text-red-400 font-bold transition-all transform translate-x-1 group-hover/item:translate-x-0">⚙️</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* NODO 5: PLANES DE ACCIÓN */}
              <div className="relative flex items-start group">
                <div className="absolute -left-[24px] sm:-left-[24px] w-12 h-12 bg-[#060b16] border-2 border-amber-500 rounded-full flex items-center justify-center text-xl shadow-[0_0_20px_rgba(245,158,11,0.5)] group-hover:scale-110 transition-transform">
                  📝
                </div>
                <div className="ml-10 sm:ml-12 bg-slate-900/60 border border-slate-800 p-5 rounded-2xl w-full hover:border-amber-500/40 transition-colors shadow-lg">
                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-3 block border-b border-slate-800/80 pb-2">5. Gestión de Planes de Acción</span>
                 {expedienteSeleccionado.planes.length === 0 ? (
                     <div className="text-[11px] text-slate-500 italic py-2">⏳ Pendiente de apertura de planes de choque.</div>
                  ) : (
                    <div className="space-y-3">
                      {expedienteSeleccionado.planes.map((p, i) => (
                        <div 
                          key={i} 
                          onClick={() => {
                            if(setActiveTab) setActiveTab('planes_tab'); 
                            if(setSubTabPlanes) setSubTabPlanes('planes');
                            if(scrollToForm) scrollToForm();
                          }}
                          className="flex flex-col sm:flex-row justify-between sm:items-center bg-[#060b16] hover:bg-[#0c162b] p-3.5 rounded-xl border border-slate-800 hover:border-amber-500/40 shadow-inner gap-3 cursor-pointer transition-all group/plan"
                          title="Clic para viajar y gestionar este Plan de Acción"
                        >
                          <span className="text-[11px] text-slate-300 font-bold w-full sm:w-2/3 leading-relaxed group-hover/plan:text-white transition-colors">{p.accion || 'Plan de Acción sin descripción'}</span>
                          <div className="flex items-center justify-between sm:justify-end space-x-3 w-full sm:w-auto shrink-0">
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">{p.progreso || 0}% completado</span>
                            <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-amber-600 to-amber-400" style={{width: `${p.progreso || 0}%`}}></div></div>
                            <span className="text-xs opacity-0 group-hover/plan:opacity-100 text-amber-400 font-bold transition-all">🛠️</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* NODO 6: INFORME Y CIERRE */}
              <div className="relative flex items-start group">
                <div className="absolute -left-[24px] sm:-left-[24px] w-12 h-12 bg-[#060b16] border-2 border-emerald-500 rounded-full flex items-center justify-center text-xl shadow-[0_0_20px_rgba(16,185,129,0.5)] group-hover:scale-110 transition-transform">
                  ✅
                </div>
                <div className="ml-10 sm:ml-12 bg-emerald-900/10 border border-emerald-500/30 p-5 rounded-2xl w-full hover:border-emerald-500/50 transition-colors shadow-lg relative overflow-hidden">
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-3 block border-b border-emerald-500/20 pb-2 relative z-10">6. Dictamen y Cierre (Informes Radicados)</span>
                  
                  {expedienteSeleccionado.informes.length === 0 ? (
                     <div className="text-[11px] text-slate-400 font-medium py-2 relative z-10">No se ha emitido y radicado un informe final para esta auditoría en el repositorio central.</div>
                  ) : (
                    <div className="space-y-3 relative z-10">
                      {expedienteSeleccionado.informes.map((inf, i) => (
                        <div key={i} className="flex justify-between items-center bg-[#060b16] p-4 rounded-xl border border-emerald-500/30 shadow-md">
                          <div>
                            <div className="text-emerald-400 font-mono text-[11px] font-black tracking-widest">{inf.ref || `INF-${i+1}`}</div>
                            <div className="text-xs text-white font-black truncate mt-1">{inf.titulo || 'Informe Auditado'}</div>
                          </div>
                          {inf.evidenciaUrl ? (
                            <a href={inf.evidenciaUrl} target="_blank" rel="noreferrer" className="text-[10px] bg-emerald-500 text-white font-black px-4 py-2 rounded-lg uppercase tracking-widest shadow-[0_0_15px_rgba(16,185,129,0.4)] hover:bg-emerald-400 hover:scale-105 transition-all">Ver PDF / Acta</a>
                          ) : (
                            <span className="text-[10px] text-slate-500 italic font-bold">Sin PDF anexo</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
)}
  </>
) : (
  <div className="text-center py-20 text-slate-500 border border-dashed border-blue-500/30 rounded-2xl bg-[#060b16]/50 flex flex-col items-center justify-center transition-colors">
            <div className="w-16 h-16 bg-blue-500/10 text-blue-400 rounded-full flex items-center justify-center text-3xl mb-4 shadow-[0_0_20px_rgba(59,130,246,0.2)]">🧭</div>
            <p className="text-sm font-black uppercase tracking-widest text-slate-300">Selecciona un proceso del menú desplegable arriba</p>
            <p className="text-[11px] font-medium text-slate-500 mt-2 max-w-md leading-relaxed">El motor inteligente mapeará automáticamente toda la genealogía de la auditoría en un solo Timeline de Trazabilidad 360°.</p>
          </div>
        )}
      </div>

    </div>
  );
}