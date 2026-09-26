import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false, // 🛡️ Evita ingeniería inversa en producción
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // 🛡️ Borra todos los console.log en producción
        drop_debugger: true
      }
    }
  }
})