# Architecture review: Company OS

This is the review snapshot before implementation. See [the implementation record](FOUNDATION-IMPLEMENTATION.md)
and the current architecture/module guides for the resulting design.

Date: 2026-09-08. Branch: `codex/company-os-foundation`, reviewed against the **working tree**, not
HEAD. Purpose: a ranked list of changes that simplify the code organization and give a cleaner
foundation before release. Written so an agent with no prior context can pick up any item.

## How to read this

- Every item has **Problem**, **Evidence** (paths and line numbers as of this review; re-verify
  before editing), **Change**, and **Effort** (S under a day, M a few days, L a week or more).
- Items are ranked by impact on the goal "a simple, idiomatic-Effect-v4 foundation that humans and
  agents can extend quickly". Item 1 is ranked first for data-safety, not architecture.
- Paths are repo-relative. `runtime/` means `packages/runtime/src/`. `app/` means
  `apps/company-os/src/`.
- Repository rules live in `AGENTS.md` (`CLAUDE.md` is a symlink to it). Follow them while
  implementing; several recommendations below also propose edits to `AGENTS.md`.

## State of the tree when reviewed

The tree is mid-refactor: 535 files changed versus HEAD, about 49k lines deleted. `packages/ui`,
`packages/postgres`, and `runtime/definition` were folded into one `@company/runtime` package with
four surfaces (`/model`, `/server`, `/client`, `/ui`). Domain modules moved from
`app/modules/<domain>` to workspace packages under `modules/<domain>` (`@company/sales`,
`@company/engineering`, `@company/marketing`, `@company/notes`). One app-local module remains
(`app/modules/support`). Access and Assets moved into the runtime.

Size snapshot (TypeScript, tests included):

| Area             | Lines   | Files                                                                    |
| ---------------- | ------- | ------------------------------------------------------------------------ |
| `runtime/ui`     | ~20,000 | ~150 (49 shadcn components, 78 flat `ui/model` files, 17 `object-table`) |
| `runtime/server` | ~11,200 | 78                                                                       |
| `runtime/model`  | ~6,500  | 45                                                                       |
| `runtime/client` | ~3,700  | 15                                                                       |
| `app/`           | ~18,200 | 177 (of which `ui/developer` ~4,100)                                     |
| `modules/*`      | ~3,000  | 66                                                                       |

Effect v4 usage is consistent: 27 `Context.Service` classes using `Context.Service(..., { make })`
with `static readonly layer = Layer.effect(this, this.make)`, named `Effect.fn` operations, no v3
patterns (`.Default`, `Context.Tag`, `Effect.Service`, `Live` suffix). There is no v3 debt to unwind.

## Decision: modules as packages, not app folders

**Keep `modules/<name>` workspace packages. Delete the app-local module form.**

Why:

- Package ceremony is small: about 50 lines (`package.json`, `tsconfig.json`, README,
  `src/*/index.ts`) against 150 to 250 lines of business definitions per module.
- Packages buy a dependency graph enforced by pnpm and `turbo boundaries`, isolated
  `pnpm --filter @company/sales test`, and a directory an agent can read top to bottom.
- The app-local form is already worse: `app/modules/support/ui/ticket/config.ts` and
  `reply/config.ts` type themselves as `ObjectUi<typeof Model.objects.ticket>` by importing
  `#/app.config.ts` (the environment-reading composition root) instead of their own object
  definitions, so the module cannot be copied out. Its private imports are spelled
  `#/modules/support/model/ticket.ts` instead of `#/model/ticket.ts`, so identical code has two
  spellings depending on where it lives.
- What makes modules feel heavy is the runtime behind them, not packaging. Modules import 21
  distinct `@company/runtime/*` subpaths in non-test code and 13 in tests. Adding a full module
  touches six app files (`package.json`, `app.model.ts`, `app.ui.ts`, `app.server.ts`,
  `profiles/*.server.ts`, `app.model.test.ts`), three of which are bookkeeping. Items 4 through 8
  fix that.

Prior art the maintainer asked about:

- **Odoo** confirms the per-surface addon layout (`models/ views/ data/`). Its manifest `depends`
  is your `package.json` dependency, which makes `requires` (item 6) a redundant copy. Its bridge
  modules (`sale_crm`) are the right pattern for optional cross-domain links.
- **WordPress** hooks with `function_exists` guards are exactly the `Object.hasOwn(Model.modules,
"sales")` checks in `app.server.ts`, `app.ui.ts`, and `profiles/*`. The repo's own rule against
  dynamic discovery argues for removing them (item 4).
- **DeepSeek Harness / Cordis** is a dynamic plugin tree of hundreds of micro-packages with runtime
  load and unload. It solves runtime replaceability, which `AGENTS.md` explicitly rules out. The
  transferable lesson is one typed contribution contract per extension point, not package
  granularity.

## Ranked recommendations

### 1. Make the storage baseline real (M)

**Problem.** There is no committed migration. The baseline is regenerated from the model every time
migrations run, and the migrator records only the migration _name_. After a database has migration
1, any later change to a property, index, or column produces a runtime whose SQL no longer matches
storage, and nothing at boot, deploy, or `db:check` notices. This is the only finding that can
silently corrupt a customer's data.

