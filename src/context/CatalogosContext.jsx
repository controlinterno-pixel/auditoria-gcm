import { useMemo } from 'react';
import { CARGOS_EMPRESA, MAPA_PROCESOS } from '../constants/diccionariosGRC';
import { CatalogosContext } from './catalogosContextValue';

export function CatalogosProvider({
  catalogoCargos = [],
  mapaProcesos = {},
  catalogosInicializados = false,
  children,
}) {
  const cargosEmpresa = useMemo(() => {
    if (!catalogosInicializados) return CARGOS_EMPRESA;
    return [...new Set(
      catalogoCargos
        .filter(registro => registro?.activo !== false)
        .map(registro => String(registro?.cargo || '').trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, 'es'));
  }, [catalogoCargos, catalogosInicializados]);

  const mapaProcesosActivo = catalogosInicializados ? mapaProcesos : MAPA_PROCESOS;

  const value = useMemo(() => ({
    catalogoCargos,
    cargosEmpresa,
    mapaProcesos: mapaProcesosActivo,
    catalogosInicializados,
  }), [catalogoCargos, cargosEmpresa, mapaProcesosActivo, catalogosInicializados]);

  return <CatalogosContext.Provider value={value}>{children}</CatalogosContext.Provider>;
}