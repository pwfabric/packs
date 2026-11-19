# PWFabric packs

The two open packs every [PWFabric](https://github.com/pwfabric/pwfabric) app
is built from: `foundation`, the block vocabulary, and `widgets`, the
occasional blocks.

| Pack | Id | Stands on | What it carries | Licence |
|---|---|---|---|---|
| `foundation` | `@pwpack/foundation` | — | The core block vocabulary (layout, text, controls, forms, data, feedback, media), the top-bar, bottom-bar and chrome-less shells with their page parts, six reference themes, the icon dictionary, four capabilities and the REST connector. | Apache-2.0 |
| `widgets` | `@pwpack/widgets` | foundation | The occasional blocks, kept off the floor so an app that never places them never lists them: rich-text editor, file dropzone, tag input, combobox, slider, chart, month calendar, rating, map, carousel, video, embed, gallery, world clock, tree view, command palette and like button. | Apache-2.0 |

[`pack-map.json`](pack-map.json) is the source of these relations; each
pack's `pwpack.json` is generated from it.

## Using the packs

Each pack is released as a `.pwpack` file on this repository's
[releases](https://github.com/pwfabric/packs/releases). With the `pwf`
command line ([`@pwfabric/cli`](https://www.npmjs.com/package/@pwfabric/cli),
Node 22 or newer):

```sh
pwf create my-app --foundation foundation-1.0.0.pwpack
cd my-app
pwf add widgets-1.0.0.pwpack      # only when a page places a widgets block
pwf dev
```

Each pack is copied into the app's `.pwf/packs/` and pinned in its
`pwpack.json` by content hash, so `dev`, `build` and `run` work offline.
Complete apps built from these packs are in
[pwfabric/examples](https://github.com/pwfabric/examples).

## A pack folder

Every directory under `packs/` is one canonical pwpack folder (see the
pwpack format in the [PWFabric specification](https://github.com/pwfabric/spec)):

```
packs/<pack>/
├── pwpack.json    id, version, requires, licence — generated from pack-map.json
├── atoms/
│   ├── blocks/        manifest.json + component.tsx per block
│   ├── patterns/      block arrangements (JSON, no code)
│   ├── capabilities/ connectors/ appearance/ icons/
│   └── lib/           shared source; copies of floor helpers are generated
└── test/          the pack's tests (never packed)
```

## Working on the packs

| Command | What it does |
|---|---|
| `pnpm generate` | Write everything derived: `pwpack.json` files, licences, vendored helpers, icons, shell texts |
| `pnpm check` | The structural gates: the pack map, each pack's integrity (every block is placed by a pattern or rendered by a DOM test), references, imports |
| `pnpm validate` | The engine's pack validator on every pack |
| `pnpm typecheck` | Each pack against the packs it stands on |
| `pnpm test` | Block behaviour tests (Vitest, jsdom) and the tools' tests |
| `pnpm verify` | All of the above |
| `pnpm build [pack …]` | Write `.pwpack` archives into `dist/` |

A pack's `version` is bumped by hand whenever its content changes. A tag
`<pack>@<version>` releases that pack: CI verifies everything and attaches the
`.pwpack` and its sha256 to a GitHub Release.

## Licence

Both packs and the repository's tooling are under the Apache License 2.0
([`LICENSE`](LICENSE)); each pack carries its own `LICENSE` and `NOTICE`. The
icon artwork is Lucide (ISC) with five Feather-derived icons (MIT); see
[`packs/foundation/NOTICE`](packs/foundation/NOTICE).
