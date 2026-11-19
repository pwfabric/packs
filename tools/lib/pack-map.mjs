// THE PACK MAP, READ ONCE.
//
// `pack-map.json` says which packs exist, which packs
// each one stands on (`requires`) and what each one is called in a listing.
// Everything a tool derives from it — a pack's closure, its dependents, the
// roots its integrity check resolves against — is computed here, so the
// generator, the checks and the test runner cannot derive it differently.

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const PACKS_ROOT = join(REPO, 'packs')
export const map = JSON.parse(readFileSync(join(REPO, 'pack-map.json'), 'utf8'))
export const FLOOR = map.floor
export const PACK_IDS = Object.keys(map.packs)

export const packDir = (id) => join(PACKS_ROOT, id)

/** A pack's current version, read from its pwpack.json. */
export function versionOf(id) {
  const f = join(packDir(id), 'pwpack.json')
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')).version ?? '0.0.0' : '0.0.0'
}

/** Every pack `id` can resolve against, transitively. */
export function closureOf(id, seen = new Set()) {
  for (const r of map.packs[id]?.requires ?? []) {
    if (seen.has(r)) continue
    seen.add(r)
    closureOf(r, seen)
  }
  return seen
}

/** The closure in dependency order: the floor first, the nearest peer last. */
export function orderedClosure(id) {
  const out = []
  const visit = (x) => {
    for (const r of map.packs[x]?.requires ?? []) {
      visit(r)
      if (!out.includes(r)) out.push(r)
    }
  }
  visit(id)
  return out
}

/** Every pack that carries `id` in its closure. */
export const dependentsOf = (id) => PACK_IDS.filter((o) => o !== id && closureOf(o).has(id))

/** Whether a directory holds any TypeScript source. */
export function carriesTypeScript(dir) {
  if (!existsSync(dir)) return false
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, e.name)
    if (e.isDirectory() ? carriesTypeScript(abs) : /\.tsx?$/.test(e.name)) return true
  }
  return false
}
