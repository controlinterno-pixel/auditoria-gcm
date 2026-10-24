// src/services/aiEngine.js
import { apiService } from './apiService';
// Estructura del "Panel Ejecutivo" (ModalIA). Las cifras (kpis, niveles) las pone el sistema, no la IA.
const ESTRUCTURA_PANEL = `Responde SOLO con un objeto JSON con exactamente estas claves:
{
  "analisisEjecutivo": "dos párrafos separados por \\n\\n: qué muestran los datos y por qué importa para el negocio",
  "recomendaciones": ["de 3 a 5 recomendaciones concretas; cita los RSK/CTL a los que aplican"],
  "planAccion": [{ "prioridad": "ALTA | MEDIA | BAJA", "accion": "acción verificable", "responsable": "cargo; usa el del contexto si existe, si no 'Por asignar'" }],
  "dictamenDirector": "conclusión de 1 a 2 frases para la Dirección",
  "iso31000": "solo si aporta algo específico de estos datos (cita RSK/CTL); si no, cadena vacía",
  "cosoErm": "solo si aporta algo específico de estos datos (cita RSK/CTL); si no, cadena vacía",
  "kris": "2 o 3 indicadores medibles con estos datos, con su valor actual tomado de DATOS_GRC y una meta propuesta marcada como 'propuesta'; si no hay datos para medirlos, cadena vacía"
}
No incluyas cifras que no estén en DATOS_GRC. Prefiere una sección vacía antes que una frase genérica que serviría para cualquier empresa.`;

// Análisis con datos separados de la instrucción y respuesta en JSON.
export const consultarPanelIA = async ({ instruccion, datos }) => {
  const res = await apiService.consultarAuditor({
    prompt: `${instruccion}\n\n${ESTRUCTURA_PANEL}`,
    datosContexto: datos,
    formato: 'json',
  });
  return res?.respuesta || res;
};
