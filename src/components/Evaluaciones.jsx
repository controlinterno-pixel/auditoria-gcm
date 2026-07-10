import React, { useState, useEffect } from 'react';

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

  // 1. Estado local para manejar el Riesgo seleccionado y filtrar los controles
  const [riesgoSeleccionadoId, setRiesgoSeleccionadoId] = useState('');

  // 2. Efecto para cargar el riesgo automáticamente cuando le damos a "Editar"
  useEffect(() => {
    setRiesgoSeleccionadoId(editEvaluacion?.idRiesgo || '');
  }, [editEvaluacion]);

// ☁️ MOTOR DE SUBIDA DE EVIDENCIAS A LA API DE TERMALES
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [archivoSubidoUrl, setArchivoSubidoUrl] = useState('');

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(20);

    const formData = new FormData();
    formData.append('appName', 'controlInterno'); 
    formData.append('description', 'Evidencia de Test de Control'); 
    formData.append('file', file); 

    try {
      setUploadProgress(50);
      const response = await fetch('https://repos.termalessantarosa.com.co/api/archivos/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

      const data = await response.json();
      const urlFinal = `https://repos.termalessantarosa.com.co/api/archivos/auditoria/${data.appName}/${data.fileName}`;

      setArchivoSubidoUrl(urlFinal);
      setIsUploading(false);
      setUploadProgress(100);
      alert("🎉 ¡Soporte de evaluación guardado con éxito en el servidor de Termales!");
    } catch (err) {
      console.error(err);
      alert("Error al conectar con el servidor de archivos.");
      setIsUploading(false);
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
            
            {/* NUEVO: Selector de Riesgo */}
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

            {/* NUEVO: Selector de Control Dependiente */}
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

            {/* Ajusté las columnas de Diseño y Ejecución para que queden simétricas */}
            <div className="md:col-span-2">
              <label className="font-bold text-gray-600">Diseño</label>
              <select name="diseno" defaultValue={editEvaluacion?.diseño||'Eficaz'} className="w-full border rounded-lg p-2 mt-1 bg-white">
                <option>Eficaz</option>
                <option>Inadecuado</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="font-bold text-gray-600">Ejecución</label>
              <select name="ejecucion" defaultValue={editEvaluacion?.ejecucion||'Eficaz'} className="w-full border rounded-lg p-2 mt-1 bg-white">
                <option>Eficaz</option>
                <option>Inadecuado</option>
              </select>
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

              {/* INPUT OCULTO: Guarda la URL en el formulario */}
              <input type="hidden" name="evidenciaUrlInput" value={archivoSubidoUrl || editEvaluacion?.evidenciaUrl || ''} />

              <div className="bg-white border-2 border-dashed border-indigo-300 p-6 rounded-2xl text-center relative hover:border-indigo-500 hover:bg-indigo-50/50 transition-all flex flex-col items-center justify-center min-h-[160px]">
                {isUploading ? (
                  <div className="space-y-3 w-full">
                    <div className="text-3xl animate-bounce">🚀</div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 max-w-[80%] mx-auto overflow-hidden">
                      <div className="bg-indigo-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                    <p className="text-[9px] font-bold text-slate-500">{uploadProgress}% Subiendo al servidor...</p>
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
              </div>
            </div>            
            <div className="md:col-span-4">
              <label className="font-bold text-gray-600">Comentarios y Observaciones</label>
              <textarea name="comentarios" defaultValue={editEvaluacion?.comentarios||''} required className="w-full border rounded-lg p-2 mt-1" rows="2"></textarea>
            </div>
            <div className="md:col-span-4 flex justify-end">
              <button type="submit" className="bg-indigo-600 text-white font-bold px-6 py-2 rounded-lg shadow-md hover:bg-indigo-700">
                Guardar Test
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
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
                  {/* Pequeño detalle: Muestro el Control en la tabla para mejor visibilidad */}
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
                <td>D: {ev.diseño} / E: {ev.ejecucion}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded font-black notranslate ${ev.calificacion === 100 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`} translate="no">
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