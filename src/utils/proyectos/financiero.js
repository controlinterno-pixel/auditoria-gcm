// src/utils/proyectos/financiero.js - Apartado 8 (proyección de ingresos) y 11 (análisis financiero) del manual
// E-ID-MAN-01: VAN, TIR y periodo de recuperación descontado (PRD) a partir de flujos por periodo.

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

export function resumenFinanciero(datos = {}) {
  const flujos = datos.flujos || [];
  return {
    van: van(flujos, datos.tasaDescuento),
    tir: tir(flujos),
    prd: periodoRecuperacionDescontado(flujos, datos.tasaDescuento),
    totalIngresos: flujos.reduce((suma, flujo) => suma + (Number(flujo?.ingresos) || 0), 0),
    totalEgresos: flujos.reduce((suma, flujo) => suma + (Number(flujo?.egresos) || 0), 0),
  };
}
