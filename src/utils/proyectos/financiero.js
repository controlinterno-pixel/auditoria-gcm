// src/utils/proyectos/financiero.js - Apartado 8 (proyección de ingresos) y 11 (análisis financiero) del manual
// E-ID-MAN-01: VAN, TIR y periodo de recuperación descontado (PRD) a partir de flujos por periodo. El ROI y la
// recuperación en años y meses complementan al manual, que no los exige.

import { porcentaje } from './formato.js';

const numero = valor => (valor === '' || valor === null || valor === undefined ? null : Number(valor));

/** Ingreso bruto del periodo = clientes × precio promedio × (1 + ajuste por estacionalidad / 100). */
export const ingresoPeriodo = periodo => {
  const clientes = numero(periodo?.clientes);
  const precio = numero(periodo?.precio);
  if (!Number.isFinite(clientes) || !Number.isFinite(precio)) return null;
  return clientes * precio * (1 + (Number(periodo?.ajuste) || 0) / 100);
};

/** Flujo neto por periodo (ingresos − egresos). El periodo 0 suele ser la inversión inicial (negativo). */
export const flujosNetos = flujos => (Array.isArray(flujos) ? flujos : [])
  .map(flujo => ({ periodo: Number(flujo?.periodo), neto: (Number(flujo?.ingresos) || 0) - (Number(flujo?.egresos) || 0) }))
  .filter(flujo => Number.isInteger(flujo.periodo) && flujo.periodo >= 0)
  .sort((a, b) => a.periodo - b.periodo);

/** VAN = Σ flujo_t ÷ (1 + tasa)^t, con la tasa en porcentaje por periodo. */
export function van(flujos, tasaPorcentaje) {
  const tasa = Number(tasaPorcentaje) / 100;
  const netos = flujosNetos(flujos);
  if (!netos.length || !Number.isFinite(tasa) || tasa <= -1) return null;
  return netos.reduce((suma, { periodo, neto }) => suma + neto / (1 + tasa) ** periodo, 0);
}

/**
 * TIR: la tasa que hace VAN = 0 (bisección entre −99 % y 1000 %). null si los flujos no cambian de signo
 * (sin inversión o sin retorno no existe TIR) o si no converge.
 */
export function tir(flujos) {
  const netos = flujosNetos(flujos);
  if (!netos.some(f => f.neto < 0) || !netos.some(f => f.neto > 0)) return null;
  const valor = tasa => netos.reduce((suma, { periodo, neto }) => suma + neto / (1 + tasa) ** periodo, 0);
  let bajo = -0.99;
  let alto = 10;
  if (valor(bajo) * valor(alto) > 0) return null;
  for (let i = 0; i < 200; i += 1) {
    const medio = (bajo + alto) / 2;
    if (valor(bajo) * valor(medio) <= 0) alto = medio; else bajo = medio;
    if (alto - bajo < 1e-9) break;
  }
  return ((bajo + alto) / 2) * 100;
}

/** PRD: periodos hasta que el flujo descontado acumulado deja de ser negativo (con interpolación). null si no se recupera. */
export function periodoRecuperacionDescontado(flujos, tasaPorcentaje) {
  const tasa = Number(tasaPorcentaje) / 100;
  const netos = flujosNetos(flujos);
  if (!netos.length || !Number.isFinite(tasa) || tasa <= -1) return null;
  let acumulado = 0;
  for (let i = 0; i < netos.length; i += 1) {
    const descontado = netos[i].neto / (1 + tasa) ** netos[i].periodo;
    const anterior = acumulado;
    acumulado += descontado;
    if (anterior < 0 && acumulado >= 0) return netos[i].periodo - 1 + (-anterior / descontado);
    if (i === 0 && acumulado >= 0) return 0;
  }
  return null;
}

/** Recuperación simple (PRI): la misma cuenta sin descontar, para comparar con el PRD. */
export const periodoRecuperacionSimple = flujos => periodoRecuperacionDescontado(flujos, 0);

// Duración de cada periodo del flujo: convierte los periodos a años y meses y la tasa a efectiva anual.
export const UNIDADES_PERIODO = { mes: 'Mes', trimestre: 'Trimestre', semestre: 'Semestre', anio: 'Año' };
export const MESES_POR_PERIODO = { mes: 1, trimestre: 3, semestre: 6, anio: 12 };
const tasaValida = valor => valor !== '' && valor !== null && valor !== undefined && Number.isFinite(Number(valor)) && Number(valor) > -100;

