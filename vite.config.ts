import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// EventOps PWA config — installable on mobile + desktop, with controlled updates.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // we register + control updates from src/pwa
      includeAssets: ['favicon.svg'],
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true, // new deploy takes over immediately
        importScripts: ['push-sw.js'], // web push handlers, see public/push-sw.js
      },
      manifest: {
        name: 'MEETIX - Event Management',
        short_name: 'MEETIX',
        description: 'Event / MICE management platform',
        theme_color: '#0f172a',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        categories: ['business', 'productivity'],
        screenshots: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', form_factor: 'narrow' },
        ],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          {
            name: 'Dashboard',
            short_name: 'Panel',
            description: 'View event dashboard',
            url: '/',
            icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
    }),
  ],
});
