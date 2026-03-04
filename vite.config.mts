import { defineConfig } from 'vite'
import { readFileSync } from 'fs'
import react from '@vitejs/plugin-react'
import { octaneGrpcPlugin } from './vite-plugin-octane-grpc'
import { USE_ALPHA5_API } from './api-version.config.js'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  plugins: [
    react(),
    octaneGrpcPlugin()
  ],
  root: 'client',
  // Inject API version config and app version as global constants for client-side code
  define: {
    '__USE_ALPHA5_API__': JSON.stringify(USE_ALPHA5_API),
    '__APP_VERSION__': JSON.stringify(pkg.version),
  },
  server: {
    port: parseInt(process.env.WORKER_1 || '43929'),
    host: '0.0.0.0',
    strictPort: false,
    cors: { origin: /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/ },
    // Note: octaneGrpcPlugin handles all /api routes directly
    // No proxy needed since plugin implements /api/grpc/*, /api/health, /api/callbacks
  },
  build: {
    outDir: '../dist/client',
    chunkSizeWarningLimit: 1000,
  }
})
