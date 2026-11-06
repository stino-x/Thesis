import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    headers: {
      // Relax COEP to allow cross-origin resources (MediaPipe, ONNX models)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless', // Changed from 'require-corp'
    },
  },
  optimizeDeps: {
    exclude: ['@mediapipe/face_detection', '@mediapipe/face_mesh'],
  },
  build: {
    assetsInlineLimit: 0, // Don't inline any assets, including binary files
  },
  // Ensure public directory is copied correctly
  publicDir: 'public',
})
