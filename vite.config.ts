import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks - se cachean por separado
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-ui': ['framer-motion', 'lucide-react'],
          'vendor-charts': ['recharts'],
          'vendor-dates': ['date-fns'],
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          // Librerías de exportación - cargadas bajo demanda
          'export-pdf': ['jspdf', 'jspdf-autotable'],
          'export-excel': ['xlsx'],
        },
      },
    },
    // Aumentar límite de warning (opcional, para evitar ruido)
    chunkSizeWarningLimit: 600,
  },
})
