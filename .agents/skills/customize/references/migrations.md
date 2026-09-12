# Storage changes and migrations

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
migrations. Removing source does not authorize losing retained records: establish their migration,
archive, or deletion outcome first.
