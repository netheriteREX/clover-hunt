import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    }
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        configure: (proxy) => {
          proxy.on("proxyReq", (_proxyReq, req) => {
            console.log(`[api] -> ${req.method} ${req.url}`);
          });
          proxy.on("proxyRes", (proxyRes, req) => {
            console.log(`[api] <- ${proxyRes.statusCode} ${req.method} ${req.url}`);
          });
          proxy.on("error", (err, req) => {
            console.error(`[api] x  ${req.method} ${req.url} — ${err.message}`);
          });
        },
      },
    },
  },
})
