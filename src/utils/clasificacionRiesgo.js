// 🏷️ Clasificación del riesgo (Manual de Riesgos, Tabla 5): convierte cualquier variante escrita (mayúsculas,
// tildes, errores de digitación o textos de Excel) a una de las 7 clasificaciones del manual.
import { CLASIFICACIONES_MANUAL } from '../constants/diccionariosGRC.js';

const clave = texto => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Palabras que identifican cada clasificación (en orden: "fraude" se decide antes que "externo").
const REGLAS = [
  [texto => texto.includes('fraude') && texto.includes('intern'), 'Fraude Interno'],
  [texto => texto.includes('fraude') && texto.includes('extern'), 'Fraude Externo'],
  [texto => texto.includes('ejecucion') || texto.includes('administracion de proceso') || texto.includes('administracion del proceso'), 'Ejecución y administración de procesos'],
  [texto => texto.includes('tecnolog'), 'Fallas Tecnológicas'],
  [texto => texto.includes('laboral'), 'Relaciones Laborales'],
  [texto => texto.includes('usuario') || texto.includes('producto'), 'Usuarios, productos y practicas'],
  [texto => texto.includes('dano') || texto.includes('activo'), 'Daños a activos fijos/ eventos externos'],
];

/** Clasificación del manual para un texto; si no se reconoce, devuelve el texto original (sin espacios sobrantes). */
export function normalizarClasificacion(valor) {
  const original = String(valor || '').trim();
  if (!original) return '';
  const exacta = CLASIFICACIONES_MANUAL.find(clasificacion => clave(clasificacion) === clave(original));
  if (exacta) return exacta;
  const texto = clave(original);
  const regla = REGLAS.find(([coincide]) => coincide(texto));
  return regla ? regla[1] : original;
}

/** Clasificación para mostrar y filtrar un riesgo. */
export const clasificacionDeRiesgo = riesgo => normalizarClasificacion(riesgo?.clasificacionRiesgo || riesgo?.categoria) || 'Sin clasificación';
