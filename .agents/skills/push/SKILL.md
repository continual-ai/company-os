---
name: push
description: >-
  Commit the requested work as a coherent series of conventional commits and push the current branch.
  Use when asked to commit and push, publish local changes, or run $push.
---

# Push

Complete the commit-and-push workflow. Working directly on `main` is fine; use the current branch
unless the user specifies another. No feature branch or PR is required.

- Inspect the working tree, diff, outgoing commits, and upstream. Include the work authorized by the
  conversation; preserve unrelated changes and avoid staging secrets or generated clutter.
- Follow [AGENTS.md](../../../AGENTS.md) for validation. Reuse successful checks that still cover
  the current changes; run missing checks and rerun affected checks after fixes. Prose-only changes
  need document validation, not application tests. Fix failures caused by the work before pushing.
- Make a semantic series of conventional commits, grouped by purpose. Keep dependent changes and
  their tests together so each commit is coherent. One commit is enough for one cohesive change;
  do not split merely by file or layer.
- Use Conventional Commits: `type(scope): concise imperative title`, with an optional scope.
  Choose an accurate type (`feat`, `fix`, `refactor`, `docs`, `test`, `perf`, `build`, `ci`, or
  `chore`) so history can drive release notes. Describe the concrete change in the title; avoid
  vague titles such as "updates" or "cleanup". Add a useful body explaining the problem, resulting
  behavior, and rationale, with validation or tradeoffs when relevant. Write for someone who has
  not read the conversation; omit session history and file inventories. While pre-release, omit
  breaking-change markers and footers; explain contract changes in the ordinary description.
- Stage explicit paths or hunks and inspect each staged diff before committing.
- Fetch and push to the branch's upstream, or `origin` with the same branch name when no upstream
  exists. If the remote advanced, integrate it while preserving local work and revalidate affected
  behavior. Do not force-push.
- Verify the remote branch matches local HEAD and inspect the remaining working tree. Report the
  pushed branch, commits, validation, and any remaining changes. Distinguish local checks from CI.

Invoking this skill authorizes committing and pushing the requested work; proceed without another
confirmation unless the scope or destination cannot be determined safely.
