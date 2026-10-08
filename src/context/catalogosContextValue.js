import { createContext } from 'react';
import { MAPA_PROCESOS } from '../constants/diccionariosGRC';

export const CatalogosContext = createContext({
  catalogoCargos: [],
  cargosEmpresa: [],
  cargosPorSede: {},
  sedesEmpresa: [],
  mapaProcesos: MAPA_PROCESOS,
  catalogosInicializados: false,
});