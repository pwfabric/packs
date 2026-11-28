import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { safeRenderValue, safeHref, ICON_PATHS, listOf, PRESS_CSS } from '../../../lib/_shared-utils.js'
import {
  AccountAvatar,
  AccountControl,
  type AccountInfo,
  placeAccountInBar,
  firstWord,
  readAccount,
  routeState,
  sameRoute,
  useBottomBarHeightVar,
} from '../../../lib/_shared-account-menu.js'
import { messageOf, useAppMessages } from '@pwfabric/runtime'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

/**
 * A bottom bar is not a footer and not a thin rail.
 *
 * It carries up to five primary destinations, each an icon AND a label, pinned to the
 * bottom edge so it survives scrolling. Those three properties are the whole
 * definition — a bar that scrolls away is a footer, one with a single target is
 * a button, and one with nine is a menu. `items` is capped at 5 in code
 * rather than merely documented, because the cap is the thing that keeps the
 * shape honest when a composer is filling it.
 */
export interface BottomBarItem {
  readonly label: string
  readonly href?: string
  readonly icon?: string
  /** `prefix`: also marks the section on every page below href. Default exact. */
  readonly match?: 'exact' | 'prefix'
}

export interface BottomBarProps {
  /** Up to five destinations; the bar draws the first five (the cap is in code, below). */
  readonly items: readonly BottomBarItem[]
  readonly activeHref?: string
  /** `fixed` pins the bar to the viewport bottom; `static` leaves it in flow (an editor canvas). */
  readonly position: 'fixed' | 'static'
  readonly height: number
  /** The nav landmark's name. Unset: "Bottom navigation". */
  readonly ariaLabel?: string
  /**
   * The visitor of a published app, injected by the runner, drawn as the LAST
   * target (avatar + account sheet, or "Sign in"). Read through `readAccount`.
   */
  readonly account?: AccountInfo
}

// ============================================================
// DEFINITION
// ============================================================

export const bottom_barDefinition: BlockDefinition = {
  type: 'bottom-bar',
  name: 'BottomBar',
  category: 'layout',
  icon: '▁',
  defaultProps: { items: [], position: 'fixed', height: 60 },
  defaultLayout: { span: { xs: 4, sm: 8, md: 8, lg: 12 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

/**
 * `ICON_PATHS` is keyed by `string`, so every lookup is `readonly string[] |
 * undefined` — chaining to another key of the same table (`ICON_PATHS.circle`)
 * proved nothing, because that read is equally indefinite. The last resort is
 * a named value: the same geometry the generated `circle` entry carries, so a
 * name that is absent from the table still renders a glyph rather than
 * throwing on `.join`.
 */
const FALLBACK_ICON_PATHS: readonly string[] = ['<circle cx="12" cy="12" r="10"/>']

function BarIcon({ name }: { name: string }): React.ReactElement {
  const paths = ICON_PATHS[name] ?? ICON_PATHS.circle ?? FALLBACK_ICON_PATHS
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: paths.join('') }}
    />
  )
}

const MAX_TARGETS = 5

