import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/gitnord/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**'
    ]
  }
})

