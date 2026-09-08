# Deployment and identity

Company OS runs locally without Continual. Production has two explicit integration boundaries:
the build/hosting adapter and the identity provider. Business records, permissions, migrations,
and custom services stay in this repository.

## Current build

`pnpm build` produces the application's `.output` artifact. The checked-in
[`vite.config.ts`](../../apps/company-os/vite.config.ts) uses the repository-pinned
`@continual/tanstack-start` configuration, which currently selects Nitro's `cloudflare_module`
preset for production. This is a worker artifact, not a ready-to-run Node server.

Local development serves through Node. To inspect the production artifact locally:

```sh
pnpm --dir apps/company-os preview
```

Preview rebuilds and serves at port 3102. It does not enable the development identity or load
`.env.example` as a production configuration. Supply the runtime configuration and valid identity
integration to test protected operations.

Using another host means adapting the application's build configuration to that target, supplying
its runtime bindings, and verifying the same HTTP and database behavior there. There is no
repository-supported one-command production deployment to arbitrary hosts yet. The portable model,
Effect services, PostgreSQL adapter, and Fetch-compatible transport boundary are independent of the
publisher; the checked-in deployment integration is concrete rather than universal.

## Runtime configuration

| Value                      | Meaning                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------- |
| `DATABASE_URL`             | PostgreSQL connection string; include an explicit user for worker runtimes              |
| `DATABASE_SCHEMA`          | Optional shared schema; defaults to `public`                                            |
| `APP_SECRET`               | Private deployment secret of at least 32 bytes; do not use the local example value      |
| `DATABASE_MAX_CONNECTIONS` | Optional pool size; defaults to two for request-scoped runtimes                         |
| `VITE_APP_URL`             | Public origin, compiled into the UI; also used for canonical URLs and MCP origin checks |

Only `VITE_` values are public. Keep credentials in your host's secret/environment configuration.
Effect Config is the server's typed configuration interface.

Build the application, apply the committed migrations from the same revision, then publish the
compatible artifact. Run one migration job, not one per server instance. The
[database runbook](database.md#production-migration) covers the commands and schema-change lifecycle.
`GET /api/health` is dependency-free liveness; `GET /health` checks database readiness. A successful
health probe does not verify identity or business authorization; also exercise an authenticated read
and write.

## Authentication and authorization

The default `IdentityProvider.layer` verifies Continual runtime assertions. `CONTINUAL_URL` pins the
trusted verification authority. A forwarded header cannot choose a different verifier. The provider
owns proof of identity; Company OS resolves `(issuer, subject)` into its own role-assignable principal
and enforces business policy.

For another login or identity-aware proxy, implement the
[`IdentityProvider`](../../apps/company-os/src/server/auth/identity-provider.ts) contract and pass its
layer into `makeApplicationLayer` in
[`composition-root.ts`](../../apps/company-os/src/server/composition-root.ts). Verify the provider's
credential before returning a subject, and return `null` for an unauthenticated request. Trusting a
caller-supplied email or user ID is not authentication. Update the OpenAPI identity description when
replacing the default contract.

A verified identity gets no business role by default. Configure `AUTH_BOOTSTRAP_ISSUER` and
`AUTH_BOOTSTRAP_SUBJECT` before the first administrator's first sign-in. Existing grants are preserved.
`AUTH_DEFAULT_ROLE=operator` explicitly opts new identities into the operator role; it is not required
for bootstrap. Roles, group membership, scoped grants, and record visibility remain Company OS policy.

Local development alone supplies an administrator identity. Production mode disables that fallback;
a standalone production installation still needs a real identity provider.

## Optional Continual publisher

Authenticate, link the checkout to a Project, and pull its Branch environment:

```sh
pnpm exec continual login
pnpm exec continual link --project <project-id-or-url>
pnpm exec continual env pull
pnpm deploy
```

Turbo builds each selected app. Its deployment task migrates the configured database and the pinned
CLI publishes the existing `.output`. To inspect publication inputs without uploading:

```sh
pnpm build
pnpm --dir apps/company-os exec continual deploy --dry-run
```

The fork remains authoritative for its source, business policy, and records. Continual release
records and deployment orchestration belong to the hosting platform.
