# Working in Company OS

This is the canonical standalone Company OS scaffold. Keep it useful without the Continual hosted
platform.

## Context skills

- Use `$company-os` for the product model, source concepts, data-model vision, and customer-owned
  architecture.
- Use `$continual` for optional hosted-platform concepts and integration boundaries.

Both skills are working drafts. Reason from first principles, recommend stronger designs when they
conflict with current thinking, and update the skills after a direction is accepted or proven.

The canonical skills live in `.agents/skills`. `.codex/skills` and `.claude/skills` point there so
all supported agents share one copy.

## Ownership

- `@acme/*` and `apps/*` are source-owned by the example company. Business nouns and behavior
  belong here.
- `@continual/*` is reusable framework code. It must never import `@acme/*`.
- `@acme/api` owns the browser-safe semantic company API contract. It may depend on
  `@continual/runtime`, but not on UI, handlers, persistence, or provider code.
- Browser applications use `@acme/ui` and the browser-safe contract/client surfaces exposed by
  `@acme/api` and `@continual/runtime`; they never import server-only Company OS modules.
- `apps/company-os` is the full-stack Company OS and private composition root. Bind repositories,
  services, Effect layers, ports, and provider adapters in its server boundary. Keep its Console,
  server functions, and external API routes as interfaces over the same governed capabilities.
- Use explicit imports inside packages. Do not add wildcard exports, internal barrel files, or
  re-export chains. A package's top-level `src/index.ts` may use explicit named re-exports as its
  deliberate public API when registered in the Company OS Oxlint rule.

## Stack

- Use TanStack Start for every user-facing application.
- Use Effect v4 conventions for new runtime and backend code. Verify APIs against the installed v4
  version; do not copy Effect v3 patterns or introduce an abstraction only to imitate an Effect
  package name.
- Use the source-owned shadcn components and Tailwind CSS v4 tokens in `@acme/ui`.
- Use `pnpm` and Turborepo. Do not add another frontend framework or component library.
- Keep the Runtime contract compatible with ordinary Fetch so it can run locally or behind
  different hosts.

## Ports and adapters

Create ports around capabilities the company consumes, not around vendors. Keep contracts narrow
and vendor-neutral. Use capability-first port names and provider-first adapter names:

- `email-delivery-port.ts` / `ResendEmailDeliveryAdapter`
- `agent-execution-port.ts` / `ContinualAgentExecutionAdapter`
- `blob-store-port.ts` / `R2BlobStoreAdapter`

Do not create a port merely because a dependency is external. A port should isolate vendor types,
express a smaller stable contract, and support a meaningful local or in-memory implementation.
OAuth, webhook, polling, and uninstall lifecycle may justify a richer Connector composed from
several narrow capabilities.

## Verification

Run `pnpm check` for formatting, lint, package boundaries, dead code, and TypeScript. The command
only verifies; it does not rewrite files. Run `pnpm format` to format the repository. Run
`pnpm build` before changing routing, bundling, or application dependencies.
