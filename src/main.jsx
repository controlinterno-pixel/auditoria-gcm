import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AppErrorBoundary from './components/AppErrorBoundary.jsx'
import { secureLogger } from './services/secureLogger.js'
import { UnsavedChangesProvider } from './context/UnsavedChangesContext.jsx'
import { DeleteConfirmationProvider } from './context/DeleteConfirmationProvider.jsx'

secureLogger.installGlobal();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <UnsavedChangesProvider>
      <DeleteConfirmationProvider>
        <AppErrorBoundary fullScreen>
          <App />
        </AppErrorBoundary>
      </DeleteConfirmationProvider>
    </UnsavedChangesProvider>
  </StrictMode>,
)
