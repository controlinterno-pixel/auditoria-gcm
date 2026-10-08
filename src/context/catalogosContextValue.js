import { createContext } from 'react';
import { CARGOS_EMPRESA, MAPA_PROCESOS } from '../constants/diccionariosGRC';

export const CatalogosContext = createContext({
  catalogoCargos: [],
  cargosEmpresa: CARGOS_EMPRESA,
  mapaProcesos: MAPA_PROCESOS,
  catalogosInicializados: false,
});