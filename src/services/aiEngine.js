// src/services/aiEngine.js
import { apiService } from './apiService';
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
  // Con un texto ya armado no hay métricas que calcular: enviar métricas sobre un texto produce cifras falsas.
  if (typeof riesgo === 'string') {
    const res = await apiService.consultarAuditor({ prompt: riesgo });
    return res?.respuesta || res;
  }
  const metricasFijas = calcularMetricasMatematicas(riesgo);
  const prompt = `
  Eres el Socio Director de Auditoría de un Software GRC Enterprise.
  Analiza el siguiente riesgo y devuelve un dictamen cuantitativo y estratégico:
  ${JSON.stringify(riesgo, null, 2)}
  `;

  // Se delega la ejecución al servidor mediante /api/audit
  const res = await apiService.consultarAuditor({
    prompt,
    datosContexto: { metricasFijas, riesgo }
  });
  return res?.respuesta || res;
};

// Estructura del "Panel Ejecutivo" (ModalIA). Las cifras (kpis, niveles) las pone el sistema, no la IA.
const ESTRUCTURA_PANEL = `Responde SOLO con un objeto JSON con exactamente estas claves:
{
  "analisisEjecutivo": "dos párrafos separados por \\n\\n: qué muestran los datos y por qué importa para el negocio",
  "recomendaciones": ["de 3 a 5 recomendaciones concretas; cita los RSK/CTL a los que aplican"],
  "planAccion": [{ "prioridad": "ALTA | MEDIA | BAJA", "accion": "acción verificable", "responsable": "cargo; usa el del contexto si existe, si no 'Por asignar'" }],
  "dictamenDirector": "conclusión de 1 a 2 frases para la Dirección",
  "iso31000": "lectura breve bajo ISO 31000 basada en estos datos",
  "cosoErm": "lectura breve bajo COSO ERM basada en estos datos",
  "kris": "2 o 3 indicadores clave de riesgo con meta sugerida, derivados de estos datos"
}
No incluyas cifras que no estén en DATOS_GRC.`;

// Análisis con datos separados de la instrucción y respuesta en JSON.
export const consultarPanelIA = async ({ instruccion, datos }) => {
  const res = await apiService.consultarAuditor({
    prompt: `${instruccion}\n\n${ESTRUCTURA_PANEL}`,
    datosContexto: datos,
    formato: 'json',
  });
  return res?.respuesta || res;
};

export const generarDictamenEjecutivo = async (datosContexto) => {
  const prompt = `Actúa como un Socio Director Global de Consultoría GRC. Analiza los siguientes datos corporativos:
  ${typeof datosContexto === 'object' ? JSON.stringify(datosContexto, null, 2) : datosContexto}`;

const res = await apiService.consultarAuditor({
    prompt,
    datosContexto: typeof datosContexto === 'object' ? datosContexto : { datosContexto }
  });
  return res?.respuesta || res;
};