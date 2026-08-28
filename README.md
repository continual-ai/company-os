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
- Authentication, users, service accounts, API keys, sessions, roles, and capability checks.
- A source-owned operating application built with TanStack Start and shadcn/ui.
- Generated HTTP endpoints, OpenAPI, a typed Effect client, and MCP tools from one model contract.
- A CRM example that exercises ordinary CRUD and a custom lead-conversion action end to end.

People, applications, integrations, and agents call the same governed operations. The repository
and database remain the authority for business rules and records.

## Quick start

You need Docker, Node.js 22.12 or newer, and pnpm 11. The repository also includes a `mise.toml`
for installing the pinned toolchain with [mise](https://mise.jdx.dev/).

```sh
git clone https://github.com/continual-ai/company-os.git
cd company-os
pnpm install
pnpm setup
pnpm dev
```

Open <http://localhost:3002> and choose a local development identity. Create a lead, convert it,
or inspect the model and generated interfaces in the **Developer Center**.

`pnpm dev` runs Company OS. Use `pnpm dev:all` to also run the example client portal at
<http://localhost:3001> and marketing site at <http://localhost:3000>.

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

## Make it yours

A fork is meant to become your company's software, not another generic multi-tenant SaaS instance.
Start with one operation and change ordinary source code:

- [`packages/company/model/src/metadata.ts`](packages/company/model/src/metadata.ts) names the
  company model.
- [`apps/company-os/src/customization`](apps/company-os/src/customization) owns product identity,
  entry, home, and navigation.
- [`packages/company/model/src/modules/sales`](packages/company/model/src/modules/sales) is the
  replaceable example business module.
- [`apps/company-os/src/server/modules`](apps/company-os/src/server/modules) contains custom
  business implementations.

The repository includes coding-agent skills for onboarding a company, extending an established
fork, and incorporating upstream improvements:

```text
Use $company-onboard to adapt this repository to Acme and build our customer onboarding process.
Track the customer, milestones, owners, blockers, and launch date. Let an agent prepare follow-ups,
but require a person to approve anything sent to the customer.
```

See [`apps/company-os/README.md`](apps/company-os/README.md) for the application architecture and
the package READMEs for their public boundaries.

## Continual

Company OS runs and can be customized independently. [Continual](https://continual.ai) is the
optional platform being built to customize, deploy, upgrade, connect, and operate Company OS forks.
The fork remains authoritative for its source, business policy, and records.

## Development

| Command      | Purpose                                                  |
| ------------ | -------------------------------------------------------- |
| `pnpm dev`   | Apply migrations and run Company OS                      |
| `pnpm check` | Check formatting, lint, boundaries, dead code, and types |
| `pnpm test`  | Run the repository test suite                            |
| `pnpm build` | Build every application                                  |

Repository-wide constraints live in [`AGENTS.md`](AGENTS.md). Product and ownership context for
coding agents lives in [`.agents/skills`](.agents/skills).

## License

Company OS is source-available under the [Elastic License 2.0](LICENSE.md). You may use, modify,
and redistribute it subject to the license, including its restriction on providing the software to
third parties as a hosted or managed service.
