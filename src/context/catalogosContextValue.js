import { createContext } from 'react';

export const CatalogosContext = createContext({
  catalogoCargos: [],
  cargosEmpresa: [],
  sedesEmpresa: [],
  organizacionesExternas: [],
  mapaProcesos: {},
  catalogosInicializados: false,
});