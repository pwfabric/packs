/**
 * theme-base and the engine's own fallback (DEFAULT_APPEARANCE_THEME) are one
 * look: an app that names no theme draws as one that wears the base. Every group
 * the fallback sets must equal the base's; the base may add block colours
 * (heading, link, …), which the fallback leaves to each block's own default.
 *
 * Runs against @pwfabric/contracts 3.7.0 and later, where the fallback became the
 * base; an older engine (indigo) is skipped, with the reason.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_APPEARANCE_THEME } from '@pwfabric/contracts'

const base = JSON.parse(readFileSync(join(__dirname, '..', 'atoms', 'appearance', 'theme-base', 'manifest.json'), 'utf8')) as {
  theme: Record<string, Record<string, unknown>>
}
// The installed contracts' version (its package.json is not exported; read it from the workspace).
const version = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'node_modules', '@pwfabric', 'contracts', 'package.json'), 'utf8')) as { version: string }).version
const [major, minor] = version.split('.').map(Number) as [number, number]
const engineHasTheBase = major > 3 || (major === 3 && minor >= 7)

describe.skipIf(!engineHasTheBase)(`theme-base is the engine fallback (contracts ${version})`, () => {
  const fallback = DEFAULT_APPEARANCE_THEME as unknown as Record<string, Record<string, unknown>>
  it.each(Object.keys(fallback))('%s', (group) => {
    const own = fallback[group]!
    const picked = Object.fromEntries(Object.keys(own).map((k) => [k, base.theme[group]?.[k]]))
    expect(picked).toEqual(own)
  })
  it('the base sets every group the fallback does', () => {
    expect(Object.keys(base.theme).filter((g) => g !== 'blocks').sort()).toEqual(Object.keys(fallback).sort())
  })
})
