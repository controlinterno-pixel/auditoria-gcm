import React from 'react';

export default function PlanAnual({
  isAdmin,
  cFiltrados,
  searchTerm,
  setSearchTerm,
  columnFilters,
  handleColFilterChange,
  FilterInput,
  applyFilters,
  editCronograma,
  setEditCronograma,
  handleCronogramaSubmit,
  formResetKey,
  setFormResetKey,
  scrollToForm,
  handleDeleteItem,
  safeMonitoreo,
  editMonitoreo,
  setEditMonitoreo,
  handleMonitoreoSubmit,
  selectedAnios,
  renderHeaderFiltros
}) {
  const allMonths = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  
  // ORDEN CRONOLÓGICO: Enero a Diciembre según el array de meses
  const cronogramaOrdenado = [...cFiltrados].sort((a, b) => {
    const getMinIdx = (arr) => {
      if (!arr || !Array.isArray(arr) || arr.length === 0) return 99;
      const indices = arr.map(m => allMonths.indexOf(m)).filter(i => i >= 0);
      return indices.length ? Math.min(...indices) : 99;
    };
    const minA = getMinIdx(a.meses);
    const minB = getMinIdx(b.meses);
    if (minA !== minB) return minA - minB;
    return (a.codigo || '').localeCompare(b.codigo || '');
  });

  const procesosActivos = cronogramaOrdenado.filter(c => c.cumplimiento > 0);
  const avgCumplimiento = procesosActivos.length > 0 
    ? Math.round(procesosActivos.reduce((acc, c) => acc + c.cumplimiento, 0) / procesosActivos.length)
    : (cronogramaOrdenado.length > 0 ? Math.round(cronogramaOrdenado.reduce((acc, c) => acc + c.cumplimiento, 0) / cronogramaOrdenado.length) : 0);

  const labelAnio = selectedAnios.length === 0 ? 'HISTÓRICO MULTIANUAL' : selectedAnios.join(' - ');

  // 🧠 MOTOR DE AGRUPACIÓN REACTIVA POR AÑO
  const itemsFiltradosFinal = applyFilters(cronogramaOrdenado, searchTerm, columnFilters);
  const itemsPorAnio = itemsFiltradosFinal.reduce((acc, c) => {
    const anioKey = c.anio || 2025; // Si el registro viejo no tiene año, preserva 2025 por defecto
    if (!acc[anioKey]) acc[anioKey] = [];
    acc[anioKey].push(c);
    return acc;
  }, {});
  const listaAniosOrdenados = Object.keys(itemsPorAnio).sort((a, b) => b - a);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* FILTROS GLOBALES DEL MÓDULO */}
      {renderHeaderFiltros("Gestión de Auditoría", "Filtra el cronograma y los procesos por periodo.")}

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-[#004d40] text-white p-6 flex flex-col md:flex-row justify-between items-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(255, 255, 255, 0.4) 0%, transparent 20%)', backgroundSize: '100px 100px' }}></div>
          <div className="relative z-10 flex items-center space-x-4">
             <div className="bg-white text-[#004d40] h-12 w-12 rounded-full flex items-center justify-center font-black text-xl shadow-lg">T</div>
             <h2 className="text-2xl font-black tracking-widest uppercase">Plan Anual de Auditoría {labelAnio}</h2>
          </div>
          <div className="relative z-10 mt-4 md:mt-0 bg-[#00695c] px-6 py-2 rounded-full border border-[#00897b] flex items-center space-x-3 shadow-inner">
             <span className="text-2xl">🎖️</span>
             <div>
                <div className="text-xl font-black notranslate" translate="no">{avgCumplimiento}%</div>
                <div className="text-[9px] uppercase tracking-widest font-bold opacity-80">% Cumplimiento Global</div>
             </div>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
           <div className="md:col-span-1 space-y-6">
              <div className="border border-slate-200 rounded-2xl p-6 text-center shadow-sm">
                 <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2">Índice General</h3>
                 <div className="text-6xl font-black text-[#004d40] leading-none mb-2 notranslate" translate="no">{avgCumplimiento}%</div>
                 <div className="text-xs font-bold text-emerald-600 flex items-center justify-center space-x-1"><span>▲</span><span>Meta Alcanzada</span></div>
                 <p className="text-[10px] text-slate-500 mt-4 leading-relaxed font-medium">Evaluación integral de procesos administrativos, operativos y de soporte.</p>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                 <div className="bg-[#004d40] text-white p-3 flex justify-between items-center">
                   <span className="text-[10px] font-black uppercase tracking-widest flex items-center space-x-2"><span>📈</span> <span>Gestor de KRIs</span></span>
                   {isAdmin && <button onClick={() => {setEditMonitoreo({}); scrollToForm();}} className="text-xs bg-white text-[#004d40] px-2 py-0.5 rounded font-bold hover:bg-slate-200 transition-colors">➕</button>}
                 </div>
                 <div className="divide-y divide-slate-100 p-2">
                   {editMonitoreo && isAdmin && (
                     <form onSubmit={handleMonitoreoSubmit} key={editMonitoreo?.id ? `edit-monitoreo-${editMonitoreo.id}-${formResetKey}` : `new-monitoreo-${formResetKey}`} className="p-3 bg-slate-50 rounded-lg mb-2 border border-slate-200 shadow-inner">
                       <input name="indicador" defaultValue={editMonitoreo.indicador||''} placeholder="Nombre KRI..." required className="w-full text-xs p-1.5 mb-2 border border-slate-300 rounded focus:ring-1 focus:ring-[#004d40] outline-none" />
                       <input name="proceso" defaultValue={editMonitoreo.proceso||''} placeholder="Proceso..." required className="w-full text-xs p-1.5 mb-2 border border-slate-300 rounded focus:ring-1 focus:ring-[#004d40] outline-none" />
                       <div className="flex space-x-2 mb-2">
                         <input name="valor" type="number" defaultValue={editMonitoreo.valor||''} placeholder="Valor actual" required className="w-1/2 text-xs p-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#004d40] outline-none" />
                         <input name="limite" type="number" defaultValue={editMonitoreo.limite||''} placeholder="Límite rojo" required className="w-1/2 text-xs p-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#004d40] outline-none" />
                       </div>
                       <select name="tendencia" defaultValue={editMonitoreo.tendencia||'flat'} className="w-full text-xs p-1.5 mb-2 border border-slate-300 rounded focus:ring-1 focus:ring-[#004d40] outline-none">
                         <option value="up">Tendencia al Alza</option>
                         <option value="down">Tendencia a la Baja</option>
                         <option value="flat">Estable</option>
                       </select>
                       <div className="flex justify-between items-center mt-1">
                         <button type="button" onClick={() => setEditMonitoreo(null)} className="text-[10px] text-red-500 hover:text-red-700 font-bold px-2">Cancelar</button>
                         <button type="submit" className="text-[10px] bg-[#004d40] text-white px-3 py-1.5 rounded shadow-sm hover:bg-[#00695c] font-bold">{editMonitoreo.id ? 'Actualizar' : 'Guardar'}</button>
                       </div>
                     </form>
                   )}
                   
                   {safeMonitoreo.map((m, index) => (
                     <div key={`moni-${m.id}-${index}`} className="flex flex-col p-3 hover:bg-slate-50 transition-colors group rounded-lg border border-transparent hover:border-slate-200">
                       <div className="flex justify-between items-center">
                         <span className="text-[10px] font-bold text-slate-800 truncate" title={m.indicador}>{m.indicador}</span>
                         {isAdmin && (
                           <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1.5">
                             <button onClick={() => {setEditMonitoreo(m); setFormResetKey(Date.now()); scrollToForm();}} className="text-blue-500 hover:text-blue-700 text-xs transition-colors" title="Editar">✏️</button>
                             <button onClick={() => handleDeleteItem('monitoreo', m.id)} className="text-red-500 hover:text-red-700 text-xs transition-colors" title="Eliminar">✖</button>
                           </div>
                         )}
                       </div>
                       <div className="flex justify-between items-center mt-1">
                         <span className="text-[9px] text-slate-400">{m.proceso}</span>
                         <span className={`text-xs font-black ${m.valor > (m.limite || 0) ? 'text-red-600' : 'text-emerald-600'} notranslate`} translate="no">{m.valor} {m.limite ? <span className="text-[8px] text-slate-400 font-medium">/ {m.limite}</span> : null}</span>
                       </div>
                     </div>
                   ))}
                 </div>
              </div>
           </div>

           <div className="md:col-span-3">
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm h-full flex flex-col">
                 <div className="bg-[#1e293b] text-white p-4 flex justify-between items-center">
                   <span className="text-xs font-black uppercase tracking-widest flex items-center space-x-2"><span>📋</span> <span>Cronograma Técnico</span></span>
                   <span className="text-[10px] font-bold text-emerald-400 border border-emerald-400 px-2 py-1 rounded-full uppercase notranslate" translate="no">⚙️ {avgCumplimiento}% Auditado</span>
                 </div>
                 <div className="overflow-x-auto flex-1 p-2">
                   <table className="w-full text-xs text-left divide-y divide-slate-100">
                     <thead className="bg-slate-50 text-slate-400 font-bold text-[9px] uppercase tracking-widest">
                       <tr>
                         <th className="p-3">
                           <div>Identificación</div>
                           <FilterInput colKey="codigo" placeholder="ID..." columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                         </th>
                         <th className="p-3 w-24">
                           <div>Año / Periodo</div>
                           <FilterInput colKey="periodo" placeholder="Filtrar..." columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                         </th>
                         <th className="p-3 w-48">
                           <div>Área / Proceso</div>
                           <FilterInput colKey="proceso" placeholder="Filtrar..." columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                         </th>
                         <th className="p-3">
                           <div>Enfoque Técnico y Alcance</div>
                           <FilterInput colKey="enfoque" placeholder="Filtrar..." columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                         </th>
                         <th className="p-3 text-center">% Acumulado.</th>
                         {isAdmin && <th className="p-3 text-center">Acción</th>}
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100 bg-white">
                       {listaAniosOrdenados.length === 0 ? (
                         <tr><td colSpan={isAdmin ? 6 : 5} className="p-8 text-center text-slate-400 font-bold italic">No se encontraron registros.</td></tr>
                       ) : (
                         listaAniosOrdenados.flatMap(anio => [
                           <tr key={`header-crono-group-${anio}`} className="bg-slate-100 font-black text-[#004d40]">
                             <td colSpan={isAdmin ? 6 : 5} className="p-2.5 pl-4 uppercase tracking-widest text-[9px] font-black">
                               📅 Planificación del Periodo Anual {anio}
                             </td>
                           </tr>,
                           ...itemsPorAnio[anio].map((c, index) => (
                             <tr key={`crono-${c.id}-${index}`} className="hover:bg-slate-50/50 transition-colors">
                               <td className="p-3 text-slate-400 font-mono">0{c.codigo}</td>
                               <td className="p-3 font-medium text-slate-600"><span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-black mr-1">{c.anio || anio}</span>{c.periodo}</td>
                               <td className="p-3 font-black text-slate-800">{c.proceso}</td>
                               <td className="p-3 text-[10px] text-slate-500 leading-relaxed">{c.enfoque}</td>
                               <td className="p-3 text-center font-black text-sm notranslate" translate="no" style={{ color: c.cumplimiento === 100 ? '#059669' : c.cumplimiento >= 50 ? '#d97706' : '#dc2626' }}>{c.cumplimiento}%</td>
                               {isAdmin && (
                                 <td className="p-3 text-center whitespace-nowrap">
                                   <button onClick={() => {setEditCronograma(c); setFormResetKey(Date.now()); scrollToForm();}} className="text-orange-500 hover:text-orange-700 mx-1 text-sm">✏️</button>
                                   <button onClick={() => handleDeleteItem('cronograma', c.id)} className="text-slate-400 hover:text-red-700 mx-1 text-sm">🗑️</button>
                                 </td>
                               )}
                             </tr>
                           ))
                         ])
                       )}
                     </tbody>
                   </table>
                 </div>
              </div>
           </div>
        </div>
      </div>

      {isAdmin && (
        <div id="edit-form" className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center border-b pb-3 mb-4">
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">{editCronograma ? '✏️ Editando Proceso del Plan' : '➕ Agregar Proceso al Cronograma'}</h3>
            {editCronograma && <button onClick={() => setEditCronograma(null)} className="text-xs text-red-500 font-bold hover:text-red-700">✖ Cancelar</button>}
          </div>
          <form onSubmit={handleCronogramaSubmit} key={editCronograma ? `edit-crono-${editCronograma.id}-${formResetKey}` : `new-crono-${formResetKey}`} className="grid grid-cols-1 md:grid-cols-5 gap-4 text-xs">
            <div><label className="font-bold text-gray-600 block mb-1">Identificación</label><input name="codigo" defaultValue={editCronograma?.codigo||''} required placeholder="Ej: 05" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none" /></div>
            <div>
              <label className="font-bold text-gray-600 block mb-1">Año</label>
              <input 
                type="number" 
                name="anio" 
                defaultValue={editCronograma ? (editCronograma.anio || 2025) : 2026} 
                required 
                className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none font-black text-slate-800 bg-white" 
              />
            </div>
            <div><label className="font-bold text-gray-600 block mb-1">Periodo Texto</label><input name="periodo" defaultValue={editCronograma?.periodo||''} required placeholder="Ej: Enero - Abril" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none" /></div>
            <div className="md:col-span-2"><label className="font-bold text-gray-600 block mb-1">Área / Proceso</label><input name="proceso" defaultValue={editCronograma?.proceso||''} required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none font-bold text-slate-800" /></div>
            
            <div><label className="font-bold text-gray-600 block mb-1">Responsable</label><input name="responsable" defaultValue={editCronograma?.responsable||''} required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none" /></div>
            <div className="md:col-span-2"><label className="font-bold text-gray-600 block mb-1">Apoyo (Opcional)</label><input name="apoyo" defaultValue={editCronograma?.apoyo||''} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none" /></div>
            <div className="md:col-span-2"><label className="font-bold text-gray-600 block mb-1">% Acumulado (0-100)</label><input type="number" min="0" max="100" name="cumplimiento" defaultValue={editCronograma?.cumplimiento||0} required className="w-full border border-emerald-300 bg-emerald-50 rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none font-black text-emerald-700" /></div>
            
            <div className="md:col-span-5"><label className="font-bold text-gray-600 block mb-1">Enfoque Técnico y Alcance</label><textarea name="enfoque" defaultValue={editCronograma?.enfoque||''} required rows="2" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none"></textarea></div>
            
            <div className="md:col-span-5">
              <label className="font-bold text-gray-600 block mb-2">Meses Planeados (Para gráfico de Gantt)</label>
              <div className="grid grid-cols-6 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                {allMonths.map(mes => (
                  <label key={`gantt-label-${mes}`} className="flex items-center space-x-2 cursor-pointer hover:bg-slate-100 p-1 rounded transition-colors">
                    <input type="checkbox" name={`mes_${mes}`} defaultChecked={editCronograma?.meses?.includes(mes)} className="rounded text-[#004d40] focus:ring-[#004d40]" />
                    <span className="text-[10px] font-bold uppercase notranslate" translate="no">{mes.substring(0,3)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="md:col-span-5 flex justify-end mt-2"><button type="submit" className="bg-[#004d40] hover:bg-[#00695c] text-white font-black uppercase tracking-widest px-8 py-3 rounded-xl shadow-md transition-all transform hover:scale-105">{editCronograma ? 'Actualizar Plan' : 'Guardar en Plan'}</button></div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mt-8">
         <div className="bg-slate-100 border-b border-slate-200 p-4 flex justify-between items-center">
           <h3 className="text-[#004d40] font-black text-xl uppercase tracking-wider text-center flex-1">GANTT CONTROL INTERNO (ORDEN CRONOLÓGICO)</h3>
           <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
              <input type="text" placeholder="Búsqueda General..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 pr-4 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#004d40] w-64 shadow-sm" />
           </div>
         </div>
         <div className="overflow-x-auto p-4">
           <table className="w-full text-[10px] text-left border-collapse border border-slate-300">
             <thead className="bg-slate-200 text-slate-700 font-bold uppercase">
               <tr>
                 <th className="border border-slate-300 p-2 w-10 text-center">Cód</th>
                 <th className="border border-slate-300 p-2 w-48">Proceso Auditable</th>
                 <th className="border border-slate-300 p-2 w-32">Responsable</th>
                 {allMonths.map(m => <th key={`gantt-col-${m}`} className="border border-slate-300 p-2 text-center w-16 notranslate" translate="no">{m.substring(0,3)}</th>)}
                {isAdmin && <th className="border border-slate-300 p-2 text-center w-16 notranslate" translate="no">ACCIÓN</th>}
               </tr>
             </thead>
             <tbody>
               {listaAniosOrdenados.length === 0 ? (
                 <tr><td colSpan={isAdmin ? 16 : 15} className="p-4 text-center text-slate-400 italic font-bold">No hay registros planificados.</td></tr>
               ) : (
                 listaAniosOrdenados.flatMap(anio => [
                   <tr key={`header-gantt-group-${anio}`} className="bg-slate-100 font-black text-[#004d40]">
                     <td colSpan={isAdmin ? 16 : 15} className="border border-slate-300 p-2 font-black uppercase tracking-widest text-[8px] bg-slate-200/60">
                       🗓️ Cronograma Mensualizado — Periodo {anio}
                     </td>
                   </tr>,
                   ...itemsPorAnio[anio].map((c, index) => (
                     <tr key={`gantt-table-${c.id}-${index}`} className="hover:bg-slate-50 transition-colors">
                       <td className="border border-slate-300 p-2 text-center text-slate-500 font-mono">{c.codigo}</td>
                       <td className="border border-slate-300 p-2 font-black text-slate-800"><span className="bg-slate-200 text-slate-700 px-1 py-0.5 rounded font-bold mr-1 text-[8px]">{c.anio || anio}</span>{c.proceso}</td>
                       <td className="border border-slate-300 p-2 text-slate-600 font-medium">{c.responsable}</td>
                       {allMonths.map(mes => {
                         const isPlanned = c.meses?.includes(mes);
                         let bgColor = 'bg-transparent';
                         let textLabel = '';
                         
                         if (isPlanned) {
                             if (c.cumplimiento === 100) {
                                 bgColor = 'bg-emerald-500';
                                 textLabel = 'Completado';
                             } else if (c.cumplimiento > 0) {
                                 bgColor = 'bg-amber-500';
                                 textLabel = `${c.cumplimiento}%`;
                               } else {
                                 bgColor = 'bg-[#00695c]';
                                 textLabel = 'Planeado';
                             }
                         }

                         return (
                           <td key={`gantt-cell-${c.id}-${mes}`} className={`border border-slate-300 text-center p-0`}>
                             {isPlanned && <div className={`${bgColor} text-white w-full h-full py-2 font-bold uppercase text-[8px] tracking-widest shadow-inner notranslate`} translate="no">{textLabel}</div>}
                           </td>
                         );
                       })}
                       {isAdmin && (
                         <td className="border border-slate-300 p-2 text-center bg-slate-50">
                           <button onClick={() => {setEditCronograma(c); setFormResetKey(Date.now()); scrollToForm();}} className="text-orange-500 hover:text-orange-700 bg-white border border-orange-200 px-2 py-1 rounded shadow-sm text-[10px] font-bold transition-colors">✏️ Modificar</button>
                         </td>
                       )}
                     </tr>
                   ))
                 ])
               )}
             </tbody>
           </table>
         </div>
      </div>
    </div>
  );
}