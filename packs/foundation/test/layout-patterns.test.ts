/**
 * The app layout patterns (receipt §4): each snippet is the one top-level
 * block of `app/layout.receipt.json`, holds exactly one bare page slot
 * `{ "type": "pw:page" }`, and leaves `activeHref` to the engine, which fills
 * it for every layout block whose manifest declares it.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ATOMS = join(dirname(fileURLToPath(import.meta.url)), '..', 'atoms')
type Node = { id?: string; type: string; props?: Record<string, unknown>; style?: Record<string, unknown>; children?: Node[]; [k: string]: unknown }
const pattern = (name: string): { role: string; snippet: Node; usesBlocks: string[] } =>
  JSON.parse(readFileSync(join(ATOMS, 'patterns', `${name}.json`), 'utf8'))
const declares = (path: string, prop: string): boolean =>
  (JSON.parse(readFileSync(join(ATOMS, 'blocks', path, 'manifest.json'), 'utf8')).definition.props as { name: string }[]).some((p) => p.name === prop)

function nodes(n: Node, out: Node[] = []): Node[] {
  out.push(n)
  for (const c of n.children ?? []) nodes(c, out)
  return out
}

describe.each(['layout-topbar', 'layout-docs'])('%s', (name) => {
  const p = pattern(name)
  const all = nodes(p.snippet)

  it('is a layout holding exactly one bare page slot', () => {
    expect(p.role).toBe('layout')
    const slots = all.filter((n) => n.type === 'pw:page')
    expect(slots).toHaveLength(1)
    expect(Object.keys(slots[0]!).filter((k) => k !== 'type' && k !== 'id')).toEqual([])
    expect(p.usesBlocks).not.toContain('pw:page')
  })

  it('the slot sits in the main landmark, between the bar and the footer', () => {
    const main = all.find((n) => n.props?.['landmark'] === 'main')
    expect(main && nodes(main).some((n) => n.type === 'pw:page')).toBe(true)
    const top = p.snippet.children ?? []
    expect(top[0]?.type).toBe('navbar')
    expect(top[top.length - 1]?.props?.['landmark']).toBe('footer')
  })

  it('leaves activeHref to the engine: the blocks that mark the page declare it and set none', () => {
    for (const n of all.filter((x) => x.type === 'navbar' || x.type === 'sidebar')) {
      expect(declares(n.type === 'navbar' ? 'layout/navbar' : 'layout/sidebar', 'activeHref')).toBe(true)
      expect(n.props?.['activeHref']).toBeUndefined()
    }
  })

  it('the bar sticks through its block style', () => {
    const nav = all.find((n) => n.type === 'navbar')!
    expect(nav.style).toMatchObject({ position: 'sticky', top: '0' })
    expect(nav.props?.['sticky']).toBeUndefined()
  })
})

describe('layout-docs', () => {
  it('puts the sidebar beside the page', () => {
    const all = nodes(pattern('layout-docs').snippet)
    const row = all.find((n) => n.children?.some((c) => c.type === 'sidebar'))!
    expect(row.props?.['direction']).toBe('row')
    expect(row.children?.map((c) => c.type)).toEqual(['sidebar', 'container'])
    expect(nodes(row.children![1]!).some((n) => n.type === 'pw:page')).toBe(true)
  })
})
