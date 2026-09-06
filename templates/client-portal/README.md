# Client portal

A customer-facing interface starter built with TanStack Start. The checked-in page contains static
sample projects and a disabled sign-in control; authentication and governed data access are not
wired up. Replace those placeholders when building a real customer workflow.

Create your source-owned copy from the repository root:

```sh
pnpm app:create client-portal customer-portal
pnpm turbo run dev --filter=customer-portal
```

The resulting app is a separate interface and deployment over the central Company OS governed API.
It does not own a second business database or authorization system.

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
- `company-os/model` supplies browser-safe business vocabulary.
- `@company/ui` supplies shared visual primitives.

## Boundaries

- Consume business capabilities through a typed, browser-safe client exposed by the central app.
- Keep portal-specific routing, queries, view state, workflows, and presentation here.
- Keep authorization and business rules in the governed backend.
- Never import private server runtime code or connect directly to business storage.

Read the [architecture guide](../../docs/architecture.md) for the relationship between focused
interfaces and the central application.
