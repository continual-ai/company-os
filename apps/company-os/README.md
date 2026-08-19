# Company OS app

Acme's backend and internal operating console in one TanStack Start deployment.

This app is the repository's private composition root. It turns the semantic contract from
`@acme/api` into working software by binding business services, repositories, capability ports,
provider adapters, and infrastructure. The Console and external transports should call the same
governed capabilities.

## Owns

- Private business implementations and orchestration
- Authentication and authorization enforcement
- Persistence, migrations, and transactions
- Provider adapters and runtime configuration
- Internal Console routes, server functions, and external API routes

It does not define reusable framework primitives or a second copy of the company contract. Keep
server-only code under `src/server` or in clearly named `.server.ts` modules.

## Develop

```sh
pnpm --filter company-os dev
```

Open <http://localhost:3002>. Useful endpoints:

- `GET /health` — process health
- `GET /api/description` — serializable description of `AcmeApi`
- `GET /api/openapi` — generated OpenAPI 3.1 contract
- `GET /api/docs` — generated Scalar API reference

## Current state

The Console is a static operating-model shell. The server exposes health, contract description,
OpenAPI, and Scalar routes; the latter two are compiled from `AcmeApi` through Effect v4 `HttpApi`.
They currently describe the intended contract rather than live CRUD/action handlers.
Authentication, persistence, endpoint handlers, and Effect services are the next implementation
work.
