import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    watch: {
      ignored: [
        '**/app/build/**',
        '**/protocol/build/**',
        '**/dsp/build/**',
        '**/build/**',
        '**/.gradle/**',
        '**/.kotlin/**',
      ],
    },
  },
});
