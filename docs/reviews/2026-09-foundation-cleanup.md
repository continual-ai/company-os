# Foundation cleanup review (September 2026)

[Back to the README](../../README.md)

A structural review of `main` using the repository's [review skill](../../.agents/skills/review/SKILL.md)
and the pre-release policy in [AGENTS.md](../../AGENTS.md): clean current design over compatibility,
breaking changes allowed where they clearly simplify. This document recommends; it changes no behavior.

## Summary

The foundation is disciplined: Effect v4 layering is native (`Context.Service`, `Layer.effect`,
`Effect.fn`, `Data.TaggedError`), casts are rare and annotated (~66 `SAFETY` sites, three
`as unknown as` in the model layer, zero `any` in business code), there are no `TODO`/`FIXME`/`HACK`
markers, shared renderers never branch on a business object, and the satellite contract is tiny
and enforced. Debt here is structural, not annotated.

Three facts drive most recommendations:

- The kernel is ~8x the business it serves: `src/runtime` is 38k non-test lines, `src/modules`
  4.6k, `src/app` 9k. Every kernel edit is an upstream-merge cost for adopters (`tools/kernel-drift.ts`
  exists for exactly this).
- One portable schema ADT with 16 kinds is walked by roughly fourteen independent dispatchers across
  model, contract, storage, events, assets, forms, tables, and developer tools. Adding or changing a
  kind is a multi-file hunt with no compiler help.
- The HTTP transport uses Effect's statically keyed `HttpApi` to serve a data-driven model and pays
  for it with runtime class subclassing, path rewriting, and a dozen cast boundaries, while the MCP
  transport projects the same contracts in 160 direct lines.

Do first: items 1-5. Later: items 6-10. Every item lists the evidence, the direction, the blast
radius, and leverage.

## Do first

### 1. Collapse schema-kind fan-out behind one visitor and one presentation registry

Leverage: High. Risk: Medium (model, contract, storage), High (forms/table UI).

Problem. `AnySchema` in `apps/company-os/src/runtime/model/definition/schema.ts` has 16 kinds.
Independent walks or switches over `kind`/`format` exist in at least:

| Layer    | File                                                                                                                                       | Kind/format checks |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -----------------: |
| model    | `definition/schema.ts` (`containsRecordId`, `containsSecret`, `assertSecretStorage`, `assertSecretInput`)                                  |                 17 |
| model    | `definition/validate-model.ts` (`referencedTypeIds`), `query-fields.ts`, `model-lint.ts`                                                   |          6 / 6 / 5 |
| contract | `contract/schema.ts` (`compileBase`), `contract/object-input.ts` (identifier walk)                                                         |             18 / 6 |
| server   | `server/storage/schema.ts` (`propertySqlType`), `server/events/event-references.ts`, `assets/server/references.ts`                         |         18 / 9 / 3 |
| ui       | `ui/forms/schema-form-field.tsx`, `ui/forms/schema-form-values.ts`                                                                         |            51 / 52 |
| ui       | `ui/model/object-property-value.tsx`, `object-table/object-table-property.tsx`, `object-table-cell-types.ts`, `forms/operation-result.tsx` |    25 / 15 / 7 / 6 |
| app      | `app/ui/developer/model-explorer.tsx` (`propertyDetails`)                                                                                  |                 19 |

The table already has the right shape: `objectTableCellRenderers` in
`ui/model/object-table/object-table-cell.tsx` maps a resolved `ObjectTableCellType` to a component.
Forms, display, icons, filters, and the explorer never adopted it; `schema-form-field.tsx` is a
700-line `if` chain (secret, literal, optional, struct, union, json, boolean, recordId, enum, money,
assets, array, string formats). `MarkdownEditor` and `ScoreInput` are wired in both the form and the
cell paths.

The `media` kind is unused by any module or platform object (`file` has 5 usages, `image` 4,
`media` 0) yet appears at 18 sites in 11 files.

Why now. This is the dominant spaghetti-growth pattern in the repo, and it lives in the kernel that
adopters must merge against. Every new property format touches a dozen files.

Direction.

- Add one `foldSchema` (children + leaf) in `runtime/model/definition/` and rewrite the structural
  walks on it: `containsSecret`, `containsRecordId`, `assertSecret*`, `referencedTypeIds`, lint,
  `event-references`, `assets/server/references`, `object-input` identifier resolution.
