// 🕑 Fecha y hora de una entrada de historial en la hora del equipo.
// Usa el registro exacto (timestamp ISO) si existe: el texto "fecha" de entradas antiguas lo escribió
// el servidor en UTC y quedaba 5 horas adelantado frente a Colombia.
export function fechaEntradaHistorial(entrada) {
  const tiempo = Date.parse(entrada?.timestamp || '');
  return Number.isFinite(tiempo) ? new Date(tiempo).toLocaleString('es-CO') : (entrada?.fecha || 'Sin fecha');
}
