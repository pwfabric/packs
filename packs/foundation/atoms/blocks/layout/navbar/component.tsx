import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { HIT_AREA_CSS, ICON_PATHS, langOf, safeHref, listOf, textOf } from '../../../lib/_shared-utils.js'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'
import { createSkipLink, useAppMessage } from '@pwfabric/runtime'
import {
  AccountAvatar,
  AccountControl,
  accountSignInButtonStyle,
  readAccount,
  routeState,
  type AccountInfo,
} from '../../../lib/_shared-account-menu.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

/** On a phone or touch screen the brand link is a REAL 44px-tall box (it was 24–33px). */
const NAV_BRAND_TOUCH_CSS = '@media (max-width: 640px), (pointer: coarse) { [data-pw-nav-brand] { min-height: 44px; } }' +
  // THE ANCHOR OFFSET IN THE FIRST FRAME. The engine hoists position: sticky to the block's
  // wrapper and names it there (data-pw-position, receipt §2), so the bar's offset is in the
  // first frame: a page opened at #section lands below it, not under it. 64px until the bar's
  // own height is published (the effect below).
  ':root:has([data-pw-position] > [data-pw-navbar]) { scroll-padding-top: var(--pw-sticky-top-offset, 64px); }' +
  '[data-pw-skip-link] { position: absolute; left: -9999px; top: 8px; z-index: 1; padding: 8px 12px; border-radius: var(--pw-border-radius-sm, 6px); background: var(--pw-color-background); color: var(--pw-color-text); border: 1px solid var(--pw-color-border); font-size: var(--pw-font-size-sm); }' +
  '[data-pw-skip-link]:focus { left: 8px; outline: var(--pw-focus-ring-width, 2px) solid var(--pw-focus-ring-color, var(--pw-color-primary, #18181b)); outline-offset: 2px; }'

/**
 * ONE PAINTED FRAME IS RIGHT AT EVERY WIDTH.
 *
 * The bar draws both of its forms — the wide row (links, utility cluster) and
 * the narrow one (menu button, drawer) — and CSS shows the one that fits. It
 * used to branch on `context.viewport`, which a static first frame cannot know:
 * the page painted the phone bar on a desktop (or the reverse) until scripts
 * ran. The breakpoints are the engine's: below `md` (768px) the bar is narrow;
 * from `lg` (1024px) the account trigger shows the visitor's name. A form that
 * is not shown is `display: none`, so it is out of the accessibility tree too.
 */
const NAV_FORM_CSS =
  '@media (max-width: 767.98px) { [data-pw-navbar] { flex-wrap: wrap; } [data-pw-nav-wide] { display: none !important; } }' +
  '@media (min-width: 768px) { [data-pw-nav-narrow] { display: none !important; } }' +
  '@media (max-width: 1023.98px) { [data-pw-nav-account-name] { display: none !important; } }' +
  '@media (min-width: 1024px) { [data-pw-nav-account-named] { padding: 2px 10px 2px 2px !important; } }'

export interface NavbarProps {
  readonly logoText: string
  readonly logoSrc?: string
  /**
   * Where the brand goes. Optional, and its absence is the point: left empty
   * the brand is plain text; given a route it becomes a real link home.
   */
  readonly logoHref?: string
  /** Top-level links; `items` is a flat dropdown, `megaColumns` (+ `feature`) a multi-column panel that wins over it. */
  readonly links: readonly NavLink[]
  /** href of the page being viewed — its link carries aria-current="page" (same route matcher as app-rail). */
  readonly activeHref?: string
  /**
   * The language of the bar's words (BCP 47, e.g. `en`), written as the
   * element's `lang`. Set it when the bar's language differs from the page's,
   * so case rules follow it: an English word on a Turkish page uppercases
   * with a dotted I otherwise.
   */
  readonly lang?: string
  readonly alignment: 'left' | 'center' | 'right'
  readonly showCTA: boolean
  readonly ctaLabel: string
  readonly ctaHref?: string
  /** Secondary (ghost) CTA before the primary one; renders only when its label is set. */
  readonly secondaryCtaLabel?: string
  readonly secondaryCtaHref?: string
  readonly backgroundColor?: string
  readonly avatarName?: string
  readonly avatarSrc?: string
  readonly showSearch: boolean
  /** Unset: "Search…" (a word of the block's own, kept out of the manifest). */
  readonly searchPlaceholder?: string
  /** State key the submitted search query is written to (`{{state.<key>}}` in a source filter). */
  readonly searchStateKey?: string
  readonly socialLinks: readonly NavSocialLink[]
  readonly secondaryLogoText?: string
  /** A short word beside the logo text, quieter than it, inside the same link ("PWFabric engine"). */
  readonly logoTagline?: string
  /** The id of the page's main content: a "Skip to content" link, the first keyboard stop, shown only when focused. */
  readonly skipTo?: string
  /** The skip link's word. Unset: the app's ui.skipToContent. */
  readonly skipLinkLabel?: string
  /** Destinations listed only in the phone drawer, before links: a docs site's page tree, which the wide bar leaves to its sidebar. */
  readonly drawerLinks?: readonly NavLink[]
  /** Keep the bar's contents within this width, centred, while its background and line stay full width (the page's own width, e.g. 1440). */
  readonly contentMaxWidth?: number | string
  /** Small, muted, non-interactive status nodes at the front of the right cluster ("24°C İstanbul"). */
  readonly rightInfo: readonly NavInfoSlot[]
  /**
   * The visitor of a published app, injected by the runner: an account menu
   * or a "Sign in" button. Wins over `avatarName`/`avatarSrc`. Read through `readAccount`.
   */
  readonly account?: AccountInfo
}

export type NavLink = NavLinkData
export type NavSocialLink = NavSocialLinkData
export type NavInfoSlot = NavInfoSlotData

// ============================================================
// DEFINITION
// ============================================================

