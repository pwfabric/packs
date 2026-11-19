import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'vitest/config'

// One Vitest project per pack that has TypeScript tests under `packs/<id>/test/`.
// They are behaviour tests for block components (jsdom): what a form submits,
// what a block tells the visitor. The structural checks are `pnpm check`.
const packs = readdirSync('packs').filter((id) => {
  const dir = join('packs', id, 'test')
  return existsSync(dir) && readdirSync(dir).some((f) => /\.test\.tsx?$/.test(f))
})

export default defineConfig({
  test: {
    projects: [
      ...packs.map((id) => ({
        extends: true,
        test: {
          name: id,
          root: join('packs', id),
          include: ['test/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          // A block draws no word of its own; outside a test's own messages it
          // reads the stand-in app's words (tools/test-support/app-words.ts).
          setupFiles: ['../../tools/test-support/app-words.ts'],
        },
      })),
      // The tools' own unit tests (gate rules, wiring rules, pwpack.json).
      { extends: true, test: { name: 'tools', root: 'tools', include: ['test/**/*.test.ts'], environment: 'node' } },
    ],
  },
  esbuild: { jsx: 'automatic' },
  // One React for the tests and for the engine packages.
  resolve: { dedupe: ['react', 'react-dom'] },
})
