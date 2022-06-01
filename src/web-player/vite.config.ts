import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const PORT = process.env.PORT || '8080'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': `http://localhost:${PORT}`
    }
  }
})
