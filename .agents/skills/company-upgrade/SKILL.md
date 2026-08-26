---
name: company-upgrade
description:
  Safely update a customized Company OS fork from its GitHub upstream by verifying remotes,
  fetching and merging upstream history, resolving conflicts without discarding company changes,
  and validating the result. Use for scaffold upgrades, not dependency-only upgrades or ordinary
  feature development.
---

# Company Upgrade

Bring upstream Company OS changes into a customer-owned fork while preserving its company model,
branding, workflows, migrations, and other intentional customization.

## Establish a safe Git state

1. Read `AGENTS.md` and inspect the current branch, status, remotes, tracking branches, recent
   history, and repository instructions before changing Git state.
2. Do not begin a merge over unrelated uncommitted work. Preserve it and ask for direction when it
   cannot be isolated safely; never stash, discard, reset, or overwrite it silently.
3. Work on a dedicated `codex/upgrade-*` branch unless the user explicitly chose another branch or
   the current branch is already dedicated to this upgrade. Do not push without authorization.

## Verify the fork relationship

- Inspect `git remote -v`. For a conventional fork, `origin` should identify the user's fork and
  `upstream` should identify its source repository.
- When GitHub CLI is available, use repository metadata such as
  `gh repo view --json nameWithOwner,parent,defaultBranchRef` to identify the fork parent and default
  branches rather than guessing names or URLs.
- If the parent is verified and `upstream` is missing, add it. If an existing `upstream` points
  elsewhere, stop and explain the mismatch before changing it. If the repository is not a GitHub
  fork and no canonical source is documented, ask the user for the upstream repository.
- Fetch `origin` and `upstream`, then show the exact upstream commit range and common ancestor that
  will participate in the upgrade.

## Integrate upstream

- Prefer merging the upstream default branch into a long-lived customized fork. Rebase only when
  the user requests it or the affected branch is unpublished and linear history has a concrete
  benefit.
- Review incoming changes before the merge, especially model definitions, migrations, generated
  artifacts, application composition, package boundaries, toolchain pins, and repository skills.
- Resolve each conflict from the base, upstream intent, and company intent. Never apply blanket
  `ours` or `theirs` resolution across the repository.
- Preserve customer-specific branding, terminology, model semantics, Actions, migrations, and
  workflows unless an upstream contract requires an intentional adaptation. Incorporate upstream
  fixes and structural changes rather than keeping an obsolete local shape solely because it is
  local.
- Regenerate derived files with their owning command after resolving authoritative source. Do not
  hand-merge generated output when it can be reproduced safely.
- Inspect upstream migrations in order alongside fork migrations. Do not rewrite migration history
  already applied to a real database; add a repair or reconciliation migration when necessary.

## Validate and hand off

Run focused tests for resolved behavior, `pnpm check`, `git diff --check`, and `pnpm build` when the
upgrade changes routing, bundling, or application dependencies. Confirm the resulting ancestry and
working-tree state.

Report:

- verified `origin` and `upstream` identities;
- upstream range merged and merge strategy used;
- conflicts and the intent preserved in each resolution;
- migration or generated-file consequences;
- verification results; and
- any remaining manual follow-up.

Leave the upgrade unpushed unless the user asked to publish it.
