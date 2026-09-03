<div align="center">
  <h1>Company OS</h1>
  <p><strong>Build the software your company runs on.</strong></p>
  <p>
    A source-available TypeScript foundation for company-owned operational software.<br />
    One model for the application, HTTP/OpenAPI, typed client, and MCP—backed by PostgreSQL.
  </p>
  <p>
    <strong>Early preview</strong> · Powered by <a href="https://continual.ai">Continual</a> · Runs standalone
  </p>
  <p>
    <a href="#quick-start"><strong>Quick start</strong></a> ·
    <a href="#try-the-included-operation"><strong>Example operation</strong></a> ·
    <a href="#how-it-works"><strong>Architecture</strong></a> ·
    <a href="#make-it-yours"><strong>Customize</strong></a>
  </p>
</div>

---

Company OS works end to end, but its model APIs and package boundaries may change before the first
stable release. The included CRM operation covers leads, companies, contacts, deals, line items,
and notes.

## What works today

- A typed business model with objects, properties, relationships, queries, and actions.
- PostgreSQL persistence, explicit migrations, and transactional business operations.
- Continual authentication by default, direct actor IDs, App-owned roles, and capability checks.
- A source-owned operating application built with TanStack Start and shadcn/ui.
- Generated HTTP endpoints, OpenAPI, a typed Effect client, and MCP tools from one model contract.
- A CRM example that exercises ordinary CRUD and a custom lead-conversion action end to end.

People, applications, integrations, and agents call the same governed operations. The repository
and database remain the authority for business rules and records.

## Quick start

You need PostgreSQL 18 or newer, Node.js 24 or newer, and pnpm 11 or newer.

```sh
git clone https://github.com/continual-ai/company-os.git
cd company-os
pnpm install
pnpm dev
```

Open the App through its Continual preview or deployment URL. Continual authenticates the user and
the App projects that `us_…` ID into its own role-assignable principal without issuing another user
ID. Create a lead, convert it, or inspect the model and generated interfaces in the **Developer
Center**.

`pnpm dev` runs each application's database migration task before starting its development server.
The central App uses `.env.example` as its local defaults, creates the configured database on local
PostgreSQL when needed, and applies migrations and required records. Injected environment variables
take precedence; create `.env.local` at the repository root or in `apps/company-os` only when your
local role, password, host, port, or database name differs. PostgreSQL itself must already be
running. Maintained template source is checked and built but does not run as an application until
it is copied into `apps/*`. Use Turbo's `--filter` option directly when you want to run only part of
the monorepo.

## Try the included operation

Lead conversion is a small example of a real business operation:

1. Create a lead in the application.
2. Choose **Convert** from the lead's row menu.
3. Company OS verifies the caller's capability.
4. One transaction creates the company and contact and records the conversion on the lead.
5. The same action is available through the application, HTTP API, typed client, and MCP.

The interfaces do not maintain separate copies of this rule. They project the same model contract
and call the same implementation.

## How it works

```text
people      applications      integrations      agents
   \              |                 |              /
    +-------------+-----------------+-------------+
                          |
                    UI / HTTP / MCP
                          |
                 model queries and actions
                          |
              authorization and business services
                          |
                       PostgreSQL
```

The browser-safe model declares the business contract. The Company OS application binds that
contract to authorization, transactions, and business services. HTTP, OpenAPI, the browser client,
and MCP are derived interfaces over the same governed implementation.

Code owns the work that must be predictable: durable state, permissions, invariants, transactions,
and consequential actions. AI can interpret information, research, plan, recommend, and handle
exceptions through those actions, with people deciding where approval is required.

## Repository map

| Path                                                             | Role                                                                      |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [`packages/runtime`](packages/runtime/README.md)                 | Portable model definitions and reusable execution and transport machinery |
| [`packages/model`](packages/model/README.md)                     | The browser-safe business contract shared by every interface              |
| [`packages/postgres`](packages/postgres/README.md)               | The server-only PostgreSQL implementation of runtime repository contracts |
| [`packages/ui`](packages/ui/README.md)                           | Shared design tokens and presentation primitives                          |
| [`apps/company-os`](apps/company-os/README.md)                   | Required central backend and operating application                        |
| [`templates/base`](templates/base/README.md)                     | Minimal starter for any optional application                              |
| [`templates/client-portal`](templates/client-portal/README.md)   | Starter for a customer-facing interface over governed capabilities        |
| [`templates/marketing-site`](templates/marketing-site/README.md) | Starter for the public website                                            |

