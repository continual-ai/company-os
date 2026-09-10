# Development

[Back to the README](../README.md)

Build against the model; write the migration when the feature is ready.

| Command                      | Purpose                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| `pnpm db:reset`              | Rebuild the disposable local database from the model and refresh `schema.sql`         |
| `pnpm db:migration <name>`   | Create the next SQL migration draft with structural diff hints                        |
| `pnpm db:migrate`            | Apply completed migrations to a database with migration history, or an empty database |
| `pnpm dev`                   | Run the apps                                                                          |
| `pnpm check`                 | Lint, typecheck, generated schema/model checks, formatting, and dead code             |
| `pnpm test`                  | Test application behavior against the current model                                   |
| `pnpm test:migrations`       | Verify migration replay matches the model before delivery                             |
| `pnpm build`                 | Build the apps                                                                        |
| `pnpm format`                | Format the repository                                                                 |
| `pnpm ui:add <component>`    | Add a shadcn primitive to `packages/ui`                                               |
| `pnpm ui:remove <component>` | Remove an unused primitive                                                            |

**While building:** edit the model and application, run `pnpm db:reset` after storage changes,
and use the app. Reset discards the configured local schema's data, restores system records and
search, and leaves all migration files untouched. It refuses remote hosts and PostgreSQL system
databases. Run `pnpm db:seed --scenario demo` when you want fictional records.

**When ready:** run `pnpm db:migration add_owner`. It replays existing migrations and the current
model in separate scratch databases, then creates a numbered `.sql` file in
`apps/company-os/src/app/server/database/migrations/`. The draft contains structural differences
as comments and a failing placeholder. Have your agent replace the placeholder with reviewed SQL;
renames, backfills, and other business transformations need your intent. A supplied name creates a
draft even without structural differences, for data-only changes. Without a name, an unchanged
schema creates no file. Finish an existing draft before asking for another.

Run `pnpm test:migrations` to verify the upgrade, and add retained-data tests for transformations.
Ordinary application tests use the current model, so they work before the migration is written.
CI runs both suites. Commit the model, `schema.sql`, migration, and relevant tests together.
Migration files run in numbered order; never rewrite applied files. Documentation-only changes
in generated SQL comments do not require migrations.

**When applying:** point `DATABASE_URL` at an empty database or one with migration history and run
`pnpm db:migrate`. A development database created by `db:reset` has no migration history and is
intentionally refused; use the isolated migration tests to verify delivery instead of upgrading
that disposable database.

Migration drafting and database tests need a PostgreSQL role with `CREATEDB`. Scratch databases
are removed afterward. Tests default to `postgresql://localhost:5432/postgres`; commands use the
application's configured connection. After changing the database environment,
`pnpm turbo run test --force` bypasses cached test results. For inspecting a retained database,
`pnpm --filter company-os db:dump` writes an ignored `schema.actual.sql` using `pg_dump` (the
server's major version or newer).

## Application structure

Business code lives in `apps/company-os/src/modules`; the kernel is in `src/runtime` and the shell
in `src/app`. `app.model.ts` composes every module. Administrators explore and enable modules in
Settings > Platform > Modules. Activation is stored in the database and controls UI, HTTP, and MCP,
leaving disabled modules' data intact. Platform is always enabled. Enabling a
module also enables its dependencies; turning one off asks you to confirm any dependent modules. Newly added optional modules
start disabled on existing installations; an initial setup enables all installed modules.
Change product identity and the entry experience in `src/app/customization`.

[AGENTS.md](../AGENTS.md) holds repository conventions. The skills point to working source examples;
code, tests, and generated contracts define the implementation. `apps/client-portal` is an optional
satellite over the central app's API; delete it if unnecessary or copy it for another interface.

### Page spacing

Compose layouts with `PageHeader`, `PageToolbar`, `PageContent`, and `PageSectionHeader` from
`@company/ui/page`. Headers and content share a 16px gutter; toolbar rows are at least 48px and
grow when controls wrap. Content sections are separated by 24px. `PageHeader.navigation` owns the
bottom divider alignment; use `TabsList variant="header"` there without tab spacing overrides.
The containing page or panel owns padding once, so custom tab content must not add another outer
gutter. Tables remain edge-to-edge. Sidebar rows use 8px outer plus 8px inner padding, aligning their
content at 16px; their compact row rhythm is independent of page toolbars. Cards and controls own
their internal spacing. Use `p-page-gutter` directly only when a layout cannot use these components.

### Browser preferences

Use `useLocalPreference` from `@company/ui/local-preferences` for browser-local presentation
preferences. The app shell supplies `LocalPreferencesProvider` with an app and user namespace.
Each preference has a stable key, default value, and validator; change the key when its stored shape
changes incompatibly. Reads are SSR-safe, invalid values use the default, and blocked storage falls
back to the current session. Resize controls keep live interaction state and save only on completion,
keyboard adjustment, or explicit reset. Viewport constraints must not overwrite the saved preference.
Keep credentials and authoritative business data out of this store.
