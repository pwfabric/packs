import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { safeRenderValue, safeHref, ICON_PATHS, listOf } from '../../../lib/_shared-utils.js'
import {
  AccountAvatar,
  AccountControl,
  placeAccountInBar,
  firstWord,
  readAccount,
  routeState,
  sameRoute,
  useBottomBarHeightVar,
  type AccountInfo,
} from '../../../lib/_shared-account-menu.js'
import { messageOf, useAppMessages } from '@pwfabric/runtime'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

/**
 * The narrow, always-present left rail — the chrome an application wears when
 * navigation is a permanent fixture rather than a page element.
 *
 * It is deliberately NOT `tree-view`. A tree browses a hierarchy and expands;
 * a rail switches between a small fixed set of top-level areas and never grows
 * a second level. Using a tree as a rail is what produced the measured defect
 * this block replaces: a rail declared in the shell, handed a title and no
 * nodes, rendering as an empty column on every page.
 */
export interface AppRailItem {
  readonly label: string
  readonly href?: string
  readonly icon?: string
  /** `prefix`: also marks the section on every page below href. Default exact. */
  readonly match?: 'exact' | 'prefix'
}

export interface AppRailProps {
  readonly items: readonly AppRailItem[]
  /** Pinned to the bottom of the rail — account, settings, help. */
  readonly footerItems: readonly AppRailItem[]
  readonly activeHref?: string
  readonly width: number
  readonly showLabels: boolean
  /** The nav landmark's name. Unset: "Application navigation". */
  readonly ariaLabel?: string
  /**
   * The visitor of a published app, injected by the runner: an avatar button
   * at the rail's bottom, or a "Sign in" target. Read through `readAccount`.
   */
  readonly account?: AccountInfo
}

// ============================================================
// DEFINITION
// ============================================================

