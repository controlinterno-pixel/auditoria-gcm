// 🚫 "No aplica" de un hallazgo: el ejecutor lo propone con justificación y el auditor del informe lo aprueba
// o rechaza. Aprobado es definitivo: el hallazgo se cierra y sus acciones abiertas quedan en estado
// "No aplica" (no se borran; conservan su historial y salen de tareas, alertas y vencidos).

export const ESTADO_PLAN_NO_APLICA = 'No aplica';
export const MOTIVO_MINIMO_NO_APLICA = 10;

/** 'Pendiente' | 'Aprobado' | 'Rechazado' | null. Reconoce los cierres "NO APLICA" anteriores a este flujo. */
export function estadoNoAplica(hallazgo) {
  const estado = hallazgo?.noAplica?.estado;
  if (['Pendiente', 'Aprobado', 'Rechazado'].includes(estado)) return estado;
  const historial = Array.isArray(hallazgo?.historialCambios) ? hallazgo.historialCambios : [];
  const ultimoNoAplica = [...historial].reverse().find(entrada => /NO APLICA/i.test(String(entrada?.accion || '')));
  return hallazgo?.estado === 'Cerrado' && ultimoNoAplica ? 'Aprobado' : null;
}

export const hallazgoNoAplica = hallazgo => estadoNoAplica(hallazgo) === 'Aprobado';
export const noAplicaPendiente = hallazgo => estadoNoAplica(hallazgo) === 'Pendiente';

/** Acción cerrada por un "No aplica" aprobado. */
export const planNoAplica = plan => plan?.estadoWorkflow === ESTADO_PLAN_NO_APLICA || plan?.noAplica === true;

/** Acción que ya no cuenta como abierta ni vencida (cerrada o No aplica). */
export const planFinalizado = plan => planNoAplica(plan) || plan?.estadoWorkflow === 'Cerrado' || plan?.estado === 'Cerrado';

/** Justificación del "No aplica" (también la de los cierres anteriores, tomada del historial). */
export function justificacionNoAplica(hallazgo) {
  if (hallazgo?.noAplica?.justificacion) return hallazgo.noAplica.justificacion;
  const historial = Array.isArray(hallazgo?.historialCambios) ? hallazgo.historialCambios : [];
  const entrada = [...historial].reverse().find(item => /NO APLICA/i.test(String(item?.accion || '')));
  return String(entrada?.accion || '').replace(/^.*Justificación:\s*/i, '').trim();
}
