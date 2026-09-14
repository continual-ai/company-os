# Pre-release storage changes

Follow the pre-release policy in [AGENTS.md](../../../../AGENTS.md). Edit the model, run
`pnpm reset`. Reset regenerates `schema.sql`, rebuilds the disposable local
database from the model, and restores system records, search, and the demo.
`pnpm db:generate` refreshes only the SQL projection without accessing a database.
`pnpm dev` prepares storage and seeds the demo once before starting the apps.
Commit the model, generated schema, and relevant tests together; do not draft incremental migrations
or backfills for disposable data.

The app owns `src/app/server/database/migrations.ts`, using Effect SQL's migration runner.
`pnpm db:migrate` applies pending migrations and records them; `pnpm reset` drops disposable
storage and reapplies the same migrations. Both restore system records and search.

Before v1, keep only `migrations/0001-initial.ts`, derived from the current model. Update it and reset
after schema changes. The recorded fingerprint rejects an outdated initial migration without changing
existing data. Migration and reset tests run in `pnpm test`.

When retained-data upgrades become necessary, freeze migration 1's SQL and append immutable numbered
migrations to the same registry. Compare their final structure against the model projection and verify
that upgrades preserve existing data. No new runner is needed at that point.

For data explicitly marked for retention, establish its migration, archive, or deletion outcome
before changing storage. Do not infer permission to reset a remote or retained database.
