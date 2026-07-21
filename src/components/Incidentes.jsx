import React, { useState } from 'react';
import { MAPA_PROCESOS } from '../constants/diccionariosGRC';
// 1. Importamos el componente reutilizable
import FileUploader from '../components/FileUploader';

// 🧠 Generador Automático: Construye la lista unificada leyendo el diccionario central
const PROCESOS_OFICIALES = Object.keys(MAPA_PROCESOS).reduce((acc, macro) => {
  acc.push(macro); // Añade el Macroproceso
  MAPA_PROCESOS[macro].forEach(sub => {
    if (sub !== 'General' && !acc.includes(sub)) {
      acc.push(`Subproceso ${sub.toLowerCase()}`); // Añade los Subprocesos formateados
    }
  });
  return acc;
}, []).sort();

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
  FilterInput,
  safeRiesgos = [] // Recibimos los riesgos desde el Dashboard (Main)
}) {

  // ☁️ URL del archivo subido
  const [archivoSubidoUrl, setArchivoSubidoUrl] = useState('');

  // Limpiar la URL de la evidencia cuando se inicia un nuevo registro
  React.useEffect(() => {
    if (!editIncidente) {
      setArchivoSubidoUrl('');
    }
  }, [editIncidente]);

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
            
            {/* Selector de Proceso (Homologado) */}
            <div className="md:col-span-2">
              <label className="font-bold text-gray-600 block mb-1">🏛️ Proceso Afectado</label>
              <select name="proceso" defaultValue={editIncidente?.proceso || ''} required className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-red-500 outline-none font-medium text-slate-800">
                <option value="">-- Seleccione un Proceso --</option>
                {PROCESOS_OFICIALES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Selector de Riesgo desde Matriz */}
            <div className="md:col-span-2">
              <label className="font-bold text-gray-600 block mb-1">🎯 Riesgo Vinculado</label>
              <select name="idRiesgo" defaultValue={editIncidente?.idRiesgo || ''} required className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-red-500 outline-none font-medium text-slate-800">
                <option value="">-- Seleccione un Riesgo de la Matriz --</option>
                {safeRiesgos.map((r, index) => (
                  <option key={`inc-riesgo-${r.id}-${index}`} value={r.id}>
                    RSG-{r.id} | {r.descripcion?.substring(0, 80)}...
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-4">
              <label className="font-bold text-gray-600 block mb-1">Título del Evento</label>
              <input name="titulo" defaultValue={editIncidente?.titulo || ''} required placeholder="Ej: Faltante en arqueo de caja menor..." className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" />
            </div>

            <div className="md:col-span-1">
              <label className="font-bold text-emerald-600 block mb-1">Monto Sobrante</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-emerald-600 font-black">$</span>
                <input name="montoSobrante" type="number" defaultValue={editIncidente?.montoSobrante || ''} required placeholder="0" className="w-full border p-2 pl-7 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-mono font-bold text-slate-700" />
              </div>
            </div>

            <div className="md:col-span-1">
              <label className="font-bold text-red-600 block mb-1">Monto Faltante</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-red-600 font-black">$</span>
                <input name="montoFaltante" type="number" defaultValue={editIncidente?.montoFaltante || ''} required placeholder="0" className="w-full border p-2 pl-7 rounded-lg focus:ring-2 focus:ring-red-500 outline-none font-mono font-bold text-slate-700" />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="font-bold text-gray-600 block mb-1">Nivel de Impacto</label>
              <select name="impacto" defaultValue={editIncidente?.impacto || 'Bajo'} className="w-full border p-2 bg-white rounded-lg focus:ring-2 focus:ring-red-500 outline-none">
                <option>Bajo</option><option>Medio</option><option>Alto</option><option>Crítico</option>
              </select>
            </div>

            <div className="md:col-span-4">
              <label className="font-bold text-gray-600 block mb-1">Descripción de la falla operacional</label>
              <textarea name="descripcion" defaultValue={editIncidente?.descripcion || ''} required placeholder="Detalle cómo ocurrió el evento..." className="w-full border p-2 rounded-lg" rows="3"></textarea>
            </div>

            {/* INPUT OCULTO: Inyecta la URL obtenida en el envío del formulario */}
            <input type="hidden" name="evidenciaUrlInput" value={archivoSubidoUrl || editIncidente?.evidenciaUrl || ''} />

            {/* ☁️ NUEVO COMPONENTE REUTILIZABLE DE SUBIDA */}
            <div className="md:col-span-4 mt-2">
              <FileUploader 
                label="Soporte del Evento (Evidencia)"
                subtext="Sube fotografías, actas o PDFs relacionados al evento de pérdida."
                fileUrl={archivoSubidoUrl || editIncidente?.evidenciaUrl}
                onUploadSuccess={(url) => setArchivoSubidoUrl(url)}
                themeColor="red"
                maxSizeMB={8}
                description="Soporte Evento de Pérdida GCM"
              />
            </div>

            <div className="md:col-span-4 flex justify-end mt-2">
              <button 
                type="submit" 
                className="bg-[#004d40] text-white px-6 py-2.5 rounded-lg font-bold hover:bg-[#003d33] transition-colors shadow-sm"
              >
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
              <th className="p-3 w-40">Proceso <FilterInput colKey="proceso" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
              <th className="p-3">Descripción <FilterInput colKey="titulo" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
              <th className="p-3 w-28">Impacto <FilterInput colKey="impacto" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
              <th className="p-3 text-right w-24">Sobrante</th>
              <th className="p-3 text-right w-24">Faltante</th>
              <th className="p-3 text-center w-24">Soporte</th>
              {isAdmin && <th className="p-3 text-center w-24">Acción</th>}
            </tr>
          </thead>
          <tbody className="divide-y text-slate-700">
            {applyFilters(incFiltrados, searchTerm, columnFilters).map(i => (
              <tr key={i.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-3">
                  <div className="text-slate-500 font-mono font-bold">#INC-{i.id}</div>
                  <div className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded mt-1 font-bold inline-block border border-slate-200">
                    RSG-{i.idRiesgo}
                  </div>
                </td>
                <td className="p-3 font-medium text-[10px] text-slate-500 leading-tight">
                  {i.proceso || 'Sin Proceso'}
                </td>
                <td className="p-3">
                  <div className="font-bold text-slate-800">{i.titulo}</div>
                  <div className="text-[10px] text-slate-500 mt-1 leading-relaxed">{i.descripcion}</div>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded font-black text-[9px] uppercase tracking-wider border ${
                    i.impacto === 'Crítico' ? 'bg-red-50 text-red-700 border-red-200' : 
                    i.impacto === 'Alto' ? 'bg-orange-50 text-orange-700 border-orange-200' : 
                    i.impacto === 'Medio' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                    'bg-slate-50 text-slate-700 border-slate-200'
                  }`}>
                    {i.impacto}
                  </span>
                </td>
                <td className="p-3 text-right font-mono font-black text-emerald-600 notranslate text-xs" translate="no">
                  ${Number(i.montoSobrante || 0).toLocaleString('es-CO')}
                </td>
                <td className="p-3 text-right font-mono font-black text-red-600 notranslate text-xs" translate="no">
                  ${Number(i.montoFaltante || 0).toLocaleString('es-CO')}
                </td>
                <td className="p-3 text-center">
                  {i.evidenciaUrl ? (
                    <a href={i.evidenciaUrl} target="_blank" rel="noreferrer" className="bg-blue-50 text-blue-700 font-bold px-2 py-1.5 rounded-lg text-[9px] hover:bg-blue-100 flex items-center justify-center space-x-1 transition-colors border border-blue-100 shadow-sm w-full">
                      <span>🔗</span><span>Soporte</span>
                    </a>
                  ) : (
                    <span className="text-[9px] text-slate-400 italic">No adjunto</span>
                  )}
                </td>
                {isAdmin && (
                  <td className="p-3 text-center space-y-1">
                    <button onClick={() => {setEditIncidente(i); setFormResetKey(Date.now()); scrollToForm();}} className="bg-amber-100 text-amber-800 font-bold px-2 py-1 rounded text-[10px] w-full hover:bg-amber-200">✏️ Editar</button>
                    <button onClick={() => handleDeleteItem('incidentes', i.id)} className="bg-red-50 text-red-700 font-bold px-2 py-1 rounded text-[10px] w-full hover:bg-red-100 border border-red-100">🗑️ Borrar</button>
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