/** Periodos → { anios, meses }. El mes en que se cruza el punto de recuperación cuenta completo. */
export function aniosYMeses(periodos, unidad) {
  const meses = MESES_POR_PERIODO[unidad];
  if (periodos === null || periodos === undefined || !Number.isFinite(periodos) || !meses) return null;
  const total = Math.ceil(periodos * meses - 1e-9);
  return { anios: Math.floor(total / 12), meses: total % 12, totalMeses: total };
}
export function textoAniosYMeses(tiempo) {
  if (!tiempo) return null;
  if (tiempo.totalMeses === 0) return 'Desde el inicio';
  return [tiempo.anios ? `${tiempo.anios} ${tiempo.anios === 1 ? 'año' : 'años'}` : '', tiempo.meses ? `${tiempo.meses} ${tiempo.meses === 1 ? 'mes' : 'meses'}` : '']
    .filter(Boolean).join(' y ');
}

/** Tasa por periodo → efectiva anual: (1 + i)^(12 ÷ meses del periodo) − 1. */
export function tasaEfectivaAnual(tasaPorcentaje, unidad) {
  const meses = MESES_POR_PERIODO[unidad];
  if (!meses || !tasaValida(tasaPorcentaje)) return null;
  return ((1 + Number(tasaPorcentaje) / 100) ** (12 / meses) - 1) * 100;
}

/** ROI = (ingresos − egresos) ÷ egresos × 100 en todo el horizonte del flujo. null si no hay egresos. */
export function roi(flujos) {
  const lista = Array.isArray(flujos) ? flujos : [];
  const ingresos = lista.reduce((suma, flujo) => suma + (Number(flujo?.ingresos) || 0), 0);
  const egresos = lista.reduce((suma, flujo) => suma + (Number(flujo?.egresos) || 0), 0);
  return egresos > 0 ? ((ingresos - egresos) / egresos) * 100 : null;
}

/** ROI descontado = (VP ingresos − VP egresos) ÷ VP egresos × 100: el ROI con el valor del dinero en el tiempo. */
export function roiDescontado(flujos, tasaPorcentaje) {
  if (!tasaValida(tasaPorcentaje)) return null;
  const tasa = Number(tasaPorcentaje) / 100;
  const validos = (Array.isArray(flujos) ? flujos : []).filter(flujo => Number.isInteger(Number(flujo?.periodo)) && Number(flujo.periodo) >= 0);
  const presente = campo => validos.reduce((suma, flujo) => suma + (Number(flujo[campo]) || 0) / (1 + tasa) ** Number(flujo.periodo), 0);
  const egresos = presente('egresos');
  return egresos > 0 ? ((presente('ingresos') - egresos) / egresos) * 100 : null;
}

/** Datos del flujo que harían que los indicadores no reflejen el proyecto. */
export function alertasFinancieras(datos = {}) {
  const flujos = Array.isArray(datos.flujos) ? datos.flujos : [];
  if (!flujos.length) return [];
  const periodos = flujos.map(flujo => Number(flujo?.periodo)).filter(periodo => Number.isInteger(periodo) && periodo >= 0);
  const alertas = [];
  const repetidos = [...new Set(periodos.filter((periodo, i) => periodos.indexOf(periodo) !== i))];
  if (repetidos.length) alertas.push(`El periodo ${repetidos.join(', ')} está repetido: suma sus valores en una sola fila.`);
  const ultimo = Math.max(...periodos, 0);
  const huecos = Array.from({ length: ultimo + 1 }, (_, i) => i).filter(i => !periodos.includes(i));
  if (huecos.length) alertas.push(`Faltan los periodos ${huecos.join(', ')}: regístralos aunque su flujo sea 0, o la TIR y la recuperación quedan mal.`);
  if (!flujos.some(flujo => Number(flujo?.periodo) === 0 && Number(flujo?.egresos) > 0)) alertas.push('El periodo 0 no tiene egresos: ahí va la inversión inicial.');
  const anual = tasaEfectivaAnual(datos.tasaDescuento, datos.unidadPeriodo);
  if (anual !== null && anual > 60) {
    alertas.push(`La tasa equivale a ${anual.toLocaleString('es-CO', { maximumFractionDigits: 1 })} % efectivo anual: revisa que sea la tasa por ${UNIDADES_PERIODO[datos.unidadPeriodo].toLowerCase()} y no la anual.`);
  }
  return alertas;
}

