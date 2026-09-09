# Database workflow

The central Company OS app uses `src/runtime/server/storage` with the Effect PostgreSQL driver. The portable
model is the source of truth for objects, properties, interfaces, ownership, Links, and uniqueness.
The app instantiates that projection, owns the migration sequence, and binds the derived storage
to its repositories and services.

Run the commands below from the repository root. Database-writing tasks explicitly target the
central app because it is the only package that owns the Company OS database.

| Command       | Purpose                                                        |
| ------------- | -------------------------------------------------------------- |
| `db:generate` | Regenerate the model-derived current `schema.sql`.             |
| `db:check`    | Check that `schema.sql` matches the declared storage.          |
| `db:dump`     | Write the installed schema to ignored `schema.actual.sql`.     |
| `db:migrate`  | Apply committed migrations and ensure required system records. |
| `db:seed`     | Explicit development scenarios; see [demo data](demo-data.md). |
| `db:reset`    | Destructively rebuild a dedicated local database.              |

## Runtime composition

The database path has one implementation in production and tests:

```text
PostgreSQL URL
  -> Effect PgClient managed pool
  -> Database transaction boundary with event and search updates
  -> PostgreSQL repository implementations
  -> governed application services
```

`Database` is an Effect service for sharing the Effect SQL client and transaction boundary; it
is not a second repository abstraction. The `src/runtime/server/storage` functions receive that
database value explicitly and implement the portable repository contracts. Production and
tests use the same binding. They differ only in where the PostgreSQL URL and lifecycle come from.

## Local development

Run PostgreSQL locally before starting Company OS, then start development:

```sh
pnpm dev
```

Turbo runs the App's `db:migrate` task before its development server. `.env.example` supplies the
standard local endpoint `postgresql://localhost:5432/company_os`; create `.env.local` at the
repository root or in `apps/company-os` only when local connection details differ. Injected
environment variables take precedence over both. The migration task creates the database when it
targets local PostgreSQL, then applies committed migrations and required records. It does not
install or start PostgreSQL.

Run the migration without starting the server with:

```sh
pnpm turbo run db:migrate --filter=company-os
```

`db:migrate` applies pending committed migrations and then idempotently ensures the required Root
and trusted system identity. Verified provider subjects bind to local User or ServiceAccount records at authentication time.
Role grants are separate and follow the configured bootstrap/provisioning policy. The command is safe to run repeatedly.

## Database tests

Files named `*-database.test.ts` run in a separate Vitest project against real PostgreSQL. The test
role must have `CREATEDB`. Tests use the same `DATABASE_URL` contract as the application and default
to `postgresql://127.0.0.1:5432/postgres` when it is unset. The database named in that URL is only
the starting connection: tests leave it untouched and create temporary sibling databases on the
same PostgreSQL server.

The test project creates one migrated template database for the run. Every `itDatabase` test clones
that immutable template into a uniquely named database, uses the same Effect PostgreSQL client and
transaction binding as production, closes its pool, and drops the clone. Tests therefore share no
mutable database state and may run concurrently. The template is dropped after the project finishes.

On Neon, the sibling databases live in the same existing Neon branch as the database named by
`DATABASE_URL`; the harness does not create or manage Neon branches. Use the direct, non-pooler
endpoint when running the tests because the harness performs migrations and database
administration. Local PostgreSQL follows the identical database lifecycle.

Supply the test environment connection when the local role or endpoint differs:

```sh
DATABASE_URL=postgresql://developer@127.0.0.1:5432/postgres pnpm test
```

The repository test task uses the Turbo cache. Force every task to execute against the currently
configured PostgreSQL server after changing the server, PostgreSQL version, or database
configuration:

```sh
pnpm turbo run test --force
```

## Committed migrations and persisted shape

The app owns the ordered migration array in `src/server/database/migrations/index.ts`. Its first
migration contains committed SQL, including journal initialization. Running migrations never
projects the current model into DDL. The ledger records each migration's SQL checksum and resulting
schema hash. Startup refuses pending migrations, edited history, and a model differing from the
latest migration's schema hash, including changes within the same module set.

