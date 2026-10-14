import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import circleDependency from 'vite-plugin-circular-dependency'; // 1. Agregas esta importación

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    circleDependency() // 2. Agregas el plugin aquí
  ],
  base: '/', 
  build: {
    sourcemap: false, 
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
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