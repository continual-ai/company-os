# Working in Company OS

Company OS is one application a company clones and owns. It turns real business processes into
software that keeps durable state, enforces rules, and gives people, integrations, and agents the
same governed actions. Everything lives in this repository: the kernel, every module, and the shell.
Nothing is installed from a package registry except third-party libraries.

## Design posture

The product is still being designed. Treat code and tests as the authority for current behavior,
not proof that a design should stay. Recommend stronger alternatives when a concrete slice provides
better evidence. Prefer work that makes one real operation run end to end: incoming work, desired
outcome, authoritative records, deterministic rules, places where AI may exercise judgment, human
decisions, failure behavior, and evidence of success. Do not let the repository collapse into a
generic CRUD scaffold, a page generator, or an agent-only automation layer.

Keep guidance in the narrowest authoritative place. This file holds repository-wide constraints.
`docs/` explains purpose, boundaries, and workflows. Skills under `.agents/skills` carry product and
ownership context that code cannot express. Code, types, tests, and generated contracts define
implementation details. Do not copy inventories of exports, routes, or unfinished features into
prose; do not add roadmap sections.

## Layout

```text
apps/company-os/src/
  runtime/        kernel: model/ contract/ client/ server/ ui/ testing/, plus the kernel
                  modules access/ and assets/ (each model/ server/ ui/). Upstream owns it.
  modules/        one directory per module, same shape: model/ server/ ui/ seeds/
  app/            the shell: ui/ server/ client/ customization/ styles/ seeds/, plus the
                  app-client.ts and app-presentation.ts assembly
  routes/         TanStack Start file routes, generic over the model
  app.model.ts    every module, composed and migrated; the storage authority
  app.config.ts   appMetadata and enabledModules: deployment identity and exposed modules
  app.server.ts   custom operation contributions
  app.ui.ts       presentation contributions
apps/client-portal/  a satellite app over the central app's exports; delete or copy it
tools/            the oxlint plugin and kernel-drift
```

A package is a deploy unit. `apps/*` are workspace packages; the kernel and the modules are
directories. Do not add packages for code that ships inside the app.

Every module is composed in `app.model.ts` and its tables always migrate. Persistence, cascades,
integrity, and the event journal always run on that complete model. `app.config.ts` lists the
modules that are enabled; `enableModules` derives `EnabledModel`, and every exposure boundary (HTTP
API, MCP tools, OpenAPI, UI composition, navigation, routing, search) receives that one derived
model. No component or route asks whether a module is enabled. Disabling a module hides its
operations and leaves its data and relationships intact. Access and Assets are kernel modules and are always enabled. Never let an
environment variable choose the module set; two deployments with different modules are two commits.

## Customization ladder

Customers and the maintainers change the application in this order, and record the reason in the
commit when they go past the first rung:

1. Add a module under `src/modules/<name>` and register it in the four roots.
2. Edit a shipped module.
3. Edit `src/runtime`.

Upgrades are `git merge` from upstream. Keep upstream commits small, keep a kernel change and its
module fallout in one commit, and never edit kernel files for a business reason that a module could
express.

## Import rules

All private imports use `#/<path>` with an explicit `.ts` or `.tsx` extension, resolved from
`apps/company-os/src`. No relative source imports, no `@/`, no barrel files, no `export *`. Named
re-exports are allowed only from the registered entrypoints: `runtime/model/index.ts`,
`runtime/server/index.ts`, `runtime/ui/module.ts`, the kernel and module `model/index.ts`,
`server/index.ts`, `ui/index.ts`, `seeds/index.ts`, and `app.model.ts`. The oxlint plugin in
`tools/oxlint/company-os` enforces these direction rules:

- Model code (`runtime/model`, `runtime/contract`, every `*/model/**`, `app.model.ts`) imports no
  server, UI, client, seeds, React, Node, or PostgreSQL code.
- `runtime/**` never imports `modules/**`, `app/**`, or `routes/**`. Server code never imports UI.
- A module imports itself, other modules' `model/`, and `runtime/`. Seeds may compose other
  modules' `seeds/index.ts`. Nothing in a module imports `app/**` or the composition roots.
- Browser code (`client`, `ui`, `routes/**/*.tsx`, `app/ui`, `app/customization`) never imports
  `**/server/**`, `**/seeds/**`, or `runtime/testing/**`. Vite import protection is the transitive
  check.

