import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
const proxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8081';
export default defineConfig({
    plugins: [react()],
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
