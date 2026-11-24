// @vitest-environment node
/**
 * An example app on this foundation: one documentation page written in prose
 * (test/fixtures/docs-page.receipt.json) — a table, nested steps, two code
 * samples with copy buttons — built with the engine's own `pwf build`. What
 * a reader without scripts gets is the long form, its anchors and its
 * buttons, in the app's words.
 */
import { describe, it, expect } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { main } from '@pwfabric/cli'

const HERE = dirname(fileURLToPath(import.meta.url))
const FOUNDATION = join(HERE, '..')

const io = (cwd: string, lines: string[]) => ({ cwd, out: (l: string) => lines.push(l), err: (l: string) => lines.push(l), env: {} })

describe('a documentation page in prose, built', () => {
  it('draws the table, the nested steps, the coloured code and its copy buttons in the first frame', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'pw-docs-'))
    try {
      const lines: string[] = []
      expect(await main(['create', 'docs', '--foundation', FOUNDATION], io(cwd, lines)), lines.join('\n')).toBe(0)
      const root = join(cwd, 'docs')
      await writeFile(join(root, 'app', 'surfaces', 'home.receipt.json'), await readFile(join(HERE, 'fixtures', 'docs-page.receipt.json'), 'utf8'))
      const planPath = join(root, 'app', 'plan.json')
      const plan = JSON.parse(await readFile(planPath, 'utf8')) as { messages?: Record<string, string> }
      plan.messages = { ...plan.messages, 'ui.copy': 'Copy', 'ui.copied': 'Copied' }
      await writeFile(planPath, JSON.stringify(plan, null, 2))

      const built: string[] = []
      expect(await main(['build', '--out', 'site'], io(root, built)), built.join('\n')).toBe(0)
      const html = await readFile(join(root, 'site', 'index.html'), 'utf8')
      expect(html).toContain('<table><thead><tr><th data-align="left">Platform</th><th data-align="center">Supported</th><th data-align="right">Notes</th>')
      expect(html).toMatch(/<ol><li>Install the package<ul><li>with pnpm: <code>pnpm add -g example-cli<\/code><\/li>/)
      expect(html).toContain('<pre data-lang="bash"><code><span data-tok="comment"># install it once</span>')
      expect(html).toContain('<pre data-lang="json">')
      expect(html.match(/data-pw-prose-copy="\d"/g)).toEqual(['data-pw-prose-copy="0"', 'data-pw-prose-copy="1"'])
      expect(html).toContain('>Copy</button>')
      for (const id of ['install-the-cli', 'requirements', 'steps', 'next']) expect(html).toContain(`id="${id}"`)
      // The engine writes no word of its own: the copy words are the app's.
      expect(html).not.toContain('>ui.copy<')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  }, 120_000)
})
