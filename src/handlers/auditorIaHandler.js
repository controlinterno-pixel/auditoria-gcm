// src/handlers/auditorIaHandler.js
import { calcularMatriz5x5 } from '../utils/helpers';
import { apiService } from '../services/apiService';
import { contextoTarjetaDashboard } from '../utils/contextoIADashboard.js';
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

    try { 
      riesgosBase.filter(r => r.probabilidadResidual && r.impactoResidual && calcularMatriz5x5(r.probabilidadResidual, r.impactoResidual).score > 16); 
    } catch (err) {
      console.error("Error al evaluar severidad de riesgos:", err);
    }
    
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

    // Resúmenes con identificadores (los mismos de los paneles), no las listas completas: así no se
    // recortan los datos en el servidor y la IA puede citar RSK, PLA, hallazgos y controles concretos.
    const fuentes = { riesgos: riesgosBase, hallazgos: hallazgosBase, planes: planesBase, evaluaciones: evalFiltradas, hoy };
    const contextoDatos = {
      indicadoresGenerales: {
        cumplimientoPlanAnual: `${avanceCronogramaGlobal}%`,
        efectividadControlesEnCampo: `${efectividadControlesGlobal}%`,
      },
      riesgos: contextoTarjetaDashboard('riesgos', fuentes).datos,
      planesDeAccion: contextoTarjetaDashboard('planes', fuentes).datos,
      hallazgos: contextoTarjetaDashboard('hallazgos', fuentes).datos,
      controlesProbadosEnCampo: contextoTarjetaDashboard('controles', fuentes).datos,
      incidentes: {
        total: incidentesBase.length,
        costoTotal: incidentesBase.reduce((suma, incidente) => suma + (Number(incidente.costo) || 0), 0),
      },
      informesAuditoria: resumenInformes.slice(0, 30),
      indicadoresMonitoreo: Array.isArray(safeMonitoreo) ? safeMonitoreo.slice(0, 30) : safeMonitoreo,
    };

    const resIA = await apiService.consultarAuditor({
      prompt: `Pregunta de Control Interno: "${consultaFinal}"
Responde solo con lo que muestran los datos, en español, en markdown breve (títulos cortos y viñetas). Cita los identificadores (RSK, PLA, referencia del hallazgo, control). Si los datos no permiten responder algo, dilo. No escribas niveles, porcentajes de confianza ni urgencias que no estén en los datos.`,
      datosContexto: contextoDatos,
    });
    const respuestaIA = resIA?.respuesta || resIA;
    
    if (typeof respuestaIA === 'object' && respuestaIA !== null) {
      setAuditorRespuesta(respuestaIA.summary || respuestaIA.dictamen || "Análisis completado. Revisa el informe detallado en pantalla.");
      setAiModal({
        titulo: respuestaIA.title || respuestaIA.titulo || "Informe Ejecutivo de Auditoría GRC",
        contenido: respuestaIA
      });
    } else {
      setAuditorRespuesta(respuestaIA);
    }
  } catch (error) {
    console.error("🔍 Error IA:", error);
    setAuditorRespuesta(`❌ Error al consultar al asistente: ${error.message}`);
  } finally {
    setIsAuditorThinking(false);
  }
};