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
  plugins: [
    devtools(),
    nitro({
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
