---
name: customize
description: >-
  Implement, simplify, or review Company OS functionality and architecture, including upstream updates.
  Use onboard for initial company setup.
---

# Customize

Use [AGENTS.md](../../../AGENTS.md) for constraints and completion requirements, and
[README](../../../README.md) when setup or command usage is unclear.
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
| Remove an object | Find its references, Links, operation contracts, UI contributions, seeds, and tests with `rg`. Remove those dependencies and the object from its module's `objects` list together; use the storage guidance below for retained data. |
| Hide a module | Turn it off in Settings > Platform > Modules and confirm any dependent modules. Keep the complete storage model. |
| Add a business Action | `modules/sales/model/lead.ts`, `modules/sales/server/convert-lead.ts`, and the adjacent `operations-database.test.ts`. |
| Aggregate records | `modules/sales/server/pipeline-summary.ts` aggregates the project records after admission. |
| Customize UI | `modules/support/ui/ticket/config.ts` for views; `modules/sales/ui/lead/config.ts` for record extensions. Identity and shell changes belong in `app/customization`. |

Read supporting guidance only when it applies:

- [UI](references/ui.md) for presentation changes or missing internal pages.
- [Storage](references/storage.md) for storage changes, retained-data transformations, or database setup.
- [Review](references/review.md) for a requested code or architecture review.
- [Upstream updates](references/upstream.md) for integrating changes from the foundation.

For implementation requests, once the owning code, relevant pattern, and expected behavior are clear,
implement. Open kernel internals only for a specific unanswered contract or failure. Ask about missing business meaning,
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

Test the changed business behavior using `testFoundation(model, { servers })` and `fixture.test`,
as the operation tests do. The fixture owns database setup/cleanup. Verify relevant denied access,
rollback, retries, and retained-data migration. App activation and admission coverage belong in
`app/server/integration` using `testApplication` and the governed client;
writer-only tests do not establish user access.
