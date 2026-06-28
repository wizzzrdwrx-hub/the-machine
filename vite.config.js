import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Exclude large ML packages from Vite pre-bundling for faster dev server startup
    exclude: ['@tensorflow/tfjs', '@tensorflow-models/coco-ssd'],
  },
})