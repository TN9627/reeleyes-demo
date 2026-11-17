import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Served from GitHub Pages under /reeleyes-demo/ with hash routes, so every URL is relative.
export default defineConfig({
  base: './',
  // Phones on the LAN can open the dev and preview servers.
  server: { host: true },
  preview: { host: true },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        id: './',
        name: 'ReelEyes',
        short_name: 'ReelEyes',
        description: 'Plan an Arizona fishing trip: Spots ranked by drive time, with conditions, rules and gear. Demo on sample data.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#FAF8F3',
        background_color: '#FAF8F3',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-1024.png', sizes: '1024x1024', type: 'image/png', purpose: 'any' },
        ],
      },
      workbox: {
        // Everything ships offline after the first load, sample photos included.
        globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,svg,webp,ico,webmanifest}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Map tiles seen once stay available offline.
            urlPattern: /^https:\/\/[a-d]\.basemaps\.cartocdn\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 3000, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
