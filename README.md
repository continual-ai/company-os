# Company OS

The source-owned software a company runs on.

This repository is an opinionated, standalone starting point for a company operating system: one
business model shared by customer-facing software, internal operations, APIs, and agents. It uses a
Turborepo with TanStack Start, React 19, shadcn, Tailwind CSS v4, Hono, and TypeScript.

The example company is **Acme**. Replace `@acme/*` with the real company namespace as the system
becomes yours. The reusable framework remains under `@continual/*` and has no dependency on Acme
or the Continual hosted platform.

## What is here

```text
apps/
  website/       Public TanStack Start website
  portal/        Customer-facing TanStack Start portal
  workspace/     Internal TanStack Start operations workspace
  api/           Headless HTTP runtime and private composition root

packages/
  acme/
    model/        Source-owned business definitions
    client/       Browser-safe typed runtime binding
    ui/           Company-owned shadcn components and Tailwind v4 tokens

  continual/
    model/        Browser-safe framework primitives
    client/       Browser/SSR-safe runtime client
    runtime/      Server-only model execution
    ui/           Reusable framework UI
    studio/       Generic runtime explorer
    cli/          Local developer commands

tools/
  oxlint/anti-slop/     Vendored low-evidence code rules
  oxlint/company-os/    Source-owned repository rules
```

The first operating module is a deliberately small CRM with Customers, Contacts, and Projects.
The next useful proof is an inquiry that creates or links those records, enters the work queue, is
reviewed by an operator, and becomes visible in the portal.

## Run it

This repository does not require a Continual account or hosted runtime.

```sh
pnpm install
pnpm check
pnpm dev
```

| Surface   | URL                   |
| --------- | --------------------- |
| Website   | http://localhost:3000 |
| Portal    | http://localhost:3001 |
| Workspace | http://localhost:3002 |
| API       | http://localhost:4000 |
| Studio    | http://localhost:5555 |

Run one surface with a package filter:

```sh
pnpm --filter @acme/website dev
pnpm --filter @acme/portal dev
pnpm --filter @acme/workspace dev
pnpm --filter @acme/api dev
```

The API currently exposes `GET /health` and `GET /api/model`. Studio reads that public runtime
contract rather than importing server internals:

```sh
pnpm studio
```

## Code quality

Oxlint handles JavaScript and TypeScript with type-aware checks, vendored anti-slop rules, and
source-owned Company OS import rules. Turbo Boundaries checks cross-package relative imports and
undeclared workspace dependencies. Oxfmt is the only formatter and also sorts imports, package
manifests, and Tailwind classes.

```sh
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:check
```

Source filenames use kebab-case. Framework-owned names such as TanStack Router's `__root.tsx` are
narrowly exempted, and generated route trees are not linted or formatted. Internal barrel files,
wildcard exports, and re-export chains are prohibited. A package may expose one deliberate public
facade using explicit named re-exports from its top-level `src/index.ts`; allowed facades are
registered explicitly in the Company OS Oxlint rule.

## Architecture

- **One company model.** Apps and agents are interfaces over the same definitions and governed
  capabilities. They do not become separate business authorities.
- **Company source stays company-owned.** Business nouns, rules, UI, migrations, and private
  implementations belong under `@acme/*` or `apps/*`.
- **Framework code stays universal.** `@continual/*` packages must not import `@acme/*`.
- **Composition stays executable.** The API owns private runtime composition; the repository root
  owns workspace tooling but no business dependency graph.
- **The runtime is standalone.** Hosted identity, agents, connections, and deployment may be added
  through adapters; the core system must still run locally with direct providers.
- **Ports are earned.** Add a capability port only when it is smaller than the provider SDK, owns
  no vendor types, and has a useful local or in-memory implementation. Name adapters provider-first,
  such as `ResendEmailDeliveryAdapter` or `ContinualAgentExecutionAdapter`.
- **Start as a modular monolith.** Keep one backend, one database, and one transaction boundary
  until independent scaling or isolation is a demonstrated requirement.

Oxlint enforces the browser/server and company/framework import direction, while Turbo Boundaries
enforces workspace package integrity. Both run through one command:

```sh
pnpm lint
```

## Current status

This is an architectural scaffold, not a finished ERP or autonomous company. The package graph,
TanStack surfaces, model description endpoint, Studio, design system, and boundary checks work.
Persistence, authorization, typed actions, OpenAPI, MCP, and the first complete operating loop are
the next implementation slices.
