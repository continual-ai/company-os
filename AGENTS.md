# Working in Company OS

This is the canonical standalone Company OS. It should help turn real business processes into
software that maintains durable state, enforces rules, and gives people, applications,
integrations, and agents the same safe actions. Keep it useful without the Continual hosted
platform.

## Design posture

The product and architecture are still being designed. Treat code and tests as the authority for
current behavior, not proof that a design should become permanent. Recommend stronger alternatives
when a concrete slice provides better evidence.

Prefer work that makes one real operation run end to end. Identify the incoming work, desired
outcome, authoritative records, deterministic rules, places where AI may exercise judgment, human
decisions, failure behavior, and evidence of success. Do not let the repository collapse into a
generic CRUD scaffold, a page generator, or an agent-only automation layer.

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
- Do not add UI copy that merely narrates visible structure or implementation. Supporting text must
  convey domain meaning, a consequence, or necessary instruction.
- Add concise TSDoc to deliberate public exports when callers need a non-obvious contract,
  invariant, default, or ownership boundary. Do not restate the TypeScript signature.
- Use implementation comments only to explain why something is necessary, especially safety
  arguments, external constraints, and transaction or failure invariants.
- Update or remove documentation in the same change that makes it inaccurate.

## Context skills

- Use `$company-os` when product intent, business semantics, ownership, or architecture tradeoffs
  are not answerable from the repository alone, including whether a capability belongs in this
  standalone repository or in an optional hosting platform.

The skill is challengeable working context. Read only the relevant reference and keep Current,
Direction, and Vision distinct. The canonical skills live in `.agents/skills`; `.codex/skills` and
`.claude/skills` point there.

## Ownership

- `@company/*`, `apps/*`, and `templates/*` are vendored, source-owned parts of the standalone
  Company OS. The project is instantiated by cloning or forking the repository. Templates are
  executable starters for optional apps; copied apps must never import template source.
- `@company/runtime` is the portable definition and execution foundation. It must not import the
  company model, UI, storage adapter, or applications.
- `@company/model` is the project's single browser-safe semantic model source. It may depend on the
  portable `@company/runtime` surface, but not on UI, handlers, persistence, providers, or Effect.
- `@company/postgres` is the reusable server-only PostgreSQL adapter. It implements runtime
  repository contracts and may depend on `@company/runtime`, but it does not own model definitions,
  migrations, credentials, custom persistence queries, or application Effect service identities.
- `@company/ui` owns shared presentation primitives and does not depend on the model, runtime,
  persistence, or applications.
- Browser applications may use public browser-safe package exports. They must not import another
  app or private Company OS server modules.
- `apps/company-os` is the required singleton central product and private server composition
  boundary. Other apps are optional focused interfaces over its governed capabilities, not
  independent business authorities.
- Hosted Continual integration must remain optional. Add a source-owned adapter only for a concrete
  platform contract; environment injection alone does not justify another package.

Use explicit imports inside packages. Do not add internal barrel files, wildcard exports, or
re-export chains. A package may expose one deliberate top-level facade with explicit named
re-exports when registered in the Company OS Oxlint rule.

Import another workspace through its declared package name and public exports, never through a
relative filesystem path or a TypeScript `paths` shortcut. Use `@/*` for app-local imports that
would otherwise traverse a parent directory and simple relative imports within a package.
Package-local generator aliases such as `@company/ui/*` may resolve back into the same package. Oxlint
and `turbo boundaries` enforce these conventions.

## Adding and deploying apps

Every checkout has one central `apps/company-os` and one `@company/model`; never scaffold a replacement
or a parallel app for capabilities that belong to them.
Optional apps are copies of the repository's templates: run `pnpm app:create` to list them and
`pnpm app:create <template> <app-name>` to add one, using `base` when no closer starter exists.
The app name becomes the directory under `apps/`, the package name, and the permanent app key on any
hosting platform, so choose a short kebab-case name and never rename a deployed app's directory.
Every app carries the same deployment contract: `pnpm bundle:continual` produces
`dist/server/wrangler.json`, `dist/client`, and the Wrangler dry-run output in `.continual/wrangler`;
the committed `wrangler.jsonc` holds build-time settings only; `GET /api/health` stays dependency-free.
An app that owns migrations runs them inside `bundle:continual` whenever `DATABASE_URL` is configured,
so deployment sequencing lives in this repository rather than in any platform.
Publishing the artifact is a hosting platform's concern; this repository guarantees only the contract
above and never encodes a platform's release or deployment records.
An optional app that calls the central app on behalf of the current user forwards the hosting
platform's runtime identity headers from the incoming request; no app mints identity itself.

## Stack

- Use TanStack Start for user-facing applications.
- Use the installed Effect v4 APIs for new Effect code; do not copy Effect v3 patterns. Keep
  company definitions portable rather than making Effect part of their required public format.
- Define constructed Effect services with `Context.Service(..., { make })` and expose their primary
  implementation as static `.layer`. Name alternatives descriptively, such as `.layerTest` or
  `.layerMemory`; do not use the v3 `.Default` or an ambiguous `Live` suffix. Capabilities supplied
  by an outer boundary may remain layerless.
- Use source-owned shadcn components and Tailwind CSS v4 tokens from `@company/ui`.
- Use TanStack Form through each application's source-owned form hook and field components. Keep
  Effect Schema as the authoritative decoder and map canonical API violations into form errors at
  one application boundary.
- Use `pnpm` and Turborepo. Do not add another frontend framework or component library, and do not
  rebuild an existing app on one; a request for another framework is met on the checked-in stack.
- Preserve an ordinary Fetch-compatible runtime boundary where practical.

## Application clients and forms

- Feature code should consume the semantic client derived from the model contract. Keep the native
  Effect HTTP client inside the application client assembly and expose non-model API groups through
  purpose-named operations or a deliberate semantic namespace.
- Keep application services out of TanStack Start's reserved `src/client.*` and `src/server.*`
  entrypoints. Use names such as `src/app-client.ts`; an accidental `src/client.ts` replaces the
  framework hydration entrypoint.
- Forms own interactive state in TanStack Form, decode transformed submission values with Effect
  Schema, and render server failures from the standard violation paths. Use the regular React Form
  package when submission already goes through the generated Effect client; TanStack Start server
  form helpers are for applications that actually use that transport.

Common mistakes are exporting both semantic and transport clients for feature code to choose
between, hand-writing endpoint-specific fetch clients, creating one-off pending/error/touched form
hooks, duplicating schema rules in components, or reducing typed server failures to a generic status
message. Remove the competing path instead of documenting two supported ways to do the same thing.

## Boundaries around dependencies

Do not add a port merely because a dependency is external. Consider a company-owned boundary when
it isolates provider types, expresses stable company semantics, protects a trust or failure
boundary, or supports a meaningful alternate implementation. Name capabilities in company terms
and concrete adapters after their provider. A product-visible installation lifecycle may justify
a richer connector.

## Modeling relationships

Use `parent` only for durable ownership and authorization hierarchy. Use a record-reference property
for directional state that belongs inline on one Object. Use a Link for a bidirectional relationship
without independent identity. Use an Object when the relationship has attributes, lifecycle,
history, or distinct authorization. Do not encode one fact as both a property and a Link, and do not
declare exact cardinality unless services, storage, deletion behavior, and tests preserve it.

## Verification

Run `pnpm check` for formatting, lint, package boundaries, dead code, and TypeScript. It verifies
without rewriting. Run `pnpm format` when formatting is needed. Run `pnpm build` after changing
routing, bundling, or application dependencies.