**Evidence.**

- `app/server/database/migrations.ts:32-46`: `Migrator.fromRecord({ [\`1_${baselineName(model)}\`]: ... sql.unsafe(makeSchemaSql(model)) })`.
- `migrations.ts:49-70`: `verifyDatabaseModel` compares only `baselineName`, which is
  `initial_<sorted module ids>`.
- `app/schema.sql` (tracked, 425 lines) is only a diff target for `tools/generate-db-schema.ts:8-12`;
  it proves the file is current, not that any database is. It currently reflects the `minimal`
  profile (24 tables, no business tables).
- `app/server/database/migrations/0001_initial.sql` (1,121 lines at HEAD) is deleted in the working
  tree. `app/server/database/migrations/`, `app/generated/`, `app/server/generated/` are empty dirs.
- `migrations-database.test.ts:13-24` only proves replay equals declared on a fresh database, and
  requires `pg_dump` on PATH (`.github/workflows/ci.yml:54-62`).

**Change.** Pick one:
(a) Commit generated DDL as the frozen numbered baseline; make `db:check` fail with "baseline is
frozen, add a migration" once it exists. Or
(b) Record a content hash of the generated DDL alongside migration 1 and refuse to serve (or fail
`db:migrate`) on mismatch.
Either way delete the three empty directories and replace the `pg_dump` comparison with an
`information_schema` / `pg_catalog` query so CI needs only the service container.

### 2. Collapse the object write path to one governed service and one transaction (L)

**Problem.** A standard create passes through five modules and opens three nested transactions
(savepoints). The generic `object-service.ts` exists so it can be unit-tested with hand-rolled
callbacks, but its real dependencies are already Effect services, so the callback parametrization
duplicates what `Context.Service` provides.

**Evidence.**

- Transaction nesting per HTTP action: `app/server/transport/http-transport.ts:70`
  (`database.transaction(() => run)`) → `runtime/server/model/object-service.ts:101,127` →
  `runtime/server/database/object-repository.ts:52,76,130,166`.
- `runtime/server/object-service.ts` (634 lines): `make` has 7 type parameters (lines 475-634),
  `makeWriteMethods` has 8 (309-436), six `no-unsafe-type-assertion` suppressions.
- `runtime/server/model/object-service.ts:42-143` yields `Authorization`, `RecordIdentifierResolver`,
  `Database`, `Links`, wraps a governed repository (67-80), then passes `authorize`, `visibleWithin`,
  `resolveRecordAliases` back in as callbacks (81-86), then re-wraps create/update in another
  transaction with three `as unknown as` casts (97-139).
- `runtime/server/database/object-repository.ts:26-149` is a decorator adding another transaction for
  events, search, and asset references.
- `runtime/server/model/object-repositories.ts:13-53` (`Records`) maps objects to decorated repos and
  calls `makeWriter` with the same option bag again (47-51).
- `runtime/server/object-repository.ts` holds the `Repository` interface and 9 error classes; the
  only implementation is Postgres.
- Same shape for links: `runtime/server/link-service.ts:376-417` (8 type params, callback options)
  bound only by `runtime/server/model/link-service.ts:117-197`. `trackedLinkRepository` (24-115)
  snapshots the whole link family before and after each mutation because the repository does not
  report what it changed. `makeLinkWriter` (200-211) is an Effect value, so modules write
  `yield* makeLinkWriter` while records use `records.writer(Lead)` (see
  `modules/sales/src/server/convert-lead.ts:44`).

**Change.** Make `runtime/server/model/object-service.ts` _the_ implementation: yield the services
directly inside `Effect.fn` methods, delete the `MakeOptions`/`WriterOptions` callback surface in
`object-service.ts`, and fold the tracking decorator into `ObjectRepositories.make`. Keep
`postgres/object-repository.ts` as the SQL layer. Keep the `Repository` interface only if a second
implementation is actually written. Do the same for links: one `Links` service with
`list/link/unlink/initialize/update` plus `Links.writer` mirroring `Records.writer`, and have the
Postgres link repository return the edges it inserted or removed. Expected result: two or three files
and several hundred lines removed, one transaction per write, five or six fewer casts.

### 3. Move the invoke boundary into the runtime and share it between HTTP and MCP (M)

**Problem.** Authorization, invocation context, transaction-for-actions, and error mapping are
assembled in the HTTP transport. MCP does not wrap actions in a transaction and runs outside the
managed runtime, so a custom action that does two writes is non-atomic when called through MCP.

**Evidence.**

- `app/server/transport/http-transport.ts:70`: only place actions get a transaction.
- `app/server/transport/mcp-transport.ts:60-70`: provides `CurrentInvocation` then bare
  `Effect.runPromise` (loses config provider, tracing, interruption).
- `runtime/server/events/event-buffer.ts:29-32` dies when `PendingEvents` is absent, so events are
  protected but plain writes are not.
- `Authorization` exposes `require`, `requireOperation`, `requireOperationFor`, `visibleWithin`,
  `readableScopes`, `checkCapabilities(For)` (`runtime/server/authorization/authorization-service.ts:213-334`);
  `require` and `requireOperation` differ only in how the permission id is derived (216 vs 232).
