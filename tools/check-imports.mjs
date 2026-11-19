#!/usr/bin/env node
/**
 * Atoms import only what a published pack can resolve anywhere.
 *
 * A pack runs on any PWFabric host, so its source may import only the engine
 * (`@pwfabric/*`), the libraries every host provides (react, react-dom) and
 * relative files inside the pack. Not zod: since engine 3.0 a block's props
 * are declared in its manifest only, and no visitor page carries zod (the
 * engine refuses a block that imports it: BLOCK_IMPORTS_ZOD, ZOD_IMPORT). Anything else would tie the pack to one
 * host's private code.
 *
 * Usage: node tools/check-imports.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { REPO, PACK_IDS, packDir } from './lib/pack-map.mjs'
import { atomsDir } from './lib/pack-layout.mjs'

/** What an atom may import besides its own pack's relative files. */
const ALLOWED = /^(@pwfabric\/[a-z-]+(\/[a-z-]+)*|react|react-dom|react\/jsx-runtime)$/
const SPECIFIER = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g

function* sources(dir) {
  let entries
  try { entries = readdirSync(dir) } catch { return }
  for (const name of entries) {
    const abs = join(dir, name)
    if (statSync(abs).isDirectory()) yield* sources(abs)
    else if (/\.(ts|tsx|mts|mjs|js)$/.test(name)) yield abs
  }
}

const findings = []
for (const id of PACK_IDS) {
  for (const file of sources(atomsDir(packDir(id)))) {
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(SPECIFIER)) {
      const spec = m[1] ?? m[2] ?? m[3]
      if (spec.startsWith('.') || ALLOWED.test(spec)) continue
      const line = text.slice(0, m.index).split('\n').length
      findings.push(`${relative(REPO, file).split(sep).join('/')}:${line} imports '${spec}'`)
    }
  }
}

if (findings.length) {
  console.error(`check-imports: ${findings.length} import(s) of something a host does not provide`)
  for (const f of findings) console.error('  x ' + f)
  process.exit(1)
}
console.log('check-imports: atoms import only @pwfabric/*, react, react-dom and their own files')
