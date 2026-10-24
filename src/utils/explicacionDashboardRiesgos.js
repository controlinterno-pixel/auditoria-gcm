// 💡 Explicaciones del Dashboard de riesgos (chulitos verdes): cada una se arma con los riesgos del filtro actual,
// nunca con texto igual para todos. Reglas del Manual E-GE-MAN-001 (Tablas 2–4, 6 y 8 y numeral 9).
import { desglosarEficaciaControl } from './explicacionControles.js';
import { ESCALA_IMPACTO, ESCALA_PROBABILIDAD, riesgoEnPorcentaje, zonaSeveridad } from './nivelRiesgo.js';
import { estaAnulado } from './anulacion.js';

const numero = valor => Number(valor).toLocaleString('es-CO', { maximumFractionDigits: 1 });
const plural = (cantidad, singular, varios) => `${cantidad} ${cantidad === 1 ? singular : varios}`;
const controlesDe = riesgo => (Array.isArray(riesgo?.controlesDetallados) ? riesgo.controlesDetallados.filter(Boolean) : []);
const controlesVigentes = riesgo => controlesDe(riesgo).filter(control => !estaAnulado(control));

// Calificación de la eficacia sobre el máximo de la Tabla 6 (50 %): la misma escala del Excel.
export function calificarEficacia(promedio) {
  const redondeado = Math.round(promedio);
  if (redondeado >= 45) return { calificacion: 'Excelente', meta: null };
  if (redondeado >= 40) return { calificacion: 'Bueno', meta: { nombre: 'Excelente', valor: 45 } };
  if (redondeado >= 30) return { calificacion: 'Regular', meta: { nombre: 'Bueno', valor: 40 } };
  return { calificacion: 'Malo', meta: { nombre: 'Regular', valor: 30 } };
}

const COMBINACIONES = [
  ['Preventivo', 'Automático', ['preventivo automático', 'preventivos automáticos'], 50],
  ['Preventivo', 'Manual', ['preventivo manual', 'preventivos manuales'], 40],
  ['Detectivo', 'Automático', ['detectivo automático', 'detectivos automáticos'], 40],
  ['Detectivo', 'Manual', ['detectivo manual', 'detectivos manuales'], 30],
  ['Correctivo', 'Automático', ['correctivo automático', 'correctivos automáticos'], 35],
  ['Correctivo', 'Manual', ['correctivo manual', 'correctivos manuales'], 25],
];

/** Controles registrados: cuántos hay, de qué tipo y cómo se reparten entre los riesgos del filtro. */
export function explicarControlesRegistrados({ riesgos, alcance }) {
  const estructurados = riesgos.flatMap(controlesDe);
  const legados = riesgos.filter(riesgo => controlesDe(riesgo).length === 0 && riesgo.descripcionControl).length;
  const total = estructurados.length + legados;
  const desgloses = estructurados.map(desglosarEficaciaControl);
  const porTipo = ['Preventivo', 'Detectivo', 'Correctivo'].map(tipo => [tipo, desgloses.filter(d => d.tipo === tipo).length]);
  const automaticos = desgloses.filter(d => d.implementacion === 'Automático').length;
  const masControles = [...riesgos].sort((a, b) => controlesDe(b).length - controlesDe(a).length)[0];
  const sinControles = riesgos.filter(riesgo => controlesDe(riesgo).length === 0).length;
  const anulados = estructurados.filter(control => estaAnulado(control)).length;
  return {
    titulo: 'Controles registrados',
    valor: String(total),
    lineas: [
      `Es la cantidad de controles registrados en los ${plural(riesgos.length, 'riesgo', 'riesgos')} de ${alcance}: ${total} en total${riesgos.length ? `, ${numero(total / riesgos.length)} por riesgo en promedio` : ''}.`,
      `${estructurados.length} están estructurados (con tipo e implementación) y ${legados} son descripciones de texto de matrices anteriores, sin esos atributos.`,
      estructurados.length ? `Por tipo: ${porTipo.map(([tipo, cantidad]) => `${cantidad} ${tipo.toLowerCase()}${cantidad === 1 ? '' : 's'}`).join(', ')}. Por implementación: ${automaticos} automáticos y ${estructurados.length - automaticos} manuales.` : '',
      masControles && controlesDe(masControles).length ? `El riesgo con más controles es RSK-${masControles.id} (${controlesDe(masControles).length}).` : '',
      anulados ? `${plural(anulados, 'control está anulado', 'controles están anulados')}: aparece${anulados === 1 ? '' : 'n'} en el registro pero no reduce${anulados === 1 ? '' : 'n'} el riesgo.` : '',
    ].filter(Boolean),
    accion: sinControles ? `${plural(sinControles, 'riesgo no tiene', 'riesgos no tienen')} controles estructurados: su residual no se reduce hasta registrarlos.` : 'Todos los riesgos del filtro tienen al menos un control estructurado.',
  };
}

