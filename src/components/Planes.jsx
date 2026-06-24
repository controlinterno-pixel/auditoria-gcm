import React from 'react';

const ProgressBar = ({ progress }) => {
  const safeProgress = Math.min(Math.max(Math.round(Number(progress) || 0), 0), 100);
  let color = "bg-red-500";
  if (safeProgress >= 40) color = "bg-amber-500";
  if (safeProgress >= 80) color = "bg-emerald-500";
  
  return (
    <div className="w-full">
      <div className="flex justify-between text-[10px] font-bold mb-1">
        <span className="text-slate-500">PROGRESO</span>
        <span className="text-slate-800 notranslate" translate="no">{safeProgress}%</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all duration-1000`} style={{ width: `${safeProgress}%` }}></div>
      </div>
    </div>
  );
};

export default function Planes({
  isAdmin,
  editPlan,
  setEditPlan,
  handlePlanSubmit,
  formResetKey,
  setFormResetKey,
  scrollToForm,
  handleDeleteItem,
  applyFilters,
  FilterInput,
  pFiltrados,
  safeHallazgos,
  formatSafeDate,
  searchTerm,
  setSearchTerm,
  columnFilters,
  handleColFilterChange
}) {
  const planesData = pFiltrados.map(p => ({ ...p, fechaVal: formatSafeDate(p.fecha) }));

  return (
    <div className="space-y-6">
      <div className="border-b pb-4"><h2 className="text-2xl font-black text-slate-800">✅ Planes de Acción Remediales</h2></div>
      {isAdmin && (
        <div id="edit-form" className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase">{editPlan ? `✏️ Editando Avance de Plan` : '➕ Asignar Plan'}</h3>
          
          <form onSubmit={handlePlanSubmit} key={editPlan?.id || 'nuevo-plan'} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs shadow-sm">
            <div className="md:col-span-4"><label className="font-bold text-gray-600">Hallazgo Vinculado</label><select name="idHallazgo" defaultValue={editPlan?.idHallazgo||''} required className="w-full border rounded-lg p-2 mt-1 bg-white"><option value="">-- Seleccione --</option>{safeHallazgos.map((h, index) => <option key={`opt-hallz-${h.id}-${index}`} value={h.id}>[#HAL-{h.id}] {h.titulo}</option>)}</select></div>
            
            <div className="md:col-span-2">
              <label className="font-bold text-gray-600 block mb-1">Acción de Choque / Mitigación</label>
              <input name="accion" defaultValue={editPlan?.accion||''} required placeholder="Acción de Choque / Mitigación" className="w-full border p-2 rounded" />
            </div>

            <div><label className="font-bold text-gray-600">Responsable de Execution</label><input name="responsable" defaultValue={editPlan?.responsable||''} required className="w-full border p-2 rounded" /></div>
            <div><label className="font-bold text-gray-600">Compromiso</label><input name="fecha" type="date" defaultValue={formatSafeDate(editPlan?.fecha)||''} required className="w-full border p-2 rounded" /></div>
            <div><label className="font-bold text-blue-600">% Avance Real</label><input name="progreso" type="number" min="0" max="100" defaultValue={editPlan?.progreso||0} placeholder="% Avance Real" className="w-full border p-2 bg-blue-50 border-blue-200 rounded" /></div>
            
            <div className="md:col-span-4 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 shadow-sm">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 border-b border-emerald-100 pb-3">
                <div>
                  <label className="font-black text-emerald-800 uppercase tracking-widest text-[10px]">Paso 1: Busca y copia el enlace del entregable</label>
                  <p className="text-[9px] text-emerald-600 font-medium mt-0.5">Ve a tu nube, busca el archivo de evidencia que demuestre la mitigación, haz clic en "Compartir" y copia el link.</p>
                </div>
                <div className="flex space-x-2 mt-2 md:mt-0">
                  <a href="https://drive.google.com" target="_blank" rel="noreferrer" className="text-[10px] bg-white border border-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-lg shadow-sm hover:bg-slate-50 transition-all flex items-center space-x-1"><span>📁</span><span>Ir a Drive</span></a>
                  <a href="https://onedrive.live.com" target="_blank" rel="noreferrer" className="text-[10px] bg-white border border-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-lg shadow-sm hover:bg-slate-50 transition-all flex items-center space-x-1"><span>☁️</span><span>Ir a OneDrive</span></a>
                </div>
              </div>
              <div>
                <label className="font-black text-emerald-800 uppercase tracking-widest text-[10px] block mb-1.5">Paso 2: Pega el enlace del soporte aquí</label>
                <input type="url" name="evidenciaUrlInput" defaultValue={editPlan?.evidenciaUrl||''} placeholder="Ej: https://drive.google.com/file/d/1a2b3c..." className="w-full border border-emerald-200 bg-white rounded-lg p-2.5 text-xs shadow-inner focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
              </div>
              {editPlan?.evidenciaUrl && (
                <div className="mt-3 flex space-x-2 border-t border-emerald-100 pt-2">
                  <a href={editPlan.evidenciaUrl} target="_blank" rel="noreferrer" className="inline-flex items-center px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-bold hover:bg-emerald-200 shadow-sm transition-colors">
                    👁️ Abrir Enlace Actual
                  </a>
                </div>
              )}
            </div>
            
            <div className="md:col-span-4 flex justify-end"><button type="submit" className="bg-[#004d40] text-white px-5 py-2 rounded font-bold hover:bg-[#003d33]">{editPlan ? 'Actualizar Plan' : 'Asignar Plan'}</button></div>
          </form>
        </div>
      )}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
           <h3 className="font-bold text-slate-700 uppercase text-xs tracking-widest">Seguimiento de Planes</h3>
           <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
              <input type="text" placeholder="Búsqueda General..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 pr-4 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-slate-800 w-64 shadow-sm" />
           </div>
        </div>
        <table className="w-full text-xs text-left divide-y">
          <thead className="bg-slate-900 text-white font-bold text-[10px] uppercase">
            <tr>
              <th className="p-3">
                <div>ID Plan</div>
                <FilterInput colKey="id" placeholder="ID..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
              </th>
              <th className="p-3">
                <div>Hallazgo</div>
                <FilterInput colKey="idHallazgo" placeholder="Ref..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
              </th>
              <th className="p-3">
                <div>Acción Remedial Programada</div>
                <FilterInput colKey="accion" dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
              </th>
              <th className="p-3 w-40">% Avance</th>
              <th className="p-3">
                <div>Estado</div>
                <FilterInput colKey="estado" placeholder="Estado..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
              </th>
              <th className="p-3 text-center">Gestión</th>
            </tr>
          </thead>
          <tbody className="divide-y text-slate-700">
            {applyFilters(planesData, searchTerm, columnFilters).map((p, index) => {
              const hallazgoAsociado = safeHallazgos.find(h => h.id === p.idHallazgo);
              return (
                <tr key={`plan-row-${p.id}-${index}`} className="hover:bg-slate-50">
                  <td className="p-3 font-bold">#PLAN-{p.id}</td>
                  <td className="p-3 text-red-600 font-bold">#HAL-{p.idHallazgo}<span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold block mt-1">{hallazgoAsociado?.sede || 'Hotel'}</span></td>
                  <td className="p-3 text-slate-800 font-medium">
                    {p.accion} <span className="text-[10px] text-slate-400 block font-normal mt-1">Resp: {p.responsable} • Límite: {p.fechaVal}</span>
                    {p.evidenciaUrl ? (
                      <div className="flex items-center space-x-2 mt-2">
                        <a href={p.evidenciaUrl} target="_blank" rel="noreferrer" className="bg-blue-50 text-blue-700 font-bold px-3 py-1.5 rounded-lg text-[10px] hover:bg-blue-100 flex items-center space-x-1 transition-colors shadow-sm">
                          <span>🔗</span><span>Abrir Enlace</span>
                        </a>
                      </div>
                    ) : (
                      <div className="mt-2 text-[9px] text-slate-400 font-medium italic border border-dashed border-slate-200 inline-block px-2 py-1 rounded bg-slate-50">🚫 Sin evidencia adjunta</div>
                    )}
                  </td>
                  <td className="p-3"><ProgressBar progress={p.progreso || p.avance || 0} /></td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded font-black uppercase text-[9px] ${p.estado === 'Cerrado' ? 'bg-emerald-100 text-emerald-800' : 'bg-yellow-100 text-yellow-800'}`}>{p.estado}</span></td>
                  <td className="p-3 text-center whitespace-nowrap space-x-1">
                    {isAdmin && <button onClick={() => {setEditPlan(p); setFormResetKey(Date.now()); scrollToForm();}} className="bg-amber-100 text-amber-800 font-bold px-2 py-1 rounded text-[10px]">✏️ Editar</button>}
                    {isAdmin && <button onClick={() => handleDeleteItem('planes', p.id)} className="bg-red-50 text-red-700 font-bold px-2 py-1 rounded text-[10px]">🗑️</button>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}