- `Records.writer` deliberately skips authorization (`runtime/server/object-service.ts:438-442` doc
  comment). `modules/sales/src/server/convert-lead.ts:96-102` creates Company and Contact with only
  `lead.convert` and `lead.get` checked. Legitimate policy, but invisible at the call site.
- `CurrentInvocation` is defined inside the 634-line `object-service.ts:67-70` and imported by 17
  files. `runtime/server/events/event-writer.ts:63` uses `Effect.serviceOption(CurrentInvocation)`
  and then dies when absent.
- `CommittedChanges` (an HTTP `x-model-changes` header concern) leaks into `Database.transaction`
  (`runtime/server/database/database.ts:40-44`).

**Change.** Add one runtime `runModelOperation` (decode → authorize → `CurrentInvocation` →
transaction if action → `withApiErrors`) used by both transports. Make nested `Database.transaction`
join the parent instead of opening a savepoint. Merge `require` and `requireOperation` into one
method taking `{ objectType, operationId }`. Move `CurrentInvocation` to
`runtime/server/invocation.ts` merged with `invocation-context.ts`; require it and provide
`systemInvocation` explicitly where needed. Document the writer-bypass convention in
`docs/modules.md` next to the `convertLead` example, or require an explicit marker such as
`records.writer(Company, { authorizedBy: "lead.convert" })`. Capture `Effect.runtime` in the MCP
transport's `make` instead of calling `Effect.runPromise`.

### 4. Delete the build-time `APP_PROFILE` mechanism (M)

**Problem.** Profiles are a second axis of variability that exists only to demo the template three
ways. Types are the widest profile while runtime is the narrowest, so `Model.objects.lead`
type-checks in `minimal` and is `undefined` at runtime. Every profile still bundles every module's UI
and server code. "Start from scratch" versus "build on modules" is a fork-time decision, not a
per-build one.

**Evidence.**

- `app/app.model.ts:19-29` three lists and `createAppModel<P>`; `app/app.config.ts:18-19` reads
  `process.env.APP_PROFILE` substituted by Vite `define` (`app/vite.config.ts:32-36`).
- `turbo.json` `globalEnv: ["APP_PROFILE"]`; `app/package.json` `"test": "APP_PROFILE=demo vitest run"`
  (tested model and built model differ by environment).
- `app/server/database/migrations.ts:47` baseline name embeds the module list; seed receipts embed it.
- Eight guards: `app/app.server.ts:10`, `app/app.ui.ts:25`, `app/profiles/demo.server.ts` ×4,
  `app/profiles/performance.server.ts` ×2. `app/app.server.ts:12-15` also does
  `Layer.mergeAll(serverModules[0]!.layer, ...)` assuming a non-empty list.
- The guards match by `module.id` while `composeModelUi` (`runtime/ui/model/module-ui.tsx:114`) and
  `defineModuleServer` (`runtime/server/model/module-server.ts:75`) match by object identity, so a
  duplicated package instance passes the filter and then throws.
- Tests that exist only for this: `app/app-profile.test.ts`, `app/server/database/app-profiles-database.test.ts`.

**Change.** One `modules: [...]` array in `app.model.ts`. Starting from scratch means the array is
`[AccessModule, AssetsModule]` (or empty once item 6 lands). Delete `app.config.ts`'s environment
read, the Vite `define`, the `turbo.json` env, the baseline-name coupling, the `.filter(...)` calls,
the seed-scenario early returns, and the two profile tests. Keep `defineModel` as a pure factory so
tests can compose subsets (`app/module-composition.test.ts` already does this without profiles).
Change both install checks to compare by id.

### 5. Type the module server seam and remove the forwarding layers (M)

**Problem.** `defineModuleServer` validates a good typed input, then erases it to
`Record<string, object>` and snapshots infrastructure context at layer construction. Any operation
whose requirements are not in that snapshot fails at runtime instead of compile time. Three more
files exist only to merge and re-validate that untyped map.

**Evidence.**

- `runtime/server/model/module-server.ts:54-123`: result is `Record<string, object>` (98);
  `Effect.context<Exclude<Requirements<A>, CurrentInvocation>>()` + `Effect.provideContext` (49,
  81-84). `Requirements<A>` (26-34) recursively infers `R` from nested function types.
- `runtime/server/module-services.ts:4-7`: `ModuleServices` is `Context.Service<..., Record<string, object>>`,
  duplicates detected by string key at runtime (19-20).
- `runtime/server/model/implementation.ts:24-31` merges via `Reflect.get`;
  `runtime/server/model-implementation.ts:96-122` re-validates every descriptor is a function.
- `app/server/model/model-implementation.ts` is a pure forwarding `Context.Service` around
  `makeModelImplementation(Model)` with service id `"@app/ModelImplementation"`.
- App composition needs four layers for this: `app/app.server.ts:9-18`,
  `app/server/application-services.ts:22-41`.

