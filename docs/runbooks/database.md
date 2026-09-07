# Database workflow

The central Company OS app uses `@company/postgres` with the Effect PostgreSQL driver. The portable
model is the source of truth for objects, properties, interfaces, ownership, Links, and uniqueness.
The app instantiates that projection, owns explicit SQL migrations, and binds the generated storage
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
is not a second repository abstraction. The reusable `@company/postgres` functions receive that
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

## Change persisted shape

1. Edit the source contract under `apps/company-os/src/modules`, or the app-owned infrastructure
   declarations in `src/server/database/schema.ts`.
2. Run `pnpm turbo run db:generate --filter=company-os` and review `apps/company-os/schema.sql`.
3. Write the corresponding numbered SQL migration under `src/server/database/migrations` and
   register it in the explicit loader in `migrations.ts`. Use the generated diff to guide the SQL;
   generation never writes migration files. Keep already-applied migrations unchanged.
4. Run `pnpm check` and `pnpm turbo run test --force`. The database suite replays migrations into an
   empty database and compares its schema dump with a separate database built from `schema.sql`.
5. Apply the reviewed migration with `pnpm turbo run db:migrate --filter=company-os`.

`schema.sql` is the desired current schema, including all domain and infrastructure tables, indexes,
constraints, functions, triggers, and stored descriptions. `db:check` and `model:check` detect a stale
artifact without contacting a database. Required initial journal state belongs in the initial
migration; system records are ensured separately by `db:migrate`.

Effect SQL's Migrator executes whole numbered SQL files transactionally, including PL/pgSQL bodies,
and records completed IDs in `company_os_migrations`. It does not verify historical file contents or
generate schema diffs. There is no custom SQL splitter, snapshot chain, or schema-diff engine.

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
