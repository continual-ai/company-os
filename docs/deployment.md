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

Migration `0004-project_access` archives retired access records and former scope placement in
`company_os_archive`; it preserves identities, business records, company Links, files, and the event
journal. The archive is outside the generated app model and is accessible to database administrators.

For Continual hosting:

```sh
pnpm exec continual login
pnpm exec continual link --project <project-id-or-url>
pnpm exec continual env pull
pnpm deploy
```

Deploy builds `.output`, migrates the configured database, then publishes. Other hosts must preserve
that order and configure a trusted identity boundary. Keep a restore point before production
migrations and use changes compatible with overlapping app revisions; an app rollback does not undo
a migration. Verify `/health` and an authenticated read and write after deployment. Satellites set
`COMPANY_OS_URL` to the central app and forward verified identity headers.
