import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/Interactive-Learning-Memory-Engine/' : '/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:5050',
      '/simulations': 'http://localhost:5050'
    }
  }
})
