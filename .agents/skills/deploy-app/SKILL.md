---
name: deploy-app
description:
  Bundle and publish one of this project's applications through the Continual hosting platform's
  Cloudflare pipeline, including pre-deploy database migration. Use when an app should be deployed
  or a deployment fails, not for local development or for creating apps.
---

# Deploy App

Publish an application from `apps/<app-directory>` through the hosting platform. Deployment is
optional: the project runs standalone, and nothing here is required for local work.

## Contract

An app is deployable when it satisfies the artifact contract, which this repository's apps and
templates already carry:

- A `bundle:continual` script that builds and dry-runs the emitted `dist/server/wrangler.json`
  into `.continual/wrangler`.
- A committed credential-free `wrangler.jsonc`. Runtime configuration (database, schema, secrets,
  identity) arrives as deploy-time bindings; adding vars or credentials to the Wrangler config is
  a defect and some pipelines reject it.
- A dependency-free `GET /api/health` liveness route.
- Deployment sequencing owned by the app's own scripts: when an app owns migrations, its
  `bundle:continual` runs them first wherever `DATABASE_URL` is configured and skips them where it
  is not, so the same command behaves identically on a laptop, in CI, and in a platform sandbox.
  Migrations must be forward-only and idempotent because identical-content re-publishes run them
  again, while rollbacks to an existing deployment never do.

The app's directory name is its stable app key; the platform's app identifier and display name are
platform concerns. Do not encode platform release or deployment record shapes into this
repository; only the artifact contract above is load-bearing here.

## Deploy

1. Ensure a clean `git status --porcelain`, a pushed HEAD, and a passing `pnpm check`.
2. Ensure the deployment `DATABASE_URL` and `DATABASE_SCHEMA` are in the environment when the app
   owns migrations (in a platform sandbox they already are; `continual env pull` also provides
   them). `bundle:continual` migrates first when they are present.
3. Run `pnpm --dir apps/<app-directory> run bundle:continual`. Stop on failure; a migration
   failure fails the bundle before anything is published.
4. Publish with the platform CLI:
   `continual deploy --app <app-id> --name "<display name>" --app-dir apps/<app-directory>`.

## Troubleshooting

- "No Wrangler config found": the app was not built; `bundle:continual` runs the build first.
- Wrangler output directory missing: the bundle script must dry-run with
  `--outdir .continual/wrangler`.
- A sandbox preview that never becomes reachable usually means the dev server is not on
  `--host 0.0.0.0` or the proxy host is missing from `server.allowedHosts`.
- Vars found in the committed Wrangler config: move them to platform bindings or, for dev-only
  values, the Vite config's serve-time forwarding.
