import React from 'react';

const InformeProceso = ({ datosProceso }) => {
  const { nombreProceso, fechaGeneracion, cumplimiento, totales, topRiesgos, topHallazgos, estadisticas } = datosProceso;

  // 🧠 MOTOR DINÁMICO MULTI-VARIABLES (Riesgos + Hallazgos + Planes)
  const generarAnalisisIA = () => {
    const abiertos = estadisticas?.hallazgosAbiertos || 0;
    const riesgosCrit = estadisticas?.riesgosCriticos || 0;
    const pTotales = estadisticas?.planesTotales || 0;
    const pVencidos = estadisticas?.planesVencidos || 0;
    const pCerrados = estadisticas?.planesCerrados || 0;
    const pEnCurso = pTotales - pCerrados - pVencidos;

    // Escenario 1: Proceso impecable (Cero hallazgos)
    if (totales.hallazgos === 0) {
      return `"El proceso de ${nombreProceso} presenta un alto nivel de madurez. No se registran desviaciones ni hallazgos vigentes en el ciclo de auditoría actual. La atención debe centrarse en el monitoreo preventivo de los riesgos mapeados."`;
    }

    // Escenario 2: Todo cerrado positivamente
    if (totales.hallazgos > 0 && abiertos === 0) {
      return `"El entorno de control en el proceso de ${nombreProceso} es destacable. Se evidencia una gestión diligente: todos los hallazgos detectados han sido subsanados y cerrados exitosamente. Se recomienda mantener esta cultura de mejora continua."`;
    }

    // Escenario 3: Hay hallazgos abiertos (Analizamos los planes de acción)
    if (abiertos > 0) {
      let baseText = `"El proceso de ${nombreProceso} requiere atención prioritaria sobre ${abiertos} hallazgo(s) actualmente en estado abierto. `;
      
      if (pTotales === 0) {
        // Justo el caso de tu imagen: Hallazgos abiertos pero 0 planes creados
        baseText += `⚠️ ALERTA: Aún no se han formulado los planes de acción correspondientes. Se requiere alinear de inmediato a los responsables para diseñar planes de choque, priorizando la revisión de los ${totales.riesgos} riesgos vinculados al proceso."`;
      } 
      else if (pVencidos > 0) {
        baseText += `La gestión presenta desviaciones: existen ${pVencidos} plan(es) de acción vencido(s). Es urgente exigir el cumplimiento de los compromisos adquiridos para evitar la materialización de los ${riesgosCrit} riesgos más críticos asociados."`;
      } 
      else {
        baseText += `Se registran ${pTotales} plan(es) de acción vinculados (${pEnCurso} en curso regular). Es vital asegurar la ejecución en los tiempos establecidos para lograr el cierre efectivo de las desviaciones."`;
      }
      
      return baseText;
    }

    return `"El proceso de ${nombreProceso} se encuentra en parámetros estables dentro de la matriz de evaluación."`;
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
            
            {/* Hallazgos */}
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