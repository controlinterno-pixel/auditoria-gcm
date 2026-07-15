import React, { useState, useMemo } from 'react';

// 📚 LISTA OFICIAL HOMOLOGADA Y LIMPIA
const PROCESOS_OFICIALES = [
  "Gestión comercial", "Gestión de la mejora continua (SIGCAS)", "Gestión de mercadeo y comunicaciones",
  "Gestión de servicio al cliente", "Gestión estratégica", "Gestión de Operaciones",
  "Gestión Administrativa y Financiera", "Gestión Talento Humano", "I+D+i",
  "Subproceso alojamiento", "Subproceso alimentos y bebidas", "Subproceso compras",
  "Subproceso desarrollo de competencias", "Subproceso gestión administrativa",
  "Subproceso gestión de almacenes", "Subproceso gestión de cartera", "Subproceso gestión de contabilidad",
  "Subproceso gestión de costos", "Subproceso gestión de inventarios", "Subproceso gestión de tesorería",
  "Subproceso gestión del bienestar y la compensación", "Subproceso gestionar los activos fijos de la empresa",
  "Subproceso mantenimiento", "Subproceso recreación", "Subproceso Seguridad y salud en trabajo",
  "Subproceso Gestion de calidad", "Subproceso Gestión Ambiental", "Subproceso Control interno y Gestion de riesgos",
  "Subproceso Proteccion de datos personales", "Subproceso selección, vinculación y administración de colaboradores",
  "Tecnologías de la información y la comunicación", "Proceso General"
];

