import { createContext } from 'react';

export const CatalogosContext = createContext({
  catalogoCargos: [],
  cargosEmpresa: [],
  sedesEmpresa: [],
  mapaProcesos: {},
  catalogosInicializados: false,
});