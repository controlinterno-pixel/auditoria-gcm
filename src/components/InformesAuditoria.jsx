import React from 'react';

export default function InformesAuditoria({ 
  informesAuditoria, 
  editInformeAuditoria, 
  setEditInformeAuditoria, 
  isAdmin, 
  searchTerm, 
  setSearchTerm, 
  columnFilters, 
  handleColFilterChange, 
  exportToExcel, 
  handleInformeAuditoriaSubmit, 
  isSubmitting, 
  setFormResetKey, 
  scrollToForm, 
  handleDeleteItem, 
  applyFilters, 
  FilterInput 
}) {
  const safeInformes = Array.isArray(informesAuditoria) ? informesAuditoria : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 📋 CABECERA */}
      <div className="border-b pb-4 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-slate-800">📁 Repositorio de Informes Emitidos</h2>
          <p className="text-xs text-slate-500 font-bold mt-1">
            Archivo formal de dictámenes, consecutivos, actas de socialización y distribución electrónica.
          </p>
        </div>
        <div className="flex space-x-3">
          <button 
            type="button"
            onClick={() => exportToExcel(safeInformes, 'Historico_Informes_Auditoria')} 
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2 rounded-xl text-xs shadow-md transition-colors flex items-center space-x-1.5"
          >
            <span>📊</span>
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* 🔍 BÚSQUEDA GLOBAL */}
      <div className="bg-white p-4 rounded-2xl border shadow-sm flex items-center space-x-3">
        <span className="text-slate-400 text-lg">🔍</span>
        <input
          type="text"
          placeholder="Buscar informe..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full text-sm outline-none bg-transparent text-slate-700 font-medium placeholder-slate-400"
        />
      </div>

      {/* 📊 TABLA */}
      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-bold text-[10px] uppercase tracking-wider">
                <th className="p-4 w-32">Consecutivo</th>
                <th className="p-4">Proceso / Título</th>
                <th className="p-4">Trazabilidad de Firmas</th>
                <th className="p-4">Socialización e Impacto</th>
                <th className="p-4 text-center w-56">Documentos Custodiados</th>
              </tr>
              {/* FILTROS INTEGRADOS POR COLUMNA */}
              <tr className="bg-slate-100">
                <td className="p-2">
                  <FilterInput colKey="ref" placeholder="Filtrar..." dark={false} columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </td>
                <td className="p-2">
                  <FilterInput colKey="proceso" placeholder="Filtrar proceso..." dark={false} columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </td>
                <td className="p-2"></td>
                <td className="p-2"></td>
                <td className="p-2 bg-slate-50"></td>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
              {applyFilters(safeInformes, searchTerm, columnFilters).length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-slate-400 font-bold italic">
                    No se encontraron informes con los criterios de búsqueda.
                  </td>
                </tr>
              ) : (
                applyFilters(safeInformes, searchTerm, columnFilters).map((inf, idx) => (
                  <tr key={`inf-row-${inf.id || idx}`} className="hover:bg-slate-50/50 transition-colors">
                    {/* CONSECUTIVO */}
                    <td className="p-4 font-mono font-black text-sm text-slate-800 bg-slate-50/50">
                      {inf.ref || `INF-2026-${String(idx + 1).padStart(3, '0')}`}
                    </td>

                    {/* PROCESO / TÍTULO */}
                    <td className="p-4">
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-100 font-black rounded uppercase text-[9px] tracking-wider mb-1 inline-block">
                        {inf.proceso}
                      </span>
                      <div className="font-bold text-slate-900 text-sm leading-tight">{inf.titulo}</div>
                      <div className="text-[9px] text-slate-400 font-medium mt-1">Emitido el: {inf.fecha}</div>
                    </td>

                    {/* TRAZABILIDAD */}
                    <td className="p-4">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1 text-[10px] font-medium text-slate-600">
                        <div><span className="text-slate-400 font-bold">✍ ELABORÓ:</span> <span className="font-black text-slate-800">{inf.elaboradoPor}</span></div>
                        <div><span className="text-slate-400 font-bold">🔍 REVISÓ:</span> <span className="font-black text-slate-800">{inf.revisadoPor}</span></div>
                        <div><span className="text-slate-400 font-bold">🔒 APROBÓ:</span> <span className="font-black text-slate-800">{inf.aprobadoPor}</span></div>
                      </div>
                    </td>

                    {/* SOCIALIZACIÓN */}
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-widest border inline-block mb-1.5 ${
                        inf.socializado === 'Sí' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        📢 Socializado: {inf.socializado || 'No'}
                      </span>
                      {inf.socializadoCon && (
                        <div className="text-[10px] text-slate-500 font-semibold leading-relaxed">Con: {inf.socializadoCon}</div>
                      )}
                    </td>

                    {/* ACCIONES DIRECTAS SIN CENTRO EJECUTIVO NI GALERÍAS */}
                    <td className="p-4 text-center space-y-1.5 align-middle">
                      <a 
                        href={inf.evidenciaUrl || "#"} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="bg-blue-50 text-blue-700 font-black px-3 py-2 rounded-xl text-[10px] hover:bg-blue-100 flex items-center justify-center space-x-1 border border-blue-100 shadow-sm transition-all w-full"
                      >
                        <span>📄</span>
                        <span>Ver Informe Final</span>
                      </a>

                      {inf.actaSocializacionUrl ? (
                        <a 
                          href={inf.actaSocializacionUrl} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="bg-purple-50 text-purple-700 font-black px-3 py-2 rounded-xl text-[10px] hover:bg-purple-100 flex items-center justify-center space-x-1 border border-purple-100 shadow-sm transition-all w-full"
                        >
                          <span>🤝</span>
                          <span>Ver Acta Socialización</span>
                        </a>
                      ) : (
                        <div className="text-[9px] text-slate-400 italic bg-slate-50 py-1.5 rounded border border-dashed text-center">
                          Sin Acta Cargada
                        </div>
                      )}

                      {isAdmin && (
                        <div className="flex justify-center items-center space-x-2 pt-2 border-t mt-2">
                          <button 
                            type="button"
                            onClick={() => { setEditInformeAuditoria(inf); setFormResetKey(Date.now()); scrollToForm(); }} 
                            className="text-orange-500 hover:text-orange-700 text-xs font-bold"
                          >
                            ✏ Editar
                          </button>
                          <span className="text-slate-200">|</span>
                          <button 
                            type="button"
                            onClick={() => handleDeleteItem('informesAuditoria', inf.id)} 
                            className="text-slate-400 hover:text-red-600 text-xs font-bold"
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