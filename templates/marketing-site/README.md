# Marketing site

The public website, built with TanStack Start. It explains the organization and routes people into
the client portal or Company OS. It owns public content and presentation, not business records or
operating policy.

## Develop

From this package directory:

```sh
pnpm dev
```

The development server prints its local URL. Its exact package identity and port are declared in
`package.json`.

Set the deployed application URLs when they differ from the local defaults:

```sh
VITE_CLIENT_PORTAL_URL=https://portal.example.com
VITE_COMPANY_OS_URL=https://os.example.com
```

## Source map

- `src/routes` owns public URLs and page composition.
- `src/components` owns marketing-specific presentation.
- `src/lib` owns site-local helpers and configuration.
- `src/styles` owns site-specific styling over the shared theme.

The checked-in content is placeholder material intended to be replaced when the app is created for
a company.

## Boundaries

- Reuse shared components and tokens from `@company/ui`.
- Access governed backend capabilities through public typed interfaces when a concrete use case
  requires them.
- Do not import private backend implementation or make the marketing site a second business system.

Read the [architecture guide](../../docs/architecture.md) for the relationship between focused
interfaces and the central application.
