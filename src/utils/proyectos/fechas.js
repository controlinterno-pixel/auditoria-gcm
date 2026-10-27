// src/utils/proyectos/fechas.js - Fechas 'AAAA-MM-DD' sin zona horaria (las de un cronograma son días, no instantes).

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const DIA_MS = 86400000;

export const esFecha = valor => typeof valor === 'string' && FECHA.test(valor) && !Number.isNaN(Date.parse(`${valor}T00:00:00Z`))
  && new Date(`${valor}T00:00:00Z`).toISOString().slice(0, 10) === valor;

const aDia = fecha => Date.parse(`${fecha}T00:00:00Z`) / DIA_MS;
const deDia = dia => new Date(dia * DIA_MS).toISOString().slice(0, 10);

/** Hoy en Colombia (UTC-5), para que "vencido" no cambie a las 7 p. m. por la hora UTC del servidor. */
export const hoyColombia = (ahora = new Date()) => new Date(ahora.getTime() - 5 * 3600000).toISOString().slice(0, 10);

export const diasEntre = (desde, hasta) => aDia(hasta) - aDia(desde);
const esLaboral = dia => { const semana = new Date(dia * DIA_MS).getUTCDay(); return semana !== 0 && semana !== 6; };

/** Suma `dias` (puede ser negativo) en días calendario o solo laborales (lunes a viernes). */
export function sumarDias(fecha, dias, calendario = 'calendario') {
  let dia = aDia(fecha);
  if (calendario !== 'laboral') return deDia(dia + dias);
  const paso = dias < 0 ? -1 : 1;
  for (let restantes = Math.abs(dias); restantes > 0;) {
    dia += paso;
    if (esLaboral(dia)) restantes -= 1;
  }
  return deDia(dia);
}

/** Duración incluyendo ambos extremos (una tarea de un solo día dura 1). */
export function duracion(inicio, fin, calendario = 'calendario') {
  if (!esFecha(inicio) || !esFecha(fin) || fin < inicio) return 0;
  if (calendario !== 'laboral') return diasEntre(inicio, fin) + 1;
  let total = 0;
  for (let dia = aDia(inicio); dia <= aDia(fin); dia += 1) if (esLaboral(dia)) total += 1;
  return total;
}

/** Primer día hábil igual o posterior (en calendario laboral); en calendario normal, la misma fecha. */
export const ajustarAHabil = (fecha, calendario = 'calendario') => (calendario === 'laboral' && !esLaboral(aDia(fecha)) ? sumarDias(fecha, 1, 'laboral') : fecha);