- Keep the two compile targets (Effect codec, SQL type) as separate files, but drive their child
  enumeration through the same fold.
- Add a UI presentation registry keyed by a resolved presentation type (extend
  `objectTableCellType` or a shared `resolvePropertyPresentation(schema)`) that supplies `editor`,
  `display`, `icon`, `filterFamily`, and `parseInput`. Point `schema-form-field`,
  `schema-form-values`, `object-property-value`, `object-table-property`, and the explorer at it.
  Surface-specific chrome stays outside the registry. A typed `Record<ResolvedType, Presentation>`
  is enough; do not build a plugin framework.
- Delete the `media` kind.

### 2. Decide the HTTP transport: stop bending `HttpApi`, or commit and upstream the fix

Leverage: High. Risk: High (transport, generated client, OpenAPI reference, tests).

Problem. The MCP projection (`runtime/server/mcp.ts`, 160 lines) walks `operationContracts(model)`
and emits tools with `Schema.toStandardJSONSchemaV1`. The HTTP projection of the same contracts is:

- `runtime/contract/http-api.ts` builds `HttpApi` groups dynamically behind three
  `as unknown as DynamicHttpApi` casts because "Effect's group union is phantom state".
- `runtime/contract/http-custom-method.ts` (144 lines) subclasses `HttpApiGroup`/`HttpApi` at
  runtime (`class ProjectedGroup extends group`) and rewrites Google-style `resource:verb` paths three
  ways: `::verb` for the builder, `/:id([^/]+)::verb` for FindMyWay, `/~verb` for OpenAPI, then a
  regex pass restores `:verb` in the generated document. Its own comment: "Effect beta.107 interprets
  literal colons differently in the router, client, and OpenAPI."
- `runtime/server/http.ts` casts every group's handlers through `DynamicHandlers` and
  `CompleteHandlers`.
- `app/server/http-api.ts` post-processes the OpenAPI document again (`documentIdentity`).
- `app/server/transport/http-transport.ts` wraps the resulting web handler in
  `Effect.tryPromise` and reaches into `HttpEffect.appendPreResponseHandlerUnsafe` with a cast to
  attach `x-model-changes`.

Twelve `SAFETY` casts sit on this path; the MCP path has two.

Why now. This is the clearest pre-release workaround debt in the repo: it exists to make a beta
router agree with itself, and it is the main reason an Effect upgrade is expensive. It also blocks
item 4 (the generated client in `runtime/client/http-client.ts` is built on `HttpApiClient` against
the same dynamic api).

Direction. Two coherent options; pick one.

- Drop `HttpApi` for the model surface. Route from `operationContracts(model)` with a plain
  `HttpRouter` (one handler per contract, path from `http-operation.ts`), emit OpenAPI from the same
  contracts through the standard JSON Schema projection MCP already uses, and derive the browser
  client from contracts the way `object-client.ts` already does. `http-custom-method.ts`,
  `documentIdentity`, and most casts in `http.ts`/`http-api.ts` disappear. Keep `HttpApi` only for
  the three hand-written event endpoints if useful.
- Or keep `HttpApi`, upstream the colon-path fix to Effect, and delete `http-custom-method.ts` when
  it lands. Until then, freeze this path and add nothing to it.

### 3. Give the write path one vocabulary: three "repositories", two registries, two upserts

Leverage: High. Risk: Medium.

Problem. A standard create passes through three layers that are all called "repository":

| File                                          | Exported as       | Owns                                                       |
| --------------------------------------------- | ----------------- | ---------------------------------------------------------- |
| `runtime/server/repository.ts`                | `makeRepository`  | decode, alias resolution, secrets, immutability, link plan |
| `runtime/server/storage/record-store.ts`      | `trackRepository` | transaction, events, asset references, deletion changes    |
| `runtime/server/storage/object-repository.ts` | `makeRepository`  | SQL select/insert/update/delete/list                       |

Both `Database` (`runtime/server/database.ts`) and `RecordStore` build a `Map<objectId, repo>` over
every object; `Database.repository` is the public API and `RecordStore.get` the internal one, yet
`runtime/access/server/*` and `runtime/assets/server/*` reach past `Database` to `RecordStore`
directly.