Apps form a hub and spokes. `apps/company-os` is the hub; every other app is a satellite that
imports `company-os/model`, `company-os/client`, `company-os/config`, `company-os/ui/*`, and
`company-os/styles.css` only, never another satellite, and never the hub's internals. Satellites
call the central app from server code through `createClient` and forward the hosting platform's
identity headers; no app mints identity. Those package exports are the hub's public surface; keep
the list short, and keep `runtime/client/create-client.ts` free of React, TanStack, and the app
shell so the surface stays portable. Anything outside this repository uses OpenAPI or MCP.

## Modules

A module is a cohesive business capability with its own directory: `model/` holds `defineObject`,
`defineLink`, `defineInterface`, `defineEvent`, and the `defineModule` entrypoint; `server/` holds
named `Effect.fn` operations bound with `defineModuleServer`; `ui/<object>/config.ts` registers typed
extensions composed by `defineModuleUi` in `ui/index.ts`; `seeds/` holds fixture builders. Omit
surfaces a module does not need. Standard CRUD, storage, HTTP, MCP, and default pages derive from the
model; write custom code only for additional behavior or invariants. Cross-module dependencies are
imports of another module's `model/`; a link between two otherwise independent modules lives in a
small bridge module that depends on both. A module enters this repository only when Continual or a
customer runs it in production.

Objects are durable identities. Use `parent` only for ownership and authorization ancestry, a
reference property for directional state that belongs on one object, a Link for an association
without identity (many-to-many by default, `subsetOf` for a primary selection), and an Object when
a relationship has attributes, lifecycle, or its own permissions. Never encode one fact as both a
property and a Link. See `docs/modules.md` and `docs/modeling.md`.

## Server operations

Implement custom Queries and Actions as named `Effect.fn` functions using the kernel services from
`runtime/server/index.ts`. Operations enforce authorization, invariants, and the transaction
boundary for every caller; transports only adapt protocols. `Operations.run` gives every action one
transaction. Queries are read-only and filter authorized rows before aggregating. Custom writes use
`Records.writer` and `Links.writer`, which validate and attribute but do not authorize; the calling
operation establishes that authority. Custom facts use `EventJournal.append` inside the operation's
transaction. Keep currencies separate and use PostgreSQL numeric arithmetic for money. Use
`Context.Service(..., { make })` with a static `.layer`; name alternatives `.layerTest` or
`.layerMemory`. Use the installed Effect v4 APIs, never v3 patterns. PostgreSQL is the storage layer;
custom SQL uses `Database.sql` with `ModelContext.table(Object)` and the statement helpers, not a
second schema.

## Clients, forms, and UI

Feature code uses the semantic client from `app/app-client.ts`: `useQuery(data.object.list(...))`
and `useMutation(data.object.update())` on one application cache. Router loaders preload the same
requests. Actual server writes drive invalidation. Forms own drafts in TanStack Form through
`useAppForm`, decode with Effect Schema, and render server violations through the standard paths.
Use the source-owned shadcn components and Tailwind tokens under `runtime/ui`. Add and remove
primitives with `pnpm ui:add <component>` and `pnpm ui:remove <component>`, which run the shadcn CLI
against `apps/company-os/components.json` and normalize its output to this repository's imports.
Primitives under `runtime/ui/components` depend only on other primitives, `ui/lib`, and `ui/hooks`;
model presentation composes them, never the reverse. Do not add another framework or component
library. Generic routes under `routes/_app/objects` and
`routes/_app/settings` serve every object through `navigation.path`; never add object-specific
branches to shared routes or renderers. Use named UI additions and replacements for light
customization and ordinary module-owned pages for distinct workflows.

## Storage and migrations

The composed model projects one PostgreSQL schema. `apps/company-os/schema.sql` is the current
projection and `src/app/server/database/migrations` is the applied history; `db:check` fails when
they disagree. While the template is disposable, regenerate the baseline with
`pnpm --filter company-os db:generate --baseline`. Once a deployment retains data, add numbered
migrations and never rewrite applied ones. Disabling a module never drops tables.

## Documentation and comments

Use app, model, module, runtime, and storage for technical concepts. Prefer clear names, types, and
tests over comments. Add TSDoc only for a non-obvious contract, invariant, default, or ownership
boundary. Use implementation comments to explain why, especially safety arguments and transaction or
failure invariants. UI copy conveys domain meaning or a consequence, never structure. Update or
remove documentation in the same change that makes it inaccurate.

## Verification

`pnpm check` runs lint, typecheck, `db:check`, model lint, format check, and dead-code detection
without rewriting. `pnpm format` formats. `pnpm test` needs PostgreSQL at `DATABASE_URL`
(default `postgresql://localhost:5432/postgres`) with a role that can create databases. Run
`pnpm build` after changing routing, bundling, or dependencies. Every change lands with all of them
green.
