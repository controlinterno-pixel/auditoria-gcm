// src/utils/proyectos/indicadores.js - Indicadores y semáforo de un proyecto, con fórmulas explícitas.
// El servidor guarda en cada proyecto un "resumen" compacto (compactarPlan) y el tablero calcula los
// indicadores con él y la fecha de hoy: así el portafolio no descarga las tareas de cada proyecto y las cifras
// del tablero, del detalle y de los reportes salen de la misma función.
import { duracion, esFecha, sumarDias } from './fechas.js';
import { esHoja, idsContenedores } from './cronograma.js';
import { ESTADOS_CERRADOS_TAREA, UMBRALES_POR_DEFECTO, nivelRiesgo } from './modelo.js';

export const FORMULAS = {
  avanceReal: 'Σ(peso × avance) ÷ Σ peso de las actividades e historias no canceladas. Peso = esfuerzo estimado en horas; si no lo tiene, los puntos (historias) o su duración en días. Los hitos pesan 0 y las fases o paquetes se calculan con sus hijas.',
  avancePlanificado: 'Σ(peso × fracción planificada a hoy) ÷ Σ peso, con las fechas de la línea base vigente (o las vigentes si aún no hay línea base). Fracción = días transcurridos ÷ duración, entre 0 y 1.',
  desviacionAvance: 'Avance real − avance planificado, en puntos porcentuales (negativo = atraso).',
  cumplimientoHitos: 'Hitos cumplidos a tiempo ÷ hitos evaluables (vencidos o ya cumplidos). A tiempo = fecha real ≤ fecha de la línea base.',
  cumplimientoEntregables: 'Entregables aprobados ÷ entregables con fecha comprometida igual o anterior a hoy.',
  tasaTareasVencidas: 'Tareas abiertas con fecha de fin anterior a hoy ÷ tareas abiertas con fecha de fin.',
  variacionPresupuestal: '(Proyección del costo final − presupuesto vigente) ÷ presupuesto vigente. Proyección = estimación final registrada por el director; si no hay, el EAC del valor ganado, nunca menor que lo ya gastado más lo comprometido. Sin ninguna de las dos no se calcula (real + comprometido es lo gastado a la fecha, no el costo final).',
  consumoPresupuesto: '(Costo real + comprometido) ÷ presupuesto vigente: cuánto del presupuesto ya está gastado o comprometido.',
  riesgosCriticos: 'Riesgos abiertos o en tratamiento cuyo nivel (probabilidad × impacto) es mayor o igual al umbral crítico del proyecto.',
  cumplimientoCompromisos: 'Compromisos cumplidos dentro del plazo ÷ compromisos evaluables (vencidos o cumplidos).',
  evm: 'PV = presupuesto vigente × avance planificado; EV = presupuesto vigente × avance real; AC = costo real; SPI = EV ÷ PV; CPI = EV ÷ AC; EAC = presupuesto vigente ÷ CPI. Solo se calcula con presupuesto, línea base y costos reales registrados.',
};

const numeroEs = valor => Number(valor).toLocaleString('es-CO', { maximumFractionDigits: 1 });
const ratio = (numerador, denominador) => (denominador > 0 ? numerador / denominador : null);
const redondear = (valor, decimales = 1) => (valor === null || !Number.isFinite(valor) ? null : Math.round(valor * 10 ** decimales) / 10 ** decimales);
const ESTADOS_RIESGO_ABIERTOS = ['abierto', 'en_tratamiento'];

