// src/utils/proyectos/financiero.js - Apartado 8 (proyección de ingresos) y 11 (análisis financiero) del manual
// E-ID-MAN-01: VAN, TIR y periodo de recuperación descontado (PRD) a partir de flujos por periodo. El ROI y la
// recuperación en años y meses complementan al manual, que no los exige.

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
