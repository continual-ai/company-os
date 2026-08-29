---
name: add-app
description:
  Add and bootstrap an optional company-owned app from one of this repository's executable
  templates. Use for adding a portal, marketing site, or other focused interface to an existing
  Company OS project, not for creating the required central app or company model.
---

# Add App

Add an optional, source-owned application to an existing Company OS project. The generated app is a
one-time copy of a runnable template: it must not import from `templates/`, and subsequent work
belongs in the app or shared `@company/*` packages according to repository ownership rules.

Every project already has exactly one central `apps/company-os` and one `@company/model`. Never use
this skill to create or replace either one. Optional apps are focused interfaces over the central
app's governed capabilities, not independent business authorities.

## Instantiate

1. Inspect the worktree and preserve unrelated changes.
2. Run `pnpm add:app` to see the maintained templates, then run `pnpm add:app <template>` to add
   one. Do not infer templates from arbitrary directories.
3. Let the repository tool own copying, package rewriting, environment creation, dependency
   installation, and bootstrap checks. It refuses to overwrite an existing `apps/<template>`.
4. Verify the created package and review the working-tree scope. Run `pnpm check` when creation is
   part of a larger repository change.

Use `--dry-run` to show the intended source and destination without writing. Use `--no-bootstrap`
only for an explicitly requested source-only copy or an isolated tool test; disclose that the app's
dependencies, database, and checks were not bootstrapped.

Use `$company-onboard` to adapt the existing central app and model to a company and its first
operation. Adding an optional app is a separate step only when that interface serves the requested
operation.
