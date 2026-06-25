import React from 'react';

export default function Hallazgos({
  isAdmin,
  editHallazgo,
  setEditHallazgo,
  handleHallazgoSubmit,
  setFormResetKey,
  scrollToForm,
  handleDeleteItem,
  applyFilters,
  hFiltrados,
  searchTerm,
  setSearchTerm,
  columnFilters,
  handleColFilterChange,
  FilterInput
}) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="border-b pb-4 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-slate-800">📄 Hallazgos y Desviaciones</h2>
          <p className="text-xs text-slate-500 font-bold mt-1">Gestión de auditorías y no conformidades encontradas.</p>
        </div>
      </div>

      {/* 🔓 EL FORMULARIO YA NO TIENE CANDADO */}
      <div id="edit-form" className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-6">
        <div className="flex justify-between items-center border-b pb-3">
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">{editHallazgo ? `✏️ Editando Hallazgo: ${editHallazgo.ref}` : '➕ DOCUMENTAR NUEVA DESVIACIÓN'}</h3>
          {editHallazgo && <button onClick={() => setEditHallazgo(null)} className="text-xs text-slate-500 hover:text-red-600 font-bold">✖ Cancelar Edición</button>}
        </div>

        <form onSubmit={handleHallazgoSubmit} key={editHallazgo?.id || 'nuevo-hallazgo'} className="grid grid-cols-1 md:grid-cols-4 gap-5 text-xs">
          <div><label className="font-bold text-gray-600 block mb-1">ID / Código (Manual)</label><input name="ref" defaultValue={editHallazgo?.ref||''} required placeholder="Ej: HAL-2026-01" className="w-full border border-slate-300 rounded-lg p-2" /></div>
          <div><label className="font-bold text-gray-600 block mb-1">Sede</label><select name="sede" defaultValue={editHallazgo?.sede||'Hotel'} className="w-full border border-slate-300 rounded-lg p-2 bg-white"><option>Hotel</option><option>Ecoparque</option><option>Administrativo</option></select></div>
          <div><label className="font-bold text-gray-600 block mb-1">Proceso Auditado</label><input name="proceso" defaultValue={editHallazgo?.proceso||''} required className="w-full border border-slate-300 rounded-lg p-2" /></div>
          <div><label className="font-bold text-gray-600 block mb-1">Severidad</label><select name="severidad" defaultValue={editHallazgo?.severidad||'Medio'} className="w-full border border-slate-300 rounded-lg p-2 bg-white"><option>Bajo</option><option>Medio</option><option>Alto</option><option>Crítico</option></select></div>
          
          <div><label className="font-bold text-gray-600 block mb-1">Auditor Responsable</label><input name="auditor" defaultValue={editHallazgo?.auditor||''} required placeholder="Quien levantó el hallazgo" className="w-full border border-slate-300 rounded-lg p-2" /></div>
          <div><label className="font-bold text-gray-600 block mb-1">Dueño del Proceso</label><input name="responsable" defaultValue={editHallazgo?.responsable||''} required placeholder="Responsable a cargo" className="w-full border border-slate-300 rounded-lg p-2" /></div>
          <div className="md:col-span-2">
            <label className="font-bold text-gray-600 block mb-1">Título / Descripción de la Falla</label>
            <input name="titulo" defaultValue={editHallazgo?.titulo||''} required placeholder="Describa el hallazgo brevemente..." className="w-full border border-slate-300 rounded-lg p-2" />
          </div>            
          <div className="md:col-span-4 bg-rose-50/50 p-4 rounded-xl border border-rose-100 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 border-b border-rose-100 pb-3">
              <div>
                <label className="font-black text-rose-800 uppercase tracking-widest text-[10px]">Paso 1: Busca y copia el enlace de soporte</label>
                <p className="text-[9px] text-rose-600 font-medium mt-0.5">Ve a tu nube, busca el archivo del informe o foto, haz clic en "Compartir" y copia el link.</p>
              </div>
              <div className="flex space-x-2 mt-2 md:mt-0">
                <a href="https://drive.google.com" target="_blank" rel="noreferrer" className="text-[10px] bg-white border border-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-lg shadow-sm hover:bg-slate-50 transition-all flex items-center space-x-1"><span>📁</span><span>Ir a Drive</span></a>
                <a href="https://onedrive.live.com" target="_blank" rel="noreferrer" className="text-[10px] bg-white border border-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-lg shadow-sm hover:bg-slate-50 transition-all flex items-center space-x-1"><span>☁️</span><span>Ir a OneDrive</span></a>
              </div>
            </div>
            <div>
              <label className="font-black text-rose-800 uppercase tracking-widest text-[10px] block mb-1.5">Paso 2: Pega el enlace de la evidencia aquí</label>
              <input type="url" name="evidenciaUrlInput" defaultValue={editHallazgo?.evidenciaUrl||''} placeholder="Ej: https://drive.google.com/file/d/1a2b3c..." className="w-full border border-rose-200 bg-white rounded-lg p-2.5 text-xs shadow-inner focus:ring-2 focus:ring-rose-500 outline-none transition-all" />
            </div>
            {editHallazgo?.