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
        '/api': {
          target: 'http://127.0.0.1:3001',
          changeOrigin: true,
          secure: false
        },
        '/simulations': {
          target: 'http://127.0.0.1:3001',
          changeOrigin: true,
          secure: false
        },
        '/ums-tracker': {
          target: 'http://127.0.0.1:3001',
          changeOrigin: true,
          secure: false
        }
      }
    }
  }
})
