---
name: upgrade
description:
  Safely bring upstream scaffold changes into a customized fork or platform-materialized baseline.
  Use for scaffold upgrades, not dependency-only upgrades or ordinary feature work.
---

# Upgrade

Bring upstream changes in without discarding the company's model, branding, workflows, or
migrations.

Do not start a merge over unrelated uncommitted work. Use a dedicated upgrade branch unless the
user chose another. Establish the topology first: a GitHub fork with `origin`/`upstream`, or a
platform-materialized baseline with no shared history. Fetch, then show the exact upstream range.

Prefer merging the upstream default branch into a long-lived fork. For a materialized baseline,
integrate only the delta from the recorded baseline commit. Resolve conflicts from base, upstream
intent, and company intent — never blanket `ours`/`theirs`. Do not rewrite applied migration
history. Regenerate derived files from source.

Run focused tests and `pnpm check`. Leave the result unpushed unless asked to publish. Report
remotes, range, resolutions, migrations, and remaining follow-up.