For disposable template data, after editing the three source composition roots:

```sh
pnpm --filter company-os db:generate --baseline
pnpm format
```

Review the generated baseline and `schema.sql`, then use a fresh database. `--baseline` is explicit
because it rewrites migration 1; it must not be used once you retain application data.

## Changes in a customized app with durable data

1. Edit the model, then run `pnpm --filter company-os db:generate` to update only `schema.sql`.
2. Add a numbered migration with `id`, `name`, `sql`, and the SHA-256 `schemaHash` of the new
   `schema.sql`. Write the SQL needed to preserve existing records. Register it in
   `src/server/database/migrations/index.ts`; keep all applied files unchanged.
3. Run `pnpm check`, add a migration test that preserves representative records, and run
   `pnpm turbo run test --force` against PostgreSQL.
4. Apply it with `pnpm --filter company-os db:migrate` before starting the new app version.

The runtime uses Effect SQL Migrator for locking and transactions and checks immutable history
around it. Whole SQL strings preserve PL/pgSQL bodies without a custom splitter. `db:check` checks
the committed current schema and final migration hash without contacting a database. Schema dump
comparison and numbered-migration tests exercise the actual PostgreSQL result; hashes are not a
replacement for testing your migration SQL. Manual out-of-band DDL is not automatically reconciled.

## Inspect the installed schema

```sh
pnpm --filter company-os db:dump
```

This writes `apps/company-os/schema.actual.sql` using `pg_dump --schema-only` for `DATABASE_SCHEMA`
(default `public`). It includes database comments, indexes, and functions, but excludes record data,
roles/grants, and migration bookkeeping. The ignored diagnostic file never replaces the desired
`schema.sql`. Dump failure fails the command.

The dump command and migration parity test require `pg_dump` on PATH, with a major version at least
as new as the server. CI installs PostgreSQL 18's client alongside its PostgreSQL 18 service. Both
sides of the parity test use the same client and server; only random psql restriction tokens are
removed before comparison. Missing indexes, constraints, defaults, or comments therefore fail the
comparison. This validates fresh replay, not a data migration against an existing customer database.

The compiler includes `DEFERRABLE INITIALLY DEFERRED` audit actor foreign keys. These allow the
Root and system Actor to be bootstrapped together; database tests verify the cycle at commit.

## Reset local data

Reset is destructive and unrecoverable. It accepts only a loopback PostgreSQL host and requires the
exact database name as confirmation:

```sh
CONFIRM_DATABASE_RESET=company_os pnpm reset
```

Replace the value with the exact target database name. The committed local default is `company_os`.
Confirm the value in the central app's local environment before running the command.

The reset rebuilds the local database from the committed migration history and required seeds. It
deliberately refuses remote database URLs. Tests do not need it because each test receives an
isolated PostgreSQL database cloned from the migrated test template. The root reset command uses
Turbo to run the reset task of every application that owns local mutable state.

## Production migration

The root `pnpm deploy` command dispatches application-owned deployment tasks through Turbo. Turbo
builds each selected App before its deployment task runs. The central App deployment task migrates
whenever `DATABASE_URL` is configured, then asks the repository-pinned Continual CLI to publish the
existing build output. Other hosting environments must preserve the same build, migrate, publish
ordering or run the migration job explicitly.

Run one migration job from the same immutable revision as the application:

```sh
DATABASE_URL="$PRODUCTION_DATABASE_URL" pnpm turbo run db:migrate --filter=company-os
```

1. Verify a restore point and test risky migrations on a production-like copy.
2. Run the database job once; do not run it concurrently from every application instance.
3. Deploy or promote the compatible application only after the job succeeds.
4. Verify `/health` and the affected read/write operation.

Production migrations are forward-only. Application rollback does not roll back the database. Use
backward-compatible expand/contract changes while revisions may overlap, and append corrective
migrations when necessary. Never run `db:reset`, or an automatically derived
production migration against a shared environment.
