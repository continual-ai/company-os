# Company OS application

The central backend and operating application in one TanStack Start deployment. It binds the
browser-safe contract from `@company/model` to authorization, PostgreSQL, business services, HTTP,
OpenAPI, MCP, and the human interface. Those surfaces share one governed implementation rather than
maintaining separate business rules.

## Develop

From the repository root, start development:

```sh
pnpm dev
```

Turbo runs this application's idempotent `db:migrate` task before its development server. PostgreSQL
must already be running at the configured `DATABASE_URL`; the repository does not manage the server.
The Vite development server supplies a local development identity when no provider credential is
present. Continual managed previews and proxied App URLs use the verified runtime identity supplied
by Continual instead. Open `/developer` to inspect the current model, generated API and SDK, MCP
tools, and design system.

[`.env.example`](.env.example) supplies executable local defaults. Create an ignored `.env.local`
at the repository root or in this App only to override them. Values injected by a sandbox or
deployment take precedence over both. The migration command creates a configured local database
when needed, then applies migrations and required records. Run it directly with
`pnpm turbo run db:migrate --filter=company-os`. Node loads local values only for development and
database commands; Effect Config is the application's single typed configuration interface in Node
and workerd. Only `VITE_` variables may enter browser code.

Set `VITE_COMPANY_OS_URL` to the public deployment origin when canonical URLs and the MCP Host/Origin
allowlist should use it. When it is unset, the app omits canonical URLs instead of publishing a local
development origin.

## Deploy

Run `pnpm deploy` from the repository root. Turbo builds this App before its deployment task runs;
the task migrates a configured database and then asks the repository-pinned Continual CLI to publish
the existing `.output` artifact. Continual remains an optional publisher—the App owns its build,
migrations, and runtime configuration.

## Ownership

This application owns:

- private business implementations and orchestration;
- resolution of Continual App identity into business authorization;
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
- `tools` contains the app's explicit database command entrypoints and local environment loader.

Put business behavior in the model and governed server path rather than duplicating policy in React
or customization configuration.

## Request path

```text
UI / HTTP / MCP
       |
verified provider identity (Continual by default)
       |
App principal, roles, and invocation context
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
