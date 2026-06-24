import React from 'react';

export default function Trazabilidad({ 
  safeRiesgos, 
  safeEvaluaciones, 
  safeHallazgos, 
  safePlanes, 
  safeIncidentes 
}) {
  const logs = [...safeRiesgos, ...safeEvaluaciones, ...safeHallazgos, ...safePlanes, ...safeIncidentes]
    .flatMap(item => (item.historialCambios || []).map(log => ({ ...log, ref: item.proceso || item.titulo || `Item: ${item.id}` })));

  return (
    <div className="space-y-6">
      <div className="border-b pb-2 font-black text-lg">📜 Trazabilidad de Auditoría e Historial de Cambios</div>
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 border-b text-[10px] uppercase font-black text-slate-500">
            <tr>
              <th className="p-3">Fecha y Hora</th>
              <th className="p-3">Módulo afectado</th>
              <th className="p-3">Acción en Base de Datos</th>
            </tr>
          </thead>
          <tbody className="divide-y text-slate-600">
            {logs.map((l, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="p-3 font-mono">{l.fecha || new Date().toLocaleString()}</td>
                <td className="p-3 font-bold text-slate-900">{l.ref}</td>
                <td className="p-3 italic">{l.accion || 'Registro guardado'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}