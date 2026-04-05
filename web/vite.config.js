var _a;
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
var proxyTarget = (_a = process.env.VITE_API_PROXY_TARGET) !== null && _a !== void 0 ? _a : 'http://localhost:8081';
export default defineConfig({
    plugins: [react()],
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
