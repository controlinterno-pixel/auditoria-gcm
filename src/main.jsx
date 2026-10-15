import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { secureLogger } from './services/secureLogger.js'
import { UnsavedChangesProvider } from './context/UnsavedChangesContext.jsx'

secureLogger.installGlobal();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <UnsavedChangesProvider>
      <App />
    </UnsavedChangesProvider>
  </StrictMode>,
)
