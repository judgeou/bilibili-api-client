import { resolve } from 'path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const PORT = process.env.PORT || '8080'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'dan-player': resolve(__dirname, 'dan-player.html')
      }
    }
  },
  server: {
    proxy: {
      '/api': `http://localhost:${PORT}`,
      '/dandan-api': `http://localhost:${PORT}`
    }
  }
})
