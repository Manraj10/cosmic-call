import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(root, 'shared'),
    },
  },
  server: {
    host: true,
    port: 43127,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/socket.io': { target: 'http://127.0.0.1:43128', ws: true },
      '/api': { target: 'http://127.0.0.1:43128' },
    },
  },
  preview: { host: true, port: 43127 },
})