Inside `object-repository.ts` the alias-claim block (insert aliases, select owners, fail on
conflict) is copied three times as `ownersFields`, `ownersFields2`, `ownersFields3` (lines
~507-533, ~593-619, ~683-709).

There are two upsert semantics: `repository.ts` upserts by alias under an advisory lock and journals
events; `makeObjectSeedRepository` in `record-store.ts` upserts by id with `ON CONFLICT` and
journals nothing (used by `runtime/access/server/seed.ts`).

Two more clones: `resolveIdentifier` in `runtime/contract/object-input.ts` reimplements
`RecordIdentifiers.resolve` (`runtime/server/storage/identifiers.ts`) with an injected resolver,
and `runtime/server/storage/interface-query.ts` (176 lines) reimplements the object list loop
(cursor fingerprint, `relatedTo` edge filter, `limit + 1`) from `object-repository.ts`.

Why now. This is the path every write takes and the first thing a new contributor opens. Today
they meet three files with the same name and must guess which altitude journals events or applies
links.

Direction. Rename by responsibility (`object-operations.ts` / `record-store.ts` /
`object-persistence.ts`, or similar), make `RecordStore` private to `Database` so there is one
registry and one public entry, extract `claimAliases(id, aliases)`, route system seeds through the
alias upsert so there is one upsert, delete the contract-side `resolveIdentifier` in favor of
`RecordIdentifiers`, and share one list executor between object and interface queries.

Note on transactions. Nested `database.transaction` calls join the enclosing transaction
(`storage/transactions.ts`), so the wrappers in `repository.ts`, `record-store.ts`, and
`link-writes.ts` are correct and needed for callers outside an operation (controllers). Do not
remove them; do document the join rule once at `Database.transaction`.

### 4. Make the kernel/system-module boundary real: `runtime/{access,assets,platform}`

Leverage: Medium-High. Risk: Medium-High (import churn, lint rule, knip entrypoints).

Problem. Three directories under `runtime/` are shaped like business modules
(`model/server/ui/seeds`) and compose into one `PlatformModule`
(`runtime/platform/model/index.ts` imports `runtime/access` and `runtime/assets`). They are neither
kernel nor module:

- The kernel imports them 28 times (`runtime/server/operation-executor.ts` and
  `controllers/runtime.ts` import `platform/server/activation.ts`; `record-store.ts` imports
  `assets/server/asset-references.ts`; `services.ts` imports `assets/server/blob-storage.ts`;
  `auth/authentication.ts` imports `access/server/*`; `ui/model/*` imports `assets/ui/*` and
  `platform/ui/controller-diagnostics.tsx`).
- They import kernel storage internals (`RecordStore`, `SqlDatabase`, `storage/index.ts`,
  `storage/infrastructure.ts`) that the customize skill calls "kernel implementation details".
- `tools/oxlint/company-os/rules/import-boundaries.ts` special-cases their paths
  (`runtime/access/model/`, `/^runtime\/[^/]+\/server\//`), and `package.json` knip lists their
  `model/index.ts` as extra entrypoints.

Why now. AGENTS.md says "Runtime never imports business modules" and "Identities, Assets, and
Platform stay enabled." The tree currently says both "these are the kernel" and "these are modules,"
so every rule about the boundary needs an exception.

Direction. Split by who needs it. Kernel-required behavior moves into `runtime/server` proper:
module activation (`activation.ts`), actor identity and authentication, asset references and blob
storage. Everything that is a business capability with records and pages (Note, Connection,
Connector/Controller registry UI, module settings page) becomes an ordinary always-enabled module
under `src/modules/platform` (and `modules/identity`, `modules/assets` if the split earns it). The
lint rule then needs no `runtime/<x>/model` exceptions and knip needs no extra entrypoints.

### 5. Remove scaffolding from shipping paths and default the module UI

Leverage: Medium. Risk: Low.

Problem. Several pieces read as demo or prototype in a repo whose policy is "ship modules for real
production use":

- `modules/product/model/issue-greeting.ts` and `server/issue-greeting.ts`: a "Hello world" note
  controller registered in the Product module.
- `app/customization/workspace.ts` and `workspace-pages.tsx`: Tools and Reports navigation
  "prototype; no tool execution is connected", routed under `/_app/tools` and `/_app/reports`.
