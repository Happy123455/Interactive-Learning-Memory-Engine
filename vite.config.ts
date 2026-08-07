import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  return {
    base: command === 'build' ? '/Interactive-Learning-Memory-Engine/' : '/',
    plugins: [react()],
    server: {
      host: true,
      proxy: {
        '/api': 'http://localhost:3001',
        '/simulations': 'http://localhost:3001',
        '/ums-tracker': 'http://localhost:3001'
      }
    }
  }
})