/** Eficacia promedio: mezcla real de tipos e implementación (Tabla 6), calificación y qué la subiría. */
export function explicarEficaciaPromedio({ riesgos, alcance }) {
  const desgloses = riesgos.flatMap(controlesVigentes).map(desglosarEficaciaControl);
  if (desgloses.length === 0) {
    return { titulo: 'Eficacia promedio', valor: '0%', lineas: [`Los riesgos de ${alcance} no tienen controles estructurados vigentes, por eso la eficacia promedio es 0 %.`], accion: 'Registra los controles de cada riesgo con su tipo e implementación.' };
  }
  const promedio = desgloses.reduce((suma, d) => suma + d.total, 0) / desgloses.length;
  const detalle = COMBINACIONES.map(([tipo, implementacion, etiqueta, puntos]) => {
    const cantidad = desgloses.filter(d => d.tipo === tipo && d.implementacion === implementacion).length;
    return cantidad ? `${plural(cantidad, etiqueta[0], etiqueta[1])} (${puntos} %)` : '';
  }).filter(Boolean).join(', ');
  const manuales = desgloses.filter(d => d.implementacion === 'Manual').length;
  const maximoAlcanzable = desgloses.reduce((suma, d) => suma + d.maximoPosible, 0) / desgloses.length;
  const { calificacion, meta } = calificarEficacia(promedio);
  const faltan = meta ? Math.max(0, meta.valor - promedio) : 0;
  const porAutomatizar = Math.ceil((faltan * desgloses.length) / 10);
  return {
    titulo: 'Eficacia promedio',
    valor: `${Math.round(promedio)}%`,
    lineas: [
      `Cada control vale su tipo (Preventivo 25, Detectivo 15, Correctivo 10) más su implementación (Automático 25, Manual 15), según la Tabla 6 del manual. El máximo es 50 % (preventivo automático).`,
      `En ${alcance} hay ${desgloses.length} controles vigentes: ${detalle}. El promedio es ${numero(promedio)} %.`,
      `Calificación: ${calificacion} (${Math.round((promedio / 50) * 100)} % del máximo). Escala: Excelente ≥ 45 % · Bueno 40–44 % · Regular 30–39 % · Malo < 30 %.`,
      `Con el tipo de estos controles, lo máximo alcanzable automatizándolos todos sería ${numero(maximoAlcanzable)} %.`,
    ],
    accion: meta
      ? `Para subir a ${meta.nombre} (${meta.valor} %) faltan ${numero(faltan)} puntos${porAutomatizar > 0 && porAutomatizar <= manuales ? `: equivale a automatizar ${porAutomatizar} de los ${manuales} controles manuales` : ''}.`
      : 'Está en el nivel más alto: mantener los controles y verificar que sigan operando.',
  };
}

