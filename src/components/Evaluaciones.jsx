import React, { useState, useEffect } from 'react';
import { MAPA_PROCESOS } from '../constants/diccionariosGRC';

// ☁️ IMPORTAR HOOK Y SERVICIO DE API
import { useDataFetching } from '../hooks/useDataFetching';
import { apiService } from '../services/apiService';

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
  informesAuditoria = [],
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
  const [informeSel, setInformeSel] = useState('');

  // 🧪 ESTADOS DEL MOTOR COSO
  const [diseno, setDiseno] = useState('Eficaz');
  const [ejecucion, setEjecucion] = useState('Eficaz');
  const [evidenciaUrl, setEvidenciaUrl] = useState('');
  const [comentarios, setComentarios] = useState('');
// ☁️ ESTADOS Y HOOK PARA LA BÓVEDA DE TERMALES
  const [evidenciaUrlForm, setEvidenciaUrlForm] = useState('');
  const { isLoading: isUploading, error: uploadError, ejecutarPeticion: ejecutarSubidaEvidencia } = useDataFetching();

  // Sincronizar URL si se entra en modo edición
  useEffect(() => {
    if (editEvaluacion) {
      setEvidenciaUrlForm(editEvaluacion.evidenciaUrl || '');
    } else {
      setEvidenciaUrlForm('');
    }
  }, [editEvaluacion]);

 // 🧹 Utilidad para limpiar nombres de archivos (elimina tildes y espacios)
  const sanitizarNombreArchivo = (nombreOriginal) => {
    return nombreOriginal
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9.\-_]/g, "")
      .toLowerCase();
  };

  // Manejador de subida directa a repos.termalessantarosa.com.co
  const handleFileUploadEvaluacion = async (e) => {
    const originalFile = e.target.files[0];
    if (!originalFile) return;

    // 🌟 Limpiar el nombre y crear el nuevo archivo sin tildes ni espacios
    const nombreLimpio = sanitizarNombreArchivo(originalFile.name);
    const file = new File([originalFile], nombreLimpio, {
      type: originalFile.type,
      lastModified: originalFile.lastModified,
    });

    try {
      const payloadMeta = {
        appName: 'controlInterno',
        description: 'Soporte de auditoría en campo - Evaluación COSO',
        fieldName: 'file'
      };

      const data = await ejecutarSubidaEvidencia(
        apiService.subirEvidencia(file, payloadMeta)
      );
      
      const urlFinal = `https://repos.termalessantarosa.com.co/api/archivos/auditoria/${data.appName}/${data.fileName}`;
      setEvidenciaUrlForm(urlFinal);
      setEvidenciaUrl(urlFinal);
    } catch (err) {
      alert(`⚠️ No se pudo subir el soporte:\n${err.message}`);
    }
  };
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

 // Lista de controles desglosados del riesgo seleccionado (incluye soporte para emergentes)
