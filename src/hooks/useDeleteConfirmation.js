import { createContext, useContext } from 'react';

export const DeleteConfirmationContext = createContext(null);

export function useDeleteConfirmation() {
  const confirmarEliminacion = useContext(DeleteConfirmationContext);
  if (!confirmarEliminacion) {
    throw new Error('La confirmación de eliminación requiere DeleteConfirmationProvider.');
  }
  return confirmarEliminacion;
}
