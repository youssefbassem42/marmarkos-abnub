import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// The API is proxied under /api so the browser sees one origin in every
// environment: Vercel rewrites do it in production (frontend/vercel.json),
// this dev server does it locally. Same-origin keeps the HttpOnly refresh
// cookie (SameSite=Lax, path=/api/v1/auth) working, which a separate API
// domain would silently break.
const DEV_API_TARGET =
  process.env.VITE_DEV_API_TARGET ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: DEV_API_TARGET,
        changeOrigin: false,
      },
    },
  },
});
