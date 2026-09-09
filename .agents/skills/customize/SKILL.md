---
name: customize
description: >-
  Implement, simplify, or review Company OS functionality and architecture. Use for adding/removing
  objects, changing business behavior, customizing UI, focused or deep reviews, and upstream updates.
  Initial company setup uses onboard.
---

# Customize

Use [AGENTS.md](../../../AGENTS.md) for constraints and [README](../../../README.md) for commands.
Inspect Git state and the requested scope; reuse context already read. Read a company-context skill
only when it exists and its company policy matters. Paths below start at `apps/company-os/src/`.

## Find the smallest change

Choose the relevant row; do not read every example or trace the runtime before starting.

| Request | Edit or inspect |
| --- | --- |
| Add an object or field | The owning module's `model/`; `modules/support/model/ticket.ts` is a standard example. Register objects in `model/index.ts`. |
| Add a module | Its `model/index.ts`, then `app.model.ts` and `app.config.ts`; add server/UI roots only for contributions that exist. |
| Remove an object | Find its references, Links, operation contracts, UI contributions, seeds, and tests with `rg`. Remove those dependencies and the object from its module's `objects` list together; follow the data rules below. |
| Hide a module | Remove its id from `app.config.ts`, accounting for dependent modules. Keep the complete storage model. |
| Add a business Action | `modules/sales/model/lead.ts`, `modules/sales/server/convert-lead.ts`, and the adjacent `operations-database.test.ts`. |
| Aggregate records | `modules/sales/server/pipeline-summary.ts` filters authorized rows before aggregation. |
| Customize UI | `modules/support/ui/ticket/config.ts` for views; `modules/sales/ui/lead/config.ts` for record extensions. Identity and shell changes belong in `app/customization`. |

Once the owning code, relevant pattern, and expected behavior are clear, implement. Open kernel
internals only for a specific unanswered contract or failure. Ask about missing business meaning,
access rules, or data-retention intent when it changes the result; use conventions for routine
implementation choices. Honor backend-only and other scope constraints.

## Implement

Use standard operations unless the request needs an additional invariant or workflow. Keep business
policy in named `Effect.fn` operations bound by `defineModuleServer`. Require authority before
`Records.writer` or `Links.writer`; use `EventJournal.append` for custom facts in the transaction.
Use installed Effect v4 APIs; services use `Context.Service(..., { make })` with a static `.layer`.
Public intake gets an explicit contract separate from private records. External effects need a
commit/failure boundary and retries that avoid duplicating the effect.

Module UI uses `useObjectClient(Object)` from `runtime/ui/module.ts`; shell code uses
`app/app-client.ts`. Use the existing forms, error paths, and server-driven invalidation. Prefer
`defineModuleUi` additions/replacements, then a module-owned page for a distinct workflow. Do not
create a custom route, transport, or service merely to expose standard CRUD.

For storage changes, run `pnpm --filter company-os db:generate`. Add a numbered migration with the
new schema hash and register it in `app/server/database/migrations/index.ts` when data is retained.
Use `--baseline` only for confirmed disposable data. Removing source does not authorize losing
retained records: establish their migration, archive, or deletion outcome first. Hiding UI, denying
access, and deleting data are different requests.

Test the changed business behavior using `testFoundation(model, { servers })` and `fixture.test`,
as the operation tests do. The fixture owns database setup/cleanup. Verify relevant denied access,
rollback, retries, and retained-data migration. Run the repository checks, inspect the diff, and
report delivered behavior, validation, and remaining activation steps.

## Review or rethink

A review request stays read-only unless fixes are requested. Start from the specified diff or design
question. For a deep review, follow an actual operation across model, permissions, persistence,
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