/** Resumen compacto del plan que se guarda en el documento del proyecto (solo lo que necesitan los indicadores). */
export function compactarPlan(plan = {}, calendario = 'calendario') {
  const tareas = Array.isArray(plan.tareas) ? plan.tareas : [];
  const contenedores = idsContenedores(tareas);
  const lineaBase = (plan.lineasBase || []).at(-1) || null;
  const costos = (Array.isArray(plan.costos) ? plan.costos : []).filter(costo => costo.estado !== 'anulado');
  const sumar = tipo => costos.filter(costo => costo.tipo === tipo).reduce((suma, costo) => suma + (Number(costo.monto) || 0), 0);
  return {
    tareas: tareas.filter(tarea => esHoja(tarea, contenedores) && tarea.estado !== 'cancelada').map(tarea => {
      const base = lineaBase?.tareas?.[String(tarea.id)] || null;
      const esfuerzo = Number(tarea.esfuerzoHoras);
      return {
        p: tarea.tipo === 'hito' ? 0 : esfuerzo > 0 ? esfuerzo : tarea.tipo === 'historia' && Number(tarea.puntos) > 0 ? Number(tarea.puntos)
          : Math.max(duracion(tarea.inicio, tarea.fin, calendario), tarea.tipo === 'historia' ? 1 : 0),
        ib: base?.inicio || '', fb: base?.fin || '', i: tarea.inicio || '', f: tarea.fin || '',
        a: Number(tarea.avance) || 0, e: tarea.estado, h: tarea.tipo === 'hito' ? 1 : 0, fr: tarea.finReal || '',
      };
    }),
    entregables: (plan.entregables || []).map(entregable => ({ f: entregable.fechaComprometida || '', e: entregable.estado })),
    riesgos: (plan.riesgos || []).map(riesgo => ({ t: riesgo.tipo, e: riesgo.estado, n: nivelRiesgo(riesgo.probabilidad, riesgo.impacto) })),
    compromisos: (plan.reuniones || []).flatMap(reunion => reunion.compromisos || [])
      .map(compromiso => ({ f: compromiso.fechaLimite || '', e: compromiso.estado, fc: compromiso.fechaCumplimiento || '' })),
    finanzas: { real: sumar('real'), comprometido: sumar('comprometido'), hayCostosReales: costos.some(costo => costo.tipo === 'real'), estimadoFinal: Number.isFinite(Number(plan.estimadoFinal?.monto)) && plan.estimadoFinal?.monto !== null ? Number(plan.estimadoFinal.monto) : null },
    cambiosPendientes: (plan.cambios || []).filter(cambio => ['solicitada', 'en_analisis'].includes(cambio.estado)).length,
    accionesPendientes: (plan.riesgos || []).flatMap(riesgo => riesgo.acciones || []).filter(accion => !accion.cumplida).length,
    tieneLineaBase: Boolean(lineaBase),
  };
}

function fraccionPlanificada(inicio, fin, hoy) {
  if (!esFecha(inicio) || !esFecha(fin)) return null;
  if (hoy < inicio) return 0;
  if (hoy >= fin) return 1;
  return duracion(inicio, hoy) / duracion(inicio, fin);
}

/**
 * Indicadores del proyecto a la fecha `hoy`. `proyecto` necesita ficha, estado, presupuestoVigente,
 * configuracion.umbrales, actualizadoEn y resumen (o se pasa `resumen` aparte).
 */
