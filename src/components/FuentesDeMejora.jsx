import { useEffect, useState } from 'react';
import ModalNuevaFuente from './ModalNuevaFuente';

// Eliminamos los datos iniciales estáticos para que empiece vacío.
const normasIniciales = ['ISO 9001', 'ISO 14001', 'ISO 45001'];

const fechaComparable = (fecha) => {
  const valor = String(fecha || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;

  const partes = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return partes ? `${partes[3]}-${partes[2]}-${partes[1]}` : valor;
};

const obtenerSiguienteCodigo = (fuentes) => {
  const consecutivos = fuentes.flatMap((fuente) => {
    const valores = [fuente.codigo, fuente.id];
    return valores.flatMap((valor) => {
      const coincidencia = String(valor || '').match(/(\d+)$/);
      return coincidencia ? [Number(coincidencia[1])] : [];
    });
  });
  const siguiente = Math.max(0, ...consecutivos) + 1;
  return `FA-${String(siguiente).padStart(3, '0')}`;
};

export default function FuentesDeMejora({ isAdmin, fuentes = [], onSaveFuentes }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroNorma, setFiltroNorma] = useState('TODOS');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fuentesActuales, setFuentesActuales] = useState(fuentes);
  
  // ✨ ESTADOS PARA VISTA/EDICIÓN
  const [fuenteSeleccionada, setFuenteSeleccionada] = useState(null);
  const [isReadOnly, setIsReadOnly] = useState(false);

  // 🔌 CONEXIÓN GLOBAL: Sincroniza las fuentes en tiempo real para que el módulo de Informes las detecte
  useEffect(() => {
    window.fuentesMejoraDB = fuentesActuales;
  }, [fuentesActuales]);

  // 🧠 MEMORIA FOTOGRÁFICA: Leemos todas las normas que ya existen en las fuentes creadas
  const [normasDisponibles, setNormasDisponibles] = useState(() => {
    const normasDB = (Array.isArray(fuentes) ? fuentes : []).map(f => f.tipoNorma || f.norma).filter(Boolean);
    return [...new Set([...normasIniciales, ...normasDB])];
  });

  useEffect(() => {
    const arrFuentes = Array.isArray(fuentes) ? fuentes : [];
    setFuentesActuales(arrFuentes);
    
    // Si llegan fuentes de la Base de Datos, extraemos sus normas automáticamente para no perderlas
    const normasDB = arrFuentes.map(f => f.tipoNorma || f.norma).filter(Boolean);
    setNormasDisponibles(prev => [...new Set([...prev, ...normasDB])]);
  }, [fuentes]);

  // 📈 KPIs DINÁMICOS EN BASE AL ESTADO
  const totalFuentes = fuentesActuales.length;
  const activas = fuentesActuales.filter(f => f.estado === 'Activa').length;
  const borradores = fuentesActuales.filter(f => f.estado === 'Borrador').length;
  const cerradas = fuentesActuales.filter(f => f.estado === 'Cerrada').length;
  const seguimiento = fuentesActuales.filter(f => f.estado === 'En seguimiento').length;
  
  // Agrupación para la dona de "Normas"
  const conteoNormas = fuentesActuales.reduce((acc, f) => {
    acc[f.tipoNorma || f.norma] = (acc[f.tipoNorma || f.norma] || 0) + 1;
    return acc;
  }, {});
  const normasArray = Object.entries(conteoNormas).sort((a,b) => b[1] - a[1]);
  const coloresDona = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-teal-500', 'bg-orange-500'];

  const fuentesFiltradas = fuentesActuales.filter((fuente) => {
    const textoBusqueda = [
      fuente.codigo,
      fuente.id,
      fuente.norma,
      fuente.tipoNorma,
      fuente.tipoFuente,
      fuente.responsable,
      fuente.auditor,
      fuente.rol,
      fuente.alcance,
      fuente.descripcion,
      fuente.macroproceso,
      fuente.subproceso,
      fuente.proceso,
    ].filter(Boolean).join(' ').toLowerCase();
    const norma = fuente.norma || fuente.tipoNorma || '';
    const fecha = fechaComparable(fuente.fecha);

    return (
      (!searchTerm.trim() || textoBusqueda.includes(searchTerm.trim().toLowerCase())) &&
      (filtroNorma === 'TODOS' || norma === filtroNorma) &&
      (filtroEstado === 'TODOS' || fuente.estado === filtroEstado) &&
      (!fechaDesde || (fecha && fecha >= fechaDesde)) &&
      (!fechaHasta || (fecha && fecha <= fechaHasta))
    );
  });

  const handleAddNorma = (norma) => {
    setNormasDisponibles((prev) => (
      prev.some((existente) => existente.toLowerCase() === norma.toLowerCase())
        ? prev
        : [...prev, norma]
    ));
  };

  const handleDeleteNorma = (norma) => {
    setNormasDisponibles((prev) => prev.filter((existente) => existente !== norma));
  };

  const actualizarFuentes = (fuentesActualizadas) => {
    setFuentesActuales(fuentesActualizadas);
    onSaveFuentes?.(fuentesActualizadas);
  };

  const handleSaveFuente = (data) => {
    // Si la norma que viene en data.norma no está en las normas disponibles, la forzamos a agregarla
    if (data.norma && !normasDisponibles.includes(data.norma)) {
      handleAddNorma(data.norma);
    }

    const identificador = data.codigo || data.id;
    const fuentesActualizadas = fuenteSeleccionada
      ? fuentesActuales.map((fuente) => (
          (fuente.codigo || fuente.id) === identificador ? data : fuente
        ))
      : [data, ...fuentesActuales];

    actualizarFuentes(fuentesActualizadas);
    setFuenteSeleccionada(null);
    setIsModalOpen(false);
  };

  const handleDeleteFuente = (fuente) => {
    if (!window.confirm(`¿Seguro de eliminar la fuente ${fuente.codigo || fuente.id}?`)) return;

    actualizarFuentes(fuentesActuales.filter((item) => (
      (item.codigo || item.id) !== (fuente.codigo || fuente.id)
    )));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* 1. CABECERA PRINCIPAL CON BANNER ESTILO HALLAZGOS */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center p-6 gap-6 mb-6 z-20">
        
        {/* IMAGEN DE FONDO CON OVERLAY CLARO */}
        <div 
          className="absolute inset-0 bg-cover bg-center z-0 opacity-20"
          style={{ backgroundImage: "url('/Informes.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a1e3f] via-[#0a1e3f]/90 to-[#0a1e3f]/80 z-10" />

        {/* CONTENIDO IZQUIERDA */}
        <div className="relative z-20 w-full md:w-3/5 flex flex-col gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full border-[3px] border-blue-500/80 bg-blue-900/40 flex items-center justify-center shrink-0 mt-0.5 shadow-[0_0_15px_rgba(0,102,255,0.3)] backdrop-blur-sm">
              <svg className="w-6 h-6 text-blue-400" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
            </div>
            <div className="pt-1">
              <h2 className="text-3xl font-black text-white drop-shadow-md tracking-tight">
                Fuente de mejora
              </h2>
              <p className="text-[13px] text-slate-300 font-medium mt-1.5 leading-relaxed max-w-md">
                Gestión centralizada de orígenes para auditorías y hallazgos.
              </p>
            </div>
          </div>
        </div>

        {/* BOTONERA DERECHA */}
        <div className="relative z-20 flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          <button 
            onClick={() => {
              setFuenteSeleccionada(null);
              setIsReadOnly(false);
              setIsModalOpen(true);
            }}
            className="px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all backdrop-blur-sm border bg-gradient-to-r from-[#0055ff] to-[#0077ff] text-white shadow-[0_4px_15px_rgba(0,85,255,0.3)] border-transparent flex items-center hover:scale-105"
          >
            <span className="mr-2">➕</span> Nueva Fuente
          </button>
        </div>
      </div>

      {/* 2. BARRA DE HERRAMIENTAS Y FILTROS */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex-1 min-w-[300px] relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <input 
            type="text" 
            placeholder="Buscar por auditor, norma, proceso o alcance..." 
            className="w-full bg-white border border-slate-200 text-sm text-slate-700 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-[#0A3B32] focus:ring-1 focus:ring-[#0A3B32] shadow-sm font-bold placeholder-slate-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 ml-1">Norma / Estándar</span>
            <select value={filtroNorma} onChange={(e) => setFiltroNorma(e.target.value)} className="bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-lg py-2.5 px-3 outline-none cursor-pointer focus:border-[#0A3B32] shadow-sm">
              <option value="TODOS">Todos</option>
              {[...new Set([...normasDisponibles, ...normasArray.map(([norma]) => norma)])].map((norma) => (
                <option key={norma} value={norma}>{norma}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 ml-1">Estado</span>
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-lg py-2.5 px-3 outline-none cursor-pointer focus:border-[#0A3B32] shadow-sm">
              <option value="TODOS">Todos</option>
              <option value="Activa">Activa</option>
              <option value="Borrador">Borrador</option>
              <option value="En seguimiento">En seguimiento</option>
              <option value="Cerrada">Cerrada</option>
            </select>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 ml-1">Fecha de auditoría</span>
            <div className="flex items-center gap-1">
              <input type="date" aria-label="Fecha desde" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="bg-white border border-slate-200 text-slate-700 font-bold text-[10px] rounded-lg py-2.5 px-2 outline-none focus:border-[#0A3B32] shadow-sm" />
              <span className="text-slate-400 text-xs">-</span>
              <input type="date" aria-label="Fecha hasta" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="bg-white border border-slate-200 text-slate-700 font-bold text-[10px] rounded-lg py-2.5 px-2 outline-none focus:border-[#0A3B32] shadow-sm" />
            </div>
          </div>
        </div>
      </div>

{/* 3. CONTENIDO PRINCIPAL (GRID CLARO) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* TABLA IZQUIERDA (Ocupa 3 columnas) */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-[10px] uppercase font-black tracking-widest text-white border-b border-slate-200">
                  <th className="p-4 w-10 text-center"><input type="checkbox" className="rounded border-slate-400" /></th>
                  <th className="p-4">Código</th>
                  <th className="p-4">Norma / Referencia</th>
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Responsable</th>
                  <th className="p-4">Objetivos / Alcance</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="text-xs font-medium text-slate-700 divide-y divide-slate-100">
                {fuentesFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-12 text-center text-slate-400 italic font-bold">{fuentesActuales.length === 0 ? 'No hay fuentes creadas. Presiona "+ Nueva Fuente" para empezar.' : 'No hay fuentes que coincidan con los filtros seleccionados.'}</td>
                  </tr>
                ) : fuentesFiltradas.map((f, i) => (
                  <tr key={f.codigo || f.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 text-center"><input type="checkbox" className="rounded border-slate-300" /></td>
                    <td className="p-4 font-black text-slate-800 bg-slate-50/50">{f.codigo || f.id}</td>
                    <td className="p-4">
                      <span className="font-bold border border-slate-200 bg-white px-2 py-0.5 rounded-md text-[10px] shadow-sm">{f.norma || f.tipoNorma}</span>
                    </td>
                    <td className="p-4 font-bold text-slate-600">{f.fecha}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-700 border border-slate-200">
                          {(f.responsable || f.auditor || '').split(' ').map(n=>n[0]).join('').substring(0,2)}
                        </div>
                        <p className="text-slate-800 font-bold text-[11px] truncate w-32" title={f.responsable || f.auditor}>
                          {f.responsable || f.auditor}
                        </p>
                      </div>
                    </td>
                    <td className="p-4 text-[11px] font-bold text-slate-600 w-64 leading-tight truncate" title={f.alcance || f.descripcion}>{f.alcance || f.descripcion}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 w-max border ${f.estado === 'Activa' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : f.estado === 'Cerrada' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${f.estado === 'Activa' ? 'bg-emerald-500' : f.estado === 'Cerrada' ? 'bg-rose-500' : 'bg-amber-500'}`}></span>
                        {f.estado}
                      </span>
                    </td>
                    <td className="p-4 text-center space-x-2 text-slate-400">
                      <button onClick={() => { setFuenteSeleccionada(f); setIsReadOnly(true); setIsModalOpen(true); }} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors cursor-pointer" title="Ver información completa">👁️</button>
                      <button onClick={() => { setFuenteSeleccionada(f); setIsReadOnly(false); setIsModalOpen(true); }} className="text-orange-500 hover:bg-orange-50 p-1.5 rounded-lg transition-colors cursor-pointer" title="Editar">✏️</button>
                      <button onClick={() => handleDeleteFuente(f)} className="text-rose-400 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer" title="Eliminar">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-50 p-4 flex items-center justify-between border-t border-slate-200 text-[10px] font-bold text-slate-500">
            <span>Mostrando {fuentesFiltradas.length} de {fuentesActuales.length} fuentes de mejora</span>
          </div>
        </div>

        {/* PANELES LATERALES DERECHOS (Dinámicos al estado) */}
        <div className="lg:col-span-1 space-y-6">
          {/* Panel 1: Gráfica de Dona Dinámica */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 border-b pb-2">Distribución por Norma</h3>
            <div className="flex flex-col items-center justify-center gap-6">
              <div className="relative w-32 h-32 rounded-full border-[12px] border-slate-100 flex items-center justify-center border-t-blue-500 border-r-emerald-500 border-b-purple-500 border-l-orange-500 shadow-inner">
                <div className="text-center">
                  <span className="block text-3xl font-black text-slate-800 leading-none">{totalFuentes}</span>
                  <span className="block text-[8px] text-slate-400 uppercase tracking-widest mt-1">Fuentes</span>
                </div>
              </div>
              
              <div className="w-full space-y-3 text-[10px] font-bold max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                {normasArray.length === 0 ? (
                  <p className="text-center text-slate-400 italic">No hay normas registradas.</p>
                ) : (
                  normasArray.map(([norma, count], idx) => (
                    <div key={norma} className="flex justify-between items-center">
                      <span className="flex items-center gap-2 text-slate-600 truncate" title={norma}>
                        <span className={`w-2 h-2 ${coloresDona[idx % coloresDona.length]} rounded-full shadow-sm shrink-0`}></span> 
                        <span className="truncate w-24">{norma}</span>
                      </span>
                      <span className="text-slate-800 shrink-0">{count} <span className="text-slate-400 font-medium ml-1">({Math.round((count/totalFuentes)*100)}%)</span></span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Panel 2: Barras de Progreso Dinámicas */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 border-b pb-2">Resumen de Estado</h3>
            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-[10px] mb-1.5 font-bold">
                  <span className="text-slate-600">Activas</span>
                  <span className="text-slate-800">{totalFuentes > 0 ? Math.round((activas/totalFuentes)*100) : 0}% <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded ml-1">{activas}</span></span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${totalFuentes > 0 ? (activas/totalFuentes)*100 : 0}%` }}></div></div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] mb-1.5 font-bold">
                  <span className="text-slate-600">Borradores / Seguimiento</span>
                  <span className="text-slate-800">{totalFuentes > 0 ? Math.round(((borradores+seguimiento)/totalFuentes)*100) : 0}% <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded ml-1">{borradores+seguimiento}</span></span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${totalFuentes > 0 ? ((borradores+seguimiento)/totalFuentes)*100 : 0}%` }}></div></div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] mb-1.5 font-bold">
                  <span className="text-slate-600">Cerradas</span>
                  <span className="text-slate-800">{totalFuentes > 0 ? Math.round((cerradas/totalFuentes)*100) : 0}% <span className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded ml-1">{cerradas}</span></span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="bg-rose-500 h-full rounded-full transition-all duration-500" style={{ width: `${totalFuentes > 0 ? (cerradas/totalFuentes)*100 : 0}%` }}></div></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. SECCIÓN INFERIOR: INTEGRACIONES PRÓXIMAS (Adaptado a diseño claro) */}
      <div className="mt-8 pt-6 border-t border-slate-200">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-slate-400">🔗</span>
          <div>
            <h3 className="text-xs font-black text-slate-700">Integraciones Próximas</h3>
            <p className="text-[10px] font-bold text-slate-500">Conectaremos más fuentes para una visión integral de la mejora continua.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          <div className="bg-purple-50 border border-purple-200 p-4 rounded-2xl flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow">
            <div className="w-10 h-10 bg-white shadow-sm border border-purple-100 rounded-xl flex items-center justify-center text-purple-600 text-lg">💬</div>
            <div className="flex-1">
              <h4 className="text-[11px] font-black text-purple-900">PQR</h4>
              <p className="text-[9px] text-purple-700 font-medium leading-tight">Quejas, reclamos y sugerencias.</p>
              <div className="mt-1.5 text-[9px] font-black text-purple-600 bg-white border border-purple-100 px-2 py-0.5 rounded w-max">En desarrollo</div>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow">
            <div className="w-10 h-10 bg-white shadow-sm border border-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 text-lg">📊</div>
            <div className="flex-1">
              <h4 className="text-[11px] font-black text-emerald-900">Indicadores G.</h4>
              <p className="text-[9px] text-emerald-700 font-medium leading-tight">Desempeño de procesos.</p>
              <div className="mt-1.5 text-[9px] font-black text-emerald-600 bg-white border border-emerald-100 px-2 py-0.5 rounded w-max">Próximo</div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow">
            <div className="w-10 h-10 bg-white shadow-sm border border-blue-100 rounded-xl flex items-center justify-center text-blue-600 text-lg">👥</div>
            <div className="flex-1">
              <h4 className="text-[11px] font-black text-blue-900">Encuestas S.</h4>
              <p className="text-[9px] text-blue-700 font-medium leading-tight">Satisfacción de clientes.</p>
              <div className="mt-1.5 text-[9px] font-black text-blue-600 bg-white border border-blue-100 px-2 py-0.5 rounded w-max">Próximo</div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow">
            <div className="w-10 h-10 bg-white shadow-sm border border-slate-200 rounded-xl flex items-center justify-center text-slate-500 text-lg">🔗</div>
            <div className="flex-1">
              <h4 className="text-[11px] font-black text-slate-700">Otras Fuentes</h4>
              <p className="text-[9px] text-slate-500 font-medium leading-tight">Incidentes, normativas.</p>
              <div className="mt-1.5 text-[9px] font-black text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded w-max">Futuro</div>
            </div>
          </div>

        </div>
      </div>
{/* ✨ RENDERIZAR EL MODAL DINÁMICO */}
      <ModalNuevaFuente 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        fuenteEdicion={fuenteSeleccionada}
        isReadOnly={isReadOnly}
        codigoInicial={obtenerSiguienteCodigo(fuentesActuales)}
        normasDisponibles={normasDisponibles}
        onAddNorma={handleAddNorma}
        onDeleteNorma={handleDeleteNorma}
        onSave={handleSaveFuente}
      />
    </div>
  );
}