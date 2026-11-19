/**
 * Table and date-input against the theme tokens.
 *
 *   table status pill: the theme's corner, ink by the pill's own fill;
 *        date-input: the same control edge as a text input
 *   table destructive action: ink by the error fill
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, cleanup } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { TableBlock } from '../../foundation/atoms/blocks/data/table/component.js'
import { DateInputBlock } from '../../foundation/atoms/blocks/form/date-input/component.js'
import { inkOn } from '../../foundation/atoms/lib/_shared-utils.js'
import { contrast, evalColor, paint, presetTokenSets, resolveVars } from '../../foundation/test/_contrast.js'
import { applied } from '../../../tools/test-support/applied-props.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const FOUNDATION_THEMES = join(HERE, '..', '..', 'foundation', 'atoms', 'appearance')

afterEach(() => cleanup())

type AnyBlock = React.FC<Record<string, unknown>>

function el(C: unknown, id: string, type: string, props: Record<string, unknown>) {
  const Comp = C as AnyBlock
  return <Comp key={id} props={applied(type, props)} block={{ id, type, props, layout: {} }} context={{}} />
}
const mount = (tree: React.ReactNode) =>
  render(<BehaviorSurfaceProvider surfaceId="t">{tree}</BehaviorSurfaceProvider>).container

const TONES = ['danger', 'warning', 'success', 'info', 'primary', 'muted'] as const
const TONE_TOKEN: Record<(typeof TONES)[number], string> = {
  danger: 'var(--pw-color-error)',
  warning: 'var(--pw-color-warning)',
  success: 'var(--pw-color-success)',
  info: 'var(--pw-color-info)',
  primary: 'var(--pw-color-primary)',
  muted: 'var(--pw-color-text-muted)',
}

describe('the table status pill follows the theme', () => {
  const pill = (): HTMLElement => {
    const c = mount(
      el(TableBlock, 't', 'table', {
        columns: [{ key: 'status', header: 'Status', type: 'badge', badgeColorMap: { Full: 'warning' } }],
        data: [{ status: 'Full' }],
      }),
    )
    return Array.from(c.querySelectorAll('span')).find((s) => s.textContent === 'Full') as HTMLElement
  }
  it("takes the theme's corner, not a fixed 999px pill", () => {
    expect(pill().style.borderRadius).toBe('var(--pw-border-radius, 999px)')
  })
  it("inks the label by the pill's own fill, not the brand's on-primary", () => {
    const style = pill().getAttribute('style') ?? ''
    expect(style).not.toContain('color: var(--pw-color-text-on-primary)')
    expect(style).toContain('color(from var(--pw-color-warning) srgb-linear')
  })
})

describe('the table destructive action is inked by the error fill', () => {
  it('reads --pw-color-on-error, then black/white by luminance', () => {
    const c = mount(
      el(TableBlock, 't', 'table', {
        columns: [{ key: 'x', header: '', type: 'button', buttonLabel: 'Delete', buttonVariant: 'destructive' }],
        data: [{ x: 1 }],
      }),
    )
    const style = (c.querySelector('button') as HTMLElement).getAttribute('style') ?? ''
    expect(style).toContain('var(--pw-color-on-error, color(from var(--pw-color-error) srgb-linear')
  })
})

describe('the date / time field edge is as visible as a text input', () => {
  it.each(['date', 'time', 'datetime'])('mode %s uses the control edge and the theme corner', (mode) => {
    const c = mount(el(DateInputBlock, 'd', 'date-input', { label: 'Date', mode }))
    const input = c.querySelector('input') as HTMLElement
    expect(input.getAttribute('style')).toContain('--pw-color-control-border')
    expect(input.style.borderRadius).toBe('var(--pw-border-radius, 6px)')
  })
})

describe('contrast of the table ink in 6 presets × light / derived dark', () => {
  // Foundation's two themes plus the four of the themes pack: the table must
  // read in every theme the catalogue ships.
  const rows = presetTokenSets([FOUNDATION_THEMES]).map(({ preset, mode, vars }) => {
    const card = evalColor(resolveVars('var(--pw-color-card)', vars))
    const row: Record<string, string | number> = { cell: `${preset}/${mode}` }
    for (const tone of TONES) {
      const fill = paint(TONE_TOKEN[tone], vars, card)
      row[tone] = Math.round(contrast(paint(inkOn(TONE_TOKEN[tone]), vars, fill), fill) * 100) / 100
    }
    const err = paint('var(--pw-color-error)', vars, card)
    row.destructive = Math.round(contrast(paint(inkOn('var(--pw-color-error)', '--pw-color-on-error'), vars, err), err) * 100) / 100
    return row
  })
  it('prints the table', () => {
    // eslint-disable-next-line no-console
    console.table(rows)
    expect(rows).toHaveLength(12)
  })
  it.each(rows)('$cell · every pill label and the destructive label clear 4.5:1', (row) => {
    for (const k of [...TONES, 'destructive']) expect(row[k] as number).toBeGreaterThanOrEqual(4.5)
  })
})
