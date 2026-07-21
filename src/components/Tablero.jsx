import React, { useMemo } from 'react';
import { MAPA_PROCESOS } from '../constants/diccionariosGRC';

// Generador de lista de procesos a monitorear
const LISTA_PROCESOS_OFICIALES = Object.keys(MAPA_PROCESOS).sort();

export default function TableroCentroControl({
  safeHallazgos = [],
  safePlanes = [],
  safeRiesgos = [],
  safeEvaluaciones = [],
  setActiveTab,
  setSelectedProcesoExpediente // Callback para precargar el proceso en MiEspacio
}) {

  // 🧹 Normalizador estricto de texto (idéntico al de MiEspacio)
  const normalizeStr = (str) => {
    if (!str) return "";
    return String(str)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  };

  // 📊 Mapeo y cálculo de KPIs en tiempo real por cada proceso
  const saludPorProceso = useMemo(() => {
    return LISTA_PROCESOS_OFICIALES.map(proceso => {
      const target = normalizeStr(proceso);

      // 1. Filtrado de entidades vinculadas
      const riesgos = safeRiesgos.filter(r => normalizeStr(r.proceso) === target);
      const evaluaciones = safeEvaluaciones.filter(ev => riesgos.some(r => r.id === ev.idRiesgo));
      const hallazgos = safeHallazgos.filter(h => normalizeStr(h.proceso) === target || riesgos.some(r => r.id === h.idRiesgo));
      const planes = safePlanes.filter(p => hallazgos.some(h => h.id === p.idHallazgo));

      // 2. Indicadores Clave
      const hallazgosAbiertos = hallazgos.filter(h => h.estado === 'Abierto');
      const hallazgosCriticos = hallazgosAbiertos.filter(h => h.nivelImpacto === 'Alto' || h.nivelImpacto === 'Crítico');
      
      const planesVencidos = planes.filter(p => p.estado !== 'Cerrado' && p.fecha && new Date(p.fecha) < new Date()).length;
      
      const progresoPlanes = planes.length > 0 
        ? Math.round(planes.reduce((acc, p) => acc + (Number(p.progreso) || 0), 0) / planes.length)
        : 100;

      const eficaciaControles = evaluaciones.length > 0
        ? Math.round((evaluaciones.filter(e => e.calificacion === 100).length / evaluaciones.length) * 100)
        : 100;

      // 3. Determinación del Semáforo
      let estadoSemaforo = 'verde'; // 🟢
      if (hallazgosCriticos.length > 0 || planesVencidos > 2) {
        estadoSemaforo = 'rojo'; // 🔴
      } else if (hallazgosAbiertos.length > 0 || planesVencidos > 0) {
        estadoSemaforo = 'amarillo'; // 🟡
      }

      return {
        proceso,
        hallazgosTotales: hallazgosAbiertos.length,
        hallazgosCriticos: hallazgosCriticos.length,
        planesVencidos,
        progresoPlanes,
        eficaciaControles,
        estadoSemaforo,
        totalRiesgos: riesgos.length
      };
    });
  }, [safeHallazgos, safePlanes, safeRiesgos, safeEvaluaciones]);

  // Handler para navegar directamente al Expediente 360°
  const handleAbrirExpediente = (procesoNombre) => {
    if (setSelectedProcesoExpediente) {
      setSelectedProcesoExpediente(procesoNombre);
    }
    setActiveTab('mi_espacio'); // Cambia a la pestaña de Mi Espacio GRC
  };

  return (
    <div className="space-y-4 mt-8 text-left">
      {/* CABECERA DE LA SECCIÓN */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-3 gap-2">
        <div>
          <h3 className="text-sm font-black tracking-widest uppercase text-white flex items-center gap-2">
            <span>🚀</span> Centro de Control por Procesos
          </h3>
          <p className="text-[10px] text-slate-400 font-medium">
            Monitor de salud integral. Haz clic en cualquier área para desplegar su Expediente Único 360°.
          </p>
        </div>
        <span className="text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400 font-black px-3 py-1 rounded-full uppercase tracking-wider">
          {saludPorProceso.length} Procesos Monitoreados
        </span>
      </div>

      {/* GRID DE TARJETAS DE PROCESO */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {saludPorProceso.map((item, idx) => {
          // Estilos dinámicos según semáforo
          const semaforoConfig = {
            rojo: {
              border: 'border-red-500/30 hover:border-red-500',
              bgBadge: 'bg-red-500/10 text-red-400 border-red-500/30',
              label: '🔴 Crítico',
              glow: 'hover:shadow-[0_0_20px_rgba(239,68,68,0.15)]'
            },
            amarillo: {
              border: 'border-amber-500/30 hover:border-amber-500',
              bgBadge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
              label: '🟡 En Atención',
              glow: 'hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]'
            },
            verde: {
              border: 'border-emerald-500/30 hover:border-emerald-500',
              bgBadge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
              label: '🟢 Controlado',
              glow: 'hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]'
            }
          }[item.estadoSemaforo];

          return (
            <div
              key={idx}
              onClick={() => handleAbrirExpediente(item.proceso)}
              className={`bg-[#0a1122] border ${semaforoConfig.border} ${semaforoConfig.glow} p-5 rounded-2xl cursor-pointer transition-all duration-300 flex flex-col justify-between group relative overflow-hidden`}
            >
              <div className="space-y-3">
                {/* Header de la tarjeta */}
                <div className="flex justify-between items-start gap-2">
                  <h4 className="text-xs font-black text-white group-hover:text-blue-400 transition-colors uppercase tracking-wider">
                    🏢 {item.proceso}
                  </h4>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${semaforoConfig.bgBadge}`}>
                    {semaforoConfig.label}
                  </span>
                </div>

                {/* Métricas rápidas */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/60 text-[10px]">
                  <div className="bg-[#060b16] p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block font-bold">Hallazgos Abiertos</span>
                    <span className="text-sm font-black text-white">{item.hallazgosTotales}</span>
                    {item.hallazgosCriticos > 0 && (
                      <span className="text-[8px] text-red-400 block font-bold">({item.hallazgosCriticos} Críticos)</span>
                    )}
                  </div>

                  <div className="bg-[#060b16] p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block font-bold">Avance de Planes</span>
                    <span className="text-sm font-black text-emerald-400">{item.progresoPlanes}%</span>
                    {item.planesVencidos > 0 && (
                      <span className="text-[8px] text-amber-400 block font-bold">({item.planesVencidos} Vencidos)</span>
                    )}
                  </div>
                </div>

                {/* Barra de salud de controles */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-bold">
                    <span className="text-slate-400">Eficacia de Controles</span>
                    <span className="text-slate-200">{item.eficaciaControles}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-500" 
                      style={{ width: `${item.eficaciaControles}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Pie con llamada a la acción */}
              <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-blue-400 font-bold group-hover:translate-x-1 transition-transform">
                <span>Explorar Expediente 360°</span>
                <span>➔</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}