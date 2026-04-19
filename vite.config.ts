import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/** Must match the GitHub repository name for project Pages. */
const BASE = '/lavanda-game/'

/** iOS caches apple-touch-icon aggressively; bump URL each CI build. */
function htmlIconCacheBust(): Plugin {
  const v =
    process.env.GITHUB_RUN_NUMBER ?? process.env.npm_package_version ?? String(Date.now())
  return {
    name: 'html-icon-cache-bust',
    transformIndexHtml(html) {
      return html
        .replaceAll('./apple-touch-icon.png"', `./apple-touch-icon.png?v=${v}"`)
        .replaceAll('./icon-192.png"', `./icon-192.png?v=${v}"`)
    },
  }
}

export default defineConfig({
  base: BASE,
  plugins: [
    htmlIconCacheBust(),
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
        // Helps iOS standalone / subpath when the SW handles navigation.
        navigateFallback: `${BASE}index.html`,
      },
    }),
  ],
})
