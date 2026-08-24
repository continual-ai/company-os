# Working in Company OS

This is the canonical standalone Company OS scaffold. Keep it useful without the Continual hosted
platform.

## Design posture

The product and architecture are still being designed. Treat code and tests as the authority for
current behavior, not proof that a design should become permanent. Recommend stronger alternatives
when a concrete slice provides better evidence.

Keep guidance in the narrowest authoritative place:

- `AGENTS.md` contains repository-wide working constraints.
- READMEs explain purpose, boundaries, setup, and public consumption.
- Skills provide non-obvious product and ownership context for design decisions.
- Code, types, manifests, tests, and generated contracts define implementation details.

Do not copy inventories of exports, fields, routes, or unfinished features into skills or
repository instructions. Avoid roadmap sections in package READMEs; use current code or an explicit
planning artifact instead.

## Documentation and comments

- Prefer clear names, types, small modules, and tests over comments that narrate the code.
- Add concise TSDoc to deliberate public exports when callers need a non-obvious contract,
  invariant, default, or ownership boundary. Do not restate the TypeScript signature.
- Use implementation comments only to explain why something is necessary, especially safety
  arguments, external constraints, and transaction or failure invariants.
- Update or remove documentation in the same change that makes it inaccurate.

## Context skills

- Use `$company-os` when product intent, business semantics, ownership, or architecture tradeoffs
  are not answerable from the repository alone.
- Use `$continual` when deciding whether an optional hosted capability belongs in Continual or the
  standalone Company OS.

Both skills are challengeable working context. Read only the relevant reference and keep Current,
Direction, and Vision distinct. The canonical skills live in `.agents/skills`; `.codex/skills` and
`.claude/skills` point there.

## Ownership

- `@acme/*` and `apps/*` are source-owned by the example company. Business nouns and behavior
  belong there.
- `@continual/*` is reusable framework code and must never import `@acme/*`. Add reusable surface
  only after a concrete company slice establishes common semantics.
- `@acme/api` is browser-safe company contract source. It may depend on the portable
  `@continual/runtime` surface, but not on UI, handlers, persistence, providers, or Effect.
- `@continual/postgres` is the reusable server-only PostgreSQL adapter. It implements runtime
  repository contracts but does not own company migrations, credentials, custom persistence
  queries, or Effect service identities.
- Browser applications may use public browser-safe package exports. They must not import another
  app or private Company OS server modules.
- `apps/company-os` is the private server composition boundary. Keep company policy and writes
  behind governed backend capabilities rather than reimplementing them in each interface.

Use explicit imports inside packages. Do not add internal barrel files, wildcard exports, or
re-export chains. A package may expose one deliberate top-level facade with explicit named
re-exports when registered in the Company OS Oxlint rule.

Import another workspace through its declared package name and public exports, never through a
relative filesystem path or a TypeScript `paths` shortcut. Use `@/*` for app-local imports that
would otherwise traverse a parent directory and simple relative imports within a package.
Package-local generator aliases such as `@acme/ui/*` may resolve back into the same package. Oxlint
and `turbo boundaries` enforce these conventions.

## Stack

- Use TanStack Start for user-facing applications.
- Use the installed Effect v4 APIs for new Effect code; do not copy Effect v3 patterns. Keep
  company definitions portable rather than making Effect part of their required public format.
- Define constructed Effect services with `Context.Service(..., { make })` and expose their primary
  implementation as static `.layer`. Name alternatives descriptively, such as `.layerTest` or
  `.layerMemory`; do not use the v3 `.Default` or an ambiguous `Live` suffix. Capabilities supplied
  by an outer boundary may remain layerless.
- Use source-owned shadcn components and Tailwind CSS v4 tokens from `@acme/ui`.
- Use `pnpm` and Turborepo. Do not add another frontend framework or component library.
- Preserve an ordinary Fetch-compatible runtime boundary where practical.

## Boundaries around dependencies

Do not add a port merely because a dependency is external. Consider a company-owned boundary when
it isolates provider types, expresses stable company semantics, protects a trust or failure
boundary, or supports a meaningful alternate implementation. Name capabilities in company terms
and concrete adapters after their provider. A product-visible installation lifecycle may justify
a richer connector.

## Verification

Run `pnpm check` for formatting, lint, package boundaries, dead code, and TypeScript. It verifies
without rewriting. Run `pnpm format` when formatting is needed. Run `pnpm build` after changing
routing, bundling, or application dependencies.
