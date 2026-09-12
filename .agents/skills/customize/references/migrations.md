# Pre-release storage changes

Follow the pre-release policy in [AGENTS.md](../../../../AGENTS.md). Edit the model, run
`pnpm db:reset`, and reseed as needed. Reset regenerates `schema.sql`, rebuilds the disposable local
database from the model, and restores system records/search. It leaves migration files untouched.
Commit the model, generated schema, and relevant tests together; do not draft incremental migrations
or backfills for disposable data.

Existing migration tooling and replay checks still exist. If schema parity requires updating their
baseline, replace pre-release history with a fresh baseline and run `pnpm test:migrations`.
A reset database has no migration history and must not receive pending migrations.

For data explicitly marked for retention, establish its migration, archive, or deletion outcome
before changing storage. Do not infer permission to reset a remote or retained database.
