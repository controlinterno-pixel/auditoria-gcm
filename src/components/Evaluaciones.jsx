import React, { useState, useEffect } from 'react';

// 🗺️ DICCIONARIO INTEGRADO DIRECTAMENTE AQUÍ PARA EVITAR ERRORES
const MAPA_PROCESOS = {
  "Gestión de la mejora continua (SIGCAS)": ["Auditorías", "Acciones Correctivas", "Revisión por la Dirección"],
  "Gestión de TIC": ["Soporte Técnico", "Seguridad de la Información", "Desarrollo de Software"],
  "Gestión Financiera": ["Contabilidad", "Tesorería", "Presupuesto"],
  "Gestión de Talento Humano": ["Nómina", "Selección y Contratación", "SST"],
  "Gestión Comercial y Ventas": ["Atención al Cliente", "Reservas", "Marketing"],
  "Operación Termal y SPA": ["Mantenimiento de Piscinas", "Masajes", "Restaurante"],
  "Cadena de Suministro": ["Compras", "Almacén e Inventarios", "Proveedores"]
};

// 🧮 CALCULADORA METODOLÓGICA DE EFICACIA DEL CONTROL
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
  handleDeleteItem,
  scrollToForm
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

  // Manejar cambio de Macroproceso
  const handleProcesoChange = (e) => {
    const nuevoProc = e.target.value;
    setProcesoSel(nuevoProc);
    setSubprocesoSel('');
    setRiesgoIdSel('');
    setControlSel('');
  };

  // Subprocesos disponibles según el proceso activo
  const subprocesosDisponibles = MAPA_PROCESOS[procesoSel] || [];

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

  // 🧮 CÁLCULO COSO AUTOMÁTICO DE EFICACIA
  const calcularScoreCOSO = () => {
    if (diseno === 'Inadecuado') return 0;
    if (ejecucion === 'Inadecuado') return 50;
    return 100;
  };
  const calificacionFinal = calcularScoreCOSO();

  // 🚀 SUBMIT INTERCEPTOR CON MANTENIMIENTO DE CONTEXTO ("FAST-FLOW")
  const onSubmitLocal = async (e) => {
    e.preventDefault();
    await handleEvaluacionSubmit(e);

    // ⚡ LIMPIEZA PARCIAL: Mantenemos Proceso, Subproceso y Riesgo para el siguiente control
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
      <div id="edit-form" className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
        
        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <span className="p-2.5 bg-emerald-50 text-emerald-800 rounded-2xl text-lg font-black border border-emerald-200">🔬</span>
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                {editEvaluacion ? 'Editar Evaluación de Control' : 'Nuevo Test de Control'}
              </h3>
              <p className="text-[11px] text-slate-500 font-bold">Flujo rápido: Evalúa múltiples controles sin reiniciar</p>
            </div>
          </div>
        </div>

        <form onSubmit={onSubmitLocal} className="space-y-6">
          <input type="hidden" name="idRiesgo" value={riesgoIdSel} />
          <input type="hidden" name="noControl" value={controlSel} />
          <input type="hidden" name="calificacion" value={calificacionFinal} />
          <input type="hidden" name="evidenciaUrlInput" value={evidenciaUrl} />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">🏢 Proceso</label>
              <select name="proceso" value={procesoSel} onChange={handleProcesoChange} required className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-800">
                <option value="">-- Seleccione Proceso --</option>
                {listadoMacros.map(macro => <option key={macro} value={macro}>{macro}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">📂 Subproceso</label>
              <select value={subprocesoSel} onChange={(e) => { setSubprocesoSel(e.target.value); setRiesgoIdSel(''); setControlSel(''); }} disabled={!procesoSel} className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 disabled:bg-slate-100">
                <option value="">-- Todos los subprocesos --</option>
                {subprocesosDisponibles.map(sub => <option key={sub} value={sub}>{sub}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">🎯 Riesgo a Evaluar</label>
              <select value={riesgoIdSel} onChange={(e) => { setRiesgoIdSel(e.target.value); setControlSel(''); }} required disabled={!procesoSel} className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 disabled:bg-slate-100">
                <option value="">-- Seleccione un Riesgo --</option>
                {riesgosFiltradosEnCascada.map(r => <option key={r.id} value={r.id}>RSK-{r.id}: {r.descripcion ? r.descripcion.substring(0, 30) + '...' : ''}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">🛡️ Control Vinculado</label>
              <select value={controlSel} onChange={(e) => setControlSel(e.target.value)} required disabled={!riesgoIdSel} className="w-full text-xs p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl font-bold text-emerald-950 disabled:bg-slate-100 disabled:border-slate-300">
                <option value="">-- Seleccione un Control --</option>
                {controlesDisponibles.map((c, idx) => (
                  <option key={idx} value={`CTL-${riesgoIdSel}-${idx + 1}`}>
                    CTL-{riesgoIdSel}-{idx + 1} — {c.tipo || 'Preventivo'} ({calcularEficaciaControl(c)}%)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center bg-white p-4 rounded-2xl border border-slate-200">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">Adecuación del Diseño</label>
              <select name="diseno" value={diseno} onChange={(e) => setDiseno(e.target.value)} className="w-full text-xs p-2.5 border border-slate-300 rounded-xl font-bold">
                <option value="Eficaz">Eficaz (Bien Diseñado)</option>
                <option value="Inadecuado">Inadecuado (Deficiencia)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">Eficacia Operativa</label>
              <select name="ejecucion" value={ejecucion} onChange={(e) => setEjecucion(e.target.value)} className="w-full text-xs p-2.5 border border-slate-300 rounded-xl font-bold">
                <option value="Eficaz">Eficaz (Cumple)</option>
                <option value="Inadecuado">Inadecuado (No cumple)</option>
              </select>
            </div>
            <div className="flex justify-center">
              <div className="text-center p-2">
                <span className="text-[9px] font-black uppercase tracking-widest block text-slate-500">Score COSO</span>
                <span className={`text-2xl font-black ${calificacionFinal === 100 ? 'text-emerald-600' : 'text-red-600'}`}>{calificacionFinal}%</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-2">📎 Evidencia Soporte de Auditoría</label>
            <div className="flex gap-2">
              <input type="text" value={evidenciaUrl} onChange={(e) => setEvidenciaUrl(e.target.value)} placeholder="URL del archivo..." className="flex-1 text-xs p-2.5 border border-slate-300 rounded-xl font-medium" />
              <input type="file" id="fileEvidenciaTest" className="hidden" onChange={(e) => e.target.files[0] && setEvidenciaUrl(`https://storage.termales.com/${e.target.files[0].name}`)} />
              <label htmlFor="fileEvidenciaTest" className="px-4 py-2.5 bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer">📁 Adjuntar</label>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">💬 Observaciones</label>
            <textarea name="comentarios" rows="2" value={comentarios} onChange={(e) => setComentarios(e.target.value)} className="w-full text-xs p-2.5 border border-slate-300 rounded-xl font-medium"></textarea>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={!riesgoIdSel || !controlSel} className="bg-[#0A3B32] text-white px-8 py-3 rounded-2xl text-xs font-black uppercase disabled:opacity-40">
              💾 {editEvaluacion ? 'Actualizar' : 'Guardar y Evaluar Siguiente Control'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
          <h4 className="text-xs font-black uppercase">📋 HISTORIAL DE PRUEBAS ({safeEvaluaciones.length})</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-600 font-black uppercase text-[9px]">
                <th className="p-3">Control</th>
                <th className="p-3 text-center">Score</th>
                <th className="p-3 text-center">Soporte</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {safeEvaluaciones.map((ev, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-[#0A3B32]">{ev.control}</td>
                  <td className="p-3 text-center font-bold">{ev.calificacion}%</td>
                  <td className="p-3 text-center">{ev.evidenciaUrl ? '📎 Sí' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}