export function calcularIndicadores(proyecto, hoy, resumen = proyecto?.resumen) {
  const umbrales = { ...UMBRALES_POR_DEFECTO, ...(proyecto?.configuracion?.umbrales || {}) };
  const r = resumen || { tareas: [], entregables: [], riesgos: [], compromisos: [], finanzas: {} };
  const tareas = r.tareas || [];
  const pesoTotal = tareas.reduce((suma, tarea) => suma + tarea.p, 0);

  const avanceReal = pesoTotal > 0 ? tareas.reduce((suma, tarea) => suma + tarea.p * tarea.a, 0) / pesoTotal : null;
  const conPlan = tareas.filter(tarea => fraccionPlanificada(tarea.ib || tarea.i, tarea.fb || tarea.f, hoy) !== null && tarea.p > 0);
  const pesoPlan = conPlan.reduce((suma, tarea) => suma + tarea.p, 0);
  const avancePlanificado = pesoPlan > 0
    ? conPlan.reduce((suma, tarea) => suma + tarea.p * fraccionPlanificada(tarea.ib || tarea.i, tarea.fb || tarea.f, hoy), 0) / pesoPlan * 100
    : null;
  const desviacionAvance = avanceReal !== null && avancePlanificado !== null ? avanceReal - avancePlanificado : null;

  const abiertas = tareas.filter(tarea => !ESTADOS_CERRADOS_TAREA.includes(tarea.e) && !tarea.h);
  const abiertasConFecha = abiertas.filter(tarea => esFecha(tarea.f));
  const vencidas = abiertasConFecha.filter(tarea => tarea.f < hoy);
  const hitos = tareas.filter(tarea => tarea.h);
  const limiteProximo = sumarDias(hoy, umbrales.diasProximoVencimiento);
  const hitoCumplido = hito => hito.e === 'completada';
  const fechaCompromisoHito = hito => hito.fb || hito.f;
  const hitosEvaluables = hitos.filter(hito => hitoCumplido(hito) || (esFecha(fechaCompromisoHito(hito)) && fechaCompromisoHito(hito) < hoy));
  const hitosATiempo = hitosEvaluables.filter(hito => hitoCumplido(hito) && esFecha(hito.fr) && hito.fr <= fechaCompromisoHito(hito));
  const hitosVencidos = hitos.filter(hito => !hitoCumplido(hito) && esFecha(hito.f) && hito.f < hoy);
  const hitosProximos = hitos.filter(hito => !hitoCumplido(hito) && esFecha(hito.f) && hito.f >= hoy && hito.f <= limiteProximo);

  const entregablesPrevistos = (r.entregables || []).filter(entregable => esFecha(entregable.f) && entregable.f <= hoy);
  const entregablesPendientesAprobacion = (r.entregables || []).filter(entregable => ['presentado', 'en_revision'].includes(entregable.e)).length;

  const riesgosAbiertos = (r.riesgos || []).filter(riesgo => ESTADOS_RIESGO_ABIERTOS.includes(riesgo.e));
  const riesgosCriticos = riesgosAbiertos.filter(riesgo => riesgo.t === 'riesgo' && riesgo.n !== null && riesgo.n >= umbrales.nivelRiesgoCritico).length;
  const problemasAbiertos = riesgosAbiertos.filter(riesgo => riesgo.t !== 'riesgo').length;

  const compromisos = (r.compromisos || []).filter(compromiso => compromiso.e !== 'cancelado');
  const compromisosEvaluables = compromisos.filter(compromiso => compromiso.e === 'cumplido' || (esFecha(compromiso.f) && compromiso.f < hoy));
  const compromisosATiempo = compromisosEvaluables.filter(compromiso => compromiso.e === 'cumplido' && (!esFecha(compromiso.f) || (esFecha(compromiso.fc) && compromiso.fc <= compromiso.f)));
  const compromisosVencidos = compromisos.filter(compromiso => compromiso.e !== 'cumplido' && esFecha(compromiso.f) && compromiso.f < hoy).length;

  // Finanzas: solo si el proyecto maneja presupuesto. Un costo no registrado no es cero: el indicador queda sin dato.
  const maneja = proyecto?.ficha?.manejaPresupuesto === true;
  const presupuestoVigente = maneja ? Number(proyecto?.presupuestoVigente ?? proyecto?.ficha?.presupuestoAprobado) || null : null;
  const f = r.finanzas || {};
  const evmValido = maneja && presupuestoVigente > 0 && r.tieneLineaBase && f.hayCostosReales && avanceReal !== null && avancePlanificado !== null;
  const pv = evmValido ? presupuestoVigente * avancePlanificado / 100 : null;
  const ev = evmValido ? presupuestoVigente * avanceReal / 100 : null;
  const ac = evmValido ? f.real : null;
  const spi = evmValido ? ratio(ev, pv) : null;
  const cpi = evmValido ? ratio(ev, ac) : null;
  const eac = cpi ? presupuestoVigente / cpi : null;
  const estimado = f.estimadoFinal !== null && f.estimadoFinal !== undefined ? Number(f.estimadoFinal) : null;
  // El EAC nunca puede quedar por debajo de lo ya gastado o comprometido.
  const proyeccionFinal = maneja ? (estimado ?? (eac === null ? null : Math.max(eac, (f.real || 0) + (f.comprometido || 0)))) : null;
  const variacionPresupuestal = maneja && presupuestoVigente && proyeccionFinal !== null ? (proyeccionFinal - presupuestoVigente) / presupuestoVigente * 100 : null;
  const consumoPresupuesto = maneja && presupuestoVigente ? ((f.real || 0) + (f.comprometido || 0)) / presupuestoVigente * 100 : null;

  const finVigente = tareas.map(tarea => tarea.f).filter(esFecha).sort().at(-1) || proyecto?.ficha?.finPlanificado || '';
  const finBase = tareas.map(tarea => tarea.fb).filter(esFecha).sort().at(-1) || '';
  const ultimaActualizacion = String(proyecto?.actualizadoEn || '').slice(0, 10);
  const diasSinActualizar = esFecha(ultimaActualizacion) ? Math.max(0, Math.round((Date.parse(hoy) - Date.parse(ultimaActualizacion)) / 86400000)) : null;

  const indicadores = {
    avanceReal: redondear(avanceReal),
    avancePlanificado: redondear(avancePlanificado),
    desviacionAvance: redondear(desviacionAvance),
    totalTareas: tareas.length,
    tareasAbiertas: abiertas.length,
    tareasBloqueadas: abiertas.filter(tarea => tarea.e === 'bloqueada').length,
    tareasVencidas: vencidas.length,
    tasaTareasVencidas: redondear(ratio(vencidas.length, abiertasConFecha.length) === null ? null : ratio(vencidas.length, abiertasConFecha.length) * 100),
    hitosTotales: hitos.length,
    hitosEvaluables: hitosEvaluables.length,
    cumplimientoHitos: redondear(ratio(hitosATiempo.length, hitosEvaluables.length) === null ? null : ratio(hitosATiempo.length, hitosEvaluables.length) * 100),
    hitosVencidos: hitosVencidos.length,
    hitosProximos: hitosProximos.length,
    entregablesTotales: (r.entregables || []).length,
    entregablesPrevistos: entregablesPrevistos.length,
    cumplimientoEntregables: redondear(entregablesPrevistos.length ? entregablesPrevistos.filter(entregable => entregable.e === 'aprobado').length / entregablesPrevistos.length * 100 : null),
    entregablesPendientesAprobacion,
    riesgosCriticos,
    problemasAbiertos,
    compromisosEvaluables: compromisosEvaluables.length,
    cumplimientoCompromisos: redondear(ratio(compromisosATiempo.length, compromisosEvaluables.length) === null ? null : ratio(compromisosATiempo.length, compromisosEvaluables.length) * 100),
    compromisosVencidos,
    cambiosPendientes: r.cambiosPendientes || 0,
    accionesPendientes: r.accionesPendientes || 0,
    maneja,
    presupuestoVigente,
    costoReal: maneja ? f.real || 0 : null,
    costoComprometido: maneja ? f.comprometido || 0 : null,
    disponible: maneja && presupuestoVigente ? presupuestoVigente - (f.real || 0) - (f.comprometido || 0) : null,
    proyeccionFinal,
    origenProyeccion: estimado !== null ? 'estimacion' : eac !== null ? 'evm' : null,
    variacionPresupuestal: redondear(variacionPresupuestal),
    consumoPresupuesto: redondear(consumoPresupuesto),
    evm: evmValido ? { pv, ev, ac, spi: redondear(spi, 2), cpi: redondear(cpi, 2), eac } : null,
    finVigente,
    finBase,
    atrasoFinDias: esFecha(finBase) && esFecha(finVigente) ? Math.round((Date.parse(finVigente) - Date.parse(finBase)) / 86400000) : null,
    diasSinActualizar,
    tieneLineaBase: Boolean(r.tieneLineaBase),
  };
  return { ...indicadores, semaforo: semaforo(proyecto, indicadores, umbrales) };
}

