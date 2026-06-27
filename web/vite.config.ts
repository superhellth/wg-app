import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // NOTE: app-shell caching only for now. Web Push handlers will be added
      // later via injectManifest + a custom service worker (src/sw.ts).
      manifest: {
        name: "WG App",
        short_name: "WG",
        description: "Shared-living management",
        theme_color: "#1976d2",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        // icons: add 192x192 + 512x512 PNGs in /public before release
      },
      workbox: {
        navigateFallback: "/index.html",
      },
    }),
  ],
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
