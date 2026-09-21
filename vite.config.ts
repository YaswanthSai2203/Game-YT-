import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

const playables = process.env.VITE_PLAYABLES === 'true';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'es2022',
    minify: 'esbuild',
    rollupOptions: {
      input: playables ? path.resolve(__dirname, 'index.playables.html') : undefined,
      output: {
        manualChunks: playables ? undefined : {
          pixi: ['pixi.js'],
        },
      },
    },
  },
  plugins: [
    ...(playables
      ? []
      : [
          VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'NEON ARCADE',
        short_name: 'NeonArcade',
        description: 'Browser arcade — NEON PULSE, Offline Rex, and Catapult Chaos.',
        theme_color: '#F5F3EF',
        background_color: '#F5F3EF',
        display: 'standalone',
        orientation: 'any',
        icons: [
          {
            src: 'icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
        ]),
  ],
});
