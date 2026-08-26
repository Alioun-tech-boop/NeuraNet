import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: here,
  plugins: [react()],
  css: { postcss: path.join(here, 'postcss.config.js') },
  resolve: {
    alias: { '@neuranet/sdk': path.resolve(here, '../sdk/index.js') },
  },
  server: {
    port: 5174,
    proxy: { '/v1': 'http://localhost:3000', '/health': 'http://localhost:3000' },
  },
});
