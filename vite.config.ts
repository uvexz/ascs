import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import type { WarningHandlerWithDefault } from 'rolldown'

const nitroIgnoredWarningCodes = new Set([
  'EVAL',
  'CIRCULAR_DEPENDENCY',
  'THIS_IS_UNDEFINED',
  'EMPTY_BUNDLE',
])

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  build: {
    // The Kumo + TanStack Router vendor chunk is intentionally large; raise the
    // advisory threshold so a clean build stays warning-free.
    chunkSizeWarningLimit: 700,
  },
  plugins: [
    devtools(),
    nitro({
      // Pre-compress the public bundle (JS/CSS/HTML/SVG) so the Node/Docker
      // server serves brotli/gzip automatically; Vercel compresses at the edge
      // either way, but a bare `node .output/server/index.mjs` has no proxy.
      compressPublicAssets: true,
      routeRules: {
        // embed.js is the integration contract and is not content-hashed, so it
        // needs an explicit short cache with revalidation instead of the ETag-only
        // heuristic the static handler would otherwise leave it with.
        '/embed.js': {
          headers: { 'cache-control': 'public, max-age=3600' },
        },
      },
      rollupConfig: {
        external: [/^@sentry\//],
        onwarn: ((warning, defaultHandler) => {
          if (nitroIgnoredWarningCodes.has(warning.code ?? '')) return
          if (
            warning.code === 'MODULE_LEVEL_DIRECTIVE' &&
            (warning.message.includes('use client') ||
              warning.message.includes('use server'))
          ) {
            return
          }
          defaultHandler(warning)
        }) satisfies WarningHandlerWithDefault,
      },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
