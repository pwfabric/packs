import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { useAppMessage } from '@pwfabric/runtime'
import type { BlockComponent } from '../../../lib/component-types.js'
import { HIT_AREA_CSS, langOf, safeHref } from '../../../lib/_shared-utils.js'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export interface LanguageSwitchProps {
  /**
   * The name shown for a locale, `{ "de": "DE" }`. Unset, each language is
   * named in itself ("Deutsch", "Türkçe"), as a visitor looking for theirs
   * reads it.
   */
  readonly labels?: Readonly<Record<string, string>>
  /** Between the links: a gap (default) or a thin rule. */
  readonly separator: 'none' | 'rule'
  /**
   * The links' colour. Unset, they take the colour around them, so the
   * switch reads on a dark bar as on a light page.
   */
  readonly color?: string
}

// ============================================================
// DEFINITION
// ============================================================

export const languageSwitchDefinition: BlockDefinition = {
  type: 'language-switch',
  name: 'Language switch',
  category: 'control',
  icon: '⇄',
  defaultProps: { separator: 'none' },
  defaultLayout: { span: { xs: 4, sm: 4, md: 3, lg: 3 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

/** A language named in itself, first letter in that language's capital: `de` → "Deutsch". */
export function autonym(lang: string): string {
  try {
    const name = new Intl.DisplayNames([lang], { type: 'language' }).of(lang)
    if (name && name.toLowerCase() !== lang.toLowerCase()) return name.charAt(0).toLocaleUpperCase(lang) + name.slice(1)
  } catch {
    // An engine without Intl.DisplayNames, or a tag it does not know.
  }
  return lang.toUpperCase()
}

/** Each other locale of the app that has an address for this page, in the app's order, the current one included. */
export function switchEntries(
  locales: readonly unknown[] | undefined,
  alternates: Readonly<Record<string, unknown>> | undefined,
): { lang: string; href: string }[] {
  if (!Array.isArray(locales) || !alternates || typeof alternates !== 'object') return []
  const out: { lang: string; href: string }[] = []
  for (const raw of locales) {
    const lang = langOf(raw)
    if (!lang || out.some((e) => e.lang === lang)) continue
    const address = alternates[lang]
    const href = typeof address === 'string' ? safeHref(address) : undefined
    if (href !== undefined) out.push({ lang, href })
  }
  return out
}

/**
 * Links to this page in the app's other languages (envelope §2.3): each one
 * `hreflang` and `lang` of its language, named in that language, the current
 * one `aria-current="page"`. The addresses are `context.alternates`, written
 * as links to them are, so they go as given. An app in one language has
 * nothing to switch to: the block draws nothing.
 */
export const LanguageSwitchBlock: BlockComponent = ({ props, block, context }) => {
  const p = props as unknown as LanguageSwitchProps
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()
  const navWord = useAppMessage('ui.language', 'Language')
  const entries = switchEntries(context?.locales, context?.alternates)
  if (entries.length < 2) return null
  const current = langOf(context?.locale)
  const labels = p.labels && typeof p.labels === 'object' ? p.labels : {}
  const rule = p.separator === 'rule'
  const inert = context?.interactionMode === 'inert'
  const onClick = (href: string) => (e: React.MouseEvent<HTMLAnchorElement>): void => {
    if (!inert) return
    e.preventDefault()
    emit({ type: SURFACE_EVENTS.BLOCK_CLICK, surfaceId, blockId: block.id, payload: { href } })
  }
  return (
    <nav id={block.id} data-block-id={block.id} data-block-type="language-switch" aria-label={navWord} style={{ minWidth: 0, ...block.style }}>
      <style>{HIT_AREA_CSS}</style>
      <ul style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: rule ? 0 : '12px', listStyle: 'none', margin: 0, padding: 0 }}>
        {entries.map((e, i) => {
          const isCurrent = current !== undefined && e.lang.toLowerCase() === current.toLowerCase()
          const own = labels[e.lang]
          const label = typeof own === 'string' && own.trim() ? own.trim() : autonym(e.lang)
          return (
            <li
              key={e.lang}
              style={rule && i > 0 ? { borderLeft: '1px solid var(--pw-color-border)', paddingLeft: '12px', marginLeft: '12px' } : undefined}
            >
              <a
                href={e.href}
                hrefLang={e.lang}
                lang={e.lang}
                data-pw-hit=""
                aria-current={isCurrent ? 'page' : undefined}
                onClick={onClick(e.href)}
                style={{
                  // The surrounding ink by default: a fixed text token was
                  // dark-on-dark inside a primary-painted bar.
                  color: typeof p.color === 'string' && p.color.trim() ? p.color : 'inherit',
                  fontSize: 'var(--pw-font-size-sm)',
                  fontWeight: isCurrent ? 600 : 400,
                  textDecoration: isCurrent ? 'underline' : 'none',
                  textDecorationColor: 'currentColor',
                  textUnderlineOffset: '4px',
                }}
              >
                {label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

// This block's width is its content: in a flex row it must not take an equal share.
Object.assign(LanguageSwitchBlock, { sizing: 'intrinsic' })
