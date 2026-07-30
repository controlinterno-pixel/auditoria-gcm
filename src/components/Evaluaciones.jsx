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

  // 1. Estados locales para Riesgo, Diseño, Ejecución y Calificación (NUEVO)
  const [riesgoSeleccionadoId, setRiesgoSeleccionadoId] = useState('');
  const [disenoVal, setDisenoVal] = useState('Eficaz');
  const [ejecucionVal, setEjecucionVal] = useState('Eficaz');
  const [calificacionAutomatica, setCalificacionAutomatica] = useState(100);

  // 2. Sincronizar estados cuando editamos una evaluación existente (NUEVO)
  useEffect(() => {
    setRiesgoSeleccionadoId(editEvaluacion?.idRiesgo || '');
    setDisenoVal(editEvaluacion?.diseño || editEvaluacion?.diseno || 'Eficaz');
    setEjecucionVal(editEvaluacion?.ejecucion || 'Eficaz');
  }, [editEvaluacion]);

  // 3. 🧠 MOTOR LÓGICO COSO / ISO (NUEVO)
  useEffect(() => {
    if (disenoVal === 'Inadecuado') {
      // Regla de oro: Si el diseño está mal, la ejecución no importa. El control no sirve.
      setCalificacionAutomatica(0);
    } else if (disenoVal === 'Eficaz' && ejecucionVal === 'Inadecuado') {
      // Buen diseño, pero el personal no lo aplica bien. Deficiencia operativa.
      setCalificacionAutomatica(50);
    } else {
      // Todo en orden.
      setCalificacionAutomatica(100);
    }
  }, [disenoVal, ejecucionVal]);

  const [archivoSubidoUrl, setArchivoSubidoUrl] = useState('');
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
          <h3 className="text-xs font-bold text-slate-700 uppercase">
            {editEvaluacion ? '✏️ Editar Test' : '➕ Nuevo Test de Control'}
          </h3>
          <form onSubmit={handleEvaluacionSubmit} key={editEvaluacion?.id || 'nueva-evaluacion'} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs shadow-sm">
            
            <div className="md:col-span-2">
              <label className="font-bold text-gray-600 block mb-1">🎯 Seleccionar Riesgo a Auditar</label>
              <select 
                name="idRiesgo" 
                required 
                value={riesgoSeleccionadoId}
                onChange={(e) => setRiesgoSeleccionadoId(e.target.value)}
                className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-800"
              >
                <option value="">-- Seleccione un Riesgo --</option>
                {safeRiesgos.map((r, index) => (
                  <option key={`opt-riesgo-${r.id}-${index}`} value={r.id}>
                    RSG-{r.id} | {r.proceso} - {r.descripcion?.substring(0, 60)}...
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="font-bold text-gray-600 block mb-1">🛡️ Seleccionar Control Asociado</label>
              <select 
                name="noControl" 
                required 
                defaultValue={editEvaluacion?.noControl || ''}
                className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-800"
              >
                <option value="">-- Seleccione el Control --</option>
                {safeRiesgos
                  .filter(r => String(r.id) === String(riesgoSeleccionadoId))
                  .map((r, index) => (
                    <option key={`opt-control-${r.noControl}-${index}`} value={r.noControl}>
                      {r.noControl} | {r.descripcionControl?.substring(0, 80)}...
                    </option>
                  ))
                }
              </select>
            </div>

            {/* 4. Selectores controlados para recalcular puntaje (NUEVO) */}
            <div className="md:col-span-2">
              <label className="font-bold text-gray-600">Diseño (Adecuación)</label>
              <select 
                name="diseno" 
                value={disenoVal} 
                onChange={(e) => setDisenoVal(e.target.value)}
                className="w-full border rounded-lg p-2 mt-1 bg-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Eficaz">Eficaz</option>
                <option value="Inadecuado">Inadecuado</option>
              </select>
            </div>
            
            <div className="md:col-span-2">
              <label className="font-bold text-gray-600">Ejecución (Eficacia Operativa)</label>
              <select 
                name="ejecucion" 
                value={ejecucionVal} 
                onChange={(e) => setEjecucionVal(e.target.value)}
                disabled={disenoVal === 'Inadecuado'} // Si el diseño está mal, la ejecución se bloquea
                className={`w-full border rounded-lg p-2 mt-1 bg-white focus:ring-2 focus:ring-indigo-500 ${disenoVal === 'Inadecuado' ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''}`}
              >
                <option value="Eficaz">Eficaz</option>
                <option value="Inadecuado">Inadecuado</option>
              </select>
            </div>

            {/* 5. Tarjeta de Calificación Dinámica (NUEVO) */}
            <div className="md:col-span-4 bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wider">Calificación del Control (ISO/COSO)</span>
                <span className="text-slate-500 text-[10px]">Calculada automáticamente según el diseño y ejecución.</span>
              </div>
              <div className={`px-4 py-1.5 rounded-full font-black text-sm border shadow-sm ${
                  calificacionAutomatica === 100 ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                  calificacionAutomatica === 50 ? 'bg-amber-100 text-amber-800 border-amber-300' :
                  'bg-red-100 text-red-800 border-red-300'
                }`}>
                {calificacionAutomatica}%
              </div>
              {/* Este input oculto asegura que el % se envíe en el FormData */}
              <input type="hidden" name="calificacion" value={calificacionAutomatica} />
            </div>
            
            {/* ☁️ BÓVEDA SERVIDOR TERMALES: EVIDENCIA DEL TEST DE CONTROL */}
            <div className="md:col-span-4 bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-inner mt-2">
              <div className="border-b pb-2 border-slate-200 flex justify-between items-center mb-4">
                <div>
                  <label className="font-black text-slate-700 uppercase tracking-widest text-[11px]">Evidencia del Test de Control</label>
                  <p className="text-[9px] text-slate-500 font-medium">Sube el soporte de la prueba (PDF o Imagen). Se guardará en el repositorio oficial.</p>
                </div>
                <div className="text-slate-300 text-3xl">☁️</div>
              </div>

              <input type="hidden" name="evidenciaUrlInput" value={archivoSubidoUrl || editEvaluacion?.evidenciaUrl || ''} />

              <div className="bg-white border-2 border-dashed border-indigo-300 p-6 rounded-2xl text-center relative hover:border-indigo-500 hover:bg-indigo-50/50 transition-all flex flex-col items-center justify-center min-h-[160px]">
                {isUploading ? (
                  <div className="space-y-3 w-full">
                    <div className="text-3xl animate-bounce">🚀</div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 max-w-[80%] mx-auto overflow-hidden relative">
                      <div className="bg-indigo-500 h-2.5 rounded-full w-full animate-pulse"></div>
                    </div>
                    <p className="text-[9px] font-bold text-indigo-600 animate-pulse">Procesando y subiendo al servidor, por favor espera...</p>
                  </div>
                ) : archivoSubidoUrl || editEvaluacion?.evidenciaUrl ? (
                  <div className="space-y-2">
                    <div className="text-4xl text-indigo-500">✅</div>
                    <a href={archivoSubidoUrl || editEvaluacion?.evidenciaUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 font-bold hover:underline bg-blue-50 px-3 py-1 rounded-md">Ver Soporte Subido</a>
                    <label className="block mt-3 cursor-pointer text-slate-400 hover:text-indigo-600 text-[9px] font-bold uppercase tracking-wider transition-colors underline">
                      Reemplazar Archivo
                      <input type="file" className="hidden" accept=".pdf, .jpg, .png, .docx" onChange={handleFileUpload} />
                    </label>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center space-y-2 group w-full">
                    <div className="text-4xl opacity-50 group-hover:scale-110 transition-transform">📂</div>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest bg-slate-100 px-4 py-1.5 rounded-lg group-hover:bg-indigo-100 group-hover:text-indigo-700 transition-colors">Seleccionar Archivo PDF o Imagen</p>
                    <input type="file" className="hidden" accept=".pdf, .jpg, .png, .docx" onChange={handleFileUpload} />
                  </label>
                )}
                {uploadError && <p className="text-red-500 text-[10px] mt-2 font-bold">{uploadError}</p>}
              </div>
            </div>            
            <div className="md:col-span-4">
              <label className="font-bold text-gray-600">Comentarios y Observaciones</label>
              <textarea name="comentarios" defaultValue={editEvaluacion?.comentarios||''} required className="w-full border rounded-lg p-2 mt-1" rows="2"></textarea>
            </div>
            <div className="md:col-span-4 flex justify-end">
              <button type="submit" disabled={isUploading} className={`font-bold px-6 py-2 rounded-lg shadow-md ${isUploading ? 'bg-slate-400 cursor-not-allowed text-slate-200' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                {isUploading ? 'Subiendo archivo...' : 'Guardar Test'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Aquí continúa intacta tu tabla inferior... */}
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        {/* ... (Tabla de visualización) */}
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
           <h3 className="font-bold text-slate-700 uppercase text-xs tracking-widest">Registros de Auditoría</h3>
           <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
              <input type="text" placeholder="Búsqueda General..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 pr-4 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64 shadow-sm" />
           </div>
        </div>
        <table className="w-full text-xs text-left divide-y">
          <thead className="bg-slate-900 text-white font-bold uppercase text-[10px]">
            <tr>
              <th className="p-3">
                <div>ID Test</div>
                <FilterInput colKey="id" placeholder="ID..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
              </th>
              <th className="p-3">
                <div>Fecha / Autor</div>
                <FilterInput colKey="auditor" placeholder="Autor..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
              </th>
              <th className="p-3">
                <div>Diseño/Operación</div>
                <FilterInput colKey="diseno" placeholder="Filtrar..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
              </th>
              <th className="p-3">
                <div>Eficacia</div>
                <FilterInput colKey="calificacion" placeholder="%" dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
              </th>
              <th className="p-3">
                <div>Comentarios / Anexos</div>
                <FilterInput colKey="comentarios" dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
              </th>
              {isAdmin && <th className="p-3 text-center">Gestión</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {applyFilters(evaluacionesData, searchTerm, columnFilters).map((ev, index) => (
              <tr key={`eval-row-${ev.id}-${index}`} className="hover:bg-slate-50">
                <td className="p-3">
                  <div className="font-mono text-slate-400 font-bold mb-1">#TEST-{ev.id}</div>
                  {ev.noControl && (
                    <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border border-indigo-100">
                      {ev.noControl}
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <div className="font-bold">{ev.fechaVal}</div>
                  <div className="text-[9px] text-slate-500 mt-1 uppercase truncate w-32" title={ev.auditor}>{ev.auditor}</div>
                </td>
                <td>D: {ev.diseno || ev.diseño} / E: {ev.ejecucion}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded font-black notranslate ${
                    ev.calificacion === 100 ? 'bg-emerald-100 text-emerald-800' : 
                    ev.calificacion === 50 ? 'bg-amber-100 text-amber-800' : 
                    'bg-red-100 text-red-800'
                  }`} translate="no">
                    {ev.calificacion}%
                  </span>
                </td>
                <td className="p-3">
                  <div className="mb-1">{ev.comentarios}</div>
                  {ev.evidenciaUrl ? (
                    <div className="flex items-center space-x-2 mt-2">
                      <a href={ev.evidenciaUrl} target="_blank" rel="noreferrer" className="bg-blue-50 text-blue-700 font-bold px-3 py-1.5 rounded-lg text-[10px] hover:bg-blue-100 flex items-center space-x-1 transition-colors shadow-sm">
                        <span>🔗</span><span>Abrir Enlace</span>
                      </a>
                      {isAdmin && (
                        <button onClick={() => analizarEvidenciaIA(ev.evidenciaUrl, ev.comentarios, 'Test de Auditoría')} className="bg-purple-50 text-purple-700 border border-purple-200 font-bold px-3 py-1.5 rounded-lg text-[10px] hover:bg-purple-100 flex items-center space-x-1 transition-colors shadow-sm">
                          <span>🤖</span><span>Auditar IA</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2 text-[9px] text-slate-400 font-medium italic border border-dashed border-slate-200 inline-block px-2 py-1 rounded bg-slate-50">🚫 Sin evidencia adjunta</div>
                  )}
                </td>
                {isAdmin && (
                  <td className="p-3 text-center whitespace-nowrap space-x-1">
                    <button onClick={() => {setEditEvaluacion(ev); setFormResetKey(Date.now()); scrollToForm();}} className="bg-amber-100 text-amber-800 font-bold px-2 py-1 rounded text-[10px]">✏️ Editar</button>
                    <button onClick={() => handleDeleteItem('evaluaciones', ev.id)} className="bg-red-50 text-red-700 font-bold px-2 py-1 rounded text-[10px]">🗑️</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}