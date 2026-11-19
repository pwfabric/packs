/**
 * Every theme this repo ships parses under the engine's own `surfaceThemeSchema`
 * (@pwfabric/contracts 1.0.0).
 *
 * The schema refuses `colors.surface` ("not a theme colour — use colors.card"),
 * and typecheck, tests and the gate stay green over such a theme unless
 * something parses it with the engine's schema. This test is that parse: the appearance manifests of every pack in the repo, plus a walk
 * over every pack JSON file so a `colors.surface` cannot come back through a
 * surface or receipt either.
 *
 * Positive control: the schema rejects a theme that carries `colors.surface`.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'
import { surfaceThemeSchema } from '@pwfabric/contracts/schemas'

const REPO = resolve(__dirname, '..', '..')
const SKIP = new Set(['node_modules', 'dist', '.git', 'scripts', 'test'])

function packDirs(): string[] {
  return readdirSync(REPO)
    .filter((d) => !d.startsWith('.') && !SKIP.has(d))
    .filter((d) => existsSync(join(REPO, d, 'pwpack.json')) || existsSync(join(REPO, d, 'package.json')))
    .filter((d) => statSync(join(REPO, d)).isDirectory() && existsSync(join(REPO, d, 'atoms')))
}

function themeManifests(): string[] {
  const out: string[] = []
  for (const pack of packDirs()) {
    const dir = join(REPO, pack, 'atoms', 'appearance')
    if (!existsSync(dir)) continue
    for (const atom of readdirSync(dir)) {
      const file = join(dir, atom, 'manifest.json')
      if (!existsSync(file)) continue
      const m = JSON.parse(readFileSync(file, 'utf8')) as { kind?: string; theme?: unknown }
      if (m.theme !== undefined) out.push(file)
    }
  }
  return out
}

function jsonFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith('.')) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) jsonFiles(p, out)
    else if (name.endsWith('.json')) out.push(p)
  }
  return out
}

/** Paths of every `colors` object that names `surface`. */
function surfaceColourPaths(node: unknown, path = '$', out: string[] = []): string[] {
  if (Array.isArray(node)) node.forEach((v, i) => surfaceColourPaths(v, `${path}[${i}]`, out))
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === 'colors' && v && typeof v === 'object' && !Array.isArray(v) && 'surface' in v) {
        out.push(`${path}.colors.surface`)
      }
      surfaceColourPaths(v, `${path}.${k}`, out)
    }
  }
  return out
}

describe('themes parse under surfaceThemeSchema', () => {
  const manifests = themeManifests()

  it('finds the shipped themes', () => {
    // zinc, midnight, paper, linen, slate and ember.
    expect(manifests.length).toBeGreaterThanOrEqual(6)
  })

  it.each(manifests.map((f) => [relative(REPO, f), f]))('%s', (_name, file) => {
    const { theme, darkTheme } = JSON.parse(readFileSync(file, 'utf8')) as { theme: unknown; darkTheme?: unknown }
    const issues = (doc: unknown, where: string) => {
      const result = surfaceThemeSchema.safeParse(doc)
      return result.success ? [] : result.error.issues.map((i) => `${where}.${i.path.join('.')}: ${i.message}`)
    }
    expect([...issues(theme, 'theme'), ...(darkTheme === undefined ? [] : issues(darkTheme, 'darkTheme'))]).toEqual([])
  })

  it('positive control: a theme with colors.surface is refused', () => {
    const result = surfaceThemeSchema.safeParse({ colors: { card: '#ffffff', surface: '#fafafa' } })
    expect(result.success).toBe(false)
  })

  it('no pack JSON declares colors.surface', () => {
    const hits: string[] = []
    for (const pack of packDirs()) {
      for (const file of jsonFiles(join(REPO, pack))) {
        let doc: unknown
        try {
          doc = JSON.parse(readFileSync(file, 'utf8'))
        } catch {
          continue
        }
        for (const p of surfaceColourPaths(doc)) hits.push(`${relative(REPO, file)} ${p}`)
      }
    }
    expect(hits).toEqual([])
  })
})