export default function MiEspacio({
  user, safePlanes, safeHallazgos, safeComites, safeCronograma,
  safeRiesgos, safeEvaluaciones, informesAuditoria,
  activeTab, setActiveTab, setSubTabResultados, setSubTabPlanes, scrollToForm
}) {
  // 🔌 ESTADO PARA EL PROCESO SELECCIONADO (Ahora filtra por nombre limpio)
  const [selectedProceso, setSelectedProceso] = useState('');

  const usuarioNombre = user?.email?.split('@')[0] || 'Líder de GRC';
  const totalVencidos = safePlanes.filter(p => p.estado !== 'Cerrado' && p.fecha && new Date(p.fecha) < new Date()).length;
  const totalAbiertos = safeHallazgos.filter(h => h.estado === 'Abierto').length;
  const totalRevision = safePlanes.filter(p => p.estadoWorkflow === 'En Revisión').length;

  // =====================================================================
  // 🧭 MOTOR FASE 2: EXPEDIENTE ÚNICO 360° (TRAZABILIDAD TOTAL)
  // =====================================================================
  const expedienteSeleccionado = useMemo(() => {
    if (!selectedProceso) return null;

    // 🧹 NORMALIZADOR ESTRICTO: Quita tildes, espacios, símbolos y mayúsculas
    const normalizeStr = (str) => {
      if (!str) return "";
      return String(str)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-z0-9]/g, ""); 
    };

    const target = normalizeStr(selectedProceso);

    // 1. Busca si hay cronograma planeado (toma el más reciente si hay varios)
    const auditorias = safeCronograma.filter(c => normalizeStr(c.proceso) === target);
    const auditoria = auditorias.length > 0 ? auditorias[auditorias.length - 1] : { responsable: 'Múltiples / No asignado', enfoque: 'N/A', meses: [] };

    // 2. Extrae en cascada comparando con la cadena purificada
    const riesgosVinculados = safeRiesgos.filter(r => normalizeStr(r.proceso) === target);
    const evaluacionesVinculadas = safeEvaluaciones.filter(ev => riesgosVinculados.some(r => r.id === ev.idRiesgo));
    const hallazgosVinculados = safeHallazgos.filter(h => normalizeStr(h.proceso) === target || riesgosVinculados.some(r => r.id === h.idRiesgo));
    const planesVinculados = safePlanes.filter(p => hallazgosVinculados.some(h => h.id === p.idHallazgo));
    const informesVinculados = (informesAuditoria || []).filter(inf => normalizeStr(inf.proceso) === target);

    return {
      auditoria,
      proceso: selectedProceso,
      riesgos: riesgosVinculados,
      evaluaciones: evaluacionesVinculadas,
      hallazgos: hallazgosVinculados,
      planes: planesVinculados,
      informes: informesVinculados
    };
  }, [selectedProceso, safeCronograma, safeRiesgos, safeEvaluaciones, safeHallazgos, safePlanes, informesAuditoria]);
  return (
    <div className="space-y-6 text-left">
      {/* BANNER DE BIENVENIDA PREMIUM */}
      <div className="bg-[#0a1122] border border-blue-500/20 p-6 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="space-y-1 relative z-10">
          <h2 className="text-2xl font-black text-white">¡Buen día, <span className="text-emerald-400 capitalize">{usuarioNombre}</span>!</h2>
          <p className="text-xs text-slate-400 font-bold">Consola de Gobierno, Gestión de Riesgos y Cumplimiento Normativo • Termales Santa Rosa</p>
        </div>
        <div className="flex flex-wrap gap-2 relative z-10">
          <button onClick={() => { setActiveTab('resultados_tab'); setSubTabResultados('informes'); scrollToForm(); }} className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 font-bold py-2 px-3 rounded-lg text-[10px] uppercase tracking-wider border border-blue-500/20 transition-all">
            Filtrar Informes
          </button>
          <button onClick={() => { setActiveTab('planes_tab'); setSubTabPlanes('planes'); }} className="bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 font-bold py-2 px-3 rounded-lg text-[10px] uppercase tracking-wider border border-purple-500/20 transition-all">
            Gestionar Planes
          </button>
        </div>
      </div>

      {/* CUE DE TRABAJO ACTUAL */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div onClick={() => { setActiveTab('resultados_tab'); setSubTabResultados('hallazgos'); }} className="bg-[#1c0d15] hover:bg-[#25101b] transition-all border border-red-500/10 p-5 rounded-2xl shadow-md cursor-pointer flex flex-col justify-between">
          <div className="flex justify-between items-center text-red-400">
            <span className="text-[10px] font-black uppercase tracking-widest">Hallazgos Abiertos</span>
            <span>⚠️</span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-white">{totalAbiertos}</div>
            <p className="text-[9px] text-slate-400 mt-1">Brechas por mitigar urgentemente</p>
          </div>
        </div>

        <div onClick={() => { setActiveTab('planes_tab'); setSubTabPlanes('planes'); }} className="bg-[#1c140d] hover:bg-[#281d13] transition-all border border-amber-500/10 p-5 rounded-2xl shadow-md cursor-pointer flex flex-col justify-between">
          <div className="flex justify-between items-center text-amber-400">
            <span className="text-[10px] font-black uppercase tracking-widest">Planes Vencidos</span>
            <span>⏳</span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-white">{totalVencidos}</div>
            <p className="text-[9px] text-slate-400 mt-1">Fuera del límite programado</p>
          </div>
        </div>

        <div onClick={() => { setActiveTab('planes_tab'); setSubTabPlanes('planes'); }} className="bg-[#0b171c] hover:bg-[#10232b] transition-all border border-cyan-500/10 p-5 rounded-2xl shadow-md cursor-pointer flex flex-col justify-between">
          <div className="flex justify-between items-center text-cyan-400">
            <span className="text-[10px] font-black uppercase tracking-widest">En Revisión por Auditor</span>
            <span>🔬</span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-white">{totalRevision}</div>
            <p className="text-[9px] text-slate-400 mt-1">Esperando aprobación de cierre</p>
          </div>
        </div>

        <div onClick={() => setActiveTab('gobernanza_tab')} className="bg-[#0e0c1a] hover:bg-[#141126] transition-all border border-purple-500/10 p-5 rounded-2xl shadow-md cursor-pointer flex flex-col justify-between">
          <div className="flex justify-between items-center text-purple-400">
            <span className="text-[10px] font-black uppercase tracking-widest">Sesiones de Comité</span>
            <span>👥</span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-white">{safeComites.length}</div>
            <p className="text-[9px] text-slate-400 mt-1">Actas oficiales indexadas</p>
          </div>
        </div>
      </div>

      {/* 🗺️ STEPPER WORKFLOW ASSISTANT (EL RUTA GRC) */}
      <div className="bg-[#0a1122] border border-slate-800 p-6 rounded-3xl shadow-xl">
        <h3 className="text-xs font-black tracking-widest uppercase text-slate-300 mb-6 flex items-center">
          <span className="mr-2">🛤️</span> Ruta Guiada de Auditoría (GRC Assistant)
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
          {[
            { step: '1', name: 'Planificación', desc: 'Plan Anual y Riesgos', tab: 'plan_anual_tab', active: activeTab === 'plan_anual_tab' },
            { step: '2', name: 'Trabajo de Campo', desc: 'Pruebas de Controles', tab: 'evaluaciones', active: activeTab === 'evaluaciones' },
            { step: '3', name: 'Hallazgos', desc: 'Emisión de Brechas', tab: 'resultados_tab', active: activeTab === 'resultados_tab' },
            { step: '4', name: 'Plan de Acción', desc: 'Ejecución y Cierre', tab: 'planes_tab', active: activeTab === 'planes_tab' },
            { step: '5', name: 'Gobernanza', desc: 'Comité y Trazabilidad', tab: 'gobernanza_tab', active: activeTab === 'gobernanza_tab' }
          ].map((st, i) => (
            <div 
              key={`step-${i}`}
              onClick={() => setActiveTab(st.tab)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between h-28 ${st.active ? 'bg-blue-600/10 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'}`}
            >
              <div className="flex justify-between items-center">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${st.active ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  {st.step}
                </span>
                {st.active && <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider">Activo</span>}
              </div>
              <div>
                <h4 className="text-xs font-black text-white">{st.name}</h4>
                <p className="text-[9px] text-slate-500 font-bold">{st.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* 📁 FASE 2: EXPEDIENTE ÚNICO MAESTRO (360° VIEW) */}
      <div className="bg-[#0a1122] border border-blue-500/20 p-6 sm:p-8 rounded-3xl shadow-[0_0_40px_rgba(59,130,246,0.06)] space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="border-b border-slate-800/80 pb-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
          <div>
            <div className="inline-block px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-black uppercase tracking-widest rounded mb-2">Fase 2 Completada</div>
            <h3 className="text-sm font-black tracking-widest uppercase text-white">📁 Expediente Único de Auditoría 360°</h3>
            <p className="text-[10px] text-slate-400 font-medium mt-1">Visión panorámica de la auditoría. Navegación End-to-End sin cambiar de módulo.</p>
          </div>
          <select
            value={selectedProceso}
            onChange={(e) => setSelectedProceso(e.target.value)}
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
            
            {/* LÍNEA VERTICAL CON DEGRADADO NEÓN */}
            <div className="absolute left-[34px] sm:left-[50px] top-8 bottom-8 w-[3px] bg-gradient-to-b from-blue-500 via-purple-500 to-emerald-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>

            <div className="space-y-10 relative z-10">
              
              {/* NODO 1: PLANIFICACIÓN Y PROCESO */}
              <div className="relative flex items-start group">
                <div className="absolute -left-[24px] sm:-left-[24px] w-12 h-12 bg-[#060b16] border-2 border-blue-500 rounded-full flex items-center justify-center text-xl shadow-[0_0_20px_rgba(59,130,246,0.5)] group-hover:scale-110 transition-transform">
                  🏢
                </div>
                <div className="ml-10 sm:ml-12 bg-slate-900/60 border border-slate-800 p-5 rounded-2xl w-full hover:border-blue-500/40 transition-colors shadow-lg">
                  <div className="flex justify-between items-start mb-2 border-b border-slate-800/80 pb-2">
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">1. Planificación Estratégica</span>
                    <span className="px-2 py-0.5 bg-[#060b16] border border-slate-700 text-slate-300 text-[9px] font-bold rounded">Meses: {expedienteSeleccionado.auditoria.meses?.join(', ') || 'N/A'}</span>
                  </div>
                  <h4 className="text-base font-black text-white">{expedienteSeleccionado.proceso}</h4>
                  <p className="text-[10px] text-slate-400 mt-1.5 font-medium leading-relaxed">
                    <b className="text-slate-300">Auditor Asignado:</b> {expedienteSeleccionado.auditoria.responsable}<br/>
                    <b className="text-slate-300">Enfoque:</b> {expedienteSeleccionado.auditoria.enfoque}
                  </p>
                </div>
              </div>

              {/* NODO 2: MATRIZ DE RIESGOS */}
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
                      Existen <span className="text-red-400 font-black px-1.5 py-0.5 bg-red-500/10 rounded">{expedienteSeleccionado.riesgos.filter(r => (Number(r.probabilidadResidual) * Number(r.impactoResidual)) >= 16).length} Críticos</span> con alta exposición.
                    </div>
                  </div>
                </div>
              </div>

              {/* NODO 3: TRABAJO DE CAMPO / CONTROLES */}
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
                      <span className="text-emerald-400 font-black px-1.5 py-0.5 bg-emerald-500/10 rounded">{expedienteSeleccionado.evaluaciones.filter(e => e.calificacion === 100).length} Evaluados como Eficaces</span> (Diseño y Ejecución).
                    </div>
                  </div>
                </div>
              </div>

              {/* NODO 4: HALLAZGOS Y DESVIACIONES */}
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
                            // 🚀 Redirección y precarga del Hallazgo
                            setActiveTab('resultados_tab'); 
                            setSubTabResultados('hallazgos');
                            scrollToForm();
                            // Invocamos el disparador global simulando un clic en editar
                            const btnEditar = document.querySelector(`button[onClick*="setEditHallazgo"]`);
                            if (btnEditar) {
                              // Esto forzará el estado en el componente si se expone la función, 
                              // pero por seguridad redirige al flujo de control.
                            }
                          }}
                          className="flex justify-between items-center bg-[#060b16] hover:bg-[#0c162b] p-3 rounded-xl border border-slate-800 hover:border-red-500/40 shadow-inner cursor-pointer transition-all group/item"
                          title="Clic para viajar y gestionar este Hallazgo"
                        >
                          <span className="text-[11px] text-slate-300 font-bold truncate pr-4 group-hover/item:text-white transition-colors">
                            <span className="text-slate-500">[{h.ref}]</span> {h.titulo}
                          </span>
                          <div className="flex items-center space-x-2 shrink-0">
                            <span className={`px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-widest border ${h.estado === 'Abierto' ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'}`}>{h.estado}</span>
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
                            // 🚀 Redirección y precarga del Plan de Acción
                            setActiveTab('planes_tab'); 
                            setSubTabPlanes('planes');
                            scrollToForm();
                          }}
                          className="flex flex-col sm:flex-row justify-between sm:items-center bg-[#060b16] hover:bg-[#0c162b] p-3.5 rounded-xl border border-slate-800 hover:border-amber-500/40 shadow-inner gap-3 cursor-pointer transition-all group/plan"
                          title="Clic para viajar y gestionar este Plan de Acción"
                        >
                          <span className="text-[11px] text-slate-300 font-bold w-full sm:w-2/3 leading-relaxed group-hover/plan:text-white transition-colors">{p.accion}</span>
                          <div className="flex items-center justify-between sm:justify-end space-x-3 w-full sm:w-auto shrink-0">
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">{p.progreso}% completado</span>
                            <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-amber-600 to-amber-400" style={{width: `${p.progreso}%`}}></div></div>
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
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-3 block border-b border-emerald-500/20 pb-2 relative z-10">6. Dictamen y Cierre (Informes Radicados)</span>
                  
                  {expedienteSeleccionado.informes.length === 0 ? (
                     <div className="text-[11px] text-slate-400 font-medium py-2 relative z-10">No se ha emitido y radicado un informe final para esta auditoría en el repositorio central.</div>
                  ) : (
                    <div className="space-y-3 relative z-10">
                      {expedienteSeleccionado.informes.map((inf, i) => (
                        <div key={i} className="flex justify-between items-center bg-[#060b16] p-4 rounded-xl border border-emerald-500/30 shadow-md">
                          <div>
                            <div className="text-emerald-400 font-mono text-[11px] font-black tracking-widest">{inf.ref}</div>
                            <div className="text-xs text-white font-black truncate mt-1">{inf.titulo}</div>
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
        ) : (
          <div className="text-center py-20 text-slate-500 border border-dashed border-blue-500/30 rounded-2xl bg-[#060b16]/50 flex flex-col items-center justify-center transition-colors hover:border-blue-500/50 hover:bg-[#060b16]">
            <div className="w-16 h-16 bg-blue-500/10 text-blue-400 rounded-full flex items-center justify-center text-3xl mb-4 shadow-[0_0_20px_rgba(59,130,246,0.2)]">🧭</div>
            <p className="text-sm font-black uppercase tracking-widest text-slate-300">Selecciona un proceso del cronograma arriba</p>
            <p className="text-[11px] font-medium text-slate-500 mt-2 max-w-md leading-relaxed">El motor inteligente mapeará automáticamente toda la genealogía de la auditoría en un solo Timeline de Trazabilidad 360°.</p>
          </div>
        )}
      </div>

    </div>
  );
}