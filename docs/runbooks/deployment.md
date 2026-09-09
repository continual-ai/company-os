# Deployment and identity

Company OS runs locally without Continual. Production has two integration boundaries: the build and
hosting adapter, and the identity provider. Records, permissions, migrations, and custom operations
stay in this repository.

## Build

`pnpm build` produces `.output` through the repository-pinned `@continual/tanstack-start` Vite
configuration in `apps/company-os/vite.config.ts`. `pnpm --filter company-os preview` rebuilds and
serves that artifact on port 3102 without the development identity; supply real configuration to
exercise protected operations. Another host means adapting that build configuration and verifying
the same HTTP and database behavior there; the Fetch-compatible transport and PostgreSQL storage do
not depend on the publisher.

## Runtime configuration

| Value                      | Meaning                                                                   |
| -------------------------- | ------------------------------------------------------------------------- |
| `DATABASE_URL`             | PostgreSQL connection string with an explicit user                        |
| `DATABASE_SCHEMA`          | Optional shared schema; unqualified names resolve to `public`             |
| `DATABASE_MAX_CONNECTIONS` | Pool size; two for request-scoped runtimes, higher for long-lived servers |
| `APP_SECRET`               | Deployment secret of at least 32 bytes; never the local example value     |
| `VITE_APP_URL`             | Public origin compiled into the UI and used for canonical URLs            |

An optional app created from `templates/base` sets `COMPANY_OS_URL` to the central app's origin and
forwards the platform's identity headers on every call; development defaults to the central app's
dev port.

Only `VITE_` values are public. `GET /api/health` is dependency-free liveness; `GET /health` checks
database readiness. Neither proves identity or authorization works, so also perform an authenticated
read and write after deploying. Run one migration job per release as the [database
workflow](database.md#production) describes.

## Identity

The provider proves who is calling; Company OS resolves `(issuer, subject)` to its own principal and
decides what it may do. The default layer in `src/app/server/auth/identity-provider.ts` verifies
Continual runtime assertions; `CONTINUAL_URL` pins the verifier and a forwarded header cannot choose
another. `IDENTITY_PROVIDER=jwt` selects `src/app/server/auth/jwt-identity-provider.ts`, configured
with `AUTH_JWT_ISSUER`, `AUTH_JWT_AUDIENCE`, and an HTTPS `AUTH_JWT_JWKS_URL`. It verifies RS256 and
ES256 Bearer tokens (signature, issuer, audience, subject, issued-at, expiry) for browsers behind an
organization gateway and for API and MCP callers; signed name and email claims provision the local
user, and token roles never grant business permissions. Strip untrusted `Authorization` headers
before the gateway injects its own token.

For another trusted login boundary, implement the `IdentityProvider` service from
`src/runtime/server/auth/identity-provider.ts` and pass its layer to `makeApplicationLayer` in
`src/app/server/application-layer.ts`. Verify the credential before returning a subject and return
`null` for an unauthenticated request; a caller-supplied email or user id is not authentication.
Update `src/app/openapi-identity.ts` when the documented scheme changes.

A verified identity receives no role by default. Set `AUTH_BOOTSTRAP_ISSUER` and
`AUTH_BOOTSTRAP_SUBJECT` before the first administrator signs in; existing grants are preserved.
`AUTH_DEFAULT_ROLE=operator` opts new identities into the operator role. Development alone supplies
a local administrator; production disables that fallback.

## Publish with Continual

```sh
pnpm exec continual login
pnpm exec continual link --project <project-id-or-url>
pnpm exec continual env pull
pnpm deploy
```

Turbo builds each selected app, the app's `deploy` task migrates the configured database, and the
pinned CLI publishes the existing `.output`. `pnpm --filter company-os exec continual deploy
--dry-run` after `pnpm build` inspects the publication without uploading. Release records belong to
the hosting platform; source, policy, and data remain in this repository.
