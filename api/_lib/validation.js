// api/_lib/validation.js - Validaciones de entrada compartidas por los endpoints GRC (H10, H13).

// Claves que el cliente puede guardar mediante POST /api/grc/sync y el tipo esperado de cada una.
const ESQUEMA_SYNC = {
  riesgos: 'lista-objetos',
  hallazgos: 'lista-objetos',
  planes: 'lista-objetos',
  informesAuditoria: 'lista-objetos',
  evaluaciones: 'lista-objetos',
  comites: 'lista-objetos',
  incidentes: 'lista-objetos',
  cronograma: 'lista-objetos',
  monitoreo: 'lista-objetos',
  fuentesMejora: 'lista-objetos',
  programas: 'lista-objetos',
  catalogoCargos: 'lista-objetos',
  auditoresLista: 'lista',
  sedesEmpresa: 'lista-textos',
  organizacionesExternas: 'lista-textos',
  rolesProyecto: 'lista-objetos',
  informesEliminados: 'lista-textos',
  planesEliminados: 'lista-textos',
  // Botón Eliminar: lo que se borra va explícito; guardar una lista nunca borra lo que no viene en ella.
  hallazgosEliminados: 'lista-textos',
  evaluacionesEliminados: 'lista-textos',
  comitesEliminados: 'lista-textos',
  incidentesEliminados: 'lista-textos',
  cronogramaEliminados: 'lista-textos',
  monitoreoEliminados: 'lista-textos',
  programasEliminados: 'lista-textos',
  fuentesMejoraEliminados: 'lista-textos',
  mapaProcesos: 'objeto',
  catalogosInicializados: 'booleano',
  riesgosReemplazoTotal: 'booleano',
  reemplazoTotal: 'booleano', // restaurar un respaldo completo: reemplaza todas las listas enviadas
};
const MAX_ELEMENTOS = 5000;
const MAX_TEXTO_ID = 200;

const esObjetoPlano = valor => Boolean(valor) && typeof valor === 'object' && !Array.isArray(valor);

const cumpleTipo = (tipo, valor) => {
  switch (tipo) {
    case 'lista-objetos': return Array.isArray(valor) && valor.length <= MAX_ELEMENTOS && valor.every(item => item === null || esObjetoPlano(item));
    case 'lista': return Array.isArray(valor) && valor.length <= MAX_ELEMENTOS;
    case 'lista-textos': return Array.isArray(valor) && valor.length <= MAX_ELEMENTOS &&
      valor.every(item => (typeof item === 'string' || typeof item === 'number') && String(item).length <= MAX_TEXTO_ID);
    case 'objeto': return esObjetoPlano(valor);
    case 'booleano': return typeof valor === 'boolean';
    default: return false;
  }
};

/** Lista blanca de claves y tipos para POST /api/grc/sync. */
export function validarDatosSync(partialData) {
  if (!esObjetoPlano(partialData)) return { valido: false, error: 'Estructura de datos (partialData) inválida o ausente.' };
  const claves = Object.keys(partialData);
  if (claves.length === 0) return { valido: false, error: 'No se enviaron datos para guardar.' };
  const desconocidas = claves.filter(clave => !Object.hasOwn(ESQUEMA_SYNC, clave));
  if (desconocidas.length > 0) {
    return { valido: false, error: `Campos no permitidos: ${desconocidas.slice(0, 10).join(', ').slice(0, 300)}.` };
  }
  const invalidas = claves.filter(clave => !cumpleTipo(ESQUEMA_SYNC[clave], partialData[clave]));
  if (invalidas.length > 0) return { valido: false, error: `Formato inválido en: ${invalidas.join(', ')}.` };
  return { valido: true };
}

// Solo se aceptan enlaces http/https en campos de URL (impide javascript:, data:, etc.).
export const esUrlPermitida = valor => {
  try {
    const url = new URL(String(valor));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Copia profunda en la que todo campo de texto cuyo nombre contenga "url" y no sea un enlace http/https
 * queda vacío. Replica en el servidor la regla que ya aplica el cliente al guardar.
 */
export function sanitizarUrls(valor, profundidad = 0) {
  if (profundidad > 20 || valor === null || typeof valor !== 'object') return valor;
  if (Array.isArray(valor)) return valor.map(item => sanitizarUrls(item, profundidad + 1));
  return Object.fromEntries(Object.entries(valor).map(([clave, contenido]) => {
    if (typeof contenido === 'string' && /url/i.test(clave) && contenido.trim() !== '' && !esUrlPermitida(contenido.trim())) {
      return [clave, ''];
    }
    return [clave, sanitizarUrls(contenido, profundidad + 1)];
  }));
}
