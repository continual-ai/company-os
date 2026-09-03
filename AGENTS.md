# Working in Company OS

Company OS turns real business operations into software with durable state, enforced rules, and the
same safe actions for people, applications, integrations, and agents. The repository and PostgreSQL
are the authority. Continual hosting is optional.

Treat code and tests as the source of truth, not a freeze. Prefer one complete operation over
generic CRUD, generated pages, or agent-only automation. Explore the current code before adding
guidance or a second way to do the same thing.

## Commands

Assume a working Node 24, pnpm 11, and PostgreSQL 18 environment.

Root scripts in `package.json` are the interface. Turbo runs package tasks; `--filter` limits
scope.

- `pnpm dev` — migrate and run `apps/*`
- `pnpm check` — format, lint, boundaries, dead code, types (does not rewrite)
- `pnpm format` / `pnpm test` / `pnpm build`

## Architecture

Keep company meaning portable. `@company/model` is the browser-safe contract and must not depend on
Effect, UI, handlers, or persistence. `@company/runtime` is the definition and execution foundation
and must not import the model, UI, storage, or apps. `@company/postgres` implements runtime
repository contracts. `@company/ui` is presentation only. `apps/company-os` is the singleton
central product and server composition boundary. Optional apps are copies of `templates/*` and
must never import template source.

Import other workspaces by package name and public exports. No barrels, wildcards, or filesystem
shortcuts across packages. Use explicit Effect v4 APIs (`Context.Service(..., { make })`, primary
implementation as `.layer`; not v3 `.Default` or `Live`). Do not make Effect the required public
format of company definitions. Applications use TanStack Start, `@company/ui`, and TanStack Form.

Read `$company-os` in `.agents/skills` only when product intent or ownership is not answerable from
the repository. Keep Current, Direction, and Vision distinct.
