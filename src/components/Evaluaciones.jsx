import React from 'react';

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
              <label className="font-bold text-gray-600">Riesgo / Control</label>
              <select name="idRiesgo" defaultValue={editEvaluacion?.idRiesgo||''} required className="w-full border rounded-lg p-2 mt-1 bg-white">
                {safeRiesgos.map((r, index) => (
                  <option key={`opt-riesgo-${r.id}-${index}`} value={r.id}>[{r.noControl}] {r.proceso}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-bold text-gray-600">Diseño</label>
              <select name="diseno" defaultValue={editEvaluacion?.diseño||'Eficaz'} className="w-full border rounded-lg p-2 mt-1 bg-white">
                <option>Eficaz</option>
                <option>Inadecuado</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-gray-600">Ejecución</label>
              <select name="ejecucion" defaultValue={editEvaluacion?.ejecucion||'Eficaz'} className="w-full border rounded-lg p-2 mt-1 bg-white">
                <option>Eficaz</option>
                <option>Inadecuado</option>
              </select>
            </div>
            
            <div className="md:col-span-4 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 shadow-sm">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 border-b border-indigo-100 pb-3">
                <div>
                  <label className="font-black text-indigo-800 uppercase tracking-widest text-[10px]">Paso 1: Busca y copia el enlace</label>
                  <p className="text-[9px] text-indigo-600 font-medium mt-0.5">Ve a tu nube, busca el archivo, haz clic en "Compartir" y copia el link.</p>
                </div>
                <div className="flex space-x-2 mt-2 md:mt-0">
                  <a href="https://drive.google.com" target="_blank" rel="noreferrer" className="text-[10px] bg-white border border-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-lg shadow-sm hover:bg-slate-50 transition-all flex items-center space-x-1"><span>📁</span><span>Ir a Drive</span></a>
                  <a href="https://onedrive.live.com" target="_blank" rel="noreferrer" className="text-[10px] bg-white border border-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-lg shadow-sm hover:bg-slate-50 transition-all flex items-center space-x-1"><span>☁️</span><span>Ir a OneDrive</span></a>
                </div>
              </div>
              <div>
                <label className="font-black text-indigo-800 uppercase tracking-widest text-[10px] block mb-1.5">Paso 2: Pega el enlace copiado aquí</label>
                <input type="url" name="evidenciaUrlInput" defaultValue={editEvaluacion?.evidenciaUrl||''} placeholder="Ej: https://drive.google.com/file/d/1a2b3c..." className="w-full border border-indigo-200 bg-white rounded-lg p-2.5 text-xs shadow-inner focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
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
                <td className="p-3 font-mono text-slate-400">#TEST-{ev.id}</td>
                <td className="p-3">
                  <div className="font-bold">{ev.fechaVal}</div>
                  <div className="text-[9px] text-slate-500 mt-1 uppercase truncate w-32" title={ev.auditor}>{ev.auditor}</div>
                </td>
                <td>D: {ev.diseño} / E: {ev.ejecucion}</td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded font-black bg-green-100 text-green-800 notranslate" translate="no">
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