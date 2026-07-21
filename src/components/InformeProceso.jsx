import React from 'react';

const InformeProceso = ({ datosProceso }) => {
  const { nombreProceso, fechaGeneracion, cumplimiento, totales, topRiesgos, topHallazgos, estadisticas } = datosProceso;

  // 🧠 MOTOR DINÁMICO DE ANÁLISIS DE IA
  const generarAnalisisIA = () => {
    const abiertos = estadisticas?.hallazgosAbiertos || 0;
    const riesgosCrit = estadisticas?.riesgosCriticos || 0;

    if (totales.hallazgos > 0 && abiertos === 0) {
      return `"El proceso de ${nombreProceso} presenta un entorno de control maduro y destacable. Se evidencia una gestión efectiva al contar con sus hallazgos formalmente cerrados o con calificaciones positivas. Se recomienda mantener el monitoreo preventivo sobre la matriz de riesgos para asegurar la sostenibilidad de estas buenas prácticas."`;
    } 
    else if (abiertos > 0) {
      return `"El proceso de ${nombreProceso} requiere atención prioritaria. Actualmente existen ${abiertos} hallazgo(s) en estado abierto. Se recomienda ejecutar inmediatamente los planes de acción vinculados, priorizando aquellos asociados a los ${riesgosCrit} riesgos más críticos, para reducir la exposición de la compañía."`;
    } 
    else if (totales.riesgos > 0 && totales.hallazgos === 0) {
      return `"El proceso de ${nombreProceso} no presenta desviaciones ni hallazgos vigentes en el ciclo de auditoría actual, lo cual indica un diseño adecuado de controles. La atención debe centrarse en el monitoreo continuo de los riesgos mapeados en la matriz corporativa."`;
    } 
    else {
      return `"El proceso de ${nombreProceso} se encuentra en parámetros estables. No se registran riesgos extremos ni desviaciones críticas en los repositorios actuales."`;
    }
  };

  return (
    <div className="bg-white text-gray-800 p-8 max-w-4xl mx-auto shadow-2xl border rounded-sm">
      
      {/* ENCABEZADO */}
      <div className="border-b-2 border-blue-900 pb-4 mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-blue-900">Informe Ejecutivo por Proceso</h1>
          <h2 className="text-xl font-bold text-gray-600 uppercase">{nombreProceso}</h2>
          <p className="text-xs text-gray-500 mt-1 font-bold">Fecha de emisión: {fechaGeneracion}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Cumplimiento Global</p>
          <p className="text-5xl font-black text-emerald-600">{cumplimiento}%</p>
        </div>
      </div>

      {/* KPIs EJECUTIVOS */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-50 p-4 rounded-lg text-center border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Auditorías</p>
          <p className="text-3xl font-black text-blue-900">{totales.auditorias}</p>
        </div>
        <div className="bg-slate-50 p-4 rounded-lg text-center border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Riesgos</p>
          <p className="text-3xl font-black text-orange-600">{totales.riesgos}</p>
        </div>
        <div className="bg-slate-50 p-4 rounded-lg text-center border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Hallazgos</p>
          <p className="text-3xl font-black text-red-600">{totales.hallazgos}</p>
        </div>
        <div className="bg-slate-50 p-4 rounded-lg text-center border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Planes</p>
          <p className="text-3xl font-black text-amber-500">{totales.planes}</p>
        </div>
      </div>

      {/* RESUMEN DE RIESGOS Y HALLAZGOS */}
      <div className="mb-8">
        <h3 className="text-sm font-black uppercase tracking-widest bg-blue-50 text-blue-900 border border-blue-200 p-2 rounded-t mb-0">
          Resumen de Riesgos y Hallazgos Relevantes
        </h3>
        <table className="w-full text-left text-sm border-collapse border border-slate-200">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200 text-xs text-slate-600">
              <th className="p-3 font-bold uppercase tracking-wider">Tipo</th>
              <th className="p-3 font-bold uppercase tracking-wider">Descripción</th>
              <th className="p-3 font-bold uppercase tracking-wider">Severidad / Estado</th>
            </tr>
          </thead>
          <tbody>
            {topRiesgos.length === 0 && topHallazgos.length === 0 && (
              <tr><td colSpan="3" className="p-4 text-center text-slate-500 italic">No hay riesgos o hallazgos reportados.</td></tr>
            )}
            
            {/* Riesgos */}
            {topRiesgos.map((riesgo, idx) => (
              <tr key={`r-${idx}`} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-3 font-bold text-orange-600 text-xs">RIESGO</td>
                <td className="p-3 text-xs text-slate-700">{riesgo.riesgo || riesgo.descripcion || 'Sin descripción'}</td>
                <td className="p-3 text-xs font-bold">{riesgo.nivelRiesgoResidual || 'Alto'}</td>
              </tr>
            ))}
            
            {/* Hallazgos (Ya no ocultamos los cerrados) */}
            {topHallazgos.map((hallazgo, idx) => {
              const esCerrado = hallazgo.estado?.toUpperCase() === 'CERRADO';
              return (
                <tr key={`h-${idx}`} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-3 font-bold text-blue-700 text-xs">HALLAZGO</td>
                  <td className="p-3 text-xs text-slate-700">{hallazgo.titulo || hallazgo.hallazgo || 'Sin descripción'}</td>
                  <td className="p-3 text-xs font-bold">
                    <span className={`px-2 py-1 rounded text-[10px] uppercase tracking-wider ${esCerrado ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {hallazgo.estado || 'Abierto'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* CONCLUSIÓN (IA) */}
      <div className={`border-l-4 p-5 rounded-r ${
        (totales.hallazgos > 0 && estadisticas?.hallazgosAbiertos === 0) 
          ? 'bg-emerald-50 border-emerald-600' 
          : 'bg-blue-50 border-blue-900'
      }`}>
        <h3 className={`text-xs font-black uppercase tracking-widest mb-2 flex items-center gap-2 ${
          (totales.hallazgos > 0 && estadisticas?.hallazgosAbiertos === 0) ? 'text-emerald-800' : 'text-blue-900'
        }`}>
          <span>🤖</span> Análisis Inteligente Preliminar
        </h3>
        <p className="text-sm text-slate-700 italic leading-relaxed">
          {generarAnalisisIA()}
        </p>
      </div>

    </div>
  );
};

export default InformeProceso;