**Change.** `defineModuleServer` returns a `Layer<ModuleContribution>` whose value is the typed
overrides (no erasure, no context capture; let `R` stay open and be satisfied by the transport's
runtime). Provide a runtime-owned `ModelImplementation` service that yields all contributions and
builds the dispatch map once. Delete `module-services.ts`, `model/implementation.ts`, and the app's
`server/model/model-implementation.ts`. Accept a plain object as well as an Effect for
implementations so simple modules do not write `Effect.succeed({...})`.

### 6. Name Access and Assets as kernel; drop `requires`; use bridge modules (M)

**Problem.** Access and Assets are `defineModule` contributions that modules `requires`, but the
runtime cannot function without them, so the optionality is fiction and every module pays for it
(`requires: ["access"]`, `parent: Root`, `actor: Actor` on every `defineModel`). Meanwhile `requires`
cannot express the one thing modules actually need: optional integration.

**Evidence.**

- `runtime/server/authorization/authorization-repository.ts:3-6` imports `GroupMembership`,
  `RoleAssignment`, `Role`; `runtime/model/system-records.ts` and `runtime/model/access/ids.ts`
  hardcode IDs; `defineModel` requires `actor` from Access.
- Assets: `runtime/server/database/object-repository.ts:4-5` and `runtime/server/model/object-service.ts:12`
  import asset-reference compilation; `runtime/server/database/schema.ts:26-61` declares
  `asset_blobs` and `asset_references` referencing `assets(id)` in the infrastructure DDL, so a model
  without `AssetsModule` cannot migrate. `app/app.model.ts:16`: `foundation = [AccessModule, AssetsModule]`.
- `requires` is redundant: `runtime/model/definition/model.ts:462,598,666` already throw on
  unregistered reference, interface, and link endpoint types. It is inconsistently maintained
  (engineering declares `["access","notes"]`; notes, whose `Note.parent = Root`, declares nothing).
- `SupportModule` hard-requires engineering solely to own the `TicketIssues` link
  (`app/modules/support/model/links/ticket-issues.ts`).
- Generics that exist only to thread Root/Actor: `ObjectType` has 10 type parameters
  (`runtime/model/definition/object.ts:125-163`), two phantom `unique symbol` slots (45-46, 60, 142).
  `defineObject`'s declared return (359-370) and its cast (499-510) disagree on the 7th parameter.
  `runtime/model/access/ids.ts` already hardcodes `ActorId` as a three-member union and
  `invocation-context.ts:50-72` casts to it anyway.
- Zero uses of `defineRoot`, `defineError`, or `uniqueBy` outside the runtime.
- Stale: `app/modules/assets/**/*.test.ts` (sources deleted, tests remain); `app/modules/notes/` empty.

**Change.** Move Access and Assets to `runtime/model/core/` (always installed, not module
contributions). Make `Root` and `Actor` constants; drop `defineRoot`, the `RootType` generics, the
`actor` parameter on `defineModel`, and the phantom generics (type `createdBy`/`updatedBy` as
`ActorId`, `parent` as `RecordId`). Fix the mismatched return type. Remove `requires` and improve
the missing-type error to name the owning module. For optional cross-domain links, create bridge
modules (for example `modules/support-engineering` owning `TicketIssues`) so Support composes
without Engineering. Delete the stale test directories. If Assets must remain optional, put its
repository hooks behind a registered extension and its two tables in a module-owned storage
contribution; do not leave it half-and-half.

### 7. One module layout, one module form, one generator (S)

**Problem.** Three layouts coexist and the docs describe a fourth. Ceremony is copy-pasted and
already drifting.

**Evidence.**

- Domain packages: per-surface `src/{model,server,ui,seeds}/` (enforced by `moduleLayout` in
  `tools/oxlint/company-os/rules/package-boundaries.ts:137-161`).
- Runtime: per-object inside surface, `runtime/model/access/<object>/model.ts`,
  `runtime/ui/access/<object>/ui/config.ts`; `runtime/model/assets.ts` as one file.
- Stale docs: `README.md:75-85` lists nine paths that do not exist (`modules/sales/src/model.ts`,
  `lead/model.ts`, `lead/server/convert.ts`, ...); `README.md:157,170` says business modules live in
  `app/modules`; `docs/architecture.md` says "Each module can expose `model.ts`, `server.ts`, and
  `ui.ts`"; `docs/collections.md:12` imports `defineCollectionView` from a file that does not define
  it; `docs/data.md:27` names three deleted app files; `apps/company-os/README.md` lists deleted
  `src/data-client.ts`; `app/tools/check-model-boundaries.ts` still special-cases `/(server|ui)\.ts$`.
- Drift: `@tanstack/react-query` pinned `5.102.8` outside the catalog in `modules/sales/package.json`
  and `app/package.json`; `effect` is a devDependency in engineering and marketing though their
  `seeds/index.ts` import it at runtime; notes has no `test` script; tsconfig `exclude` differs.
- Sales assembles Lead UI in three places (`ui/lead/config.ts`, `ui/lead/views.ts`, and
  `ui/index.ts` spreading `{...leadUi, actions}` and `{...dealUi, collection: {...toolbarComponent}}`);
  engineering and marketing keep everything in each object's `config.ts`.