const exposicion = (riesgo, momento) => {
  const p = Number(momento === 'inherente' ? riesgo.probabilidadInherente ?? 60 : riesgo.probabilidadResidual ?? 15);
  const i = Number(momento === 'inherente' ? riesgo.impactoInherente ?? 60 : riesgo.impactoResidual ?? 30);
  return { p, i, valor: p * i };
};

/** Mitigación promedio: cuánto reducen los controles la exposición (probabilidad × impacto) de cada riesgo. */
export function explicarMitigacionPromedio({ riesgos, alcance, calcularMitigacion }) {
  if (riesgos.length === 0) return { titulo: 'Mitigación promedio', valor: '0%', lineas: [`No hay riesgos en ${alcance}.`] };
  const conMitigacion = riesgos.map(riesgo => ({ riesgo, mitigacion: calcularMitigacion(riesgo) }))
    .sort((a, b) => b.mitigacion - a.mitigacion);
  const promedio = Math.round(conMitigacion.reduce((suma, item) => suma + item.mitigacion, 0) / conMitigacion.length);
  const mayor = conMitigacion[0];
  const menor = conMitigacion[conMitigacion.length - 1];
  const sinMitigacion = conMitigacion.filter(item => item.mitigacion === 0).length;
  const ejemplo = ({ riesgo, mitigacion }) => {
    const unidad = riesgoEnPorcentaje(riesgo) ? '%' : '';
    const inh = exposicion(riesgo, 'inherente');
    const res = exposicion(riesgo, 'residual');
    return `RSK-${riesgo.id}: exposición inherente ${numero(inh.p)}${unidad} × ${numero(inh.i)}${unidad} → residual ${numero(res.p)}${unidad} × ${numero(res.i)}${unidad}; los controles quitan el ${mitigacion} %`;
  };
  return {
    titulo: 'Mitigación promedio',
    valor: `${promedio}%`,
    lineas: [
      'Para cada riesgo se compara la exposición antes de controles (probabilidad × impacto inherentes) con la que queda después (residuales). La mitigación es el porcentaje de exposición que eliminan los controles (Tabla 8: se aplican de forma acumulativa).',
      `El ${promedio} % es el promedio de los ${plural(riesgos.length, 'riesgo', 'riesgos')} de ${alcance}.`,
      `Mayor: ${ejemplo(mayor)}.`,
      conMitigacion.length > 1 ? `Menor: ${ejemplo(menor)}.` : '',
    ].filter(Boolean),
    accion: sinMitigacion
      ? `${plural(sinMitigacion, 'riesgo no reduce', 'riesgos no reducen')} nada su exposición: revisa si ${sinMitigacion === 1 ? 'tiene' : 'tienen'} controles registrados o si su residual quedó igual al inherente.`
      : `Todos los riesgos reducen algo su exposición; el de menor mitigación (RSK-${menor.riesgo.id}, ${menor.mitigacion} %) es el primero a reforzar.`,
  };
}

