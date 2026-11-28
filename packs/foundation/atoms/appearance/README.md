# appearance/ — pack themes

**A plain base and three themes that build on it.** `theme-base` sets every
token with plain values: white ground, grey text and borders, one blue
(`#2563eb`), system sans, 6px corners, light shadows, and its own dark mode. It
is the look of a page with no character of its own: wear it to judge a layout,
or extend it to start a theme of your own.

zinc, paper and ember each say `"extends": "theme-base"` and write only what
differs (appearance §3.5): the engine draws each as the base's token sets with
its own on top, light over light and dark over dark. A token is fixed in one
place, and a theme file reads as its character, nothing else.

The three are each a whole identity for one kind of app, not a palette swap,
and three because each really differs from the others: a fourth would be a
neighbour with another colour. Every axis differs, not only colour:

| theme | for | palette | voice (heading / body, base size) | shape (radius md / xl) | rhythm (line height / max width) |
|---|---|---|---|---|---|
| base | the plain starting point; layouts judged without a character | grey on white, one blue | system sans 600 / system sans, 16px | 6px / 12px | 1.6 / 1200 |
| zinc | a shop, a service, a product; a tool, an admin screen, reference docs | near-black on pure white, blue links; cards set off by a border, no shadow | system sans 600 (h1 700) / system sans, 15px | 6px / 12px | 1.5 / 1280, compact |
| paper | magazines, journals, long guides; cafés, bookings, local places | ink navy on strong cream, burgundy links; no borders on cards, no shadows | Newsreader 500 / Source Serif 4, 18px | 0px (square) | 1.75 / 1080, roomy |
| ember | a product launch, an event, a loud brand | burnt orange on a peach tint, white cards on deep soft shadows; amber on near-black in dark | Montserrat 800, h1 60px / DM Sans, 16px | 16px / 24px | 1.6 / 1200, generous |

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
Each theme also sets the general looks every block reads (`heading`, `link`,
`tableBorder`, `codeSurface`, the heading weight and line height per level)
and, in `blocks`, the few block look tokens that carry its character; the
rest stays at each block's declared default.

The integrity gate checks every theme in light AND in its own dark mode:

- text pairs ≥ 4.5:1 — text and textMuted on background and card, and
  `textOnPrimary` on `primary`;
- the focus ring ≥ 3:1 on background and card. Each theme's ring comes from
  its own palette.

| theme | text on ground (light / dark) | muted text, worst ground | button ink on primary | focus ring, worst ground |
|---|---|---|---|---|
| base | 17.74 / 17.40 | 7.56 / 6.99 | 5.17 / 7.53 | 5.17 / 6.98 |
| zinc | 19.90 / 19.06 | 6.31 / 6.91 | 16.97 / 16.12 | 4.83 / 6.91 |
| paper | 15.14 / 15.10 | 6.70 / 7.48 | 12.65 / 9.43 | 4.79 / 9.38 |
| ember | 16.40 / 16.38 | 5.95 / 8.39 | 5.18 / 8.81 | 4.68 / 8.27 |

Links clear 4.5:1 on both grounds in both modes: base 6.70 / 9.84, zinc 6.70 / 8.48, paper 7.79 / 8.40, ember 5.19 / 8.27 (light / dark, worst ground).

## The heading scale hook

`text.heading` reads an OPT-IN override chain the theme may (but does not yet)
declare: `--pw-font-size-h1` … `--pw-font-size-h5`, each falling back to the
typography scale (`h1 → font-size-4xl` … `h5 → font-size-lg`). A theme that
wants a bespoke heading scale sets these; none of them currently do, and
that is a choice, not an omission.
