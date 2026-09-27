import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // 🚀 Garantiza rutas absolutas para assets estáticos
  build: {
    sourcemap: false, // 🛡️ Evita ingeniería inversa en producción
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // 🚀 Code-Splitting manual: Separa dependencias pesadas en archivos independientes
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('xlsx')) return 'vendor-excel';
            if (id.includes('recharts')) return 'vendor-charts';
            if (id.includes('html2canvas') || id.includes('dompurify')) return 'vendor-pdf';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('firebase')) return 'vendor-firebase';
            return 'vendor-core';
          }
        }
      }
    }
  }
});