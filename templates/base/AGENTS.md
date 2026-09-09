# base template app

An optional focused interface over the central Company OS application's governed capabilities.
It is not a business authority: durable records, rules, and authorization live in `apps/company-os`.

## Deployment contract

The app directory name is its stable app key; never rename a deployed app's directory.
The package manifest declares that key and its user-visible name under `continual`.
`pnpm build` produces conventional `.output`; root `pnpm deploy` makes Turbo build first and then asks the repository-pinned Continual CLI to publish that existing output.
Do not add provider-specific build configuration.
`GET /api/health` is the platform liveness probe and must stay dependency-free.

## Working in this app

Keep the checked-in TanStack Start stack; do not replace it or scaffold a parallel app.
Use `company-os/model` for browser-safe semantics, `company-os/config` for the deployment's name and enabled modules, and `company-os/ui/*` for presentation primitives.
Call the central app only from server code through `createClient(EnabledModel, ...)` from `company-os/client`, as `src/company-os.functions.ts` does: `COMPANY_OS_URL` names the central app and the hosting platform's runtime identity headers are forwarded from the incoming request (`runtimeIdentityHeaders(request)` from `@continual/sdk/app`); this app never mints identity itself.
Each app in the repository needs a distinct local dev port; adjust the `dev` script when the default collides.
