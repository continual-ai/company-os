# Foundation implementation

The starter now has one static app composition and no environment-selected module profiles.
`@company/runtime` owns the shared model, contract, server, client, UI, and testing surfaces.
Reusable domains stay in source-owned packages; bespoke domains use the same structure in the app.

Start with [architecture](docs/architecture.md), [module authoring](docs/modules.md), and the
[engineering/support walkthrough](docs/dogfooding.md).

## Implemented

- Explicit `app.model.ts`, `app.server.ts`, and `app.ui.ts`; the default installs Access and Assets.
  Full fixture compositions and seed scenarios live in `src/examples` and are not production profiles.
- One shared service assembly and HTTP/MCP operation runner. Module bindings retain their Effect
  requirements and use explicit provider-layer outputs. Missing operation providers fail typechecking.
  Standard internal writes use `Records.writer(Object)`.
- Shared schema and HTTP contracts under `/contract`, with enforced import direction. `/model`
  remains portable and free of Effect. `/ui/module` provides the common module authoring helpers.
- Committed initial SQL, numbered app-owned migrations, immutable SQL checksums, schema drift checks,
  and startup rejection of pending migrations. Retained data evolves through explicit migrations.
- Runtime behavior tests moved out of the app, with `testFoundation(model)` providing real scoped
  PostgreSQL, authorization, records, and events. Module tests compose only declared dependencies.
- The optional Support–Engineering module owns its association, escalation receipt, action, event,
  and React page. Support can compose without Engineering. Concurrent retries return one issue;
  failures roll back the entire handoff.
- A standalone signed-JWT identity adapter alongside the optional Continual adapter. Local roles
  remain authoritative. The deployment guide specifies the external login gateway contract.
- Gallery fixture data moved out of the runtime API; obsolete forwarding services, exports, profile
  configuration, and duplicate writer construction removed. Setup and authoring guides updated.

## Deliberate retained boundaries

Access and Assets are required foundation capabilities, even in a business-free starter. PostgreSQL
savepoints remain because caught inner failures and concurrent sibling operations need isolated
rollback. Standard schema-driven views remain useful, while distinct workflows can own React pages.
There is no dynamic plugin discovery, generated module scaffolding, or independent module migration ledger.

## Validation

`pnpm check`, the full uncached PostgreSQL suite, and `pnpm build` pass. The added reserved-event test
and migration/customization checks also pass. Production builds cover the app and all three maintained
optional-app starters. The engineering/support composition was separately built from the documented
source edits in a disposable copy.

Browser validation covered the minimal starter and ticket creation → escalation → engineering issue,
including the issue description, customer-ticket relationship, and escalation receipt. Isolated
PostgreSQL tests cover concurrent retries, authorization, rollback, HTTP/MCP parity, immutable
migration history, and retained rows through a numbered migration. Temporary validation databases
and servers were removed. A real external identity deployment has not been exercised.

The pre-change working tree is preserved on `codex/foundation-before-dogfooding`.
