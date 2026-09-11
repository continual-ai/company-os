# Company OS

An open-source foundation for a company's own operating system: software tailored to its business
and built first for agents to operate. One application the company owns, with connected records,
rules, and operations shared by people, integrations, and agents. Build real operations. Code and
tests describe current behavior, not a reason to preserve a weak design. Prefer simple, idiomatic,
editable source.

## Where things belong

- `apps/company-os/src/modules/<name>/{model,server,ui,seeds}` owns business capabilities; omit unused surfaces.
- `src/runtime` owns the kernel; `src/app` owns the shell. Add a module, edit an existing module, then
  edit the kernel only when necessary. Explain departures from the first rung in the commit.
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

`schema.sql` projects the model; the app owns migration history. During development, `pnpm db:reset`
rebuilds disposable local data from the model without changing migration files. When ready,
`pnpm db:migration <name>` drafts the next SQL file with diff hints; finish it and run
`pnpm test:migrations`. `pnpm db:migrate` applies history to empty or previously migrated databases.
Never rewrite applied migrations. Upstream upgrades preserve company changes and applied history.

Run `pnpm check` and `pnpm test`; also `pnpm build` for routing, bundling, or dependency changes.
Use meaningful tests for changed behavior. Report unrun checks and environmental blockers honestly.
`README.md` covers setup; the two skills cover onboarding and customization/review. Keep comments
for non-obvious contracts and reasons. Do not duplicate implementation inventories or recreate docs.