export function resumenFinanciero(datos = {}) {
  const flujos = datos.flujos || [];
  const prd = periodoRecuperacionDescontado(flujos, datos.tasaDescuento);
  const pri = periodoRecuperacionSimple(flujos);
  const tirPeriodo = tir(flujos);
  const ultimo = flujosNetos(flujos).at(-1)?.periodo;
  return {
    van: van(flujos, datos.tasaDescuento),
    tir: tirPeriodo,
    tirAnual: tirPeriodo === null ? null : tasaEfectivaAnual(tirPeriodo, datos.unidadPeriodo),
    tasaAnual: tasaEfectivaAnual(datos.tasaDescuento, datos.unidadPeriodo),
    prd,
    pri,
    prdTiempo: aniosYMeses(prd, datos.unidadPeriodo),
    priTiempo: aniosYMeses(pri, datos.unidadPeriodo),
    horizonte: aniosYMeses(ultimo ?? null, datos.unidadPeriodo),
    roi: roi(flujos),
    roiDescontado: roiDescontado(flujos, datos.tasaDescuento),
    totalIngresos: flujos.reduce((suma, flujo) => suma + (Number(flujo?.ingresos) || 0), 0),
    totalEgresos: flujos.reduce((suma, flujo) => suma + (Number(flujo?.egresos) || 0), 0),
  };
}

const enMeses = total => (total <= 0 ? '0 meses' : textoAniosYMeses({ anios: Math.floor(total / 12), meses: total % 12, totalMeses: total }));

/**
 * Qué significa el resultado de cada indicador en este proyecto. Cada texto se arma con sus cifras y cambia según
 * el resultado: viable o no, con margen amplio o estrecho, recuperación temprana o al final del horizonte.
 * Clave = título del indicador en pantalla.
 */
