import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname),
  server: {
    port: 5180,
    strictPort: true,
  },
  build: {
    outDir: path.resolve(__dirname, '../dist-web'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }
          if (id.includes('framer-motion')) {
            return 'vendor-motion';
          }
          if (id.includes('react-router')) {
            return 'vendor-router';
          }
          if (id.includes('/react/') || id.includes('/react-dom/')) {
            return 'vendor-react';
          }
          return 'vendor';
        },
      },
    },
  },
});