**Change.** Standardize on per-surface: `model/<object>.ts`, `model/links/*.ts`,
`server/<operation>.ts`, `ui/<object>/config.ts`, `seeds/*.ts`. Flatten
`runtime/ui/access/<object>/ui/config.ts` to `ui/access/<object>/config.ts` or move the whole
kernel to the same shape. `git mv app/modules/support modules/support`, add its `package.json` and
`tsconfig.json`, delete `app/modules/` and its README. Add `pnpm module:create <name>` (about 60
lines, mirror `tools/create-app.ts`) writing `package.json` with catalog deps, `tsconfig.json`,
`src/model/index.ts`, and appending the dependency to the app. Put actions and toolbar inside each
object's `config.ts` so `ui/index.ts` is a pure list. Make `interfaces` and `links` optional on
`defineModule`. Fix README, `docs/architecture.md`, `docs/collections.md`, `docs/data.md`,
`apps/company-os/README.md` in the same change. Update `AGENTS.md` to say modules are packages.

### 8. Shrink the runtime public surface and fix its internal direction (M)

**Problem.** `packages/runtime/package.json` has 111 export entries. Module authors use about seven
of the sixty `./ui/model/*` entries. The server imports ten `client/*` files. The `postgres/` split
is a leaky adapter, not a separable one.

**Evidence.**

- Module imports from `@company/runtime/ui/**` (grep over `modules/` and app-local modules):
  `object-ui` (23), `collection-view` (16), `module-ui` (5), `use-object-client` (2),
  `record-attribution` (1), plus primitives `button`, `popover`, `textarea`, `markdown`,
  `markdown-editor`, `confirm-action-button`. Templates import only `ui/button` and `ui/lib/utils`.
- About 25 `ui/model` exports exist only for the app shell (`object-routing`, `model-pages`,
  `page-chrome`, `recent-records`, `object-create-provider`, `object-table/*`, ...). Test fixtures
  are exported: `object-table/object-table-example-data`, `object-table-example-object`.
- Only `./ui/forms/form-errors` is exported; `runtime/ui/forms/app-form.ts` (`useAppForm`) is not, so
  a module `pageComponent` needing a form has no sanctioned hook. `forms/form-field.tsx:12-13`
  imports from `ui/model/field-editor.ts` and `ui/model/form-value.ts` (wrong direction).
- Server → client: `runtime/client/schema.ts` (`toEffectObjectSchema` etc.) imported by
  `object-service.ts`, `postgres/object-repository.ts`, `postgres/object-query.ts`,
  `event-writer.ts`, `api-error.ts`; `client/object-input.ts` by `object-service.ts` and
  `link-service.ts`; `client/http-api.ts` (621 lines, defines `HttpValidationMiddleware`) is
  imported only by server code.
- Postgres leak: `runtime/server/model-context.ts:13` calls `makePostgresSchema`;
  `runtime/server/database/database.ts:11-49` reimplements `runtime/server/postgres/sql-database.ts:6-22`
  (used only by `postgres/testing.ts` and two module tests); `modules/sales/src/server/pipeline-summary.ts:3`
  imports `inValues` from `@company/runtime/server/postgres`.
- Client hard-codes access knowledge: `runtime/client/data-client.ts:50-56` lists
  `["role","roleAssignment","groupMembership","user","serviceAccount"]` for full cache reset. The
  capability cache key `["model", "@iam"]` is built in `runtime/ui/model/use-capabilities.ts:17` and
  separately in `app/ui/application/load-capabilities.ts:32`. `ModelUiRuntime.data: object`
  (`runtime/ui/model/runtime-context.tsx:12`) is untyped; `use-object-client.ts:22` recovers types
  via `Reflect.get` + cast.
- `runtime/model/operations.ts:103-120` `executableModelOperation` rebuilds the full operation
  catalog on every call; `runtime/server/http.ts:86` calls it per registered handler.

**Change.**

- Register one facade `@company/runtime/ui/module` with explicit named exports (`defineModuleUi`,
  `ObjectUi`, `RecordUiProps`, `RecordSummaryProps`, `FieldEditorProps`, `CollectionToolbarProps`,
  `defineCollectionView`, `useObjectClient`, `useAppForm`, `RecordAttribution`). Move shell
  integration exports under `./ui/app/*`. Replace `./ui/hooks/*` and `./ui/lib/*` wildcards with
  explicit entries. Stop exporting example data.
- Move `http-api.ts`, `http-custom-method.ts`, `schema.ts`, `object-input.ts`, `model-schemas.ts`,
  and the contract halves of `capabilities.ts` and `events.ts` to `runtime/contract/`, consumed by
  both `client/` and `server/`.
- Merge `server/postgres/` and `server/database/` into `server/storage/`; delete `SqlDatabase`;
  keep `ModelContext.table(Object)` + `Database.sql` + statement helpers as the first-class custom
  SQL API and say so in `docs/modules.md`. Keep the `Repository` interface only if a second
  implementation exists.
- Derive the permission-affecting type set from the Access definitions (or emit `*` in
  `x-model-changes` for access writes). Move `allowedCapabilitiesQuery` into the runtime beside
  `useCapabilities`. Type `ModelUiRuntime.data` as `ModelQueries<ModelCatalog>`. Move
  `FormValue`/`FormControlAccessibility` into `ui/forms/`. Memoize `executableModelOperation`.

