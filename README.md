# Company OS

The source-owned software a company runs on.

This repository is a standalone Company OS scaffold: one semantic business
contract shared by customer-facing software, internal operations, APIs, and
agents. The example company is **Acme**. Company source lives under `@acme/*`
and `apps/*`; reusable framework code lives under `@continual/*` and never
depends on Acme or the hosted Continual platform.

## Repository shape

```text
apps/
  company-api/      Backend and private composition root
  company-os/       Internal management and operations UI
  client-portal/    Customer-facing application
  marketing-site/   Public website

packages/
  acme/
    contract/       Business objects and, next, actions and policies
    ui/             Company-owned components and Tailwind v4 tokens

  continual/
    runtime/        Semantic definitions, projections, and execution kernel
```

The app folder names are deployment names. Their private npm names match the
folders, so filters and deployment configuration use the same vocabulary.
Scoped package names are reserved for importable source boundaries.

## Contract, runtime, and API

`@acme/contract` defines the business meaning that consumers share. It may
contain objects, actions, queries, policies, and presentation metadata, but no
handlers, persistence, provider SDKs, or app inventory.

`@continual/runtime` owns the reusable definition language and every mechanical
projection of that contract: execution, Fetch-compatible HTTP, typed clients,
OpenAPI, MCP, and metadata. These projections should not become separate
business contracts.

`apps/company-api` supplies Acme's implementations and is the only composition
root. It binds repositories, services, Effect layers, capability ports, and
provider adapters. Browser apps will create a typed runtime client directly
from `@acme/contract` when the first action/query slice earns that API; there is
no empty `@acme/client` wrapper today.

There is also no empty platform package. Add an `@continual/platform-*`
boundary when a concrete runtime host or shared adapter implementation exists,
not merely to reserve a name.

## Run it

This repository does not require a Continual account or hosted runtime.

```sh
pnpm install
pnpm check
pnpm dev
```

| App            | URL                   |
| -------------- | --------------------- |
| Marketing site | http://localhost:3000 |
| Client portal  | http://localhost:3001 |
| Company OS     | http://localhost:3002 |
| Company API    | http://localhost:4000 |

Run one deployable with its app name:

```sh
pnpm --filter marketing-site dev
pnpm --filter client-portal dev
pnpm --filter company-os dev
pnpm --filter company-api dev
```

The transitional Hono API exposes `GET /health` and `GET /api/contract`. The
next backend slice should test the Effect v4 architecture with a real business
action before introducing more framework packages.

## Architecture rules

- Keep company nouns, rules, UI, migrations, and private implementations in
  `@acme/*` or `apps/*`.
- Keep `@continual/*` universal and independent of company source.
- Treat every app and agent as an interface over one governed backend, not as a
  separate business authority.
- Derive transport and client surfaces from explicit actions and queries; do
  not infer a public CRUD API from object definitions.
- Start as a modular monolith with one database and transaction boundary.
- Add capability ports only when they isolate a smaller stable contract and
  support a meaningful alternate implementation.
- Use Effect v4 conventions for new runtime and backend work; verify v4 APIs
  against the installed version instead of carrying forward v3 patterns.

## Code quality

Oxlint enforces source-level ownership and import direction. Turbo Boundaries
checks workspace dependencies. Oxfmt formats source and manifests, and Knip
checks unused files, exports, and dependencies.

| Command             | Purpose                                                         | Writes files |
| ------------------- | --------------------------------------------------------------- | ------------ |
| `pnpm dev`          | Run all four applications                                       | No           |
| `pnpm format`       | Format the repository with Oxfmt                                | Yes          |
| `pnpm format:check` | Verify formatting without changing files                        | No           |
| `pnpm lint`         | Run Oxlint and Turbo Boundaries                                 | No           |
| `pnpm deadcode`     | Find unused files, exports, and dependencies with Knip          | No           |
| `pnpm typecheck`    | Type-check every workspace package                              | No           |
| `pnpm check`        | Run formatting, lint, dead-code, and type checks without writes | No           |
| `pnpm build`        | Build production application bundles                            | No           |

The Turbo graph reserves a `test` task for Vitest. Add the root command and CI
step with the first real tests so an empty suite cannot report a false success.

## Current status

The package graph, four TanStack surfaces, semantic CRM objects, contract
description endpoint, design system, and boundary checks work. Persistence,
authorization, Effect services and layers, typed actions, HTTP/client
projection, and the first complete operating loop remain to be built.
