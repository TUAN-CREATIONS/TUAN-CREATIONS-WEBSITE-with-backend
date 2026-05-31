import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    modulePreload: {
      polyfill: false,
    },
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          icons: ['lucide-react'],
          select: ['react-select', 'react-select-country-list'],
        },
      },
    },
  },
  optimizeDeps: {
    // Only exclude modules that cause hot reload issues, keep react-select bundled
    exclude: ['lucide-react'],
  },
});
