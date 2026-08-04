import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  return {
    base: command === 'build' ? '/Interactive-Learning-Memory-Engine/' : '/',
    plugins: [react()],
    server: {
      proxy: {
        '/api': 'http://localhost:5050',
        '/simulations': 'http://localhost:5050'
      }
    }
  }
})