/** Seguimientos vencidos: fechas de seguimiento pasadas y riesgos que el numeral 9 obliga a seguir. */
export function explicarSeguimientos({ riesgos, alcance, hoy = new Date() }) {
  const fechaHoy = hoy.toLocaleDateString('es-CO');
  const vencidos = riesgos.filter(riesgo => riesgo.fechaSeguimiento && new Date(`${riesgo.fechaSeguimiento}T23:59:59`) < hoy && riesgo.estado !== 'Cerrado');
  const programados = riesgos.filter(riesgo => riesgo.fechaSeguimiento && !vencidos.includes(riesgo));
  const sinFecha = riesgos.filter(riesgo => !riesgo.fechaSeguimiento);
  const zonaResidual = riesgo => zonaSeveridad(riesgo.probabilidadResidual, riesgo.impactoResidual, riesgoEnPorcentaje(riesgo)).label;
  const seguimientoSinFecha = sinFecha.filter(riesgo => ['Moderado', 'Bajo'].includes(zonaResidual(riesgo))).length;
  const proximo = [...programados].sort((a, b) => String(a.fechaSeguimiento).localeCompare(String(b.fechaSeguimiento)))[0];
  return {
    titulo: 'Seguimientos vencidos',
    valor: String(vencidos.length),
    lineas: [
      `Cuenta los riesgos de ${alcance} cuya próxima fecha de seguimiento ya pasó (hoy es ${fechaHoy}).`,
      vencidos.length
        ? `Vencidos: ${vencidos.slice(0, 6).map(riesgo => `RSK-${riesgo.id} (${riesgo.fechaSeguimiento})`).join(', ')}${vencidos.length > 6 ? ` y ${vencidos.length - 6} más` : ''}.`
        : 'Ningún seguimiento está vencido.',
      `${plural(programados.length, 'riesgo tiene', 'riesgos tienen')} fecha programada${proximo ? `; el próximo es RSK-${proximo.id} el ${proximo.fechaSeguimiento}` : ''}. ${plural(sinFecha.length, 'riesgo no tiene', 'riesgos no tienen')} fecha.`,
    ],
    accion: seguimientoSinFecha
      ? `Según el numeral 9 del manual, los riesgos residuales Moderado y Bajo requieren seguimiento: ${plural(seguimientoSinFecha, 'no tiene', 'no tienen')} fecha programada.`
      : 'Todos los riesgos residuales Moderado y Bajo tienen fecha de seguimiento, como pide el numeral 9 del manual.',
  };
}

/** Exposición por proceso: riesgos de cada proceso y cómo se reparten por nivel en el momento elegido. */
export function explicarExposicionPorProceso({ riesgos, topProcesos, nivelRiesgo, nivelActivo }) {
  const niveles = ['Extremo', 'Alto', 'Moderado', 'Bajo'];
  return {
    titulo: 'Exposición por proceso',
    valor: '',
    lineas: [
      `El número de cada barra es la cantidad de riesgos del proceso en el filtro actual. La barra más larga es el proceso con más riesgos. Niveles en momento ${nivelActivo.toLowerCase()}.`,
      ...topProcesos.map(([proceso, cantidad]) => {
        const delProceso = riesgos.filter(riesgo => (riesgo.macroprocesos.length ? riesgo.macroprocesos : ['Sin proceso']).includes(proceso));
        const reparto = niveles.map(nivel => [nivel, delProceso.filter(riesgo => nivelRiesgo(riesgo) === nivel).length]).filter(([, n]) => n > 0);
        return `${proceso}: ${cantidad} — ${reparto.map(([nivel, n]) => `${n} ${nivel}`).join(', ')}.`;
      }),
    ],
    accion: 'Haz clic en un proceso para abrir sus riesgos en Ver matriz.',
  };
}

/** Riesgos de mayor exposición: el puntaje S es nivel de probabilidad × nivel de impacto (1 a 5 cada uno). */
export function explicarMayorExposicion({ riesgos, obtenerCoordenada, nivelRiesgo, nivelActivo }) {
  return {
    titulo: 'Riesgos de mayor exposición',
    valor: '',
    lineas: [
      `El puntaje S es el nivel de probabilidad (1 a 5, Tabla 2) por el nivel de impacto (1 a 5, Tabla 3) en momento ${nivelActivo.toLowerCase()}: va de 1 a 25. La zona sale de la matriz de calor (Tabla 4).`,
      ...riesgos.map(riesgo => {
        const p = obtenerCoordenada(riesgo, 'probabilidad');
        const i = obtenerCoordenada(riesgo, 'impacto');
        return `RSK-${riesgo.id}: S ${p * i} = probabilidad ${p} (${ESCALA_PROBABILIDAD[p - 1]}) × impacto ${i} (${ESCALA_IMPACTO[i - 1]}) → ${nivelRiesgo(riesgo)}.`;
      }),
    ],
    accion: 'Según el numeral 9 del manual, los riesgos en zona Extremo o Alto deben tener plan de acción.',
  };
}
