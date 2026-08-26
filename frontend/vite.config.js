import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@neuranet/sdk': path.resolve(here, '../sdk/index.js') },
  },
  server: {
    port: 5173,
    proxy: { '/v1': 'http://localhost:3000' }, // API interne — l'utilisateur ne voit que 5173
  },
});
