import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // En desarrollo (npm run dev) las llamadas /api se redirigen a `vercel dev` (puerto 3000).
  server: { proxy: { '/api': 'http://localhost:3000' } },
});
