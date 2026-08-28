# Database workflow

The central Company OS app uses `@company/postgres` with the Effect PostgreSQL driver. The portable
model is the source of truth for objects, properties, interfaces, ownership, Links, and uniqueness.
The app instantiates that projection, owns explicit SQL migrations, and binds the generated storage
to its repositories and services.

Run the commands below from the target `templates/company-os` or `apps/company-os` directory. From
the repository root, prefix a command with `pnpm --filter <package-name>`.

## Local setup

At the repository root, `pnpm dev` starts the isolated template PostgreSQL service, applies its
committed migrations, converges required records, and starts the central starter. Creating an owned
app with `pnpm create:app company-os` performs its declared bootstrap before returning.

Within the app package, the normal convergence command is:

```sh
pnpm db:deploy
```

`db:deploy` applies pending committed migrations and then idempotently converges the required Root,
system identity, principal sets, roles, and initial role assignments. It is safe to run repeatedly.

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

Replace the value with the exact target database name. The maintained central starter uses
`company_os_template`; an app created with the default configuration uses `company_os`. Confirm the
value in the target app's local environment before running the command.

The reset rebuilds the local database from the committed migration history and required seeds. It
deliberately refuses remote database URLs. Tests do not need it because they rebuild isolated PGlite
databases from the same history.

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
