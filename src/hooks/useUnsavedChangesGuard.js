import { useContext, useEffect, useId } from 'react';
import { UnsavedChangesContext } from '../context/unsavedChangesContextValue.js';

export function useUnsavedChangesGuard(isDirty, description = 'este formulario') {
  const { registerPendingChanges, guardNavigation } = useContext(UnsavedChangesContext);
  const id = useId();

  useEffect(() => {
    registerPendingChanges(id, isDirty, description);
    return () => registerPendingChanges(id, false, description);
  }, [description, id, isDirty, registerPendingChanges]);

  return guardNavigation;
}

export function useNavigationGuard() {
  return useContext(UnsavedChangesContext).guardNavigation;
}