import { useMemo } from 'react';
import { CatalogosContext } from './catalogosContextValue';
import { MAPA_PROCESOS as MAPA_PROCESOS_BASE } from '../constants/diccionariosGRC';

const MAPA_PROCESOS_VACIO = {};
const normalizarNombreProceso = valor => String(valor || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

const normalizarListaSubprocesos = valor => [...new Set(
  (Array.isArray(valor) ? valor : [])
    .map(subproceso => String(subproceso || '').trim())
    .filter(Boolean)
)];

const normalizarMapaProcesos = mapa => {
  const entradas = Object.entries(mapa && typeof mapa === 'object' ? mapa : {})
    .filter(([macroproceso]) => String(macroproceso || '').trim());
  const macrosBase = Object.keys(MAPA_PROCESOS_BASE);
  const mapaNormalizado = {};
  const subprocesosHuerfanos = [];
  let contieneMacroprocesoBase = false;

  entradas.forEach(([macroproceso, subprocesos]) => {
    const nombre = String(macroproceso).trim();
    const macroprocesoBase = macrosBase.find(opcion => (
      normalizarNombreProceso(opcion) === normalizarNombreProceso(nombre)
    ));
    if (macroprocesoBase) {
      contieneMacroprocesoBase = true;
      const lista = normalizarListaSubprocesos(subprocesos);
      mapaNormalizado[macroprocesoBase] = lista.length > 0
        ? lista
        : [...MAPA_PROCESOS_BASE[macroprocesoBase]];
      return;
    }

    const macroprocesoPadre = macrosBase.find(opcion => (
      MAPA_PROCESOS_BASE[opcion].some(subproceso => (
        normalizarNombreProceso(subproceso) === normalizarNombreProceso(nombre)
      ))
    ));
    if (macroprocesoPadre) {
      subprocesosHuerfanos.push({ macroprocesoPadre, subproceso: nombre });
      return;
    }

    mapaNormalizado[nombre] = normalizarListaSubprocesos(subprocesos);
  });

  if (!contieneMacroprocesoBase && subprocesosHuerfanos.length > 0) {
    return { ...MAPA_PROCESOS_BASE, ...mapaNormalizado };
  }
  if (entradas.length === 0) return { ...MAPA_PROCESOS_BASE };

  subprocesosHuerfanos.forEach(({ macroprocesoPadre, subproceso }) => {
    const listaPadre = mapaNormalizado[macroprocesoPadre] || [...MAPA_PROCESOS_BASE[macroprocesoPadre]];
    if (!listaPadre.some(item => normalizarNombreProceso(item) === normalizarNombreProceso(subproceso))) {
      listaPadre.push(subproceso);
    }
    mapaNormalizado[macroprocesoPadre] = listaPadre;
  });

  return mapaNormalizado;
};

export function CatalogosProvider({
  catalogoCargos = [],
  mapaProcesos = {},
  sedesEmpresa = [],
  catalogosInicializados = false,
  children,
}) {
  const cargosEmpresa = useMemo(() => {
    if (!catalogosInicializados) return [];
    return [...new Set(
      catalogoCargos
        .filter(registro => registro?.activo !== false)
        .map(registro => String(registro?.cargo || '').trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, 'es'));
  }, [catalogoCargos, catalogosInicializados]);

  const sedesEmpresaActivas = useMemo(
    () => catalogosInicializados && Array.isArray(sedesEmpresa)
      ? [...new Set(sedesEmpresa.map(sede => String(sede || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
      : [],
    [sedesEmpresa, catalogosInicializados]
  );

  const mapaProcesosNormalizado = useMemo(() => normalizarMapaProcesos(mapaProcesos), [mapaProcesos]);
  const mapaProcesosActivo = catalogosInicializados ? mapaProcesosNormalizado : MAPA_PROCESOS_VACIO;

  const value = useMemo(() => ({
    catalogoCargos,
    cargosEmpresa,
    sedesEmpresa: sedesEmpresaActivas,
    mapaProcesos: mapaProcesosActivo,
    catalogosInicializados,
  }), [catalogoCargos, cargosEmpresa, sedesEmpresaActivas, mapaProcesosActivo, catalogosInicializados]);

  return <CatalogosContext.Provider value={value}>{children}</CatalogosContext.Provider>;
}