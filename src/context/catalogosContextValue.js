import { createContext } from 'react';

export const CatalogosContext = createContext({
  catalogoCargos: [],
  cargosEmpresa: [],
  sedesEmpresa: [],
  organizacionesExternas: [],
  rolesProyecto: [],
  mapaProcesos: {},
  catalogosInicializados: false,
});