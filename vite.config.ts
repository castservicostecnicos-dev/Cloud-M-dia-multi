import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.ico',
          'favicon-32x32.png',
          'favicon-16x16.png',
          'apple-touch-icon.png',
          'icon.svg',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png'
        ],
        manifest: {
          id: '/',
          name: 'Mídia Indoor - Sistema de Projeção',
          short_name: 'MídiaIndoor',
          description: 'Sistema completo de gerenciamento e exibição de mídia indoor com chamadas e playlists em tempo real.',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//],
          runtimeCaching: [
            // 1. Video Assets (MP4, WebM, OGG) with Range Requests for seekable offline playback
            {
              urlPattern: ({ request, url }) =>
                !url.pathname.startsWith('/api/') &&
                (request.destination === 'video' ||
                  /\.(?:mp4|webm|ogg|m4v|mov)$/i.test(url.pathname)),
              handler: 'CacheFirst',
              options: {
                cacheName: 'indoor-media-videos-v1',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 60, // 60 days
                  purgeOnQuotaError: true,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
                rangeRequests: true,
              },
            },
            // 2. Image Assets (PNG, JPG, JPEG, SVG, WebP, GIF, AVIF)
            {
              urlPattern: ({ request, url }) =>
                (!url.pathname.startsWith('/api/') || url.pathname.startsWith('/api/uploads/')) &&
                (request.destination === 'image' ||
                  /\.(?:png|jpg|jpeg|svg|gif|webp|avif|ico)$/i.test(url.pathname) ||
                  url.pathname.startsWith('/uploads/') ||
                  url.pathname.startsWith('/api/uploads/')),
              handler: 'CacheFirst',
              options: {
                cacheName: 'indoor-media-images-v1',
                expiration: {
                  maxEntries: 500,
                  maxAgeSeconds: 60 * 60 * 24 * 60, // 60 days
                  purgeOnQuotaError: true,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // 3. Audio Chimes & Alert Sounds
            {
              urlPattern: ({ request, url }) =>
                !url.pathname.startsWith('/api/') &&
                (request.destination === 'audio' ||
                  /\.(?:mp3|wav|ogg|aac)$/i.test(url.pathname)),
              handler: 'CacheFirst',
              options: {
                cacheName: 'indoor-media-audio-v1',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 60,
                  purgeOnQuotaError: true,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
                rangeRequests: true,
              },
            },
            // 4. Player & Session APIs - NetworkFirst with cache fallback
            {
              urlPattern: ({ url }) =>
                url.pathname.startsWith('/api/player/') ||
                url.pathname === '/api/auth/me',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'indoor-api-cache-v1',
                networkTimeoutSeconds: 4,
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 14, // 14 days
                  purgeOnQuotaError: true,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // 5. External Media / CDNs / Unsplash
            {
              urlPattern: /^https:\/\/(?:images\.unsplash\.com|cdn\.|assets\.).*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'indoor-external-cdn-cache-v1',
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                  purgeOnQuotaError: true,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // 6. Google Fonts
            {
              urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'indoor-google-fonts-cache-v1',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
