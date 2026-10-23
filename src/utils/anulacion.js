// 🚫 Anulación de riesgos y controles con trazabilidad.
// Anular no borra: el registro queda con estado 'Anulado', el motivo, la fecha y el usuario, y deja de contar en
// los cálculos (residual, eficacia promedio) y en los indicadores. Se puede reactivar dejando también el historial.

export const MOTIVOS_ANULACION = ['Reemplazado por otro', 'Ya no aplica', 'Otro'];
export const LONGITUD_MINIMA_MOTIVO = 10;

export const estaAnulado = registro => registro?.estado === 'Anulado';
export const vigentes = lista => (Array.isArray(lista) ? lista : []).filter(registro => !estaAnulado(registro));

const marcaTiempo = ahora => ({ fecha: ahora.toLocaleString('es-CO', { timeZone: 'America/Bogota' }), timestamp: ahora.toISOString() });

/** Valida el motivo de una anulación o reactivación. Devuelve el texto del error o ''. */
export function validarMotivo({ tipoMotivo, motivo }, { exigirTipo = true } = {}) {
  if (exigirTipo && !MOTIVOS_ANULACION.includes(tipoMotivo)) return 'Selecciona el motivo de la anulación.';
  if (String(motivo || '').trim().length < LONGITUD_MINIMA_MOTIVO) return `Explica el motivo (mínimo ${LONGITUD_MINIMA_MOTIVO} caracteres).`;
  return '';
}

export function anular(registro, { usuario, tipoMotivo, motivo, ahora = new Date() }) {
  return {
    ...registro,
    estado: 'Anulado',
    anulacion: { ...marcaTiempo(ahora), usuario, tipoMotivo, motivo: String(motivo).trim() },
  };
}

// `anulacion: null` (no se omite) para que el guardado por fusión del servidor también la quite.
export const reactivar = registro => ({ ...registro, estado: 'Activo', anulacion: null });

/** Entrada para el historialCambios del riesgo. */
export const entradaHistorial = ({ usuario, accion, motivo, ahora = new Date() }) => ({
  ...marcaTiempo(ahora), usuario, accion, ...(motivo ? { motivo: String(motivo).trim() } : {}),
});

/**
 * Regla para quien no es administrador: un control guardado no se borra, se anula. Devuelve el error o ''.
 * Compara cuántos controles tenía el riesgo guardado con los que se envían.
 */
export function revisarControlesEliminados(existente, nuevo) {
  const antes = Array.isArray(existente?.controlesDetallados) ? existente.controlesDetallados.length : 0;
  const despues = Array.isArray(nuevo?.controlesDetallados) ? nuevo.controlesDetallados.length : antes;
  return despues < antes
    ? 'Los controles guardados no se eliminan: anúlalos indicando el motivo para conservar el historial.'
    : '';
}