/**
 * Semáforo con motivos. Un avance alto no basta para estar en verde: cuentan atraso frente a lo planificado,
 * hitos vencidos, riesgos críticos, sobrecosto, tareas bloqueadas o vencidas y falta de actualización.
 */
export function semaforo(proyecto, ind, umbrales = UMBRALES_POR_DEFECTO) {
  if (['cerrado', 'cancelado'].includes(proyecto?.estado)) return { color: 'gris', motivos: [`Proyecto ${proyecto.estado}.`] };
  if (!ind.totalTareas) return { color: 'gris', motivos: ['Sin cronograma: no hay datos para evaluar el estado.'] };
  const rojo = [];
  const amarillo = [];
  if (ind.desviacionAvance !== null && ind.desviacionAvance <= -umbrales.desviacionRojo) rojo.push(`Atraso de ${numeroEs(Math.abs(ind.desviacionAvance))} p. p. frente a lo planificado.`);
  else if (ind.desviacionAvance !== null && ind.desviacionAvance <= -umbrales.desviacionAmarillo) amarillo.push(`Atraso de ${numeroEs(Math.abs(ind.desviacionAvance))} p. p. frente a lo planificado.`);
  if (ind.hitosVencidos) rojo.push(`${ind.hitosVencidos} hito(s) vencido(s) sin cumplir.`);
  if (ind.riesgosCriticos) rojo.push(`${ind.riesgosCriticos} riesgo(s) crítico(s) abierto(s).`);
  if (ind.variacionPresupuestal !== null && ind.variacionPresupuestal >= umbrales.costoRojo) rojo.push(`Sobrecosto proyectado de ${numeroEs(ind.variacionPresupuestal)} %.`);
  else if (ind.variacionPresupuestal !== null && ind.variacionPresupuestal >= umbrales.costoAmarillo) amarillo.push(`Sobrecosto proyectado de ${numeroEs(ind.variacionPresupuestal)} %.`);
  if (ind.tareasBloqueadas) amarillo.push(`${ind.tareasBloqueadas} tarea(s) bloqueada(s).`);
  if (ind.tareasVencidas) amarillo.push(`${ind.tareasVencidas} tarea(s) vencida(s).`);
  if (ind.compromisosVencidos) amarillo.push(`${ind.compromisosVencidos} compromiso(s) vencido(s).`);
  if (ind.diasSinActualizar !== null && ind.diasSinActualizar > umbrales.diasSinActualizacion) amarillo.push(`Sin actualizaciones hace ${ind.diasSinActualizar} días.`);
  if (rojo.length) return { color: 'rojo', motivos: [...rojo, ...amarillo] };
  if (amarillo.length) return { color: 'amarillo', motivos: amarillo };
  return { color: 'verde', motivos: ['Sin desviaciones por encima de los umbrales del proyecto.'] };
}

/** Avance de cada fase, paquete o épica a partir de sus hojas (mismo criterio de peso que el proyecto). */
export function avancePorContenedor(tareas, calendario = 'calendario') {
  const mapa = new Map(tareas.map(tarea => [String(tarea.id), tarea]));
  const contenedores = idsContenedores(tareas);
  const acumulado = new Map();
  tareas.filter(tarea => esHoja(tarea, contenedores) && tarea.estado !== 'cancelada').forEach(tarea => {
    const esfuerzo = Number(tarea.esfuerzoHoras);
    const peso = tarea.tipo === 'hito' ? 0 : (esfuerzo > 0 ? esfuerzo : Math.max(duracion(tarea.inicio, tarea.fin, calendario), 1));
    for (let padre = tarea.padreId; padre && mapa.has(String(padre)); padre = mapa.get(String(padre)).padreId) {
      const actual = acumulado.get(String(padre)) || { peso: 0, ponderado: 0 };
      acumulado.set(String(padre), { peso: actual.peso + peso, ponderado: actual.ponderado + peso * (Number(tarea.avance) || 0) });
    }
  });
  return new Map([...acumulado].map(([id, { peso, ponderado }]) => [id, peso > 0 ? redondear(ponderado / peso) : null]));
}
