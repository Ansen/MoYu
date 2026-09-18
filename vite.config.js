import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react()
  ],
  // Prevent vite from obscuring rust errors
  clearScreen: false,
  server: {
    port: 14200,
    // Tauri expects a fixed port, fail if that port is not available
    strictPort: true,
    watch: {
      // Tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('epubjs')) return 'vendor-epub';
            if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-pdf';
            if (id.includes('react')) return 'vendor-react';
          }
        },
      },
    },
  },
})
