---
name: customize
description: >-
  Implement, simplify, or review Company OS functionality and architecture. Use for adding/removing
  objects, changing business behavior, customizing UI, focused or deep reviews, and upstream updates.
  Initial company setup uses onboard.
---

# Customize

Use [AGENTS.md](../../../AGENTS.md) for constraints and [README](../../../README.md) for the vision
and commands.
Inspect Git state and the requested scope; reuse context already read. Read a company-context skill
only when it exists and its company policy matters. Paths below start at `apps/company-os/src/`.

## Find the smallest change

Start from the closest existing object, Link, or operation definition. Match its naming, schema,
relationship, and operation conventions; reuse existing definitions instead of duplicating concepts.
Read the relevant builder/type declaration only if the example leaves the API unclear. Choose the
relevant row below; do not survey every definition or trace the runtime before starting.

| Request | Edit or inspect |
| --- | --- |
| Add an object or field | The owning module's `model/`; `modules/support/model/ticket.ts` is a standard example. Register objects in `model/index.ts`. |
| Add a Link | `modules/sales/model/links/contact-companies.ts`; use `contact-primary-company.ts` beside it for a subset selection. Register Links in the owning module’s `model/index.ts`. |
| Add a module | Its `model/index.ts`, then `app.model.ts`; add server/UI roots only for contributions that exist. |
| Remove an object | Find its references, Links, operation contracts, UI contributions, seeds, and tests with `rg`. Remove those dependencies and the object from its module's `objects` list together; follow the data rules below. |
| Hide a module | Turn it off in Settings > Platform > Modules and confirm any dependent modules. Keep the complete storage model. |
| Add a business Action | `modules/sales/model/lead.ts`, `modules/sales/server/convert-lead.ts`, and the adjacent `operations-database.test.ts`. |
| Aggregate records | `modules/sales/server/pipeline-summary.ts` aggregates the project records after admission. |
| Customize UI | `modules/support/ui/ticket/config.ts` for views; `modules/sales/ui/lead/config.ts` for record extensions. Identity and shell changes belong in `app/customization`. |

Once the owning code, relevant pattern, and expected behavior are clear, implement. Open kernel
internals only for a specific unanswered contract or failure. Ask about missing business meaning,
access rules, or data-retention intent when it changes the result; use conventions for routine
implementation choices. Honor backend-only and other scope constraints.

## Implement

Apply the CRUD-first rule in `AGENTS.md`: a business verb or status change alone does not justify
a custom Action wrapping create/update/delete. When standard CRUD and model constraints cannot
express the behavior, implement it as a named `Effect.fn` bound by `defineModuleServer`. Require
project admission before `Records.writer` or `Links.writer`; use `EventJournal.append` for custom facts in
the transaction.
Use installed Effect v4 APIs; services use `Context.Service(..., { make })` with a static `.layer`.
Public intake gets an explicit contract separate from private records. External effects need a
commit/failure boundary and retries that avoid duplicating the effect.

Enabled objects automatically get internal collection/record pages, forms, and navigation, after
project admission. `app.ui.ts` is optional presentation customization, not an activation requirement.
Public intake is a separate surface; a request for Company OS without a public site still includes
its standard internal pages. Module UI uses `useObjectClient(Object)` from `runtime/ui/module.ts`;
shell code uses `app/app-client.ts`. Use the existing forms, error paths, and server-driven invalidation. Prefer
`defineModuleUi` additions/replacements, then a module-owned page for a distinct workflow. Do not
create a custom route, transport, or service merely to expose standard CRUD.

During development, edit the model and run `pnpm db:reset` after storage changes. This regenerates
`schema.sql`, rebuilds the disposable local database directly from the model, and restores system
records/search. It deletes local data and leaves migration files untouched. Use it only when the
local data is disposable; retained data requires a migration. Ordinary application tests use the
current model and do not require the migration to exist yet.

When the feature is ready, run `pnpm db:migration <name>` (for example `add_owner`). It compares
scratch databases built from existing migrations and the current model, then writes the next SQL
file with structural diff comments and a failing placeholder. Replace that placeholder with the
actual migration. Do not infer renames or backfills from structural differences alone. Finish any
existing draft before generating another. A name allows a data-only migration even with no schema
differences. Run `pnpm test:migrations` and add retained-data tests for transformations before
committing the model, schema, migration, and tests together. Never rewrite applied history.

Use `pnpm db:migrate` for an empty or previously migrated database; it also refreshes system records
and search. A database rebuilt with `db:reset` has no migration history and must not receive pending
migrations. Reload the app and verify the intended user's access. For a missing object, check model
registration, enablement, database setup, and project admission before adding UI code. Demo seeding
is optional sample data. Removing source does not authorize losing retained records: establish
their migration, archive, or deletion outcome first.

Test the changed business behavior using `testFoundation(model, { servers })` and `fixture.test`,
as the operation tests do. The fixture owns database setup/cleanup. Verify relevant denied access,
rollback, retries, and retained-data migration. Run the repository checks, inspect the diff, and
report delivered behavior, validation, and remaining activation steps. App activation and admission
coverage belong in `app/server/integration` using `testApplication` and the governed client;
writer-only tests do not establish user access.

## Review or rethink

A review request stays read-only unless fixes are requested. Start from the specified diff or design
question. For a deep review, follow an actual operation across model, admission, persistence,
transports, and UI where relevant; challenge the boundaries and propose simpler alternatives.
Depth means better evidence, not more findings or an automatic rewrite.

Rank concrete bugs and improvements by impact. Give the trigger, consequence, and source location;
distinguish demonstrated failures from unverified concerns and design tradeoffs. Prefer removing
unnecessary state or indirection over introducing abstractions. Verify a suspected bug with a focused
reproduction when practical. Report no findings when appropriate and state validation limits.

## Upstream updates

Verify the source and merge base, isolate unrelated work, and resolve conflicts from upstream and
company intent. Preserve applied migrations. For unrelated materialized history, recover the recorded
source revision and integrate only its delta; `--allow-unrelated-histories` alone is not sufficient.
If provenance is missing, ask for it. Record the new baseline and verify the resulting change.
