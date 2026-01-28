import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { octaneGrpcPlugin } from './vite-plugin-octane-grpc'

export default defineConfig({
  plugins: [
    react(),
    octaneGrpcPlugin()
  ],
  root: 'client',
  server: {
    port: parseInt(process.env.WORKER_1 || '43929'),
    host: '0.0.0.0',
    strictPort: false,
    cors: true,
    // Note: octaneGrpcPlugin handles all /api routes directly
    // No proxy needed since plugin implements /api/grpc/*, /api/health, /api/callbacks
  },
  build: {
    outDir: '../dist/client',
    chunkSizeWarningLimit: 1000, // Increase limit to 1000 kB (bundle is 587 kB, compresses to 170 kB)
  }
})