export function interpretarIndicadores(datos = {}, r = resumenFinanciero(datos), codigo = 'COP') {
  const tasa = tasaValida(datos.tasaDescuento) ? Number(datos.tasaDescuento) : null;
  const unidad = UNIDADES_PERIODO[datos.unidadPeriodo]?.toLowerCase();
  const porUnidad = !unidad ? ' por periodo' : unidad === 'año' ? ' anual' : ` por ${unidad}`;
  const anual = valor => (valor !== null && datos.unidadPeriodo && datos.unidadPeriodo !== 'anio' ? ` (${porcentaje(valor)} efectivo anual)` : '');
  const pesos = (valor, decimales = 0) => Number(valor).toLocaleString('es-CO', { style: 'currency', currency: codigo || 'COP', minimumFractionDigits: decimales, maximumFractionDigits: decimales });
  const cifra = (valor, decimales = 1) => Number(valor).toLocaleString('es-CO', { maximumFractionDigits: decimales });
  const inversion = (Array.isArray(datos.flujos) ? datos.flujos : []).filter(flujo => Number(flujo?.periodo) === 0).reduce((suma, flujo) => suma + (Number(flujo?.egresos) || 0), 0);
  const deInversion = inversion > 0 ? ` de ${pesos(inversion)}` : '';
  const horizonte = textoAniosYMeses(r.horizonte);
  const enHorizonte = horizonte ? ` en los ${horizonte} proyectados` : ' en los periodos registrados';
  const neto = r.totalIngresos - r.totalEgresos;

  // VAN: además del signo, qué tan holgado es frente a la inversión.
  let VAN = 'Aún no se puede calcular: registra la tasa de descuento y al menos dos periodos de flujo de caja.';
  if (r.van !== null) {
    const proporcion = inversion > 0 ? Math.abs(r.van) / inversion : null;
    const tanto = proporcion === null ? '' : `, el ${cifra(proporcion * 100)} % de la inversión`;
    if (r.van > 0) {
      VAN = `Tu VAN es ${pesos(r.van)}: el proyecto recupera la inversión, paga la rentabilidad mínima exigida (${porcentaje(tasa)}${porUnidad}) y además deja ${pesos(r.van)} de valor a hoy${tanto}. Es viable por este criterio`;
      VAN += proporcion === null ? '.' : proporcion >= 0.3 ? ', con un margen amplio.'
        : proporcion >= 0.1 ? ', con un margen moderado: vigila que los ingresos se cumplan.'
          : ', pero con un margen estrecho: una caída pequeña de ingresos o un alza de costos lo puede volver negativo. Revisa el análisis de sensibilidad.';
    } else if (r.van < 0) {
      VAN = `Tu VAN es ${pesos(r.van)}: el proyecto no alcanza la rentabilidad mínima exigida (${porcentaje(tasa)}${porUnidad}); le faltan ${pesos(-r.van)} a valor de hoy${tanto}. No es viable por este criterio`;
      VAN += proporcion !== null && proporcion < 0.1 ? ', aunque está cerca del punto de equilibrio: ajustes moderados en ingresos, costos o inversión podrían hacerlo viable.'
        : proporcion !== null && proporcion < 0.3 ? ': la brecha es moderada; revisa en el análisis de sensibilidad qué combinación de ingresos, costos o inversión lo haría viable.'
          : ': la brecha es grande, conviene replantear el alcance, la inversión o el modelo de ingresos.';
    } else VAN = 'Tu VAN es 0: el proyecto rinde exactamente la rentabilidad mínima exigida, sin dejar valor adicional.';
  }

  // TIR: cuánto se aleja de la tasa exigida.
  let TIR = 'No existe porque los flujos no tienen una inversión (negativo) seguida de retornos (positivos). Revisa que el periodo 0 tenga la inversión inicial en Egresos y que haya ingresos después.';
  if (r.tir !== null) {
    const valor = `Tu TIR es ${porcentaje(r.tir)}${porUnidad}${anual(r.tirAnual)}`;
    if (tasa === null) TIR = `${valor}. Registra la tasa de descuento para saber si supera la rentabilidad exigida.`;
    else if (r.tir >= tasa) {
      const veces = tasa > 0 ? r.tir / tasa : null;
      TIR = `${valor}, ${cifra(r.tir - tasa, 2)} puntos por encima de la tasa exigida de ${porcentaje(tasa)}${anual(r.tasaAnual)}. `
        + (veces === null || veces >= 2 ? `El proyecto rinde ${veces === null ? 'por encima de' : `${cifra(veces)} veces`} el mínimo que pide la empresa: es viable con holgura.`
          : veces >= 1.5 ? 'El proyecto rinde más que el mínimo que pide la empresa: es viable.'
            : 'Supera el mínimo por poco: es viable, pero cualquier desviación en ingresos o costos puede dejarlo por debajo.');
    } else {
      TIR = `${valor}, ${cifra(tasa - r.tir, 2)} puntos por debajo de la tasa exigida de ${porcentaje(tasa)}${anual(r.tasaAnual)}. El proyecto rinde menos que el mínimo que pide la empresa: no es viable por este criterio${r.tir < 0 ? ', y además pierde dinero aun sin descontar.' : '.'}`;
    }
  }

  // ROI: ganancia o pérdida total y si es coherente con el ROI descontado.
  let ROI = 'Aún no se puede calcular: registra los egresos del proyecto (inversión y costos de operación).';
  if (r.roi !== null) {
    ROI = r.roi >= 0
      ? `Tu ROI es ${porcentaje(r.roi)}: por cada ${pesos(1)} de egresos vuelven ${pesos(1 + r.roi / 100, 2)}. El proyecto gasta ${pesos(r.totalEgresos)} y recibe ${pesos(r.totalIngresos)}, una ganancia de ${pesos(neto)}${enHorizonte}.`
      : `Tu ROI es ${porcentaje(r.roi)}: el proyecto pierde dinero. Gasta ${pesos(r.totalEgresos)} y recibe ${pesos(r.totalIngresos)}, una pérdida de ${pesos(-neto)}${enHorizonte}.`;
    if (r.roi >= 0 && r.roiDescontado !== null && r.roiDescontado < 0) ROI += ' Ojo: a valor presente el resultado es negativo, porque el dinero llega tarde. Decide con el ROI descontado y el VAN.';
    else if (r.roi >= 0 && r.roi < 10) ROI += ' Es un retorno bajo para todo el horizonte: compáralo con otras alternativas de inversión.';
    else if (r.roi >= 0) ROI += ' Este ROI no tiene en cuenta cuándo llega el dinero: compáralo con el ROI descontado.';
  }

  // ROI descontado: siempre tiene el mismo signo que el VAN.
  let ROI_DESCONTADO = 'Aún no se puede calcular: registra la tasa de descuento y los egresos.';
  if (r.roiDescontado !== null) {
    ROI_DESCONTADO = r.roiDescontado >= 0
      ? `Tu ROI descontado es ${porcentaje(r.roiDescontado)}: aun sabiendo que el dinero futuro vale menos, por cada ${pesos(1)} de egresos vuelven ${pesos(1 + r.roiDescontado / 100, 2)} a valor de hoy, coherente con el VAN positivo.`
      : `Tu ROI descontado es ${porcentaje(r.roiDescontado)}: a valor de hoy los ingresos no cubren los egresos con la rentabilidad exigida, coherente con el VAN negativo.`;
    if (r.roi !== null && r.roi > r.roiDescontado) ROI_DESCONTADO += ` Los ${cifra(r.roi - r.roiDescontado)} puntos de diferencia con el ROI (${porcentaje(r.roi)}) son lo que cuesta esperar el dinero.`;
  }

  // Recuperación: en qué punto del horizonte ocurre y cuánto margen deja.
  const ubicar = (tiempo, despues) => {
    if (!tiempo || !r.horizonte?.totalMeses) return '';
    const fraccion = tiempo.totalMeses / r.horizonte.totalMeses;
    const restante = r.horizonte.totalMeses - tiempo.totalMeses;
    const resto = enMeses(restante);
    const quedan = restante === 1 ? 'queda' : 'quedan';
    if (restante <= 0) return ` Ocurre justo al final del horizonte de ${horizonte}: no queda margen si las ventas se retrasan.`;
    if (fraccion <= 0.5) return ` Ocurre en la primera mitad del horizonte de ${horizonte}: ${quedan} ${resto} de ${despues}, buena señal de liquidez.`;
    if (fraccion <= 0.8) return ` ${restante === 1 ? "Queda" : "Quedan"} ${resto} de ${despues} dentro del horizonte de ${horizonte}.`;
    return ` Ocurre cerca del final del horizonte de ${horizonte} (${quedan} ${resto}): hay poco margen si las ventas se retrasan.`;
  };
  const plazo = (periodo, tiempo) => textoAniosYMeses(tiempo) || `${cifra(periodo, 2)} periodos (elige la duración de cada periodo para verlo en años y meses)`;
  const SIMPLE = r.pri === null
    ? `Con los flujos registrados la inversión${deInversion} no se alcanza a recuperar${enHorizonte}, ni siquiera sin descontar. Amplía el horizonte si el proyecto sigue operando, o revisa ingresos y costos.`
    : r.pri === 0 ? 'El primer periodo ya cubre los egresos: no hay inversión que recuperar. Revisa que el periodo 0 tenga la inversión inicial.'
      : `Recuperas la inversión${deInversion} en ${plazo(r.pri, r.priTiempo)}, sin contar el costo del dinero; desde ahí el flujo es ganancia.${ubicar(r.priTiempo, 'ganancia')}`;

  const diferencia = r.priTiempo && r.prdTiempo ? r.prdTiempo.totalMeses - r.priTiempo.totalMeses : null;
  const PRD = tasa === null ? "Registra la tasa de descuento: sin ella no se puede calcular la recuperación a valor presente."
    : r.prd === null
    ? `Con la tasa exigida${tasa !== null ? ` de ${porcentaje(tasa)}${porUnidad}` : ''} la inversión${deInversion} no se recupera${enHorizonte}${r.pri !== null ? `, aunque sin descontar sí se recupera en ${plazo(r.pri, r.priTiempo)}: el proyecto devuelve el dinero pero no paga la rentabilidad mínima en ese plazo` : ''}. Amplía el horizonte si el proyecto sigue operando, o revisa su viabilidad.`
    : r.prd === 0 ? 'El primer periodo ya cubre los egresos: no hay inversión que recuperar.'
      : `Con la rentabilidad exigida, recuperas la inversión${deInversion} en ${plazo(r.prd, r.prdTiempo)}.${diferencia ? ` Son ${diferencia} ${diferencia === 1 ? 'mes' : 'meses'} más que la recuperación simple: ese es el efecto del costo del dinero.` : ''}${ubicar(r.prdTiempo, 'rentabilidad por encima de la exigida')} Es el plazo que conviene informar a la Gerencia.`;

  return { VAN, TIR, ROI, 'ROI descontado': ROI_DESCONTADO, 'Recuperación simple': SIMPLE, 'Recuperación descontada (PRD)': PRD };
}
