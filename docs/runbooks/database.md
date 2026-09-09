# Database workflow

The composed model in `app.model.ts` is the source of truth for tables, properties, interfaces,
ownership, Links, uniqueness, and the search projection. `apps/company-os/schema.sql` is the current
projection and `src/app/server/database/migrations/` is the applied history. The app owns both; the
kernel supplies the projection and the migration runner in `runtime/server/storage` and
`runtime/server/migrations.ts`.

Run commands from the repository root with `pnpm --filter company-os <task>`.

| Task          | Purpose                                                                        |
| ------------- | ------------------------------------------------------------------------------ |
| `db:generate` | Regenerate `schema.sql` from the model; `--baseline` also rewrites migration 1 |
| `db:check`    | Fail when `schema.sql` or the last migration's hash disagrees with the model   |
| `db:migrate`  | Apply committed migrations, ensure system records, refresh the search index    |
| `db:seed`     | Create required system records in a development database                       |
| `db:reset`    | Destructively rebuild a local database                                         |

## Local development

`pnpm dev` runs `db:migrate` before the development server. `apps/company-os/.env.example` supplies
`postgresql://localhost:5432/company_os`; create `.env.local` at the repository root or in the app
when connection details differ, and note that injected environment variables win over both. The
migration creates the database when it targets local PostgreSQL, then applies committed migrations
and ensures the Root and system Actor. It does not install or start PostgreSQL. Verified identities
bind to local User or ServiceAccount records at sign-in; roles follow the bootstrap policy in
[deployment](deployment.md).

## Tests

Files named `*-database.test.ts` run in the `database` Vitest project against real PostgreSQL. The
role must have `CREATEDB`. `DATABASE_URL` selects the server (default
`postgresql://localhost:5432/postgres`); that database is only the starting connection and is never
modified. Each distinct schema gets one template database per run, built once behind an advisory
lock and shared by every file that uses it. Each test file clones its template once; before every
test the clone is truncated and its journal position restored, then the test runs through the
production `Database` binding. Files run concurrently, tests within a file sequentially, and the
global teardown drops every `company_os_test_*` database. Use a direct connection rather than a
transaction pooler.
`pnpm turbo run test --force` bypasses the Turbo cache after changing the server.

## Change the persisted shape

While the checkout is a disposable template, edit the model and regenerate the baseline:

```sh
pnpm --filter company-os db:generate --baseline
pnpm format
```

`--baseline` rewrites migration 1, so it is only for data nobody needs. Use a fresh database
afterwards.

Once a deployment retains data:

1. Edit the model and run `pnpm --filter company-os db:generate` to update `schema.sql` only.
2. Add a numbered migration file beside `0001-initial.ts` with `id`, `name`, `sql`, and the
   `schemaHash` of the new `schema.sql`; write SQL that preserves existing records. Register it in
   `migrations/index.ts`. Applied files never change.
3. Add a migration test that preserves representative records and run
   `pnpm check` and `pnpm turbo run test --force`.
4. Apply it with `db:migrate` before starting the new application version.

The ledger records each migration's SQL checksum and resulting schema hash. Startup refuses pending
migrations, edited history, and a model whose projection differs from the last applied hash, so an
enabled-list change never needs a migration but a definition change always does. Migrations stay
schema-relative: no `public.` qualification and no cross-schema references. The schema parity test
compares the migrated database's catalog with a fresh replay of `schema.sql`, so it needs only the
PostgreSQL server.

## Reset local data

```sh
CONFIRM_DATABASE_RESET=company_os pnpm reset
```

Reset accepts only a loopback host and requires the exact database name. It rebuilds the local
database from committed history and system records. Tests never need it.

## Production

The app's `deploy` task migrates whenever `DATABASE_URL` is configured, then publishes the built
output. Other hosts must preserve build, migrate, publish, or run the migration explicitly from the
same revision:

```sh
DATABASE_URL="$PRODUCTION_DATABASE_URL" pnpm turbo run db:migrate --filter=company-os
```

Take a restore point, run the job once rather than from every instance, promote the compatible
application only after it succeeds, then verify `/health` and one authenticated read and write.
Migrations are forward-only; rolling back the application does not roll back the database, so use
expand/contract changes while revisions overlap. Never run `db:reset` or a regenerated baseline
against a shared environment.
