# Company OS

The source-owned software a company runs on.

Company OS is a standalone TypeScript scaffold for defining a company's business model and
implementing governed capabilities for internal software, customer experiences, integrations, and
agents.

This repository uses **Acme** as the example company. Acme owns `@acme/*` and `apps/*`. Reusable
framework code lives in `@continual/*` and does not require the hosted Continual platform.

The scaffold is intentionally early. Current APIs and package shapes are working experiments, not
a frozen product specification. Code and tests describe current behavior; the repository skills
capture only product and ownership context that cannot be recovered from code.

## Mental model

```text
@acme/api                  Acme's browser-safe business contract
    +
@continual/runtime         reusable definition and projection machinery
    |
@continual/postgres        reusable PostgreSQL storage adapter
    |
apps/company-os            Acme's private backend and management application
    |
    +-- client portal, marketing site, integrations, and agents
```

The working product hypothesis is that these interfaces should share governed business meaning
rather than grow into independent authorities. The exact semantic model, protocols, client shape,
and runtime boundaries remain open to evidence from real slices.

The current example model separates typed objects, bidirectional links, and governed actions.
Objects are readable by convention, CRUD actions are available by default, and additional actions
express business behavior that can change several objects and links together.

## Follow one company object

The Lead example shows how the current boundaries build on one source-owned definition without
redeclaring its business shape:

1. [`Lead`](packages/acme/api/src/objects/lead.ts) defines the portable business object.
2. [`AcmeModel`](packages/acme/api/src/index.ts) closes and validates the company contract.
3. [`AcmeStorage`](apps/company-os/src/server/database/schema.server.ts) compiles that contract into
   company-owned PostgreSQL storage and physical overrides.
4. [`LeadRepository`](apps/company-os/src/server/objects/lead-repository.server.ts) binds the shared
   PostgreSQL adapter to the Lead object.
5. [`LeadService`](apps/company-os/src/server/objects/lead-service.server.ts) adds Acme's
   authorization to the standard object behavior.
6. The [composition root](apps/company-os/src/server/composition-root.server.ts) assembles the
   repositories and services and derives the API description and HTTP contract from `AcmeModel`.

This is a guide to the working slice, not a requirement that every future capability add the same
layers. Each boundary should continue to earn its place through a concrete responsibility.

## Repository

```text
apps/
  company-os/       Full-stack backend and management application
  client-portal/    Customer-facing application
  marketing-site/   Public website

packages/
  acme/
    api/            Acme's browser-safe contract source
    ui/             Acme's shared components and design tokens
  continual/
    postgres/       Reusable PostgreSQL storage adapter
    runtime/        Reusable definitions and projections
```

Each boundary has a focused README:

- [`apps/company-os`](apps/company-os/README.md)
- [`apps/client-portal`](apps/client-portal/README.md)
- [`apps/marketing-site`](apps/marketing-site/README.md)
- [`packages/acme/api`](packages/acme/api/README.md)
- [`packages/acme/ui`](packages/acme/ui/README.md)
- [`packages/continual/postgres`](packages/continual/postgres/README.md)
- [`packages/continual/runtime`](packages/continual/runtime/README.md)

Repository-wide constraints live in [`AGENTS.md`](AGENTS.md). The `$company-os` and `$continual`
skills are optional design context, not implementation specifications.

## Quick start

Requirements: Node.js 22.12 or newer and pnpm 11.

```sh
mise install
pnpm install
pnpm check
pnpm dev
```

| App            | URL                     |
| -------------- | ----------------------- |
| Marketing site | <http://localhost:3000> |
| Client portal  | <http://localhost:3001> |
| Company OS     | <http://localhost:3002> |

The Company OS app includes Operate, Develop, and Learn sections along with health and generated
contract/reference endpoints. See its README for the current URLs.

Run one app with `pnpm --filter <app> dev`, for example:

```sh
pnpm --filter company-os dev
```

## Commands

| Command                   | Purpose                                                  |
| ------------------------- | -------------------------------------------------------- |
| `pnpm dev`                | Run all apps                                             |
| `pnpm check`              | Check formatting, lint, boundaries, dead code, and types |
| `pnpm test`               | Run repository tests                                     |
| `pnpm format`             | Format the repository                                    |
| `pnpm build`              | Build every app                                          |
| `pnpm ui:add <component>` | Add a source-owned shadcn primitive to `@acme/ui`        |
