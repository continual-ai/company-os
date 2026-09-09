# Plan: one monolith, everything installed, enablement by config

Status: in progress on `codex/company-os-foundation`, starting from `cf38112` (check and tests green).
Read this before touching layout, composition, or module code. `AGENTS.md` is rewritten as part of
this plan; until it is, this file wins on layout questions.

## Decision

Company OS is one application that companies clone and own. The kernel and every module live in
the app's source tree. Every module is always composed and migrated. A code-defined enabled list
decides what the UI and API expose. Customers extend by adding modules, then by editing shipped
modules, then by editing the kernel, in that order. Upgrades are `git merge` from upstream.

One rule decides every future boundary question: **a package is a deploy unit.** `apps/*` are
packages. Kernel and modules are directories. Nothing else earns a `package.json`.

Why (short): the product's durable asset is one governed model of the company, agents and humans
need one coherent world to read, and dogfooding must be the same artifact customers clone.
Separable packages spent effort on properties that only matter to framework vendors.

## Target layout

```text
apps/company-os/
  src/
    runtime/                 kernel. Upstream owns it; customers edit last.
      model/                 portable definitions (no Effect, React, server)
      contract/              schemas shared by client and server
      client/                browser client, TanStack Query adapters
      server/                execution, storage, authorization, events, transports
      ui/                    tokens, components/, forms/, model presentation
      testing/               test foundation helpers
      access/                kernel module, always enabled: model/ server/ ui/
      assets/                kernel module, always enabled: model/ server/ ui/
    modules/                 one shape per module: model/ server/ ui/ seeds/
      notes/ sales/ marketing/ engineering/ support/ support-engineering/
    app/                     the shell: ui/ server/ customization/ styles/ seeds/ + client files
    routes/                  TanStack file routes, generic over the model
    app.model.ts             every module, unconditionally. This is the schema.
    app.config.ts            enabledModules: [...] as a plain literal
    app.server.ts            server contributions for every module
    app.ui.ts                presentation contributions for every module
    router.tsx  routeTree.gen.ts
  tools/                     db scripts, model lint
templates/base/              the one optional-app starter; imports company-os/* only
tools/                       create-app.ts, oxlint plugin
```

Deleted: `packages/`, `modules/`, `apps/company-os/src/examples/`, `templates/client-portal`,
`templates/marketing-site`, the runtime export map, `turbo boundaries`, `src/generated/`.

## Import rules

All private imports are `#/<path>.ts(x)` relative to `apps/company-os/src`. Three path rules
replace the package logic in the oxlint plugin:

1. `runtime/model/**`, `runtime/contract/**`, and every `*/model/**` import nothing from `server`,
   `ui`, `client`, Effect, React, `node:`, `pg`, or `@effect/sql`.
2. `runtime/**` never imports `modules/**`, `app/**`, or `routes/**`. `runtime/server/**` never
   imports `runtime/ui/**`.
3. A module imports itself, other modules' `model/**`, and `runtime/**`. Never `app/**`,
   `app.config.ts`, another module's `server/**`, `ui/**`, or `seeds/**`.

Browser files (`client`, `ui`, `model`, `contract`, routes not under `api/`) never import
`**/server/**`, `**/seeds/**`, or `runtime/testing/**`. Vite `importProtection` remains the
transitive check.

## Enablement

- `app.model.ts` lists every module. `app.config.ts` exports `enabledModules` as a literal array.
- Startup validates the list is dependency-closed using the model graph (references, links,
  interface implementations). A missing dependency fails fast naming the module.
- One `enabledModel` catalog is derived from `Model` plus the list and handed to every consumer:
  HTTP API builder, MCP tool listing, OpenAPI, `composeModelUi`, navigation, route resolver,
  record search. No consumer asks "is X enabled" itself.
- Operations on disabled objects are not found. Data stays. Full schema always migrates.
- Access and Assets are kernel modules and cannot be disabled.
- No environment variable may override the list. Two deployments with different modules are two
  commits.

## Steps

Each step ends with `pnpm check`, `pnpm test`, and `pnpm build` green, then a commit.

1. **Mechanical move.** Rename map plus a specifier codemod that resolves every import to a file and
   re-emits `#/` paths. Merge runtime and module dependencies into the app manifest. Delete the
   listed directories. Rewrite `pnpm-workspace.yaml`, `turbo.json`, vitest projects, oxlint
   overrides, `.oxfmtrc.json`, `components.json`, CSS `@source` lines. Rewrite the oxlint plugin to
   the three path rules and refresh its fixtures. Install all modules in the three roots; replace
   `src/examples` consumers with the real app files.
2. **Enablement.** `app.config.ts`, dependency-closure validation, `enabledModel`, consumers wired.
3. **Kernel cleanups still open from the review.** One transaction per write (collapse
   `object-service` and `link-service` layering), `Root` and `Actor` as constants and the phantom
   generics removed, `requires` removed, `server/postgres` and `server/database` merged into
   `server/storage`, `verifyDatabaseModel` at migrate time only, `composition-root.ts` folded into
   `application-layer.ts`, `Authorization.require` and `requireOperation` merged.
4. **Tests follow code.** Runtime tests under `src/runtime/**`, module tests under
   `src/modules/**`, one vitest config with `unit` and `database` projects, `testFoundation(model)`.
5. **Hygiene and docs.** Delete `FOUNDATION-*.md`, `docs/reviews`, `docs/dogfooding.md`, gallery-only
   components, the test-only `src/modules/assets`. Rewrite `AGENTS.md`, `README.md`,
   `docs/architecture.md`, `docs/modules.md` for the monolith. Add `pnpm kernel:drift` and
   `pnpm upstream:merge`.

## Customization ladder (goes into AGENTS.md)

1. Add a module under `src/modules/<name>` and register it in the three roots.
2. Edit a shipped module.
3. Edit `src/runtime`, only with the reason recorded in the commit message.

Onboarding is: clone, set `enabledModules`, run migrations, hand the repo to an agent with the
`company-customize` skill.