### 9. Move tests next to the code they test (M, mechanical)

**Problem.** Runtime behavior is tested from the app. The runtime has no database tests and no UI
tests. The app carries exports and directories that exist only for those tests.

**Evidence.**

- App database tests of runtime internals (~4,400 lines):
  `app/server/database/object-repository-database.test.ts` (555),
  `app/server/authorization/authorization-service-database.test.ts` (572),
  `app/server/events/event-journal-database.test.ts` (439),
  `app/server/model/object-service-database.test.ts`, `search-records-database.test.ts`,
  `database/transactions-database.test.ts`, `database/sql-statements-database.test.ts`.
- App client tests of runtime code: `app/data-client.test.ts`, `model-cache.test.ts`,
  `model-query-client.test.ts`, `model-collection-query.test.ts`.
- 16 files under `app/ui/model/**.test.*` plus `app/ui/forms/form-errors.test.ts` test
  `@company/runtime/ui/*`; the app's `src/ui/model/` otherwise holds one 7-line file.
- `app/server/database/schema.ts:6-23` exports 19 table aliases imported only by tests.
- `packages/runtime/package.json` `"test": "vitest run"` has no vitest config.
- `modules/engineering/src/server/model-database.test.ts` and
  `modules/marketing/src/server/model-database.test.ts` are 66/67 lines differing in three
  identifiers; each hand-writes `insert into event_journal_state (id, position) values (1, 0)`.
- `modules/sales/src/server/operations-database.test.ts:26-45` already proves an app-free harness
  exists (`TestDatabase.createTemplate` + `makePostgresSchema(...).ddl` + `infrastructureStatements`
  - `foundationLayer`).
- `app/app.model.test.ts` uses `toEqual` on the full module id list, interface id list, link id
  list, and the 15-member `NoteSubject` union (twice). `app/server/integration/marketing-audience-database.test.ts`
  imports `contactViews` from `@company/sales/ui`, the only reason that export exists.

**Change.** Add `runtime/testing/foundation.ts` (`testFoundation(model)` = DDL + infrastructure +
journal state + bootstrap) and `expectModuleStandsAlone(Module, [deps], { create, absentTable })`.
Move the runtime-subject tests into `packages/runtime` beside the code using a small fixture model
(as `runtime/server/mcp.test.ts` and `runtime/client/schema.test.ts` already do). Add a vitest
config to the runtime. Keep in the app only composition tests (`http-transport`, `seed-*`,
`migrations`, `integration/*`, `module-ui.test.tsx`, `object-table.test.tsx`). Rewrite
`app.model.test.ts` to assert invariants (`toContain`, `arrayContaining`). Delete the test-only
exports from `schema.ts` and the residual `app/modules/{assets,notes}` directories.

### 10. Move developer tooling and unused UI out of the product; fix the access routes (M)

**Problem.** About 4,100 lines of design-system gallery ship in the product bundle, the runtime
exports fixtures for it, and about 2,700 lines of components plus a dependency exist only to
populate it. Access objects are served by two route families with inconsistent links.

**Evidence.**

- `app/ui/developer/design-system/component-examples.tsx` (1,536 lines), `model-explorer.tsx` (892),
  `openapi-reference*.ts(x)` (828). `routes/_app/developer/design-system/patterns/object-table.tsx:6-10`
  imports the exported example fixtures.
- Components with no consumer outside the gallery: `accordion`, `alert`, `avatar`, `chart`, `chat`,
  `progress`, `radio-group`, `switch`, and the chat stack (`message-scroller` 1,326, `chat` 280,
  `attachment` 218, `message`, `bubble`, `marker`). `recharts` is a dependency of both
  `packages/runtime` and `apps/company-os` solely for `chart.tsx`. `component-metadata.ts` already
  drifts from the component directory (six components missing).
- Model, API, SDK, and MCP developer pages are legitimately about the deployed model and are gated by
  `applicationCapabilities.develop` (`routes/_app/developer/route.tsx:17-33`). Keep those.
- Access routes: `routes/_app/settings/(access)/users.tsx:19` renders `ModelCollectionPage` with no
  `search`, `loader`, or URL state (falls back to local state in
  `runtime/ui/model/object-collection.tsx:120-124`), unlike `routes/_app/objects/$objectType/index.tsx:12-24`.
  `objectHref` defaults to `/objects/${object.id}` (`runtime/ui/model/object-routing.ts:27-31`) and
  no access config sets `navigation.path`, so clicking a user on `/settings/users` navigates to
  `/objects/user/<id>` and the shell switches sidebars (`app/ui/application/app-shell.tsx:43-76`).
  Runtime toolbars hard-code app routes (`runtime/ui/access/group/ui/toolbar.tsx:9`,
  `role/ui/toolbar.tsx:9`). `routeObject` (`object-routing.ts:33-39`) accepts hidden objects, so
  `asset`, `anonymousActor`, `principalSet` get generic pages by URL. Six near-identical route files.

