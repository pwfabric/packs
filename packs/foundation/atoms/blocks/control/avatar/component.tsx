import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export const AVATAR_SHAPES = ['circle', 'square', 'rounded'] as const
export const AVATAR_SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const

export interface AvatarProps {
  /** Override for the initials ground. */
  readonly backgroundColor?: string
  readonly src?: string
  readonly alt: string
  readonly name?: string
  readonly size: (typeof AVATAR_SIZES)[number]
  readonly shape: (typeof AVATAR_SHAPES)[number]
  readonly fallbackColor?: string
  readonly showStatus: boolean
  readonly status?: 'online' | 'offline' | 'away' | 'busy'
}

// ============================================================
// DEFINITION
// ============================================================

export const avatarDefinition: BlockDefinition = {
  type: 'avatar',
  name: 'Avatar',
  category: 'control',
  icon: '👤',
  defaultProps: {
    size: 'md',
    shape: 'circle',
    alt: '',
    showStatus: false,
  },
  defaultLayout: { span: { xs: 1, sm: 1, md: 1, lg: 1 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

export const AvatarBlock: BlockComponent = ({ props, block }) => {
  const [imgError, setImgError] = React.useState(false)

  const sizeMap: Record<string, number> = {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 48,
    xl: 64,
  }

  const p = props as unknown as AvatarProps
  const sizeName = p.size
  const INITIALS_SIZE: Record<string, string> = {
    xs: 'var(--pw-font-size-xs, 12px)',
    sm: 'var(--pw-font-size-xs, 12px)',
    md: 'var(--pw-font-size-sm, 14px)',
    lg: 'var(--pw-font-size-base, 16px)',
    xl: 'var(--pw-font-size-xl, 20px)',
  }
  const size = sizeMap[sizeName] ?? 40
  const shape = p.shape
  const src = p.src
  const alt = p.alt
  const name = typeof p.name === 'string' ? p.name : undefined
  const showStatus = p.showStatus
  const status = p.status

  const borderRadius = shape === 'circle' ? '50%' : shape === 'rounded' ? '8px' : '0'

  const getInitials = (nameStr: string): string => {
    return nameStr
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // Theme-driven fallback background. Rather than self-generating a per-name
  // hue (which ignores the surface theme), default to the theme palette so an
  // avatar re-skins with the rest of the surface. A hashed pick across
  // primary/secondary/accent keeps multi-avatar groups visually distinct while
  // still being driven entirely by the active theme tokens. An explicit
  // `fallbackColor` / `backgroundColor` prop always overrides.
  // Background/foreground are picked as a PAIR: an "on-X" text token only
  // contrasts with its own X background. The old hashed pick included
  // secondary (no on-secondary token exists) while the initials were fixed to
  // text-on-primary — on light themes secondary resolves light and the
  // initials vanished (rgb(250,250,250) on rgb(244,244,245), found by the A3
  // contrast probe). Only roles with a matching on-token are eligible.
  const generateColorPair = (nameStr: string): { bg: string; fg: string } => {
    const themePairs = [
      { bg: 'var(--pw-color-primary)', fg: 'var(--pw-color-text-on-primary)' },
      { bg: 'var(--pw-color-accent)', fg: 'var(--pw-color-on-accent, var(--pw-color-text-on-primary))' },
    ]
    let hash = 0
    for (let i = 0; i < nameStr.length; i++) {
      hash = nameStr.charCodeAt(i) + ((hash << 5) - hash)
    }
    return themePairs[Math.abs(hash) % themePairs.length] ?? themePairs[0]!
  }

  const statusColors: Record<string, string> = {
    online: 'var(--pw-color-success)',
    offline: 'var(--pw-color-text-muted)',
    away: 'var(--pw-color-warning)',
    busy: 'var(--pw-color-error)',
  }

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-block',
    width: size,
    height: size,
    borderRadius,
    overflow: 'hidden',
    backgroundColor:
      p.backgroundColor ??
      p.fallbackColor ??
      (name ? generateColorPair(name).bg : 'var(--pw-color-border)'),
  }

  const avatarStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: name
      ? (p.fallbackColor ?? generateColorPair(name).bg)
      : 'var(--pw-color-border)',
    // Explicit fallbackColor/backgroundColor overrides keep the historical
    // on-primary text; the hashed path uses its own matching pair; the
    // no-name border wash needs plain text.
    color:
      p.fallbackColor || p.backgroundColor
        ? 'var(--pw-color-text-on-primary)'
        : name
          ? generateColorPair(name).fg
          : 'var(--pw-color-text)',
    // Initials on the THEME scale, not 0.4 × the circle (9.6 / 12.8 / 16 /
    // 19.2 / 25.6px — measured off-scale on every page with an avatar).
    fontSize: INITIALS_SIZE[sizeName] ?? INITIALS_SIZE.md,
    fontWeight: 500,
  }

  const statusStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: size * 0.25,
    height: size * 0.25,
    borderRadius: '50%',
    backgroundColor: status ? statusColors[status] : 'var(--pw-color-text-muted)',
    border: '2px solid var(--pw-color-card)',
  }

  const showImage = src && !imgError
  const ariaLabel = alt || (name ? `Avatar for ${name}` : 'User avatar')

  return (
    <div
      id={block.id}
      data-block-id={block.id}
      style={{ ...containerStyle, ...block.style }}
      data-block-type="avatar"
      role="img"
      aria-label={ariaLabel}
    >
      <div style={avatarStyle}>
        {showImage ? (
          <img
            src={src}
            alt={alt}
            onError={() => setImgError(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : name ? (
          <span aria-hidden="true">{getInitials(name)}</span>
        ) : (
          <svg
            width={size * 0.5}
            height={size * 0.5}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          </svg>
        )}
      </div>
      {showStatus && <div style={statusStyle} aria-hidden="true" />}
    </div>
  )
}

// This block's width is its content: in a flex row it must not take an equal
// share. Declared here, applied by the runtime (>= 4.3).
// `Object.assign` rather than a property assignment so the pack compiles against
// runtime type versions that predate `BlockComponent.sizing`.
Object.assign(AvatarBlock, { sizing: 'intrinsic' })
