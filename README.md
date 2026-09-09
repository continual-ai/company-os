<div align="center">
  <h1>Company OS</h1>
  <p><strong>Build the software your company runs on.</strong></p>
  <p>
    One editable TypeScript application for business operations.<br />
    Your records, rules, and workflows, governed the same way for people, integrations, and agents.
  </p>
  <p><strong>Early preview</strong> · TypeScript · Effect v4 · React · PostgreSQL</p>
  <p>
    <a href="#quick-start">Quick start</a> ·
    <a href="#make-it-yours">Make it yours</a> ·
    <a href="#deployment">Deployment</a>
  </p>
</div>

Company OS is one application you clone and own. A module defines business records and operations
in TypeScript; the model supplies PostgreSQL storage, governed CRUD, a typed client, HTTP APIs,
MCP tools, and default screens. Custom rules are Effect functions and custom screens are React.
You own the source and database.

The repository runs locally without a Continual account. [Continual](https://continual.ai) maintains
the project and offers optional hosting. Company OS is open source under the
[Apache License 2.0](LICENSE).

## Quick start

Install Node.js 24.14+ (or 25.4+), pnpm 11, and PostgreSQL 18+. PostgreSQL must be running and your
local role must be able to create a database.

```sh
git clone https://github.com/continual-ai/company-os.git
cd company-os
pnpm install --frozen-lockfile
pnpm db:reset
pnpm dev
```

Open **[localhost:3002](http://localhost:3002)**. Development signs you in as a local administrator;
no OAuth setup or hosted service is needed. `pnpm db:reset` creates the local database from the current
model and initializes system records. It deletes existing local data. `pnpm dev` starts the apps. The default database is `postgresql://localhost:5432/company_os`.
Put overrides in an ignored `.env.local`; see [`.env.example`](apps/company-os/.env.example) for
configuration. Injected environment values take precedence.

For fictional development data, run `pnpm db:seed --scenario demo`. Reruns preserve your edits.
The Developer Center at `/developer` explores the live model, API, and MCP tools;
[`/api/openapi`](http://localhost:3002/api/openapi) serves the generated OpenAPI contract.

## Make it yours

Tell your coding agent the outcome, who uses it, and the scope. Two skills guide the work:

| Skill                                          | Use it for                                                |
| ---------------------------------------------- | --------------------------------------------------------- |
| [onboard](.agents/skills/onboard/SKILL.md)     | Initial company setup and the first working process       |
| [customize](.agents/skills/customize/SKILL.md) | Features, UI, architecture, reviews, and upstream updates |

> Use $onboard to set this up for our company. Start with customer onboarding: customers,
> milestones, owners, blockers, and launch dates.

> Use $customize to add hiring: jobs, candidate applications, and employee or agent reviews.
> Backend only for now; prepare public application submission and keep reviews private.

> Use $customize for a deep architecture review of the application submission flow.
> Rank correctness risks and simplifications by impact; review only.

Business code lives in `apps/company-os/src/modules`; the kernel is in `src/runtime` and the shell
in `src/app`. `app.model.ts` composes every module. Administrators explore and enable modules in
Settings > Platform > Modules. Activation is stored in the database and controls UI, HTTP, and MCP,
leaving disabled modules' data intact. Access, Assets, and Platform are always enabled. Enabling a
module also enables its dependencies; turning one off asks you to confirm any dependent modules. Newly added optional modules
start disabled on existing installations; an initial setup enables all installed modules.
Change product identity and the entry experience in `src/app/customization`.

[AGENTS.md](AGENTS.md) holds repository conventions. The skills point to working source examples;
code, tests, and generated contracts define the implementation. `apps/client-portal` is an optional
satellite over the central app's API; delete it if unnecessary or copy it for another interface.

## Development

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

## Deployment

Configure the server and identity values in [`.env.example`](apps/company-os/.env.example).
Production requires an explicit database connection, deployment secret, and trusted identity provider;
the local administrator fallback is disabled. Configure the first administrator's verified issuer
and subject before their first sign-in. Other verified identities receive no role unless configured
or granted one. Only `VITE_` values are public.

For Continual hosting:

```sh
pnpm exec continual login
pnpm exec continual link --project <project-id-or-url>
pnpm exec continual env pull
pnpm deploy
```

Deploy builds `.output`, migrates the configured database, then publishes. Other hosts must preserve
that order and configure a trusted identity boundary. Keep a restore point before production
migrations and use changes compatible with overlapping app revisions; an app rollback does not undo
a migration. Verify `/health` and an authenticated read and write after deployment. Satellites set
`COMPANY_OS_URL` to the central app and forward verified identity headers.