export const navbarDefinition: BlockDefinition = {
  type: 'navbar',
  name: 'Navbar',
  category: 'layout',
  icon: '☰',
  defaultProps: {
    logoText: '',
    links: [],
    alignment: 'right',
    showCTA: false,
    ctaLabel: '',
    ctaHref: '#',
    showSearch: false,
    searchPlaceholder: 'Search…',
    socialLinks: [],
    rightInfo: [],
  },
  defaultLayout: { span: { xs: 4, sm: 8, md: 8, lg: 12 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

interface NavSubLinkData {
  label: string
  href: string
  /** `prefix`: also current on every page below href (a section). Default exact. */
  match?: 'exact' | 'prefix'
}

interface NavMegaItemData {
  label: string
  href?: string
  icon?: string
  description?: string
}

interface NavMegaColumnData {
  heading?: string
  items?: NavMegaItemData[]
}

interface NavFeatureTileData {
  title: string
  description?: string
  href?: string
  icon?: string
}

interface NavLinkData {
  label: string
  href: string
  /** `prefix`: also current on every page below href (a section). Default exact. */
  match?: 'exact' | 'prefix'
  items?: NavSubLinkData[]
  megaColumns?: NavMegaColumnData[]
  feature?: NavFeatureTileData
}

interface NavSocialLinkData {
  icon: string
  href?: string
  /** The link's name for a screen reader and its tooltip ("GitHub"). Unset: the icon's name. */
  label?: string
}

interface NavInfoSlotData {
  label?: string
  value: string
  icon?: string
}

/** What a nav link takes from the bar: its current state and style, and the bar's handlers. */
interface NavLinkKit {
  readonly state: 'page' | 'section' | null
  readonly style: React.CSSProperties
  readonly onNavClick: (href: string) => (e: React.MouseEvent<HTMLAnchorElement>) => void
  /** A menu header's click: in the editor it is reported as a navigation. */
  readonly reportClick: (href: string) => void
  readonly caret: React.ReactElement
  readonly renderInlineIcon: (name: string, dim: number) => React.ReactElement
}

/**
 * A top-level nav link. When it carries `items`, it renders a ▾ caret and a
 * dropdown panel (white card, shadow, theme tokens) that opens on hover and on
 * focus-within (keyboard) — and toggles on click as a fallback. Submenu links
 * navigate natively in live mode; in inert (editor/preview) mode the same
 * `handleNavClick` suppresses navigation and emits a `navigate` event, exactly
 * like the flat links. The menu still OPENS on hover in inert so a preview can
 * show it. Flat links (no items) render a plain anchor with NO caret.
 *
 * Defined at module scope, never inside the bar's render: a component made in
 * render is a new type each render, so React drew every link afresh (and
 * hydration repainted the links the first frame had drawn). What it needs
 * from the bar arrives as `kit`.
 */
const NavLinkItem: React.FC<{ link: NavLinkData; kit: NavLinkKit }> = ({ link, kit }) => {
  const items = Array.isArray(link.items) ? link.items : []
  const megaColumns = Array.isArray(link.megaColumns) ? link.megaColumns : []
  const feature = link.feature
  // A mega-panel takes precedence over a flat list when columns (or a lone
  // feature tile) are present.
  const hasMega = megaColumns.length > 0 || Boolean(feature)
  const hasItems = items.length > 0
  const hasDropdown = hasMega || hasItems
  const [open, setOpen] = React.useState(false)

  // Hover-gap fix: the panel sits 8px below the trigger (marginTop), so the
  // cursor crosses a transparent gap on its way from the trigger down to a
  // submenu item — during that transit it's over neither element and the
  // container's mouseleave fires, closing the menu before it can be clicked.
  // A short close-delay bridges the gap: mouseleave SCHEDULES a close, and
  // re-entering (the panel is a DOM descendant, so entering it re-fires the
  // container's mouseenter) CANCELS it. Only a real exit lets it close.
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const openMenu = (): void => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    setOpen(true)
  }
  const scheduleClose = (): void => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpen(false), 180)
  }
  React.useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
    },
    []
  )

  if (!hasDropdown) {
    return (
      <a
        href={safeHref(link.href)}
        onClick={kit.onNavClick(link.href)}
        style={kit.style}
        aria-current={kit.state === 'page' ? 'page' : undefined}
        data-pw-current={kit.state ?? undefined}
        data-pw-hit=""
      >
        {link.label}
      </a>
    )
  }

  // ── Mega-panel branch ────────────────────────────────────────────────
  // A wide, multi-column card: each column is an optional heading over rich
  // icon+label+description rows, with an optional trailing feature tile. Same
  // open/close + ARIA + inert-safe posture as the flat dropdown below.
  if (hasMega) {
    const megaRowStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px',
      padding: '8px 10px',
      borderRadius: 'var(--pw-border-radius-lg)',
      color: 'var(--pw-color-text)',
      textDecoration: 'none',
    }
    return (
      <div
        style={{ position: 'relative', display: 'inline-flex' }}
        onMouseEnter={openMenu}
        onMouseLeave={scheduleClose}
      >
        <a
          href={safeHref(link.href)}
          onClick={(e) => {
            e.preventDefault()
            kit.reportClick(link.href)
            setOpen((o) => !o)
          }}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-current={kit.state === 'page' ? 'page' : undefined}
          data-pw-current={kit.state ?? undefined}
          data-pw-hit=""
          style={{ ...kit.style, display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
        >
          {link.label}
          {kit.caret}
        </a>
        <div
          role="menu"
          style={{
            // The panel paints CARD inside the nav scope, where
            // --pw-color-text was re-pointed to text-on-primary (a light ink
            // on primary-painted navbars). Re-point back to the on-card
            // chain with a HARD fallback — the card-style self-referencing
            // fallback would cycle here and inherit the nav's light ink →
            // white-on-white submenu (a measured hover bug).
            ['--pw-color-text' as string]: 'var(--pw-color-text-on-card, #09090b)',
            ['--pw-color-text-muted' as string]: 'var(--pw-color-text-muted-on-card, #71717a)',
            position: 'absolute',
            top: '100%',
            // Anchor under the trigger's left edge (same convention as the flat
            // dropdown). Mega-panels are wide, so place them on links toward the
            // start of the bar to avoid running off the right edge.
            left: 0,
            marginTop: '8px',
            display: 'flex',
            flexWrap: 'wrap',
            // Never wider than the viewport: 200px columns + a 220px feature
            // tile ran off the right edge on a laptop.
            maxWidth: 'min(720px, calc(100vw - 32px))',
            gap: '24px',
            padding: '20px',
            backgroundColor: 'var(--pw-color-card)',
            border: '1px solid var(--pw-color-border)',
            borderRadius: 'var(--pw-border-radius-xl)',
            boxShadow: 'var(--pw-shadow-lg)',
            zIndex: 'var(--pw-z-dropdown)',
            opacity: open ? 1 : 0,
            visibility: open ? 'visible' : 'hidden',
            pointerEvents: open ? 'auto' : 'none',
            transition: 'opacity .12s ease',
          }}
        >
          {megaColumns.map((col, ci) => (
            <div
              key={ci}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                minWidth: '200px',
              }}
            >
              {col.heading && (
                <div
                  style={{
                    fontSize: 'var(--pw-font-size-xs)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--pw-color-text-muted)',
                    padding: '4px 10px 8px',
                  }}
                >
                  {col.heading}
                </div>
              )}
              {(Array.isArray(col.items) ? col.items : []).map((mi, mj) => {
                const href = safeHref(mi.href) ?? '#'
                return (
                  <a
                    key={mj}
                    href={href}
                    role="menuitem"
                    onClick={kit.onNavClick(href)}
                    style={megaRowStyle}
                  >
                    {mi.icon && (
                      <span
                        style={{
                          display: 'inline-flex',
                          color: 'var(--pw-color-primary-ink, #18181b)',
                          marginTop: '2px',
                          flex: '0 0 auto',
                        }}
                      >
                        {kit.renderInlineIcon(mi.icon, 18)}
                      </span>
                    )}
                    <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span
                        style={{
                          fontSize: 'var(--pw-font-size-sm)',
                          fontWeight: 600,
                          color: 'var(--pw-color-text)',
                        }}
                      >
                        {mi.label}
                      </span>
                      {mi.description && (
                        <span
                          style={{
                            fontSize: 'var(--pw-font-size-xs)',
                            color: 'var(--pw-color-text-muted)',
                            lineHeight: 1.35,
                          }}
                        >
                          {mi.description}
                        </span>
                      )}
                    </span>
                  </a>
                )
              })}
            </div>
          ))}
          {feature && (
            <a
              href={safeHref(feature.href) ?? '#'}
              role="menuitem"
              onClick={kit.onNavClick(feature.href ?? '#')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                width: '220px',
                padding: '16px',
                borderRadius: 'var(--pw-border-radius-xl)',
                textDecoration: 'none',
                // A fixed black alpha is INVISIBLE on a dark bar — this file's own
                // note (below) says the same about the removed shadow.
                // Derived from the text colour, it works in both themes.
                backgroundColor: 'color-mix(in srgb, var(--pw-color-text, #09090b) 6%, transparent)',
                alignSelf: 'stretch',
              }}
            >
              {feature.icon && (
                <span style={{ display: 'inline-flex', color: 'var(--pw-color-primary-ink, #18181b)' }}>
                  {kit.renderInlineIcon(feature.icon, 24)}
                </span>
              )}
              <span
                style={{
                  fontSize: 'var(--pw-font-size-sm)',
                  fontWeight: 700,
                  color: 'var(--pw-color-text)',
                }}
              >
                {feature.title}
              </span>
              {feature.description && (
                <span
                  style={{
                    fontSize: 'var(--pw-font-size-xs)',
                    color: 'var(--pw-color-text-muted)',
                    lineHeight: 1.4,
                  }}
                >
                  {feature.description}
                </span>
              )}
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={openMenu}
      onMouseLeave={scheduleClose}
    >
      <a
        href={safeHref(link.href)}
        onClick={(e) => {
          // The parent anchor toggles the menu rather than navigating: a link
          // with children is a menu header, not a destination.
          e.preventDefault()
          kit.reportClick(link.href)
          setOpen((o) => !o)
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-current={kit.state === 'page' ? 'page' : undefined}
        data-pw-current={kit.state ?? undefined}
        data-pw-hit=""
        style={{
          ...kit.style,
          display: 'inline-flex',
          alignItems: 'center',
          cursor: 'pointer',
        }}
      >
        {link.label}
        {kit.caret}
      </a>
      <div
        role="menu"
        // Kept in the DOM so a preview can assert the submenu exists even when
        // not hovered; visibility is driven by open-state.
        style={{
          // Card-painting panel inside the nav's re-pointed text scope —
          // hard-fallback on-card chain (see mega panel note above).
          ['--pw-color-text' as string]: 'var(--pw-color-text-on-card, #09090b)',
          ['--pw-color-text-muted' as string]: 'var(--pw-color-text-muted-on-card, #71717a)',
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: '8px',
          minWidth: '180px',
          display: 'flex',
          flexDirection: 'column',
          padding: '6px',
          backgroundColor: 'var(--pw-color-card)',
          border: '1px solid var(--pw-color-border)',
          borderRadius: 'var(--pw-border-radius-lg)',
          boxShadow: 'var(--pw-shadow-lg)',
          zIndex: 'var(--pw-z-dropdown)',
          opacity: open ? 1 : 0,
          visibility: open ? 'visible' : 'hidden',
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity .12s ease',
        }}
      >
        {items.map((sub, j) => (
          <a
            key={j}
            href={safeHref(sub.href)}
            role="menuitem"
            onClick={kit.onNavClick(sub.href)}
            style={{
              display: 'block',
              padding: '8px 12px',
              borderRadius: 'var(--pw-border-radius)',
              color: 'var(--pw-color-text)',
              textDecoration: 'none',
              fontSize: 'var(--pw-font-size-sm)',
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
          >
            {sub.label}
          </a>
        ))}
      </div>
    </div>
  )
}

/**
 * The ghost CTA: a transparent text button with a subtle hover tint. Driven by
 * hover state because inline styles can't express `:hover`. In inert
 * (editor/preview) mode `handleNavClick` suppresses real navigation and emits a
 * `navigate` event — same posture as the primary CTA and the links. Module
 * scope, like NavLinkItem: a component made in render is redrawn every render.
 */
const GhostCta: React.FC<{
  href: string
  label: string | undefined
  baseStyle: React.CSSProperties
  onNavClick: (href: string) => (e: React.MouseEvent<HTMLAnchorElement>) => void
  extra?: React.CSSProperties
}> = ({ href, label, baseStyle, onNavClick, extra }) => {
  const [hover, setHover] = React.useState(false)
  return (
    <a
      href={safeHref(href)}
      onClick={onNavClick(href)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...baseStyle,
        // currentColor-based tint: visible on light AND primary-dark navbars
        // (the old rgba(0,0,0,.05) vanished on a dark bar).
        backgroundColor: hover ? 'color-mix(in srgb, currentColor 12%, transparent)' : 'transparent',
        ...extra,
      }}
    >
      {label}
    </a>
  )
}

export const NavbarBlock: BlockComponent = ({ props, block, context, children }) => {
  // The bar's own words are the app's (ui.menu.*, ui.nav.main, ui.avatar.user).
  const openMenuWord = useAppMessage('ui.menu.open', '')
  const closeMenuWord = useAppMessage('ui.menu.close', '')
  const mainNavWord = useAppMessage('ui.nav.main', '')
  const userWord = useAppMessage('ui.avatar.user', '')
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()
  // Unset means no text: "Brand" and "Get Started" reached visitors.
  const p = props as unknown as NavbarProps
  const logoText = textOf(p.logoText)
  const logoSrc = props.logoSrc as string | undefined
  /**
   * `#` IS NOT A DESTINATION.
   *
   * `safeHref` deliberately passes anchors through — `#section` is a real
   * same-document link and rejecting it would be wrong. A BARE `#` is the
   * placeholder, so it is filtered here rather than there.
   *
   * Measured: a published app's publish report listed 8 dead links
   * for its home page and this brand link was not among them. It never could
   * be — `resolveInternalHrefs` walks receipt props (`HREF_PROPS`), and this
   * href was hardcoded in the component, so no gate could see it. The user saw
   * it; the system did not.
   */
  const rawLogoHref = safeHref(props.logoHref as string | undefined)
  const logoHref = rawLogoHref && rawLogoHref !== '#' ? rawLogoHref : undefined
  const links = listOf<NavLinkData>(p.links)
  const drawerLinks = listOf<NavLinkData>(p.drawerLinks)
  const activeHref = typeof props.activeHref === 'string' ? props.activeHref : undefined
  /** A link is active when it, or one of its dropdown entries, routes to activeHref. */
  //
  // A link marks the page in view (`page`: aria-current="page", the full
  // mark) or, with `match: "prefix"`, the section the page is in (`section`:
  // a lighter mark and no aria-current — the visitor is below it, not on it).
  const stateOf = (item: { href?: string; match?: unknown }): 'page' | 'section' | null =>
    routeState(item.href, activeHref, item.match)
  const linkState = (link: NavLinkData): 'page' | 'section' | null => {
    const own = stateOf(link)
    const subs = Array.isArray(link.items) ? link.items.map(stateOf) : []
    if (own === 'page' || subs.includes('page')) return 'page'
    return own === 'section' || subs.includes('section') ? 'section' : null
  }
  const linkStyleOf = (state: 'page' | 'section' | null): React.CSSProperties =>
    state === 'page' ? activeLinkTextStyle : state === 'section' ? sectionLinkTextStyle : linkTextStyle
  const lang = langOf(props.lang)
  const alignment = p.alignment
  const ctaLabel = textOf(p.ctaLabel).trim()
  // showCTA with no label draws nothing — never a button reading "Get Started".
  const showCTA = p.showCTA && ctaLabel !== ''
  const ctaHref = (props.ctaHref as string | undefined) ?? ''
  const secondaryCtaLabel = textOf(p.secondaryCtaLabel) || undefined
  const secondaryCtaHref = (props.secondaryCtaHref as string | undefined) ?? ''
  const hasSecondaryCta = Boolean(secondaryCtaLabel)
  const backgroundColor = (props.backgroundColor as string) ?? 'var(--pw-color-card)'
  const avatarName = textOf(p.avatarName) || undefined
  const avatarSrc = props.avatarSrc as string | undefined
  const account: AccountInfo | undefined = readAccount(props.account)
  // The account control supersedes the decorative avatar — never both.
  const hasAvatar = !account && Boolean(avatarName || avatarSrc)

  const showSearch = p.showSearch
  const searchPlaceholder = p.searchPlaceholder ?? 'Search…'
  const socialLinks = listOf<NavSocialLinkData>(p.socialLinks)
  const secondaryLogoText = textOf(p.secondaryLogoText) || undefined
  const logoTagline = textOf(p.logoTagline) || undefined
  const skipTo = typeof p.skipTo === 'string' && /^[A-Za-z][A-Za-z0-9_-]*$/.test(p.skipTo) ? p.skipTo : undefined
  const skipWord = useAppMessage('ui.skipToContent', '')
  const skipLabel = textOf(p.skipLinkLabel) || skipWord
  const rightInfo = listOf<NavInfoSlotData>(p.rightInfo)
  const hasUtility =
    showCTA ||
    hasSecondaryCta ||
    hasAvatar ||
    Boolean(account) ||
    showSearch ||
    socialLinks.length > 0 ||
    Boolean(secondaryLogoText) ||
    rightInfo.length > 0

  const avatarInitials = (avatarName ?? '')
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const renderAvatar = (dim: number): React.ReactElement => (
    <span
      aria-label={avatarName ?? userWord}
      title={avatarName ?? undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${dim}px`,
        height: `${dim}px`,
        borderRadius: '50%',
        flex: '0 0 auto',
        overflow: 'hidden',
        backgroundColor: 'var(--pw-color-primary)',
        color: 'var(--pw-color-text-on-primary)',
        fontSize: `${Math.round(dim * 0.4)}px`,
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      {avatarSrc ? (
        <img
          src={avatarSrc}
          alt={avatarName ?? ''}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        avatarInitials || '?'
      )}
    </span>
  )

  const isInert = context?.interactionMode === 'inert'

  const renderSecondaryLogo = (): React.ReactElement => (
    <span
      style={{
        fontWeight: 700,
        fontSize: 'var(--pw-font-size-base)',
        color: 'var(--pw-color-text)',
        whiteSpace: 'nowrap',
        flex: '0 0 auto',
      }}
    >
      {secondaryLogoText}
    </span>
  )

  // The search box answers Enter: it emits a `search` click event
  // carrying the query, and writes `searchStateKey` when one is given, so a data
  // source filtering on `{{state.<key>}}` re-queries. It was wired to nothing.
  const submitSearch = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    if (isInert) return
    const field = e.currentTarget.elements.namedItem('q') as HTMLInputElement | null
    const query = field?.value ?? ''
    const stateKey = typeof props.searchStateKey === 'string' && props.searchStateKey ? props.searchStateKey : undefined
    emit({
      type: SURFACE_EVENTS.BLOCK_CLICK,
      surfaceId,
      blockId: block.id,
      payload: { action: 'search', value: query },
    })
    if (stateKey) {
      emit({
        type: SURFACE_EVENTS.INPUT_CHANGE,
        surfaceId,
        blockId: block.id,
        payload: { value: query, inputId: `${block.id}-search`, name: 'q', action: { type: 'setState', key: stateKey, value: query } },
      })
    }
  }

  /** The search box; `idSuffix` keeps the drawer's copy's id apart from the bar's. */
  const renderSearch = (idSuffix: string): React.ReactElement => (
    <form
      role="search"
      onSubmit={submitSearch}
      style={{
        margin: 0,
        // The box paints its own CARD surface inside the nav's re-pointed
        // text scope — re-point back to the on-card chain with hard
        // fallbacks (same trap as the dropdown panels: on a primary-painted
        // navbar the inherited ink is light, invisible on a light box).
        // CARD (not background): the page-bg token pairs with the PLAIN text
        // token, which is unreachable here; card always has a paired ink.
        ['--pw-color-text' as string]: 'var(--pw-color-text-on-card, #09090b)',
        ['--pw-color-text-muted' as string]: 'var(--pw-color-text-muted-on-card, #71717a)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 10px',
        borderRadius: 'var(--pw-navbar-search-radius, var(--pw-border-radius))',
        border: '1px solid var(--pw-color-border)',
        backgroundColor: 'var(--pw-color-card)',
        flex: '0 0 auto',
      }}
    >
      <svg
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: 'var(--pw-color-text-muted)', flex: '0 0 auto' }}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: (ICON_PATHS.search ?? []).join('') }}
      />
      <input
        type="search"
        name="q"
        id={`${block.id}-search${idSuffix}`}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
        // In inert (editor/preview) mode the search box is non-interactive so a
        // preview render cannot capture focus or submit — same posture as the
        // avatar/links suppressing real side-effects.
        readOnly={isInert}
        tabIndex={isInert ? -1 : undefined}
        style={{
          border: 'none',
          background: 'transparent',
          color: 'var(--pw-color-text)',
          fontSize: 'var(--pw-font-size-sm)',
          width: '120px',
          padding: 0,
        }}
      />
    </form>
  )

  const renderSocial = (item: NavSocialLinkData, i: number): React.ReactElement => {
    const paths = ICON_PATHS[item.icon] ?? ICON_PATHS.circle ?? []
    const icon = (
      <svg
        width={18}
        height={18}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: paths.join('') }}
      />
    )
    const iconStyle: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '32px',
      height: '32px',
      borderRadius: 'var(--pw-border-radius)',
      color: 'var(--pw-color-text-muted)',
      flex: '0 0 auto',
      textDecoration: 'none',
    }
    const href = safeHref(item.href) ?? '#'
    return (
      <a
        key={i}
        href={href}
        onClick={handleNavClick(href)}
        aria-label={item.label || item.icon}
        title={item.label || item.icon}
        style={iconStyle}
      >
        {icon}
      </a>
    )
  }

  // A tiny inline icon used by info-slots and mega-menu rows. Falls back to the
  // `circle` glyph for unknown names, exactly like renderSocial.
  const renderInlineIcon = (name: string, dim: number): React.ReactElement => {
    const paths = ICON_PATHS[name] ?? ICON_PATHS.circle ?? []
    return (
      <svg
        width={dim}
        height={dim}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ flex: '0 0 auto' }}
        dangerouslySetInnerHTML={{ __html: paths.join('') }}
      />
    )
  }

  // Free info-slot node: muted, non-interactive status text (optional icon +
  // optional label + value). Plain — no border, no hover, no link.
  const renderInfoSlot = (item: NavInfoSlotData, i: number): React.ReactElement => (
    <span
      key={i}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        flex: '0 0 auto',
        fontSize: 'var(--pw-font-size-sm)',
        color: 'var(--pw-color-text-muted)',
        whiteSpace: 'nowrap',
        lineHeight: 1,
      }}
    >
      {item.icon && renderInlineIcon(item.icon, 14)}
      {item.label && <span style={{ fontWeight: 500 }}>{item.label}</span>}
      <span style={{ color: 'var(--pw-color-text)', fontWeight: 600 }}>{item.value}</span>
    </span>
  )

  const [mobileOpen, setMobileOpen] = React.useState(false)
  const menuButtonRef = React.useRef<HTMLButtonElement | null>(null)
  const navRef = React.useRef<HTMLElement | null>(null)
  const drawerId = `${block.id}-menu`
  // Escape closes the drawer and hands focus back to the button that opened it
  // — a keyboard visitor was left inside a menu with no way out.
  React.useEffect(() => {
    if (!mobileOpen || typeof document === 'undefined') return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      setMobileOpen(false)
      menuButtonRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen])
  // A sticky bar covers the top of the page, so an in-page anchor landed UNDER
  // it. The bar publishes its own height as
  // `--pw-sticky-top-offset` and the page scrolls anchors that far short.
  //
  // WHETHER THE BAR STICKS IS ITS BLOCK STYLE. `style: {position: 'sticky',
  // top: 0, zIndex}` is hoisted by the engine to the block's wrapper — the
  // element that can stick, since the wrapper is exactly as tall as the bar —
  // so the bar reads the position the page actually gave it (its own root, or
  // the wrapper around it) rather than a prop of its own.
  const [sticky, setSticky] = React.useState(false)
  React.useEffect(() => {
    const el = navRef.current
    if (!el || typeof getComputedStyle === 'undefined') return
    const holders = [el, el.parentElement].filter((n): n is HTMLElement => n instanceof HTMLElement)
    setSticky(holders.some((n) => { const pos = getComputedStyle(n).position; return pos === 'sticky' || pos === 'fixed' }))
  })
  React.useEffect(() => {
    if (!sticky || typeof document === 'undefined' || typeof ResizeObserver === 'undefined') return
    const el = navRef.current
    if (!el) return
    const root = document.documentElement
    const publish = (): void =>
      root.style.setProperty('--pw-sticky-top-offset', `${Math.ceil(el.getBoundingClientRect().height)}px`)
    publish()
    const ro = new ResizeObserver(publish)
    ro.observe(el)
    return () => {
      ro.disconnect()
      root.style.removeProperty('--pw-sticky-top-offset')
    }
  }, [sticky])
  const stickyOffsetCss = (
    <style>
      {(sticky ? 'html{scroll-padding-top:var(--pw-sticky-top-offset,64px)}' : '') + HIT_AREA_CSS + NAV_BRAND_TOUCH_CSS + NAV_FORM_CSS}
    </style>
  )
  /** A drawer link closes the drawer on the way out. */
  const handleDrawerClick = (href: string | undefined) => (e: React.MouseEvent<HTMLAnchorElement>): void => {
    handleNavClick(href ?? '')(e)
    setMobileOpen(false)
  }

  // Native <a href> anchors navigate via the browser default action. Real
  // navigation is a SIDE-EFFECT: in inert (editor/preview) mode we cancel it
  // and emit a `navigate` notification instead, so a preview doesn't leave the
  // page. In live mode the anchors behave natively.
  /**
   * The brand: a link when it has somewhere to go, plain text when it does not.
   *
   * This is the pack's OWN convention, not a new one — `breadcrumb` already
   * renders a `<span>` for an item with no usable href (`component.tsx:101`).
   * The navbar was the one place that drew a link regardless.
   *
   * Written once and used by both layouts below. It was duplicated at two call
   * sites, which is how they could disagree; a brand that behaves differently
   * on mobile than on desktop is a second defect waiting behind this one.
   */
  const renderBrand = (): React.ReactNode => {
    const inner = (
      <>
        {logoSrc && (
          // Above the fold on every page: loaded eagerly, and its 28px height
          // is reserved (the width follows the picture) so nothing shifts.
          // Its alt is empty: the brand's name is the text beside it, and an
          // alt repeating it made a screen reader say the name twice.
          <img src={logoSrc} alt="" height={28} loading="eager" decoding="async" style={{ height: '28px', width: 'auto', objectFit: 'contain' }} />
        )}
        {logoText}
        {logoTagline && <span data-pw-nav-tagline="" style={taglineStyle}>{logoTagline}</span>}
      </>
    )
    if (!logoHref) return <span style={logoStyle}>{inner}</span>
    return (
      <a href={logoHref} style={logoStyle} onClick={handleNavClick(logoHref)} data-pw-hit="" data-pw-nav-brand="">
        {inner}
      </a>
    )
  }

  /** A menu header was clicked: in the editor it is reported as a navigation (the click itself only toggles). */
  const reportClick = (href: string): void => {
    if (context?.interactionMode === 'inert') {
      emit({ type: SURFACE_EVENTS.BLOCK_CLICK, surfaceId, blockId: block.id, payload: { href } })
    }
  }

  const handleNavClick = (href: string) => (e: React.MouseEvent<HTMLAnchorElement>): void => {
    if (context?.interactionMode === 'inert') {
      e.preventDefault()
      emit({ type: SURFACE_EVENTS.BLOCK_CLICK, surfaceId, blockId: block.id, payload: { href } })
    }
  }

  // The navbar paints its own background, so its text needs a local token
  // override matched to WHICH surface it painted (see panel/card for the
  // pattern). Primary-painted navbar (this pack's receipts set
  // backgroundColor: var(--pw-color-primary)) must read text-on-primary —
  // the on-card chain only worked by coincidence while on-card (dark) matched
  // what gold needed; on a theme with a DARK primary and no on-card tokens
  // (a neutral theme) it collapsed to dark-on-dark. Card-painted (default)
  // keeps the on-card chain.
  // A length the CSS can take as it is: px for a number; a string only when it is a plain length or a var().
  const rawWidth = p.contentMaxWidth
  const contentWidth =
    typeof rawWidth === 'number' && rawWidth > 0
      ? `${rawWidth}px`
      : typeof rawWidth === 'string' && /^(\d+(\.\d+)?(px|rem|em|vw|%)|var\(--[a-z0-9-]+\))$/.test(rawWidth.trim())
        ? rawWidth.trim()
        : undefined
  const isPrimaryBg = typeof backgroundColor === 'string' && backgroundColor.includes('color-primary')
  const navStyle: React.CSSProperties = {
    ['--pw-color-text' as string]: isPrimaryBg
      ? 'var(--pw-color-text-on-primary, var(--pw-color-text))'
      : 'var(--pw-color-text-on-card, var(--pw-color-text))',
    ['--pw-color-text-muted' as string]: isPrimaryBg
      ? 'color-mix(in srgb, var(--pw-color-text-on-primary, var(--pw-color-text)) 72%, transparent)'
      : 'var(--pw-color-text-muted-on-card, var(--pw-color-text-muted))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 'var(--pw-navbar-padding-top, 12px)',
    paddingBottom: 'var(--pw-navbar-padding-bottom, 12px)',
    paddingInline: 'var(--pw-navbar-padding-inline, 24px)',
    // contentMaxWidth: the side padding grows so the contents sit in that width, centred;
    // never below the bar's own inset. The background and the line stay full width.
    ...(contentWidth ? { paddingInline: `max(var(--pw-navbar-padding-inline, 24px), calc((100% - ${contentWidth}) / 2 + var(--pw-navbar-padding-inline, 24px)))` } : {}),
    backgroundColor,
    borderBottom: '1px solid var(--pw-color-border)',
    position: 'relative',
  }

  // The brand's look is declared tokens (manifest definition.tokens), today's values as defaults.
  const logoStyle: React.CSSProperties = {
    fontWeight: 'var(--pw-navbar-logo-weight, 700)' as React.CSSProperties['fontWeight'],
    fontSize: 'var(--pw-navbar-logo-size, var(--pw-font-size-lg))',
    color: 'var(--pw-navbar-logo-ink, var(--pw-color-text))',
    letterSpacing: 'var(--pw-navbar-logo-letter-spacing, 0px)',
    display: 'flex',
    alignItems: logoTagline ? 'baseline' : 'center',
    gap: logoTagline ? '0.4rem' : '8px',
    textDecoration: 'none',
  }

  /** The tagline: smaller, lighter and fainter than the name it follows. */
  const taglineStyle: React.CSSProperties = {
    fontSize: '0.85em',
    fontWeight: 500,
    letterSpacing: 'normal',
    opacity: 0.55,
  }

  const linksStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    // At md the row did not wrap and had no minWidth, so it pushed the bar
    // wider than the viewport. It now wraps and may shrink.
    flexWrap: 'wrap',
    minWidth: 0,
    rowGap: '8px',
    columnGap: '24px',
    justifyContent:
      alignment === 'center' ? 'center' : alignment === 'left' ? 'flex-start' : 'flex-end',
    flex: 1,
    margin: '0 24px',
  }

  const ctaStyle: React.CSSProperties = {
    backgroundColor: 'var(--pw-color-primary)',
    color: 'var(--pw-color-text-on-primary)',
    padding: '8px 16px',
    borderRadius: 'var(--pw-navbar-button-radius, var(--pw-border-radius))',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: 'var(--pw-font-size-sm)',
    textDecoration: 'none',
    display: 'inline-block',
  }

  // Ghost / text CTA — transparent background, no solid fill, theme text colour.
  // Distinct from the primary (filled) CTA so the two read as a hierarchy.
  const ghostCtaStyle: React.CSSProperties = {
    backgroundColor: 'transparent',
    color: 'var(--pw-color-text)',
    padding: '8px 16px',
    borderRadius: 'var(--pw-navbar-button-radius, var(--pw-border-radius))',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: 'var(--pw-font-size-sm)',
    textDecoration: 'none',
    display: 'inline-block',
  }

  const linkTextStyle: React.CSSProperties = {
    color: 'var(--pw-color-text)',
    textDecoration: 'none',
    fontSize: 'var(--pw-font-size-sm)',
    fontWeight: 500,
  }
  // The page being viewed: heavier, underlined in the brand colour. Text stays
  // ink (--pw-color-text) — the brand fill as text fails contrast on some themes.
  const activeLinkTextStyle: React.CSSProperties = {
    ...linkTextStyle,
    fontWeight: 600,
    textDecorationLine: 'underline',
    textDecorationColor: 'var(--pw-color-primary)',
    textDecorationThickness: '2px',
    textUnderlineOffset: '6px',
  }
  // The section the page is in (a `match: "prefix"` link above it): the same
  // weight, a thinner and lighter underline.
  const sectionLinkTextStyle: React.CSSProperties = {
    ...linkTextStyle,
    fontWeight: 600,
    textDecorationLine: 'underline',
    textDecorationColor: 'color-mix(in srgb, var(--pw-color-primary) 55%, transparent)',
    textDecorationThickness: '1px',
    textUnderlineOffset: '6px',
  }

  /** The links' landmark name. */
  const drawerLabel = mainNavWord
  /**
   * A phone-drawer row: 44px tall (a touch target, not a line of text), and
   * the CURRENT page visibly marked — a brand bar on its left edge and a tint,
   * not only a heavier weight that a parent with sub-links also had.
   */
  const drawerLinkStyle = (state: 'page' | 'section' | null, parent: boolean, sub: boolean): React.CSSProperties => {
    const current = state === 'page'
    return {
    display: 'flex',
    alignItems: 'center',
    minHeight: '44px',
    boxSizing: 'border-box',
    padding: sub ? '0 12px 0 28px' : '0 12px',
    borderRadius: 'var(--pw-border-radius-sm, 6px)',
    // The section the page is in: a lighter edge, no tint.
    borderLeft: current
      ? '3px solid var(--pw-color-primary)'
      : state === 'section'
        ? '3px solid color-mix(in srgb, var(--pw-color-primary) 45%, transparent)'
        : '3px solid transparent',
    backgroundColor: current ? 'color-mix(in srgb, var(--pw-color-primary) 10%, transparent)' : undefined,
    color: sub && !current ? 'var(--pw-color-text-muted)' : 'var(--pw-color-text)',
    textDecoration: 'none',
    fontSize: 'var(--pw-font-size-sm)',
    fontWeight: state !== null || parent ? 600 : 500,
    }
  }

  const caret = (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: '0 0 auto', marginLeft: '4px' }}
      // chevron-down — drawn inline (the down chevron is not in ICON_PATHS).
      dangerouslySetInnerHTML={{ __html: '<polyline points="6 9 12 15 18 9"/>' }}
    />
  )

  /**
   * The account control: an avatar menu button (with the name beside it on a
   * wide screen) or, signed out, a "Sign in" button. The menu itself — ARIA,
   * keyboard, dismissal, the two auth actions — is the shared one every shell
   * block uses; the navbar only draws the trigger.
   */
  const renderAccount = (compact: boolean): React.ReactNode => {
    if (!account) return null
    // The name beside the avatar is the wide bar's, from `lg` up — CSS decides
    // (NAV_FORM_CSS), so the first painted frame already has it right.
    const named = !compact
    return (
      <AccountControl
        account={account}
        blockId={block.id}
        inert={isInert}
        presentation="popover"
        placement="bottom-end"
        wrapperStyle={{ flex: '0 0 auto' }}
        renderTrigger={({ ref, ...trigger }, state) =>
          state.signedIn ? (
            <button
              ref={ref}
              {...trigger}
              data-pw-nav-account-named={named ? '' : undefined}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '2px',
                border: 'none',
                borderRadius: 'var(--pw-border-radius-full)',
                background: state.open ? 'color-mix(in srgb, currentColor 12%, transparent)' : 'transparent',
                color: 'var(--pw-color-text)',
                fontFamily: 'inherit',
                fontSize: 'var(--pw-font-size-sm)',
                fontWeight: 500,
                cursor: 'pointer',
                maxWidth: '220px',
              }}
            >
              <AccountAvatar account={state.account} size={compact ? 32 : 36} />
              {named && (
                <span data-pw-nav-account-name="" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {state.label}
                </span>
              )}
            </button>
          ) : (
            <button ref={ref} {...trigger} style={accountSignInButtonStyle}>
              {state.label}
            </button>
          )
        }
      />
    )
  }

  // NO DRAWER WITHOUT CONTENT. A bar with nothing to put in the drawer (no
  // links, no search, social, info, second wordmark or CTA) draws no menu
  // button: a phone visitor met a hamburger that opened an empty panel. The
  // account control stays in the bar either way.
  const hasDrawer =
    links.length > 0 ||
    drawerLinks.length > 0 ||
    Boolean(secondaryLogoText) ||
    showSearch ||
    socialLinks.length > 0 ||
    rightInfo.length > 0 ||
    hasSecondaryCta ||
    showCTA

  /** The narrow form's drawer, open: every destination and tool of the wide bar, stacked. */
  const renderDrawer = (): React.ReactElement => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        paddingTop: '12px',
        // 44px rows: the links themselves carry the height, so the
        // gap between them stays small.
        gap: '4px',
        borderTop: '1px solid var(--pw-color-border)',
        marginTop: '12px',
      }}
    >
      {[...drawerLinks, ...links].map((link, i) => {
        const subItems = Array.isArray(link.items) ? link.items : []
        const megaColumns = Array.isArray(link.megaColumns) ? link.megaColumns : []
        // A mega-menu flattens to the union of its column items (+ the
        // feature tile) on touch — no hover surface, so everything is
        // expanded inline beneath the parent label.
        const megaItems: NavSubLinkData[] = megaColumns.flatMap((col) =>
          (Array.isArray(col.items) ? col.items : []).map((mi) => ({
            label: mi.label,
            href: mi.href ?? '#',
          })),
        )
        if (link.feature) {
          megaItems.push({ label: link.feature.title, href: link.feature.href ?? '#' })
        }
        // In the drawer a dropdown is expanded inline: the parent label sits
        // above its indented sub-links (no hover surface on touch). A flat
        // link is just a single anchor.
        const childLinks = subItems.length > 0 ? subItems : megaItems
        return (
          <React.Fragment key={i}>
            <a
              href={safeHref(link.href)}
              onClick={handleDrawerClick(link.href)}
              aria-current={stateOf(link) === 'page' ? 'page' : undefined}
              data-pw-current={stateOf(link) ?? undefined}
              style={drawerLinkStyle(stateOf(link), childLinks.length > 0, false)}
            >
              {link.label}
            </a>
            {childLinks.map((sub, j) => (
              <a
                key={j}
                href={safeHref(sub.href)}
                onClick={handleDrawerClick(sub.href)}
                aria-current={stateOf(sub) === 'page' ? 'page' : undefined}
                data-pw-current={stateOf(sub) ?? undefined}
                style={drawerLinkStyle(stateOf(sub), false, true)}
              >
                {sub.label}
              </a>
            ))}
          </React.Fragment>
        )
      })}
      {/* The drawer carries what the wide bar carries: the second wordmark,
          the search box and the social icons, so a phone visitor reaches
          them too. */}
      {secondaryLogoText && renderSecondaryLogo()}
      {showSearch && renderSearch('-menu')}
      {socialLinks.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
          {socialLinks.map((item, i) => renderSocial(item, i))}
        </div>
      )}
      {rightInfo.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '14px',
            paddingTop: '4px',
          }}
        >
          {rightInfo.map((item, i) => renderInfoSlot(item, i))}
        </div>
      )}
      {hasSecondaryCta && <GhostCta href={secondaryCtaHref} label={secondaryCtaLabel} baseStyle={ghostCtaStyle} onNavClick={handleNavClick} extra={{ textAlign: 'center' }} />}
      {showCTA && (
        <a
          href={safeHref(ctaHref)}
          onClick={handleDrawerClick(ctaHref)}
          style={{ ...ctaStyle, textAlign: 'center' }}
        >
          {ctaLabel}
        </a>
      )}
    </div>
  )

  return (
    // THE BAR IS THE PAGE'S BANNER; THE LINKS ARE ITS <nav>. The root was a
    // <nav>, so a shell had a nav landmark but no header — the brand, the
    // account and the search sat in "navigation".
    //
    // Both forms are in the markup; NAV_FORM_CSS shows the wide one from
    // 768px and the narrow one below it.
    <header
      ref={navRef as React.Ref<HTMLElement>}
      id={block.id}
      data-block-id={block.id}
      data-pw-navbar=""
      lang={lang}
      style={{ ...navStyle, ...block.style }}
      data-block-type="navbar"
    >
      {stickyOffsetCss}
      {skipTo && skipLabel && (
        <a href={`#${skipTo}`} data-pw-skip-link="" onClick={(e) => createSkipLink(skipTo, skipLabel).handleClick(e.nativeEvent)}>
          {skipLabel}
        </a>
      )}
      {renderBrand()}
      {links.length > 0 && (
        <nav data-pw-nav-wide="" aria-label={drawerLabel} style={linksStyle}>
          {links.map((link, i) => (
            <NavLinkItem
              key={i}
              link={link}
              kit={{ state: linkState(link), style: linkStyleOf(linkState(link)), onNavClick: handleNavClick, reportClick, caret, renderInlineIcon }}
            />
          ))}
        </nav>
      )}
      {hasUtility && (
        // The cluster keeps to the right edge (an auto margin), whatever else sits in the bar: with no links
        // and a placed child, space-between put it in the middle.
        <div data-pw-nav-wide="" style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: '0 0 auto', marginInlineStart: 'auto' }}>
          {secondaryLogoText && renderSecondaryLogo()}
          {rightInfo.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '0 0 auto' }}>
              {rightInfo.map((item, i) => renderInfoSlot(item, i))}
            </div>
          )}
          {showSearch && renderSearch('')}
          {socialLinks.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: '0 0 auto' }}>
              {socialLinks.map((item, i) => renderSocial(item, i))}
            </div>
          )}
          {hasSecondaryCta && <GhostCta href={secondaryCtaHref} label={secondaryCtaLabel} baseStyle={ghostCtaStyle} onNavClick={handleNavClick} />}
          {showCTA && (
            <a href={safeHref(ctaHref)} style={ctaStyle} onClick={handleNavClick(ctaHref)}>
              {ctaLabel}
            </a>
          )}
          {hasAvatar && renderAvatar(36)}
          {renderAccount(false)}
        </div>
      )}
      {/* WHAT THE APP PLACES IN THE BAR (a language switch, a theme toggle)
          sits in the band at every width, once: in neither form, so it is
          neither hidden on a phone nor drawn twice. Placed beside the bar, it
          drew as a band of its own under it. */}
      {React.Children.count(children) > 0 && (
        <div data-pw-nav-children="" style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '0 0 auto', marginInlineStart: '16px' }}>
          {children}
        </div>
      )}
      <div data-pw-nav-narrow="" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {hasAvatar && renderAvatar(32)}
        {renderAccount(true)}
        {hasDrawer && (
        <button
          type="button"
          ref={menuButtonRef}
          onClick={() => setMobileOpen((o) => !o)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 'var(--pw-font-size-xl)',
            padding: '4px 8px',
            // The bar's own ink — the UA default was black on a dark bar.
            color: 'inherit',
            fontFamily: 'inherit',
            minWidth: '44px',
            minHeight: '44px',
          }}
          aria-label={mobileOpen ? closeMenuWord : openMenuWord}
          aria-expanded={mobileOpen}
          aria-controls={drawerId}
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
        )}
      </div>
      {/* The <nav> landmark stays on the page with the drawer closed: a
          screen-reader visitor finds the navigation, and the menu button
          that controls it, by landmark. */}
      {hasDrawer && (
      <nav
        data-pw-nav-narrow=""
        id={drawerId}
        aria-label={drawerLabel}
        style={mobileOpen ? { width: '100%' } : { display: 'contents' }}
      >
        {mobileOpen && renderDrawer()}
      </nav>
      )}
    </header>
  )
}
