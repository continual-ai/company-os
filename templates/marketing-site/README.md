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
pnpm --filter @company-template/marketing-site dev
```

Open <http://localhost:3200>.

The runnable template loads `.env.template` and links to the template portal and Company OS on ports
`3201` and `3202`. An instantiated app can copy `.env.example` to `.env.local` when deployed URLs
differ from its normal local defaults:

```sh
VITE_CLIENT_PORTAL_URL=https://portal.example.com
VITE_COMPANY_OS_URL=https://os.example.com
```

The checked-in content is placeholder material.
