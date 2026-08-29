# Database workflow

The central Company OS app uses `@company/postgres` with the Effect PostgreSQL driver. The portable
model is the source of truth for objects, properties, interfaces, ownership, Links, and uniqueness.
The app instantiates that projection, owns explicit SQL migrations, and binds the generated storage
to its repositories and services.

Run the commands below from `apps/company-os`. From the repository root, prefix a command with
`pnpm --filter company-os`.

## Runtime composition

The database path has one implementation in production and tests:

```text
PostgreSQL URL
  -> Effect PgClient managed pool
  -> app-typed Drizzle Database with the generated relations
  -> PostgreSQL repository implementations
  -> governed application services
```

`Database` is an Effect service for sharing the app-typed Drizzle value and transaction boundary; it
is not a second repository abstraction. The reusable `@company/postgres` functions receive that
concrete Drizzle value explicitly and implement the portable repository contracts. Production and
tests use the same binding. They differ only in where the PostgreSQL URL and lifecycle come from.

## Local setup

Run PostgreSQL locally before starting Company OS. The committed development URL uses the standard
local endpoint `postgresql://127.0.0.1:5432/company_os`; override it in
`apps/company-os/.env.local` when necessary. Create the development database once:

```sh
createdb company_os
```

At the repository root, `pnpm dev` applies committed migrations, converges required records, and
starts the central application. It does not install or start PostgreSQL. Run `pnpm setup` when only
database convergence is needed.

Within the app package, the normal convergence command is:

```sh
pnpm db:deploy
```

`db:deploy` applies pending committed migrations and then idempotently converges the required Root,
system identity, principal sets, roles, and initial role assignments. It is safe to run repeatedly.

## Database tests

Files named `*-database.test.ts` run in a separate Vitest project against real PostgreSQL. The test
role must have `CREATEDB`. Tests use the same `DATABASE_URL` contract as the application and default
to `postgresql://127.0.0.1:5432/postgres` when it is unset. The database named in that URL is only
the starting connection: tests leave it untouched and create temporary sibling databases on the
same PostgreSQL server.

The test project creates one migrated template database for the run. Every `itDatabase` test clones
that immutable template into a uniquely named database, uses the same Effect PostgreSQL client and
typed Drizzle binding as production, closes its pool, and drops the clone. Tests therefore share no
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
pnpm test:force
```

## Change persisted shape

1. Edit the source contract under `packages/model`.
2. Ensure `src/server/database/schema.ts` exposes any generated tables required by Drizzle Kit. The
   schema coverage test detects omissions.
3. Generate a descriptive migration:

   ```sh
   pnpm db:generate --name add_company_owner
   ```

4. Review the generated SQL for renames, destructive DDL, defaults, indexes, foreign keys, locks,
   and required backfills. Confirm that the generated snapshot is present; do not edit it by hand.
5. Validate the history and rebuild it through the integration tests:

   ```sh
   pnpm db:check
   pnpm test
   ```

Keep the model, schema projection, reviewed SQL, generated snapshot, implementation, and tests in
the same change.

### Initial baseline

Before the initial migration has been shared or applied outside a disposable local database, it may
be replaced with one reviewed `initial` migration. Once a migration may have reached another
developer or environment, never edit it; append a forward-only migration.

For SQL that Drizzle cannot derive, create an empty tracked migration:

```sh
pnpm db:generate:custom --name backfill_company_owner
```

Do not use `drizzle-kit push`. Every environment should exercise the same committed history.

### Deferrable audit constraints

Drizzle does not express PostgreSQL constraint deferrability. A migration that creates or replaces
the audit actor foreign keys on `objects` must retain `DEFERRABLE INITIALLY DEFERRED`; bootstrapping
the mutually dependent Root and system Actor requires those checks to run at transaction commit.
Integration tests verify this invariant.

## Reset local data

Reset is destructive and unrecoverable. It accepts only a loopback PostgreSQL host and requires the
exact database name as confirmation:

```sh
CONFIRM_DATABASE_RESET=company_os pnpm db:reset
```

Replace the value with the exact target database name. The committed local default is `company_os`.
Confirm the value in the central app's local environment before running the command.

The reset rebuilds the local database from the committed migration history and required seeds. It
deliberately refuses remote database URLs. Tests do not need it because each test receives an
isolated PostgreSQL database cloned from the migrated test template.

## Deploy

Run one migration job from the same immutable revision as the application:

```sh
DATABASE_URL="$PRODUCTION_DATABASE_URL" pnpm db:deploy
```

1. Verify a restore point and test risky migrations on a production-like copy.
2. Run the database job once; do not run it concurrently from every application instance.
3. Deploy or promote the compatible application only after the job succeeds.
4. Verify `/health` and the affected read/write operation.

Production migrations are forward-only. Application rollback does not roll back the database. Use
backward-compatible expand/contract changes while revisions may overlap, and append corrective
migrations when necessary. Never run `db:reset`, `drizzle-kit push`, or an automatically derived
production migration against a shared environment.
