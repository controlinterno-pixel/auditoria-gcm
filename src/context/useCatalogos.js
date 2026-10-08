import { useContext } from 'react';
import { CatalogosContext } from './catalogosContextValue';

export function useCatalogos() {
  return useContext(CatalogosContext);
}