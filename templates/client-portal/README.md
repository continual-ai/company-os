# Client portal

The customer-facing workspace, built with TanStack Start. It presents the subset of data and
capabilities that the central Company OS application deliberately exposes to a customer. It is a
separate interface and deployment, not a separate business authority.

## Develop

From this package directory:

```sh
pnpm dev
```

The development server prints its local URL. Its exact package identity and port are declared in
`package.json`.

## Source map

- `src/routes` owns portal URLs and page composition.
- `src/styles` owns portal-specific styling over the shared theme.
- `@company/model` supplies browser-safe business vocabulary.
- `@company/ui` supplies shared visual primitives.

## Boundaries

- Consume business capabilities through a typed, browser-safe client exposed by the central app.
- Keep portal-specific routing, queries, view state, workflows, and presentation here.
- Keep authorization and business rules in the governed backend.
- Never import private server runtime code or connect directly to business storage.

Read the [architecture guide](../../docs/architecture.md) for the relationship between focused
interfaces and the central application.
