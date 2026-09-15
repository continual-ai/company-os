# Deployment

[Back to the README](../README.md)

Configure the server and identity values in [`.env.example`](../apps/company-os/.env.example).
Production requires an explicit database connection, deployment secret, and trusted project admission
provider; the local development identity is disabled. Every admitted user and service account has
full access to the project's active business model. Membership and credentials are managed by the
host, while local identity records preserve attribution. Separate projects when their data needs
different audiences. Only `VITE_` values are public.

The Continual adapter requires `CONTINUAL_PROJECT_ID` and an identity response containing
`actorId`, `kind` (`user` or `serviceAccount`), `projectId`, and `projectAccess: true`, in addition to
name and email. The verifier must check membership in that project, including revocation, and must
never issue admission merely because a public app has a runtime service account. Older identity
responses fail closed. Deploy the Continual runtime identity endpoint with this contract before
deploying Company OS; public-app fallback identities carry `projectAccess: false`.

The standalone JWT adapter requires a dedicated issuer/audience plus `AUTH_PROJECT_ID`. Its signed
claims must include matching `project_id`, `project_access: true`, and `kind`. The issuer owns
membership checks and revocation; short token lifetimes bound the delay before revoked access expires.
UI, HTTP, MCP discovery and execution, assets, search, and events require project admission. A local
user record or a valid token for another project never grants access.

`pnpm db:migrate` uses Effect SQL to apply pending migrations and record their completion. Before v1,
the registry contains only one initial migration derived from the current model. Repeated runs leave
that migration and existing data intact. A changed initial migration is rejected; use `pnpm reset`
for disposable local data, or deliberately replace disposable deployment storage. Never infer permission
to reset remote or retained data.

When retained-data upgrades become necessary, freeze the SQL in
`src/app/server/database/migrations/0001-initial.ts` and append immutable numbered migrations to the
app-owned registry. The same runner handles upgrades; tests should verify the final structure against
the current model and check that existing data survives.

For Continual hosting:

```sh
pnpm exec continual login
pnpm exec continual link --project <project-id-or-url>
pnpm exec continual env pull
pnpm db:migrate
pnpm deploy
```

Deploy builds `.output` and publishes it without altering the database. Apply pending migrations before deployment. Other hosts must prepare storage before serving the app
and configure a trusted identity boundary. Keep a restore
point for retained data; an app rollback does not restore a database. Verify `/health` and an
authenticated read and write after deployment. Satellites set
`COMPANY_OS_URL` to the central app and forward verified identity headers.

## Controller hosting

The controller prototype runs inside the long-lived Node web process. It starts with the application's
first service request and stays alive for that process's lifetime; it does not require a second worker
command. Effect Cluster uses the application's PostgreSQL connection for persisted messages and runner
coordination, and initializes its own `cluster_*` tables. Company OS projects the consumer-progress and
execution-state tables into `schema.sql`.

The internal runner HTTP listener defaults to `localhost:34431`. For multiple Node replicas, configure
`CONTROLLERS_HOST` to each replica's unique, mutually reachable hostname, `CONTROLLERS_PORT` to its
runner port, and optionally `CONTROLLERS_LISTEN_HOST` to its bind address (for example `0.0.0.0`).
All replicas share the same database/schema and controller definitions. The runner listener is an
internal trusted-network endpoint: keep it private. The public web port is independent.

Request-scoped workerd deployments, including the current Continual hosting adapter, do **not** run
the embedded controller host. They can expose definitions and recorded state, but 24/7 reconciliation
requires a long-lived host. Do not interpret an old `Idle` or `Running` observation as proof a host is
currently alive. The prototype does not yet supply a workerd alarm/queue adapter or a message-retention
policy; plan those before operating this runtime indefinitely in production.
