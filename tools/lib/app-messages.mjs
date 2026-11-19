// THE WORDS A BLOCK READS FROM THE APP.
//
// A block that draws a word of its own — a field's error, the accessible name
// of a close button, a date field's placeholder — reads it from the app's
// `plan.json` `messages` under a `ui.*` id (`useAppMessage`, `messageOf`). The
// pack's fallback is for an app that did not write the word, and an example
// app always writes it: every word a visitor reads is the app's.
//
// The ids a block can read are taken from its source: every `'ui.…'` string
// literal in its component.tsx and in the shared files of atoms/lib/ it
// imports. An app reaches the ids of every block type its pages place.

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { PACK_IDS, packDir } from './pack-map.mjs'

const UI_ID = /'(ui\.[A-Za-z0-9_.]+)'/g

const idsIn = (file) => [...readFileSync(file, 'utf8').matchAll(UI_ID)].map((m) => m[1])

/** The `ui.*` ids a component file reads, its imported shared lib files included. */
function idsOfComponent(file) {
  const ids = new Set(idsIn(file))
  const src = readFileSync(file, 'utf8')
  for (const m of src.matchAll(/from '((?:\.\.\/)+lib\/[^']+)\.js'/g)) {
    const lib = join(dirname(file), `${m[1]}.tsx`)
    const ts = join(dirname(file), `${m[1]}.ts`)
    for (const f of [lib, ts]) if (existsSync(f)) for (const id of idsIn(f)) ids.add(id)
  }
  return ids
}

/** block type → the `ui.*` ids it reads, over every pack. */
export function blockMessageIds() {
  const out = new Map()
  for (const pack of PACK_IDS) {
    const root = join(packDir(pack), 'atoms', 'blocks')
    if (!existsSync(root)) continue
    for (const cat of readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory())) {
      for (const b of readdirSync(join(root, cat.name), { withFileTypes: true }).filter((e) => e.isDirectory())) {
        const dir = join(root, cat.name, b.name)
        const manifest = join(dir, 'manifest.json')
        const component = join(dir, 'component.tsx')
        if (!existsSync(manifest) || !existsSync(component)) continue
        const type = JSON.parse(readFileSync(manifest, 'utf8')).name
        const ids = out.get(type) ?? new Set()
        for (const id of idsOfComponent(component)) ids.add(id)
        out.set(type, ids)
      }
    }
  }
  return out
}

/** Every block type placed in a receipt tree. */
export function blockTypesIn(receipt) {
  const types = new Set()
  const walk = (n) => {
    if (Array.isArray(n)) return n.forEach(walk)
    if (!n || typeof n !== 'object') return
    if (typeof n.type === 'string' && typeof n.id === 'string') types.add(n.type)
    for (const v of Object.values(n)) if (v && typeof v === 'object') walk(v)
  }
  walk(receipt.blocks)
  return types
}

/** The `ui.*` ids an app's pages reach, sorted. */
export function reachableUiIds(receipts, table = blockMessageIds()) {
  const ids = new Set()
  for (const r of receipts) for (const t of blockTypesIn(r)) for (const id of table.get(t) ?? []) ids.add(id)
  return [...ids].sort()
}
