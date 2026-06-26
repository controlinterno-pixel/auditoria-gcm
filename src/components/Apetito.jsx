import React from 'react';

export default function Apetito({
  isAdmin,
  editApetito,
  setEditApetito,
  handleApetitoSubmit,
  activeTooltip,
  setActiveTooltip,
  setFormResetKey,
  formResetKey,
  scrollToForm,
  rFiltrados,
  incFiltrados,
  calcularMatriz5x5,
  searchTerm,
  setSearchTerm,
  columnFilters,
  handleColFilterChange,
  FilterInput,
  applyFilters
}) {
  const configurados = rFiltrados.filter(r => r.capacidadRiesgo).length;
  
  const enTolerancia = rFiltrados.filter(r => {
    const costoTotal = incFiltrados.filter(i => i.idRiesgo === r.id).reduce((sum, i) => sum + (Number(i.costo) || 0), 0);
    return r.capacidadRiesgo && costoTotal > r.apetitoFinanciero && costoTotal <= r.toleranciaFinanciera;
  }).length;

  const capacidadExcedida = rFiltrados.filter(r => {
    const costoTotal = incFiltrados.filter(i => i.idRiesgo === r.id).reduce((sum, i) => sum + (Number(i.costo) || 0), 0);
    return r.capacidadRiesgo && costoTotal > r.capacidadRiesgo;
  }).length;

  const apetitoData = rFiltrados.map(r => {
    const resScore = calcularMatriz5x5(r.probabilidadResidual, r.impactoResidual).score;
    const costoTotal = incFiltrados.filter(i => i.idRiesgo === r.id).reduce((sum, i) => sum + (Number(i.costo) || 0), 0);
    const estaConfigurado = r.posturaEstrategica && r.capacidadRiesgo;
    
    let zona = "Sin parametrizar";
    let zonaColor = "bg-slate-100 text-slate-500 border-slate-200";
    let consumoPorcentaje = 0;

    if (estaConfigurado) {
      consumoPorcentaje = r.capacidadRiesgo ? Math.min((costoTotal / r.capacidadRiesgo) * 100, 100) : 0;
      if (costoTotal <= r.apetitoFinanciero) { 
        zona = "Confort (Apetito)"; 
        zonaColor = "bg-emerald-50 text-emerald-700 border-emerald-200"; 
      } else if (costoTotal <= r.toleranciaFinanciera) { 
        zona = "Alerta (Tolerancia)"; 
        zonaColor = "bg-yellow-50 text-yellow-700 border-yellow-300"; 
      } else if (costoTotal <= r.capacidadRiesgo) { 
        zona = "Peligro (Brecha)"; 
        zonaColor = "bg-orange-50 text-orange-700 border-orange-300"; 
      } else { 
        zona = "Crítico (Cap. Excedida)"; 
        zonaColor = "bg-red-50 text-red-700 border-red-300"; 
      }
    }

    return { ...r, resScoreVal: resScore, costoTotalVal: costoTotal, estaConfiguradoVal: estaConfigurado, zonaVal: zona, zonaColorVal: zonaColor, consumoPorcentajeVal: consumoPorcentaje };
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 border-l-8 border-l-blue-500">
           <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Modelos Parametrizados</h4>
           <span className="text-4xl font-black mt-2 block text-slate-800 notranslate" translate="no">{configurados} <span className="text-xl text-slate-400">/ {rFiltrados.length}</span></span>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 border-l-8 border-l-yellow-400">
           <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">En Zona de Alerta (Tolerancia)</h4>
           <span className="text-4xl font-black mt-2 block text-yellow-500 notranslate" translate="no">{enTolerancia}</span>
        </div>
        <div className="bg-[#0f172a] p-6 rounded-2xl shadow-md border border-slate-800 border-l-8 border-l-red-600 text-white">
           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Capacidad Excedida (Ruptura)</h4>
           <span className="text-4xl font-black mt-2 block text-red-500 notranslate" translate="no">{capacidadExcedida}</span>
        </div>
      </div>

      {editApetito && (
        <div id="edit-form" className="bg-white p-6 rounded-3xl shadow-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white animate-in fade-in slide-in-from-top-4 space-y-6 relative z-10 overflow-visible">
          <div className="flex justify-between items-center border-b border-blue-100 pb-4">
            <div>
              <h3 className="text-sm font-black text-blue-900 uppercase tracking-widest">⚙️ Arquitectura COSO ERM</h3>
              <p className="text-xs font-bold text-slate-500 mt-1">Riesgo: [{editApetito.sede}] {editApetito.proceso}</p>
            </div>
            <button onClick={() => setEditApetito(null)} className="text-xs text-slate-500 hover:text-red-600 bg-white border border-slate-200 px-3 py-1 rounded-lg font-bold transition-colors">✖ Cerrar Panel</button>
          </div>
          
          <form onSubmit={handleApetitoSubmit} key={editApetito?.id || 'nuevo-apetito'} className="space-y-6 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <h4 className="font-black text-slate-700 uppercase tracking-widest mb-3 border-b pb-2">1. Límites Base (KRI)</h4>
                
                {/* TOOLTIP: POSTURA ESTRATÉGICA */}
                <div className="mb-4 relative">
                  <div className="flex items-center mb-1">
                    <label className="font-bold text-gray-700">Postura Estratégica</label>
                    <button type="button" onClick={() => setActiveTooltip(activeTooltip === 'postura' ? null : 'postura')} className="ml-1.5 text-[12px] text-blue-500 hover:scale-125 transition-transform bg-blue-50 rounded-full px-1.5 py-0.5 border border-blue-200 shadow-sm cursor-pointer font-bold">ℹ️ Info</button>
                  </div>
                  {activeTooltip === 'postura' && (
                    <div className="mt-2 mb-3 w-full p-5 bg-slate-900 text-white text-[10px] rounded-xl shadow-inner border border-slate-700 animate-in slide-in-from-top-2">
                      <div className="flex justify-between items-center mb-3 border-b border-slate-700 pb-2">
                        <span className="font-black text-blue-400 uppercase tracking-widest text-[9px]">Ayuda: Postura Estratégica</span>
                        <button type="button" onClick={() => setActiveTooltip(null)} className="text-white hover:bg-red-500 bg-red-500 font-bold text-xs px-2 py-0.5 rounded transition-colors">✖</button>
                      </div>
                      <div className="mb-2"><b className="text-blue-300 block mb-1">¿Qué es?</b> Define la "personalidad" o la actitud que la gerencia decide tomar frente a este riesgo específico.</div>
                      <div className="mb-2"><b className="text-emerald-300 block mb-1">Ejemplo Práctico</b> Si elegimos "Averso" en temas de mantenimiento de piscinas, significa que no se escatimarán gastos para evitar accidentes. El riesgo no se negocia.</div>
                      <div><b className="text-amber-300 block mb-1">¿Por qué diligenciarlo?</b> Alinea las decisiones del Jefe de Área con la voluntad de la Gerencia General de Termales.</div>
                    </div>
                  )}
                  <select name="posturaEstrategica" defaultValue={editApetito.posturaEstrategica || 'Cauto'} className="w-full border border-slate-300 rounded-lg p-2 bg-white shadow-sm">
                    <option value="Averso">Averso (Evitar riesgo a toda costa)</option>
                    <option value="Cauto">Cauto (Preferencia por soluciones seguras)</option>
                    <option value="Flexible">Flexible (Equilibrio riesgo/recompensa)</option>
                    <option value="Buscador">Buscador (Alta aceptación para innovar)</option>
                  </select>
                </div>

                {/* TOOLTIP: KRI */}
                <div className="mb-4 relative">
                  <div className="flex items-center mb-1">
                    <label className="font-bold text-gray-700">KRI: Puntaje Residual Máx</label>
                    <button type="button" onClick={() => setActiveTooltip(activeTooltip === 'kri' ? null : 'kri')} className="ml-1.5 text-[12px] text-blue-500 hover:scale-125 transition-transform bg-blue-50 rounded-full px-1.5 py-0.5 border border-blue-200 shadow-sm cursor-pointer font-bold">ℹ️ Info</button>
                  </div>
                  {activeTooltip === 'kri' && (
                    <div className="mt-2 mb-3 w-full p-5 bg-slate-900 text-white text-[10px] rounded-xl shadow-inner border border-slate-700 animate-in slide-in-from-top-2">
                      <div className="flex justify-between items-center mb-3 border-b border-slate-700 pb-2">
                        <span className="font-black text-blue-400 uppercase tracking-widest text-[9px]">Ayuda: KRI (Puntaje Máximo)</span>
                        <button type="button" onClick={() => setActiveTooltip(null)} className="text-white hover:bg-red-500 bg-red-500 font-bold text-xs px-2 py-0.5 rounded transition-colors">✖</button>
                      </div>
                      <div className="mb-2"><b className="text-blue-300 block mb-1">¿Qué es?</b> Es el límite de tolerancia aceptable para la calificación residual en la matriz 5x5 de GCM.</div>
                      <div className="mb-2"><b className="text-emerald-300 block mb-1">Ejemplo Práctico</b> Si pones un KRI de 9, y tras evaluar los controles el riesgo queda en 12 (Alto), el sistema reportará una "Ruptura de KRI".</div>
                      <div><b className="text-amber-300 block mb-1">¿Por qué diligenciarlo?</b> Automatiza las banderas rojas en el tablero cuando los controles no están mitigando el riesgo lo suficiente.</div>
                    </div>
                  )}
                  <input type="number" min="1" max="25" name="kriScore" defaultValue={editApetito.kriScore || ''} required placeholder="Ej: 9 (Puntos de Matriz 5x5)" className="w-full border border-slate-300 rounded-lg p-2 bg-white shadow-sm" />
                </div>
              </div>

              <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                <h4 className="font-black text-blue-800 uppercase tracking-widest mb-3 border-b border-blue-200 pb-2">2. Umbrales Financieros (COP)</h4>
                
                {/* TOOLTIP: CAPACIDAD DE RIESGO */}
                <div className="mb-4 relative">
                  <div className="flex items-center gap-1 mb-1">
                    <label className="font-black text-red-700 text-[11px] uppercase tracking-widest">🛑 Capacidad de Riesgo (Límite)</label>
                    <button type="button" onClick={() => setActiveTooltip(activeTooltip === 'capacidad' ? null : 'capacidad')} className="ml-1 text-[12px] text-red-500 hover:scale-125 transition-transform bg-red-50 rounded-full px-1.5 py-0.5 border border-red-200 shadow-sm cursor-pointer font-bold">ℹ️ Info</button>
                  </div>
                  {activeTooltip === 'capacidad' && (
                    <div className="mt-2 mb-3 w-full p-5 bg-slate-900 text-white text-[10px] rounded-xl shadow-inner border border-slate-700 normal-case tracking-normal font-medium animate-in slide-in-from-top-2">
                      <div className="flex justify-between items-center mb-3 border-b border-slate-700 pb-2">
                        <span className="font-black text-red-400 uppercase tracking-widest text-[9px]">Ayuda: Capacidad de Riesgo</span>
                        <button type="button" onClick={() => setActiveTooltip(null)} className="text-white hover:bg-red-500 bg-red-500 font-bold text-xs px-2 py-0.5 rounded transition-colors">✖</button>
                      </div>
                      <div className="mb-2"><b className="text-blue-300 block mb-1">¿Qué es?</b> El nivel MÁXIMO absoluto de riesgo que la empresa puede soportar antes de irse a la quiebra o paralizar la operación por completo.</div>
                      <div className="mb-2"><b className="text-emerald-300 block mb-1">Ejemplo Práctico</b> Un daño estructural en las piscinas del balneario o una demanda que cueste $5,000 millones. Si pasa esto, Termales no podría operar ni pagar nómina. Es el límite catastrófico.</div>
                      <div><b className="text-amber-300 block mb-1">¿Por qué diligenciarlo?</b> Marca la "frontera de muerte". Sirve como techo absoluto; ningún otro valor puede ser mayor a este.</div>
                    </div>
                  )}
                  <p className="text-[9px] text-slate-500 mb-1 leading-tight">Límite de supervivencia (Ej: Pérdida {">"} $500M = Quiebra).</p>
                  <input type="number" name="capacidadRiesgo" defaultValue={editApetito.capacidadRiesgo || ''} required placeholder="Ej: 50000000" className="w-full border border-red-200 rounded-lg p-2 bg-white shadow-sm" />
                </div>

                {/* TOOLTIP: TOLERANCIA FINANCIERA */}
                <div className="mb-4 relative">
                  <div className="flex items-center gap-1 mb-1">
                    <label className="font-black text-amber-700 text-[11px] uppercase tracking-widest">⚠️ Tolerancia Financiera (Desv. Máx)</label>
                    <button type="button" onClick={() => setActiveTooltip(activeTooltip === 'tolerancia' ? null : 'tolerancia')} className="ml-1 text-[12px] text-amber-600 hover:scale-125 transition-transform bg-amber-50 rounded-full px-1.5 py-0.5 border border-amber-200 shadow-sm cursor-pointer font-bold">ℹ️ Info</button>
                  </div>
                  {activeTooltip === 'tolerancia' && (
                    <div className="mt-2 mb-3 w-full p-5 bg-slate-900 text-white text-[10px] rounded-xl shadow-inner border border-slate-700 normal-case tracking-normal font-medium animate-in slide-in-from-top-2">
                      <div className="flex justify-between items-center mb-3 border-b border-slate-700 pb-2">
                        <span className="font-black text-amber-400 uppercase tracking-widest text-[9px]">Ayuda: Tolerancia Financiera</span>
                        <button type="button" onClick={() => setActiveTooltip(null)} className="text-white hover:bg-red-500 bg-red-500 font-bold text-xs px-2 py-0.5 rounded transition-colors">✖</button>
                      </div>
                      <div className="mb-2"><b className="text-blue-300 block mb-1">¿Qué es?</b> Límite de desviación aceptable. Una "alerta roja gerencial" que indica que se está saliendo de control.</div>
                      <div className="mb-2"><b className="text-emerald-300 block mb-1">Ejemplo Práctico</b> Presupuestamos pérdidas menores. Pero si el robo o daño de TOALLAS y batas en el Ecoparque supera los $50 millones al mes, se enciende la Alerta Roja. No quebramos, pero la Gerencia debe intervenir.</div>
                      <div><b className="text-amber-300 block mb-1">¿Por qué diligenciarlo?</b> Define el punto donde la Gerencia debe frenar y auditar de urgencia. (Debe ser MENOR a la Capacidad).</div>
                    </div>
                  )}
                  <p className="text-[9px] text-slate-500 mb-1 leading-tight">Desviación máxima permitida (Alerta Roja Gerencial).</p>
                  <input type="number" name="toleranciaFinanciera" defaultValue={editApetito.toleranciaFinanciera || ''} required placeholder="Ej: 30000000" className="w-full border border-amber-200 rounded-lg p-2 bg-white shadow-sm" />
                </div>

                {/* TOOLTIP: APETITO FINANCIERO */}
                <div className="mb-2 relative">
                  <div className="flex items-center gap-1 mb-1">
                    <label className="font-black text-blue-900 text-[11px] uppercase tracking-widest">🎯 Apetito Financiero (Deseado)</label>
                    <button type="button" onClick={() => setActiveTooltip(activeTooltip === 'apetito' ? null : 'apetito')} className="ml-1 text-[12px] text-blue-500 hover:scale-125 transition-transform bg-blue-50 rounded-full px-1.5 py-0.5 border border-blue-200 shadow-sm cursor-pointer font-bold">ℹ️ Info</button>
                  </div>
                  {activeTooltip === 'apetito' && (
                    <div className="mt-2 mb-3 w-full p-5 bg-slate-900 text-white text-[10px] rounded-xl shadow-inner border border-slate-700 normal-case tracking-normal font-medium animate-in slide-in-from-top-2">
                      <div className="flex justify-between items-center mb-3 border-b border-slate-700 pb-2">
                        <span className="font-black text-blue-400 uppercase tracking-widest text-[9px]">Ayuda: Apetito Financiero</span>
                        <button type="button" onClick={() => setActiveTooltip(null)} className="text-white hover:bg-red-500 bg-red-500 font-bold text-xs px-2 py-0.5 rounded transition-colors">✖</button>
                      </div>
                      <div className="mb-2"><b className="text-blue-300 block mb-1">¿Qué es?</b> El nivel de riesgo que Termales está dispuesto a aceptar ACTIVAMENTE en el día a día para generar valor.</div>
                      <div className="mb-2"><b className="text-emerald-300 block mb-1">Ejemplo Práctico</b> Aceptamos dar de baja $5 millones en TOALLAS al mes. Es un "riesgo" que asumimos con gusto para que la operación fluya rápido, el turista esté feliz y no hacer filas eternas en la entrada revisando cada toalla. (Zona Verde).</div>
                      <div><b className="text-amber-300 block mb-1">¿Por qué diligenciarlo?</b> Establece el rango de trabajo normal para que los Jefes de Área operen tranquilos. (Debe ser MENOR a la Tolerancia).</div>
                    </div>
                  )}
                  <p className="text-[9px] text-slate-500 mb-1 leading-tight">Riesgo ideal a asumir (Zona Verde de Operación).</p>
                  <input type="number" name="apetitoFinanciero" defaultValue={editApetito.apetitoFinanciero || ''} required placeholder="Ej: 10000000" className="w-full border border-blue-200 rounded-lg p-2 bg-white shadow-sm" />
                </div>
              </div>

              <div className="md:col-span-2 bg-purple-50/50 p-4 rounded-2xl border border-purple-100 shadow-inner mt-4">
                <h4 className="font-black text-purple-800 uppercase tracking-widest mb-3 border-b border-purple-200 pb-2">3. Impactos No Financieros y Protocolo de Escalamiento</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* TOOLTIP: LÍMITE OPERATIVO */}
                  <div className="relative">
                    <div className="flex items-center gap-1 mb-1">
                      <label className="font-bold text-purple-900 text-[10px] uppercase">⚙️ Límite Operativo</label>
                      <button type="button" onClick={() => setActiveTooltip(activeTooltip === 'operativo' ? null : 'operativo')} className="ml-1 text-[10px] text-purple-500 hover:scale-125 transition-transform bg-purple-100 rounded-full px-1.5 py-0.5 border border-purple-300 shadow-sm cursor-pointer font-bold">ℹ️</button>
                    </div>
                    {activeTooltip === 'operativo' && (
                      <div className="mt-2 mb-3 w-full p-4 bg-slate-900 text-white text-[10px] rounded-xl shadow-inner border border-slate-700 normal-case tracking-normal font-medium animate-in slide-in-from-top-2 absolute z-50 left-0 top-full">
                        <div className="flex justify-between items-center mb-2 border-b border-slate-700 pb-2">
                          <span className="font-black text-purple-400 uppercase tracking-widest text-[9px]">Ayuda: Límite Operativo</span>
                          <button type="button" onClick={() => setActiveTooltip(null)} className="text-white hover:bg-red-500 bg-red-500 font-bold text-xs px-2 py-0.5 rounded transition-colors">✖</button>
                        </div>
                        <div className="mb-2"><b className="text-blue-300 block mb-1">¿Qué es?</b> El tiempo máximo aceptable que un proceso puede estar interrumpido.</div>
                        <div><b className="text-emerald-300 block mb-1">Ejemplo Práctico</b> Si falla el bombeo de agua termal: Aceptamos 2 horas de caída (Apetito), nos alerta 1 día (Tolerancia), cerramos el balneario si dura 1 semana (Capacidad).</div>
                      </div>
                    )}
                    <input name="impactoOperativo" defaultValue={editApetito.impactoOperativo || ''} required placeholder="Ej: Máx 2 hrs de caída" className="w-full border border-purple-200 rounded-lg p-2 bg-white shadow-sm relative z-0" />
                  </div>

                  {/* TOOLTIP: LÍMITE REPUTACIONAL */}
                  <div className="relative">
                    <div className="flex items-center gap-1 mb-1">
                      <label className="font-bold text-purple-900 text-[10px] uppercase">🗣️ Límite Reputacional</label>
                      <button type="button" onClick={() => setActiveTooltip(activeTooltip === 'reputacional' ? null : 'reputacional')} className="ml-1 text-[10px] text-purple-500 hover:scale-125 transition-transform bg-purple-100 rounded-full px-1.5 py-0.5 border border-purple-300 shadow-sm cursor-pointer font-bold">ℹ️</button>
                    </div>
                    {activeTooltip === 'reputacional' && (
                      <div className="mt-2 mb-3 w-full p-4 bg-slate-900 text-white text-[10px] rounded-xl shadow-inner border border-slate-700 normal-case tracking-normal font-medium animate-in slide-in-from-top-2 absolute z-50 left-0 top-full">
                        <div className="flex justify-between items-center mb-2 border-b border-slate-700 pb-2">
                          <span className="font-black text-purple-400 uppercase tracking-widest text-[9px]">Ayuda: Límite Reputacional</span>
                          <button type="button" onClick={() => setActiveTooltip(null)} className="text-white hover:bg-red-500 bg-red-500 font-bold text-xs px-2 py-0.5 rounded transition-colors">✖</button>
                        </div>
                        <div className="mb-2"><b className="text-blue-300 block mb-1">¿Qué es?</b> Nivel de daño aceptable a la imagen pública de Termales.</div>
                        <div><b className="text-emerald-300 block mb-1">Ejemplo Práctico</b> Aceptamos una mala queja aislada en TripAdvisor por una toalla (Apetito), pero NO toleramos un escándalo por intoxicación publicado en medios nacionales (Capacidad).</div>
                      </div>
                    )}
                    <select name="impactoReputacional" defaultValue={editApetito.impactoReputacional || 'Quejas Locales'} className="w-full border border-purple-200 rounded-lg p-2 bg-white shadow-sm relative z-0">
                      <option value="Ninguno">Ninguno (Averso)</option>
                      <option value="Quejas Locales">Solo quejas locales controlables</option>
                      <option value="Medios Regionales">Impacto en medios regionales</option>
                    </select>
                  </div>

                  {/* TOOLTIP: LÍMITE LEGAL */}
                  <div className="relative">
                    <div className="flex items-center gap-1 mb-1">
                      <label className="font-bold text-purple-900 text-[10px] uppercase">⚖️ Límite Legal / Normativo</label>
                      <button type="button" onClick={() => setActiveTooltip(activeTooltip === 'legal' ? null : 'legal')} className="ml-1 text-[10px] text-purple-500 hover:scale-125 transition-transform bg-purple-100 rounded-full px-1.5 py-0.5 border border-purple-300 shadow-sm cursor-pointer font-bold">ℹ️</button>
                    </div>
                    {activeTooltip === 'legal' && (
                      <div className="mt-2 mb-3 w-[150%] right-0 p-4 bg-slate-900 text-white text-[10px] rounded-xl shadow-inner border border-slate-700 normal-case tracking-normal font-medium animate-in slide-in-from-top-2 absolute z-50 top-full">
                        <div className="flex justify-between items-center mb-2 border-b border-slate-700 pb-2">
                          <span className="font-black text-purple-400 uppercase tracking-widest text-[9px]">Ayuda: Límite Legal</span>
                          <button type="button" onClick={() => setActiveTooltip(null)} className="text-white hover:bg-red-500 bg-red-500 font-bold text-xs px-2 py-0.5 rounded transition-colors">✖</button>
                        </div>
                        <div className="mb-2"><b className="text-blue-300 block mb-1">¿Qué es?</b> Exposición máxima a multas o sanciones normativas.</div>
                        <div><b className="text-emerald-300 block mb-1">Ejemplo Práctico</b> Tenemos "Cero Tolerancia" a incumplir normas de salubridad de la Secretaría de Salud en las piscinas, pero somos "Flexibles" asumiendo el riesgo de demandas laborales menores.</div>
                      </div>
                    )}
                    <select name="impactoLegal" defaultValue={editApetito.impactoLegal || 'Cero Tolerancia'} className="w-full border border-purple-200 rounded-lg p-2 bg-white shadow-sm relative z-0">
                      <option value="Cero Tolerancia">Cero Tolerancia (Averso)</option>
                      <option value="Sanciones Leves">Acepta sanciones o multas leves</option>
                      <option value="Demandas">Acepta riesgo de demandas</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-purple-200 flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-4 relative">
                  <div className="flex items-center gap-1">
                    <label className="font-black text-purple-900 block">🚨 ¿A quién escalar en caso de alerta?</label>
                    <button type="button" onClick={() => setActiveTooltip(activeTooltip === 'escalamiento' ? null : 'escalamiento')} className="ml-1 text-[10px] text-purple-500 hover:scale-125 transition-transform bg-purple-100 rounded-full px-1.5 py-0.5 border border-purple-300 shadow-sm cursor-pointer font-bold">ℹ️</button>
                  </div>
                  {activeTooltip === 'escalamiento' && (
                    <div className="mt-2 mb-3 w-[400px] left-0 p-4 bg-slate-900 text-white text-[10px] rounded-xl shadow-inner border border-slate-700 normal-case tracking-normal font-medium animate-in slide-in-from-top-2 absolute z-50 top-full">
                      <div className="flex justify-between items-center mb-2 border-b border-slate-700 pb-2">
                        <span className="font-black text-purple-400 uppercase tracking-widest text-[9px]">Ayuda: Protocolo de Escalamiento</span>
                        <button type="button" onClick={() => setActiveTooltip(null)} className="text-white hover:bg-red-500 bg-red-500 font-bold text-xs px-2 py-0.5 rounded transition-colors">✖</button>
                      </div>
                      <div className="mb-2"><b className="text-blue-300 block mb-1">¿Qué es?</b> Define quién debe enterarse y tomar decisiones según la gravedad del evento.</div>
                      <div><b className="text-emerald-300 block mb-1">Ejemplo Práctico</b> Si se pierden toallas (Apetito), lo soluciona el Jefe de Área. Si hay un conato de incendio o accidente grave (Tolerancia/Capacidad), se debe escalar de inmediato a la Junta Directiva.</div>
                    </div>
                  )}
                  <select name="escalamiento" defaultValue={editApetito.escalamiento || 'Comité de Gerencia'} className="w-full md:w-1/2 border border-purple-300 rounded-lg p-2 bg-white font-bold text-slate-800 shadow-sm relative z-0">
                    <option value="Jefe de Área">Jefe de Área (Bajo Impacto)</option>
                    <option value="Comité de Gerencia">Comité de Gerencia (Impacto Medio)</option>
                    <option value="Junta Directiva">Junta Directiva (Alto Impacto / Crítico)</option>
                  </select>
                </div>
              </div>

            </div>
            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button type="submit" className="bg-slate-900 text-white font-black uppercase tracking-widest px-8 py-3 rounded-xl shadow-lg hover:bg-slate-800 transition-colors transform hover:scale-105 duration-200">💾 Aplicar Arquitectura Integral</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mt-6">
        <div className="p-5 bg-[#0f172a] flex justify-between items-center border-b border-slate-800">
          <h3 className="text-white font-black text-xs uppercase tracking-widest">Monitor de Brechas Financieras</h3>
          <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-4 pr-4 py-1.5 border border-slate-700 bg-slate-800 text-white rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 shadow-sm placeholder-slate-500" />
        </div>
        <div className="overflow-x-auto p-4">
          <table className="w-full text-xs text-left divide-y divide-slate-100">
            <thead className="bg-white text-slate-500 font-black uppercase tracking-wider text-[9px]">
              <tr>
                <th className="p-4 w-1/3">Proceso / Riesgo / Postura</th>
                <th className="p-4 text-center">Puntuación (KRI)</th>
                <th className="p-4 w-1/3 text-center">Consumo de Capacidad Financiera (Eventos)</th>
                <th className="p-4 text-center">Diagnóstico COSO</th>
                <th className="p-4 text-center">Gestión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {applyFilters(apetitoData, searchTerm, columnFilters).map((r, index) => {
                const excedidoScore = r.kriScore && r.resScoreVal > r.kriScore;

                return (
                  <tr key={`apetito-row-${r.id}-${index}`} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center space-x-2 mb-1.5">
                        <span className="px-2 py-0.5 bg-slate-800 text-white text-[9px] rounded font-bold uppercase">{r.sede || 'Hotel'}</span>
                        <span className="font-bold text-slate-400 text-[10px] font-mono">#{r.id}</span>
                        <span className="font-black text-slate-800 text-sm tracking-tight">{r.proceso}</span>
                      </div>
                      <div className="text-[10px] text-slate-600 font-medium pr-4 line-clamp-2">{r.descripcion}</div>
                      {r.posturaEstrategica && <div className="mt-2 text-[9px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 inline-block px-2 py-0.5 rounded border border-indigo-100">Postura: {r.posturaEstrategica}</div>}
                    </td>
                    
                    <td className="p-4 text-center">
                      {r.kriScore ? (
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Límite: {r.kriScore}</span>
                          <span className={`px-2 py-1 rounded font-black font-mono text-xs ${excedidoScore ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'} notranslate`} translate="no">{r.resScoreVal}</span>
                        </div>
                      ) : <span className="text-slate-300 font-medium italic">-</span>}
                    </td>

                    <td className="p-4">
                      {r.estaConfiguradoVal ? (
                        <div className="w-full">
                          <div className="w-full bg-slate-200 rounded-full h-2.5 mb-2 overflow-hidden shadow-inner">
                            <div className={`h-full rounded-full transition-all duration-1000 ${r.consumoPorcentajeVal <= (r.apetitoFinanciero/r.capacidadRiesgo)*100 ? 'bg-emerald-500' : r.consumoPorcentajeVal <= (r.toleranciaFinanciera/r.capacidadRiesgo)*100 ? 'bg-yellow-400' : r.consumoPorcentajeVal < 100 ? 'bg-orange-500' : 'bg-red-600'}`} style={{ width: `${r.consumoPorcentajeVal}%` }}></div>
                          </div>
                          <div className="flex justify-between text-[9px] font-mono font-bold text-slate-400 notranslate" translate="no">
                            <span>Perdido: ${(r.costoTotalVal).toLocaleString('es-CO')}</span>
                            <span>Tope: ${(r.capacidadRiesgo).toLocaleString('es-CO')}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest border border-dashed border-slate-200 rounded-lg py-2 bg-slate-50">Requiere Parametrización</div>
                      )}
                    </td>

                    <td className="p-4 text-center">
                      <span className={`px-3 py-1.5 rounded-full font-black text-[9px] uppercase tracking-widest border ${r.zonaColorVal} mx-auto block w-max`}>
                        {r.zonaVal.toUpperCase()}
                      </span>
                    </td>

                    <td className="p-4 text-center">
                      {isAdmin && <button onClick={() => {setEditApetito(r); setFormResetKey(Date.now()); scrollToForm();}} className="bg-white border border-slate-200 text-slate-600 font-bold px-3 py-1.5 rounded-lg text-[10px] hover:bg-slate-50 transition-all shadow-sm flex items-center justify-center space-x-1 mx-auto w-full"><span>⚙️</span> <span>Ajustador</span></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}