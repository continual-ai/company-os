# Company OS

The source-owned software a company runs on.

Company OS is a standalone TypeScript scaffold for defining a company's business model and
implementing governed capabilities for internal software, customer experiences, integrations, and
agents.

The checked-in model name is **Example**. Change it in
[`metadata.ts`](packages/company/model/src/metadata.ts). The `@company/*` namespace is a stable
source-ownership boundary, so a fork does not rename package imports. Everything required to run
the system is vendored here; the hosted Continual platform is an optional operator, not a runtime
dependency.

A cloned repository is the declarative source for one project and may contain several apps. That
mapping matters at integration boundaries; it does not need to become a pervasive product noun in
the code.

The scaffold is intentionally early. Current APIs and package shapes are working experiments, not
a frozen product specification. Code and tests describe current behavior; the repository skills
capture only product and ownership context that cannot be recovered from code.

## Mental model

```text
@company/model             browser-safe semantic model
    +
@company/runtime           portable definition and projection machinery
    |
@company/postgres          PostgreSQL storage adapter
    |
apps/company-os            backend, operating application, and composition root
    |
    +-- client portal, marketing site, integrations, agents, and future apps
```

The working product hypothesis is that these interfaces should share governed business meaning
rather than grow into independent authorities. The exact semantic model, protocols, client shape,
and runtime boundaries remain open to evidence from real slices.

The current example model separates typed objects, bidirectional links, and governed actions.
Objects are readable by convention, CRUD actions are available by default, and additional actions
express business behavior that can change several objects and links together.

## Customize a fork

The scaffold keeps high-frequency company changes in a small source-owned overlay without reducing
the application to configuration:

- `apps/company-os/src/company/config.ts` owns product identity, brand assets, and shallow entry and
  first-launch copy.
- `apps/company-os/src/company/entry.tsx` presents company recognition beside an app-owned sign-in
  flow without owning authentication behavior.
- `apps/company-os/src/company/theme.css` maps the company's restrained visual accents onto the
  shared design system.
- `apps/company-os/src/company/navigation.ts` chooses the operating surfaces presented in the app.
- `apps/company-os/src/company/home.tsx` is the company-owned first authenticated experience and can
  become a real workflow rather than a generic dashboard.
- `packages/company/model/src/company-composition.ts` composes the replaceable business model on top
  of the identity, authorization, party, and audit foundation.

Use those files for shallow identity and experience work. A real operation should still be built
vertically through model definitions, migrations, governed server behavior, routes, and tests. The
overlay creates upgrade-friendly ownership seams; it is not a plugin or feature-flag system.

## Follow one company object

The Lead example shows how the current boundaries build on one source-owned definition without
redeclaring its business shape:

1. [`Lead`](packages/company/model/src/objects/lead.ts) defines the portable business object.
2. [`Model`](packages/company/model/src/index.ts) closes and validates the company contract.
3. [`Storage`](apps/company-os/src/server/database/schema.ts) compiles that contract into
   the company-owned PostgreSQL projection.
4. [`LeadRepository`](apps/company-os/src/server/objects/lead-repository.ts) binds the shared
   PostgreSQL adapter to the Lead object.
5. [`LeadService`](apps/company-os/src/server/objects/lead-service.ts) adds source-owned
   authorization to the standard object behavior.
6. The [composition root](apps/company-os/src/server/composition-root.ts) assembles the
   repositories and services and binds the API description and executable HTTP contract derived
   from `Model`.

This is a guide to the working slice, not a requirement that every future capability add the same
layers. Each boundary should continue to earn its place through a concrete responsibility.

## Repository

```text
apps/
  company-os/       Core backend and operating application
  client-portal/    Customer-facing application
  marketing-site/   Public website

packages/
  company/
    model/          Source-owned browser-safe semantic model
    postgres/       Reusable PostgreSQL storage adapter
    runtime/        Reusable definitions and projections
    ui/             Source-owned components and design tokens
```

Each boundary has a focused README:

- [`apps/company-os`](apps/company-os/README.md)
- [`apps/client-portal`](apps/client-portal/README.md)
- [`apps/marketing-site`](apps/marketing-site/README.md)
- [`packages/company/model`](packages/company/model/README.md)
- [`packages/company/ui`](packages/company/ui/README.md)
- [`packages/company/postgres`](packages/company/postgres/README.md)
- [`packages/company/runtime`](packages/company/runtime/README.md)

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

The Company OS app is the heart of the repository. It includes Operate, Develop, and Learn sections
along with the governed backend, persistence, and generated contract/reference endpoints. The
other apps demonstrate focused experiences built on that authority.

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
| `pnpm ui:add <component>` | Add a source-owned shadcn primitive to `@company/ui`     |
