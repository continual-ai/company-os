# Company OS application

The central backend and operating application in one TanStack Start deployment. It binds the
browser-safe contract from `@company/model` to authorization, PostgreSQL, business services, HTTP,
OpenAPI, MCP, and the human interface. Those surfaces share one governed implementation rather than
maintaining separate business rules.

## Develop

From the repository root, prepare the application once and then start it:

```sh
pnpm setup
pnpm dev
```

PostgreSQL must already be running at the configured `DATABASE_URL`; the repository does not manage
the server. The development server prints its local URL. Local identity mode provides administrator,
operator, and restricted profiles without an external identity provider. Open `/developer` to
inspect the current model, generated API and SDK, MCP tools, and design system.

`pnpm setup` creates `.env` from [`.env.example`](.env.example) when it is missing. The example is
the deployment configuration contract; the ignored `.env` contains local values. Only `VITE_`
variables may enter browser code. Server code validates private configuration with Effect Config
rather than reading the process environment directly.

Set `VITE_COMPANY_OS_URL` to the public deployment origin when canonical URLs and the MCP Host/Origin
allowlist should use it. When it is unset, the app omits canonical URLs instead of publishing a local
development origin.

## Ownership

This application owns:

- private business implementations and orchestration;
- identity assertion verification and business authorization;
- persistence, migrations, transactions, and runtime configuration; and
- the operating UI, developer surfaces, server functions, and external API routes.

Reusable definitions belong in `@company/runtime`, the business contract belongs in
`@company/model`, the reusable PostgreSQL adapter belongs in `@company/postgres`, and shared visual
primitives belong in `@company/ui`. Server-only application code stays under `src/server`.

## Source map

- `src/customization` owns product identity, assets, navigation, and the first authenticated
  experience. It is ordinary source code, not a page schema or plugin system.
- `src/routes` owns URL entry points and page metadata.
- `src/ui/application` owns the shell; `src/ui/model` owns reusable model-driven UI; and
  `src/ui/<module>` owns module-specific workflows.
- `src/app-client.ts` exposes the semantic browser client derived from the application HTTP
  contract.
- `src/ui/forms` owns TanStack Form integration and the single mapping from schema or API violations
  into form errors.
- `src/server/model` owns generic model execution bindings and repositories.
- `src/server/modules/<module>` owns behavior specific to a business module.
- `src/server/transport` projects the governed implementation to HTTP and MCP.
- `tools` contains the app's explicit setup and database command entrypoints.

Put business behavior in the model and governed server path rather than duplicating policy in React
or customization configuration.

## Request path

```text
UI / HTTP / MCP
       |
verified identity and invocation context
       |
governed object services and custom actions
       |
authorization and repositories
       |
PostgreSQL
```

Custom Actions own explicit business transitions or invariants. Ordinary CRUD uses the standard
model services. Both paths enforce authorization, validation, audit attribution, and transactions
on the server even when the UI has already received an advisory capability result.

## Database

The model is the source of truth for persisted business shape. This app owns the resulting schema
projection, explicit SQL migrations, generated snapshots, and release database job.

From the repository root, use Turbo to target the app that owns the database:

```sh
pnpm turbo run db:check --filter=company-os
pnpm turbo run db:migrate --filter=company-os
```

Read the [database workflow](../../docs/runbooks/database.md) before generating a migration,
resetting local data, or deploying a schema change.

## Further reading

- [Architecture](../../docs/architecture.md)
- [Modeling company operations](../../docs/modeling.md)
- [`@company/model`](../../packages/model/README.md)
- [`@company/runtime`](../../packages/runtime/README.md)
