import React, { useState } from 'react';

export default function InformesAuditoria({ 
  informesAuditoria, 
  setInformesAuditoria, 
  editInformeAuditoria, 
  setEditInformeAuditoria, 
  isAdmin, 
  user,
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
  FilterInput,
  safeHallazgos = [],
  safePlanes = [],
  formatSafeDate = (d) => d
}) {
  const safeInformes = Array.isArray(informesAuditoria) ? informesAuditoria : [];
  
  const [viewMode, setViewMode] = useState('list'); 
  const [selectedInforme, setSelectedInforme] = useState(null);
  const [activeTab, setActiveTab] = useState('resumen');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const abrirCentroEjecutivo = (informe) => {
    setSelectedInforme(informe);
    setViewMode('executive');
    setActiveTab('resumen');
  };

  const generarPDFEjecutivo = async () => {
    alert("Pronto activaremos el motor HTML2Canvas aquí en el Paso 3. Por ahora, ¡llena los datos!");
  };

  if (viewMode === 'executive' && selectedInforme) {
    const hInfo = safeHallazgos.filter(h => String(h.idInforme) === String(selectedInforme.id));
    const hCrit = hInfo.filter(h => h.severidad === 'Crítico' || h.severidad === 'Alto').length;
    const idsH = hInfo.map(h => h.id);
    const pInfo = safePlanes.filter(p => idsH.includes(p.idHallazgo));
    const avance = pInfo.length > 0 ? Math.round(pInfo.reduce((a, b) => a + (b.progreso||0), 0) / pInfo.length) : 0;

    return (
      <div className="space-y-6 animate-in slide-in-from-right-8 duration-500">
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <button onClick={() => setViewMode('list')} className="text-slate-500 hover:text-slate-800 font-bold flex items-center space-x-2 transition-colors">
            <span>←</span> <span>Volver a Formulario de Registro</span>
          </button>
          <div className="flex space-x-3">
            <button onClick={generarPDFEjecutivo} disabled={isGeneratingPdf} className="bg-[#0A3B32] hover:bg-[#062620] text-white px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center space-x-2 shadow-md transition-all">
              <span>{isGeneratingPdf ? '⏳' : '📥'}</span> <span>{isGeneratingPdf ? 'Generando...' : 'Descargar PDF Ejecutivo'}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-1/3 shrink-0">
            <div className="bg-gradient-to-b from-[#0A3B32] to-[#115e59] rounded-3xl shadow-xl overflow-hidden text-white p-8 aspect-[1/1.4] flex flex-col justify-between relative border-4 border-white ring-1 ring-slate-200">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
              <div>
                <div className="flex items-center space-x-3 mb-10">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-2xl shadow-inner">💧</div>
                  <div><h2 className="text-lg font-black leading-none tracking-tight">TERMALES</h2><p className="text-[10px] text-emerald-200 font-bold">Santa Rosa de Cabal</p></div>
                </div>
                <h3 className="text-3xl font-black leading-tight mb-2">INFORME DE<br/>AUDITORÍA<br/><span className="text-emerald-400">INTERNA</span></h3>
                <p className="text-xl font-mono font-black text-white/90 mb-4">{selectedInforme.ref}</p>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-100 bg-black/20 inline-block px-3 py-1 rounded-lg border border-white/10">{selectedInforme.proceso}</p>
              </div>
              <div className="space-y-4">
                <div className="bg-black/20 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-widest">Estado</span>
                    <span className="text-[10px] font-black bg-emerald-500 px-2 py-0.5 rounded text-white shadow-sm uppercase">{selectedInforme.socializado === 'Sí' ? 'SOCIALIZADO' : 'EMITIDO'}</span>
                  </div>
                  <p className="text-xs font-medium"><span className="text-emerald-200/70">Emisión:</span> {formatSafeDate(selectedInforme.fecha)}</p>
                  <p className="text-xs font-medium mt-1"><span className="text-emerald-200/70">Auditor:</span> {selectedInforme.elaboradoPor}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:w-2/3 flex flex-col space-y-4">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
              <h2 className="text-xl font-black text-slate-800">{selectedInforme.titulo}</h2>
              <div className="flex items-center space-x-4 mt-3 border-t border-slate-100 pt-3">
                 <button onClick={() => setActiveTab('resumen')} className={`text-xs font-bold uppercase tracking-widest pb-1 border-b-2 transition-colors ${activeTab === 'resumen' ? 'border-[#0A3B32] text-[#0A3B32]':'border-transparent text-slate-400 hover:text-slate-600'}`}>📄 Resumen Ejecutivo</button>
                 <button onClick={() => setActiveTab('hallazgos')} className={`text-xs font-bold uppercase tracking-widest pb-1 border-b-2 transition-colors ${activeTab === 'hallazgos' ? 'border-[#0A3B32] text-[#0A3B32]':'border-transparent text-slate-400 hover:text-slate-600'}`}>⚠️ Hallazgos ({hInfo.length})</button>
                 <button onClick={() => setActiveTab('planes')} className={`text-xs font-bold uppercase tracking-widest pb-1 border-b-2 transition-colors ${activeTab === 'planes' ? 'border-[#0A3B32] text-[#0A3B32]':'border-transparent text-slate-400 hover:text-slate-600'}`}>✅ Planes ({pInfo.length})</button>
                 <button onClick={() => setActiveTab('firmas')} className={`text-xs font-bold uppercase tracking-widest pb-1 border-b-2 transition-colors ${activeTab === 'firmas' ? 'border-[#0A3B32] text-[#0A3B32]':'border-transparent text-slate-400 hover:text-slate-600'}`}>✍️ Firmas y Actas</button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex-1 overflow-y-auto">
              {activeTab === 'resumen' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-center"><p className="text-[10px] font-black uppercase text-slate-500 mb-1">Hallazgos</p><p className="text-3xl font-black text-slate-800">{hInfo.length}</p></div>
                    <div className="bg-red-50 border border-red-100 p-4 rounded-2xl text-center"><p className="text-[10px] font-black uppercase text-red-600 mb-1">Críticos</p><p className="text-3xl font-black text-red-600">{hCrit}</p></div>
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl text-center"><p className="text-[10px] font-black uppercase text-blue-700 mb-1">Planes Asignados</p><p className="text-3xl font-black text-blue-700">{pInfo.length}</p></div>
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-center"><p className="text-[10px] font-black uppercase text-emerald-700 mb-1">Cumplimiento</p><p className="text-3xl font-black text-emerald-600">{avance}%</p></div>
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-800 mb-2 border-b pb-1">Conclusión General</h4>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{selectedInforme.conclusion || 'No se redactó una conclusión para este informe.'}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-800 mb-2 border-b pb-1">Fortalezas Observadas</h4>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{selectedInforme.fortalezas || 'No se detallaron fortalezas.'}</p>
                  </div>
                </div>
              )}
              {activeTab === 'hallazgos' && (
                <div className="space-y-4 animate-in fade-in">
                  {hInfo.length === 0 ? <p className="text-sm text-slate-500 italic">No hay hallazgos registrados.</p> : 
                    hInfo.map((h, i) => (
                      <div key={i} className="bg-slate-50 p-4 rounded-xl border flex justify-between items-start">
                        <div><span className="text-[10px] font-black bg-slate-800 text-white px-2 py-0.5 rounded">{h.ref}</span><h4 className="text-sm font-bold mt-2">{h.titulo}</h4></div>
                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase border ${h.severidad==='Crítico'?'bg-red-100 text-red-700':'bg-amber-100 text-amber-700'}`}>{h.severidad}</span>
                      </div>
                    ))}
                </div>
              )}
              {activeTab === 'planes' && (
                <div className="space-y-4 animate-in fade-in">
                  {pInfo.length === 0 ? <p className="text-sm text-slate-500 italic">No hay planes vinculados.</p> : 
                    pInfo.map((p, i) => (
                      <div key={i} className="bg-slate-50 p-4 rounded-xl border flex items-center justify-between">
                         <div className="flex-1"><p className="text-xs font-bold">{p.accion}</p><p className="text-[10px] text-slate-500 mt-1">Resp: {p.responsable}</p></div>
                         <div className="w-24 text-center border-l pl-4"><p className="text-xl font-black text-blue-600">{p.progreso||0}%</p></div>
                      </div>
                    ))}
                </div>
              )}
              {activeTab === 'firmas' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="border rounded-xl p-4 text-center"><p className="text-[10px] font-black uppercase text-slate-400 mb-4">Elaborado Por</p><div className="h-10 border-b border-dashed mx-6 mb-2"></div><p className="text-sm font-bold">{selectedInforme.elaboradoPor || 'N/A'}</p></div>
                    <div className="border rounded-xl p-4 text-center"><p className="text-[10px] font-black uppercase text-slate-400 mb-4">Revisado Por</p><div className="h-10 border-b border-dashed mx-6 mb-2"></div><p className="text-sm font-bold">{selectedInforme.revisadoPor || 'N/A'}</p></div>
                    <div className="border rounded-xl p-4 text-center"><p className="text-[10px] font-black uppercase text-slate-400 mb-4">Aprobado Por</p><div className="h-10 border-b border-dashed mx-6 mb-2"></div><p className="text-sm font-bold">{selectedInforme.aprobadoPor || 'N/A'}</p></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // VISTA 2: FORMULARIO Y LISTADO
  // ============================================================================
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
            <input type="text" placeholder="Buscar informe..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 pr-4 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#0A3B32] w-64 shadow-sm" />
          </div>
          <button onClick={() => exportToExcel(safeInformes, 'Historico_Informes_Auditoria')} className="bg-[#0A3B32] hover:bg-[#062620] text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition-colors">📥 Exportar</button>
        </div>
      </div>

      {isAdmin && (
        <div id="edit-form" className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">{editInformeAuditoria ? `✏️ Editando Flujo de Informe: ${editInformeAuditoria.ref}` : '➕ Archivar, Radicar y Distribuir Nuevo Informe'}</h3>
          <form onSubmit={handleInformeAuditoriaSubmit} key={editInformeAuditoria?.id || 'nuevo-informe-form'} className="space-y-6 text-xs">
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2"><label className="font-bold text-gray-600 block mb-1">Título del Informe Formal</label><input name="titulo" defaultValue={editInformeAuditoria?.titulo||''} required placeholder="Ej: Auditoría de Cumplimiento..." className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#0A3B32] outline-none font-bold text-slate-800" /></div>
              <div><label className="font-bold text-gray-600 block mb-1">Proceso Auditado</label><input name="proceso" defaultValue={editInformeAuditoria?.proceso||''} required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#0A3B32] outline-none font-bold" /></div>
              <div><label className="font-bold text-gray-600 block mb-1">Fecha de Emisión</label><input name="fecha" type="date" defaultValue={editInformeAuditoria?.fecha||''} required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#0A3B32] outline-none" /></div>
              
              <div><label className="font-bold text-gray-600 block mb-1">✍️ Elaborado Por (Auditor)</label><input name="elaboradoPor" defaultValue={editInformeAuditoria?.elaboradoPor||''} required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#0A3B32] outline-none" /></div>
              <div><label className="font-bold text-gray-600 block mb-1">🔍 Revisado Por (Líder)</label><input name="revisadoPor" defaultValue={editInformeAuditoria?.revisadoPor||''} required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#0A3B32] outline-none" /></div>
              <div><label className="font-bold text-gray-600 block mb-1">🔒 Aprobado Por (Gerencia)</label><input name="aprobadoPor" defaultValue={editInformeAuditoria?.aprobadoPor||''} required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#0A3B32] outline-none" /></div>
              <div><label className="font-bold text-gray-600 block mb-1">📢 ¿Fue Socializado?</label><select name="socializado" defaultValue={editInformeAuditoria?.socializado||'No'} className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#0A3B32] outline-none font-bold"><option>No</option><option>Sí</option></select></div>
              <div className="md:col-span-4"><label className="font-bold text-gray-600 block mb-1">Participantes de la Socialización (Líderes y convocados)</label><input name="socializadoCon" defaultValue={editInformeAuditoria?.socializadoCon||''} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#0A3B32] outline-none" /></div>
            </div>

            {/* 📝 NUEVA SECCIÓN EDITORIAL */}
            <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <h4 className="font-black text-emerald-800 uppercase tracking-widest text-[10px] mb-4">📖 Textos Editoriales (Se imprimirán en el PDF)</h4>
              </div>
              <div>
                <label className="font-bold text-gray-600 block mb-1">Objetivo de la Auditoría</label>
                <textarea name="objetivo" rows="2" defaultValue={editInformeAuditoria?.objetivo||'Evaluar la eficacia de los controles tecnológicos, la seguridad de la información y la gestión de riesgos...'} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div>
                <label className="font-bold text-gray-600 block mb-1">Alcance y Periodo</label>
                <textarea name="alcance" rows="2" defaultValue={editInformeAuditoria?.alcance||'La auditoría cubre los procesos y sistemas desde el 01 de Enero al 30 de Junio de 2026...'} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div>
                <label className="font-bold text-gray-600 block mb-1">Conclusión General (Dictamen)</label>
                <textarea name="conclusion" rows="4" defaultValue={editInformeAuditoria?.conclusion||''} placeholder="Luego del análisis realizado, se concluye que..." className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div>
                <label className="font-bold text-gray-600 block mb-1">Fortalezas Observadas</label>
                <textarea name="fortalezas" rows="4" defaultValue={editInformeAuditoria?.fortalezas||''} placeholder="1. Buena disposición de los auditados.&#10;2. Infraestructura al día..." className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
            </div>

            {/* 📸 NUEVA SECCIÓN DE GALERÍA DE IMÁGENES */}
            <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl">
              <h4 className="font-black text-slate-700 uppercase tracking-widest text-[10px] mb-1">📸 Galería Fotográfica / Evidencias (Página 6 del PDF)</h4>
              <p className="text-[9px] text-slate-500 mb-4">Pega los enlaces directos a las imágenes (ej. Google Drive, Imgur, OneDrive) que documenten los hallazgos principales.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-3 border rounded-xl shadow-sm">
                  <label className="font-bold text-xs block mb-1 text-slate-600">Evidencia 1 (URL)</label>
                  <input name="img1Url" type="url" defaultValue={editInformeAuditoria?.img1Url||''} placeholder="https://..." className="w-full border-b border-slate-200 bg-transparent py-1 mb-2 outline-none focus:border-emerald-500 text-[10px]" />
                  <input name="img1Desc" type="text" defaultValue={editInformeAuditoria?.img1Desc||''} placeholder="Descripción foto 1..." className="w-full border-b border-slate-200 bg-transparent py-1 outline-none focus:border-emerald-500 text-[10px] font-bold" />
                </div>
                <div className="bg-white p-3 border rounded-xl shadow-sm">
                  <label className="font-bold text-xs block mb-1 text-slate-600">Evidencia 2 (URL)</label>
                  <input name="img2Url" type="url" defaultValue={editInformeAuditoria?.img2Url||''} placeholder="https://..." className="w-full border-b border-slate-200 bg-transparent py-1 mb-2 outline-none focus:border-emerald-500 text-[10px]" />
                  <input name="img2Desc" type="text" defaultValue={editInformeAuditoria?.img2Desc||''} placeholder="Descripción foto 2..." className="w-full border-b border-slate-200 bg-transparent py-1 outline-none focus:border-emerald-500 text-[10px] font-bold" />
                </div>
                <div className="bg-white p-3 border rounded-xl shadow-sm">
                  <label className="font-bold text-xs block mb-1 text-slate-600">Evidencia 3 (URL)</label>
                  <input name="img3Url" type="url" defaultValue={editInformeAuditoria?.img3Url||''} placeholder="https://..." className="w-full border-b border-slate-200 bg-transparent py-1 mb-2 outline-none focus:border-emerald-500 text-[10px]" />
                  <input name="img3Desc" type="text" defaultValue={editInformeAuditoria?.img3Desc||''} placeholder="Descripción foto 3..." className="w-full border-b border-slate-200 bg-transparent py-1 outline-none focus:border-emerald-500 text-[10px] font-bold" />
                </div>
                <div className="bg-white p-3 border rounded-xl shadow-sm">
                  <label className="font-bold text-xs block mb-1 text-slate-600">Evidencia 4 (URL)</label>
                  <input name="img4Url" type="url" defaultValue={editInformeAuditoria?.img4Url||''} placeholder="https://..." className="w-full border-b border-slate-200 bg-transparent py-1 mb-2 outline-none focus:border-emerald-500 text-[10px]" />
                  <input name="img4Desc" type="text" defaultValue={editInformeAuditoria?.img4Desc||''} placeholder="Descripción foto 4..." className="w-full border-b border-slate-200 bg-transparent py-1 outline-none focus:border-emerald-500 text-[10px] font-bold" />
                </div>
              </div>
            </div>

            <div className="md:col-span-4 bg-blue-50 border border-blue-200 p-4 rounded-xl shadow-inner">
              <label className="font-black text-blue-900 block mb-1 uppercase tracking-wider text-[10px]">📧 Distribución por Correo Electrónico (Notificación Inmediata)</label>
              <input name="correosNotificacionInput" type="text" placeholder="Ej: gerente@termales.com.co, compras@termales.com.co" className="w-full border border-blue-300 bg-white rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-slate-700" />
            </div>

            <div className="md:col-span-4 flex justify-end">
              <button type="submit" disabled={isSubmitting} className={`font-black uppercase tracking-widest px-8 py-3 rounded-xl shadow-md transition-all w-full md:w-auto text-center block ${isSubmitting ? 'bg-slate-400 text-slate-100 cursor-not-allowed' : 'bg-[#0A3B32] hover:bg-[#062620] text-white cursor-pointer'}`}>
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
              <th className="p-4 w-28">Consecutivo</th>
              <th className="p-4">Proceso / Título</th>
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
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-100 font-black rounded uppercase text-[9px] tracking-wider mb-1 inline-block">{inf.proceso}</span>
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
                  <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-widest border inline-block mb-1.5 ${inf.socializado === 'Sí' ? 'bg-blue-50 text-blue-700 border-blue-200':'bg-amber-50 text-amber-700 border-amber-200'}`}>📢 Socializado: {inf.socializado}</span>
                </td>
                
                <td className="p-4 text-center space-y-1.5">
                  <button onClick={() => abrirCentroEjecutivo(inf)} className="bg-slate-800 text-white font-black px-3 py-2 rounded-xl text-[10px] hover:bg-slate-700 flex items-center justify-center space-x-1 border border-slate-700 shadow-md transition-all w-full mb-2">
                    <span className="text-sm">📊</span><span>Centro Ejecutivo y PDF</span>
                  </button>

                  {isAdmin && (
                    <div className="flex justify-center items-center space-x-2 pt-2 border-t mt-2">
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