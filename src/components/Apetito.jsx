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
                    <button type="button" onClick={() => setActiveTooltip(activeTooltip === 'postura' ? null : 'postura')} className="ml-1.5 text-[12px] text-blue-500 hover:scale-125 transition-transform bg-blue-50 rounded-full px-1.5 py-0.5 border border-blue-200 shadow-sm cursor-pointer font-bold">ℹ️ Leer Guía</button>
                  </div>
                  {activeTooltip === 'postura' && (
                    <div className="absolute top-full left-0 mt-2 z-[100] w-full md:w-[500px] max-h-[500px] overflow-y-auto p-6 bg-slate-900 text-white text-[11px] rounded-xl shadow-2xl border border-slate-700 animate-in slide-in-from-top-2">
                      <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2 sticky top-0 bg-slate-900">
                        <span className="font-black text-blue-400 uppercase tracking-widest text-[10px]">Guía: Postura Estratégica</span>
                        <button type="button" onClick={() => setActiveTooltip(null)} className="text-white bg-red-600 hover:bg-red-500 font-bold px-3 py-1 rounded transition-colors">✖ Cerrar</button>
                      </div>
                      <div className="mb-3">
                        <b className="text-blue-300 block mb-1 text-xs">¿Qué significa cada opción?</b>
                        Elige cómo quieres que tu equipo actúe frente a este riesgo en particular:
                        <ul className="list-disc pl-4 mt-2 space-y-2 text-slate-300">
                          <li><b className="text-white">1. Averso (Cero Tolerancia):</b> No se acepta NADA de riesgo. Se invierte la plata o el tiempo que sea necesario para evitar que pase. <i>(Ej: Calidad del agua en piscinas. No se juega con eso).</i></li>
                          <li><b className="text-white">2. Cauto (Seguridad primero):</b> Preferimos ir a lo seguro. Aceptamos un riesgo mínimo solo si está súper vigilado. <i>(Ej: Contratar a un proveedor nuevo y barato, pero exigiéndole muchas pólizas).</i></li>
                          <li><b className="text-white">3. Flexible (Punto medio):</b> Estamos dispuestos a ceder un poco si eso nos ahorra dinero o nos trae un beneficio claro. <i>(Ej: Comprar insumos al por mayor sabiendo que algunos pueden caducar).</i></li>
                          <li><b className="text-white">4. Buscador (Arriesgado):</b> Asumimos el riesgo con toda la intención, porque la ganancia lo vale. <i>(Ej: Una campaña de mercadeo súper agresiva o lanzar un nuevo servicio diferente).</i></li>
                        </ul>
                      </div>
                      <div>
                        <b className="text-amber-300 block mb-1 text-xs">¿Por qué diligenciarlo?</b>
                        Para que todos en tu área sepan si deben tenerle "miedo" a este riesgo o si tienen permiso de arriesgarse un poco para agilizar el trabajo.
                      </div>
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
                    <button type="button" onClick={() => setActiveTooltip(activeTooltip === 'kri' ? null : 'kri')} className="ml-1.5 text-[12px] text-blue-500 hover:scale-125 transition-transform bg-blue-50 rounded-full px-1.5 py-0.5 border border-blue-200 shadow-sm cursor-pointer font-bold">ℹ️ Leer Guía</button>
                  </div>
                  {activeTooltip === 'kri' && (
                    <div className="absolute top-full left-0 mt-2 z-[100] w-full md:w-[500px] max-h-[500px] overflow-y-auto p-6 bg-slate-900 text-white text-[11px] rounded-xl shadow-2xl border border-slate-700 animate-in slide-in-from-top-2">
                      <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2 sticky top-0 bg-slate-900">
                        <span className="font-black text-blue-400 uppercase tracking-widest text-[10px]">Guía: KRI (Puntaje Máximo)</span>
                        <button type="button" onClick={() => setActiveTooltip(null)} className="text-white bg-red-600 hover:bg-red-500 font-bold px-3 py-1 rounded transition-colors">✖ Cerrar</button>
                      </div>
                      <div className="mb-3">
                        <b className="text-blue-300 block mb-1 text-xs">¿De dónde sale este número y cuál elijo?</b>
                        Este número sale de la Matriz de Riesgos (multiplicar Probabilidad x Impacto). Puedes escribir cualquier número del <b>1 al 25</b>, dependiendo de cuál quieres que sea el "tope" aceptable para tu área:
                        <ul className="list-disc pl-4 mt-2 space-y-1 text-slate-300">
                          <li><b className="text-white">1 a 4:</b> Exiges que el riesgo se mantenga BAJO.</li>
                          <li><b className="text-white">5 a 9:</b> Aceptas que el riesgo llegue máximo a MODERADO.</li>
                          <li><b className="text-white">10 a 16:</b> Toleras convivir con un riesgo ALTO.</li>
                          <li><b className="text-white">17 a 25:</b> Muy raro usarlo, significa que aceptas un riesgo EXTREMO.</li>
                        </ul>
                      </div>
                      <div className="mb-3">
                        <b className="text-emerald-300 block mb-1 text-xs">Ejemplo Práctico</b>
                        Si aquí escribes un "9" (Riesgo Moderado), y en la próxima auditoría se descubre que los controles fallaron y el puntaje real subió a 12, el sistema va a pitar y reportar una "Ruptura de KRI".
                      </div>
                      <div>
                        <b className="text-amber-300 block mb-1 text-xs">¿Por qué diligenciarlo?</b>
                        Para que el sistema de Control Interno sepa en qué momento debe mandarte una alerta avisando que tus controles ya no están funcionando como deberían.
                      </div>
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
                    <button type="button" onClick={() => setActiveTooltip(activeTooltip === 'capacidad' ? null : 'capacidad')} className="ml-1 text-[12px] text-red-500 hover:scale-125 transition-transform bg-red-50 rounded-full px-1.5 py-0.5 border border-red-200 shadow-sm cursor-pointer font-bold">ℹ️ Leer Guía</button>
                  </div>
                  {activeTooltip === 'capacidad' && (
                    <div className="absolute top-full right-0 mt-2 z-[100] w-full md:w-[500px] max-h-[500px] overflow-y-auto p-6 bg-slate-900 text-white text-[11px] rounded-xl shadow-2xl border border-slate-700 normal-case tracking-normal font-medium animate-in slide-in-from-top-2">
                      <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2 sticky top-0 bg-slate-900">
                        <span className="font-black text-red-400 uppercase tracking-widest text-[10px]">La Frontera de la Muerte (Capacidad)</span>
                        <button type="button" onClick={() => setActiveTooltip(null)} className="text-white bg-red-600 hover:bg-red-500 font-bold px-3 py-1 rounded transition-colors">✖ Cerrar</button>
                      </div>
                      <div className="mb-4">
                        <b className="text-blue-300 block mb-1 text-xs">¿De qué estamos hablando aquí de forma sencilla?</b>
                        Este es el número apocalíptico. Es la cantidad máxima de plata que Termales podría perder por este riesgo antes de tener que cerrar puertas, quebrar o paralizar la empresa completa.
                      </div>
                      <div className="mb-4">
                        <b className="text-emerald-300 block mb-1 text-xs">Ejemplos Prácticos en Termales</b>
                        <ul className="list-disc pl-4 space-y-1 text-slate-300">
                          <li><b>Daño Estructural:</b> Un deslizamiento que destruya las piscinas y la vía de acceso, costando $5.000 millones. Termales no tendría caja para pagar la reconstrucción y la nómina al mismo tiempo.</li>
                          <li><b>Sanción DIAN:</b> Una multa tributaria tan gigante que obligue a embargar las cuentas del hotel. Es el fin de la operación.</li>
                        </ul>
                      </div>
                      <div>
                        <b className="text-amber-300 block mb-1 text-xs">¿Por qué diligenciarlo?</b>
                        Marca el techo absoluto. Al llenar esto, le dices a la Gerencia: "Cualquier problema que cueste cerca de esta plata no es un chicharrón operativo, es la muerte del negocio". NINGÚN otro valor en este formulario puede ser mayor a este.
                      </div>
                    </div>
                  )}
                  <p className="text-[9px] text-slate-500 mb-1 leading-tight">El desastre absoluto (Ej: Pérdida {">"} $500M = Quiebra).</p>
                  <input type="number" name="capacidadRiesgo" defaultValue={editApetito.capacidadRiesgo || ''} required placeholder="Ej: 50000000" className="w-full border border-red-200 rounded-lg p-2 bg-white shadow-sm" />
                </div>

                {/* TOOLTIP: TOLERANCIA FINANCIERA */}
                <div className="mb-4 relative">
                  <div className="flex items-center gap-1 mb-1">
                    <label className="font-black text-amber-700 text-[11px] uppercase tracking-widest">⚠️ Tolerancia Financiera (Desv. Máx)</label>
                    <button type="button" onClick={() => setActiveTooltip(activeTooltip === 'tolerancia' ? null : 'tolerancia')} className="ml-1 text-[12px] text-amber-600 hover:scale-125 transition-transform bg-amber-50 rounded-full px-1.5 py-0.5 border border-amber-200 shadow-sm cursor-pointer font-bold">ℹ️ Leer Guía</button>
                  </div>
                  {activeTooltip === 'tolerancia' && (
                    <div className="absolute top-full right-0 mt-2 z-[100] w-full md:w-[500px] max-h-[500px] overflow-y-auto p-6 bg-slate-900 text-white text-[11px] rounded-xl shadow-2xl border border-slate-700 normal-case tracking-normal font-medium animate-in slide-in-from-top-2">
                      <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2 sticky top-0 bg-slate-900">
                        <span className="font-black text-amber-400 uppercase tracking-widest text-[10px]">El Colchón de Emergencia (Tolerancia)</span>
                        <button type="button" onClick={() => setActiveTooltip(null)} className="text-white bg-red-600 hover:bg-red-500 font-bold px-3 py-1 rounded transition-colors">✖ Cerrar</button>
                      </div>
                      <div className="mb-4">
                        <b className="text-blue-300 block mb-1 text-xs">¿De qué estamos hablando aquí de forma sencilla?</b>
                        Es la cantidad de plata que, si se pierde, DUELE MUCHO y prende las alarmas de todos los jefes, pero Termales sigue vivo y operando. Es el límite de nuestro "colchón" antes de que la rentabilidad se vaya al piso.
                      </div>
                      <div className="mb-4">
                        <b className="text-emerald-300 block mb-1 text-xs">Ejemplos Prácticos en Termales</b>
                        <ul className="list-disc pl-4 space-y-1 text-slate-300">
                          <li><b>Robos de inventario:</b> Si se dañan o desaparecen toallas y batas del Ecoparque por valor de $50 millones al mes. No nos quiebra, pero destruye las utilidades del mes y hay que intervenir YA.</li>
                          <li><b>Daño de Máquinas:</b> Se quema el cuarto principal de bombas y arreglarlo de urgencia cuesta $150 millones. Arruina el presupuesto, pero no cierra la empresa.</li>
                        </ul>
                      </div>
                      <div>
                        <b className="text-amber-300 block mb-1 text-xs">¿Por qué diligenciarlo?</b>
                        Para poner los "frenos de emergencia". Si el daño llega a esta cifra, el sistema avisa que tu área necesita una reunión urgente con Gerencia para apagar el incendio.
                      </div>
                    </div>
                  )}
                  <p className="text-[9px] text-slate-500 mb-1 leading-tight">Límite donde duele y hay que llamar a Gerencia.</p>
                  <input type="number" name="toleranciaFinanciera" defaultValue={editApetito.toleranciaFinanciera || ''} required placeholder="Ej: 30000000" className="w-full border border-amber-200 rounded-lg p-2 bg-white shadow-sm" />
                </div>

                {/* TOOLTIP: APETITO FINANCIERO */}
                <div className="mb-2 relative">
                  <div className="flex items-center gap-1 mb-1">
                    <label className="font-black text-blue-900 text-[11px] uppercase tracking-widest">🎯 Apetito Financiero (Deseado)</label>
                    <button type="button" onClick={() => setActiveTooltip(activeTooltip === 'apetito' ? null : 'apetito')} className="ml-1 text-[12px] text-blue-500 hover:scale-125 transition-transform bg-blue-50 rounded-full px-1.5 py-0.5 border border-blue-200 shadow-sm cursor-pointer font-bold">ℹ️ Leer Guía</button>
                  </div>
                  {activeTooltip === 'apetito' && (
                    <div className="absolute top-full right-0 mt-2 z-[100] w-full md:w-[500px] max-h-[500px] overflow-y-auto p-6 bg-slate-900 text-white text-[11px] rounded-xl shadow-2xl border border-slate-700 normal-case tracking-normal font-medium animate-in slide-in-from-top-2">
                      <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2 sticky top-0 bg-slate-900">
                        <span className="font-black text-blue-400 uppercase tracking-widest text-[10px]">El Costo de Operar (Apetito)</span>
                        <button type="button" onClick={() => setActiveTooltip(null)} className="text-white bg-red-600 hover:bg-red-500 font-bold px-3 py-1 rounded transition-colors">✖ Cerrar</button>
                      </div>
                      <div className="mb-4">
                        <b className="text-blue-300 block mb-1 text-xs">¿De qué estamos hablando aquí de forma sencilla?</b>
                        Es la cantidad de plata que Termales ACEPTA PERDER con todo el gusto del mundo en el día a día. Es el riesgo normal de hacer negocios. No hay regaños, no hay crisis, es simplemente la "Zona Verde".
                      </div>
                      <div className="mb-4">
                        <b className="text-emerald-300 block mb-1 text-xs">Ejemplos Prácticos en Termales</b>
                        <ul className="list-disc pl-4 space-y-1 text-slate-300">
                          <li><b>Las Toallas VIP:</b> Aceptamos que se pierdan o dañen toallas por $5 millones al mes. Lo aceptamos para que la operación fluya rápido y no hacer filas eternas requisando a los turistas a la salida.</li>
                          <li><b>La Vajilla del Restaurante:</b> Por el alto volumen de turistas, sabemos que se van a romper platos y vasos. Aceptamos una pérdida de $2 millones al mes. Es el costo de atender rápido.</li>
                        </ul>
                      </div>
                      <div>
                        <b className="text-amber-300 block mb-1 text-xs">¿Por qué diligenciarlo?</b>
                        ¡Para tu propia tranquilidad como Jefe! Si defines tu Apetito, y pierdes plata DENTRO de ese rango, Auditoría nunca te va a molestar ni a sancionar, porque la Gerencia ya aprobó que eso es normal.
                      </div>
                    </div>
                  )}
                  <p className="text-[9px] text-slate-500 mb-1 leading-tight">Riesgo normal aceptado (Zona Verde sin regaños).</p>
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
                      <button type="button" onClick={() => setActiveTooltip(activeTooltip === 'operativo' ? null : 'operativo')} className="ml-1 text-[10px] text-purple-500 hover:scale-125 transition-transform bg-purple-100 rounded-full px-1.5 py-0.5 border border-purple-300 shadow-sm cursor-pointer font-bold">ℹ️ Guía</button>
                    </div>
                    {activeTooltip === 'operativo' && (
                      <div className="absolute top-full left-0 mt-2 z-[100] w-[300px] md:w-[450px] max-h-[500px] overflow-y-auto p-5 bg-slate-900 text-white text-[11px] rounded-xl shadow-2xl border border-slate-700 normal-case tracking-normal font-medium animate-in slide-in-from-top-2">
                        <div className="flex justify-between items-center mb-3 border-b border-slate-700 pb-2 sticky top-0 bg-slate-900">
                          <span className="font-black text-purple-400 uppercase tracking-widest text-[9px]">Guía: Límite Operativo</span>
                          <button type="button" onClick={() => setActiveTooltip(null)} className="text-white bg-red-600 hover:bg-red-500 font-bold px-3 py-1 rounded transition-colors">✖</button>
                        </div>
                        <div className="mb-3"><b className="text-blue-300 block mb-1 text-xs">¿De qué estamos hablando?</b> Cuánto tiempo puede estar tu área "varada" o sin servicio antes de que se vuelva un caos para Termales.</div>
                        <div className="mb-3"><b className="text-emerald-300 block mb-1 text-xs">Ejemplo Práctico (Cortes de Luz)</b> 
                          <ul className="list-disc pl-4 mt-1 space-y-1 text-slate-300">
                            <li><b>Apetito (Normal):</b> Se va la luz, pero la planta eléctrica entra en 10 segundos.</li>
                            <li><b>Tolerancia (Problema):</b> La planta falla y el hotel se queda a oscuras 4 horas. Toca regalar cenas para calmar a la gente.</li>
                            <li><b>Capacidad (Caos):</b> El daño eléctrico dura 3 días, nos toca reubicar y devolver la plata a todos los huéspedes.</li>
                          </ul>
                        </div>
                        <div><b className="text-amber-300 block mb-1 text-xs">¿Por qué diligenciarlo?</b> Para saber con cuánta urgencia deben actuar los de mantenimiento si algo en tu área se daña.</div>
                      </div>
                    )}
                    <input name="impactoOperativo" defaultValue={editApetito.impactoOperativo || ''} required placeholder="Ej: Máx 2 hrs de caída" className="w-full border border-purple-200 rounded-lg p-2 bg-white shadow-sm relative z-0" />
                  </div>

                  {/* TOOLTIP: LÍMITE REPUTACIONAL */}
                  <div className="relative">
                    <div className="flex items-center gap-1 mb-1">
                      <label className="font-bold text-purple-900 text-[10px] uppercase">🗣️ Límite Reputacional</label>
                      <button type="button" onClick={() => setActiveTooltip(activeTooltip === 'reputacional' ? null : 'reputacional')} className="ml-1 text-[10px] text-purple-500 hover:scale-125 transition-transform bg-purple-100 rounded-full px-1.5 py-0.5 border border-purple-300 shadow-sm cursor-pointer font-bold">ℹ️ Guía</button>
                    </div>
                    {activeTooltip === 'reputacional' && (
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[100] w-[300px] md:w-[450px] max-h-[500px] overflow-y-auto p-5 bg-slate-900 text-white text-[11px] rounded-xl shadow-2xl border border-slate-700 normal-case tracking-normal font-medium animate-in slide-in-from-top-2">
                        <div className="flex justify-between items-center mb-3 border-b border-slate-700 pb-2 sticky top-0 bg-slate-900">
                          <span className="font-black text-purple-400 uppercase tracking-widest text-[9px]">Guía: Límite Reputacional</span>
                          <button type="button" onClick={() => setActiveTooltip(null)} className="text-white bg-red-600 hover:bg-red-500 font-bold px-3 py-1 rounded transition-colors">✖</button>
                        </div>
                        <div className="mb-3"><b className="text-blue-300 block mb-1 text-xs">¿De qué estamos hablando?</b> Qué tanto "chisme" o mala fama aguantamos antes de que nos empiece a afectar las ventas.</div>
                        <div className="mb-3"><b className="text-emerald-300 block mb-1 text-xs">Ejemplos Prácticos</b>
                          <ul className="list-disc pl-4 mt-1 space-y-1 text-slate-300">
                            <li><b>Apetito (Normal):</b> Un cliente enojado gritando en taquilla. Se maneja ahí mismo.</li>
                            <li><b>Tolerancia (Problema):</b> Un video de un mal servicio se hace viral en TikTok con 100,000 vistas. Requiere que Mercadeo responda rápido.</li>
                            <li><b>Capacidad (Caos):</b> Sale una noticia en Caracol TV sobre contaminación severa en nuestra agua termal. Se cae la marca.</li>
                          </ul>
                        </div>
                        <div><b className="text-amber-300 block mb-1 text-xs">¿Por qué diligenciarlo?</b> Para saber si un problema se arregla pidiendo disculpas, o si hay que contratar expertos en prensa.</div>
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
                      <button type="button" onClick={() => setActiveTooltip(activeTooltip === 'legal' ? null : 'legal')} className="ml-1 text-[10px] text-purple-500 hover:scale-125 transition-transform bg-purple-100 rounded-full px-1.5 py-0.5 border border-purple-300 shadow-sm cursor-pointer font-bold">ℹ️ Guía</button>
                    </div>
                    {activeTooltip === 'legal' && (
                      <div className="absolute top-full right-0 mt-2 z-[100] w-[300px] md:w-[450px] max-h-[500px] overflow-y-auto p-5 bg-slate-900 text-white text-[11px] rounded-xl shadow-2xl border border-slate-700 normal-case tracking-normal font-medium animate-in slide-in-from-top-2">
                        <div className="flex justify-between items-center mb-3 border-b border-slate-700 pb-2 sticky top-0 bg-slate-900">
                          <span className="font-black text-purple-400 uppercase tracking-widest text-[9px]">Guía: Límite Legal</span>
                          <button type="button" onClick={() => setActiveTooltip(null)} className="text-white bg-red-600 hover:bg-red-500 font-bold px-3 py-1 rounded transition-colors">✖</button>
                        </div>
                        <div className="mb-3"><b className="text-blue-300 block mb-1 text-xs">¿De qué estamos hablando?</b> Qué tantos problemas con la ley o demandas estamos dispuestos a enfrentar por operar el negocio.</div>
                        <div className="mb-3"><b className="text-emerald-300 block mb-1 text-xs">Ejemplos Prácticos</b>
                          <ul className="list-disc pl-4 mt-1 space-y-1 text-slate-300">
                            <li><b>Apetito (Normal):</b> Una queja menor en la SIC (Superindustria) que se arregla respondiendo una carta de descargo.</li>
                            <li><b>Tolerancia (Problema):</b> La demanda de un exempleado por $15 millones, que terminamos conciliando con los abogados.</li>
                            <li><b>Capacidad (Caos):</b> Una orden de cierre definitivo del ecoparque emitida por la CAR por daño ambiental irreversible.</li>
                          </ul>
                        </div>
                        <div><b className="text-amber-300 block mb-1 text-xs">¿Por qué diligenciarlo?</b> Para guiar a los abogados sobre qué normas son "innegociables" en tu área.</div>
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
                    <button type="button" onClick={() => setActiveTooltip(activeTooltip === 'escalamiento' ? null : 'escalamiento')} className="ml-1 text-[10px] text-purple-500 hover:scale-125 transition-transform bg-purple-100 rounded-full px-1.5 py-0.5 border border-purple-300 shadow-sm cursor-pointer font-bold">ℹ️ Explicación</button>
                  </div>
                  {activeTooltip === 'escalamiento' && (
                    <div className="absolute top-full left-0 mt-2 z-[100] w-full md:w-[500px] max-h-[400px] overflow-y-auto p-6 bg-slate-900 text-white text-[11px] rounded-xl shadow-2xl border border-slate-700 normal-case tracking-normal font-medium animate-in slide-in-from-top-2">
                      <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2 sticky top-0 bg-slate-900">
                        <span className="font-black text-purple-400 uppercase tracking-widest text-[10px]">A quién despertar (Escalamiento)</span>
                        <button type="button" onClick={() => setActiveTooltip(null)} className="text-white bg-red-600 hover:bg-red-500 font-bold px-3 py-1 rounded transition-colors">✖ Cerrar</button>
                      </div>
                      <div className="mb-4">
                        <b className="text-blue-300 block mb-1 text-xs">¿De qué estamos hablando?</b>
                        Simplemente: ¿A quién hay que llamar si el problema explota en tu área?
                      </div>
                      <div className="mb-4">
                        <b className="text-emerald-300 block mb-1 text-xs">Ejemplos Prácticos</b>
                        <ul className="list-disc pl-4 space-y-1 text-slate-300">
                          <li>Se daña una caja registradora el fin de semana ➔ <b>Jefe de Taquilla</b> lo soluciona.</li>
                          <li>Se inunda la zona de vestidores principal ➔ Hay que llamar al <b>Comité de Gerencia</b>.</li>
                          <li>Hay un accidente grave en las piscinas ➔ Se levanta el teléfono y se llama a la <b>Junta Directiva</b> inmediatamente.</li>
                        </ul>
                      </div>
                      <div>
                        <b className="text-amber-300 block mb-1 text-xs">¿Por qué diligenciarlo?</b>
                        Para que en medio del estrés de una crisis, todo el equipo sepa exactamente a quién acudir, evitando que alguien de menor rango asuma una responsabilidad que no le corresponde.
                      </div>
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
