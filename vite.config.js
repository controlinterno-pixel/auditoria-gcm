import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false, // 🛡️ Evita ingeniería inversa en producción
  },
  esbuild: {
    drop: ['console', 'debugger'], // 🛡️ Borra todos los console.log nativamente sin instalar 'terser'
  }
})