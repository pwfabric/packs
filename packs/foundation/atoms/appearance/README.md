# appearance/ — pack themes

Six themes, each a whole identity for one kind of app, not a palette swap.
They differ on the four axes that change how a page reads, not only on its
colour:

| theme | for | palette | voice (heading / body, base size) | shape (radius md / xl) | rhythm (line height / max width) |
|---|---|---|---|---|---|
| zinc | a shop, a service, a product | near-black on white | system sans 600 / system sans, 16px | 8px / 16px | 1.6 / 1200 |
| midnight | dashboards and internal tools, dark | blue on deep navy | IBM Plex Sans 600 / IBM Plex Sans, 15px | 6px / 12px | 1.45 / 1440 |
| paper | magazines, journals, long guides | ink navy on warm paper | Newsreader 600 / Source Serif 4, 18px | 3px / 6px, no shadows | 1.65 / 1160 |
| linen | cafés, bookings, local places | terracotta on cream | Lora 600 / Work Sans, 17px | 12px / 20px | 1.6 / 1120 |
| slate | intranets, admin screens, reference docs | blue on cool grey, white cards | Inter 600 / Inter, 15px | 6px / 10px | 1.5 / 1440 |
| ember | a product launch, an event, dark | amber on warm near-black | Montserrat 700 / DM Sans, 17px | 14px / 22px | 1.6 / 1200 |

Every webfont is on the engine's allow-list and covers Turkish (latin-ext);
each stack ends in system faces, and the engine draws a metric-matched
stand-in until the webfont arrives. A theme's name states its character, not
its owner. Each theme's `knowledge` says what it is for and which theme to
wear instead (`antiPatterns`).

**Themes are worn by name.** A surface binds a theme through
`appearance.use`; the integrity gate requires at least one surface to do so.

**A surface must be repaintable.** The gate caps raw colour values in a
surface's blocks at 8 (`RAW_COLOR_CAP`); above that the surface either binds
to tokens / `color-mix()` derivations or declares `themeIndependent: true`
and leaves the theme rhythm. Derivation idioms that keep a thesis while
staying themeable: glass = `color-mix(in srgb, var(--pw-color-card) 12%,
transparent)`, faded ink = `color-mix(in srgb, var(--pw-color-text) 62%,
transparent)`, offset shadow = `6px 6px 0 var(--pw-color-text)`, marker =
`var(--pw-color-accent)` with `--pw-color-on-accent` ink.

## What a theme declares

Nine groups, 71 fields: colors (13), typography (17), border (8), spacing (7),
shadows (6), motion (5), layout (6), focus (3), zIndex (6). The appearance
cascade reads all of them (no declared field is dead).

**Every emitted token has a consumer** — a token nothing reads is a promise
to theme authors that does nothing. The less obvious consumers:

| token | consumer |
|---|---|
| `--pw-z-toast` | `feedback/toast` root `zIndex` |
| `--pw-z-drawer` | `overlay/drawer` panel `zIndex` |
| `--pw-z-sticky` | `layout/navbar` when sticky, `layout/bottom-bar` when fixed |
| `--pw-shadow-button` | `control/button` primary and accent variants |
| `--pw-font-weight-body`, `--pw-letter-spacing-body` | `text/text` defaults |
| `--pw-border-radius-2xl` | `overlay/modal` dialog radius |
| `--pw-duration-normal`, `--pw-easing-bounce` | `overlay/modal` transform transition; `--pw-duration-normal` also `overlay/drawer` |
| `--pw-color-accent-subtle` | `form/segmented-control` active segment |
| `--pw-color-link-on-card` | `container/card` scopes `--pw-color-link`, `control/link` reads it |
| `--pw-color-primary-strong` | `feedback/radial-progress` default stroke |
| `--pw-space-xxl` | `patterns/band-signup-form` section `paddingY` |

## Two modes, both written by hand

A visitor whose system is dark sees a theme's dark mode. The platform can
derive one from the light palette (`deriveDarkTheme` in contracts), but a
derived palette keeps the brand hue and flips the neutrals, which suits few
brands. So every theme here ships its own `darkTheme` (colours and focus
ring); the cascade lays it over the derivation, and every token it sets wins.
midnight and ember are dark by intent: their `darkTheme` repeats the declared
palette, so they stay dark in both modes.

The integrity gate checks every theme in light AND in its own dark mode:

- text pairs ≥ 4.5:1 — text and textMuted on background and card, and
  `textOnPrimary` on `primary`;
- the focus ring ≥ 3:1 on background and card. Each theme's ring comes from
  its own palette.

| theme | text on ground (light / dark) | muted text, worst ground | button ink on primary | focus ring, worst ground |
|---|---|---|---|---|
| zinc | 19.90 / 19.06 | 6.31 / 6.91 | 16.97 / 16.12 | 4.83 / 6.91 |
| midnight | 15.38 | 6.85 | 8.95 | 8.13 |
| paper | 15.65 / 15.10 | 6.93 / 7.48 | 12.65 / 9.43 | 4.96 / 9.38 |
| linen | 14.65 / 15.63 | 6.51 / 8.23 | 6.71 / 9.33 | 3.76 / 9.16 |
| slate | 16.41 / 15.56 | 6.99 / 7.39 | 6.67 / 8.77 | 4.13 / 8.26 |
| ember | 16.38 | 8.39 | 8.81 | 8.27 |

## The heading scale hook

`text.heading` reads an OPT-IN override chain the theme may (but does not yet)
declare: `--pw-font-size-h1` … `--pw-font-size-h5`, each falling back to the
typography scale (`h1 → font-size-4xl` … `h5 → font-size-lg`). A theme that
wants a bespoke heading scale sets these; none of the six currently do, and
that is a choice, not an omission.
