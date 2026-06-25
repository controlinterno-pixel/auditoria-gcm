import React from 'react';

export default function Riesgos({
  isAdmin,
  editRiesgo,
  setEditRiesgo,
  handleRiesgoSubmit,
  setFormResetKey,
  scrollToForm,
  handleDeleteItem,
  applyFilters,
  FilterInput,
  rFiltrados,
  calcularMatriz5x5,
  searchTerm,
  setSearchTerm,
  columnFilters,
  handleColFilterChange,
  exportToExcel,
  safeRiesgos
}) {
  const rData = rFiltrados.map(r => {
    const res = calcularMatriz5x5(r.probabilidadResidual, r.impactoResidual);
    const inh = calcularMatriz5x5(r.probabilidadInherente, r.impactoInherente);
    return { ...r, scoreInhVal: inh.score, scoreResVal: res.score, apetitoVal: res.apetito, accionVal: res.accion, colorVal: res.color };
  });

  return (
    <div className="space-y-6">
      <div className="border-b pb-4 flex justify-between items-center">
        <h2 className="text-2xl font-black text-slate-800">Estructura de Riesgos</h2>
        <div className="flex space-x-3">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
            <input type="text" placeholder="Búsqueda General..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 pr-4 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#004d40] w-64 shadow-sm" />
          </div>
          <button onClick={() => exportToExcel(safeRiesgos, 'Matriz_Riesgos')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition-colors">📥 Exportar</button>
        </div>
      </div>
      
      {/* 🔓 EL FORMULARIO YA NO TIENE CANDADO */}
      <div id="edit-form" className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
        <h3 className="text-xs font-bold text-slate-700 uppercase">{editRiesgo ? `✏️ Editando Riesgo #${editRiesgo.id}` : '➕ Registrar Nuevo Riesgo'}</h3>
        <form onSubmit={handleRiesgoSubmit} key={editRiesgo?.id || 'nuevo-riesgo'} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          
          <div>
            <label className="font-bold text-gray-600">Sede</label>
            <select name="sede" defaultValue={editRiesgo?.sede||'Hotel'} className="w-full border rounded-lg p-2 mt-1 bg-white">
              <option>Hotel</option>
              <option>Ecoparque</option>
              <option>Administrativo</option>
            </select>
          </div>
          
          <div>
            <label className="font-bold text-gray-600">Proceso</label>
            <input name="proceso" defaultValue={editRiesgo?.proceso||''} required className="w-full border rounded-lg p-2 mt-1" />
          </div>
          
          <div>
            <label className="font-bold text-gray-600">Categoría</label>
            <select name="categoria" defaultValue={editRiesgo?.categoria||'Operativo'} className="w-full border rounded-lg p-2 mt-1 bg-white">
              <option>Operativo</option>
              <option>Estratégico</option>
              <option>Tecnológico</option>
            </select>
          </div>
          
          <div>
            <label className="font-bold text-gray-600">Responsable</label>
            <input name="responsable" defaultValue={editRiesgo?.responsable||''} required className="w-full border rounded-lg p-2 mt-1" />
          </div>
          
          <div className="md:col-span-2">
            <label className="font-bold text-gray-600 block">Control Clave</label>
            <input name="control" defaultValue={editRiesgo?.descripcionControl||''} required className="w-full border rounded-lg p-2 mt-1" />
          </div>
          
          <div className="md:col-span-2">
            <label className="font-bold text-purple-700">Normativa / Ley Aplicable</label>
            <input name="normativa" defaultValue={editRiesgo?.normativa||'Ninguna'} placeholder="Ej: Ley 1581, ISO 31000..." required className="w-full border border-purple-300 bg-purple-50 rounded-lg p-2 mt-1" />
          </div>

          <div className="md:col-span-4">
            <label className="font-bold text-gray-600">Descripción Evento</label>
            <input name="descripcion" defaultValue={editRiesgo?.descripcion||''} required className="w-full border rounded-lg p-2 mt-1" />
          </div>
          
          <div>
            <label className="font-bold text-gray-600">Prob. Inherente</label>
            <select name="probInh" defaultValue={editRiesgo?.probabilidadInherente||'Posible'} className="w-full border rounded-lg p-2 mt-1 bg-white">
              <option value="Rara">Rara</option>
              <option value="Posible">Posible</option>
              <option value="Frecuente">Frecuente</option>
            </select>
          </div>
          
          <div>
            <label className="font-bold text-gray-600">Imp. Inherente</label>
            <select name="impInh" defaultValue={editRiesgo?.impactoInherente||'Medio'} className="w-full border rounded-lg p-2 mt-1 bg-white">
              <option value="Bajo">Bajo</option>
              <option value="Medio">Medio</option>
              <option value="Alto">Alto</option>
              <option value="Crítico">Crítico</option>
            </select>
          </div>
          
          <div>
            <label className="font-bold text-gray-600">Prob. Residual</label>
            <select name="probRes" defaultValue={editRiesgo?.probabilidadResidual||'Posible'} className="w-full border rounded-lg p-2 mt-1 bg-white">
              <option value="Rara">Rara</option>
              <option value="Posible">Posible</option>
              <option value="Frecuente">Frecuente</option>
            </select>
          </div>
          
          <div>
            <label className="font-bold text-gray-600">Imp. Residual</label>
            <select name="impRes" defaultValue={editRiesgo?.impactoResidual||'Medio'} className="w-full border rounded-lg p-2 mt-1 bg-white">
              <option value="Bajo">Bajo</option>
              <option value="Medio">Medio</option>
              <option value="Alto">Alto</option>
              <option value="Crítico">Crítico</option>
            </select>
          </div>
          
          <div className="md:col-span-4 flex justify-end space-x-2">
            <button type="submit" className="bg-blue-600 text-white font-bold px-6 py-2 rounded-lg shadow-md">Guardar</button>
          </div>
        </form>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-900 text-white font-bold text-[10px] uppercase">
            <tr>
              <th className="p-3">ID <FilterInput colKey="id" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
              <th className="p-3">Proceso / Ley <FilterInput colKey="proceso" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
              <th className="p-3">Escenario de Riesgo <FilterInput colKey="descripcion" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
              <th className="p-3">Control Mitigante <FilterInput colKey="descripcionControl" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
              <th className="p-3">Apetito COSO <FilterInput colKey="apetitoVal" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
              <th className="p-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y text-slate-700">
            {applyFilters(rData, searchTerm, columnFilters).map((r, index) => (
              <tr key={`riesgo-${r.id}-${index}`} className="hover:bg-slate-50/50">
                <td className="p-3 font-bold text-slate-400">#{r.id}</td>
                <td className="p-3">
                  <span className="font-black text-slate-900 block">{r.proceso}</span>
                  <span className="text-[9px] bg-purple-100 text-purple-700 font-bold px-1.5 py-0.5 rounded tracking-wider mt-0.5 inline-block uppercase">⚖️ {r.normativa || 'Compliance'}</span>
                </td>
                <td className="p-3 max-w-xs">{r.descripcion}</td>
                <td className="p-3 italic max-w-xs">⚙️ {r.descripcionControl}</td>
                <td className="p-3"><span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-[10px]">{r.apetitoVal}</span></td>
                <td className="p-3 text-center whitespace-nowrap">
                  {/* 🔓 EL BOTÓN EDITAR YA NO TIENE CANDADO */}
                  <button onClick={() => {setEditRiesgo(r); setFormResetKey(Date.now()); scrollToForm();}} className="text-orange-500 hover:text-orange-700 mx-1">✏️</button>
                  
                  {/* 🔒 EL BOTÓN ELIMINAR SIGUE BLOQUEADO PARA JEFES DE ÁREA */}
                  {isAdmin && <button onClick={() => handleDeleteItem('riesgos', r.id)} className="text-slate-400 hover:text-red-700 mx-1">🗑️</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}