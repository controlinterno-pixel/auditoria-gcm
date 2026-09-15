// src/services/aiEngine.js
import { consultarCopilotoIA } from './gemini';

// Helper para mantener los cálculos matemáticos locales
const calcularMetricasMatematicas = (riesgo) => {
  const totalControles = Array.isArray(riesgo.controlesDetallados) 
    ? riesgo.controlesDetallados.length 
    : (riesgo.controles ? riesgo.controles.length : 1);

  const impact = Number(riesgo.impacto) || 3;
  const probabilidad = Number(riesgo.probabilidad) || 3;

  const scoreRiesgo = Math.min(Math.max(Math.round(((impact * probabilidad) / 25) * 100), 15), 95);
  const scoreMadurez = Math.min(Math.max(totalControles * 15, 20), 90);
  const coberturaControles = Math.min(Math.round((scoreMadurez * 0.9) + 5), 100);

  let riesgoResidualLabel = "Bajo";
  if (scoreRiesgo > 60) riesgoResidualLabel = "Alto";
  else if (scoreRiesgo > 35) riesgoResidualLabel = "Medio";

  let riesgoInherenteLabel = "Alto";
  if (impact * probabilidad < 8) riesgoInherenteLabel = "Bajo";
  else if (impact * probabilidad < 16) riesgoInherenteLabel = "Medio";

  return { scoreRiesgo, scoreMadurez, totalControles, coberturaControles, riesgoInherenteLabel, riesgoResidualLabel };
};

export const analizarRiesgoConIA = async (riesgo) => {
  const metricasFijas = calcularMetricasMatematicas(riesgo);
  
  const prompt = typeof riesgo === 'string' ? riesgo : `
  Eres el Socio Director de Auditoría de un Software GRC Enterprise.
  Analiza el siguiente riesgo y devuelve un dictamen cuantitativo y estratégico:
  ${JSON.stringify(riesgo, null, 2)}
  `;

  // Se delega la ejecución al servidor mediante /api/audit
  const respuesta = await consultarCopilotoIA(prompt, { metricasFijas, riesgo });
  return respuesta;
};

export const generarDictamenEjecutivo = async (datosContexto) => {
  const prompt = `Actúa como un Socio Director Global de Consultoría GRC. Analiza los siguientes datos corporativos:
  ${typeof datosContexto === 'object' ? JSON.stringify(datosContexto, null, 2) : datosContexto}`;

  const respuesta = await consultarCopilotoIA(prompt, { tipo: 'dictamen_ejecutivo' });
  return respuesta;
};