export const app_railDefinition: BlockDefinition = {
  type: 'app-rail',
  name: 'AppRail',
  category: 'layout',
  icon: '▏',
  defaultProps: {
    items: [],
    footerItems: [],
    width: 88,
    showLabels: true,
  },
  defaultLayout: { span: { xs: 4, sm: 2, md: 2, lg: 2 } },
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

function RailIcon({ name }: { name: string }): React.ReactElement {
  const paths = ICON_PATHS[name] ?? ICON_PATHS.circle ?? FALLBACK_ICON_PATHS
  return (
    <svg
      width="22"
      height="22"
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

function RailItem({
  item,
  state,
  showLabels,
}: {
  item: AppRailProps['items'][number]
  /** `page`: the page in view (aria-current); `section`: a `match: "prefix"` item above it (a lighter mark). */
  state: 'page' | 'section' | null
  showLabels: boolean
}): React.ReactElement {
  const active = state === 'page'
  const href = safeHref(item.href)
  const style: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: '10px 4px',
    borderRadius: 8,
    textDecoration: 'none',
    fontSize: 'var(--pw-font-size-xs, 12px)',
    lineHeight: 1.2,
    textAlign: 'center',
    // Text on the card is ink, never the brand fill: --pw-color-primary as text
    // can fall to about 2:1 on a mid-lightness brand. The active background is a tint
    // of the brand, so it differs from the card it sits on.
    color: state !== null ? 'var(--pw-color-primary-ink, #18181b)' : 'var(--pw-color-text-muted, #71717a)',
    backgroundColor: active
      ? 'color-mix(in srgb, var(--pw-color-primary, #18181b) 12%, var(--pw-color-card, #ffffff))'
      : state === 'section'
        ? 'color-mix(in srgb, var(--pw-color-primary, #18181b) 6%, var(--pw-color-card, #ffffff))'
        : 'transparent',
    fontWeight: active ? 600 : state === 'section' ? 500 : 400,
  }
  const body = (
    <>
      {item.icon ? <RailIcon name={item.icon} /> : null}
      {showLabels ? (
        // The label WRAPS, never clips: at the old 76px default "Dashboard"
        // was cut to "Dashboa". 88px fits a common one-word label at 12px; a
        // longer one breaks onto a second line rather than losing letters.
        <span style={{ maxWidth: '100%', overflowWrap: 'anywhere', hyphens: 'auto' }}>
          {safeRenderValue(item.label)}
        </span>
      ) : null}
    </>
  )
  return href ? (
    <a
      href={href}
      style={style}
      aria-current={active ? 'page' : undefined}
      data-pw-current={state ?? undefined}
      // With labels hidden the icon is the only affordance, so the accessible
      // name has to come from somewhere — the label still exists, it just moves
      // from the DOM to the attribute.
      aria-label={showLabels ? undefined : safeRenderValue(item.label)}
      title={showLabels ? undefined : safeRenderValue(item.label)}
    >
      {body}
    </a>
  ) : (
    <span style={style}>
      {body}
      {/* No href and no visible label: the icon alone names nothing.
          The label stays in the DOM for assistive technology only. */}
      {showLabels ? null : <span style={VISUALLY_HIDDEN}>{safeRenderValue(item.label)}</span>}
    </span>
  )
}

const VISUALLY_HIDDEN: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

/**
 * Two shapes, one block. On the `xs` viewport the rail does not thin — it
 * TURNS INTO a bottom bar: the first five destinations (rail items first, then
 * footer items) become icon + label targets pinned to the viewport bottom, the
 * rest are hidden. Measured across the mobile gallery: every
 * composite/rail shell kept a 76px rail on a 390px screen while its knowledge
 * promised a bottom bar. The shell patterns stay unchanged; the block keeps
 * the promise itself.
 */
const XS_MAX_TARGETS = 5
const BAR_HEIGHT = 60

function AppRailAsBottomBar({
  items,
  activeHref,
  ariaLabel,
  account,
  inert,
  block,
}: {
  items: AppRailProps['items']
  activeHref: string | undefined
  ariaLabel: string
  account: AccountInfo | undefined
  inert: boolean
  block: { id: string; style?: React.CSSProperties }
}): React.ReactElement {
  const { items: shown, accountLabel } = placeAccountInBar(items, account, XS_MAX_TARGETS)
  useBottomBarHeightVar(BAR_HEIGHT, true)
  const barStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'space-around',
    height: BAR_HEIGHT,
    boxSizing: 'border-box',
    backgroundColor: 'var(--pw-color-card, #ffffff)',
    borderTop: '1px solid var(--pw-color-border, #e4e4e7)',
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 'var(--pw-z-sticky, 150)' as unknown as number,
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
    // The page in view is bold ink; the section a `match: "prefix"` item
    // marks is ink at a medium weight.
    fontWeight: state === 'page' ? 600 : state === 'section' ? 500 : 400,
    color: state !== null ? 'var(--pw-color-primary-ink, #18181b)' : 'var(--pw-color-text-muted, #71717a)',
  })
  return (
    // The outer element takes no room. A rail sits FIRST in its shell's body
    // row, and on a phone that row stacks — an in-flow spacer of the bar's
    // height landed above the page, and the fixed bar covered its last band.
    // The bar publishes `--pw-bottom-bar-height` instead and the shell pads
    // the page bottom by it.
    <div
      id={block.id}
      data-block-id={block.id}
      data-block-type="app-rail"
      data-pw-shape="bottom-bar"
      style={{ height: 0, flexShrink: 0, width: '100%', ...block.style, flex: undefined }}
    >
      <nav style={barStyle} aria-label={ariaLabel}>
        {shown.map((item, i) => {
          const href = safeHref(item.href)
          const state = routeState(item.href, activeHref, item.match)
          const body = (
            <>
              {item.icon ? <RailIcon name={item.icon} /> : null}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                {safeRenderValue(item.label)}
              </span>
            </>
          )
          return href ? (
            <a key={`${item.label}-${i}`} href={href} style={itemStyle(state)} aria-current={state === 'page' ? 'page' : undefined} data-pw-current={state ?? undefined}>
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
            inert={inert}
            presentation="sheet"
            foldedLabel={accountLabel}
            wrapperStyle={{ flex: '1 1 0', minWidth: 0, display: 'flex' }}
            renderTrigger={({ ref, ...trigger }, state) => {
              const active = state.signedIn && sameRoute(state.account.profileHref, activeHref)
              return (
                <button
                  ref={ref}
                  {...trigger}
                  aria-current={active ? 'page' : undefined}
                  style={{
                    ...itemStyle(active || state.open ? 'page' : null),
                    border: 'none',
                    background: 'transparent',
                    fontFamily: 'inherit',
                    fontSize: 'var(--pw-font-size-xs, 12px)',
                    cursor: 'pointer',
                  }}
                >
                  {state.signedIn ? <AccountAvatar account={state.account} size={22} /> : <RailIcon name="log-in" />}
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

export const AppRailBlock: BlockComponent = ({ props, block, context }) => {
  const appWords = useAppMessages()
  const p = props as unknown as AppRailProps
  const items = listOf<AppRailItem>(p.items)
  const footerItems = listOf<AppRailItem>(p.footerItems)
  const activeHref = p.activeHref
  const width = p.width
  const showLabels = p.showLabels
  const ariaLabel = safeRenderValue(props.ariaLabel) || messageOf(appWords, 'ui.nav.rail', '')
  const account = readAccount(props.account)
  const inert = context?.interactionMode === 'inert'

  if (context?.viewport === 'xs') {
    return (
      <AppRailAsBottomBar
        items={[...items, ...footerItems]}
        activeHref={activeHref}
        ariaLabel={ariaLabel}
        account={account}
        inert={inert}
        block={block}
      />
    )
  }

  const outerStyle: React.CSSProperties = {
    flex: `0 0 ${width}px`,
    width,
    alignSelf: 'stretch',
    // FULL HEIGHT. The renderer wraps the block in its own (block) wrapper,
    // which the shell row stretches — but alignSelf on the rail itself then
    // stretches nothing, so the panel and its border stopped mid-page under
    // the last item. 100% of the stretched wrapper is the row's height.
    height: '100%',
    minHeight: '100%',
    boxSizing: 'border-box',
    borderRight: '1px solid var(--pw-color-border, #e4e4e7)',
    backgroundColor: 'var(--pw-color-card, #ffffff)',
    ...block.style,
  }

  return (
    <div id={block.id} data-block-id={block.id} data-block-type="app-rail" style={outerStyle}>
      <nav
        aria-label={ariaLabel}
        style={{
          // Sticky, not fixed: the rail belongs to its row, so it must scroll
          // out of the way when a page footer finally arrives — fixed would
          // float it over content that is no longer beside it.
          position: 'sticky',
          top: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          padding: '10px 6px',
          maxHeight: '100vh',
          overflowY: 'auto',
        }}
      >
        {items.map((item, i) => (
          <RailItem
            key={`${item.label}-${i}`}
            item={item}
            state={routeState(item.href, activeHref, item.match)}
            showLabels={showLabels}
          />
        ))}
        {(footerItems.length > 0 || account) && (
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {footerItems.map((item, i) => (
              <RailItem
                key={`f-${item.label}-${i}`}
                item={item}
                state={routeState(item.href, activeHref, item.match)}
                showLabels={showLabels}
              />
            ))}
            {account && (
              <AccountControl
                account={account}
                blockId={block.id}
                inert={inert}
                presentation="popover"
                // Opens beside the rail, bottom-aligned with the trigger, so it
                // never runs off the bottom of the screen.
                placement="right-end"
                wrapperStyle={{ display: 'flex', justifyContent: 'center' }}
                renderTrigger={({ ref, ...trigger }, state) => (
                  <button
                    ref={ref}
                    {...trigger}
                    title={state.label}
                    aria-current={
                      state.signedIn && sameRoute(state.account.profileHref, activeHref) ? 'page' : undefined
                    }
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      width: '100%',
                      padding: '8px 4px',
                      border: 'none',
                      borderRadius: 8,
                      background: state.open ? 'var(--pw-color-card, #fafafa)' : 'transparent',
                      color: 'var(--pw-color-text-muted, #71717a)',
                      fontFamily: 'inherit',
                      fontSize: 'var(--pw-font-size-xs, 12px)',
                      lineHeight: 1.2,
                      cursor: 'pointer',
                    }}
                  >
                    {state.signedIn ? <AccountAvatar account={state.account} size={32} /> : <RailIcon name="log-in" />}
                    {showLabels && !state.signedIn ? (
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                        {state.label}
                      </span>
                    ) : null}
                  </button>
                )}
              />
            )}
          </div>
        )}
      </nav>
    </div>
  )
}
