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
      {/* 📋 CABECERA PRINCIPAL */}
      <div className="border-b pb-4 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-slate-800">📁 Repositorio de Informes Emitidos</h2>
          <p className="text-xs text-slate-500 font-bold mt-1">
            Archivo formal de dictámenes, consecutivos, actas de socialización y distribución electrónica.
          </p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={exportToExcel} 
            className="bg-emerald-50 text-emerald-700 font-black px-4 py-2 rounded-xl text-xs hover:bg-emerald-100 transition-colors border border-emerald-200 shadow-sm flex items-center space-x-1.5"
          >
            <span>📊</span>
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* 🔍 BARRA DE BÚSQUEDA GLOBAL */}
      <div className="bg-white p-4 rounded-2xl border shadow-sm flex items-center space-x-3">
        <span className="text-slate-400 text-lg">🔍</span>
        <input
          type="text"
          placeholder="Buscar informe por consecutivo, proceso, auditor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full text-sm outline-none bg-transparent text-slate-700 font-medium placeholder-slate-400"
        />
      </div>

      {/* 📊 TABLA DE CONTENIDO PRINCIPAL */}
      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-black uppercase tracking-wider text-slate-500">
                <th className="p-4 w-48">Consecutivo / Dictamen</th>
                <th className="p-4">Proceso Auditado</th>
                <th className="p-4">Detalles de Control</th>
                <th className="p-4 text-center w-52">Acciones / Informe Adjunto</th>
              </tr>
              {/* FILTROS POR COLUMNA */}
              <tr className="bg-slate-50/30 border-b border-slate-100">
                <td className="p-2">{FilterInput('consecutivo', 'Filtrar...')}</td>
                <td className="p-2">{FilterInput('proceso', 'Filtrar...')}</td>
                <td className="p-2">{FilterInput('auditor', 'Filtrar...')}</td>
                <td className="p-2 bg-slate-50/10"></td>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {applyFilters(safeInformes).length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-12 text-center text-slate-400 font-bold italic">
                    ❌ No se encontraron informes emitidos con los filtros actuales.
                  </td>
                </tr>
              ) : (
                applyFilters(safeInformes).map((inf) => (
                  <tr key={inf.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* CONSECUTIVO Y FECHAS */}
                    <td className="p-4 align-top">
                      <div className="font-black text-slate-900 leading-tight text-xs bg-slate-100 px-2.5 py-1.5 rounded-xl border inline-block mb-1">
                        {inf.consecutivo}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold mt-1.5 flex items-center space-x-1">
                        <span>📅 Emitido:</span>
                        <span className="text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                          {inf.fechaEmision || 'Sin fecha'}
                        </span>
                      </div>
                    </td>

                    {/* PROCESO AUDITADO */}
                    <td className="p-4 align-top">
                      <div className="font-extrabold text-slate-800 leading-snug">{inf.proceso}</div>
                      <div className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wide">
                        👤 Auditor: <span className="text-slate-600 normal-case font-extrabold">{inf.auditor}</span>
                      </div>
                    </td>

                    {/* DETALLES Y ESTADOS */}
                    <td className="p-4 align-top space-y-1.5">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className={`px-2.5 py-0.5 rounded-full font-black text-[9px] uppercase tracking-widest border inline-block ${
                          inf.estado === 'Emitido' || inf.estado === 'EMITIDO Y SOCIALIZADO'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {inf.estado || 'Emitido'}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full font-black text-[9px] uppercase tracking-widest border inline-block ${
                          inf.socializado === 'Sí' 
                            ? 'bg-blue-50 text-blue-700 border-blue-200' 
                            : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}>
                          📢 Socializado: {inf.socializado || 'No'}
                        </span>
                      </div>
                    </td>

                    {/* ACCIONES LIMPIAS (BOTÓN DIRECTO AL INFORME ADJUNTO) */}
                    <td className="p-4 text-center space-y-2 align-middle">
                      {/* 📄 ENLACE AL INFORME TÉCNICO PDF ADJUNTO */}
                      <a 
                        href={inf.informeFinalUrl || "#"} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="bg-emerald-600 text-white font-black px-4 py-2.5 rounded-xl text-[10px] hover:bg-emerald-700 flex items-center justify-center space-x-1.5 shadow-md transition-all w-full uppercase tracking-wider"
                      >
                        <span>📄</span>
                        <span>Ver Informe Final</span>
                      </a>

                      {/* 🤝 ENLACE AL ACTA DE SOCIALIZACIÓN */}
                      {inf.actaSocializacionUrl ? (
                        <a 
                          href={inf.actaSocializacionUrl} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="bg-purple-50 text-purple-700 font-black px-3 py-2 rounded-xl text-[10px] hover:bg-purple-100 flex items-center justify-center space-x-1 border border-purple-100 shadow-sm transition-all w-full uppercase tracking-wider"
                        >
                          <span>🤝</span>
                          <span>Ver Acta Socialización</span>
                        </a>
                      ) : (
                        <div className="text-[9px] text-slate-400 italic bg-slate-50 py-1.5 rounded border border-dashed text-center">
                          Sin Acta Cargada
                        </div>
                      )}

                      {/* 🛠️ CONTROLES EDICIÓN / ELIMINACIÓN */}
                      {isAdmin && (
                        <div className="flex justify-center items-center space-x-2 pt-2 border-t mt-2">
                          <button 
                            onClick={() => { setEditInformeAuditoria(inf); setFormResetKey(Date.now()); scrollToForm(); }} 
                            className="text-orange-500 hover:text-orange-700 text-xs font-bold transition-colors"
                          >
                            ✏ Editar
                          </button>
                          <span className="text-slate-200">|</span>
                          <button 
                            onClick={() => handleDeleteItem('informesAuditoria', inf.id)} 
                            className="text-slate-400 hover:text-red-600 text-xs font-bold transition-colors"
                          >
                            🗑 Eliminar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}