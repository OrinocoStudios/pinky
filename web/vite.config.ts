import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const proxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8081';
const spaRoutes = new Set([
  '/',
  '/documents',
  '/documentation',
  '/resources',
  '/query',
  '/login',
]);

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'spa-html-fallback-before-proxy',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          const path = req.url?.split('?')[0] ?? '';
          const accept = req.headers.accept ?? '';
          const isHtmlNavigation = req.method === 'GET' && accept.includes('text/html');
          if (isHtmlNavigation && spaRoutes.has(path)) {
            req.url = '/';
          }
          next();
        });
      },
    },
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: false,
    css: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/auth': proxyTarget,
      '/health': proxyTarget,
      '/documents': proxyTarget,
      '/query': proxyTarget,
      '/summarize': proxyTarget,
      '/admin': proxyTarget,
      '/index': proxyTarget,
    },
  },
});
