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
    <a href="#enable-and-add-modules">Modules</a> ·
    <a href="docs/modules.md">Build a module</a> ·
    <a href="docs/architecture.md">Architecture</a>
  </p>
</div>

Company OS is one application you clone and own. It ships with a kernel, a set of proven business
modules, and a shell. Every module is composed and migrated; a short list in `app.config.ts` decides
which ones your company exposes. Start with the modules that fit, turn off the rest, and let an agent
or an engineer build the operations that are yours alone. You own the source and the database.

A module defines its objects and operations in TypeScript. That contract supplies PostgreSQL storage,
validated APIs, a typed client, MCP tools, and default tables, forms, and record pages. Business rules
are Effect functions; custom screens are ordinary React components. The same server-side permissions
and transactions apply whether a person clicks a button or an agent calls a tool.

The repository runs locally without a Continual account. [Continual](https://continual.ai) maintains
the project and offers optional hosting. Company OS is **source-available under
[Elastic License 2.0](LICENSE.md)**. Its APIs are still evolving.

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
no OAuth setup, API key, bucket, or hosted service is needed. `pnpm dev` creates the local database,
applies the committed migrations, and starts the app. The default connection is
`postgresql://localhost:5432/company_os`; set `DATABASE_URL` in an ignored `.env.local` for another
endpoint. See the [database guide](docs/runbooks/database.md).

The OpenAPI document is at [`/api/openapi`](http://localhost:3002/api/openapi). The Developer Center
at `/developer` explores the model, the API, and the MCP tools.

## Enable and add modules

`apps/company-os/src/app.model.ts` composes every module. `apps/company-os/src/app.config.ts` lists
the ones the UI, API, and MCP expose:

```ts
export const enabledModules = [
  "access",
  "assets",
  "notes",
  "sales",
  "support",
] as const
```

Remove an id and its screens, endpoints, and tools disappear while its tables and data stay. The
list must be closed under dependencies; the app tells you which module is missing otherwise. Access
and Assets are part of the kernel and are always on.

To add your own capability, create a directory under `apps/company-os/src/modules` with the same
shape as the shipped ones and register it in the four roots:

```text
apps/company-os/src/modules/sales/
  model/index.ts                 defineModule: objects, links, interfaces, events
  model/lead.ts                  one object and its operation contracts
  server/index.ts                custom operation bindings
  server/convert-lead.ts         a transactional business action
  ui/index.ts                    presentation registration
  ui/lead/conversion-tab.tsx     an ordinary React component
  seeds/index.ts                 fixture builders
```

Only `model/` is required. A standard object gets persistence, governed CRUD, APIs, MCP tools, and
usable screens without its own service or route files. [Building a module](docs/modules.md) walks
through custom actions, React extensions, and client data access.

## How it is organized

```text
apps/company-os/src/
  runtime/     the kernel: model DSL, execution, storage, authorization, events, UI foundation
  modules/     the business: one directory per module, all the same shape
  app/         the shell: layout, settings, sign-in, developer pages, client assembly
  routes/      TanStack Start routes, generic over the model
  app.model.ts  app.config.ts  app.server.ts  app.ui.ts
```

Change things in this order: add a module, then edit a shipped module, then edit the kernel. Upstream
improvements arrive with `git merge`; keeping kernel edits rare keeps merges clean. The lint rules in
`tools/oxlint/company-os` enforce the import direction between the three directories.

```text
React UI       Typed client       HTTP / OpenAPI       MCP tools
    \               |                   |                /
     +--------------+-------------------+---------------+
                            |
                   Queries and Actions
                            |
             Identity → authorization → operations
                            |
                 PostgreSQL transactions
```

A [durable event journal](docs/events.md) records committed changes and typed business facts; open
browsers apply authorized snapshots and refresh affected queries. [Architecture](docs/architecture.md)
explains the guarantees and boundaries.

## Make it yours

Change product identity and the entry experience in `apps/company-os/src/app/customization`, set the
enabled modules, then build your operation in `apps/company-os/src/modules`. The agent skills under
`.agents/skills` help with onboarding, customization, and upstream upgrades. A useful first prompt:

> Use $company-onboard to build our customer onboarding process. Track customers, milestones,
> owners, blockers, and launch dates. Let an agent prepare follow-ups, with a person approving
> anything sent to a customer. Build one working operation through the UI and API.

Need a separate portal or public site? `pnpm app:create base vendor-portal` copies the
[base starter](templates/base/README.md), which consumes the central app's model and governed API.
See [deployment](docs/runbooks/deployment.md) for production builds and identity.

## Development

| Command                                | Purpose                                                      |
| -------------------------------------- | ------------------------------------------------------------ |
| `pnpm dev`                             | Migrate and run the app                                      |
| `pnpm check`                           | Lint, typecheck, schema check, model lint, format, dead code |
| `pnpm test`                            | Unit tests and isolated PostgreSQL tests                     |
| `pnpm build`                           | Build the app and the starter                                |
| `pnpm format`                          | Format source and documentation                              |
| `pnpm --filter company-os db:generate` | Regenerate `schema.sql` from the composed model              |
| `pnpm ui:add <component>`              | Add a shadcn primitive to `src/runtime/ui/components`        |
| `pnpm ui:remove <component>`           | Remove a primitive after proving nothing imports it          |

Tests need a PostgreSQL role with `CREATEDB`; they create and remove isolated databases. [AGENTS.md](AGENTS.md)
holds the repository-wide constraints that contributors and agents follow.

## License

[Elastic License 2.0](LICENSE.md). Read the license before redistributing Company OS or offering it
as a hosted service.
