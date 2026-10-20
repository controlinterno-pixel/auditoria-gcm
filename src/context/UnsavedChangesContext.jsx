import { useCallback, useEffect, useRef } from 'react';
import { UnsavedChangesContext } from './unsavedChangesContextValue.js';
import { setPendingChangesProbe } from '../services/appUpdate.js';

export function UnsavedChangesProvider({ children }) {
  const pendingChanges = useRef(new Map());

  const registerPendingChanges = useCallback((id, isDirty, description) => {
    if (isDirty) {
      pendingChanges.current.set(id, description || 'este formulario');
    } else {
      pendingChanges.current.delete(id);
    }
  }, []);

  const guardNavigation = useCallback((callback) => {
    if (pendingChanges.current.size > 0) {
      const descriptions = [...new Set(pendingChanges.current.values())];
      const detalle = descriptions.length === 1
        ? descriptions[0]
        : `${descriptions.slice(0, -1).join(', ')} y ${descriptions.at(-1)}`;
      const confirma = typeof window === 'undefined' || window.confirm(
        `Tienes cambios sin guardar en ${detalle}. ¿Deseas salir y descartarlos?`
      );

      if (!confirma) return false;
      pendingChanges.current.clear();
    }

    callback?.();
    return true;
  }, []);

  useEffect(() => {
    setPendingChangesProbe(() => pendingChanges.current.size > 0);
    return () => setPendingChangesProbe(null);
  }, []);

  useEffect(() => {
    const protegerCierre = event => {
      if (pendingChanges.current.size === 0) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', protegerCierre);
    return () => window.removeEventListener('beforeunload', protegerCierre);
  }, []);

  return (
    <UnsavedChangesContext.Provider value={{ registerPendingChanges, guardNavigation }}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}

