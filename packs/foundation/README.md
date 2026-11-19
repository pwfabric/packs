# Foundation

The floor of the catalogue: the atoms every PWFabric app stands on. Every
other pack requires it, directly or through another pack.

## Layout

The canonical pwpack folder (see `tools/lib/pack-layout.mjs`):

```
foundation/
├── pwpack.json      identity: id, version, requires, license (generated from
│                    pack-map.json by tools/apply-pack-map.mjs)
├── LICENSE, NOTICE  Apache-2.0
├── test/            the pack's tests (never shipped)
└── atoms/
    ├── blocks/        the core block vocabulary (manifest.json + component.tsx)
    ├── capabilities/  entities · persistence · navigation · interaction
    ├── appearance/    the six reference themes
    ├── patterns/      block arrangements (pure JSON, no code)
    ├── icons/         the icon dictionary (icons.json)
    ├── connectors/    the REST connector
    └── lib/           shared code: _shared-*, hooks, component-types and the
                       surface contexts
```

There is no `app/`: complete apps built from foundation are in
[pwfabric/examples](https://github.com/pwfabric/examples).

## Its place in the catalogue

`pack-map.json` declares the packs. Foundation alone gives a simple site;
`widgets` adds the occasional blocks. A pack may name the packs below it,
never the ones above, so foundation names nothing outside itself.
`tools/check-pack-map.mjs` holds the rule.

## Building and validating

`pnpm verify` at the repository root checks, validates, type-checks and tests
every pack. The `.pwpack` archive is written by the engine's packer (`pwf pack`;
`pnpm build` runs it for every pack through `tools/pack-all.mjs`).

## Versioning

`version` in `pwpack.json` is bumped by hand whenever the pack's content
changes; consumers pin to it.
