#!/usr/bin/env node
/**
 * Type-check each pack that carries TypeScript, against its own closure only.
 *
 * A pack's archive carries only its own files, but the consumer mounts the
 * packs it requires into one tree, so a pack's non-block source may import
 * what a declared dependency carries at the same path. `rootDirs` tells the
 * compiler exactly that — and only for the pack's closure, so an import from
 * a pack it does not declare fails here. (check-integrity holds the same line
 * for blocks.) The floor's ambient declarations (`*.d.ts`) are visible to all.
 *
 * Usage: node tools/typecheck.mjs [pack …]
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { createRequire } from 'node:module'
import { REPO, FLOOR, PACK_IDS, packDir, orderedClosure, carriesTypeScript } from './lib/pack-map.mjs'
import { atomsDir } from './lib/pack-layout.mjs'

const require = createRequire(import.meta.url)
const TSC = require.resolve('typescript/bin/tsc')
const CACHE = join(REPO, 'node_modules', '.cache', 'pwpacks-typecheck')
mkdirSync(CACHE, { recursive: true })
const fromCache = (abs) => relative(CACHE, abs).split(sep).join('/')

const wanted = process.argv.slice(2)
const packs = (wanted.length ? wanted : PACK_IDS).filter((id) => carriesTypeScript(atomsDir(packDir(id))))
const failed = []

for (const id of packs) {
  const atoms = atomsDir(packDir(id))
  const include = [`${fromCache(atoms)}/**/*.ts`, `${fromCache(atoms)}/**/*.tsx`]
  if (id !== FLOOR) include.push(`${fromCache(atomsDir(packDir(FLOOR)))}/**/*.d.ts`)
  const config = {
    extends: fromCache(join(REPO, 'tsconfig.base.json')),
    compilerOptions: {
      rootDirs: [atoms, ...orderedClosure(id).map((r) => atomsDir(packDir(r)))].map(fromCache),
    },
    include,
  }
  const file = join(CACHE, `${id}.json`)
  writeFileSync(file, JSON.stringify(config, null, 2))
  process.stdout.write(`typecheck ${id} … `)
  try {
    execFileSync(process.execPath, [TSC, '-p', file], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' })
    console.log('ok')
  } catch (e) {
    console.log('FAIL')
    console.log(String(e.stdout || e.stderr || e.message))
    failed.push(id)
  }
}

if (failed.length) {
  console.error(`typecheck: ${failed.length} pack(s) failed — ${failed.join(', ')}`)
  process.exit(1)
}
console.log(`typecheck: ${packs.length} pack(s) pass`)
