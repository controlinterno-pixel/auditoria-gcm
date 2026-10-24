// La IA a veces devuelve una sección como lista u objeto (p. ej. kris: [{ indicador, valorActual, meta }]).
// Todo se convierte a texto legible: un objeto pintado tal cual hace caer el módulo completo.
export function aTexto(valor) {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
  if (Array.isArray(valor)) return valor.map(aTexto).filter(Boolean).join('\n');
  if (typeof valor === 'object') {
    return Object.entries(valor)
      .filter(([, contenido]) => contenido !== null && contenido !== undefined && contenido !== '')
      .map(([clave, contenido]) => `${clave.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, letra => letra.toUpperCase())}: ${aTexto(contenido)}`)
      .join(' · ');
  }
  return '';
}