export const BottomBarBlock: BlockComponent = ({ props, block, context }) => {
  const appWords = useAppMessages()
  // Data-binding safe: with `items` bound to a `{{sourceId}}` expression the
  // prop is a string until the source resolves — same guard tree-view uses.
  const p = props as unknown as BottomBarProps
  const declared = listOf<BottomBarItem>(p.items)
  const account = readAccount(props.account)
  const { items, accountLabel } = placeAccountInBar(declared, account, MAX_TARGETS)
  const activeHref = props.activeHref as string | undefined
  const fixed = p.position !== 'static'
  const height = p.height
  useBottomBarHeightVar(height, fixed)

  const barStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'space-around',
    // The iPhone home indicator sits over the bottom edge: the bar grows by the
    // safe-area inset and keeps its items above it.
    height: fixed ? `calc(${height}px + env(safe-area-inset-bottom, 0px))` : height,
    paddingBottom: fixed ? 'env(safe-area-inset-bottom, 0px)' : undefined,
    boxSizing: 'border-box',
    // On a wide screen the ITEMS keep to the content column: the bar's ground
    // spans the screen, its tabs do not — four tabs spread over 1280px sat
    // far from the content they navigate.
    paddingInline: 'max(0px, calc((100% - var(--pw-layout-container-max-width, 1280px)) / 2))',
    backgroundColor: 'var(--pw-color-card, #ffffff)',
    borderTop: '1px solid var(--pw-color-border, #e4e4e7)',
    // A fixed bar sits above page content but below any modal layer.
    ...(fixed
      ? ({ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 'var(--pw-z-sticky, 150)' } as const)
      : ({ position: 'relative', width: '100%' } as const)),
    ...block.style,
  }

  const itemStyle = (state: 'page' | 'section' | null): React.CSSProperties => ({
    flex: '1 1 0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: 0,
    padding: '6px 4px',
    textDecoration: 'none',
    fontSize: 'var(--pw-font-size-xs, 12px)',
    // The page in view is bold ink; the section a `match: "prefix"` tab marks
    // is ink at a medium weight. Active label is INK (primary pushed to AA), not the fill colour.
    fontWeight: state === 'page' ? 600 : state === 'section' ? 500 : 400,
    color: state !== null ? 'var(--pw-color-primary-ink, var(--pw-color-primary, #18181b))' : 'var(--pw-color-text-muted, #71717a)',
  })

  return (
    // The OUTER element stays in flow and reserves the bar's height. Without it
    // a fixed bar overlays the last band of the page — the page looks finished
    // in a screenshot and hides its own final row in a browser.
    <div
      id={block.id}
      data-block-id={block.id}
      data-block-type="bottom-bar"
      style={fixed ? { height: `calc(${height}px + env(safe-area-inset-bottom, 0px))`, flexShrink: 0 } : undefined}
    >
      <style>{PRESS_CSS}</style>
      <nav style={barStyle} aria-label={safeRenderValue(props.ariaLabel) || messageOf(appWords, 'ui.nav.bottom', '')}>
        {items.map((item, i) => {
          const href = safeHref(item.href)
          const state = routeState(item.href, activeHref, item.match)
          const body = (
            <>
              {item.icon ? <BarIcon name={item.icon} /> : null}
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                }}
              >
                {safeRenderValue(item.label)}
              </span>
            </>
          )
          return href ? (
            <a
              key={`${item.label}-${i}`}
              href={href}
              style={itemStyle(state)}
              aria-current={state === 'page' ? 'page' : undefined}
              data-pw-current={state ?? undefined}
            >
              {body}
            </a>
          ) : (
            <span key={`${item.label}-${i}`} style={itemStyle(state)}>
              {body}
            </span>
          )
        })}
        {account && (
          <AccountControl
            account={account}
            blockId={block.id}
            inert={context?.interactionMode === 'inert'}
            // A phone's bottom edge: the menu rises as a sheet (44px targets,
            // sign-out one tap away) instead of a popover squeezed into a corner.
            presentation="sheet"
            foldedLabel={accountLabel}
            wrapperStyle={{ flex: '1 1 0', minWidth: 0, display: 'flex' }}
            renderTrigger={({ ref, ...trigger }, state) => {
              const active = state.signedIn && sameRoute(state.account.profileHref, activeHref)
              return (
                <button data-pw-press=""
                  ref={ref}
                  {...trigger}
                  aria-current={active ? 'page' : undefined}
                  style={{
                    ...itemStyle(active || state.open ? 'page' : null),
                    flex: '1 1 0',
                    border: 'none',
                    background: 'transparent',
                    fontFamily: 'inherit',
                    fontSize: 'var(--pw-font-size-xs, 12px)',
                    cursor: 'pointer',
                  }}
                >
                  {state.signedIn ? <AccountAvatar account={state.account} size={22} /> : <BarIcon name="log-in" />}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                    {state.signedIn ? accountLabel || firstWord(state.label) : state.label}
                  </span>
                </button>
              )
            }}
          />
        )}
      </nav>
    </div>
  )
}
