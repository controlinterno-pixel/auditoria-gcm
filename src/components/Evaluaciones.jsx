import React, { useState, useEffect } from 'react';
import { MAPA_PROCESOS } from '../constants/diccionariosGRC';

// 🧮 CALCULADORA METODOLÓGICA DE EFICACIA DEL CONTROL (TABLA 6 MANUAL GRC)
const calcularEficaciaControl = (c) => {
  if (!c) return 75;
  let score = 0;
  const tipo = c.tipo || '';
  if (tipo.includes('Detectivo')) score += 15;
  else if (tipo.includes('Correctivo')) score += 10;
  else score += 25;

  const ejecucion = c.implementacion || c.ejecucion || '';
  if (ejecucion.includes('Automático')) score += 25;
  else score += 15;

  const doc = c.documentacion || '';
  if (doc.includes('Documentado') && !doc.includes('No documentado')) score += 15;

  const freq = c.frecuencia || '';
  if (freq.includes('Aleatoria') || freq.includes('Periódica')) score += 5;
  else score += 10;

  const evi = c.evidencia || '';
  if ((evi.includes('Con') && !evi.includes('Sin')) || evi.includes('Trazable')) score += 10;

  return Math.min(score, 100);
};

export default function Evaluaciones({
  isAdmin = false,
  editEvaluacion,
  setEditEvaluacion,
  handleEvaluacionSubmit,
  safeRiesgos = [],
  user,
  analizarEvidenciaIA,
  safeEvaluaciones = [],
  formatSafeDate,
  searchTerm,
  setSearchTerm,
  columnFilters,
  handleColFilterChange,
  FilterInput,
  applyFilters,
  setFormResetKey,
  scrollToForm,
  handleDeleteItem
}) {
  // 🌟 ESTADOS DE SELECCIÓN EN CASCADA
  const listadoMacros = Object.keys(MAPA_PROCESOS);
  const [procesoSel, setProcesoSel] = useState('');
  const [subprocesoSel, setSubprocesoSel] = useState('');
  const [riesgoIdSel, setRiesgoIdSel] = useState('');
  const [controlSel, setControlSel] = useState('');

  // 🧪 ESTADOS DEL MOTOR COSO
  const [diseno, setDiseno] = useState('Eficaz');
  const [ejecucion, setEjecucion] = useState('Eficaz');
  const [evidenciaUrl, setEvidenciaUrl] = useState('');
  const [comentarios, setComentarios] = useState('');

  // 🔄 Cargar datos si se entra en modo Edición
  useEffect(() => {
    if (editEvaluacion) {
      const riesgoPadre = safeRiesgos.find(r => String(r.id) === String(editEvaluacion.idRiesgo));
      if (riesgoPadre) {
        setProcesoSel(riesgoPadre.proceso || riesgoPadre.macroproceso || '');
        setSubprocesoSel(riesgoPadre.subproceso || 'General');
        setRiesgoIdSel(String(riesgoPadre.id));
      } else {
        setProcesoSel(editEvaluacion.proceso || '');
      }
      setControlSel(editEvaluacion.control || '');
      setDiseno(editEvaluacion.diseno || 'Eficaz');
      setEjecucion(editEvaluacion.ejecucion || 'Eficaz');
      setEvidenciaUrl(editEvaluacion.evidenciaUrl || '');
      setComentarios(editEvaluacion.comentarios || '');
    }
  }, [editEvaluacion, safeRiesgos]);

  // Manejar cambio de Macroproceso (Mejorado con auto-selección)
  const handleProcesoChange = (e) => {
    const nuevoProc = e.target.value;
    setProcesoSel(nuevoProc);
    
    // Auto-seleccionar subproceso si solo hay uno (ej. "General")
    const subs = MAPA_PROCESOS[nuevoProc] || [];
    if (subs.length === 1) {
      setSubprocesoSel(subs[0]);
    } else {
      setSubprocesoSel('');
    }
    
    setRiesgoIdSel('');
    setControlSel('');
  };

  // Subprocesos disponibles según el proceso activo
  const subprocesosDisponibles = MAPA_PROCESOS[procesoSel] || [];
  const tieneSubprocesosReales = subprocesosDisponibles.length > 1 || (subprocesosDisponibles.length === 1 && subprocesosDisponibles[0] !== "General");

  // Filtrado dinámico de riesgos según proceso y subproceso seleccionado
  const riesgosFiltradosEnCascada = safeRiesgos.filter(r => {
    const matchProc = !procesoSel || r.proceso === procesoSel || r.macroproceso === procesoSel;
    const matchSub = !subprocesoSel || r.subproceso === subprocesoSel || (!r.subproceso && subprocesoSel === 'General');
    return matchProc && matchSub;
  });

  // Objeto de riesgo actualmente seleccionado
  const riesgoObjetoSel = safeRiesgos.find(r => String(r.id) === String(riesgoIdSel));

  // Lista de controles desglosados del riesgo seleccionado
  const controlesDisponibles = riesgoObjetoSel
    ? (Array.isArray(riesgoObjetoSel.controlesDetallados) && riesgoObjetoSel.controlesDetallados.length > 0
        ? riesgoObjetoSel.controlesDetallados
        : [{ id: 'C1', descripcion: riesgoObjetoSel.descripcionControl || 'Control Principal', tipo: 'Preventivo' }])
    : [];

  // 🧮 CÁLCULO COSO AUTOMÁTICO DE EFICACIA (0%, 50%, 100%)
  const calcularScoreCOSO = () => {
    if (diseno === 'Inadecuado') return 0;
    if (ejecucion === 'Inadecuado') return 50;
    return 100;
  };
  const calificacionFinal = calcularScoreCOSO();

  // 🚀 SUBMIT INTERCEPTOR CON MANTENIMIENTO DE CONTEXTO ("FAST-FLOW")
  const onSubmitLocal = async (e) => {
    e.preventDefault();

    // Invoca la función global de guardado en Firebase / App.jsx
    await handleEvaluacionSubmit(e);

    // ⚡ LIMPIEZA PARCIAL: Mantenemos Proceso, Subproceso y Riesgo para continuar con el siguiente control
    if (!editEvaluacion) {
      setControlSel('');
      setEvidenciaUrl('');
      setComentarios('');
      setDiseno('Eficaz');
      setEjecucion('Eficaz');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* ========================================================================= */}
      {/* 📝 1. FORMULARIO DE TRABAJO DE CAMPO (OPTIMIZADO CON FAST-FLOW)           */}
      {/* ========================================================================= */}
      <div id="edit-form" className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
        
        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <span className="p-2.5 bg-emerald-50 text-emerald-800 rounded-2xl text-lg font-black border border-emerald-200">
              🔬
            </span>
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                {editEvaluacion ? 'Editar Evaluación de Control' : 'Nuevo Test de Control'}
              </h3>
              <p className="text-[11px] text-slate-500 font-bold">
                Auditoría en sitio y verificación de efectividad operativa (COSO ERM)
              </p>
            </div>
          </div>

          {editEvaluacion && (
            <button
              onClick={() => { setEditEvaluacion(null); setRiesgoIdSel(''); setControlSel(''); }}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl font-bold transition-all"
            >
              ✕ Cancelar Edición
            </button>
          )}
        </div>

        <form onSubmit={onSubmitLocal} className="space-y-6">
          
          {/* CAMPOS OCULTOS PARA INTERCEPTOR DE APP.JSX */}
          <input type="hidden" name="idRiesgo" value={riesgoIdSel} />
          <input type="hidden" name="noControl" value={controlSel} />
          <input type="hidden" name="calificacion" value={calificacionFinal} />
          <input type="hidden" name="evidenciaUrlInput" value={evidenciaUrl} />

          {/* 🏢 FILTROS EN CASCADA: PROCESO -> SUBPROCESO -> RIESGO -> CONTROL */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            
            {/* 1. MACROPROCESO */}
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">
                🏢 Proceso
              </label>
              <select
                name="proceso"
                value={procesoSel}
                onChange={handleProcesoChange}
                required
                className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-[#0A3B32] shadow-sm"
              >
                <option value="">-- Seleccione Proceso --</option>
                {listadoMacros.map(macro => (
                  <option key={macro} value={macro}>{macro}</option>
                ))}
              </select>
            </div>

            {/* 2. SUBPROCESO */}
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">
                📂 Subproceso
              </label>
              <select
                name="subproceso"
                value={subprocesoSel}
                onChange={(e) => { setSubprocesoSel(e.target.value); setRiesgoIdSel(''); setControlSel(''); }}
                disabled={!tieneSubprocesosReales || !procesoSel}
                className={`w-full text-xs p-2.5 border rounded-xl font-semibold shadow-sm transition-all ${
                  (!tieneSubprocesosReales || !procesoSel)
                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-white border-slate-300 text-slate-800 focus:ring-2 focus:ring-[#0A3B32]'
                }`}
              >
                {!procesoSel && <option value="">Esperando selección...</option>}
                {procesoSel && subprocesosDisponibles.map(sub => (
                  <option key={sub} value={sub}>
                    {!tieneSubprocesosReales && sub === "General" ? "No aplica subdivisión" : sub}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. RIESGO A EVALUAR */}
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">
                🎯 Riesgo a Evaluar
              </label>
              <select
                value={riesgoIdSel}
                onChange={(e) => { setRiesgoIdSel(e.target.value); setControlSel(''); }}
                required
                disabled={!procesoSel}
                className={`w-full text-xs p-2.5 border rounded-xl font-semibold shadow-sm transition-all ${
                  !procesoSel
                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-white border-slate-300 text-slate-800 focus:ring-2 focus:ring-[#0A3B32]'
                }`}
              >
                <option value="">-- Seleccione un Riesgo --</option>
                {riesgosFiltradosEnCascada.map(r => (
                  <option key={r.id} value={r.id}>
                    RSK-{r.id}: {r.descripcion ? r.descripcion.substring(0, 50) + '...' : 'Sin descripción'}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. CONTROL VINCULADO (SELECCIÓN INDIVIDUAL ITERATIVA) */}
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">
                🛡️ Control Vinculado
              </label>
              <select
                value={controlSel}
                onChange={(e) => setControlSel(e.target.value)}
                required
                disabled={!riesgoIdSel}
                className={`w-full text-xs p-2.5 border rounded-xl font-bold shadow-sm transition-all ${
                  !riesgoIdSel
                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-emerald-50/50 border-emerald-300 text-emerald-950 focus:ring-2 focus:ring-[#0A3B32]'
                }`}
              >
                <option value="">-- Seleccione un Control --</option>
                {controlesDisponibles.map((c, idx) => {
                  const nombreCtrl = `CTL-${riesgoIdSel}-${idx + 1}`;
                  const efic = calcularEficaciaControl(c);
                  return (
                    <option key={idx} value={nombreCtrl}>
                      {nombreCtrl} — {c.tipo || 'Preventivo'} ({efic}%) : {c.descripcion ? c.descripcion.substring(0, 40) + '...' : 'Control de matriz'}
                    </option>
                  );
                })}
              </select>
            </div>

          </div>

          {/* 🧮 CÁLCULO COSO Y EVALUACIÓN DE EFICACIA */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center bg-white p-4 rounded-2xl border border-slate-200">
            
            <div className="md:col-span-4 space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
                Adecuación del Diseño
              </label>
              <select
                name="diseno"
                value={diseno}
                onChange={(e) => setDiseno(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl font-bold bg-white focus:ring-2 focus:ring-[#0A3B32]"
              >
                <option value="Eficaz">Eficaz (Bien Diseñado)</option>
                <option value="Inadecuado">Inadecuado (Deficiencia en Diseño)</option>
              </select>
            </div>

            <div className="md:col-span-4 space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
                Eficacia Operativa (Ejecución)
              </label>
              <select
                name="ejecucion"
                value={ejecucion}
                onChange={(e) => setEjecucion(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl font-bold bg-white focus:ring-2 focus:ring-[#0A3B32]"
              >
                <option value="Eficaz">Eficaz (Cumple Operativamente)</option>
                <option value="Inadecuado">Inadecuado (No se cumple en la práctica)</option>
              </select>
            </div>

            {/* GAUGE RESULTADO DE EFICACIA */}
            <div className="md:col-span-4 flex items-center justify-center">
              <div className={`w-full p-3 rounded-2xl border text-center transition-all ${
                calificacionFinal === 100 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                calificacionFinal === 50 ? 'bg-amber-50 border-amber-200 text-amber-800' :
                'bg-red-50 border-red-200 text-red-800'
              }`}>
                <span className="text-[9px] font-black uppercase tracking-widest block">Score de Eficacia COSO</span>
                <span className="text-2xl font-black font-mono">{calificacionFinal}%</span>
                <span className="text-[9px] font-bold block mt-0.5">
                  {calificacionFinal === 100 ? '✅ CONTROL EFICAZ' : calificacionFinal === 50 ? '⚠️ DEFICIENCIA OPERATIVA' : '❌ CONTROL FALLIDO'}
                </span>
              </div>
            </div>

          </div>

          {/* 📂 BÓVEDA DE EVIDENCIA DE AUDITORÍA (PDF / FOTOS) */}
          <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                📎 Evidencia Soporte de Auditoría (PDF, JPG, PNG)
              </label>
              {evidenciaUrl && (
                <button
                  type="button"
                  onClick={() => analizarEvidenciaIA(evidenciaUrl, `Control ${controlSel}`, 'Test de Control')}
                  className="text-[10px] bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-2 py-1 rounded-lg font-extrabold flex items-center gap-1 transition-all"
                >
                  ✨ Validar Evidencia con IA
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={evidenciaUrl}
                onChange={(e) => setEvidenciaUrl(e.target.value)}
                placeholder="Pegue la URL del soporte guardado en la nube o seleccione archivo..."
                className="flex-1 text-xs p-2.5 border border-slate-300 rounded-xl bg-white font-medium"
              />
              <input
                type="file"
                id="fileEvidenciaTest"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) setEvidenciaUrl(`https://storage.termales.com/evidencias/${file.name}`);
                }}
              />
              <label
                htmlFor="fileEvidenciaTest"
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition-colors flex items-center shadow-sm"
              >
                📁 Adjuntar
              </label>
            </div>
          </div>

          {/* 💬 COMENTARIOS Y NOTAS DEL AUDITOR */}
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
              💬 Observaciones Tácticas del Auditor
            </label>
            <textarea
              name="comentarios"
              rows="2"
              value={comentarios}
              onChange={(e) => setComentarios(e.target.value)}
              placeholder="Describa el hallazgo o la muestra física inspeccionada durante la prueba..."
              className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-white font-medium focus:ring-2 focus:ring-[#0A3B32]"
            ></textarea>
          </div>

          {/* BOTÓN DE ACCIÓN */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={!riesgoIdSel || !controlSel}
              className="bg-[#0A3B32] hover:bg-[#062620] text-white px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <span>💾</span>
              <span>{editEvaluacion ? 'Actualizar Test' : 'Guardar y Evaluar Siguiente Control'}</span>
            </button>
          </div>

        </form>
      </div>

      {/* ========================================================================= */}
      {/* 📋 2. TABLA DE HISTORIAL DE TEST DE CONTROLES                             */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
          <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
            <span>📋 HISTORIAL DE PRUEBAS DE CAMPO REGISTRADAS</span>
            <span className="text-[10px] bg-slate-800 text-emerald-400 font-mono px-2 py-0.5 rounded-full border border-slate-700">
              {safeEvaluaciones.length} Pruebas
            </span>
          </h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-600 font-black uppercase text-[9px] tracking-wider border-b border-slate-200">
                <th className="p-3">Fecha / ID</th>
                <th className="p-3">Proceso</th>
                <th className="p-3">Control Evaluado</th>
                <th className="p-3 text-center">Diseño</th>
                <th className="p-3 text-center">Ejecución</th>
                <th className="p-3 text-center">Score COSO</th>
                <th className="p-3 text-center">Soporte</th>
                <th className="p-3 text-right">Gestión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {safeEvaluaciones.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-slate-400 italic">
                    No hay evaluaciones de control registradas en el periodo actual.
                  </td>
                </tr>
              ) : (
                safeEvaluaciones.map((ev, idx) => (
                  <tr key={ev.id || idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3">
                      <span className="font-mono font-bold text-slate-900 block">
                        {ev.fecha ? (typeof formatSafeDate === 'function' ? formatSafeDate(ev.fecha) : ev.fecha) : 'Reciente'}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">ID: {ev.id}</span>
                    </td>
                    <td className="p-3 font-semibold text-slate-800">{ev.proceso}</td>
                    <td className="p-3 font-bold text-[#0A3B32]">{ev.control}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                        ev.diseno === 'Eficaz' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {ev.diseno || 'Eficaz'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                        ev.ejecucion === 'Eficaz' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {ev.ejecucion || 'Eficaz'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`font-mono font-black px-2 py-0.5 rounded border text-[10px] ${
                        ev.calificacion === 100 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                        ev.calificacion === 50 ? 'bg-amber-50 text-amber-800 border-amber-200' :
                        'bg-red-50 text-red-800 border-red-200'
                      }`}>
                        {ev.calificacion}%
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {ev.evidenciaUrl ? (
                        <a
                          href={ev.evidenciaUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 hover:underline font-bold text-[10px]"
                        >
                          📎 Ver Soporte
                        </a>
                      ) : (
                        <span className="text-slate-400 italic text-[10px]">Sin soporte</span>
                      )}
                    </td>
                    <td className="p-3 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => { setEditEvaluacion(ev); if(typeof scrollToForm === 'function') scrollToForm(); }}
                        className="px-2 py-1 bg-amber-50 text-amber-800 hover:bg-amber-100 rounded font-bold text-[9px]"
                      >
                        ✏️ Editar
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => { if(typeof handleDeleteItem === 'function') handleDeleteItem('evaluaciones', ev.id); }}
                          className="px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded font-bold text-[9px]"
                        >
                          🗑️
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}