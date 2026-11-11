import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // 5173 et 8000 sont pris par Softio (projet principal) : Compta tourne sur 5174 et 8001.
    port: 5174,
    strictPort: true,
    // En développement, l'API Laravel (php artisan serve --port=8001) est servie sur le même domaine via ce proxy.
    proxy: { '/api': { target: 'http://localhost:8001', changeOrigin: true } },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    css: false,
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
  },
})
