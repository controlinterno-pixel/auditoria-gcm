import { useMemo } from 'react';
import { CatalogosContext } from './catalogosContextValue';

const MAPA_PROCESOS_VACIO = {};

export function CatalogosProvider({
  catalogoCargos = [],
  mapaProcesos = {},
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

  const cargosPorSede = useMemo(() => {
    const agrupados = {};
    catalogoCargos
      .filter(registro => registro?.activo !== false)
      .forEach(registro => {
        const sedes = Array.isArray(registro?.sedes) ? registro.sedes : [];
        sedes.forEach(sede => {
          if (!agrupados[sede]) agrupados[sede] = [];
          if (registro.cargo && !agrupados[sede].includes(registro.cargo)) agrupados[sede].push(registro.cargo);
        });
      });
    Object.values(agrupados).forEach(cargos => cargos.sort((a, b) => a.localeCompare(b, 'es')));
    return agrupados;
  }, [catalogoCargos]);
  const sedesEmpresa = useMemo(
    () => Object.keys(cargosPorSede).sort((a, b) => a.localeCompare(b, 'es')),
    [cargosPorSede]
  );

  const mapaProcesosActivo = catalogosInicializados ? mapaProcesos : MAPA_PROCESOS_VACIO;

  const value = useMemo(() => ({
    catalogoCargos,
    cargosEmpresa,
    cargosPorSede,
    sedesEmpresa,
    mapaProcesos: mapaProcesosActivo,
    catalogosInicializados,
  }), [catalogoCargos, cargosEmpresa, cargosPorSede, sedesEmpresa, mapaProcesosActivo, catalogosInicializados]);

  return <CatalogosContext.Provider value={value}>{children}</CatalogosContext.Provider>;
}