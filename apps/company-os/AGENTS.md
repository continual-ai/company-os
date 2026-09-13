# apps/company-os

This is the required central Company OS application and the project's private server composition boundary.
It already exists and stays on its checked-in stack; never scaffold a replacement or a parallel app for capabilities that belong here.

## Deployment contract

The app directory name is its stable app key.
The package manifest declares that key and its user-visible name under `continual`.
`pnpm build` produces conventional `.output`; root `pnpm deploy` makes Turbo build first, then the App deployment task asks the repository-pinned Continual CLI to publish that existing output.
Runtime configuration arrives as deploy-time bindings (`DATABASE_URL`, `DATABASE_SCHEMA`, `APP_SECRET`) and Continual's request-bound runtime headers; do not add provider-specific build configuration.
`GET /api/health` is the platform liveness probe and must stay dependency-free; `GET /health` is the database-backed readiness check.

## Data

The app owns its migration registry and Effect SQL runner. `pnpm db:migrate` applies pending migrations;
`pnpm db:reset` drops disposable local storage and runs the same migrations from scratch. Both honor
`DATABASE_URL` and `DATABASE_SCHEMA`. Keep one initial migration before v1: update it from the model
and reset, rather than accumulating incremental migrations. When retained-data upgrades become
necessary, freeze its SQL and append immutable numbered migrations. Keep migration SQL schema-relative:
no `public.` qualification and no cross-schema references.

## Local development

From the repository root, `pnpm db:reset` prepares disposable model-based storage; `pnpm dev` starts the App on port 3002.
Ordinary dev serves SSR from Node; `pnpm --dir apps/company-os preview` rebuilds and serves the production artifact locally.
Under workerd the local `DATABASE_URL` needs an explicit user, and connection pools must never be shared across requests.
