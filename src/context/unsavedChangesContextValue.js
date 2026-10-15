import { createContext } from 'react';

export const UnsavedChangesContext = createContext({
  registerPendingChanges: () => {},
  guardNavigation: callback => callback?.(),
});