- `modules/marketing/server/` contains only a 9-line standalone test and no `index.ts`.
- Module business tests live in the shell: `app/server/integration/hiring-operations-*`,
  `sales-operations-*`, `marketing-audience-*` (~300 lines), while the customize skill points
  authors at module-adjacent tests such as `modules/sales/server/operations-database.test.ts`. Sales
  coverage is therefore split across two homes.
- Per-object UI registration is mostly ceremony: 22 `ui/<object>/config.ts` files, 16 of them 30
  lines or fewer, 15 of 21 object folders holding only `config.ts`;
  `modules/sales/ui/line-item/config.ts` is 6 lines to say `navigation: { hidden: true }`.
  `composeModelUi` already treats every object's UI as optional.

Direction. Delete the greeting controller and the prototype pages (or move them under
`developer/`). Move module tests into their modules; keep `app/server/integration` for activation,
admission, transport, and cross-module scenarios. Add a convention default: an "All {plural}" view
from model property order, so `ObjectUi` is written only for non-defaults; collapse one-liner
folders into a single `ui/objects.ts` per module until a file earns its own directory.

## Later

### 6. Move the design-system gallery out of the product app

Leverage: Medium. Risk: Low.

Problem. `app/ui/developer/design-system/` is ~2.5k lines of `@company/ui` showcase; the developer
tree is ~4.6k lines in total, in the deployable. The gallery documents `packages/ui`, which AGENTS.md
names as the sole shared library, yet it lives in the app that consumes it.

Direction. Move the gallery next to its subject (a dev-only entry in `packages/ui`, or a docs
route bundle excluded from the product build). Keep the model explorer, OpenAPI, and MCP pages; they
document the running instance.

### 7. Collapse the dual object worlds and the compile matrix in the contract layer

Leverage: Medium. Risk: High (client, server, UI types).

Problem.

- `ObjectRecord`, `ObjectCreateInput`, and `ObjectUpdateInput` in
  `runtime/model/definition/object.ts` fork on `M extends ModelCatalog | undefined`: an "object
  alone" mode with an untyped `links` bag and a "composed model" mode with typed links. Every caller
  must know which mode it is in; `defineObject` and `defineModel` end with `as unknown as`.
- `schema.ts` carries four recursive inference lattices over the same AST (`InferSchema`,
  `InferRecordSchema`, `InferUpdateSchema`, `InferInputSchema`) and `contract/schema.ts` compiles
  with four `CompileMode`s.
- `contract/schema.ts` exposes six object-shaped compilers
  (`toEffectObject{Create,Update}Schema`, `toEffectObjectWriter{Create,Update}Schema`,
  `toEffectModelObject{Create,Update}Schema`); the `aliases`/`etag`/`metadata` field block is
  repeated four times. This is a 2x3 matrix (public/writer x with/without links) written out by hand.
- `ObjectFilter` and `CanonicalObjectFilter` in `definition/request.ts` are near-clones differing by
  alias vs canonical id, and the typed filter union carries a `${string}.${string}` escape hatch
  that makes the typing advisory.

Direction. Model-bound record and input types become the only public ones; unbound `ObjectType`
stays for authoring. One filter type, with alias resolution as a decode step. One object compiler
parameterized by `{ audience: "public" | "writer", links: boolean }`. Collapse the inference
lattices to "decoded value" plus explicit secret-presence and alias-widening transforms at the
boundary. Do this after item 1 so the visitor exists.

### 8. Decompose the eight files over 600 lines and fold the flat UI directory

Leverage: Medium. Risk: Low (pure moves) if done as separate commits.

Problem. `schema.ts` 937, `object-table-cell.tsx` 914, `model-explorer.tsx` 918,
`object-repository.ts` 849, `contract/schema.ts` 829, `schema-form-field.tsx` 716,
`object-table-filter.tsx` 655, `object-collection.tsx` 609. `runtime/ui/model/` holds 93 files flat
with the grouping already encoded in prefixes (distinct stems: `object-*` 33, `collection-*` 13,
`record-*` 10, `use-*` 4); only `object-table/` is a folder. `ModelRecordPage`/`ModelCollectionPage` in
`model-pages.tsx` resolve `useObjectUi` and forward a dozen knobs into `ObjectRecordPage` and
`ObjectCollection`, which could read the hook themselves.

