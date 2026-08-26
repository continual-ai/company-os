# Company OS

**Build the software your company runs on.**

Company OS is a working TypeScript application for turning a business process into software your
team can run and change. It keeps the business model, PostgreSQL data, permissions, audited
actions, internal interface, HTTP API, typed client, and MCP tools in one repository.

People, applications, integrations, and agents use the same actions. You keep the code and data.
The goal is simple: operations that keep moving on their own, while people stay in control of the
decisions that matter.

## What this repository does

A business operation starts with work: a new lead, an order, a support request, an invoice, or an
incident. Company OS provides the durable system around that work:

- typed business records and relationships;
- rules, permissions, and actions in TypeScript;
- PostgreSQL persistence and explicit migrations;
- an application for the people doing the work;
- generated OpenAPI, a typed client, and MCP tools; and
- one implementation of each action, regardless of who calls it.

Code handles the parts that must be predictable. AI can handle interpretation, research,
planning, and exceptions. People decide which actions require approval. Changes remain ordinary
source changes that can be reviewed, tested, and reversed.

## Try the included operation

The example company includes a small CRM model with companies, contacts, leads, deals, line items,
and interactions. It is deliberately compact, but it exercises the same path a larger operation
uses.

One useful example is lead conversion:

1. Create a lead in the application.
2. Choose **Convert** from the lead's row menu.
3. Company OS checks the caller's permission.
4. One transaction creates the company and contact and records the conversion on the lead.
5. The same action is available through the application, HTTP API, typed client, and MCP.

The interface, API, and agent tools do not maintain separate copies of the business rule. They all
call the same implementation.

## Quick start

You need Docker, Node.js 22.12 or newer, and pnpm 11. The repository includes a `mise.toml` if you
use [mise](https://mise.jdx.dev/); run `mise trust && mise install` to install the pinned versions.

```sh
pnpm install
pnpm setup
pnpm dev
```

Open <http://localhost:3002>, choose the local administrator identity, and create or convert a
lead. The **Develop** section shows the model, generated API, SDK, MCP surface, and design system
behind the operation.

`pnpm dev` starts the Company OS application. Use `pnpm dev:all` to also start the example client
portal at <http://localhost:3001> and marketing site at <http://localhost:3000>.

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

The model declares the company's objects, relationships, queries, and actions. The application
binds that contract to authorization and business services, then derives its HTTP, OpenAPI, typed
client, and MCP surfaces from the same definition. PostgreSQL remains the authority for durable
records.

The included `convert` action demonstrates the boundary: its public definition lives beside the
Lead model, its implementation owns the permission check and transaction, and every interface
projects that same implementation.

Follow the working path through the repository:

1. [`Lead`](packages/company/model/src/objects/lead.ts) defines the object and `convert` action.
2. [`Model`](packages/company/model/src/index.ts) closes and validates the company contract.
3. [`Storage`](apps/company-os/src/server/database/schema.ts) compiles the model into PostgreSQL.
4. [`LeadService`](apps/company-os/src/server/objects/lead-service.ts) implements conversion.
5. [`ModelImplementation`](apps/company-os/src/server/model-implementation.ts) binds the model to
   its services.
6. HTTP, OpenAPI, the typed client, and MCP derive from that binding.

## Make it yours

A fork is meant to become one company's software, not a generic multi-tenant instance. Start with
the parts of the company that change most often:

- [`metadata.ts`](packages/company/model/src/metadata.ts) names the company model.
- [`config.ts`](apps/company-os/src/customization/config.ts) owns product identity and first-launch
  copy.
- [`entry.tsx`](apps/company-os/src/customization/entry.tsx) owns the company-specific entry
  experience.
- [`home.tsx`](apps/company-os/src/customization/home.tsx) owns the first authenticated screen.
- [`navigation.ts`](apps/company-os/src/customization/navigation.ts) chooses the visible operating
  surfaces.
- [`crm-definitions.ts`](packages/company/model/src/crm-definitions.ts) is the replaceable example
  business model.

Those files are ordinary source code, not a page schema or plugin system. A real operation should
extend the model, migrations, business services, interface, and tests together.

### Build with a coding agent

The repository includes skills for coding agents that understand its ownership and architecture:

- `$company-onboard` adapts a fresh fork to a company and its first operation.
- `$company-customize` changes an established fork without splitting business rules across the UI,
  API, and agents.
- `$company-upgrade` brings upstream improvements into a customized fork.

For example:

```text
Use $company-onboard to adapt this repository to Acme and build our customer onboarding process.
Track the customer, implementation milestones, owners, blockers, and launch date. Let an agent
prepare follow-ups, but require a person to approve anything sent to the customer.
```

The agent changes the same source, migrations, application, and tests that a developer would. The
result is not trapped in a prompt or a hosted editor.

## Build with Continual

[Continual](https://continual.ai) can take a description of your company and the operation you want
and turn it into a customized, running version of this repository. It adds prompt-based building,
deployment, upgrades, connections, and operated agents around the codebase.

Company OS does not require Continual. You can run and change it yourself, and the company's
business rules and records remain in its application and database rather than becoming a second
copy inside the hosted platform.

## Repository

```text
apps/
  company-os/       Backend and operating application
  client-portal/    Example customer-facing application
  marketing-site/   Example public website

packages/
  company/
    model/          Browser-safe company model
    postgres/       PostgreSQL storage adapter
    runtime/        Portable definitions and projections
    ui/             Components and design tokens
```

The package and application READMEs document their boundaries:

- [`apps/company-os`](apps/company-os/README.md)
- [`apps/client-portal`](apps/client-portal/README.md)
- [`apps/marketing-site`](apps/marketing-site/README.md)
- [`packages/company/model`](packages/company/model/README.md)
- [`packages/company/postgres`](packages/company/postgres/README.md)
- [`packages/company/runtime`](packages/company/runtime/README.md)
- [`packages/company/ui`](packages/company/ui/README.md)

Repository-wide constraints live in [`AGENTS.md`](AGENTS.md). Product and ownership context for
coding agents lives in [`.agents/skills`](.agents/skills).

## Commands

| Command                   | Purpose                                                  |
| ------------------------- | -------------------------------------------------------- |
| `pnpm setup`              | Start PostgreSQL and apply migrations and seeds          |
| `pnpm dev`                | Run Company OS                                           |
| `pnpm dev:all`            | Run all three example applications                       |
| `pnpm check`              | Check formatting, lint, boundaries, dead code, and types |
| `pnpm test`               | Run repository tests                                     |
| `pnpm build`              | Build every application                                  |
| `pnpm format`             | Format the repository                                    |
| `pnpm ui:add <component>` | Add a shared shadcn component                            |

## Project status

Company OS is under active development. The application and example operation work today, but the
model APIs and package boundaries are not yet stable. Code and tests define current behavior;
future ideas in issues or agent skills are not shipped features.

## License

Company OS is available under the [Elastic License 2.0](LICENSE.md). You may use, modify, and
redistribute it subject to that license, including its restriction on providing the software to
third parties as a hosted or managed service.
