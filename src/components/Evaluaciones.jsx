// Ruta: src/components/Evaluaciones.jsx
import React, { useState, useEffect } from 'react';
import { useDataFetching } from '../hooks/useDataFetching';
import { apiService } from '../services/apiService';

export default function Evaluaciones({
  isAdmin,
  editEvaluacion,
  setEditEvaluacion,
  handleEvaluacionSubmit,
  safeRiesgos,
  user,
  analizarEvidenciaIA,
  safeEvaluaciones,
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
  const evaluacionesData = safeEvaluaciones.map(e => ({ ...e, fechaVal: formatSafeDate(e.fecha) }));

  // 1. 🔗 ESTADOS PARA MENÚS ENCADENADOS Y MOTOR COSO
  const [procesoSeleccionado, setProcesoSeleccionado] = useState('');
  const [riesgoSeleccionadoId, setRiesgoSeleccionadoId] = useState('');
  const [disenoVal, setDisenoVal] = useState('Eficaz');
  const [ejecucionVal, setEjecucionVal] = useState('Eficaz');
  const [calificacionAutomatica, setCalificacionAutomatica] = useState(100);
  const [archivoSubidoUrl, setArchivoSubidoUrl] = useState('');

  // 2. 🔄 Sincronizar estados cuando editamos una evaluación existente
  useEffect(() => {
    if (editEvaluacion) {
      setProcesoSeleccionado(editEvaluacion.proceso || '');
      setRiesgoSeleccionadoId(editEvaluacion.idRiesgo || '');
      setDisenoVal(editEvaluacion.diseño || editEvaluacion.diseno || 'Eficaz');
      setEjecucionVal(editEvaluacion.ejecucion || 'Eficaz');
      setArchivoSubidoUrl(editEvaluacion.evidenciaUrl || '');
    } else {
      setProcesoSeleccionado('');
      setRiesgoSeleccionadoId('');
      setDisenoVal('Eficaz');
      setEjecucionVal('Eficaz');
      setArchivoSubidoUrl('');
    }
  }, [editEvaluacion]);

  // 3. 🧠 MOTOR LÓGICO COSO / ISO
  useEffect(() => {
    if (disenoVal === 'Inadecuado') {
      setCalificacionAutomatica(0);
    } else if (disenoVal === 'Eficaz' && ejecucionVal === 'Inadecuado') {
      setCalificacionAutomatica(50);
    } else {
      setCalificacionAutomatica(100);
    }
  }, [disenoVal, ejecucionVal]);

  // 4. 🎯 DATOS DERIVADOS PARA LOS MENÚS DESPLEGABLES
  const procesosDisponibles = [...new Set((safeRiesgos || []).map(r => r.proceso).filter(Boolean))];
  const riesgosDelProceso = (safeRiesgos || []).filter(r => r.proceso === procesoSeleccionado);
  const riesgoActivo = (safeRiesgos || []).find(r => String(r.id) === String(riesgoSeleccionadoId));

  // 5. ☁️ SUBIDA DE ARCHIVOS
  const { isLoading: isUploading, error: uploadError, ejecutarPeticion } = useDataFetching();

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await ejecutarPeticion(
        apiService.subirEvidencia(file, {
          appName: 'controlInterno',
          description: 'Evidencia de Test de Control'
        })
      );
      const urlFinal = `https://repos.termalessantarosa.com.co/api/archivos/auditoria/${data.appName}/${data.fileName}`;
      setArchivoSubidoUrl(urlFinal);
      alert("🎉 ¡Soporte de evaluación guardado con éxito en el servidor de Termales!");
    } catch (err) {
      alert("Error al conectar con el servidor de archivos.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h2 className="text-2xl font-black text-slate-800">🔬 Auditoría de Controles</h2>
      </div>
      
      {isAdmin && (
        <div id="edit-form" className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest border-b pb-2">
            {editEvaluacion ? '✏️ Editar Test de Control' : '➕ Nuevo Test de Control'}
          </h3>
          
          <form onSubmit={handleEvaluacionSubmit} key={editEvaluacion?.id || 'nueva-evaluacion'} className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs shadow-sm mt-4">
            
            {/* --- BLOQUE 1: MENÚS ENCADENADOS --- */}
            <div>
              <label className="font-bold text-gray-600 block mb-1">🏢 Proceso</label>
              <select 
                name="proceso" 
                required 
                value={procesoSeleccionado}
                onChange={(e) => {
                  setProcesoSeleccionado(e.target.value);
                  setRiesgoSeleccionadoId(''); // Resetea el riesgo al cambiar proceso
                }}
                className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 transition-all"
              >
                <option value="">-- Seleccione un Proceso --</option>
                {procesosDisponibles.map(proc => (
                  <option key={proc} value={proc}>{proc}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-gray-600 block mb-1">🎯 Riesgo a Evaluar</label>
              <select 
                name="idRiesgo" 
                required 
                value={riesgoSeleccionadoId}
                onChange={(e) => setRiesgoSeleccionadoId(e.target.value)}
                disabled={!procesoSeleccionado}
                className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <option value="">-- Seleccione un Riesgo --</option>
                {riesgosDelProceso.map(r => (
                  <option key={r.id} value={r.id}>
                    RSG-{r.id} | {r.descripcion?.substring(0, 45)}...
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-gray-600 block mb-1">🛡️ Control Vinculado</label>
              <input 
                type="text" 
                name="noControl" 
                readOnly
                required
                value={riesgoActivo ? riesgoActivo.noControl : ''}
                placeholder="Se autocompleta..."
                className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-100 text-slate-500 font-mono font-bold cursor-not-allowed outline-none"
              />
              <p className="text-[10px] text-slate-500 mt-1 truncate" title={riesgoActivo?.descripcionControl}>
                {riesgoActivo ? riesgoActivo.descripcionControl : 'Seleccione un riesgo primero'}
              </p>
            </div>

            {/* --- BLOQUE 2: MOTOR COSO --- */}
            <div className="md:col-span-3 border-t pt-4 grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="font-bold text-gray-600">Adecuación del Diseño</label>
                <select 
                  name="diseno" 
                  value={disenoVal} 
                  onChange={(e) => setDisenoVal(e.target.value)}
                  className="w-full border rounded-lg p-2.5 mt-1 bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Eficaz">Eficaz (Bien Diseñado)</option>
                  <option value="Inadecuado">Inadecuado (Mal Diseñado)</option>
                </select>
              </div>
              
              <div>
                <label className="font-bold text-gray-600">Eficacia Operativa (Ejecución)</label>
                <select 
                  name="ejecucion" 
                  value={ejecucionVal} 
                  onChange={(e) => setEjecucionVal(e.target.value)}
                  disabled={disenoVal === 'Inadecuado'}
                  className={`w-full border rounded-lg p-2.5 mt-1 bg-white focus:ring-2 focus:ring-indigo-500 ${disenoVal === 'Inadecuado' ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''}`}
                >
                  <option value="Eficaz">Eficaz (Se cumple en la práctica)</option>
                  <option value="Inadecuado">Inadecuado (No se cumple)</option>
                </select>
              </div>

              {/* Tarjeta de Calificación Dinámica */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-center items-center text-center shadow-inner">
                <span className="font-bold text-slate-500 text-[10px] uppercase tracking-wider mb-1">Eficacia del Control</span>
                <div className={`px-6 py-1.5 rounded-full font-black text-lg border shadow-sm ${
                    calificacionAutomatica === 100 ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                    calificacionAutomatica === 50 ? 'bg-amber-100 text-amber-800 border-amber-300' :
                    'bg-red-100 text-red-800 border-red-300'
                  }`}>
                  {calificacionAutomatica}%
                </div>
                <input type="hidden" name="calificacion" value={calificacionAutomatica} />
              </div>
            </div>
            
            {/* --- BLOQUE 3: EVIDENCIA & IA --- */}
            <div className="md:col-span-3 bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-inner mt-2">
              <div className="border-b pb-2 border-slate-200 flex justify-between items-center mb-4">
                <div>
                  <label className="font-black text-slate-700 uppercase tracking-widest text-[11px]">Evidencia de Auditoría</label>
                  <p className="text-[9px] text-slate-500 font-medium">Sube el soporte (PDF/Img) para activar la validación de la Inteligencia Artificial.</p>
                </div>
                <div className="text-slate-300 text-3xl">☁️</div>
              </div>

              <input type="hidden" name="evidenciaUrlInput" value={archivoSubidoUrl} />

              <div className="bg-white border-2 border-dashed border-indigo-300 p-6 rounded-2xl text-center relative transition-all flex flex-col items-center justify-center min-h-[160px]">
                {isUploading ? (
                  <div className="space-y-3 w-full">
                    <div className="text-3xl animate-bounce">🚀</div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 max-w-[80%] mx-auto overflow-hidden relative">
                      <div className="bg-indigo-500 h-2.5 rounded-full w-full animate-pulse"></div>
                    </div>
                    <p className="text-[9px] font-bold text-indigo-600 animate-pulse">Subiendo soporte al servidor...</p>
                  </div>
                ) : archivoSubidoUrl ? (
                  <div className="space-y-4 w-full flex flex-col items-center">
                    <div className="text-4xl text-emerald-500 mb-2">✅</div>
                    
                    {/* 🤖 AQUÍ ESTÁ EL NUEVO BOTÓN DE IA INTEGRADO */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <a href={archivoSubidoUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-700 font-bold hover:bg-blue-100 bg-blue-50 border border-blue-200 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-all">
                        <span>🔗</span> Ver Soporte
                      </a>
                      
                      <button 
                        type="button" 
                        onClick={() => analizarEvidenciaIA(archivoSubidoUrl, riesgoActivo ? `Verificar cumplimiento del control ${riesgoActivo.noControl}: ${riesgoActivo.descripcionControl}` : 'Validar soporte genérico', 'Test de Auditoría')}
                        className="text-[10px] text-purple-700 font-black hover:bg-purple-100 bg-purple-50 border border-purple-200 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-all"
                      >
                        <span>✨</span> Analizar con Gemini
                      </button>
                    </div>

                    <label className="block mt-4 cursor-pointer text-slate-400 hover:text-indigo-600 text-[9px] font-bold uppercase tracking-wider underline">
                      Reemplazar Archivo
                      <input type="file" className="hidden" accept=".pdf, .jpg, .png, .docx" onChange={handleFileUpload} />
                    </label>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center space-y-2 group w-full hover:bg-indigo-50/50 p-4 rounded-xl">
                    <div className="text-4xl opacity-50 group-hover:scale-110 transition-transform">📂</div>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest bg-slate-100 px-4 py-1.5 rounded-lg group-hover:bg-indigo-100 group-hover:text-indigo-700 transition-colors">Seleccionar Archivo (PDF, JPG, PNG)</p>
                    <input type="file" className="hidden" accept=".pdf, .jpg, .png, .docx" onChange={handleFileUpload} />
                  </label>
                )}
                {uploadError && <p className="text-red-500 text-[10px] mt-2 font-bold">{uploadError}</p>}
              </div>
            </div>            
            
            <div className="md:col-span-3">
              <label className="font-bold text-gray-600 block mb-1">Comentarios y Observaciones de Auditoría</label>
              <textarea name="comentarios" defaultValue={editEvaluacion?.comentarios||''} required className="w-full border border-slate-300 rounded-lg p-3 bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none" rows="2" placeholder="Describe aquí los hallazgos o justificaciones del test..."></textarea>
            </div>

            <div className="md:col-span-3 flex justify-end mt-2 border-t pt-4">
              <button type="submit" disabled={isUploading || !riesgoSeleccionadoId} className={`font-bold px-8 py-3 rounded-xl shadow-md text-[11px] uppercase tracking-widest transition-all ${isUploading || !riesgoSeleccionadoId ? 'bg-slate-300 cursor-not-allowed text-slate-500' : 'bg-slate-900 text-white hover:bg-slate-800 hover:scale-[1.02]'}`}>
                {isUploading ? 'Subiendo...' : '💾 Guardar Evaluación'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- TABLA DE VISUALIZACIÓN --- */}
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
           <h3 className="font-bold text-slate-700 uppercase text-xs tracking-widest flex items-center gap-2">
             <span>📑</span> Historial de Evaluaciones
           </h3>
           <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
              <input type="text" placeholder="Búsqueda General..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 pr-4 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64 shadow-sm" />
           </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left divide-y">
            <thead className="bg-slate-900 text-white font-bold uppercase text-[10px]">
              <tr>
                <th className="p-3">
                  <div>Datos de Control</div>
                  <FilterInput colKey="id" placeholder="Filtrar ID/Control..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
                <th className="p-3">
                  <div>Fecha / Auditor</div>
                  <FilterInput colKey="auditor" placeholder="Filtrar Auditor..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
                <th className="p-3">
                  <div>Mecánica COSO</div>
                  <FilterInput colKey="diseno" placeholder="Filtrar..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
                <th className="p-3 text-center">
                  <div>Puntaje</div>
                  <FilterInput colKey="calificacion" placeholder="%" dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
                <th className="p-3">
                  <div>Dictamen Final</div>
                  <FilterInput colKey="comentarios" placeholder="Buscar texto..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
                {isAdmin && <th className="p-3 text-center">Gestión</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {applyFilters(evaluacionesData, searchTerm, columnFilters).map((ev, index) => (
                <tr key={`eval-row-${ev.id}-${index}`} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3">
                    <div className="font-mono text-slate-400 font-bold mb-1">#TEST-{ev.id}</div>
                    {ev.control && (
                      <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider border border-indigo-100 shadow-sm inline-block">
                        {ev.control}
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="font-bold text-slate-700">{ev.fechaVal}</div>
                    <div className="text-[9px] text-slate-500 mt-1 uppercase truncate w-32 font-bold bg-slate-100 inline-block px-2 py-0.5 rounded" title={ev.auditor}>{ev.auditor.split('@')[0]}</div>
                  </td>
                  <td className="p-3 text-[10px]">
                    <div className="text-slate-600"><strong>Diseño:</strong> {ev.diseno || ev.diseño}</div>
                    <div className="text-slate-600 mt-1"><strong>Ejecución:</strong> {ev.ejecucion}</div>
                  </td>
                  <td className="p-3 text-center">
                    <span className={`px-2.5 py-1 rounded font-black notranslate border shadow-sm ${
                      ev.calificacion === 100 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                      ev.calificacion === 50 ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                      'bg-red-50 text-red-700 border-red-200'
                    }`} translate="no">
                      {ev.calificacion}%
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="mb-2 text-slate-700 line-clamp-2" title={ev.comentarios}>{ev.comentarios}</div>
                    {ev.evidenciaUrl ? (
                      <div className="flex flex-wrap gap-2">
                        <a href={ev.evidenciaUrl} target="_blank" rel="noreferrer" className="bg-blue-50 border border-blue-100 text-blue-700 font-bold px-3 py-1.5 rounded-lg text-[9px] hover:bg-blue-100 flex items-center gap-1 transition-colors">
                          <span>🔗</span><span>Ver Anexo</span>
                        </a>
                        {isAdmin && (
                          <button onClick={() => analizarEvidenciaIA(ev.evidenciaUrl, `Dictamen: ${ev.comentarios}`, 'Test de Auditoría')} className="bg-purple-50 border border-purple-100 text-purple-700 font-bold px-3 py-1.5 rounded-lg text-[9px] hover:bg-purple-100 flex items-center gap-1 transition-colors">
                            <span>🤖</span><span>Auditar IA</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="text-[9px] text-slate-400 font-bold italic border border-dashed border-slate-200 inline-block px-2 py-1 rounded bg-slate-50">🚫 Sin Evidencia</div>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="p-3 text-center whitespace-nowrap">
                      <div className="flex justify-center gap-1">
                        <button onClick={() => {setEditEvaluacion(ev); setFormResetKey(Date.now()); scrollToForm();}} className="bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold px-2.5 py-1.5 rounded text-[10px] transition-colors">✏️ Editar</button>
                        <button onClick={() => handleDeleteItem('evaluaciones', ev.id)} className="bg-red-50 hover:bg-red-100 text-red-700 font-bold px-2.5 py-1.5 rounded text-[10px] transition-colors">🗑️</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}