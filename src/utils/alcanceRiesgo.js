// src/utils/alcanceRiesgo.js - Alcance de un riesgo en la matriz: específico (los macroprocesos y subprocesos
// marcados), todo un macroproceso (todos sus subprocesos, también los que se creen después) o toda la empresa
// (transversal a todos los procesos). Lo usan la matriz en el navegador y el servidor.

import { estaAnulado } from './anulacion.js';

export const ALCANCES_RIESGO = {
  especifico: 'Específico',
  macroproceso: 'Todo el macroproceso',
  empresa: 'Toda la empresa',
};

export const alcanceDe = riesgo => (ALCANCES_RIESGO[riesgo?.alcance] ? riesgo.alcance : 'especifico');
export const esTransversal = riesgo => alcanceDe(riesgo) !== 'especifico';

/**
 * Ubicación vigente según el catálogo de Cargos y Procesos: un riesgo de toda la empresa cubre todos los
 * macroprocesos; uno de macroproceso, todos los subprocesos de los suyos. Si el catálogo no está cargado se
 * conserva lo guardado (que se completó al guardar con el catálogo de ese momento).
 */
export function expandirUbicacion(riesgo, mapaProcesos) {
  const alcance = alcanceDe(riesgo);
  const mapa = mapaProcesos && typeof mapaProcesos === 'object' ? mapaProcesos : {};
  const macros = Object.keys(mapa);
  if (alcance === 'especifico' || !macros.length) return riesgo;
  const macroprocesos = alcance === 'empresa'
    ? macros
    : (Array.isArray(riesgo?.macroprocesos) ? riesgo.macroprocesos : [riesgo?.macroproceso]).filter(macro => mapa[macro]);
  if (!macroprocesos.length) return riesgo;
  const subprocesosPorMacroproceso = Object.fromEntries(macroprocesos.map(macro => [macro, [...(mapa[macro] || [])]]));
  return {
    ...riesgo,
    macroprocesos,
    macroproceso: macroprocesos[0],
    proceso: macroprocesos[0],
    subprocesosPorMacroproceso,
    subprocesos: [...new Set(Object.values(subprocesosPorMacroproceso).flat())],
    subproceso: subprocesosPorMacroproceso[macroprocesos[0]]?.[0] || '',
  };
}

/** Texto corto del alcance para la matriz: "Toda la empresa", "Todo Gestión comercial (5 subprocesos)"… */
export function textoAlcance(riesgo, mapaProcesos) {
  const alcance = alcanceDe(riesgo);
  if (alcance === 'especifico') return '';
  if (alcance === 'empresa') return ALCANCES_RIESGO.empresa;
  const ubicacion = expandirUbicacion(riesgo, mapaProcesos);
  return (ubicacion.macroprocesos || []).map(macro => `Todo ${macro}`).join(' · ');
}

/**
 * Subprocesos del riesgo que no tienen un control propio. Un control sin subproceso es común y aplica a todos;
 * por eso solo se informa cuando cada control está asignado a un subproceso.
 */
export function subprocesosSinControl(subprocesos = [], controles = []) {
  const vigentes = (Array.isArray(controles) ? controles : []).filter(control => control && !estaAnulado(control));
  if (!vigentes.length || vigentes.some(control => !control.subprocesoEjecutor)) return [];
  const cubiertos = new Set(vigentes.map(control => control.subprocesoEjecutor));
  return subprocesos.filter(subproceso => !cubiertos.has(subproceso));
}
