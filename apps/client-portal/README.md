# Client portal

Acme's customer-facing workspace, built with TanStack Start.

The portal presents the subset of Company OS data and operations that Acme deliberately exposes to
a customer. It is a separate deployment and interface, not a separate business authority.

## Boundaries

- Consume the backend through a typed, browser-safe client derived from `@acme/api`.
- Keep portal-specific routing, queries, view state, and presentation here.
- Keep authorization and business rules in the Company OS backend.
- Never import private server runtime code or connect directly to business storage.

Shared visual primitives come from `@acme/ui`.

## Develop

```sh
pnpm --filter client-portal dev
```

Open <http://localhost:3001>.

## Current state

The app is a static portal shell with sample projects. Authentication and backend reads have not
been connected yet.
