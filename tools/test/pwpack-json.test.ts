import { describe, it, expect } from 'vitest'
import { pwpackJsonFor, licenseFlags, KEY_ORDER, caretOfMajor } from '../lib/pwpack-json.mjs'

const map = { defaults: { engines: '>=1.0.0 <3', tokens: ['--pw-color-primary-ink'] } }
const spec = {
  requires: ['data'],
  license: 'BUSL-1.1',
  listing: { name: 'Commerce', description: 'The buying range.', category: 'ecommerce' },
}
const versionOf = (id: string) => ({ data: '1.4.2' })[id] ?? '0.0.0'

describe('pwpackJsonFor', () => {
  it('writes every member in the fixed key order', () => {
    const out = pwpackJsonFor('commerce', spec, map, { version: '4.0.1' }, versionOf)
    expect(Object.keys(out)).toEqual(KEY_ORDER.filter((k) => k in out))
    expect(Object.keys(out)).toEqual([
      'id', 'version', 'formatVersion', 'name', 'description', 'category',
      'engines', 'requires', 'tokens', 'license',
    ])
  })

  it('keeps the version from disk and derives the rest from the map', () => {
    const out = pwpackJsonFor('commerce', spec, map, { version: '4.0.1' }, versionOf)
    expect(out.id).toBe('@pwpack/commerce')
    expect(out.version).toBe('4.0.1')
    expect(out.engines).toEqual({ pwfabric: '>=1.0.0 <3' })
    expect(out.requires).toEqual([{ id: '@pwpack/data', range: '^1.0.0' }])
    expect(out.tokens).toEqual(['--pw-color-primary-ink'])
  })

  it('carries an app pack’s app and packs members from disk', () => {
    const onDisk = { version: '1.0.0', app: { entry: 'home', surfaceOrder: ['home'] }, packs: [] }
    const out = pwpackJsonFor('demo', { ...spec, requires: [] }, map, onDisk, versionOf)
    expect(out.app).toEqual(onDisk.app)
  })
})

describe('licenseFlags', () => {
  it('maps Apache-2.0 to fork and redistribute', () => {
    expect(licenseFlags('Apache-2.0')).toEqual({ fork: true, redistribute: true })
  })
  it('maps BUSL-1.1 to fork without redistribution', () => {
    expect(licenseFlags('BUSL-1.1')).toEqual({ fork: true, redistribute: false })
  })
  it('refuses a licence it has no flags for', () => {
    expect(() => licenseFlags('MIT')).toThrow(/unknown licence/)
  })
})

describe('caretOfMajor', () => {
  it('pins the major of a version', () => {
    expect(caretOfMajor('8.0.1')).toBe('^8.0.0')
  })
})
