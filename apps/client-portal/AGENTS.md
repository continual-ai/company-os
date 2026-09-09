# client-portal

A satellite app: a focused interface for customers over the central Company OS application's
governed capabilities. It is not a business authority; durable records, rules, and authorization
live in `apps/company-os`. A company that does not need it deletes this directory.

## Deployment contract

The directory name is the stable app key; never rename a deployed app's directory. The package
manifest declares that key and the user-visible name under `continual`. `pnpm build` produces
conventional `.output`; root `pnpm deploy` builds first and then asks the repository-pinned
Continual CLI to publish that output. Do not add provider-specific build configuration.
`GET /api/health` is the platform liveness probe and must stay dependency-free.

## Working in this app

Keep the checked-in TanStack Start stack; do not scaffold a parallel app. Import from the central
app only through `company-os/model`, `company-os/client`, and `company-os/config`; take primitives
and the stylesheet from `@company/ui`; never import another satellite. Call the central app from server code
through `createClient(EnabledModel, ...)` as `src/company-os.functions.ts` does: `COMPANY_OS_URL`
names the central app and the hosting platform's runtime identity headers are forwarded from the
incoming request with `runtimeIdentityHeaders(request)` from `@continual/sdk/app`. This app never
mints identity. A second satellite starts as a copy of this directory with its own package name,
`continual` key, and dev port.
