import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Mirror prod's same-origin model locally: proxy the API paths to the local
  // backend so the SPA can use relative /v1 + /health URLs with no CORS in dev.
  // In prod, CloudFront does the equivalent routing (see the CDK stack).
  server: {
    proxy: {
      "/v1": "http://localhost:8000",
      "/health": "http://localhost:8000",
    },
  },
})
