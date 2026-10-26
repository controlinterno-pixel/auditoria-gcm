// src/services/aiEngine.js
import { apiService } from './apiService';
// Estructura del "Panel Ejecutivo" (ModalIA). Las cifras (kpis, niveles) las pone el sistema, no la IA.
const ESTRUCTURA_PANEL = `Responde SOLO con un objeto JSON con exactamente estas claves:
{
  "analisisEjecutivo": "dos párrafos separados por \\n\\n: qué muestran los datos y por qué importa para el negocio",
  "recomendaciones": ["de 3 a 5 recomendaciones concretas; cita los RSK/CTL a los que aplican"],
  "planAccion": [{ "prioridad": "ALTA | MEDIA | BAJA", "accion": "acción verificable", "responsable": "cargo del contexto; si figura 'Sin asignar', usa responsableSegunManual si existe; si no, 'Por asignar'" }],
  "dictamenDirector": "conclusión de 1 a 2 frases para la Dirección",
  "iso31000": "solo si aporta algo específico de estos datos (cita RSK/CTL); si no, cadena vacía",
  "cosoErm": "solo si aporta algo específico de estos datos (cita RSK/CTL); si no, cadena vacía",
  "kris": "1 a 3 indicadores con su valor actual de DATOS_GRC y una meta que sea una cifra exacta de las simulaciones de los datos, diciendo de qué acción sale; omite el indicador si ninguna simulación le da meta o si la meta sería igual al valor actual; si no queda ninguno, cadena vacía"
}
No incluyas cifras que no estén en DATOS_GRC. Prefiere una sección vacía antes que una frase genérica que serviría para cualquier empresa.`;

// Dictamen por control: plan, recomendaciones e indicadores los arma el código (dictamenControlIA.js);
// la IA solo redacta lo que interpreta.
export const ESTRUCTURA_DICTAMEN_CONTROL = `Responde SOLO con un objeto JSON con exactamente estas claves:
{
  "analisisEjecutivo": "dos párrafos separados por \\n\\n: 1) qué muestra el cálculo de este control (su eficacia frente al máximo de su tipo, qué pasa con el riesgo si falla y si se automatiza, si la zona cambia) y la alerta de Trabajo de Campo si existe; 2) por qué importa para el negocio en este riesgo",
  "observacionCausaRaiz": "1 o 2 frases: si lo que hace el control (su descripción) ataca la causa inmediata o la causa raíz del riesgo, y qué deja sin cubrir; cadena vacía si faltan la descripción o las causas",
  "dictamenDirector": "conclusión de 1 a 2 frases para la Dirección, coherente con el plan del sistema",
  "iso31000": "solo si aporta algo específico de este control (cítalo); si no, cadena vacía",
  "cosoErm": "solo si aporta algo específico de este control (cítalo); si no, cadena vacía"
}
Usa solo cifras que estén en DATOS_GRC. Prefiere una cadena vacía antes que una frase genérica.`;

// Dictamen de un riesgo y de la matriz: igual que el del control, el plan y los KRIs los arma el código.
export const ESTRUCTURA_DICTAMEN_RIESGO = `Responde SOLO con un objeto JSON con exactamente estas claves:
{
  "analisisEjecutivo": "dos párrafos separados por \\n\\n: 1) si la reducción de inherente a residual es creíble según el diseño, la formalización y las pruebas de campo de cada control, y de cuáles controles (por código) depende; 2) por qué importa para el negocio",
  "observacionCausaRaiz": "1 o 2 frases: si los controles atacan la causa inmediata y la causa raíz del riesgo, y qué queda sin cubrir; cadena vacía si faltan las causas o las descripciones",
  "dictamenDirector": "conclusión de 1 a 2 frases para la Dirección, coherente con el plan del sistema",
  "iso31000": "solo si aporta algo específico de este riesgo (cítalo); si no, cadena vacía",
  "cosoErm": "solo si aporta algo específico de este riesgo (cítalo); si no, cadena vacía"
}
Usa solo cifras que estén en DATOS_GRC; no calcules porcentajes nuevos. Prefiere una cadena vacía antes que una frase genérica.`;

export const ESTRUCTURA_DICTAMEN_MATRIZ = `Responde SOLO con un objeto JSON con exactamente estas claves:
{
  "analisisEjecutivo": "dos párrafos separados por \\n\\n: 1) dónde se concentra la exposición (procesos y riesgos por código) y si la reducción de inherente a residual es creíble según la calidad real de los controles; 2) por qué importa para el negocio",
  "dictamenDirector": "conclusión de 1 a 2 frases para la Junta Directiva, coherente con el plan del sistema",
  "iso31000": "solo si aporta algo específico de estos datos (cita RSK); si no, cadena vacía",
  "cosoErm": "solo si aporta algo específico de estos datos (cita RSK); si no, cadena vacía"
}
Usa solo cifras que estén en DATOS_GRC; no calcules porcentajes nuevos. Prefiere una cadena vacía antes que una frase genérica.`;

// Análisis con datos separados de la instrucción y respuesta en JSON.
// `estructura` permite pedir solo los campos que redacta la IA (p. ej. el dictamen por control).
export const consultarPanelIA = async ({ instruccion, datos, estructura = ESTRUCTURA_PANEL }) => {
  const res = await apiService.consultarAuditor({
    prompt: `${instruccion}\n\n${estructura}`,
    datosContexto: datos,
    formato: 'json',
  });
  return res?.respuesta || res;
};