`@company/*` is the stable import namespace for reusable source in this repository. It is not a
placeholder for a company name. Packages under `@company-template/*` identify runnable optional
app starters; adding one gives the copy its ordinary app package name.

For the complete dependency and authority model, read
[`docs/architecture.md`](docs/architecture.md). When changing the business contract, start with
[`docs/modeling.md`](docs/modeling.md).

## Add optional apps

Every checkout already contains one company model and one central application. `templates/*`
contains executable starters for optional focused interfaces. `apps/*` contains ordinary
company-owned source; added apps never import template source.

```sh
pnpm app:create
pnpm app:create base vendor-portal
pnpm turbo run dev --filter=vendor-portal
```

The chosen app name becomes the directory under `apps/`, the package name, and the permanent app
key on any hosting platform.
The command refuses to overwrite an existing app, rewrites the package for its normal identity,
installs the workspace, and runs the template's declared bootstrap checks. Templates remain
runnable on isolated ports for evaluating them before adding one.

## Make it yours

A fork is meant to become your company's software, not another generic multi-tenant SaaS instance.
The repository is already a complete project: customize its one model and central app directly.

- [`packages/model/src/metadata.ts`](packages/model/src/metadata.ts) names the
  company model.
- [`apps/company-os/src/customization`](apps/company-os/src/customization) owns product identity,
  entry, home, and navigation.
- [`packages/model/src/modules/sales`](packages/model/src/modules/sales) is the
  replaceable example business module.
- [`apps/company-os/src/server/modules`](apps/company-os/src/server/modules) owns private business
  implementations.

The repository includes coding-agent skills for onboarding a company, extending an established
fork, and incorporating upstream improvements:

```text
Use $company-onboard to adapt this repository to Acme and build our customer onboarding process.
Track the customer, milestones, owners, blockers, and launch date. Let an agent prepare follow-ups,
but require a person to approve anything sent to the customer.
```

See [`apps/company-os/README.md`](apps/company-os/README.md) for the central application's
architecture and the repository map above for each package's public boundary.

## Continual

Company OS runs and can be customized independently. [Continual](https://continual.ai) is the
optional platform being built to customize, deploy, upgrade, connect, and operate Company OS forks.
The fork remains authoritative for its source, business policy, and records.

## Development

| Command                         | Purpose                                                  |
| ------------------------------- | -------------------------------------------------------- |
| `pnpm dev`                      | Migrate and run every application development task       |
| `pnpm reset`                    | Destructively rebuild local application state            |
| `pnpm deploy`                   | Run application deployment tasks; currently placeholders |
| `pnpm app:create`               | List optional application templates                      |
| `pnpm app:create client-portal` | Create and bootstrap an optional client portal           |
| `pnpm format`                   | Format the repository                                    |
| `pnpm lint`                     | Lint every workspace package                             |
| `pnpm check`                    | Check formatting, lint, boundaries, dead code, and types |
| `pnpm test`                     | Run the repository test suite using the Turbo cache      |
| `pnpm build`                    | Build every application                                  |

Oxlint owns source lint and Company OS ownership rules. Turbo validates declared package
dependencies and dispatches package tasks such as model validation, tests, typechecking, and
builds. Installing dependencies automatically connects the compatible Effect diagnostics to
Oxlint; there is no separate developer command for that integration.

Repository-wide working constraints live in [`AGENTS.md`](AGENTS.md). Product and ownership context
for coding agents lives in [`.agents/skills`](.agents/skills).

Focused documentation lives under [`docs`](docs/README.md):

- [Architecture](docs/architecture.md) explains package responsibilities and authority.
- [Modeling](docs/modeling.md) explains the semantic vocabulary and relationship choices.
- [Database workflow](docs/runbooks/database.md) covers migrations, resets, and deployment.

## License

Company OS is source-available under the [Elastic License 2.0](LICENSE.md). You may use, modify,
and redistribute it subject to the license, including its restriction on providing the software to
third parties as a hosted or managed service.
