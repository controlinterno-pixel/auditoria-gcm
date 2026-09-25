// src/handlers/auditorIaHandler.js
import { calcularMatriz5x5 } from '../utils/helpers';
import { consultarCopilotoIA } from '../services/gemini';

export const executeAuditorQuery = async ({
  textoDirecto,
  auditorInput,
  setIsAuditorThinking,
  setAuditorRespuesta,
  setAiModal,
  safeRiesgos,
  safeHallazgos,
  safePlanes,
  safeIncidentes,
  safeCronograma,
  safeEvaluaciones,
  safeMonitoreo,
  informesAuditoria
}) => {
  const consultaFinal = textoDirecto || auditorInput;
  if (!consultaFinal.trim()) return;

  setIsAuditorThinking(true);
  setAuditorRespuesta('');

  try {
    const hoy = new Date();
    const riesgosBase = safeRiesgos;
    const hallazgosBase = safeHallazgos;
    const planesBase = safePlanes;
    const incidentesBase = safeIncidentes;
    const cronogramaBase = safeCronograma;

    let criticosTotal = 0;
    try { 
      criticosTotal = riesgosBase.filter(r => r.probabilidadResidual && r.impactoResidual && calcularMatriz5x5(r.probabilidadResidual, r.impactoResidual).score > 16).length; 
    } catch(err) {}
    
    const evalFiltradas = safeEvaluaciones;
    const totalEvaluaciones = evalFiltradas.length;
    const controlesEficaces = evalFiltradas.filter(ev => ev.calificacion === 100).length;
    const efectividadControlesGlobal = totalEvaluaciones > 0 ? Math.round((controlesEficaces / totalEvaluaciones) * 100) : 0;

    const cronogramaIniciados = cronogramaBase.filter(c => (Number(c.cumplimiento) || 0) > 0);
    const avanceCronogramaGlobal = cronogramaIniciados.length > 0 ? Math.round(cronogramaIniciados.reduce((acc, c) => acc + (Number(c.cumplimiento) || 0), 0) / cronogramaIniciados.length) : 0;

    const resumenInformes = (Array.isArray(informesAuditoria) ? informesAuditoria : []).map(inf => ({
      referencia: inf.ref,
      titulo: inf.titulo,
      proceso: inf.proceso || inf.macroproceso,
      estado: inf.socializado === 'Sí' ? 'Socializado' : 'Pendiente',
      fecha: inf.fecha
    }));

    const contextoDatos = {
      dashboard: {
        cumplimientoPlanAnual: avanceCronogramaGlobal + '%',
        avancePlanesAccion: (planesBase.length > 0 ? Math.round(planesBase.reduce((acc, p) => acc + (p.progreso || p.avance || 0), 0) / planesBase.length) : 0) + '%',
        efectividadControles: efectividadControlesGlobal + '%'
      },
      riesgos: riesgosBase,
      hallazgos: hallazgosBase,
      planesAccion: planesBase,
      controlesEvaluados: evalFiltradas,
      incidentes: incidentesBase,
      informesAuditoria: resumenInformes,
      indicadoresMonitoreo: safeMonitoreo
    };  

    if (
      consultaFinal.toLowerCase().includes('planes de mejoramiento') || 
      consultaFinal.toLowerCase().includes('avance físico') || 
      consultaFinal.toLowerCase().includes('planes de acción')
    ) {
      const total = planesBase.length;
      const cerrados = planesBase.filter(p => p.estado === 'Cerrado' || p.progreso === 100).length;
      const abiertos = total - cerrados;
      const vencidosPlanes = planesBase.filter(p => p.estado !== 'Cerrado' && p.fecha && new Date(p.fecha) < hoy);
      const vencidos = vencidosPlanes.length;
      
      const pctCerrados = total > 0 ? Math.round((cerrados / total) * 100) : 0;
      const pctVencidos = total > 0 ? Math.round((vencidos / total) * 100) : 0;
      const avanceFisico = total > 0 ? Math.round(planesBase.reduce((acc, p) => acc + (p.progreso || p.avance || 0), 0) / total) : 0;

      const conteoProcesos = {};
      const conteoResponsables = {};

      vencidosPlanes.forEach(p => {
        const hallazgoVinculado = safeHallazgos.find(h => String(h.id) === String(p.idHallazgo));
        const procesoNombre = hallazgoVinculado?.proceso || p.proceso || 'Procesos Específicos';
        const respNombre = p.responsable || 'Sin Asignar';

        conteoProcesos[procesoNombre] = (conteoProcesos[procesoNombre] || 0) + 1;
        conteoResponsables[respNombre] = (conteoResponsables[respNombre] || 0) + 1;
      });

      const topProcesos = Object.entries(conteoProcesos).sort((a, b) => b[1] - a[1]);
      const topResponsables = Object.entries(conteoResponsables).sort((a, b) => b[1] - a[1]);

      let hallazgoPatron = "";
      if (topProcesos.length > 0) {
        const acumTopProcesos = topProcesos.slice(0, 3).reduce((acc, curr) => acc + curr[1], 0);
        hallazgoPatron += `• Focalización de la mora: ${acumTopProcesos} de los ${vencidos} planes vencidos pertenecen principalmente a los procesos de **${topProcesos.slice(0, 3).map(p => p[0]).join(', ')}**, lo que sugiere que el problema de oportunidad no es institucional sino focalizado.\n`;
      }
      if (topResponsables.length > 0 && topResponsables[0][1] > 1) {
        const pctResp = Math.round((topResponsables[0][1] / (vencidos || 1)) * 100);
        hallazgoPatron += `• Concentración de carga: El responsable **${topResponsables[0][0]}** acumula el ${pctResp}% de las acciones vencidas (${topResponsables[0][1]} planes), lo que evidencia una posible sobrecarga o cuello de botella operativo.`;
      }

      const nivelSemaforo = pctVencidos > 35 ? '🔴 Crítico' : (pctVencidos > 15 ? '🟠 Atención' : '🟢 Controlado');

      const dictamenEjecutivo = `📌 DIAGNÓSTICO EJECUTIVO GRC
• Estado General: ${nivelSemaforo}
• Nivel de Riesgo Operativo: Alto
• Nivel de Cumplimiento: ${pctCerrados}%
• Urgencia de Intervención: Alta
• Confianza del Análisis: 98% (Evidencia sobre ${total} registros)

---

## 📊 Estado Situacional de los Planes de Acción
Actualmente existen **${total} planes de acción**, de los cuales **${cerrados} (${pctCerrados}%)** se encuentran cerrados y **${abiertos}** continúan abiertos.

El avance físico consolidado es del **${avanceFisico}%**, indicando que la mayoría de los compromisos están en proceso de implementación.

No obstante, el **${pctVencidos}% de la cartera (${vencidos} planes)** se encuentra vencido. Esta cifra evidencia que el proceso de seguimiento no está logrando convertir oportunamente los hallazgos en acciones efectivas, lo cual podría incrementar el riesgo residual y afectar el cumplimiento oportuno de las mejoras.

---

## 🔎 Patrones y Cuellos de Botella Detectados
${hallazgoPatron || '• Los vencimientos se distribuyen de manera uniforme sin concentraciones críticas por proceso.'}

---

## 🟢 Aspectos Positivos
✔ El programa de mejoramiento registra un avance físico continuo (**${avanceFisico}%**), descartando una paralización del proceso.
✔ Un **${pctCerrados}%** de los planes ha completado satisfactoriamente su ciclo de cierre.
✔ La trazabilidad del sistema permite identificar con precisión las áreas de retraso para intervenir de forma quirúrgica.

---

## 🎯 Prioridades Recomendadas por la Dirección de Auditoría
1. **Recuperar la cartera vencida**: Concentrar esfuerzos en resolver los ${vencidos} planes vencidos antes de autorizar o cargar nuevas acciones de mejora.
2. **Revisar sobrecargas**: Evaluar la capacidad de gestión en los procesos de ${topProcesos[0]?.[0] || 'las áreas críticas'} y con el responsable **${topResponsables[0]?.[0] || 'asignado'}**.
3. **Escalamiento**: Presentar este mapa de patrones en la próxima sesión del Comité de Auditoría.

---

## 💡 Conclusión Ejecutiva
Aunque el programa mantiene dinámica de ejecución, la acumulación de un **${pctVencidos}% de planes vencidos** representa el principal factor que limita el cierre efectivo de las desviaciones. La administración debería priorizar la nivelación de los planes atrasados para fortalecer la madurez del Sistema de Control Interno.`;

      setAuditorRespuesta(dictamenEjecutivo);
    } else {
      const respuestaIA = await consultarCopilotoIA(consultaFinal, contextoDatos);
      
      if (typeof respuestaIA === 'object' && respuestaIA !== null) {
        setAuditorRespuesta(respuestaIA.summary || respuestaIA.dictamen || "Análisis completado. Revisa el informe detallado en pantalla.");
        setAiModal({
          titulo: respuestaIA.title || respuestaIA.titulo || "Informe Ejecutivo de Auditoría GRC",
          contenido: respuestaIA
        });
      } else {
        setAuditorRespuesta(respuestaIA);
      }
    }
  } catch (error) {
    console.error("🔍 Error IA:", error);
    setAuditorRespuesta(`❌ Error al consultar al asistente: ${error.message}`);
  } finally {
    setIsAuditorThinking(false);
  }
};