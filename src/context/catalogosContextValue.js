import { createContext } from 'react';

export const CatalogosContext = createContext({
  catalogoCargos: [],
  cargosEmpresa: [],
  cargosPorSede: {},
  sedesEmpresa: [],
  mapaProcesos: {},
  catalogosInicializados: false,
});