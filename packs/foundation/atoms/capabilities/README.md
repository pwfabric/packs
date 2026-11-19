# capabilities/ — custom capability atoms (SOURCE)

Add a new custom capability as `capabilities/<name>/handler.ts` (the
`defineCapability().build()` convention) + a sibling `manifest.json`
(`AtomFileManifest`, `kind: 'capability'`).

Capabilities are not part of the Vite dev-preview export today — Intranet's
capability calls (forms, data, auth) stay live against the original
PWFabric world. A capability authored here is for local/new behavior the
platform doesn't already provide; wire it into a page via
`SurfaceRenderer`'s `capabilities` prop (see `dev/src/pages/*.tsx`).

## JSON vs. TS convention

**Definitions and consumption are JSON. Only real executable logic is TS.**

- `manifest.json` → `configSchema` (field shapes: type/label/description/default/min/max/options) lives here, as plain JSON — NOT built with `defineConfigSchema()`'s TS fluent API. All 5 capabilities in this directory follow this.
- `surfaces/*.receipt.json` → how a given surface *uses* (configures) a capability instance — also JSON, in that surface's own `capabilities[]` array.
- `handler.ts` → only the real `execute()` logic (when there is any that actually runs — see caveat above about capabilities not being part of the client bundle today) and the `defineCapability()` chain that references the JSON manifest's other fields (id/name/description/tags/contract). No inline `defineConfigSchema()` calls.

## `entities` vs. `connector` — a real boundary, not just naming

`platform/entities` is for data that lives in **our own** store (schema-driven, CRUD, lifecycle hooks). It is never the right place for an external, read-only REST source — see `connector/` for that. `intranet/graph-connector` defines *how* to reach a real external SharePoint list (via Microsoft Graph, dynamic user-token auth, no backend involved); it composes with `platform/persistence`'s `DataService` for the actual fetch, and never touches `platform/entities`.
