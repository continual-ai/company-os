# apps/company-os

This is the required central Company OS application and the project's private server composition boundary.
It already exists and stays on its checked-in stack; never scaffold a replacement or a parallel app for capabilities that belong here.

## Deployment contract

The app directory name is its stable app key.
`pnpm bundle:continual` produces the deployable artifact: `dist/server/wrangler.json`, `dist/client`, and the dry-run output in `.continual/wrangler`.
It runs `db:migrate` first whenever `DATABASE_URL` is configured and skips it otherwise, so deployment sequencing lives in this script rather than in any platform.
The committed `wrangler.jsonc` carries build-time configuration only; runtime configuration arrives as deploy-time bindings (`DATABASE_URL`, `DATABASE_SCHEMA`, `APP_SECRET`) and Continual's request-bound runtime headers, so never add credentials or vars to it.
`GET /api/health` is the platform liveness probe and must stay dependency-free; `GET /health` is the database-backed readiness check.

## Data

The app owns the semantic model's migrations and migrates first on a shared deployment schema; run them with `pnpm db:migrate`, which honors `DATABASE_URL` and `DATABASE_SCHEMA`.
Migrations must stay schema-relative: no `public.` qualification and no cross-schema references.

## Local development

From the repository root, `pnpm dev` runs `db:migrate` and then starts the App on port 3002.
Ordinary dev serves SSR from Node; `CONTINUAL_WORKERD_DEV=1` opts dev into workerd for full deploy fidelity, and preview always uses workerd.
Under workerd the local `DATABASE_URL` needs an explicit user, and connection pools must never be shared across requests.