Direction. Split along existing function boundaries (`schema-brands`, `schema-definition`,
`schema-walk`, `schema-builders`; `object-repository/{read,write,select}`; cells into
`object-table/cells/*`). Group `ui/model` into `module/`, `collection/`, `record/`, `forms/`,
`references/`, `table/`, `hooks/`. Let page components call `useObjectUi` directly. Do the UI moves
after item 1 so files are split once.

### 9. Remove duplicated validation in the model definition layer

Leverage: Low-Medium. Risk: Low.

Problem. `defineModel` runs `assertLinksResolvable` (which already rejects duplicate traversal keys
and property/method conflicts) and then `assertRelationshipNamesUnambiguous` over the same conflict
set (`definition/model.ts` ~366, `validate-model.ts` ~203-246 and ~289). `objectTypeAccepts` in
`validate-model.ts` duplicates `modelTypeAccepts` in `model.ts`. Display-role checks (`image` must
be an image kind, `status` an enum) are copied between `object.ts` and `interface.ts`.
`isRecordAlias` tests only for `:` while the `RecordAlias` brand requires a pattern and length, so
the type predicate lies. `fieldOperators` in `query-fields.ts` and the `PropertyFilter` type in
`request.ts` encode the same kind-to-operator table twice.

Direction. One accepts helper, one relationship-namespace assertion, one `assertDisplayRoles`, one
operator table that the type derives from, and `isRecordAlias` implemented on the brand's
refinement.

### 10. Keep the pinned-dependency patches on a leash

Leverage: Low-Medium. Risk: Medium at every Effect bump.

Problem. Three pnpm patches (`effect@4.0.0-beta.107` release-savepoint,
`@effect/sql-pg@4.0.0-beta.107` cancel-safe pool reserve, `nitro@3.0.260610-beta` dev asset
middleware), a `shiki/wasm` alias, and a vendor `allowedHosts` list in
`apps/company-os/vite.config.ts` (tensorlake, e2b, daytona, modal). All are documented in
`patches/README.md`; none has a linked upstream issue in the repo.

Direction. Link each patch to an upstream issue or PR in `patches/README.md`, re-run the
regression tests named there on every bump, and move the vendor host list to environment-only
configuration so the open-source checkout carries no hosting-provider names. Item 2 decides whether
the HTTP path stays sensitive to router changes; item 3 keeps transaction ownership legible so the
savepoint patch can be re-evaluated rather than inherited.

## Temporary workaround debt (explicit list)

Nothing is marked `TODO`; these are the places where pre-release haste left a shape that will
otherwise become permanent:

- `runtime/contract/http-custom-method.ts` and `app/server/http-api.ts#documentIdentity`: three
  path encodings and a document post-pass to make one beta router agree with itself (item 2).
- The three pnpm patches, the shiki alias, and vendor `allowedHosts` (item 10).
- `media` schema kind with zero usage and 18 dispatch sites (item 1).
- `makeObjectSeedRepository`: a second, non-journaling upsert path for system records (item 3).
- `resolveIdentifier` in the contract layer duplicating `RecordIdentifiers` (item 3).
- `issue-greeting` controller and the Tools/Reports navigation prototype (item 5).
- `runtime/{access,assets,platform}` as module-shaped kernel directories with lint and knip
  exceptions (item 4).

## What not to do

- Do not replace the Effect layering. `foundation.ts`, `services.ts`, `application-layer.ts`, and
  `application-runtime.ts` are idiomatic v4 and small; collapsing them saves little.
- Do not split the app into workspace packages to replace the import-boundary lint. The rule is
  tested, single-purpose, and matches the stated "apps are deployable packages" constraint.
- Do not remove Effect Cluster from controllers. `controllers/runtime.ts` is dense but proportionate
  to durable per-key reconciliation; extract named effects inside it instead.
- Do not replace the portable schema AST with Effect Schema in one pass. Browser-safe, serializable
  model descriptions are load-bearing for the explorer, OpenAPI, and MCP. Item 1's visitor and item
  7's type collapse capture most of the value at a fraction of the risk.
- Do not touch the satellite contract (`company-os/model`, `company-os/client`,
  `company-os/config`). It is small, enforced, and correct.
