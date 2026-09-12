# Company OS

An open-source foundation for a company's own operating system: software tailored to its business
and built first for agents to operate. One application the company owns, with connected records,
rules, and operations shared by people, integrations, and agents. Build real operations. Code and
tests describe current behavior, not a reason to preserve a weak design. Prefer simple, idiomatic,
editable source.

## Pre-release policy

Until v1, prioritize the cleanest current design over backward compatibility. Change contracts
directly and update all callers, examples, and tests together. Remove obsolete paths; do not add
compatibility shims, deprecated aliases, dual formats, or transitional layers unless explicitly requested.
Use database resets for disposable development data instead of incremental upgrade migrations.
Revisit compatibility and migration guarantees before v1.

## Where things belong

- `apps/company-os/src/modules/<name>/{model,server,ui,seeds}` owns business capabilities; omit unused surfaces.
- `src/runtime` owns the kernel; `src/app` owns the shell. Place business changes in the owning module;
  create a module for a new capability. Change the kernel when the required behavior belongs there.
- `app.model.ts` composes and migrates every module. Platform > Modules stores activation in the database;
  UI, HTTP, and MCP expose the active model. Disabling hides operations without deleting data. Identities,
  Assets, and Platform stay enabled. Enabled objects get internal pages and navigation automatically, after
  project admission. Register only custom server/UI contributions in `app.server.ts` and `app.ui.ts`.
- Apps are deployable packages. `packages/ui` is the sole shared library. Do not create packages for
  app-internal code or replace the checked-in stack. Ship modules for real production use.

## Boundaries

- Private hub imports use `#/` with explicit `.ts`/`.tsx` extensions. No barrels or `export *`;
  named re-exports belong only in registered entrypoints. Follow the rules enforced by
  `tools/oxlint/company-os` and Vite import protection.
- Model code is browser-safe. Runtime never imports business modules or the shell. Modules import
  other modules' models, never their implementations; seeds may compose seed entrypoints.
- Satellites use only `company-os/model`, `company-os/client`, `company-os/config`, and `@company/ui`.
  They call the hub from server code and forward verified identity headers; no app mints identity.
  External consumers use OpenAPI or MCP.

## Business behavior

- Keep one authority per fact. Use Links for all relationships, with named forward/reverse
  traversals and min/max bounds. Ownership is explicit `onDelete: "cascade"` on a traversal;
  ordinary unlinking never deletes records. Use Objects for relationships with a lifecycle,
  attributes, or business rules. Never encode the same relationship twice.
- Prefer standard record CRUD and model constraints. Add a custom Action only when they cannot
  express the required behavior correctly. Storage, APIs, MCP, and pages derive from the model.
  The host verifies access to this project; all admitted users and service accounts share full business access.
  Keep User and ServiceAccount as attribution identities, with Actor for audit references. Do not add
  local roles, groups, scopes, or record permission filters. Custom Effect v4 operations require project
  admission and own invariants and transactions. Writers validate and attribute. Keep currencies separate and use PostgreSQL numeric arithmetic for money.
- Use existing model services and `Database.sql` with `ModelContext.table`, never a second schema.
  Append custom facts inside the transaction; keep a kernel change and its module fallout together.
- UI uses the shared semantic client/cache, TanStack Form, Effect Schema, and `@company/ui` primitives
  and tokens. Add primitives with `pnpm ui:add`. Extend module-owned views/pages; shared routes and
  renderers never branch on a business object or module enablement.

## Data and delivery

`schema.sql` projects the model. After storage changes, run `pnpm db:reset` to regenerate it and
rebuild disposable local data, then reseed as needed. Do not add incremental migrations or backfills
for pre-release development. Pre-release migration history may be replaced with a fresh baseline
when existing tooling needs it; it is not a compatibility contract. Reset is not authorization to
delete remote data or data explicitly marked for retention; handle those cases deliberately.

For implementation changes, run `pnpm check` and `pnpm test`; also run `pnpm build` for routing,
bundling, or dependency changes and `pnpm test:migrations` when changing migration tooling or its baseline. For prose-only
changes, validate the affected documents and links; application checks are unnecessary.
Complete the requested behavior, run applicable checks, fix failures caused by the change, and
demonstrate the requested interface before handing back. Use meaningful tests for changed behavior.
Report unrun checks and environmental blockers honestly. Review requests stay read-only unless fixes
are requested.
`README.md` covers setup; repository skills cover onboarding, customization, review, and delivery. Keep comments
for non-obvious contracts and reasons. Do not duplicate implementation inventories or recreate docs.
