import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { HIT_AREA_CSS, ICON_PATHS, safeHref, listOf, textOf } from '../../../lib/_shared-utils.js'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'
import { useAppMessage } from '@pwfabric/runtime'
import {
  AccountAvatar,
  AccountControl,
  accountSignInButtonStyle,
  readAccount,
  sameRoute,
  type AccountInfo,
} from '../../../lib/_shared-account-menu.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

/** On a phone or touch screen the brand link is a REAL 44px-tall box (it was 24–33px). */
const NAV_BRAND_TOUCH_CSS = '@media (max-width: 640px), (pointer: coarse) { [data-pw-nav-brand] { min-height: 44px; } }'

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
  readonly sticky: boolean
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
    sticky: false,
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
  items?: NavSubLinkData[]
  megaColumns?: NavMegaColumnData[]
  feature?: NavFeatureTileData
}

interface NavSocialLinkData {
  icon: string
  href?: string
}

interface NavInfoSlotData {
  label?: string
  value: string
  icon?: string
}

export const NavbarBlock: BlockComponent = ({ props, block, context }) => {
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
  const activeHref = typeof props.activeHref === 'string' ? props.activeHref : undefined
  /** A link is active when it, or one of its dropdown entries, routes to activeHref. */
  const isActiveLink = (link: NavLinkData): boolean =>
    sameRoute(link.href, activeHref) ||
    (Array.isArray(link.items) && link.items.some((sub) => sameRoute(sub.href, activeHref)))
  const sticky = p.sticky
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

  const renderSearch = (): React.ReactElement => (
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
        borderRadius: '6px',
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
        id={`${block.id}-search`}
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
      borderRadius: '6px',
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
        aria-label={item.icon}
        title={item.icon}
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

  const viewport = context?.viewport ?? 'lg'
  const isMobile = viewport === 'xs' || viewport === 'sm'
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
      {(sticky ? 'html{scroll-padding-top:var(--pw-sticky-top-offset,64px)}' : '') + HIT_AREA_CSS + NAV_BRAND_TOUCH_CSS}
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
          <img src={logoSrc} alt={logoText} height={28} loading="eager" decoding="async" style={{ height: '28px', width: 'auto', objectFit: 'contain' }} />
        )}
        {logoText}
      </>
    )
    if (!logoHref) return <span style={logoStyle}>{inner}</span>
    return (
      <a href={logoHref} style={logoStyle} onClick={handleNavClick(logoHref)} data-pw-hit="" data-pw-nav-brand="">
        {inner}
      </a>
    )
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
    padding: '12px 24px',
    backgroundColor,
    borderBottom: '1px solid var(--pw-color-border)',
    position: sticky ? 'sticky' : 'relative',
    top: sticky ? 0 : undefined,
    zIndex: sticky ? 'var(--pw-z-sticky, var(--pw-z-nav))' : undefined,
  }

  const logoStyle: React.CSSProperties = {
    fontWeight: 700,
    fontSize: 'var(--pw-font-size-lg)',
    color: 'var(--pw-color-text)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    textDecoration: 'none',
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
    borderRadius: '6px',
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
    borderRadius: '6px',
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

  /** The links' landmark name. */
  const drawerLabel = mainNavWord
  /**
   * A phone-drawer row: 44px tall (a touch target, not a line of text), and
   * the CURRENT page visibly marked — a brand bar on its left edge and a tint,
   * not only a heavier weight that a parent with sub-links also had.
   */
  const drawerLinkStyle = (current: boolean, parent: boolean, sub: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    minHeight: '44px',
    boxSizing: 'border-box',
    padding: sub ? '0 12px 0 28px' : '0 12px',
    borderRadius: 'var(--pw-border-radius-sm, 6px)',
    borderLeft: current ? '3px solid var(--pw-color-primary)' : '3px solid transparent',
    backgroundColor: current ? 'color-mix(in srgb, var(--pw-color-primary) 10%, transparent)' : undefined,
    color: sub && !current ? 'var(--pw-color-text-muted)' : 'var(--pw-color-text)',
    textDecoration: 'none',
    fontSize: 'var(--pw-font-size-sm)',
    fontWeight: current || parent ? 600 : 500,
  })

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
   * A top-level nav link. When it carries `items`, it renders a ▾ caret and a
   * dropdown panel (white card, shadow, theme tokens) that opens on hover and on
   * focus-within (keyboard) — and toggles on click as a fallback. Submenu links
   * navigate natively in live mode; in inert (editor/preview) mode the same
   * `handleNavClick` suppresses navigation and emits a `navigate` event, exactly
   * like the flat links. The menu still OPENS on hover in inert so a preview can
   * show it. Flat links (no items) render a plain anchor with NO caret.
   */
  const NavLinkItem: React.FC<{ link: NavLinkData }> = ({ link }) => {
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
          onClick={handleNavClick(link.href)}
          style={isActiveLink(link) ? activeLinkTextStyle : linkTextStyle}
          aria-current={isActiveLink(link) ? 'page' : undefined}
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
        borderRadius: '8px',
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
              if (context?.interactionMode === 'inert') {
                emit({
                  type: SURFACE_EVENTS.BLOCK_CLICK,
                  surfaceId,
                  blockId: block.id,
                  payload: { href: link.href },
                })
              }
              setOpen((o) => !o)
            }}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-current={isActiveLink(link) ? 'page' : undefined}
            data-pw-hit=""
            style={{ ...(isActiveLink(link) ? activeLinkTextStyle : linkTextStyle), display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
          >
            {link.label}
            {caret}
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
              borderRadius: '12px',
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
                      onClick={handleNavClick(href)}
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
                          {renderInlineIcon(mi.icon, 18)}
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
                onClick={handleNavClick(feature.href ?? '#')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  width: '220px',
                  padding: '16px',
                  borderRadius: '10px',
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
                    {renderInlineIcon(feature.icon, 24)}
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
            if (context?.interactionMode === 'inert') {
              emit({ type: SURFACE_EVENTS.BLOCK_CLICK, surfaceId, blockId: block.id, payload: { href: link.href } })
            }
            setOpen((o) => !o)
          }}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-current={isActiveLink(link) ? 'page' : undefined}
          data-pw-hit=""
          style={{
            ...(isActiveLink(link) ? activeLinkTextStyle : linkTextStyle),
            display: 'inline-flex',
            alignItems: 'center',
            cursor: 'pointer',
          }}
        >
          {link.label}
          {caret}
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
            borderRadius: '8px',
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
              onClick={handleNavClick(sub.href)}
              style={{
                display: 'block',
                padding: '8px 12px',
                borderRadius: '6px',
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
   * `navigate` event — same posture as the primary CTA and the links.
   */
  const GhostCta: React.FC<{ block?: React.CSSProperties }> = ({ block: extra }) => {
    const [hover, setHover] = React.useState(false)
    return (
      <a
        href={safeHref(secondaryCtaHref)}
        onClick={handleNavClick(secondaryCtaHref)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          ...ghostCtaStyle,
          // currentColor-based tint: visible on light AND primary-dark navbars
          // (the old rgba(0,0,0,.05) vanished on a dark bar).
          backgroundColor: hover ? 'color-mix(in srgb, currentColor 12%, transparent)' : 'transparent',
          ...extra,
        }}
      >
        {secondaryCtaLabel}
      </a>
    )
  }

  /**
   * The account control: an avatar menu button (with the name beside it on a
   * wide screen) or, signed out, a "Sign in" button. The menu itself — ARIA,
   * keyboard, dismissal, the two auth actions — is the shared one every shell
   * block uses; the navbar only draws the trigger.
   */
  const renderAccount = (compact: boolean): React.ReactNode => {
    if (!account) return null
    const showName = !compact && (viewport === 'lg' || viewport === 'xl' || viewport === '2xl')
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
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: showName ? '2px 10px 2px 2px' : '2px',
                border: 'none',
                borderRadius: '999px',
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
              {showName && (
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

  if (isMobile) {
    return (
      // THE BAR IS THE PAGE'S BANNER; THE LINKS ARE ITS <nav>. The root was a
      // <nav>, so a shell had a nav landmark but no header — the brand, the
      // account and the search sat in "navigation".
      <header
        ref={navRef as React.Ref<HTMLElement>}
        id={block.id}
        data-block-id={block.id}
        style={{ ...navStyle, flexWrap: 'wrap', gap: '0', ...block.style }}
        data-block-type="navbar"
      >
        {stickyOffsetCss}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          {renderBrand()}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {hasAvatar && renderAvatar(32)}
            {renderAccount(true)}
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
          </div>
        </div>
        {/* The <nav> landmark stays on the page with the drawer closed: a
            screen-reader visitor finds the navigation, and the menu button
            that controls it, by landmark. */}
        <nav id={drawerId} aria-label={drawerLabel} style={mobileOpen ? undefined : { display: 'contents' }}>
        {mobileOpen && (
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
            {links.map((link, i) => {
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
              // In the mobile drawer a dropdown is expanded inline: the parent
              // label sits above its indented sub-links (no hover surface on
              // touch). A flat link is just a single anchor.
              const childLinks = subItems.length > 0 ? subItems : megaItems
              return (
                <React.Fragment key={i}>
                  <a
                    href={safeHref(link.href)}
                    onClick={handleDrawerClick(link.href)}
                    aria-current={sameRoute(link.href, activeHref) ? 'page' : undefined}
                    style={drawerLinkStyle(sameRoute(link.href, activeHref), childLinks.length > 0, false)}
                  >
                    {link.label}
                  </a>
                  {childLinks.map((sub, j) => (
                    <a
                      key={j}
                      href={safeHref(sub.href)}
                      onClick={handleDrawerClick(sub.href)}
                      aria-current={sameRoute(sub.href, activeHref) ? 'page' : undefined}
                      style={drawerLinkStyle(sameRoute(sub.href, activeHref), false, true)}
                    >
                      {sub.label}
                    </a>
                  ))}
                </React.Fragment>
              )
            })}
            {/* The drawer carries what the desktop bar carries: the
                second wordmark, the search box and the social icons were
                desktop-only, so a phone visitor could not reach them at all. */}
            {secondaryLogoText && renderSecondaryLogo()}
            {showSearch && renderSearch()}
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
            {hasSecondaryCta && <GhostCta block={{ textAlign: 'center' }} />}
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
        )}
        </nav>
      </header>
    )
  }

  return (
    <header
      ref={navRef as React.Ref<HTMLElement>}
      id={block.id}
      data-block-id={block.id}
      style={{ ...navStyle, ...block.style }}
      data-block-type="navbar"
    >
      {stickyOffsetCss}
      {renderBrand()}
      {links.length > 0 && (
        <nav aria-label={drawerLabel} style={linksStyle}>
          {links.map((link, i) => (
            <NavLinkItem key={i} link={link} />
          ))}
        </nav>
      )}
      {hasUtility && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: '0 0 auto' }}>
          {secondaryLogoText && renderSecondaryLogo()}
          {rightInfo.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '0 0 auto' }}>
              {rightInfo.map((item, i) => renderInfoSlot(item, i))}
            </div>
          )}
          {showSearch && renderSearch()}
          {socialLinks.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: '0 0 auto' }}>
              {socialLinks.map((item, i) => renderSocial(item, i))}
            </div>
          )}
          {hasSecondaryCta && <GhostCta />}
          {showCTA && (
            <a href={safeHref(ctaHref)} style={ctaStyle} onClick={handleNavClick(ctaHref)}>
              {ctaLabel}
            </a>
          )}
          {hasAvatar && renderAvatar(36)}
          {renderAccount(false)}
        </div>
      )}
    </header>
  )
}