const controlesDisponibles = riesgoIdSel === 'EMERGENTE'
  ? [{ id: 'C-EMERG', descripcion: 'Prueba sobre Riesgo / Control Emergente en Sitio', tipo: 'Detectivo' }]
  : riesgoObjetoSel
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

    // 🌟 NUEVO: Si es Riesgo Emergente, auto-generamos el Hallazgo en memoria
    if (riesgoIdSel === 'EMERGENTE' && informeSel) {
      const payloadHallazgo = {
        idInforme: informeSel,
        proceso: procesoSel,
        subproceso: subprocesoSel,
        titulo: comentarios || 'Riesgo emergente detectado en campo sin observaciones detalladas.',
        claseObservacion: 'Riesgo Emergente',
        severidad: calificacionFinal === 100 ? 'Bajo' : (calificacionFinal === 50 ? 'Medio' : 'Alto')
      };
      sessionStorage.setItem('hallazgo_emergente_auto', JSON.stringify(payloadHallazgo));
      alert("✅ Evaluación guardada.\n\nSe ha preparado un Hallazgo automáticamente con tu observación. Por favor, ve al módulo 'Planes y Hallazgos' y presiona 'Nuevo Hallazgo' para radicarlo.");
    }

    // ⚡ LIMPIEZA PARCIAL: Mantenemos Proceso, Subproceso y Riesgo para continuar con el siguiente control
    if (!editEvaluacion) {
      setControlSel('');
      setEvidenciaUrl('');
      setComentarios('');
      setDiseno('Eficaz');
      setEjecucion('Eficaz');
      setInformeSel(''); // Limpiamos el selector de informe
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

                {/* ⚠️ OPCIÓN COMODÍN PARA RIESGOS EMERGENTES */}
                <option value="EMERGENTE" className="font-bold text-amber-800 bg-amber-50">
                  ⚠️ RSK-EMERG: + RIESGO EMERGENTE (No registrado en Matriz)
                </option>

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
{/* 💡 VINCULACIÓN AUTOMÁTICA DE HALLAZGO EMERGENTE */}
          {riesgoIdSel === 'EMERGENTE' && (
            <div className="md:col-span-4 lg:col-span-4 bg-amber-50 border border-amber-200 text-amber-900 p-5 rounded-2xl shadow-sm animate-in fade-in duration-200 mt-2">
              <div className="flex items-start gap-3 mb-4">
                <span className="text-2xl">💡</span>
                <p className="text-xs font-medium">
                  Estás registrando un <strong>Riesgo Emergente</strong>. Detalla la falla en las <em>Observaciones Tácticas</em>. <br/>
                  Para automatizar la creación del Hallazgo, selecciona a qué <strong>Informe Emitido</strong> quedará amarrado:
                </p>
              </div>
              <select
                value={informeSel}
                onChange={(e) => setInformeSel(e.target.value)}
                required={riesgoIdSel === 'EMERGENTE'}
                className="w-full text-xs p-3 bg-white border border-amber-300 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 shadow-sm outline-none cursor-pointer"
              >
                <option value="">-- Seleccione el Informe de Auditoría Origen --</option>
                {informesAuditoria.map(inf => (
                  <option key={inf.id} value={inf.id}>[{inf.ref}] {inf.titulo}</option>
                ))}
              </select>
            </div>
          )}
                
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

        {/* ☁️ BÓVEDA REPOSITORIO OFICIAL TERMALES (CON BORDES PUNTEADOS Y ANIMACIÓN) */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-inner space-y-4">
            <div className="border-b pb-3 border-slate-200 flex justify-between items-center">
              <div>
                <label className="font-black text-slate-800 uppercase tracking-widest text-xs">
                  REPOSITORIO OFICIAL TERMALES SANTA ROSA
                </label>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                  Sube tus PDFs o imágenes. Se enviarán directamente a repos.termalessantarosa.com.co.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {(evidenciaUrlForm || evidenciaUrl) && (
                  <button
                    type="button"
                    onClick={() => analizarEvidenciaIA(evidenciaUrlForm || evidenciaUrl, `Control ${controlSel}`, 'Test de Control')}
                    className="text-[10px] bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-xl font-extrabold flex items-center gap-1 transition-all shadow-sm"
                  >
                    ✨ Validar Evidencia con IA
                  </button>
                )}
                <div className="text-slate-300 text-3xl">☁️</div>
              </div>
            </div>

            {/* Campo oculto que enviará la URL al backend */}
            <input 
              type="hidden" 
              name="evidenciaUrlInput" 
              value={evidenciaUrlForm || evidenciaUrl || editEvaluacion?.evidenciaUrl || ''} 
            />

            {/* CAJA DE DROPZONE INTERACTIVA */}
            <div className="bg-white border-2 border-dashed border-emerald-300 p-6 rounded-2xl text-center relative hover:border-emerald-500 hover:bg-emerald-50/50 transition-all flex flex-col items-center justify-center min-h-[150px] shadow-sm">
              <span className="absolute top-3 left-4 text-[9px] font-black uppercase text-emerald-600 tracking-widest bg-emerald-50 px-2 py-0.5 rounded">
                📎 Muestra / Soporte de Trabajo de Campo
              </span>

              {isUploading ? (
                <div className="space-y-3 w-full mt-4">
                  <div className="text-3xl animate-bounce">🚀</div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 max-w-[80%] mx-auto overflow-hidden relative">
                    <div className="bg-emerald-500 h-2.5 rounded-full w-full animate-pulse"></div>
                  </div>
                  <p className="text-[9px] font-bold text-emerald-600 animate-pulse">
                    Subiendo soporte al servidor de Termales...
                  </p>
                </div>
) : (evidenciaUrlForm || evidenciaUrl || editEvaluacion?.evidenciaUrl) ? (
  <div className="space-y-3 mt-3 w-full max-w-md mx-auto">
    {/* TARJETA DE DOCUMENTO ADJUNTADO */}
    <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-center justify-between shadow-sm">
      <div className="flex items-center space-x-3 overflow-hidden">
        <span className="text-2xl">📄</span>
        <div className="text-left overflow-hidden">
          <p className="text-[10px] font-black text-emerald-950 uppercase tracking-wider">
            Soporte Adjuntado
          </p>
          <p className="text-[9px] text-emerald-700 font-mono truncate max-w-[200px]">
            {(evidenciaUrlForm || evidenciaUrl || editEvaluacion?.evidenciaUrl).split('/').pop()}
          </p>
        </div>
      </div>

      {/* BOTÓN LIMPIO PARA ABRIR / DESCARGAR PDF */}
      <a
        href={evidenciaUrlForm || evidenciaUrl || editEvaluacion?.evidenciaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg transition-colors whitespace-nowrap shadow-sm flex items-center gap-1"
      >
        <span>👁️</span> Ver PDF
      </a>
    </div>

    {/* OPCIÓN PARA REEMPLAZAR */}
    <label className="inline-block cursor-pointer text-slate-400 hover:text-emerald-600 text-[10px] font-bold uppercase tracking-wider underline transition-colors">
      🔄 Reemplazar Soporte
      <input 
        type="file" 
        className="hidden" 
        accept=".pdf, .jpg, .png, .docx" 
        onChange={handleFileUploadEvaluacion} 
      />
    </label>
  </div>
) : (            
                <label className="cursor-pointer flex flex-col items-center space-y-2 group w-full mt-4">
                  <div className="text-4xl opacity-50 group-hover:scale-110 transition-transform">📂</div>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest bg-slate-100 px-4 py-2 rounded-lg group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors">
                    SELECCIONAR IMAGEN O PDF
                  </p>
                  <input 
                    type="file" 
                    className="hidden" 
                    accept=".pdf, .jpg, .png, .docx" 
                    onChange={handleFileUploadEvaluacion} 
                  />
                </label>
              )}

              {uploadError && <p className="text-red-500 text-[10px] mt-2 font-bold">{uploadError}</p>}
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