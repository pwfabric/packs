// Themes as they are drawn: a theme that `extends` another (appearance §3.5) is
// laid over its base, the same per-group merge the engine draws it with — blocks
// per block and per token, and a colours group that states its own ground drops
// the base's block colours (§3.1). Zero dependencies, like every tool here.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const NAMED = new Set(['primary', 'secondary', 'accent', 'background', 'card', 'text', 'textMuted', 'border', 'error', 'success', 'warning', 'info', 'textOnPrimary'])
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/** Per-group merge, `over` winning. */
export function mergeThemeGroups(base, over) {
  const out = {}
  for (const [k, v] of Object.entries(base ?? {})) out[k] = isObj(v) ? { ...v } : v
  for (const [k, v] of Object.entries(over ?? {})) {
    const prev = out[k]
    if (k === 'blocks' && isObj(v)) {
      const blocks = isObj(prev) ? { ...prev } : {}
      for (const [b, t] of Object.entries(v)) blocks[b] = { ...(isObj(blocks[b]) ? blocks[b] : {}), ...t }
      out[k] = blocks
    } else if (k === 'colors' && isObj(v) && isObj(prev)) {
      const kept = typeof v.background === 'string' ? Object.fromEntries(Object.entries(prev).filter(([n]) => NAMED.has(n))) : prev
      out[k] = { ...kept, ...v }
    } else out[k] = isObj(v) && isObj(prev) ? { ...prev, ...v } : v
  }
  return out
}

/**
 * Every `ui-appearance` atom under `dir` (atoms/appearance), by id, with its base
 * laid underneath: `{ id, dir, file, manifest, theme, darkTheme }`. A missing base
 * or a cycle throws: a pack that ships one is broken.
 */
export function resolvedThemes(dir) {
  const atoms = new Map()
  for (const d of existsSync(dir) ? readdirSync(dir).sort() : []) {
    const file = join(dir, d, 'manifest.json')
    if (!existsSync(file)) continue
    const manifest = JSON.parse(readFileSync(file, 'utf8'))
    if (manifest.kind !== 'ui-appearance' || (!manifest.theme && !manifest.extends)) continue
    atoms.set(manifest.id, { id: manifest.id, dir: d, file, manifest })
  }
  const find = (name) => atoms.get(name) ?? atoms.get(`theme-${name.replace(/^(appearance|theme)-/, '')}`)
  const done = new Map()
  const resolve = (atom, seen) => {
    if (done.has(atom.id)) return done.get(atom.id)
    const m = atom.manifest
    let theme = m.theme ?? {}
    let darkTheme = m.darkTheme
    if (m.extends) {
      const base = find(m.extends)
      if (!base) throw new Error(`${atom.file}: extends "${m.extends}", which is no theme in ${dir}`)
      if (seen.includes(base.id)) throw new Error(`${atom.file}: extends in a cycle: ${[...seen, atom.id, base.id].join(' → ')}`)
      const b = resolve(base, [...seen, atom.id])
      theme = mergeThemeGroups(b.theme, m.theme)
      darkTheme = b.darkTheme || m.darkTheme ? mergeThemeGroups(b.darkTheme, m.darkTheme) : undefined
    }
    const out = { ...atom, theme, ...(darkTheme ? { darkTheme } : {}) }
    done.set(atom.id, out)
    return out
  }
  return [...atoms.values()].map((a) => resolve(a, []))
}
