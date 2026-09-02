# client-portal

An optional focused interface over the central Company OS application's governed capabilities.
It is not an independent business authority: durable records, rules, and authorization live in the central app, and this app consumes its public API.

## Deployment contract

The app directory name is its stable app key.
`pnpm bundle:continual` produces the deployable artifact: `dist/server/wrangler.json`, `dist/client`, and the dry-run output in `.continual/wrangler`.
The committed `wrangler.jsonc` carries build-time configuration only; never add credentials or vars to it.
`GET /api/health` is the platform liveness probe and must stay dependency-free.

## Working in this app

Keep the checked-in TanStack Start stack; do not replace it or scaffold a parallel app.
Use `@company/model` for browser-safe semantics and `@company/ui` for presentation primitives.
A server route that calls the central app on behalf of the current user forwards the hosting platform's runtime identity headers from the incoming request (`runtimeIdentityHeaders(request)` from `@continual/sdk/app`); it never mints identity itself.
If the app grows durable business meaning, contribute it to the company model rather than storing it privately here.