**Change.** Move the gallery to a dev-only Vite entry in `packages/runtime` or a `templates/design-system`
app; stop exporting example data; park or delete the chat stack and `chart`; drop `recharts` from
both packages. For access: set `navigation.path: "/settings/users"` etc. in the access UI configs,
make the settings routes thin wrappers sharing one route-options factory with `objects/$objectType`
(or delete them and put the access group under a Settings heading in the sidebar), replace
hard-coded `Link to=` in runtime toolbars with `objectHref(...)`, and make `routeObject` reject
hidden objects without a `path`.

### 11. Be honest about Continual coupling (M)

**Problem.** `AGENTS.md` says hosted Continual integration must remain optional. In practice the
only production identity provider is Continual and every Vite config comes from its package.

**Evidence.**

- Every app and template `vite.config.ts` uses `defineConfig` from `@continual/tanstack-start/vite`;
  every `__root.tsx` calls `initDesignMode()/initTelemetry()` from `@continual/sdk/app-preview`.
- `app/server/application-layer.ts:28` defaults to `continualIdentityProviderLayer`;
  `app/server/auth/identity-provider.ts:105-119` fetches `/api/apps/runtime/auth/me`; non-Continual
  identity exists only when `import.meta.env.MODE === "development"` (71-83). This file is also the
  only `zod` usage in server code while `AGENTS.md` mandates Effect Schema.
- `routes/sign-in.tsx:17-34` copy is Continual-only; `runtime/server/auth/authentication.ts:44`
  default bootstrap issuer is `"continual"`; `x-continual-*` header names in
  `app/model-fetch.ts:22-23` and `openapi-identity.ts:21`; `deploy` is `continual deploy`.
- `docs/runbooks/deployment.md:52` and `docs/architecture.md:124` reference a replacement
  `IdentityProvider.layer` that does not exist. `app/server/continual/` is an empty directory.

**Change.** Either collect the Continual pieces into `app/server/hosting/continual/` and ship a
second production provider (OIDC JWT verifier or trusted-proxy header provider) so "optional" is
demonstrable, or change `AGENTS.md` to say Continual is the default host and standalone means
local-only. Fix the docs either way; remove the empty directory.

### 12. Hygiene (S each)

- **Root prose.** Delete `FOUNDATION-IMPLEMENTATION.md` and `FOUNDATION-NEXT.md` (roadmap prose
  the `AGENTS.md` rule forbids). Move `docs/reviews/*` (competitor review with a private URL and six
  dead links, plus an unimplemented design) to issues or PRs. Move
  `.agents/skills/thermo-nuclear-code-quality-review` (no repo-specific content, unreferenced) to
  user level. Total docs are ~25,800 words for ~48,500 lines of non-test TypeScript; the 8-point
  "incoming work / outcome / records" checklist is repeated four times.
- **Lint plugin.** `tools/oxlint/company-os/rules/` (483 lines, 17 fixtures). Keep the three real
  invariants in `package-boundaries.ts` (runtime surface direction 104-135, module surface
  direction 137-161, app isolation 163-189) and the `export *` ban in `no-internal-reexports.ts`.
  Read public entrypoints from `package.json#exports` instead of regex path literals (currently
  hard-codes `packages/runtime`, `apps/company-os/src/app.model.ts`, `company-os/model`). Drop
  `filename-case.ts` for `unicorn/filename-case` plus a 10-line reserved-entrypoint check. Delete
  `visual-drift.ts` or make it non-failing. Browser safety of model code is enforced four ways
  (oxlint, `app/tools/check-model-boundaries.ts`, Vite `importProtection` in `app/vite.config.ts:10-18`,
  `turbo boundaries`); keep the lint rule plus one transitive check and delete the other.
- **Misconfigurations.** `.oxfmtrc.json:12` `sortTailwindcss.stylesheet` points at deleted
  `packages/ui/src/styles/globals.css`. Five `components.json` files with divergent aliases (app,
  runtime, three templates); keep the runtime's. `turbo.json:13,33` lists `VITE_CLIENT_PORTAL_URL`
  and `VITE_APP_URL` for every package though only `templates/marketing-site/src/lib/app-urls.ts`
  reads them. `tools/tsconfig.json:4` adds `vitest/globals` unused. Service ids `"@app/..."` in
  `app/server/model/model-implementation.ts:7` and `migrations.ts:54` versus `@company/*` elsewhere.
- **Templates.** `templates/client-portal` differs from `templates/base` by a 3-line
  `app-metadata.ts`, a robots meta, and copy. Fold it into `base` (or a `--name` flag); keep
  `marketing-site`. Derive `template.json.scripts` from `package.json` so there is one script set.
  Templates correctly do not duplicate the server shell.
- **Leftovers.** `modules/notes/src/ui/styles.css` is only `@source "./**/*.{ts,tsx}"` and is
  redundant with `app/styles/app.css:6`; delete it and its export. `app/ui/model/model-navigation.ts`
  is a 7-line wrapper duplicating `ModuleNavigation`; expose `useModelNavigation()` from the runtime.
  `app/ui/application/recent-records.tsx` shares a basename with `runtime/ui/model/recent-records.tsx`.
  `runtime/server/model/module-navigation.tsx:16-19` recomputes navigation every render.
