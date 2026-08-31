---
name: company-upgrade
description:
  Safely update a customized Company OS project from its upstream source, whether a GitHub fork or
  a platform-materialized baseline, by verifying the upstream relationship, integrating upstream
  history, resolving conflicts without discarding company changes, and validating the result. Use
  for scaffold upgrades, not dependency-only upgrades or ordinary feature development.
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

## Verify the upstream relationship

A project reaches its owner in one of two topologies, and the upgrade must establish which one it
is in before touching Git state.

- **GitHub fork.** Inspect `git remote -v`; `origin` should identify the user's fork and
  `upstream` its source repository. When GitHub CLI is available, verify the parent with
  `gh repo view --json nameWithOwner,parent,defaultBranchRef` rather than guessing names. If the
  parent is verified and `upstream` is missing, add it. If an existing `upstream` points elsewhere,
  stop and explain the mismatch before changing it.
- **Platform-materialized baseline.** A hosting platform may initialize the project from a pinned
  Company OS revision as a single parentless root commit, so the repository has no fork parent and
  no shared history with its source. Recover the baseline identity from the root commit
  (`git rev-list --max-parents=0 HEAD` and its `Initialize from <repository>@<commit>` message) or
  from the platform's recorded provenance. Add the source as a `baseline` remote when absent.
- If neither topology can be verified and no canonical source is documented, ask the user for the
  upstream repository and, for materialized projects, the baseline commit.
- Fetch the remotes, then show the exact upstream commit range that will participate in the
  upgrade. For a fork that range starts at the common ancestor; for a materialized baseline it
  starts at the recorded baseline commit, since no Git merge base exists.

## Integrate upstream

- Prefer merging the upstream default branch into a long-lived customized fork. Rebase only when
  the user requests it or the affected branch is unpublished and linear history has a concrete
  benefit.
- In a materialized-baseline project, histories are unrelated, so a plain merge of the source's
  default branch is wrong. Integrate the delta between the recorded baseline commit and the new
  upstream revision instead: merge with the recorded baseline commit treated as the base (for
  example `git merge --allow-unrelated-histories` only after confirming the diff being introduced
  is exactly `git diff <recorded-baseline-commit> <new-upstream-commit>`), or apply that range as
  patches when a merge would drag in unrelated history. Record the new baseline commit in the
  upgrade summary so the next upgrade has a starting point.
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
