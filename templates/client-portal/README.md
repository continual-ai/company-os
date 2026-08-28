# Client portal

The customer-facing workspace, built with TanStack Start.

The portal presents the subset of data and capabilities that the governed backend deliberately exposes to
a customer. It is a separate deployment and interface, not a separate business authority.

## Boundaries

- Consume the backend through a typed, browser-safe client derived from `@company/model`.
- Keep portal-specific routing, queries, view state, and presentation here.
- Keep authorization and business rules in the governed backend.
- Never import private server runtime code or connect directly to business storage.

Shared visual primitives come from `@company/ui`.

## Develop

```sh
pnpm --filter @company-template/client-portal dev
```

Open <http://localhost:3201>.
