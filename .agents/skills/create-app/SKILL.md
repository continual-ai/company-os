---
name: create-app
description:
  Instantiate and bootstrap one of this repository's executable app templates under `apps/`. Use
  when creating a company-owned app from a starter, not when editing an existing app or maintaining
  the golden templates themselves.
---

# Create App

Create an ordinary source-owned application from a runnable golden template. The generated app is
a one-time copy: it must not import from `templates/`, and subsequent product work belongs in the
app or shared `@company/*` packages according to repository ownership rules.

## Instantiate

1. Inspect the worktree and preserve unrelated changes.
2. Run `pnpm create:app -- --list` to discover the maintained templates. Do not infer a template
   from an arbitrary directory.
3. Confirm the manifest's fixed `apps/<destination>` does not already exist. Never delete, merge,
   or overwrite an existing app to make creation succeed.
4. Run `pnpm create:app -- <template>`. The repository tool owns copying, package rewriting,
   environment creation, dependency installation, and declared bootstrap commands.
5. Verify the created package and review its working-tree scope. Run `pnpm check` when creation is
   part of a larger repository change.

Use `--dry-run` to show the intended source and destination without writing. Use `--no-bootstrap`
only for an explicitly requested source-only copy or an isolated tool test; disclose that the app's
dependencies, database, and checks were not bootstrapped.

When the same request also asks to adapt the new central app to a company and first operation,
complete creation first and then use `$company-onboard`. Creation establishes the source boundary;
onboarding owns semantic and product customization.
