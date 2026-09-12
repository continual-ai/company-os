# Pre-release storage changes

Follow the pre-release policy in [AGENTS.md](../../../../AGENTS.md). Edit the model, run
`pnpm db:reset`, and reseed as needed. Reset regenerates `schema.sql`, rebuilds the disposable local
database from the model, and restores system records/search.
Commit the model, generated schema, and relevant tests together; do not draft incremental migrations
or backfills for disposable data.

`pnpm db:migrate` initializes an empty deployment from a single model-derived baseline. Its
fingerprint rejects outdated databases; it does not upgrade or reset them. `pnpm test:migrations`
checks initialization and refusal behavior. A local reset database has no migration ledger and
must continue using resets.

For data explicitly marked for retention, establish its migration, archive, or deletion outcome
before changing storage. Do not infer permission to reset a remote or retained database.
