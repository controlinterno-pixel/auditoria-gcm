import { useMemo } from 'react';
import { CatalogosContext } from './catalogosContextValue';

const MAPA_PROCESOS_VACIO = {};

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

  const mapaProcesosActivo = catalogosInicializados ? mapaProcesos : MAPA_PROCESOS_VACIO;

  const value = useMemo(() => ({
    catalogoCargos,
    cargosEmpresa,
    sedesEmpresa: sedesEmpresaActivas,
    mapaProcesos: mapaProcesosActivo,
    catalogosInicializados,
  }), [catalogoCargos, cargosEmpresa, sedesEmpresaActivas, mapaProcesosActivo, catalogosInicializados]);

  return <CatalogosContext.Provider value={value}>{children}</CatalogosContext.Provider>;
}