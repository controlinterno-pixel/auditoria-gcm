import React, { useState } from 'react';

export default function Trazabilidad({ safeRiesgos, safeEvaluaciones, safeHallazgos, safePlanes, safeIncidentes }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroModulo, setFiltroModulo] = useState('Todos');

  const allLogs = [];

  // Función para extraer y unificar todos los historiales de la base de datos
  const procesarLogs = (dataArray, modulo, icono, prefijo) => {
    dataArray.forEach(item => {
      if (item.historialCambios && Array.isArray(item.historialCambios)) {
        item.historialCambios.forEach(log => {
          allLogs.push({
            modulo,
            icono,
            registro: `${prefijo}-${item.id}`,
            fecha: log.fecha,
            // Si el log no tiene usuario (porque es antiguo), muestra un texto por defecto
            usuario: log.usuario || 'Sistema / Versión Previa',
            accion: log.accion,
            // Parseo básico para ordenar (DD/MM/YYYY, HH:MM:SS)
            timestamp: new Date(log.fecha.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1')).getTime() || 0
          });
        });
      }
    });
  };

  procesarLogs(safeRiesgos, 'Riesgos', '⚠️', 'RSG');
  procesarLogs(safeHallazgos, 'Hallazgos', '📄', 'HAL');
  procesarLogs(safePlanes, 'Planes de Acción', '✅', 'PLAN');
  procesarLogs(safeIncidentes, 'Eventos', '🚨', 'INC');
  procesarLogs(safeEvaluaciones, 'Controles', '🔬', 'EVAL');

  // Ordenar de más nuevo a más viejo
  allLogs.sort((a, b) => b.timestamp - a.timestamp);

  // Aplicar filtros de barra de búsqueda y select
  const logsFiltrados = allLogs.filter(log => {
    const matchSearch = log.accion.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        log.usuario.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        log.registro.toLowerCase().includes(searchTerm.toLowerCase());
    const matchModulo = filtroModulo === 'Todos' || log.modulo === filtroModulo;
    return matchSearch && matchModulo;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="border-b pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800">📜 Trazabilidad y Pistas de Auditoría</h2>
          <p className="text-xs text-slate-500 font-bold mt-1">Historial inmutable de modificaciones y accesos en el sistema.</p>
        </div>
        <div className="flex space-x-3">
          <select value={filtroModulo} onChange={(e) => setFiltroModulo(e.target.value)} className="border border-slate-300 rounded-lg text-xs px-3 py-2 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#004d40]">
            <option value="Todos">Todos los Módulos</option>
            <option value="Planes de Acción">✅ Planes de Acción</option>
            <option value="Riesgos">⚠️ Riesgos</option>
            <option value="Hallazgos">📄 Hallazgos</option>
            <option value="Eventos">🚨 Eventos</option>
            <option value="Controles">🔬 Controles</option>
          </select>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
            <input type="text" placeholder="Buscar usuario, acción..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 pr-4 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#004d40] w-64 shadow-sm" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <table className="w-full text-xs text-left divide-y">
          <thead className="bg-slate-900 text-white font-bold text-[10px] uppercase tracking-widest">
            <tr>
              <th className="p-4 w-40">Fecha y Hora</th>
              <th className="p-4">👤 Usuario (Autor)</th>
              <th className="p-4">Módulo / Registro</th>
              <th className="p-4">Acción Realizada</th>
            </tr>
          </thead>
          <tbody className="divide-y text-slate-700 bg-white">
            {logsFiltrados.length === 0 ? (
              <tr><td colSpan="4" className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest border border-dashed m-4 rounded-xl">No hay registros en este criterio.</td></tr>
            ) : (
              logsFiltrados.map((log, idx) => (
                <tr key={`log-${idx}`} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-mono text-[10px] text-slate-500 font-bold whitespace-nowrap">{log.fecha}</td>
                  <td className="p-4 font-black text-blue-700">{log.usuario}</td>
                  <td className="p-4">
                    <span className="bg-slate-100 text-slate-700 px-2 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-wider inline-flex items-center space-x-1 border border-slate-200">
                      <span>{log.icono}</span> <span>{log.modulo} {log.registro}</span>
                    </span>
                  </td>
                  <td className="p-4 font-medium text-slate-800">{log.accion}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}