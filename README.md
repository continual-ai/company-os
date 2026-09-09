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
pnpm dev
```

Open **[localhost:3002](http://localhost:3002)**. Development signs you in as a local administrator;
no OAuth setup or hosted service is needed. `pnpm dev` creates the local database, applies committed
migrations, and starts the app. The default database is `postgresql://localhost:5432/company_os`.
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
in `src/app`. `app.model.ts` composes every module. `app.config.ts` selects the modules exposed to
UI, HTTP, and MCP, leaving disabled modules' data intact. Access and Assets are always enabled.
Change product identity and the entry experience in `src/app/customization`.

[AGENTS.md](AGENTS.md) holds repository conventions. The skills point to working source examples;
code, tests, and generated contracts define the implementation. `apps/client-portal` is an optional
satellite over the central app's API; delete it if unnecessary or copy it for another interface.

## Development

| Command                                | Purpose                                                         |
| -------------------------------------- | --------------------------------------------------------------- |
| `pnpm dev`                             | Migrate and run the apps                                        |
| `pnpm check`                           | Lint, typecheck, schema/model checks, formatting, and dead code |
| `pnpm test`                            | Unit tests and isolated PostgreSQL tests                        |
| `pnpm build`                           | Build the apps                                                  |
| `pnpm format`                          | Format the repository                                           |
| `pnpm --filter company-os db:generate` | Regenerate `schema.sql` after model changes                     |
| `pnpm --filter company-os db:migrate`  | Apply committed migrations and refresh system records/search    |
| `pnpm ui:add <component>`              | Add a shadcn primitive to `packages/ui`                         |
| `pnpm ui:remove <component>`           | Remove an unused primitive                                      |

Tests need a PostgreSQL role with `CREATEDB` at `DATABASE_URL` (default
`postgresql://localhost:5432/postgres`). They create and remove isolated databases. After changing
the database environment, `pnpm turbo run test --force` bypasses cached results.

Model changes need a matching migration. `db:generate --baseline` rewrites the initial migration
and is only for disposable data. For retained data, add a numbered migration and test that existing
records survive; never rewrite applied history. To intentionally rebuild a disposable local database,
use `CONFIRM_DATABASE_RESET=company_os pnpm reset`, substituting its exact database name.

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