- **Per-request work on Workers.** `app/server/application-services.ts:35` runs
  `Layer.effectDiscard(verifyDatabaseModel())` inside the layer; on workerd a runtime is built per
  request (`app/server/application-runtime.ts:52-60`), so this is a DB round-trip per request and it
  already runs inside `applyMigrations`. Run it at migrate time only. `app/server/composition-root.ts`
  (28 lines) bundles layer, OpenAPI document, and model description; fold into `application-layer.ts`.
- **DSL typing gaps.** `defineCollectionView` columns and filters are untyped strings
  (`runtime/ui/model/collection-view.ts:55-63`); make it generic over the object and validate in
  `defineModuleUi`. `CollectionToolbarProps.can` is stringly typed while `RecordUiProps.can` is
  `ActionId<O>` (`object-ui.ts:15,33`). `ObjectUi` and `ResolvedObjectUi` are hand-synchronized
  copies converted with `as unknown as` (`module-ui.tsx:31-73`); derive one from the other.
  `pageComponent` replacements lose preload and view URL state (`object-routing.ts:47,60`); add an
  explicit `preload` sibling. `defineLink` requires mirrored `from/to` on both sides then validates
  they mirror (`runtime/model/definition/link.ts:70-129`); simplify to
  `{ from, to, forward: {...}, reverse: {...} }` and consider restricting Links to many-to-many plus
  `subsetOf`, steering singular relationships to reference properties (Sales models "primary
  company" both ways today). Property-kind dispatch is written three times
  (`object-form-property-field.tsx:91-372`, `object-table-cell*.ts(x)`, `object-property-value.tsx:38-123`);
  one registry keyed by `ObjectTableCellType`.
- **Seeds.** `modules/sales/src/seeds/demo.ts` provisions the demo user via `UserService`, so every
  other seed depends on Sales and an engineering-only composition seeds nothing. Provision the owner
  in the app scenario and pass `{ owner }` into module seeds.
- **Patches.** `patches/effect@4.0.0-beta.107.patch` rewrites `SqlClient` savepoint release on the
  path every custom Action uses; `patches/nitro@...patch` touches dev middleware. Both are documented
  in `patches/README.md`; add upstream issue links so bumps can drop them.

## What is good and should be kept

- The three composition roots (`app.model.ts`, `app.server.ts`, `app.ui.ts`) with a browser-safe
  `company-os/model` export consumed by templates.
- The property DSL (`schema.*`) and `defineObject`'s definition-time validation; module model files
  such as `modules/sales/src/model/lead.ts` read well.
- Actions and Queries as one contract with declared errors, from which HTTP, MCP, and the client are
  derived. Keep the single dynamic-dispatch seam; type it (item 5).
- `defineModel` closed-world validation (collisions, unregistered references, cyclic parents). Keep
  the rules, extract them from the 908-line `model.ts`.
- Event journal: `PendingEvents` as a transaction-scoped `Context.Reference`, position allocation
  as the last statement before commit, append-only trigger, payload references validated against the
  model. Strongest invariant enforcement in the codebase.
- Authorization: default-deny, hierarchy via `ancestor_ids`, `visibleWithin` pushed into SQL,
  `notFound` versus `forbidden`, decisions read inside the transaction.
- Postgres schema compilation (`runtime/server/postgres/schema.ts`).
- `foundationLayer` plus template-clone test databases; the Sales operations test as the exemplar of
  a module proving authorization, atomicity, events, and scoped SQL without the app.
- The eight-export `runtime/server/index.ts` facade. The recommendations above mostly make what is
  behind it match its simplicity.
- `defineModuleUi` + `composeModelUi` two-stage validation and the `satisfies ObjectUi<typeof X>`
  authoring style. The 14-knob module UI contract is the right size; only its typing has gaps.
- Generic `$objectType` routes with `navigation.path` + `objectHref` as the only URL indirection; no
  object-specific branches found in shared routes or renderers.
- Single form path (`useAppForm` → `decodeObjectForm` → `formErrorFromCause`).
- Client cache design: model-scoped query keys with `meta`, header-driven write sets, event-feed
  patching with etag ordering, generation-based identity reset. `app-client.ts` exposes one
  semantic `data` plus named transport operations; no per-endpoint fetch clients.
- `components/` strictly below `model/` in `runtime/ui` (no upward imports).
- `application-runtime.ts` DEV disposal hook and per-request workerd runtime, with comments that
  explain why. `makeApplicationServicesLayer` reused inside a transaction by `run-seed-scenario.ts`
  justifies the services/transports split.
- Destructive-command guards in `db-reset-target.ts` and `db-seed-target.ts`; `tools/create-app.ts`;
  dependency-free `GET /api/health`; single-job CI.

## Suggested order

1. Items 1, 4, 6, 7 first. They change what every later module looks like and are mostly deletion.
2. Items 2, 3, 5 as one runtime pass on the server.
3. Item 8 (surface and directories), then 9 (tests follow the code they test).
4. Items 10, 11, 12.

After each step run `pnpm check`, `pnpm test`, and `pnpm build`, and update `AGENTS.md`, `README.md`,
and `docs/*` in the same change so a fresh agent is not misled by stale layout descriptions.
