# Marketing site

The public website, built with TanStack Start.

This app explains the organization and routes people into the customer portal or Company OS.
It owns public content and presentation, not business records or operating policy.

## Boundaries

- Reuse company-owned components and tokens from `@company/ui`.
- Access governed backend capabilities through public, typed interfaces when a real use case
  requires it.
- Do not import private backend implementation or make the marketing app a second business system.

## Develop

```sh
pnpm --filter marketing-site dev
```

Open <http://localhost:3000>.

Copy `.env.example` to `.env` when the linked apps are not available at their local defaults:

```sh
VITE_CLIENT_PORTAL_URL=https://portal.example.com
VITE_COMPANY_OS_URL=https://os.example.com
```

The checked-in content is placeholder material.
