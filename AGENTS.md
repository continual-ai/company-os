# Working in Company OS

This is the canonical standalone Company OS scaffold. Keep it useful without the Continual hosted
platform.

## Ownership

- `@acme/*` and `apps/*` are source-owned by the example company. Business nouns and behavior
  belong here.
- `@continual/*` is reusable framework code. It must never import `@acme/*`.
- Browser applications use `@acme/client` and `@acme/ui`; they do not import the server runtime,
  API implementation, Studio, or CLI.
- The API is the private composition root. Bind repositories, services, ports, and provider
  adapters there.

## Stack

- Use TanStack Start for every user-facing application.
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

Run `pnpm check` for package boundaries, formatting, lint, and TypeScript. Run `pnpm build`
before changing routing, bundling, or application dependencies.
