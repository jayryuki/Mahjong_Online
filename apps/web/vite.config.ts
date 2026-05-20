import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3501,
    host: '0.0.0.0',
    allowedHosts: ['mahjong.jayryuki.com'],
    proxy: {
      '/api': 'http://localhost:2500',
      '/ws': { target: 'ws://localhost:2500', ws: true },
    },
  },
});
