import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/** Must match the GitHub repository name for project Pages. */
const BASE = '/lavanda-game/'

export default defineConfig({
  base: BASE,
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['.nojekyll'],
      manifest: {
        name: 'Лаванда',
        short_name: 'Лаванда',
        description: 'Пакман с Лавандой',
        theme_color: '#2a2635',
        background_color: '#e8e4f0',
        display: 'standalone',
        orientation: 'portrait',
        scope: BASE,
        start_url: BASE,
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
      },
    }),
  ],
})
