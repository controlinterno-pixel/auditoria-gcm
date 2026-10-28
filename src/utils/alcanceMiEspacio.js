// src/utils/alcanceMiEspacio.js - Qué ve un líder de proceso (rol "lider") en Mi Espacio: solo lo de los
// macroprocesos y subprocesos que tiene habilitados en Configuración, y solo de los módulos cuya casilla tiene
// marcada. Un macroproceso sin subprocesos marcados se ve completo. Los demás roles no pasan por aquí.

import { alcanceDe, expandirUbicacion } from './alcanceRiesgo.js';
import { permisosEfectivos, puedeVerSubmodulo } from './permisosVista.js';

const normalizar = valor => String(valor || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\s+/g, ' ').trim().toLowerCase();
const comoLista = valor => (Array.isArray(valor) ? valor : String(valor || '').split(','))
  .map(normalizar).filter(Boolean);
const asignados = (lista, unico) => comoLista(Array.isArray(lista) && lista.length > 0 ? lista : unico);

export const esLiderProceso = perfil => normalizar(perfil?.rol) === 'lider';

// Macroprocesos del registro y, por cada uno, sus subprocesos. Acepta los formatos guardados en la app:
// macroprocesos + subprocesosPorMacroproceso, macroproceso/proceso + subproceso(s) y el antiguo "Macro / Sub".
const ubicacionDe = registro => {
  const macrosGuardados = Array.isArray(registro?.macroprocesos) && registro.macroprocesos.length > 0
    ? registro.macroprocesos
    : [registro?.macroproceso || registro?.proceso];
  const partesLegado = String(registro?.proceso || '').split('/').map(parte => parte.trim()).filter(Boolean);
  const subprocesosGenerales = asignados(registro?.subprocesos, registro?.subproceso || partesLegado.slice(1).join('/'));
  const relaciones = registro?.subprocesosPorMacroproceso && typeof registro.subprocesosPorMacroproceso === 'object'
    ? Object.fromEntries(Object.entries(registro.subprocesosPorMacroproceso).map(([macro, subs]) => [normalizar(macro), comoLista(subs)]))
    : null;
  return macrosGuardados
    .map(macro => normalizar(String(macro || '').split('/')[0]))
    .filter(Boolean)
    .map(macro => ({ macro, subprocesos: relaciones?.[macro] || subprocesosGenerales }));
};

/** Regla de alcance del líder: (registro) => boolean, con los macroprocesos y subprocesos de su perfil. */
export function crearAlcanceLider(perfil, mapaProcesos = {}) {
  const procesos = new Set(asignados(perfil?.procesosAsignados, perfil?.procesoAsignado));
  const subprocesos = asignados(perfil?.subprocesosAsignados, perfil?.subprocesoAsignado);
  const catalogo = new Map(Object.entries(mapaProcesos || {})
    .map(([macro, subs]) => [normalizar(macro), comoLista(Array.isArray(subs) ? subs : [])]));
  // Subprocesos marcados que pertenecen a ese macroproceso; sin catálogo cargado, todos los marcados.
  const restriccionDe = macro => (catalogo.has(macro)
    ? catalogo.get(macro).filter(subproceso => subprocesos.includes(subproceso))
    : subprocesos);
  return registro => ubicacionDe(registro).some(({ macro, subprocesos: delRegistro }) => {
    if (!procesos.has(macro)) return false;
    const restriccion = restriccionDe(macro);
    return restriccion.length === 0 || delRegistro.some(subproceso => restriccion.includes(subproceso));
  });
}

/** Opciones del selector del expediente: los macroprocesos del líder y sus subprocesos habilitados. */
export function opcionesProcesoLider(perfil, mapaProcesos = {}) {
  const procesos = asignados(perfil?.procesosAsignados, perfil?.procesoAsignado);
  const subprocesos = asignados(perfil?.subprocesosAsignados, perfil?.subprocesoAsignado);
  return Object.entries(mapaProcesos || {})
    .filter(([macro]) => procesos.includes(normalizar(macro)))
    .flatMap(([macro, subs]) => {
      const delMacro = (Array.isArray(subs) ? subs : []).filter(subproceso => subproceso !== 'General');
      const habilitados = delMacro.filter(subproceso => subprocesos.includes(normalizar(subproceso)));
      return [macro, ...(habilitados.length ? habilitados : delMacro).map(subproceso => `Subproceso ${subproceso.toLowerCase()}`)];
    })
    .sort();
}

const tieneProceso = registro => ubicacionDe(registro).length > 0;

/**
 * Listas de Mi Espacio recortadas al alcance del líder. Un módulo sin casilla queda vacío. Los planes y las
 * evaluaciones sin proceso propio heredan el de su hallazgo o su riesgo. Los riesgos de toda la empresa no
 * aparecen aquí (sí en el módulo Riesgos).
 */
export function filtrarMiEspacioLider(perfil, mapaProcesos, listas = {}) {
  const permisos = permisosEfectivos(perfil);
  const puede = submodulo => puedeVerSubmodulo(permisos, submodulo);
  const dentro = crearAlcanceLider(perfil, mapaProcesos);
  const de = (nombre, submodulo, regla = dentro) => (puede(submodulo) && Array.isArray(listas[nombre]) ? listas[nombre].filter(regla) : []);

  const riesgos = de('riesgos', 'sub_matriz_riesgos', riesgo => alcanceDe(riesgo) !== 'empresa' && dentro(expandirUbicacion(riesgo, mapaProcesos)));
  const idsRiesgos = new Set(riesgos.map(riesgo => String(riesgo.id)));
  const hallazgos = de('hallazgos', 'sub_hallazgos');
  const idsHallazgos = new Set(hallazgos.map(hallazgo => String(hallazgo.id)));
  return {
    cronograma: de('cronograma', 'sub_cronograma'),
    programas: de('programas', 'sub_programas'),
    riesgos,
    evaluaciones: puede('sub_campo') || puede('sub_matriz_riesgos')
      ? (listas.evaluaciones || []).filter(ev => (tieneProceso(ev) ? dentro(ev) : idsRiesgos.has(String(ev.idRiesgo))))
      : [],
    hallazgos,
    planes: de('planes', 'sub_seguimiento_planes', plan => (tieneProceso(plan) ? dentro(plan) : idsHallazgos.has(String(plan.idHallazgo)))),
    informes: de('informes', 'sub_informes'),
    comites: puede('sub_comites') && Array.isArray(listas.comites) ? listas.comites : [],
  };
}
