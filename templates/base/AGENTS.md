# base template app

An optional focused interface over the central Company OS application's governed capabilities.
It is not a business authority: durable records, rules, and authorization live in `apps/company-os`.

## Deployment contract

The app directory name is its stable app key; never rename a deployed app's directory.
`pnpm bundle:continual` produces the deployable artifact: `dist/server/wrangler.json`, `dist/client`, and the dry-run output in `.continual/wrangler`.
The committed `wrangler.jsonc` carries build-time configuration only; never add credentials or vars to it.
`GET /api/health` is the platform liveness probe and must stay dependency-free.

## Working in this app

Keep the checked-in TanStack Start stack; do not replace it or scaffold a parallel app.
Use `@company/model` for browser-safe semantics and `@company/ui` for presentation primitives.
Each app in the repository needs a distinct local dev port; adjust the `dev` script when the default collides.
