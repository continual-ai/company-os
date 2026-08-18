# Company OS

The source-owned software a company runs on.

Company OS is a standalone TypeScript scaffold for putting a company's business model and
operations in source. Define business meaning once, implement it behind one governed backend, and
use it across internal software, customer experiences, integrations, and agents.

This repository uses **Acme** as the example company. Acme owns `@acme/*` and `apps/*`. Reusable
framework code lives in `@continual/*` and has no dependency on Acme or the hosted Continual
platform.

> **Current state:** the package boundaries, three TanStack Start apps, CRM object definitions, and
> a serializable API description work. Persistence, authorization, actions, typed clients, and
> Effect-backed execution do not exist yet.

## Mental model

```text
@acme/api                  what the business means
    +
@continual/runtime         how definitions are described and projected
    |
apps/company-os            how Acme's backend is implemented and composed
    |
    +-- internal Console
    +-- external API
    +-- client portal, marketing site, integrations, and agents
```

The API contract is not a second backend. It is the browser-safe description of Acme's objects and,
eventually, its actions, queries, and policies. The Company OS app supplies the private
implementation. HTTP, clients, OpenAPI, and MCP should be projections of that same contract, not
parallel sources of business logic.

## Repository

```text
apps/
  company-os/       Full-stack backend and internal Console
  client-portal/    Customer-facing application
  marketing-site/   Public website

packages/
  acme/
    api/            Acme's browser-safe semantic API contract
    ui/             Acme's shared components and design tokens
  continual/
    runtime/        Reusable definition and runtime kernel
```

Each boundary has its own README:

- [`apps/company-os`](apps/company-os/README.md)
- [`apps/client-portal`](apps/client-portal/README.md)
- [`apps/marketing-site`](apps/marketing-site/README.md)
- [`packages/acme/api`](packages/acme/api/README.md)
- [`packages/acme/ui`](packages/acme/ui/README.md)
- [`packages/continual/runtime`](packages/continual/runtime/README.md)

App names are deployment names and private workspace package names. Scoped npm names are reserved
for code that other workspaces import.

## Quick start

Requirements: Node.js 22.12 or newer and pnpm 11.

```sh
pnpm install
pnpm check
pnpm dev
```

| App            | URL                     |
| -------------- | ----------------------- |
| Marketing site | <http://localhost:3000> |
| Client portal  | <http://localhost:3001> |
| Company OS     | <http://localhost:3002> |

The Company OS also exposes:

```sh
curl http://localhost:3002/health
curl http://localhost:3002/api/description
```

Run one app with `pnpm --filter <app> dev`, for example:

```sh
pnpm --filter company-os dev
```

## Boundaries

- Company nouns, rules, UI, migrations, and private implementations belong in `@acme/*` or
  `apps/*`.
- Reusable definitions and mechanical projections belong in `@continual/*`, which never imports
  company source.
- `apps/company-os` is the only composition root. Repositories, services, Effect layers, ports, and
  provider adapters are bound at its server boundary.
- Browser apps may import `@acme/api`, `@acme/ui`, and browser-safe runtime entrypoints. They never
  import private Company OS server code or connect directly to business storage.
- Start with one backend and one transaction boundary. Add packages, ports, and services only when
  a concrete slice makes the boundary useful.

## Commands

| Command       | Purpose                                                  |
| ------------- | -------------------------------------------------------- |
| `pnpm dev`    | Run all apps                                             |
| `pnpm check`  | Check formatting, lint, boundaries, dead code, and types |
| `pnpm format` | Format the repository                                    |
| `pnpm build`  | Build every app                                          |

Turbo is ready for a `test` task, but the root test command and CI step should arrive with the first
real Vitest suite rather than an empty green check.

## Next slice

Build one real business operation end to end: define its action and result in `@acme/api`, execute
it through Effect v4 services in `apps/company-os`, persist it, authorize it, and call it from an
app. That slice should prove which runtime abstractions deserve to remain.
