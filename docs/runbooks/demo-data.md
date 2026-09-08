# Explicit demonstration data

Normal startup initializes only system records. It does not install business modules or create
fictional business records. [Install the engineering/support composition](../dogfooding.md) to try
the escalation workflow with records you enter yourself.

Domain `/seeds` exports own fixture builders and assets. `apps/company-os/src/examples/demo.server.ts`
composes the full connected example; `performance.server.ts` creates a paginated dataset. The
integration suite runs these against its explicit example model in disposable PostgreSQL databases.
They are test fixtures, not environment-selected production profiles.

For a customized app, write an app-owned scenario using `SeedScenario` and `runSeedScenario` from
`@company/runtime/server/seed-scenario`. Provide the same services layer as the application's
operations. The runner uses an advisory lock, one transaction, and a durable receipt keyed by the
scenario name and parameters. A successful rerun preserves user edits; failures roll back records,
events, and the receipt. Keep trusted system seeding explicit and separate from untrusted ingress.
