import React from 'react';

export default function Incidentes({
  incFiltrados,
  isAdmin,
  searchTerm,
  setSearchTerm,
  columnFilters,
  handleColFilterChange,
  editIncidente,
  setEditIncidente,
  handleIncidenteSubmit,
  formResetKey,
  setFormResetKey,
  scrollToForm,
  handleDeleteItem,
  applyFilters,
  FilterInput
}) {
  return (
    <div className="space-y-6">
      <div className="border-b pb-2 font-black text-lg">🚨 Registro de Eventos de Pérdida (COP)</div>
      {isAdmin && (
        <div id="edit-form" className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
             <h3 className="text-xs font-bold text-slate-700 uppercase">
               {editIncidente ? `✏️ Editando Evento #${editIncidente.id}` : '➕ Registrar Evento de Pérdida'}
             </h3>
             {editIncidente && <button onClick={() => setEditIncidente(null)} className="text-xs text-red-500 font-bold hover:text-red-700">✖ Cancelar</button>}
          </div>
          <form onSubmit={handleIncidenteSubmit} key={editIncidente ? `edit-incidente-${editIncidente.id}-${formResetKey}` : `new-incidente-${formResetKey}`} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs shadow-sm">
            <input name="idRiesgo" defaultValue={editIncidente?.idRiesgo || ''} required placeholder="ID Riesgo Vinculado" className="border p-2 rounded" />
            <input name="titulo" defaultValue={editIncidente?.titulo || ''} required placeholder="Título del Evento" className="border p-2 rounded" />
            <input name="costo" type="number" defaultValue={editIncidente?.costo || ''} required placeholder="Monto de la Pérdida Financiera" className="border p-2 rounded" />
            <select name="impacto" defaultValue={editIncidente?.impacto || 'Bajo'} className="border p-2 bg-white rounded"><option>Bajo</option><option>Medio</option><option>Alto</option><option>Crítico</option></select>
            <textarea name="descripcion" defaultValue={editIncidente?.descripcion || ''} required placeholder="Descripción de la falla operacional..." className="border p-2 rounded md:col-span-4"></textarea>
            <div className="md:col-span-4 flex justify-end">
              <button type="submit" className="bg-[#004d40] text-white px-5 py-2 rounded font-bold hover:bg-[#003d33]">
                {editIncidente ? 'Actualizar Evento' : 'Registrar Evento'}
              </button>
            </div>
          </form>
        </div>
      )}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-900 text-white font-bold">
            <tr>
              <th className="p-3">ID <FilterInput colKey="id" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
              <th className="p-3">Riesgo ID <FilterInput colKey="idRiesgo" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
              <th className="p-3">Descripción <FilterInput colKey="titulo" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
              <th className="p-3">Impacto <FilterInput colKey="impacto" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
              <th className="p-3 text-right">Costo (COP)</th>
              {isAdmin && <th className="p-3 text-center">Acción</th>}
            </tr>
          </thead>
          <tbody className="divide-y text-slate-700">
            {applyFilters(incFiltrados, searchTerm, columnFilters).map(i => (
              <tr key={i.id}>
                <td className="p-3 text-slate-400">#INC-{i.id}</td>
                <td className="p-3 font-bold">#{i.idRiesgo}</td>
                <td className="p-3"><b>{i.titulo}</b><p className="text-[10px] text-slate-400 mt-0.5">{i.descripcion}</p></td>
                <td className="p-3"><span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold text-[9px]">{i.impacto}</span></td>
                <td className="p-3 text-right font-mono font-black text-red-600 notranslate" translate="no">${Number(i.costo || 0).toLocaleString('es-CO')}</td>
                {isAdmin && (
                  <td className="p-3 text-center whitespace-nowrap space-x-1">
                    <button onClick={() => {setEditIncidente(i); setFormResetKey(Date.now()); scrollToForm();}} className="bg-amber-100 text-amber-800 font-bold px-2 py-1 rounded text-[10px]">✏️ Editar</button>
                    <button onClick={() => handleDeleteItem('incidentes', i.id)} className="bg-red-50 text-red-700 font-bold px-2 py-1 rounded text-[10px]">🗑️</button>
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