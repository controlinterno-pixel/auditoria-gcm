import React, { useState } from 'react';

export default function InformesAuditoria({ 
  informesAuditoria, 
  setInformesAuditoria, 
  editInformeAuditoria, 
  setEditInformeAuditoria, 
  isAdmin, 
  searchTerm, 
  setSearchTerm, 
  columnFilters, 
  setColumnFilters, 
  handleColFilterChange, 
  exportToExcel, 
  handleInformeAuditoriaSubmit, 
  isSubmitting, 
  setFormResetKey, 
  formResetKey, 
  scrollToForm, 
  handleDeleteItem, 
  applyFilters, 
  FilterInput 
}) {
  const safeInformes = Array.isArray(informesAuditoria) ? informesAuditoria : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="border-b pb-4 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-slate-800">📁 Repositorio de Informes Emitidos</h2>
          <p className="text-xs text-slate-500 font-bold mt-1">Archivo formal de dictámenes, consecutivos, actas de socialización y distribución electrónica.</p>
        </div>
        <div className="flex space-x-3">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
            <input type="text" placeholder="Buscar informe..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 pr-4 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#004d40] w-64 shadow-sm" />
          </div>
          <button onClick={() => exportToExcel(safeInformes, 'Historico_Informes_Auditoria')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition-colors">📥 Exportar</button>
        </div>
      </div>

      {isAdmin && (
        <div id="edit-form" className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">{editInformeAuditoria ? `✏️ Editando Flujo de Informe: ${editInformeAuditoria.ref}` : '➕ Archivar, Radicar y Distribuir Nuevo Informe'}</h3>
          <form onSubmit={handleInformeAuditoriaSubmit} key={editInformeAuditoria?.id || 'nuevo-informe-form'} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            
            <div className="md:col-span-2"><label className="font-bold text-gray-600 block mb-1">Título del Informe Formal</label><input name="titulo" defaultValue={editInformeAuditoria?.titulo||''} required placeholder="Ej: Auditoría de Cumplimiento a Cadena de Suministros" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none font-bold text-slate-800" /></div>
            <div><label className="font-bold text-gray-600 block mb-1">Proceso Auditado</label><input name="proceso" defaultValue={editInformeAuditoria?.proceso||''} required placeholder="Ej: Compras / Finanzas" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none font-bold" /></div>
            <div><label className="font-bold text-gray-600 block mb-1">Fecha de Emisión</label><input name="fecha" type="date" defaultValue={editInformeAuditoria?.fecha||''} required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none" /></div>
            
            <div><label className="font-bold text-gray-600 block mb-1">✍️ Elaborado Por (Auditor)</label><input name="elaboradoPor" defaultValue={editInformeAuditoria?.elaboradoPor||''} required placeholder="Nombre del auditor" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none" /></div>
            <div><label className="font-bold text-gray-600 block mb-1">🔍 Revisado Por (Líder)</label><input name="revisadoPor" defaultValue={editInformeAuditoria?.revisadoPor||''} required placeholder="Nombre de quien revisó" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none" /></div>
            <div><label className="font-bold text-gray-600 block mb-1">🔒 Aprobado Por (Gerencia)</label><input name="aprobadoPor" defaultValue={editInformeAuditoria?.aprobadoPor||''} required placeholder="Nombre de quien aprobó" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none" /></div>
            <div><label className="font-bold text-gray-600 block mb-1">📢 ¿Fue Socializado?</label><select name="socializado" defaultValue={editInformeAuditoria?.socializado||'No'} className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#004d40] outline-none font-bold"><option>No</option><option>Sí</option></select></div>
            
            <div className="md:col-span-4"><label className="font-bold text-gray-600 block mb-1">Participantes de la Socialización (Líderes y convocados)</label><input name="socializadoCon" defaultValue={editInformeAuditoria?.socializadoCon||''} placeholder="Ej: Comité de Auditoría, Gerencia General, Jefe de Compras..." className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none" /></div>

            <div className="md:col-span-4 bg-blue-50 border border-blue-200 p-4 rounded-xl shadow-inner">
              <label className="font-black text-blue-900 block mb-1 uppercase tracking-wider text-[10px]">📧 Distribución por Correo Electrónico (Notificación Inmediata)</label>
              <input name="correosNotificacionInput" type="text" placeholder="Ej: gerente@termales.com.co, compras@termales.com.co (Separa los correos por comas)" className="w-full border border-blue-300 bg-white rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-slate-700" />
              <p className="text-[9px] text-blue-600 mt-1 font-medium">Al guardar, el sistema enviará automáticamente una copia digitalizada del informe y su acta a los destinatarios configurados.</p>
            </div>

            <div className="md:col-span-4 bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-inner grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 flex justify-between items-center border-b pb-2 border-slate-200">
                <div>
                  <label className="font-black text-slate-700 uppercase tracking-widest text-[10px]">Gestor de Evidencias Digitales</label>
                  <p className="text-[9px] text-slate-500 font-medium">Sube los soportes a tu repositorio corporativo institucional y pega sus links públicos.</p>
                </div>
                <div className="flex space-x-2">
                  <a href="https://drive.google.com" target="_blank" rel="noreferrer" className="text-[10px] bg-white border border-slate-200 text-slate-700 font-bold px-3 py-1 rounded-lg shadow-sm hover:bg-slate-50">📁 Drive</a>
                  <a href="https://onedrive.live.com" target="_blank" rel="noreferrer" className="text-[10px] bg-white border border-slate-200 text-slate-700 font-bold px-3 py-1 rounded-lg shadow-sm hover:bg-slate-50">☁ OneDrive</a>
                </div>
              </div>
              <div>
                <label className="font-black text-slate-700 uppercase tracking-widest text-[10px] block mb-1.5">📄 Link del Informe Final (PDF)</label>
                <input type="url" name="evidenciaUrlInput" defaultValue={editInformeAuditoria?.evidenciaUrl||''} required placeholder="https://drive.google.com/..." className="w-full border border-slate-300 bg-white rounded-lg p-2 text-xs shadow-sm focus:ring-2 focus:ring-[#004d40] outline-none" />
              </div>
              <div>
                <label className="font-black text-purple-800 uppercase tracking-widest text-[10px] block mb-1.5">🤝 Link del Acta de Socialización</label>
                <input type="url" name="actaSocializacionUrlInput" defaultValue={editInformeAuditoria?.actaSocializacionUrl||''} placeholder="https://drive.google.com/..." className="w-full border border-purple-300 bg-white rounded-lg p-2 text-xs shadow-sm focus:ring-2 focus:ring-purple-500 outline-none" />
              </div>
            </div>

            <div className="md:col-span-4 flex justify-end">
              <button type="submit" disabled={isSubmitting} className={`font-black uppercase tracking-widest px-8 py-3 rounded-xl shadow-md transition-all w-full md:w-auto text-center block ${isSubmitting ? 'bg-slate-400 text-slate-100 cursor-not-allowed' : 'bg-[#004d40] hover:bg-[#003d33] text-white cursor-pointer'}`}>
                {isSubmitting ? '⏳ Procesando...' : (editInformeAuditoria ? 'Guardar Cambios' : 'Radicar, Archivar y Enviar Dictamen')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border rounded-3xl overflow-hidden shadow-sm">
        <table className="w-full text-xs text-left divide-y">
          <thead className="bg-slate-900 text-white font-bold text-[10px] uppercase">
            <tr>
              <th className="p-4 w-28">
                <div>Consecutivo</div>
                <FilterInput colKey="ref" placeholder="Filtrar..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
              </th>
              <th className="p-4">
                <div>Proceso / Título</div>
                <FilterInput colKey="proceso" placeholder="Filtrar Proceso..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
              </th>
              <th className="p-4">Trazabilidad de Firmas</th>
              <th className="p-4">Socialización e Impacto</th>
              <th className="p-4 text-center">Documentos Custodiados</th>
            </tr>
          </thead>
          <tbody className="divide-y text-slate-700 bg-white">
            {applyFilters(safeInformes, searchTerm, columnFilters).map((inf, idx) => (
              <tr key={`inf-row-${inf.id}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                <td className="p-4 font-mono font-black text-sm text-slate-800 bg-slate-50/50">{inf.ref || `INF-2026-${String(idx+1).padStart(3, '0')}`}</td>
                <td className="p-4">
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-100 font-black rounded uppercase text-[9px] tracking-wider mb-1 inline-block">{inf.proceso}</span>
                  <div className="font-bold text-slate-900 text-sm">{inf.titulo}</div>
                  <div className="text-[9px] text-slate-400 font-medium mt-1">Emitido el: {inf.fecha}</div>
                </td>
                <td className="p-4">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1 text-[10px] font-medium text-slate-600">
                    <div><span className="text-slate-400 font-bold">✍ ELABORÓ:</span> <span className="font-black text-slate-800">{inf.elaboradoPor}</span></div>
                    <div><span className="text-slate-400 font-bold">🔍 REVISÓ:</span> <span className="font-black text-slate-800">{inf.revisadoPor}</span></div>
                    <div><span className="text-slate-400 font-bold">🔒 APROBÓ:</span> <span className="font-black text-slate-800">{inf.aprobadoPor}</span></div>
                  </div>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-widest border inline-block mb-1.5 ${inf.socializado === 'Sí' ? 'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-amber-50 text-amber-700 border-amber-200'}`}>📢 Socializado: {inf.socializado}</span>
                  <div className="text-[10px] text-slate-500 font-semibold leading-relaxed">Con: {inf.socializadoCon}</div>
                </td>
                <td className="p-4 text-center space-y-1.5">
                  <a href={inf.evidenciaUrl} target="_blank" rel="noreferrer" className="bg-blue-50 text-blue-700 font-black px-3 py-1.5 rounded-xl text-[10px] hover:bg-blue-100 flex items-center justify-center space-x-1 border border-blue-100 shadow-sm transition-all w-full">
                    <span>📄</span><span>Ver Informe Final</span>
                  </a>
                  {inf.actaSocializacionUrl ? (
                    <a href={inf.actaSocializacionUrl} target="_blank" rel="noreferrer" className="bg-purple-50 text-purple-700 font-black px-3 py-1.5 rounded-xl text-[10px] hover:bg-purple-100 flex items-center justify-center space-x-1 border border-purple-100 shadow-sm transition-all w-full">
                      <span>🤝</span><span>Ver Acta Socialización</span>
                    </a>
                  ) : (
                    <div className="text-[9px] text-slate-400 italic bg-slate-50 py-1 rounded border border-dashed text-center">Sin Acta Cargada</div>
                  )}
                  {isAdmin && (
                    <div className="flex justify-center items-center space-x-2 pt-1">
                      <button onClick={() => {setEditInformeAuditoria(inf); setFormResetKey(Date.now()); scrollToForm();}} className="text-orange-500 hover:text-orange-700 text-xs font-bold">✏ Editar</button>
                      <span className="text-slate-200">|</span>
                      <button onClick={() => handleDeleteItem('informesAuditoria', inf.id)} className="text-slate-400 hover:text-red-600 text-xs font-bold">🗑 Eliminar</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}