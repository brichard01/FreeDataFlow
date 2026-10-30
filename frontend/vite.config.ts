import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Build straight into the Python package so `fdf ui` can serve it.
// In dev, /api calls are forwarded to the Python server.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../freedataflow/ui/static',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
